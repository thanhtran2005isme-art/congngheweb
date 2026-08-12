using API.Customer.Data;
using API.Customer.Services.Bot;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace API.Customer.Tests;

/// <summary>Tạo CustomerDbContext trên SQLite in-memory (relational → hỗ trợ ExecuteUpdate).</summary>
public sealed class TestDb : IDisposable
{
    private readonly SqliteConnection _conn;
    public CustomerDbContext Context { get; }

    public TestDb()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        var options = new DbContextOptionsBuilder<CustomerDbContext>()
            .UseSqlite(_conn)
            .Options;
        Context = new CustomerDbContext(options);
        Context.Database.EnsureCreated();
    }

    public CustomerDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<CustomerDbContext>()
            .UseSqlite(_conn)
            .Options;
        return new CustomerDbContext(options);
    }

    public void Dispose()
    {
        Context.Dispose();
        _conn.Dispose();
    }
}

/// <summary>Config in-memory cho ChatService.</summary>
public static class TestConfig
{
    public static IConfiguration Create(Dictionary<string, string?>? values = null)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(values ?? new Dictionary<string, string?>
            {
                ["Chat:RateLimitPerWindow"] = "100",
                ["Chat:RateLimitWindowSeconds"] = "10",
                ["Chat:MaxBotFailBeforeHandoff"] = "2",
            })
            .Build();
    }
}

/// <summary>Bot giả: trả lời cố định, có thể bật cờ handoff để test escalation.</summary>
public sealed class FakeBot(bool handoff = false) : IChatBot
{
    public Task<BotReply> RespondAsync(BotContext context)
    {
        return Task.FromResult(handoff
            ? BotReply.HandoffReply("handoff")
            : BotReply.Simple("bot reply", API.Customer.DTOs.BotIntent.Faq));
    }
}
