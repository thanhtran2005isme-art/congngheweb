using API.Customer.Data;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

/// <summary>
/// Background job: quét định kỳ, tự đóng các phiên chat (waiting/agent) đã "nguội"
/// (không có hoạt động trong Chat:IdleMinutes). Theo khuôn PaymentExpirySweeper.
/// </summary>
public class ChatIdleSweeper(
    IServiceProvider sp,
    ILogger<ChatIdleSweeper> logger,
    IConfiguration config) : BackgroundService
{
    private int IntervalSeconds => int.TryParse(config["Chat:SweepIntervalSeconds"], out var v) && v > 0 ? v : 120;
    private int IdleMinutes => int.TryParse(config["Chat:IdleMinutes"], out var v) && v > 0 ? v : 30;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("ChatIdleSweeper started. Interval={Sec}s, Idle={Min}m", IntervalSeconds, IdleMinutes);

        while (!ct.IsCancellationRequested)
        {
            try { await SweepAsync(ct); }
            catch (Exception ex) { logger.LogError(ex, "ChatIdleSweeper tick failed"); }

            try { await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), ct); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();

        var threshold = DateTime.UtcNow.AddMinutes(-IdleMinutes);
        var idle = await db.Conversations
            .Where(c => (c.Status == ChatStatus.Waiting || c.Status == ChatStatus.Agent)
                        && c.LastMessageAt < threshold)
            .ToListAsync(ct);

        if (idle.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var conv in idle)
        {
            // Tin tạm biệt tự động
            db.ChatMessages.Add(new ChatMessage
            {
                ConversationId = conv.Id,
                SenderType = ChatSender.Bot,
                Content = "Hội thoại được tạm đóng do không có hoạt động. Bạn nhắn tiếp bất cứ lúc nào để mở lại nhé!",
                CreatedAt = now,
            });
            conv.Status = ChatStatus.Closed;
            conv.LastMessageAt = now;
            conv.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("ChatIdleSweeper: auto-closed {Count} idle conversations", idle.Count);
    }
}
