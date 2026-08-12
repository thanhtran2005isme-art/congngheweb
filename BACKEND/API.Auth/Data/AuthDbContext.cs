using API.Auth.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Auth.Data;

public class AuthDbContext(DbContextOptions<AuthDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<EmailVerificationToken> EmailVerificationTokens => Set<EmailVerificationToken>();
    public DbSet<LoginActivity> LoginActivities => Set<LoginActivity>();
    public DbSet<NhanVien> NhanVien => Set<NhanVien>();
    public DbSet<VaiTro> VaiTro => Set<VaiTro>();
    public DbSet<QuyenHan> QuyenHan => Set<QuyenHan>();
    public DbSet<VaiTro_QuyenHan> VaiTroQuyenHan => Set<VaiTro_QuyenHan>();
    public DbSet<LichSuDangNhapNV> LichSuDangNhapNV => Set<LichSuDangNhapNV>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<NhanVien>(e =>
        {
            e.HasIndex(n => n.Email).IsUnique();
            e.HasOne(n => n.VaiTro).WithMany().HasForeignKey(n => n.VaiTroId);
        });

        modelBuilder.Entity<VaiTro>(e =>
        {
            e.HasIndex(v => v.MaVaiTro).IsUnique();
        });

        modelBuilder.Entity<QuyenHan>(e =>
        {
            e.HasIndex(q => q.MaQuyen).IsUnique();
        });

        modelBuilder.Entity<VaiTro_QuyenHan>(e =>
        {
            e.HasIndex(v => new { v.VaiTroId, v.QuyenHanId }).IsUnique();
            e.HasOne(v => v.VaiTro).WithMany(r => r.Quyens).HasForeignKey(v => v.VaiTroId);
            e.HasOne(v => v.QuyenHan).WithMany().HasForeignKey(v => v.QuyenHanId);
        });
    }
}
// v1.2: Them NhanVien, VaiTro, QuyenHan, VaiTro_QuyenHan, LichSuDangNhapNV
