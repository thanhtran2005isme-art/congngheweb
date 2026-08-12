using API.Auth.Data;
using API.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Auth.Services;

public interface IOtpService
{
    Task<string> GenerateAndSendAsync(string identifier, string channel, string purpose);
    Task<bool> VerifyAsync(string identifier, string purpose, string code);
}

public class OtpService(
    AuthDbContext db,
    IEmailService email,
    ILogger<OtpService> logger) : IOtpService
{
    private const int CodeLength = 6;
    private const int ExpireMinutes = 5;
    private const int MaxAttempts = 5;
    private const int CooldownSeconds = 60;

    public async Task<string> GenerateAndSendAsync(string identifier, string channel, string purpose)
    {
        identifier = identifier.Trim().ToLowerInvariant();

        // Cooldown: không cho resend liên tục
        var lastOtp = await db.OtpCodes
            .Where(o => o.Identifier == identifier && o.Purpose == purpose)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();
        if (lastOtp is not null
            && (DateTime.UtcNow - lastOtp.CreatedAt).TotalSeconds < CooldownSeconds
            && lastOtp.VerifiedAt is null)
        {
            var wait = CooldownSeconds - (int)(DateTime.UtcNow - lastOtp.CreatedAt).TotalSeconds;
            throw new InvalidOperationException($"Vui lòng đợi {wait} giây trước khi gửi lại OTP.");
        }

        var code = Random.Shared.Next(100_000, 999_999).ToString();
        db.OtpCodes.Add(new OtpCode
        {
            Identifier = identifier,
            Channel = channel,
            Purpose = purpose,
            Code = code,
            ExpiresAt = DateTime.UtcNow.AddMinutes(ExpireMinutes),
        });
        await db.SaveChangesAsync();

        var subject = purpose switch
        {
            "register" => "[KaitoKid] Mã xác thực đăng ký tài khoản",
            "reset_password" => "[KaitoKid] Mã đặt lại mật khẩu",
            _ => "[KaitoKid] Mã xác thực"
        };

        var html = $@"
            <div style='font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden'>
                <div style='background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;padding:24px;text-align:center'>
                    <h2 style='margin:0;font-size:22px'>KaitoKid Shop</h2>
                </div>
                <div style='padding:28px'>
                    <p>Xin chào,</p>
                    <p>Đây là mã xác thực OTP của bạn:</p>
                    <div style='font-size:38px;font-weight:700;letter-spacing:8px;color:#ec4899;text-align:center;padding:18px;background:#fdf2f8;border-radius:10px;margin:20px 0'>
                        {code}
                    </div>
                    <p style='color:#64748b;font-size:13px'>Mã có hiệu lực trong <strong>{ExpireMinutes} phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
                    <p style='color:#94a3b8;font-size:12px;margin-top:24px'>Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
                </div>
            </div>";

        if (channel == "email")
            await email.SendAsync(identifier, subject, html);
        else
            logger.LogInformation("[OTP-SMS-MOCK] {Phone} → code {Code}", identifier, code);

        return code;
    }

    public async Task<bool> VerifyAsync(string identifier, string purpose, string code)
    {
        identifier = identifier.Trim().ToLowerInvariant();
        var otp = await db.OtpCodes
            .Where(o => o.Identifier == identifier && o.Purpose == purpose && o.VerifiedAt == null)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (otp is null) return false;
        if (otp.ExpiresAt < DateTime.UtcNow) return false;
        if (otp.AttemptCount >= MaxAttempts) return false;

        otp.AttemptCount++;
        if (otp.Code != code)
        {
            await db.SaveChangesAsync();
            return false;
        }

        otp.VerifiedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }
}
