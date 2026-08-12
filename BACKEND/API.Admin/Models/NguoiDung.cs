using System.ComponentModel.DataAnnotations.Schema;

namespace API.Admin.Models;

[Table("NguoiDung")]
public class NguoiDung
{
    public int Id { get; set; }
    public string HoTen { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string MatKhauHash { get; set; } = string.Empty;
    public string? SoDienThoai { get; set; }
    public string? AnhDaiDien { get; set; }
    public string VaiTro { get; set; } = "user";
    public bool TrangThai { get; set; } = true;
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
    public DateTime? NgayCapNhat { get; set; }
}
