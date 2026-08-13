using API.Admin.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Admin.Data;

public class AdminDbContext(DbContextOptions<AdminDbContext> options) : DbContext(options)
{
    public DbSet<SanPham> SanPham => Set<SanPham>();
    public DbSet<DanhMuc> DanhMuc => Set<DanhMuc>();
    public DbSet<DonHang> DonHang => Set<DonHang>();
    public DbSet<ChiTietDonHang> ChiTietDonHang => Set<ChiTietDonHang>();
    public DbSet<NguoiDung> NguoiDung => Set<NguoiDung>();
    public DbSet<BoSuuTap> BoSuuTap => Set<BoSuuTap>();
    public DbSet<MaGiamGia> MaGiamGia => Set<MaGiamGia>();
    public DbSet<DanhGia> DanhGia => Set<DanhGia>();
    public DbSet<Banner> Banner => Set<Banner>();
    public DbSet<Lookbook> Lookbook => Set<Lookbook>();
    public DbSet<FlashSale> FlashSale => Set<FlashSale>();
    public DbSet<ChiTietFlashSale> ChiTietFlashSale => Set<ChiTietFlashSale>();
    public DbSet<KhuyenMai> KhuyenMai => Set<KhuyenMai>();
    public DbSet<TrangTinh> TrangTinh => Set<TrangTinh>();
    public DbSet<MenuDieuHuong> MenuDieuHuong => Set<MenuDieuHuong>();
    public DbSet<ThuocTinhSanPham> ThuocTinhSanPham => Set<ThuocTinhSanPham>();
    public DbSet<TonKhoLichSu> TonKhoLichSu => Set<TonKhoLichSu>();
    public DbSet<CauHinhCuaHang> CauHinhCuaHang => Set<CauHinhCuaHang>();
    public DbSet<CauHinhTrangChu> CauHinhTrangChu => Set<CauHinhTrangChu>();
    public DbSet<NhatKyHoatDong> NhatKyHoatDong => Set<NhatKyHoatDong>();
    public DbSet<NhaCungCap> NhaCungCap => Set<NhaCungCap>();
    public DbSet<PhieuNhap> PhieuNhap => Set<PhieuNhap>();
    public DbSet<ChiTietPhieuNhap> ChiTietPhieuNhap => Set<ChiTietPhieuNhap>();
    public DbSet<TonKhoBienThe> TonKhoBienThe => Set<TonKhoBienThe>();
    public DbSet<HomepageBlock> HomepageBlock => Set<HomepageBlock>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.Entity<DonHang>().HasMany(d => d.ChiTiet).WithOne().HasForeignKey(c => c.DonHangId);
        m.Entity<DonHang>().HasOne(d => d.NguoiDung).WithMany().HasForeignKey(d => d.NguoiDungId);
        m.Entity<FlashSale>().HasMany(f => f.ChiTiet).WithOne().HasForeignKey(c => c.FlashSaleId);
        m.Entity<CauHinhCuaHang>().HasIndex(c => c.MaCauHinh).IsUnique();
    }
}
