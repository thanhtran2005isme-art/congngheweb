using System.Text.RegularExpressions;

namespace API.Admin.DTOs;

public class UpsertCouponRequest
{
    public string MaCoupon { get; set; } = string.Empty;
    public string LoaiGiamGia { get; set; } = "percent";
    public decimal GiaTri { get; set; }
    public decimal? DonToiThieu { get; set; }
    public decimal? GiamToiDa { get; set; }
    /// <summary>0 = không giới hạn.</summary>
    public int SoLuotDung { get; set; }
    public DateTime NgayBatDau { get; set; }
    public DateTime NgayKetThuc { get; set; }
    public bool TrangThai { get; set; } = true;
    public string? MoTa { get; set; }
}

public static partial class CouponAdminRules
{
    [GeneratedRegex("^[A-Z0-9][A-Z0-9_-]{2,39}$", RegexOptions.CultureInvariant)]
    private static partial Regex CodePattern();

    public static string NormalizeCode(string? value) =>
        (value ?? string.Empty).Trim().ToUpperInvariant();

    public static string NormalizeType(string? value) =>
        (value ?? string.Empty).Trim().ToLowerInvariant();

    public static string? NormalizeDescription(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static DateTime NormalizeStartDate(DateTime value) => value.Date;

    public static DateTime NormalizeEndDate(DateTime value) =>
        value.Date.AddDays(1).AddTicks(-1);

    public static string? Validate(UpsertCouponRequest dto, string code, string type, int usedCount)
    {
        if (!CodePattern().IsMatch(code))
            return "Mã coupon phải dài 3–40 ký tự và chỉ gồm A-Z, 0-9, dấu gạch ngang hoặc gạch dưới.";
        if (type is not ("percent" or "fixed"))
            return "Loại giảm giá không hợp lệ.";
        if (dto.GiaTri <= 0)
            return "Giá trị giảm phải lớn hơn 0.";
        if (type == "percent" && dto.GiaTri > 100)
            return "Giảm theo phần trăm không được vượt quá 100%.";
        if (dto.DonToiThieu is < 0)
            return "Đơn tối thiểu không được âm.";
        if (dto.GiamToiDa is < 0)
            return "Trần giảm tối đa không được âm.";
        if (dto.SoLuotDung < 0)
            return "Tổng lượt sử dụng không được âm. Dùng 0 nếu muốn không giới hạn.";
        if (dto.SoLuotDung > 0 && dto.SoLuotDung < usedCount)
            return $"Tổng lượt sử dụng không thể thấp hơn {usedCount} lượt đã phát sinh.";
        if (dto.NgayBatDau == default || dto.NgayKetThuc == default)
            return "Cần chọn ngày bắt đầu và ngày kết thúc.";
        if (dto.NgayKetThuc.Date < dto.NgayBatDau.Date)
            return "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.";
        if (!string.IsNullOrWhiteSpace(dto.MoTa) && dto.MoTa.Trim().Length > 300)
            return "Mô tả tối đa 300 ký tự.";
        return null;
    }
}
