using System.Net;
using System.Net.Mail;

namespace API.Customer.Services.Email;

/// <summary>
/// SMTP implementation. Đọc config từ section "Email":
///   "Email": {
///     "Enabled": "true",
///     "Host": "smtp.gmail.com",
///     "Port": "587",
///     "EnableSsl": "true",
///     "Username": "...",
///     "Password": "...",
///     "FromAddress": "noreply@kaitokid.vn",
///     "FromName": "KaitoKid"
///   }
/// Nếu Enabled=false hoặc Host trống → ghi log, không throw để không chặn flow đặt đơn.
/// </summary>
public class SmtpEmailService(ILogger<SmtpEmailService> logger, IConfiguration config) : IEmailService
{
    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        var enabled = string.Equals(config["Email:Enabled"], "true", StringComparison.OrdinalIgnoreCase);
        var host = config["Email:Host"];
        var fromAddress = config["Email:FromAddress"];

        if (!enabled || string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress))
        {
            logger.LogInformation("Email skipped (not configured). To={To} Subject={Subject}", toEmail, subject);
            return;
        }

        if (string.IsNullOrWhiteSpace(toEmail))
        {
            logger.LogInformation("Email skipped: empty recipient. Subject={Subject}", subject);
            return;
        }

        try
        {
            var port = int.TryParse(config["Email:Port"], out var p) ? p : 587;
            var enableSsl = !string.Equals(config["Email:EnableSsl"], "false", StringComparison.OrdinalIgnoreCase);
            var fromName = config["Email:FromName"] ?? "KaitoKid";

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl,
                Credentials = new NetworkCredential(
                    config["Email:Username"],
                    config["Email:Password"]),
                Timeout = 15_000,
            };

            using var message = new MailMessage
            {
                From = new MailAddress(fromAddress, fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
            };
            message.To.Add(toEmail);

            await client.SendMailAsync(message, ct);
            logger.LogInformation("Email sent to {To} subject={Subject}", toEmail, subject);
        }
        catch (Exception ex)
        {
            // Không throw — đặt đơn vẫn thành công dù email fail
            logger.LogWarning(ex, "Failed to send email to {To}", toEmail);
        }
    }
}
