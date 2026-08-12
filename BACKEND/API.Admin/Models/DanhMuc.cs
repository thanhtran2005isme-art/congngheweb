using System.ComponentModel.DataAnnotations.Schema;

namespace API.Admin.Models;

[Table("DanhMuc")]
public class DanhMuc
{
    public int Id { get; set; }
    public string TenDanhMuc { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public string? MoTa { get; set; }
    public string? HinhAnh { get; set; }
    public int? DanhMucChaId { get; set; }
    public int ThuTu { get; set; }
    public bool TrangThai { get; set; } = true;
    /// <summary>all | nu | nam | treem</summary>
    public string GioiTinh { get; set; } = "all";
    public DateTime NgayTao { get; set; } = DateTime.UtcNow;
}
