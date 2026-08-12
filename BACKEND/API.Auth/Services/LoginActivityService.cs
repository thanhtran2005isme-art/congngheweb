using API.Auth.Data;
using API.Auth.Models;
using Microsoft.AspNetCore.Http;

namespace API.Auth.Services;

public interface ILoginActivityService
{
    Task LogAsync(int? userId, string email, string provider, bool success, string? failReason = null);
    Task<List<LoginActivity>> GetByUserAsync(int userId, int take = 50);
}

public class LoginActivityService(
    AuthDbContext db,
    IHttpContextAccessor http) : ILoginActivityService
{
    public async Task LogAsync(int? userId, string email, string provider, bool success, string? failReason = null)
    {
        var ctx = http.HttpContext;
        var ip = ctx?.Connection?.RemoteIpAddress?.ToString();
        var ua = ctx?.Request?.Headers["User-Agent"].ToString();
        var (browser, os, device) = ParseUserAgent(ua);

        db.LoginActivities.Add(new LoginActivity
        {
            UserId = userId,
            Email = email,
            Provider = provider,
            Ip = ip,
            UserAgent = ua,
            Browser = browser,
            Os = os,
            DeviceType = device,
            Success = success,
            FailReason = failReason,
        });
        try { await db.SaveChangesAsync(); }
        catch { /* không block flow login */ }
    }

    public async Task<List<LoginActivity>> GetByUserAsync(int userId, int take = 50)
    {
        return await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(
            db.LoginActivities
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .Take(take)
        );
    }

    /// <summary>Parse user-agent string đơn giản — đủ cho mục đích log activity.</summary>
    private static (string browser, string os, string device) ParseUserAgent(string? ua)
    {
        if (string.IsNullOrWhiteSpace(ua)) return ("unknown", "unknown", "unknown");

        var u = ua.ToLowerInvariant();

        var browser = u.Contains("edg/") ? "Edge"
                    : u.Contains("opr/") || u.Contains("opera") ? "Opera"
                    : u.Contains("chrome") ? "Chrome"
                    : u.Contains("firefox") ? "Firefox"
                    : u.Contains("safari") ? "Safari"
                    : "Other";

        var os = u.Contains("windows nt 10") ? "Windows 10/11"
              : u.Contains("windows") ? "Windows"
              : u.Contains("mac os x") ? "macOS"
              : u.Contains("android") ? "Android"
              : u.Contains("iphone") || u.Contains("ipad") ? "iOS"
              : u.Contains("linux") ? "Linux"
              : "Unknown";

        var device = u.Contains("mobile") || u.Contains("iphone") || u.Contains("android") ? "Mobile"
                  : u.Contains("ipad") || u.Contains("tablet") ? "Tablet"
                  : "Desktop";

        return (browser, os, device);
    }
}
