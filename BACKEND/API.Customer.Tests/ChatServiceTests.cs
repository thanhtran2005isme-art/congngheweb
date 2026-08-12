using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace API.Customer.Tests;

public class ChatServiceTests
{
    private static ChatService NewService(TestDb db, bool handoff = false)
        => new(db.Context, new FakeBot(handoff), TestConfig.Create());

    [Fact]
    public async Task GetOrCreate_Guest_CreatesBotConversation()
    {
        using var db = new TestDb();
        var svc = NewService(db);

        var conv = await svc.GetOrCreateAsync(ChatIdentity.ForGuest("g1"), null);

        Assert.Equal(ChatStatus.Bot, conv.Status);
        Assert.Equal("g1", conv.GuestId);
        Assert.Null(conv.UserId);
    }

    [Fact]
    public async Task GetOrCreate_ReusesOpenConversation()
    {
        using var db = new TestDb();
        var svc = NewService(db);

        var a = await svc.GetOrCreateAsync(ChatIdentity.ForGuest("g1"), null);
        var b = await svc.GetOrCreateAsync(ChatIdentity.ForGuest("g1"), null);

        Assert.Equal(a.Id, b.Id);
    }

    // Property 1: cô lập quyền sở hữu
    [Fact]
    public async Task History_OtherOwner_Throws()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var conv = await svc.GetOrCreateAsync(ChatIdentity.ForGuest("g1"), null);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            svc.GetHistoryAsync(ChatIdentity.ForGuest("g2"), conv.Id, 50, 0));
    }

    [Fact]
    public async Task SendMessage_OtherOwner_Throws()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var conv = await svc.GetOrCreateAsync(ChatIdentity.ForUser(1, "A"), null);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            svc.AddCustomerMessageAsync(ChatIdentity.ForUser(2, "B"), conv.Id, "hi", null));
    }

    [Fact]
    public async Task SendMessage_PersistsCustomerAndBot()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var who = ChatIdentity.ForGuest("g1");
        var conv = await svc.GetOrCreateAsync(who, null);

        var result = await svc.AddCustomerMessageAsync(who, conv.Id, "xin chào", null);

        Assert.Equal(ChatSender.Customer, result.CustomerMessage.SenderType);
        Assert.NotNull(result.BotMessage);
        Assert.Equal(ChatSender.Bot, result.BotMessage!.SenderType);

        var count = await db.Context.ChatMessages.CountAsync(m => m.ConversationId == conv.Id);
        Assert.Equal(2, count);
    }

    // Property 6 + escalation: bot handoff → phiên sang waiting
    [Fact]
    public async Task SendMessage_BotHandoff_SetsWaiting()
    {
        using var db = new TestDb();
        var svc = NewService(db, handoff: true);
        var who = ChatIdentity.ForGuest("g1");
        var conv = await svc.GetOrCreateAsync(who, null);

        var result = await svc.AddCustomerMessageAsync(who, conv.Id, "gặp nhân viên", null);

        Assert.True(result.HandedOff);
        var entity = await db.Context.Conversations.FindAsync(conv.Id);
        Assert.Equal(ChatStatus.Waiting, entity!.Status);
    }

    // Property 2: claim độc quyền
    [Fact]
    public async Task Claim_SecondStaff_Fails()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var who = ChatIdentity.ForGuest("g1");
        var conv = await svc.GetOrCreateAsync(who, null);
        await svc.RequestHandoffAsync(conv.Id, null);

        var first = await svc.ClaimAsync(10, conv.Id);
        var second = await svc.ClaimAsync(20, conv.Id);

        Assert.True(first);
        Assert.False(second);

        var entity = await db.Context.Conversations.FindAsync(conv.Id);
        Assert.Equal(10, entity!.AssignedStaffId);
        Assert.Equal(ChatStatus.Agent, entity.Status);
    }

    // Property 3: bot không chen khi phiên đang agent
    [Fact]
    public async Task SendMessage_WhenAgent_NoBotReply()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var who = ChatIdentity.ForGuest("g1");
        var conv = await svc.GetOrCreateAsync(who, null);
        await svc.RequestHandoffAsync(conv.Id, null);
        await svc.ClaimAsync(10, conv.Id); // → agent

        var result = await svc.AddCustomerMessageAsync(who, conv.Id, "câu hỏi", null);

        Assert.Null(result.BotMessage);
    }

    // Property 6: mở lại phiên đã đóng khi khách nhắn tiếp
    [Fact]
    public async Task SendMessage_ReopensClosedConversation()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var who = ChatIdentity.ForGuest("g1");
        var conv = await svc.GetOrCreateAsync(who, null);
        await svc.CloseAsync(conv.Id, ChatActor.Agent);

        await svc.AddCustomerMessageAsync(who, conv.Id, "còn đó không", null);

        var entity = await db.Context.Conversations.FindAsync(conv.Id);
        Assert.NotEqual(ChatStatus.Closed, entity!.Status);
    }

    // Property 4: lịch sử theo thứ tự tăng dần
    [Fact]
    public async Task History_ReturnsAscending()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var who = ChatIdentity.ForGuest("g1");
        var conv = await svc.GetOrCreateAsync(who, null);
        await svc.AddCustomerMessageAsync(who, conv.Id, "tin 1", null);
        await svc.AddCustomerMessageAsync(who, conv.Id, "tin 2", null);

        var history = await svc.GetHistoryAsync(who, conv.Id, 50, 0);

        for (var i = 1; i < history.Count; i++)
            Assert.True(history[i].Id > history[i - 1].Id);
    }

    // Property 7: mark read → unread về 0
    [Fact]
    public async Task MarkRead_Agent_ResetsUnread()
    {
        using var db = new TestDb();
        var svc = NewService(db);
        var who = ChatIdentity.ForGuest("g1");
        var conv = await svc.GetOrCreateAsync(who, null);
        await svc.AddCustomerMessageAsync(who, conv.Id, "tin khách", null);

        await svc.MarkReadAsync(conv.Id, ChatActor.Agent);

        var entity = await db.Context.Conversations.FindAsync(conv.Id);
        Assert.Equal(0, entity!.UnreadForAgent);
    }

    [Fact]
    public async Task RateLimit_Exceeded_Throws()
    {
        using var db = new TestDb();
        var cfg = TestConfig.Create(new Dictionary<string, string?>
        {
            ["Chat:RateLimitPerWindow"] = "2",
            ["Chat:RateLimitWindowSeconds"] = "60",
            ["Chat:MaxBotFailBeforeHandoff"] = "2",
        });
        var svc = new ChatService(db.Context, new FakeBot(), cfg);
        var who = ChatIdentity.ForGuest("g-rate");
        var conv = await svc.GetOrCreateAsync(who, null);

        await svc.AddCustomerMessageAsync(who, conv.Id, "1", null);
        await svc.AddCustomerMessageAsync(who, conv.Id, "2", null);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            svc.AddCustomerMessageAsync(who, conv.Id, "3", null));
    }
}
