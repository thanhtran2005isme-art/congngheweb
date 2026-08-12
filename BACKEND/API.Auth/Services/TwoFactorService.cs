using System.Security.Cryptography;
using API.Auth.Data;
using OtpNet;

namespace API.Auth.Services;

public interface ITwoFactorService
{
    /// <summary>Tạo secret + URI TOTP để client render QR code.</summary>
    (string Secret, string OtpAuthUri) GenerateSetup(string email);
    bool VerifyCode(string secret, string code);
    string GenerateBackupCodesJson();
}

public class TwoFactorService : ITwoFactorService
{
    private const string Issuer = "KaitoKidShop";

    public (string Secret, string OtpAuthUri) GenerateSetup(string email)
    {
        var secretBytes = new byte[20];
        RandomNumberGenerator.Fill(secretBytes);
        var secret = Base32Encoding.ToString(secretBytes);
        // otpauth URL chuẩn — Google Authenticator, Authy, Microsoft Authenticator đều support
        var uri = $"otpauth://totp/{Uri.EscapeDataString(Issuer)}:{Uri.EscapeDataString(email)}?secret={secret}&issuer={Uri.EscapeDataString(Issuer)}&algorithm=SHA1&digits=6&period=30";
        return (secret, uri);
    }

    public bool VerifyCode(string secret, string code)
    {
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(code)) return false;
        try
        {
            var bytes = Base32Encoding.ToBytes(secret);
            var totp = new Totp(bytes, step: 30, mode: OtpHashMode.Sha1, totpSize: 6);
            // Cho phép drift ±1 step (30s trước/sau) để đỡ vênh giờ
            return totp.VerifyTotp(code, out _, new VerificationWindow(previous: 1, future: 1));
        }
        catch { return false; }
    }

    public string GenerateBackupCodesJson()
    {
        var codes = new string[8];
        for (int i = 0; i < codes.Length; i++)
        {
            var b = new byte[5];
            RandomNumberGenerator.Fill(b);
            codes[i] = Convert.ToHexString(b).ToLowerInvariant();
        }
        return System.Text.Json.JsonSerializer.Serialize(codes);
    }
}
