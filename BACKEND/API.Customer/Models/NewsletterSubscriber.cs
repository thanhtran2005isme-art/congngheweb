using System.ComponentModel.DataAnnotations.Schema;

namespace API.Customer.Models;

[Table("DangKyNewsletter")]
public class NewsletterSubscriber
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Source { get; set; }
    public string? VoucherCode { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }
    public DateTime SubscribedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UnsubscribedAt { get; set; }
}
