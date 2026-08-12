using System.Data;
using Microsoft.Data.SqlClient;
using System.Text;

var conn = new SqlConnection("Server=localhost;Database=KaitoKid;Trusted_Connection=True;TrustServerCertificate=True");
conn.Open();

// Decode mojibake: text được UTF-8 read as Windows-1252 thì sửa được bằng cách
// encode-back as 1252 → decode as UTF-8
static string FixMojibake(string s)
{
    try
    {
        // Đăng ký codepage 1252
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var bytes = Encoding.GetEncoding(1252).GetBytes(s);
        var fixed1 = Encoding.UTF8.GetString(bytes);
        // Nếu kết quả vẫn còn mojibake (Â, Ã+) thì decode tiếp lần 2
        if (fixed1.Contains("Â") || fixed1.Contains("Ã"))
        {
            bytes = Encoding.GetEncoding(1252).GetBytes(fixed1);
            fixed1 = Encoding.UTF8.GetString(bytes);
        }
        return fixed1;
    }
    catch { return s; }
}

// Lấy tất cả các cột text có thể bị mojibake
var tables = new[]
{
    ("SanPham", new[] { "TenSanPham", "MoTaNgan", "MoTaChiTiet", "DanhMuc", "DanhMucPhu", "PhongCach", "MetaTitle", "MetaDescription" }),
    ("DanhMuc", new[] { "TenDanhMuc", "MoTa" }),
    ("BoSuuTap", new[] { "TenBoSuuTap", "MoTa" }),
};

int totalFixed = 0;
foreach (var (table, cols) in tables)
{
    Console.WriteLine($"=== {table} ===");
    foreach (var col in cols)
    {
        // Tìm rows có dấu hiệu mojibake (Ã hoặc Â theo sau)
        var sql = $"SELECT Id, [{col}] FROM [{table}] WHERE [{col}] LIKE N'%Ã%' OR [{col}] LIKE N'%Â%'";
        var rows = new List<(int Id, string Old, string New)>();
        using (var cmd = new SqlCommand(sql, conn))
        using (var rd = cmd.ExecuteReader())
        {
            while (rd.Read())
            {
                var id = rd.GetInt32(0);
                if (rd.IsDBNull(1)) continue;
                var oldVal = rd.GetString(1);
                var newVal = FixMojibake(oldVal);
                if (newVal != oldVal) rows.Add((id, oldVal, newVal));
            }
        }

        foreach (var r in rows)
        {
            using var up = new SqlCommand($"UPDATE [{table}] SET [{col}] = @v WHERE Id = @id", conn);
            up.Parameters.AddWithValue("@v", r.New);
            up.Parameters.AddWithValue("@id", r.Id);
            up.ExecuteNonQuery();
            totalFixed++;
            Console.WriteLine($"  {col}#{r.Id}: '{r.Old.Substring(0, Math.Min(40, r.Old.Length))}...' -> '{r.New.Substring(0, Math.Min(40, r.New.Length))}...'");
        }
    }
}

Console.WriteLine($"\nFixed {totalFixed} fields total.");
