using API.Customer.DTOs;
using API.Customer.Models;
using API.Customer.Services.Bot;
using API.Customer.Services.Bot.Skills;
using Xunit;

namespace API.Customer.Tests;

public class ChatBotTests
{
    private static BotContext Ctx(string text, ChatIdentity who, int? productId = null, int failCount = 0)
        => new(1, who, text, productId, [], failCount);

    // ===== RuleBasedChatBot routing =====

    [Fact]
    public async Task Bot_Greeting_ReturnsQuickReplies()
    {
        using var db = new TestDb();
        var bot = BuildBot(db);

        var reply = await bot.RespondAsync(Ctx("xin chào", ChatIdentity.ForGuest("g1")));

        Assert.Equal(BotIntent.Greeting, reply.Intent);
        Assert.NotEmpty(reply.QuickReplies);
    }

    [Fact]
    public async Task Bot_HandoffKeyword_SetsHandoff()
    {
        using var db = new TestDb();
        var bot = BuildBot(db);

        var reply = await bot.RespondAsync(Ctx("cho tôi gặp nhân viên", ChatIdentity.ForGuest("g1")));

        Assert.True(reply.ShouldHandoff);
        Assert.Equal(BotIntent.Handoff, reply.Intent);
    }

    [Fact]
    public async Task Bot_Unknown_BelowThreshold_NoHandoff()
    {
        using var db = new TestDb();
        var bot = BuildBot(db);

        var reply = await bot.RespondAsync(Ctx("asdfghjkl qwerty", ChatIdentity.ForGuest("g1"), failCount: 0));

        Assert.False(reply.ShouldHandoff);
        Assert.Equal(BotIntent.Unknown, reply.Intent);
    }

    [Fact]
    public async Task Bot_Unknown_AtThreshold_Handoff()
    {
        using var db = new TestDb();
        var bot = BuildBot(db);

        var reply = await bot.RespondAsync(Ctx("asdfghjkl qwerty", ChatIdentity.ForGuest("g1"), failCount: 1));

        Assert.True(reply.ShouldHandoff);
    }

    // ===== OrderLookupSkill (Property 8: không rò rỉ dữ liệu) =====

    [Fact]
    public async Task OrderLookup_GuestWithoutCode_AsksForCode()
    {
        using var db = new TestDb();
        var skill = new OrderLookupSkill(db.Context);

        var reply = await skill.HandleAsync(Ctx("tình trạng đơn hàng của tôi", ChatIdentity.ForGuest("g1")));

        Assert.Contains("mã đơn", reply.Text.ToLowerInvariant());
    }

    [Fact]
    public async Task OrderLookup_CodeNotOwned_DoesNotLeak()
    {
        using var db = new TestDb();
        db.Context.Orders.Add(new Order
        {
            OrderCode = "KK-20250326-ABC123",
            UserId = 99,
            Total = 500000,
            Status = "completed",
        });
        await db.Context.SaveChangesAsync();

        var skill = new OrderLookupSkill(db.Context);
        // Người hỏi là user khác (id=1)
        var reply = await skill.HandleAsync(Ctx("đơn KK-20250326-ABC123", ChatIdentity.ForUser(1, "X")));

        Assert.DoesNotContain("500", reply.Text);
        Assert.Contains("không tìm thấy", reply.Text.ToLowerInvariant());
    }

    [Fact]
    public async Task OrderLookup_OwnedCode_ReturnsInfo()
    {
        using var db = new TestDb();
        db.Context.Orders.Add(new Order
        {
            OrderCode = "KK-20250326-OWN999",
            UserId = 7,
            Total = 350000,
            Status = "completed",
        });
        await db.Context.SaveChangesAsync();

        var skill = new OrderLookupSkill(db.Context);
        var reply = await skill.HandleAsync(Ctx("đơn KK-20250326-OWN999", ChatIdentity.ForUser(7, "Owner")));

        Assert.Equal(BotIntent.OrderLookup, reply.Intent);
        Assert.NotNull(reply.Attachment);
        Assert.Equal(ChatAttachmentType.Order, reply.Attachment!.Type);
    }

    // ===== CouponSkill (Property 8: chỉ mã còn hiệu lực) =====

    [Fact]
    public async Task Coupon_ListsOnlyActive()
    {
        using var db = new TestDb();
        var now = DateTime.UtcNow;
        db.Context.Coupons.AddRange(
            new Coupon { Code = "ACTIVE10", Type = "percent", Value = 10, IsActive = true, StartDate = now.AddDays(-1), EndDate = now.AddDays(5), UsageLimit = 100, UsedCount = 0 },
            new Coupon { Code = "EXPIRED", Type = "percent", Value = 20, IsActive = true, StartDate = now.AddDays(-10), EndDate = now.AddDays(-1), UsageLimit = 100, UsedCount = 0 },
            new Coupon { Code = "DISABLED", Type = "fixed", Value = 50000, IsActive = false, StartDate = now.AddDays(-1), EndDate = now.AddDays(5), UsageLimit = 100, UsedCount = 0 },
            new Coupon { Code = "USEDUP", Type = "percent", Value = 15, IsActive = true, StartDate = now.AddDays(-1), EndDate = now.AddDays(5), UsageLimit = 5, UsedCount = 5 }
        );
        await db.Context.SaveChangesAsync();

        var skill = new CouponSkill(db.Context);
        var reply = await skill.HandleAsync(Ctx("có mã giảm giá nào không", ChatIdentity.ForGuest("g1")));

        Assert.Contains("ACTIVE10", reply.Text);
        Assert.DoesNotContain("EXPIRED", reply.Text);
        Assert.DoesNotContain("DISABLED", reply.Text);
        Assert.DoesNotContain("USEDUP", reply.Text);
    }

    [Fact]
    public async Task Coupon_NoneActive_InformsEmpty()
    {
        using var db = new TestDb();
        var skill = new CouponSkill(db.Context);

        var reply = await skill.HandleAsync(Ctx("mã giảm giá", ChatIdentity.ForGuest("g1")));

        Assert.Contains("chưa có", reply.Text.ToLowerInvariant());
    }

    // ===== StockCheckSkill =====

    [Fact]
    public async Task StockCheck_ListsAvailableVariants()
    {
        using var db = new TestDb();
        db.Context.Products.Add(new Product { Id = 1, Name = "Áo Thun Basic", Category = "Ao", Gender = "Nam", Price = 199000, Image = "x.jpg", Description = "d", Sku = "KK-AT-001", Status = "active" });
        db.Context.VariantStocks.AddRange(
            new VariantStock { ProductId = 1, Size = "M", Color = "Đen", Stock = 10, Reserved = 2 },
            new VariantStock { ProductId = 1, Size = "L", Color = "Đen", Stock = 3, Reserved = 3 } // hết khả dụng
        );
        await db.Context.SaveChangesAsync();

        var skill = new StockCheckSkill(db.Context);
        var reply = await skill.HandleAsync(Ctx("còn hàng không", ChatIdentity.ForGuest("g1"), productId: 1));

        Assert.Contains("M", reply.Text);
        Assert.Equal(BotIntent.StockCheck, reply.Intent);
    }

    private static RuleBasedChatBot BuildBot(TestDb db)
    {
        var skills = new IChatSkill[]
        {
            new OrderLookupSkill(db.Context),
            new StockCheckSkill(db.Context),
            new CouponSkill(db.Context),
            new FaqSkill(db.Context),
        };
        return new RuleBasedChatBot(skills, TestConfig.Create());
    }
}
