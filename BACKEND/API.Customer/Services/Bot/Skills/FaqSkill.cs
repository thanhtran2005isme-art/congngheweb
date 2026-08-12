using API.Customer.Data;
using API.Customer.DTOs;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services.Bot.Skills;

/// <summary>
/// Skill trả lời chính sách & FAQ (đổi trả, vận chuyển, thanh toán...).
/// Ưu tiên đọc nội dung cấu hình từ CauHinhCuaHang; nếu không có thì dùng câu trả lời mặc định.
/// Không khớp chủ đề nào → đề nghị gặp nhân viên (Req 5.3).
/// </summary>
public class FaqSkill(CustomerDbContext db) : IChatSkill
{
    public BotIntent Intent => BotIntent.Faq;

    // Mỗi chủ đề: từ khóa nhận diện + mã cấu hình tương ứng trong CauHinhCuaHang + câu trả lời mặc định + link
    private static readonly FaqTopic[] Topics =
    [
        new(
            ["đổi trả", "doi tra", "trả hàng", "tra hang", "hoàn tiền", "hoan tien", "đổi hàng", "doi hang", "bảo hành", "bao hanh"],
            "policy.return",
            "Chính sách đổi trả: bạn được đổi/trả trong vòng 7 ngày kể từ khi nhận hàng, sản phẩm còn nguyên tem mác và chưa qua sử dụng.",
            "/pages/chinh-sach-doi-tra"),
        new(
            ["phí ship", "phi ship", "vận chuyển", "van chuyen", "giao hàng", "giao hang", "phí giao", "ship bao nhiêu", "bao lâu", "bao lau", "freeship"],
            "policy.shipping",
            "Phí vận chuyển được tính theo địa chỉ nhận hàng (thường 20.000–35.000đ). Thời gian giao 2–5 ngày tùy khu vực. Nhiều đơn được miễn phí ship theo chương trình.",
            "/pages/chinh-sach-van-chuyen"),
        new(
            ["thanh toán", "thanh toan", "trả tiền", "tra tien", "cod", "chuyển khoản", "chuyen khoan", "atm", "momo", "phương thức"],
            "policy.payment",
            "Cửa hàng hỗ trợ thanh toán: COD (nhận hàng trả tiền), chuyển khoản ngân hàng, và thẻ ATM nội địa.",
            "/pages/huong-dan-thanh-toan"),
        new(
            ["bảo mật", "bao mat", "thông tin cá nhân", "thong tin ca nhan", "privacy"],
            "policy.privacy",
            "Thông tin cá nhân của bạn được bảo mật và chỉ dùng để xử lý đơn hàng, không chia sẻ cho bên thứ ba.",
            "/pages/chinh-sach-bao-mat"),
    ];

    public bool CanHandle(string text, BotContext context)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var lower = text.ToLowerInvariant();
        return Topics.Any(t => t.Keywords.Any(lower.Contains));
    }

    public async Task<BotReply> HandleAsync(BotContext context)
    {
        var lower = context.UserText.ToLowerInvariant();
        var topic = Topics.FirstOrDefault(t => t.Keywords.Any(lower.Contains));

        if (topic is null)
        {
            // Không khớp chủ đề → đề nghị gặp nhân viên
            return BotReply.HandoffReply(
                "Câu hỏi của bạn cần nhân viên hỗ trợ thêm. Bạn chờ chút để mình kết nối nhé, hoặc bấm \"Gặp nhân viên\".");
        }

        // Ưu tiên nội dung cấu hình động trong CauHinhCuaHang
        var setting = await db.StoreSettings.FirstOrDefaultAsync(s => s.Code == topic.SettingCode);
        var answer = !string.IsNullOrWhiteSpace(setting?.Value) ? setting!.Value : topic.DefaultAnswer;

        // Kèm link trang nội dung nếu có (Req 5.2)
        if (!string.IsNullOrWhiteSpace(topic.Link))
        {
            answer += $"\nXem chi tiết: {topic.Link}";
        }

        return BotReply.Simple(answer, Intent);
    }

    private sealed record FaqTopic(string[] Keywords, string SettingCode, string DefaultAnswer, string? Link);
}
