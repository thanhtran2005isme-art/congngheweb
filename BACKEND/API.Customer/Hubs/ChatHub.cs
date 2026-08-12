using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace API.Customer.Hubs;

/// <summary>
/// Hub real-time cho chat. AllowAnonymous: tự phân giải danh tính trong hub
/// (JWT cho khách đăng nhập/nhân viên; guestId cho khách vãng lai).
/// Group: "conv:{id}" cho mỗi phiên, "agents" cho nhân viên trực inbox.
/// </summary>
[AllowAnonymous]
public class ChatHub(IChatService chat) : Hub
{
    private const string AgentsGroup = "agents";
    private static string ConvGroup(int id) => $"conv:{id}";

    private bool IsStaff => Context.User?.FindFirst("user_type")?.Value == "staff";
    private int? UserId => int.TryParse(Context.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private string? UserName => Context.User?.FindFirstValue(ClaimTypes.Name);

    private ChatIdentity ResolveCustomer(string? guestId)
    {
        if (UserId is int uid && !IsStaff) return ChatIdentity.ForUser(uid, UserName);
        return ChatIdentity.ForGuest(guestId ?? "");
    }

    /// <summary>Khách/nhân viên tham gia một phiên để nhận tin real-time.</summary>
    public async Task JoinConversation(int conversationId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, ConvGroup(conversationId));
    }

    /// <summary>Nhân viên vào hàng đợi để nhận thông báo phiên mới/hàng đợi.</summary>
    public async Task JoinAgentQueue()
    {
        if (!IsStaff)
            throw new HubException("Chỉ nhân viên mới được vào hàng đợi hỗ trợ.");
        await Groups.AddToGroupAsync(Context.ConnectionId, AgentsGroup);
    }

    /// <summary>Khách gửi tin: lưu + (nếu phiên do bot) sinh phản hồi, rồi broadcast.</summary>
    public async Task SendMessage(int conversationId, string text, ChatAttachment? attach, string? guestId)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        var who = ResolveCustomer(guestId);

        var result = await chat.AddCustomerMessageAsync(who, conversationId, text.Trim(), attach);

        // Tin của khách → phát cho mọi người trong phiên + cập nhật hàng đợi nhân viên
        await Clients.Group(ConvGroup(conversationId)).SendAsync("ReceiveMessage", result.CustomerMessage);
        await Clients.Group(AgentsGroup).SendAsync("ConversationUpdated", conversationId);

        // Phản hồi bot (nếu có)
        if (result.BotMessage is not null)
            await Clients.Group(ConvGroup(conversationId)).SendAsync("ReceiveMessage", result.BotMessage);

        // Bot escalation → báo hàng đợi
        if (result.HandedOff)
        {
            await Clients.Group(ConvGroup(conversationId)).SendAsync("HandoffRequested", conversationId);
            await Clients.Group(AgentsGroup).SendAsync("QueueUpdated", conversationId);
        }
    }

    /// <summary>Nhân viên gửi trả lời.</summary>
    public async Task AgentSendMessage(int conversationId, string text, ChatAttachment? attach)
    {
        if (!IsStaff) throw new HubException("Không có quyền.");
        if (string.IsNullOrWhiteSpace(text)) return;
        if (UserId is not int staffId) throw new HubException("Phiên đăng nhập không hợp lệ.");

        var msg = await chat.AddAgentMessageAsync(staffId, conversationId, text.Trim(), attach);
        await Clients.Group(ConvGroup(conversationId)).SendAsync("ReceiveMessage", msg);
        await Clients.Group(AgentsGroup).SendAsync("ConversationUpdated", conversationId);
    }

    /// <summary>Nhân viên nhận phiên (claim) — chống trùng.</summary>
    public async Task ClaimConversation(int conversationId)
    {
        if (!IsStaff) throw new HubException("Không có quyền.");
        if (UserId is not int staffId) throw new HubException("Phiên đăng nhập không hợp lệ.");

        var result = await chat.ClaimWithMessageAsync(staffId, conversationId, UserName);
        if (result.Success)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, ConvGroup(conversationId));
            // Tin hệ thống "đã kết nối với nhân viên" → gửi cho cả khách và nhân viên trong phiên
            if (result.SystemMessage is not null)
                await Clients.Group(ConvGroup(conversationId)).SendAsync("ReceiveMessage", result.SystemMessage);
            await Clients.Group(ConvGroup(conversationId)).SendAsync("ConversationUpdated", conversationId);
            await Clients.Group(AgentsGroup).SendAsync("QueueUpdated", conversationId);
        }
        else
        {
            await Clients.Caller.SendAsync("ClaimFailed", conversationId);
        }
    }

    /// <summary>Yêu cầu gặp nhân viên từ phía khách.</summary>
    public async Task RequestHandoff(int conversationId)
    {
        var sysMsg = await chat.RequestHandoffAsync(conversationId, null);
        if (sysMsg is not null)
            await Clients.Group(ConvGroup(conversationId)).SendAsync("ReceiveMessage", sysMsg);
        await Clients.Group(ConvGroup(conversationId)).SendAsync("HandoffRequested", conversationId);
        await Clients.Group(AgentsGroup).SendAsync("QueueUpdated", conversationId);
    }

    /// <summary>Khách kết thúc phiên trò chuyện.</summary>
    public async Task EndConversation(int conversationId, string? guestId)
    {
        var who = ResolveCustomer(guestId);
        var ok = await chat.CloseByCustomerAsync(who, conversationId);
        if (ok)
        {
            await Clients.Group(ConvGroup(conversationId)).SendAsync("ConversationClosed", conversationId);
            await Clients.Group(AgentsGroup).SendAsync("ConversationUpdated", conversationId);
        }
    }

    /// <summary>Chỉ báo "đang nhập…".</summary>
    public async Task Typing(int conversationId, bool isTyping)
    {
        var role = IsStaff ? "agent" : "customer";
        await Clients.OthersInGroup(ConvGroup(conversationId)).SendAsync("TypingChanged", conversationId, role, isTyping);
    }

    /// <summary>Đánh dấu đã đọc.</summary>
    public async Task MarkRead(int conversationId)
    {
        var actor = IsStaff ? ChatActor.Agent : ChatActor.Customer;
        await chat.MarkReadAsync(conversationId, actor);
        await Clients.Group(ConvGroup(conversationId)).SendAsync("ReadReceipt", conversationId, actor.ToString());
    }
}
