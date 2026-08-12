namespace API.Customer.Services.Email;

/// <summary>
/// Service gửi email cho khách. Triển khai mặc định là <see cref="SmtpEmailService"/>
/// đọc cấu hình từ section "Email" trong appsettings; nếu không có cấu hình thì chỉ log.
/// </summary>
public interface IEmailService
{
    Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default);
}

public class EmailMessageBuilder
{
    /// <summary>Build template HTML xác nhận đơn hàng.</summary>
    public static string OrderConfirmation(
        string customerName,
        string orderCode,
        decimal total,
        string paymentMethod,
        string trackingUrl)
    {
        var paymentLabel = string.Equals(paymentMethod, "COD", StringComparison.OrdinalIgnoreCase)
            ? "Thanh toán khi nhận hàng"
            : "Chuyển khoản ngân hàng";

        return $$"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
          <div style="background:linear-gradient(135deg,#ec4899,#be185d);color:#fff;padding:24px;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:20px">Cảm ơn {{customerName}}!</h1>
            <p style="margin:6px 0 0;opacity:.9;font-size:14px">Đơn hàng của bạn đã được ghi nhận tại KaitoKid.</p>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <table style="width:100%;font-size:14px;line-height:1.6">
              <tr><td style="color:#64748b">Mã đơn:</td><td style="text-align:right"><strong>{{orderCode}}</strong></td></tr>
              <tr><td style="color:#64748b">Tổng tiền:</td><td style="text-align:right;color:#dc2626"><strong>{{total:N0}}đ</strong></td></tr>
              <tr><td style="color:#64748b">Phương thức:</td><td style="text-align:right">{{paymentLabel}}</td></tr>
            </table>
            <div style="margin-top:24px;text-align:center">
              <a href="{{trackingUrl}}" style="display:inline-block;padding:10px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                Theo dõi đơn hàng
              </a>
            </div>
            <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">
              Email tự động từ KaitoKid - không cần phản hồi.
            </p>
          </div>
        </div>
        """;
    }

    public static string PaymentReceived(string customerName, string orderCode, decimal total)
    {
        return $$"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#16a34a;color:#fff;padding:24px;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:20px">Đã nhận thanh toán</h1>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;color:#0f172a;font-size:14px">
            <p>Xin chào {{customerName}},</p>
            <p>Shop đã nhận được khoản thanh toán <strong>{{total:N0}}đ</strong> cho đơn <strong>{{orderCode}}</strong>.</p>
            <p>Đơn hàng đang được chuẩn bị và sẽ sớm được giao đến bạn.</p>
          </div>
        </div>
        """;
    }

    public static string ShippingUpdate(string customerName, string orderCode, string statusVi, string trackingUrl)
    {
        return $$"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#0f172a;color:#fff;padding:24px;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:20px">Cập nhật vận chuyển</h1>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;color:#0f172a;font-size:14px">
            <p>Đơn <strong>{{orderCode}}</strong> hiện ở trạng thái: <strong>{{statusVi}}</strong>.</p>
            <p>Bạn có thể theo dõi chi tiết tại <a href="{{trackingUrl}}">đây</a>.</p>
          </div>
        </div>
        """;
    }
}
