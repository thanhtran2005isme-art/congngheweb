namespace API.Auth.Services;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string htmlBody);
}

/// <summary>
/// Mock email service: in ra console + lưu vào file để dev xem mà không cần đăng ký SMTP.
/// Production: swap sang BrevoEmailService trong Program.cs.
/// </summary>
public class ConsoleEmailService(ILogger<ConsoleEmailService> logger) : IEmailService
{
    public Task SendAsync(string to, string subject, string htmlBody)
    {
        logger.LogInformation("====== EMAIL (mock) ======");
        logger.LogInformation(" To     : {To}", to);
        logger.LogInformation(" Subject: {Subject}", subject);
        logger.LogInformation(" Body   :\n{Body}", htmlBody);
        logger.LogInformation("==========================");
        return Task.CompletedTask;
    }
}

/// <summary>
/// Brevo (Sendinblue) email — free 300 mail/ngày.
/// Cấu hình: Email:Brevo:ApiKey + Email:Brevo:SenderEmail + Email:Brevo:SenderName
/// </summary>
public class BrevoEmailService(HttpClient http, IConfiguration config, ILogger<BrevoEmailService> logger) : IEmailService
{
    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        var apiKey = config["Email:Brevo:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogWarning("Brevo ApiKey trống — bỏ qua gửi mail tới {To}.", to);
            return;
        }

        var senderEmail = config["Email:Brevo:SenderEmail"] ?? "noreply@kaitokid.local";
        var senderName = config["Email:Brevo:SenderName"] ?? "KaitoKid Shop";

        var msg = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        msg.Headers.Add("api-key", apiKey);
        msg.Headers.Add("accept", "application/json");
        msg.Content = JsonContent.Create(new
        {
            sender = new { email = senderEmail, name = senderName },
            to = new[] { new { email = to } },
            subject,
            htmlContent = htmlBody,
        });

        try
        {
            var res = await http.SendAsync(msg);
            if (!res.IsSuccessStatusCode)
            {
                var body = await res.Content.ReadAsStringAsync();
                logger.LogWarning("Brevo gửi thất bại {Status}: {Body}", (int)res.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Brevo exception khi gửi tới {To}", to);
        }
    }
}
