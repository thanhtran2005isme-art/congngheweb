using System.Collections.Concurrent;
using System.Text.Json;
using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services.Bot;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

/// <summary>
/// Triển khai nghiệp vụ chat: tạo phiên, lưu tin, gọi bot, escalation, claim, đóng/mở lại,
/// đánh dấu đã đọc, liệt kê inbox. Đảm bảo các correctness property trong design.
/// </summary>
public class ChatService(CustomerDbContext db, IChatBot bot, IConfiguration config) : IChatService
{
    // Rate limit gửi tin theo phiên (in-memory, đủ cho 1 instance) — Req 14.4
    private static readonly ConcurrentDictionary<int, Queue<DateTime>> _rateWindows = new();

    private int RateLimitPerWindow => int.TryParse(config["Chat:RateLimitPerWindow"], out var v) ? v : 10;
    private int RateLimitWindowSeconds => int.TryParse(config["Chat:RateLimitWindowSeconds"], out var v) ? v : 10;

    // ===================== TẠO / LẤY PHIÊN =====================

    public async Task<ConversationDto> GetOrCreateAsync(ChatIdentity who, int? productContextId)
    {
        Conversation? conv = null;

        // Tìm phiên đang mở (chưa đóng) của chính người này
        if (who.IsAuthenticated)
        {
            conv = await db.Conversations
                .Where(c => c.UserId == who.UserId && c.Status != ChatStatus.Closed)
                .OrderByDescending(c => c.LastMessageAt)
                .FirstOrDefaultAsync();
        }
        else if (!string.IsNullOrWhiteSpace(who.GuestId))
        {
            conv = await db.Conversations
                .Where(c => c.GuestId == who.GuestId && c.Status != ChatStatus.Closed)
                .OrderByDescending(c => c.LastMessageAt)
                .FirstOrDefaultAsync();
        }

        if (conv is null)
        {
            conv = new Conversation
            {
                UserId = who.UserId,
                GuestId = who.IsGuest ? who.GuestId : null,
                DisplayName = who.DisplayName,
                Status = ChatStatus.Bot,
                ProductContextId = productContextId,
                LastMessageAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
            };
            db.Conversations.Add(conv);
            await db.SaveChangesAsync();
        }
        else if (productContextId is not null && conv.ProductContextId != productContextId)
        {
            conv.ProductContextId = productContextId;
            await db.SaveChangesAsync();
        }

        return ToDto(conv);
    }

    public async Task<ConversationDto?> GetConversationAsync(int conversationId)
    {
        var conv = await db.Conversations.FindAsync(conversationId);
        return conv is null ? null : ToDto(conv);
    }

    // ===================== TIN NHẮN KHÁCH =====================

    public async Task<CustomerMessageResult> AddCustomerMessageAsync(ChatIdentity who, int conversationId, string text, ChatAttachment? attach)
    {
        var conv = await db.Conversations.FindAsync(conversationId)
            ?? throw new InvalidOperationException("Không tìm thấy phiên hội thoại.");

        // Property 1: chỉ chủ sở hữu được gửi
        if (!OwnedBy(conv, who))
            throw new UnauthorizedAccessException("Bạn không có quyền truy cập phiên hội thoại này.");

        EnforceRateLimit(conversationId);

        // Phiên đã đóng → mở lại (Req 10.4)
        if (conv.Status == ChatStatus.Closed)
        {
            conv.Status = ChatStatus.Bot;
            conv.AssignedStaffId = null;
        }

        var customerMsg = new ChatMessage
        {
            ConversationId = conv.Id,
            SenderType = ChatSender.Customer,
            SenderId = who.UserId,
            Content = text,
            AttachmentType = attach?.Type,
            AttachmentRefId = attach?.RefId,
            AttachmentData = attach is null ? null : JsonSerializer.Serialize(attach),
            CreatedAt = DateTime.UtcNow,
        };
        db.ChatMessages.Add(customerMsg);

        conv.LastMessageAt = customerMsg.CreatedAt;
        conv.LastMessagePreview = Preview(text);
        conv.UnreadForAgent += 1; // nhân viên có 1 tin chưa đọc
        conv.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // Property 3: chỉ gọi bot khi phiên ở bot/waiting (không chen khi agent đang xử lý)
        MessageDto? botDto = null;
        var handedOff = false;
        if (conv.Status is ChatStatus.Bot or ChatStatus.Waiting)
        {
            var recent = await GetRecentHistoryAsync(conv.Id, 10);
            var botFailCount = CountTrailingBotFails(recent);
            var ctx = new BotContext(conv.Id, who, text, conv.ProductContextId, recent, botFailCount);
            var reply = await bot.RespondAsync(ctx);

            var botMsg = new ChatMessage
            {
                ConversationId = conv.Id,
                SenderType = ChatSender.Bot,
                SenderId = null,
                Content = reply.Text,
                AttachmentType = reply.Attachment?.Type,
                AttachmentRefId = reply.Attachment?.RefId,
                AttachmentData = reply.Attachment is null ? null : JsonSerializer.Serialize(reply.Attachment),
                CreatedAt = DateTime.UtcNow,
            };
            db.ChatMessages.Add(botMsg);

            conv.LastMessageAt = botMsg.CreatedAt;
            conv.LastMessagePreview = Preview(reply.Text);
            conv.UnreadForCustomer += 1;

            // Escalation khi bot đề nghị (Req 6.1, 6.2)
            if (reply.ShouldHandoff && conv.Status == ChatStatus.Bot)
            {
                conv.Status = ChatStatus.Waiting;
                handedOff = true;
            }

            await db.SaveChangesAsync();
            botDto = ToDto(botMsg, reply.QuickReplies);
        }

        return new CustomerMessageResult(ToDto(customerMsg), botDto, handedOff);
    }

    // ===================== TIN NHẮN NHÂN VIÊN =====================

    public async Task<MessageDto> AddAgentMessageAsync(int staffId, int conversationId, string text, ChatAttachment? attach)
    {
        var conv = await db.Conversations.FindAsync(conversationId)
            ?? throw new InvalidOperationException("Không tìm thấy phiên hội thoại.");

        // Nhân viên trả lời → đảm bảo phiên ở trạng thái agent và gán cho người này
        if (conv.Status != ChatStatus.Agent)
        {
            conv.Status = ChatStatus.Agent;
        }
        conv.AssignedStaffId ??= staffId;

        var msg = new ChatMessage
        {
            ConversationId = conv.Id,
            SenderType = ChatSender.Agent,
            SenderId = staffId,
            Content = text,
            AttachmentType = attach?.Type,
            AttachmentRefId = attach?.RefId,
            AttachmentData = attach is null ? null : JsonSerializer.Serialize(attach),
            CreatedAt = DateTime.UtcNow,
        };
        db.ChatMessages.Add(msg);

        conv.LastMessageAt = msg.CreatedAt;
        conv.LastMessagePreview = Preview(text);
        conv.UnreadForCustomer += 1;
        conv.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return ToDto(msg);
    }

    // ===================== LỊCH SỬ =====================

    public async Task<IReadOnlyList<MessageDto>> GetHistoryAsync(ChatIdentity who, int conversationId, int take, int beforeId)
    {
        var conv = await db.Conversations.FindAsync(conversationId)
            ?? throw new InvalidOperationException("Không tìm thấy phiên hội thoại.");
        if (!OwnedBy(conv, who))
            throw new UnauthorizedAccessException("Bạn không có quyền truy cập phiên hội thoại này.");

        var q = db.ChatMessages.Where(m => m.ConversationId == conversationId);
        if (beforeId > 0) q = q.Where(m => m.Id < beforeId);

        // Property 4: trả về theo thứ tự tăng dần
        var rows = await q.OrderByDescending(m => m.Id)
            .Take(take <= 0 ? 50 : take)
            .ToListAsync();
        rows.Reverse();
        return rows.Select(m => ToDto(m)).ToList();
    }

    // ===================== ESCALATION / CLAIM / ĐÓNG =====================

    public async Task<MessageDto?> RequestHandoffAsync(int conversationId, string? reason)
    {
        var conv = await db.Conversations.FindAsync(conversationId);
        if (conv is null) return null;
        if (conv.Status is ChatStatus.Agent) return null; // đã có nhân viên xử lý

        conv.Status = ChatStatus.Waiting;
        conv.UpdatedAt = DateTime.UtcNow;

        // Tin hệ thống (gửi dưới danh nghĩa bot) báo khách đang chờ nhân viên
        const string waitMsg = "Yêu cầu của bạn đã được chuyển tới nhân viên hỗ trợ. Vui lòng chờ trong giây lát, nhân viên sẽ phản hồi sớm nhất có thể nhé! 🙋";
        var sysMsg = new ChatMessage
        {
            ConversationId = conv.Id,
            SenderType = ChatSender.Bot,
            Content = waitMsg,
            CreatedAt = DateTime.UtcNow,
        };
        db.ChatMessages.Add(sysMsg);
        conv.LastMessageAt = sysMsg.CreatedAt;
        conv.LastMessagePreview = Preview(waitMsg);
        conv.UnreadForCustomer += 1;

        await db.SaveChangesAsync();
        return ToDto(sysMsg);
    }

    public async Task<bool> ClaimAsync(int staffId, int conversationId)
    {
        // Property 2: claim độc quyền — chỉ thành công khi chưa ai nhận.
        // Dùng cập nhật có điều kiện qua ExecuteUpdate (atomic ở DB).
        var affected = await db.Conversations
            .Where(c => c.Id == conversationId
                && (c.AssignedStaffId == null || c.Status == ChatStatus.Waiting)
                && c.Status != ChatStatus.Agent)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.AssignedStaffId, staffId)
                .SetProperty(c => c.Status, ChatStatus.Agent)
                .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));

        if (affected > 0)
        {
            // ExecuteUpdate bỏ qua change tracker → đồng bộ lại entity đang tracking (nếu có)
            // để các thao tác sau trong cùng scope thấy trạng thái mới.
            var tracked = await db.Conversations.FindAsync(conversationId);
            if (tracked is not null) await db.Entry(tracked).ReloadAsync();
        }

        return affected > 0;
    }

    public async Task<ClaimResult> ClaimWithMessageAsync(int staffId, int conversationId, string? staffName)
    {
        var ok = await ClaimAsync(staffId, conversationId);
        if (!ok) return new ClaimResult(false, null, staffId);

        // Tin hệ thống báo khách đã được kết nối với nhân viên
        var name = string.IsNullOrWhiteSpace(staffName) ? "Nhân viên hỗ trợ" : staffName;
        var text = $"Bạn đã được kết nối với {name}. Nhân viên sẽ hỗ trợ bạn ngay bây giờ! 👩‍💼";
        var sysMsg = new ChatMessage
        {
            ConversationId = conversationId,
            SenderType = ChatSender.Bot,
            Content = text,
            CreatedAt = DateTime.UtcNow,
        };
        db.ChatMessages.Add(sysMsg);

        var conv = await db.Conversations.FindAsync(conversationId);
        if (conv is not null)
        {
            conv.LastMessageAt = sysMsg.CreatedAt;
            conv.LastMessagePreview = Preview(text);
            conv.UnreadForCustomer += 1;
            conv.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();

        return new ClaimResult(true, ToDto(sysMsg), staffId);
    }

    public async Task CloseAsync(int conversationId, ChatActor by)
    {
        var conv = await db.Conversations.FindAsync(conversationId);
        if (conv is null) return;
        conv.Status = ChatStatus.Closed;
        conv.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task<bool> CloseByCustomerAsync(ChatIdentity who, int conversationId)
    {
        var conv = await db.Conversations.FindAsync(conversationId);
        if (conv is null) return false;
        if (!OwnedBy(conv, who)) throw new UnauthorizedAccessException("Bạn không có quyền truy cập phiên hội thoại này.");
        if (conv.Status == ChatStatus.Closed) return true;

        // Tin hệ thống đánh dấu kết thúc phiên
        const string endMsg = "Phiên trò chuyện đã kết thúc. Cảm ơn bạn đã liên hệ KaitoKid Shop! 💖";
        db.ChatMessages.Add(new ChatMessage
        {
            ConversationId = conv.Id,
            SenderType = ChatSender.Bot,
            Content = endMsg,
            CreatedAt = DateTime.UtcNow,
        });
        conv.Status = ChatStatus.Closed;
        conv.LastMessageAt = DateTime.UtcNow;
        conv.LastMessagePreview = Preview(endMsg);
        conv.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<ConversationDto>> ListForCustomerAsync(ChatIdentity who)
    {
        IQueryable<Conversation> q = db.Conversations;
        if (who.IsAuthenticated)
            q = q.Where(c => c.UserId == who.UserId);
        else if (!string.IsNullOrWhiteSpace(who.GuestId))
            q = q.Where(c => c.GuestId == who.GuestId);
        else
            return [];

        var items = await q.OrderByDescending(c => c.LastMessageAt).Take(50).ToListAsync();
        return items.Select(c => ToDto(c)).ToList();
    }

    public async Task MarkReadAsync(int conversationId, ChatActor reader)
    {
        var conv = await db.Conversations.FindAsync(conversationId);
        if (conv is null) return;

        if (reader == ChatActor.Customer)
        {
            // Khách đọc → các tin của bot/agent thành đã đọc
            await db.ChatMessages
                .Where(m => m.ConversationId == conversationId && m.SenderType != ChatSender.Customer && !m.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true));
            conv.UnreadForCustomer = 0;
        }
        else
        {
            // Nhân viên đọc → các tin của khách thành đã đọc
            await db.ChatMessages
                .Where(m => m.ConversationId == conversationId && m.SenderType == ChatSender.Customer && !m.IsRead)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true));
            conv.UnreadForAgent = 0;
        }
        conv.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    // ===================== INBOX NHÂN VIÊN =====================

    public async Task<PagedResult<ConversationDto>> ListForAgentAsync(ChatInboxFilter filter)
    {
        var q = db.Conversations.AsQueryable();
        if (!string.IsNullOrWhiteSpace(filter.Status))
            q = q.Where(c => c.Status == filter.Status);
        if (filter.AssignedStaffId is int sid)
            q = q.Where(c => c.AssignedStaffId == sid);

        var total = await q.CountAsync();
        var page = filter.Page <= 0 ? 1 : filter.Page;
        var size = filter.PageSize <= 0 ? 20 : filter.PageSize;

        var items = await q
            .OrderByDescending(c => c.LastMessageAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync();

        return new PagedResult<ConversationDto>
        {
            Items = items.Select(c => ToDto(c)).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = size,
        };
    }

    public async Task<bool> IsOwnerAsync(int conversationId, ChatIdentity who)
    {
        var conv = await db.Conversations.FindAsync(conversationId);
        return conv is not null && OwnedBy(conv, who);
    }

    // ===================== HELPERS =====================

    private static bool OwnedBy(Conversation conv, ChatIdentity who)
    {
        if (who.IsAuthenticated) return conv.UserId == who.UserId;
        return !string.IsNullOrWhiteSpace(who.GuestId) && conv.GuestId == who.GuestId;
    }

    private async Task<IReadOnlyList<MessageDto>> GetRecentHistoryAsync(int conversationId, int take)
    {
        var rows = await db.ChatMessages
            .Where(m => m.ConversationId == conversationId)
            .OrderByDescending(m => m.Id)
            .Take(take)
            .ToListAsync();
        rows.Reverse();
        return rows.Select(m => ToDto(m)).ToList();
    }

    /// <summary>Đếm số tin bot liên tiếp ở cuối lịch sử mà không có tin khách xen giữa kết quả hữu ích.</summary>
    private static int CountTrailingBotFails(IReadOnlyList<MessageDto> history)
    {
        // Đếm số lần bot trả "Unknown"-ish gần đây: xấp xỉ bằng số tin bot liên tiếp gần cuối.
        var count = 0;
        for (var i = history.Count - 1; i >= 0; i--)
        {
            if (history[i].SenderType == ChatSender.Bot) count++;
            else if (history[i].SenderType == ChatSender.Customer) break;
        }
        return count;
    }

    private void EnforceRateLimit(int conversationId)
    {
        var now = DateTime.UtcNow;
        var window = TimeSpan.FromSeconds(RateLimitWindowSeconds);
        var queue = _rateWindows.GetOrAdd(conversationId, _ => new Queue<DateTime>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() > window)
                queue.Dequeue();
            if (queue.Count >= RateLimitPerWindow)
                throw new InvalidOperationException("Bạn gửi tin quá nhanh. Vui lòng chờ một chút rồi thử lại.");
            queue.Enqueue(now);
        }
    }

    private static string Preview(string text)
        => text.Length <= 200 ? text : text[..200];

    private static ConversationDto ToDto(Conversation c) => new(
        c.Id, c.Status, c.UserId, c.GuestId, c.DisplayName, c.AssignedStaffId,
        c.ProductContextId, c.LastMessagePreview, c.LastMessageAt,
        c.UnreadForCustomer, c.UnreadForAgent, c.CreatedAt);

    private static MessageDto ToDto(ChatMessage m, IReadOnlyList<QuickReply>? quickReplies = null)
    {
        ChatAttachment? attach = null;
        if (!string.IsNullOrWhiteSpace(m.AttachmentData))
        {
            try { attach = JsonSerializer.Deserialize<ChatAttachment>(m.AttachmentData); }
            catch { attach = null; }
        }
        return new MessageDto(m.Id, m.ConversationId, m.SenderType, m.SenderId, m.Content, attach, m.IsRead, m.CreatedAt, quickReplies);
    }
}
