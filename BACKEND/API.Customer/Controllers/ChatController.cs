using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using API.Customer.Services.Bot;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

/// <summary>
/// REST cho chat phía KHÁCH. AllowAnonymous: phục vụ cả khách đăng nhập lẫn vãng lai.
/// Danh tính được phân giải từ JWT (nếu có) hoặc guestId. Là fallback/khởi tạo khi chưa có hub.
/// </summary>
[ApiController]
[Route("api/chat")]
[AllowAnonymous]
public class ChatController(IChatService chat, IChatSettingsProvider chatSettings) : ControllerBase
{
    private ChatIdentity Resolve(string? guestId) => ChatIdentity.FromPrincipal(User, guestId);

    /// <summary>Cho biết chatbot đang chạy chế độ nào: "llm" (AI) hay "rule" (cơ bản).</summary>
    [HttpGet("bot-mode")]
    public async Task<IActionResult> GetBotMode()
    {
        var s = await chatSettings.GetAsync();
        var useLlm = s.LlmEnabled && !string.IsNullOrWhiteSpace(s.ApiKey) && !string.IsNullOrWhiteSpace(s.Endpoint);
        return Ok(new
        {
            mode = useLlm ? "llm" : "rule",
            label = useLlm ? "Trợ lý AI" : "Trợ lý cơ bản",
        });
    }

    /// <summary>Lấy/tạo phiên cho khách (kèm ngữ cảnh sản phẩm đang xem).</summary>
    [HttpPost("conversations")]
    public async Task<IActionResult> CreateOrGet([FromBody] CreateConversationDto dto)
    {
        var who = Resolve(dto.GuestId);
        if (who.IsGuest && string.IsNullOrWhiteSpace(who.GuestId))
            return BadRequest(new { message = "Thiếu định danh khách (guestId)." });

        var conv = await chat.GetOrCreateAsync(who, dto.ProductContextId);
        return Ok(conv);
    }

    /// <summary>Lịch sử tin nhắn của một phiên (chỉ chủ sở hữu).</summary>
    [HttpGet("conversations/{id:int}/messages")]
    public async Task<IActionResult> GetMessages(int id, [FromQuery] string? guestId, [FromQuery] int take = 50, [FromQuery] int beforeId = 0)
    {
        var who = Resolve(guestId);
        try
        {
            var msgs = await chat.GetHistoryAsync(who, id, take, beforeId);
            return Ok(msgs);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return NotFound(new { message = ex.Message }); }
    }

    /// <summary>Gửi tin nhắn (fallback khi không có hub). Trả tin khách + phản hồi bot (nếu có).</summary>
    [HttpPost("messages")]
    public async Task<IActionResult> Send([FromBody] SendMessageDto dto)
    {
        var who = Resolve(dto.GuestId);
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest(new { message = "Nội dung trống." });
        try
        {
            var result = await chat.AddCustomerMessageAsync(who, dto.ConversationId, dto.Content.Trim(), dto.Attachment);
            return Ok(result);
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>Yêu cầu gặp nhân viên. Trả về tin hệ thống báo đang chờ (nếu có).</summary>
    [HttpPost("conversations/{id:int}/handoff")]
    public async Task<IActionResult> Handoff(int id, [FromQuery] string? guestId, [FromBody] HandoffRequest? body)
    {
        var who = Resolve(guestId ?? body?.GuestId);
        if (!await chat.IsOwnerAsync(id, who)) return Forbid();
        var sysMsg = await chat.RequestHandoffAsync(id, body?.Reason);
        return Ok(new { status = "waiting", systemMessage = sysMsg });
    }

    /// <summary>Khách kết thúc phiên trò chuyện hiện tại.</summary>
    [HttpPost("conversations/{id:int}/end")]
    public async Task<IActionResult> End(int id, [FromQuery] string? guestId, [FromBody] HandoffRequest? body)
    {
        var who = Resolve(guestId ?? body?.GuestId);
        try
        {
            var ok = await chat.CloseByCustomerAsync(who, id);
            return ok ? Ok(new { status = "closed" }) : NotFound();
        }
        catch (UnauthorizedAccessException) { return Forbid(); }
    }

    /// <summary>Danh sách các phiên trò chuyện (lịch sử) của khách.</summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> ListMine([FromQuery] string? guestId)
    {
        var who = Resolve(guestId);
        var list = await chat.ListForCustomerAsync(who);
        return Ok(list);
    }

    /// <summary>Đánh dấu đã đọc (khách).</summary>
    [HttpPost("conversations/{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id, [FromQuery] string? guestId)
    {
        var who = Resolve(guestId);
        if (!await chat.IsOwnerAsync(id, who)) return Forbid();
        await chat.MarkReadAsync(id, ChatActor.Customer);
        return Ok(new { message = "ok" });
    }

    public record HandoffRequest(string? Reason, string? GuestId);
}

/// <summary>
/// REST cho chat phía NHÂN VIÊN (inbox admin). Yêu cầu role "admin" (nhất quán toàn hệ thống).
/// </summary>
[ApiController]
[Route("api/admin/chat")]
[Authorize(Roles = "admin")]
public class AdminChatController(IChatService chat) : ControllerBase
{
    private int StaffId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string? StaffName => User.FindFirstValue(ClaimTypes.Name);

    /// <summary>Danh sách hội thoại trong inbox (lọc theo trạng thái).</summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] int? assignedStaffId = null)
    {
        var result = await chat.ListForAgentAsync(new ChatInboxFilter(status, page, pageSize, assignedStaffId));
        return Ok(result);
    }

    /// <summary>Chi tiết một hội thoại + toàn bộ lịch sử.</summary>
    [HttpGet("conversations/{id:int}")]
    public async Task<IActionResult> Detail(int id)
    {
        var conv = await chat.GetConversationAsync(id);
        if (conv is null) return NotFound();
        // Nhân viên xem được mọi phiên → dùng identity "ảo" theo chủ sở hữu phiên để lấy lịch sử
        var owner = conv.UserId is int uid
            ? ChatIdentity.ForUser(uid, conv.DisplayName)
            : ChatIdentity.ForGuest(conv.GuestId ?? "");
        var msgs = await chat.GetHistoryAsync(owner, id, 200, 0);
        return Ok(new { conversation = conv, messages = msgs });
    }

    /// <summary>Nhận phiên (claim) — chống nhận trùng.</summary>
    [HttpPost("conversations/{id:int}/claim")]
    public async Task<IActionResult> Claim(int id)
    {
        var result = await chat.ClaimWithMessageAsync(StaffId, id, StaffName);
        return result.Success
            ? Ok(new { status = "agent", assignedStaffId = StaffId, systemMessage = result.SystemMessage })
            : Conflict(new { message = "Phiên đã được nhân viên khác nhận." });
    }

    /// <summary>Trả lời khách (fallback REST).</summary>
    [HttpPost("conversations/{id:int}/reply")]
    public async Task<IActionResult> Reply(int id, [FromBody] AgentReplyDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            return BadRequest(new { message = "Nội dung trống." });
        var msg = await chat.AddAgentMessageAsync(StaffId, id, dto.Content.Trim(), dto.Attachment);
        return Ok(msg);
    }

    /// <summary>Đóng phiên.</summary>
    [HttpPost("conversations/{id:int}/close")]
    public async Task<IActionResult> Close(int id)
    {
        await chat.CloseAsync(id, ChatActor.Agent);
        return Ok(new { status = "closed" });
    }

    /// <summary>Đánh dấu đã đọc (nhân viên).</summary>
    [HttpPost("conversations/{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        await chat.MarkReadAsync(id, ChatActor.Agent);
        return Ok(new { message = "ok" });
    }

    public record AgentReplyDto(string Content, ChatAttachment? Attachment);
}
