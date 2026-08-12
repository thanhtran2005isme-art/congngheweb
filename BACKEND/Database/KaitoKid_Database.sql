-- ================================================================
-- CƠ SỞ DỮ LIỆU: KaitoKid
-- Hệ thống shop bán quần áo thời trang online
-- Tác giả: KaitoKid Team
-- Ngày tạo: 26/03/2026
-- ================================================================

-- Tạo database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'KaitoKid')
BEGIN
    CREATE DATABASE KaitoKid;
END
GO

USE KaitoKid;
GO

-- ================================================================
-- 1. BẢNG: NguoiDung
-- Tài khoản đăng nhập (khách hàng + admin)
-- ================================================================
CREATE TABLE NguoiDung (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    HoTen           NVARCHAR(100)       NOT NULL,               -- Họ tên: Nguyễn Văn A
    Email           NVARCHAR(200)       NOT NULL,               -- Email đăng nhập
    MatKhauHash     NVARCHAR(500)       NOT NULL,               -- Mật khẩu mã hóa BCrypt
    SoDienThoai     NVARCHAR(20)        NULL,                   -- SĐT: 0901234567
    AnhDaiDien      NVARCHAR(500)       NULL,                   -- URL ảnh avatar
    VaiTro          NVARCHAR(20)        NOT NULL DEFAULT 'user', -- user / admin
    RefreshToken    NVARCHAR(500)       NULL,                   -- Token làm mới phiên đăng nhập
    HanRefreshToken DATETIME2           NULL,                   -- Hạn sử dụng refresh token
    TrangThai       BIT                 NOT NULL DEFAULT 1,     -- 1=Hoạt động, 0=Khóa
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
    NgayCapNhat     DATETIME2           NULL,

    CONSTRAINT UQ_NguoiDung_Email UNIQUE (Email)
);
GO

CREATE NONCLUSTERED INDEX IX_NguoiDung_Email ON NguoiDung(Email);
CREATE NONCLUSTERED INDEX IX_NguoiDung_VaiTro ON NguoiDung(VaiTro);
GO

-- ================================================================
-- 2. BẢNG: DanhMuc
-- Danh mục sản phẩm: Áo, Quần, Váy, Đầm, Phụ kiện...
-- Hỗ trợ danh mục cha-con (cây phân cấp)
-- ================================================================
CREATE TABLE DanhMuc (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenDanhMuc      NVARCHAR(100)       NOT NULL,               -- Áo, Quần, Váy, Đầm
    Slug            NVARCHAR(150)       NULL,                   -- ao, quan, vay, dam
    MoTa            NVARCHAR(500)       NULL,                   -- Mô tả ngắn
    HinhAnh         NVARCHAR(500)       NULL,                   -- Ảnh đại diện
    DanhMucChaId    INT                 NULL,                   -- NULL = danh mục gốc
    ThuTu           INT                 NOT NULL DEFAULT 0,     -- Thứ tự sắp xếp
    TrangThai       BIT                 NOT NULL DEFAULT 1,     -- 1=Hiện, 0=Ẩn
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_DanhMuc_Cha FOREIGN KEY (DanhMucChaId) REFERENCES DanhMuc(Id)
);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_DanhMuc_Slug ON DanhMuc(Slug) WHERE Slug IS NOT NULL;
GO

-- ================================================================
-- 3. BẢNG: SanPham
-- Sản phẩm quần áo thời trang
-- ================================================================
CREATE TABLE SanPham (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenSanPham      NVARCHAR(200)       NOT NULL,               -- Áo Thun Nam Cổ Tròn Basic
    DanhMucId       INT                 NULL,                   -- FK đến DanhMuc
    DanhMuc         NVARCHAR(100)       NOT NULL,               -- Tên danh mục: Ao, Quan, Vay
    DanhMucPhu      NVARCHAR(100)       NULL,                   -- Danh mục phụ: Ao Thun, Ao So Mi
    PhongCach       NVARCHAR(100)       NULL,                   -- Casual, Formal, Sport, Streetwear
    NhomTuoi        NVARCHAR(50)        NULL,                   -- NguoiLon, TreEm
    GioiTinh        NVARCHAR(20)        NOT NULL,               -- Nam, Nu, Unisex
    Gia             DECIMAL(18,0)       NOT NULL,               -- Giá bán (VNĐ): 299000
    GiaCu           DECIMAL(18,0)       NULL,                   -- Giá cũ trước giảm: 450000
    TonKho          INT                 NOT NULL DEFAULT 0,     -- Số lượng trong kho
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'active',
        -- active: Đang bán
        -- out-of-stock: Hết hàng
        -- draft: Nháp (chưa công khai)
    HinhAnh         NVARCHAR(500)       NOT NULL,               -- Ảnh chính sản phẩm
    DanhSachAnh     NVARCHAR(MAX)       NULL,                   -- JSON mảng ảnh phụ
    MoTaNgan        NVARCHAR(500)       NULL,                   -- Mô tả ngắn hiển thị trên card
    MoTaChiTiet     NVARCHAR(MAX)       NOT NULL,               -- Mô tả chi tiết (có thể HTML)
    MaSanPham       NVARCHAR(50)        NOT NULL,               -- SKU: KK-AT-001
    Slug            NVARCHAR(200)       NULL,                   -- ao-thun-nam-co-tron-basic
    Menu            NVARCHAR(100)       NULL,                   -- Thuộc menu nào trên header
    BoSuuTapId      INT                 NULL,                   -- FK đến BoSuuTap
    MetaTitle       NVARCHAR(200)       NULL,                   -- SEO title
    MetaDescription NVARCHAR(500)       NULL,                   -- SEO description
    LaSanPhamMoi    BIT                 NOT NULL DEFAULT 0,     -- Gắn nhãn NEW
    DangGiamGia     BIT                 NOT NULL DEFAULT 0,     -- Gắn nhãn SALE
    BanChayNhat     BIT                 NOT NULL DEFAULT 0,     -- Gắn nhãn BEST SELLER
    DiemDanhGia     FLOAT               NOT NULL DEFAULT 0,     -- Rating trung bình 0-5
    SoLuongDaBan    INT                 NOT NULL DEFAULT 0,     -- Tổng số đã bán
    DanhSachMau     NVARCHAR(MAX)       NULL,                   -- JSON: ["Đen","Trắng","Xanh navy"]
    DanhSachSize    NVARCHAR(MAX)       NULL,                   -- JSON: ["S","M","L","XL","XXL"]
    BienThe         NVARCHAR(MAX)       NULL,                   -- JSON: [{size,color,sku,stock}]
    ThongSoKyThuat  NVARCHAR(MAX)       NULL,                   -- Chất liệu, xuất xứ, hướng dẫn giặt
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
    NgayCapNhat     DATETIME2           NULL,

    CONSTRAINT UQ_SanPham_MaSP UNIQUE (MaSanPham),
    CONSTRAINT FK_SanPham_DanhMuc FOREIGN KEY (DanhMucId) REFERENCES DanhMuc(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_SanPham_TrangThai ON SanPham(TrangThai);
CREATE NONCLUSTERED INDEX IX_SanPham_DanhMuc ON SanPham(DanhMuc);
CREATE NONCLUSTERED INDEX IX_SanPham_GioiTinh ON SanPham(GioiTinh);
CREATE NONCLUSTERED INDEX IX_SanPham_Gia ON SanPham(Gia);
CREATE NONCLUSTERED INDEX IX_SanPham_SoLuongDaBan ON SanPham(SoLuongDaBan DESC);
CREATE UNIQUE NONCLUSTERED INDEX IX_SanPham_Slug ON SanPham(Slug) WHERE Slug IS NOT NULL;
GO

-- ================================================================
-- 4. BẢNG: ThuocTinhSanPham
-- Thuộc tính mở rộng: Chất liệu, Xuất xứ, Kiểu dáng...
-- ================================================================
CREATE TABLE ThuocTinhSanPham (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenThuocTinh    NVARCHAR(100)       NOT NULL,               -- Chất liệu, Xuất xứ, Kiểu cổ
    GiaTri          NVARCHAR(200)       NOT NULL,               -- Cotton 100%, Việt Nam, Cổ tròn
    NhomThuocTinh   NVARCHAR(100)       NULL,                   -- Nhóm: Thông tin chung, Chất liệu
    ThuTu           INT                 NOT NULL DEFAULT 0,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ================================================================
-- 5. BẢNG: BoSuuTap
-- Bộ sưu tập: Spring/Summer 2025, Streetwear Collection...
-- ================================================================
CREATE TABLE BoSuuTap (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenBoSuuTap     NVARCHAR(200)       NOT NULL,               -- Spring/Summer 2025
    Slug            NVARCHAR(200)       NULL,                   -- spring-summer-2025
    MoTa            NVARCHAR(1000)      NULL,                   -- Mô tả bộ sưu tập
    HinhAnh         NVARCHAR(500)       NULL,                   -- Ảnh banner
    TrangThai       BIT                 NOT NULL DEFAULT 1,     -- 1=Hiện, 0=Ẩn
    ThuTu           INT                 NOT NULL DEFAULT 0,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_BoSuuTap_Slug ON BoSuuTap(Slug) WHERE Slug IS NOT NULL;
GO

-- Thêm FK cho SanPham.BoSuuTapId
ALTER TABLE SanPham ADD CONSTRAINT FK_SanPham_BoSuuTap FOREIGN KEY (BoSuuTapId) REFERENCES BoSuuTap(Id);
GO

-- ================================================================
-- 6. BẢNG: GioHang
-- Giỏ hàng - mỗi dòng = 1 sản phẩm với size + màu cụ thể
-- ================================================================
CREATE TABLE GioHang (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,               -- Khách hàng
    SanPhamId       INT                 NOT NULL,               -- Sản phẩm
    KichCo          NVARCHAR(20)        NOT NULL,               -- S, M, L, XL, XXL
    MauSac          NVARCHAR(50)        NOT NULL,               -- Đen, Trắng, Xanh navy
    SoLuong         INT                 NOT NULL DEFAULT 1,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_GioHang_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    CONSTRAINT FK_GioHang_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_GioHang_NguoiDung ON GioHang(NguoiDungId);
GO

-- ================================================================
-- 7. BẢNG: DonHang
-- Đơn hàng của khách
-- ================================================================
CREATE TABLE DonHang (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    MaDonHang       NVARCHAR(30)        NOT NULL,               -- KK-20250326-A1B2C3
    NguoiDungId     INT                 NOT NULL,               -- Khách đặt hàng
    TenNguoiNhan    NVARCHAR(100)       NOT NULL,               -- Tên người nhận hàng
    SoDienThoai     NVARCHAR(20)        NOT NULL,               -- SĐT người nhận
    Email           NVARCHAR(200)       NOT NULL,               -- Email người nhận
    DiaChiGiao      NVARCHAR(500)       NOT NULL,               -- Địa chỉ giao hàng đầy đủ
    TinhThanh       NVARCHAR(100)       NULL,                   -- Tỉnh/Thành phố
    QuanHuyen       NVARCHAR(100)       NULL,                   -- Quận/Huyện
    PhuongXa        NVARCHAR(100)       NULL,                   -- Phường/Xã
    TamTinh         DECIMAL(18,0)       NOT NULL,               -- Tổng tiền hàng trước giảm
    PhiVanChuyen    DECIMAL(18,0)       NOT NULL DEFAULT 0,     -- Phí ship
    PhiThanhToan    DECIMAL(18,0)       NOT NULL DEFAULT 0,     -- Phí thanh toán (nếu có)
    GiamGia         DECIMAL(18,0)       NOT NULL DEFAULT 0,     -- Số tiền được giảm
    TongTien        DECIMAL(18,0)       NOT NULL,               -- Tổng thanh toán cuối cùng
    MaGiamGia       NVARCHAR(50)        NULL,                   -- Mã coupon đã áp dụng
    PhuongThucThanhToan NVARCHAR(30)    NOT NULL DEFAULT 'COD',
        -- COD: Thanh toán khi nhận hàng
        -- VISA: Thẻ quốc tế
        -- ATM: Thẻ nội địa
        -- Momo: Ví Momo
        -- BankTransfer: Chuyển khoản
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'pending',
        -- pending: Chờ xác nhận
        -- confirmed: Đã xác nhận
        -- shipping: Đang giao hàng
        -- completed: Hoàn thành
        -- cancelled: Đã hủy
        -- returned: Đã trả hàng
    GhiChu          NVARCHAR(500)       NULL,                   -- Ghi chú của khách
    GhiChuAdmin     NVARCHAR(500)       NULL,                   -- Ghi chú nội bộ của admin
    NgayXacNhan     DATETIME2           NULL,                   -- Ngày admin xác nhận
    NgayGiaoHang    DATETIME2           NULL,                   -- Ngày bắt đầu giao
    NgayHoanThanh   DATETIME2           NULL,                   -- Ngày hoàn thành
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
    NgayCapNhat     DATETIME2           NULL,

    CONSTRAINT UQ_DonHang_MaDH UNIQUE (MaDonHang),
    CONSTRAINT FK_DonHang_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_DonHang_NguoiDung ON DonHang(NguoiDungId);
CREATE NONCLUSTERED INDEX IX_DonHang_TrangThai ON DonHang(TrangThai);
CREATE NONCLUSTERED INDEX IX_DonHang_NgayTao ON DonHang(NgayTao DESC);
CREATE NONCLUSTERED INDEX IX_DonHang_MaDH ON DonHang(MaDonHang);
GO

-- ================================================================
-- 8. BẢNG: ChiTietDonHang
-- Từng sản phẩm trong đơn hàng (snapshot giá tại thời điểm đặt)
-- ================================================================
CREATE TABLE ChiTietDonHang (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    DonHangId       INT                 NOT NULL,
    SanPhamId       INT                 NOT NULL,
    TenSanPham      NVARCHAR(200)       NOT NULL,               -- Snapshot tên SP lúc đặt
    HinhAnhSP       NVARCHAR(500)       NOT NULL,               -- Snapshot ảnh SP
    DonGia          DECIMAL(18,0)       NOT NULL,               -- Giá tại thời điểm mua
    KichCo          NVARCHAR(20)        NOT NULL,
    MauSac          NVARCHAR(50)        NOT NULL,
    SoLuong         INT                 NOT NULL,

    CONSTRAINT FK_CTDH_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CTDH_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_CTDH_DonHang ON ChiTietDonHang(DonHangId);
GO

-- ================================================================
-- 9. BẢNG: DanhSachYeuThich
-- Sản phẩm yêu thích (wishlist) của khách
-- ================================================================
CREATE TABLE DanhSachYeuThich (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,
    SanPhamId       INT                 NOT NULL,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_YeuThich_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    CONSTRAINT FK_YeuThich_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id),
    CONSTRAINT UQ_YeuThich UNIQUE (NguoiDungId, SanPhamId)
);
GO

-- ================================================================
-- 10. BẢNG: DanhGia
-- Đánh giá sản phẩm từ khách hàng
-- ================================================================
CREATE TABLE DanhGia (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,               -- Đánh giá cho SP nào
    NguoiDungId     INT                 NOT NULL,               -- Ai đánh giá
    TenKhachHang    NVARCHAR(100)       NOT NULL,               -- Tên hiển thị
    DonHangId       INT                 NOT NULL,               -- Đánh giá từ đơn hàng nào
    SoSao           INT                 NOT NULL,               -- 1-5 sao
    NoiDung         NVARCHAR(1000)      NOT NULL,               -- Nội dung đánh giá
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'pending',
        -- pending: Chờ duyệt
        -- approved: Đã duyệt (hiển thị)
        -- rejected: Từ chối
    PhanHoiAdmin    NVARCHAR(500)       NULL,                   -- Admin phản hồi đánh giá
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_DanhGia_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id),
    CONSTRAINT FK_DanhGia_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id),
    CONSTRAINT FK_DanhGia_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id),
    CONSTRAINT CK_DanhGia_SoSao CHECK (SoSao >= 1 AND SoSao <= 5)
);
GO

CREATE NONCLUSTERED INDEX IX_DanhGia_SanPham ON DanhGia(SanPhamId);
CREATE NONCLUSTERED INDEX IX_DanhGia_TrangThai ON DanhGia(TrangThai);
GO

-- ================================================================
-- 11. BẢNG: DiaChi
-- Sổ địa chỉ giao hàng của khách
-- ================================================================
CREATE TABLE DiaChi (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,
    HoTen           NVARCHAR(100)       NOT NULL,               -- Tên người nhận
    SoDienThoai     NVARCHAR(20)        NOT NULL,               -- SĐT người nhận
    TinhThanh       NVARCHAR(100)       NOT NULL,               -- Tỉnh/Thành phố
    QuanHuyen       NVARCHAR(100)       NOT NULL,               -- Quận/Huyện
    PhuongXa        NVARCHAR(100)       NOT NULL,               -- Phường/Xã
    DiaChiCuThe     NVARCHAR(300)       NOT NULL,               -- Số nhà, tên đường
    LaMacDinh       BIT                 NOT NULL DEFAULT 0,     -- 1=Địa chỉ mặc định
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_DiaChi_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_DiaChi_NguoiDung ON DiaChi(NguoiDungId);
GO

-- ================================================================
-- 12. BẢNG: MaGiamGia
-- Coupon / Voucher giảm giá
-- ================================================================
CREATE TABLE MaGiamGia (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    MaCoupon        NVARCHAR(50)        NOT NULL,               -- SALE10, FREESHIP, WELCOME20
    LoaiGiamGia     NVARCHAR(20)        NOT NULL DEFAULT 'percent',
        -- percent: Giảm theo %
        -- fixed: Giảm số tiền cố định
    GiaTri          DECIMAL(18,0)       NOT NULL,               -- 10 (=10%) hoặc 50000 (=50K)
    DonToiThieu     DECIMAL(18,0)       NULL,                   -- Đơn tối thiểu để áp dụng
    GiamToiDa       DECIMAL(18,0)       NULL,                   -- Giảm tối đa (cho loại %)
    SoLuotDung      INT                 NOT NULL DEFAULT 0,     -- Tổng lượt cho phép
    DaSuDung        INT                 NOT NULL DEFAULT 0,     -- Đã dùng bao nhiêu lượt
    NgayBatDau      DATETIME2           NOT NULL,               -- Bắt đầu hiệu lực
    NgayKetThuc     DATETIME2           NOT NULL,               -- Hết hạn
    TrangThai       BIT                 NOT NULL DEFAULT 1,     -- 1=Hoạt động, 0=Tắt
    MoTa            NVARCHAR(300)       NULL,                   -- Mô tả: "Giảm 10% cho đơn từ 500K"
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_MaGiamGia_Ma UNIQUE (MaCoupon)
);
GO

-- ================================================================
-- 13. BẢNG: KhuyenMai
-- Chương trình khuyến mãi (áp dụng tự động, không cần nhập mã)
-- ================================================================
CREATE TABLE KhuyenMai (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenKhuyenMai    NVARCHAR(200)       NOT NULL,               -- "Giảm 20% toàn bộ áo thun"
    LoaiGiamGia     NVARCHAR(20)        NOT NULL DEFAULT 'percent',
    GiaTri          DECIMAL(18,0)       NOT NULL,
    ApDungCho       NVARCHAR(50)        NOT NULL DEFAULT 'all',
        -- all: Toàn bộ sản phẩm
        -- category: Theo danh mục
        -- product: Theo sản phẩm cụ thể
    DanhMucApDung   NVARCHAR(200)       NULL,                   -- Tên danh mục (nếu ApDungCho=category)
    SanPhamApDung   NVARCHAR(MAX)       NULL,                   -- JSON danh sách ID SP
    NgayBatDau      DATETIME2           NOT NULL,
    NgayKetThuc     DATETIME2           NOT NULL,
    TrangThai       BIT                 NOT NULL DEFAULT 1,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ================================================================
-- 14. BẢNG: FlashSale
-- Flash sale - giảm giá sốc trong thời gian ngắn
-- ================================================================
CREATE TABLE FlashSale (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenFlashSale    NVARCHAR(200)       NOT NULL,               -- "Flash Sale 24H"
    NgayBatDau      DATETIME2           NOT NULL,
    NgayKetThuc     DATETIME2           NOT NULL,
    TrangThai       BIT                 NOT NULL DEFAULT 1,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ================================================================
-- 15. BẢNG: ChiTietFlashSale
-- Sản phẩm trong flash sale + giá sale riêng
-- ================================================================
CREATE TABLE ChiTietFlashSale (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    FlashSaleId     INT                 NOT NULL,
    SanPhamId       INT                 NOT NULL,
    GiaFlashSale    DECIMAL(18,0)       NOT NULL,               -- Giá đặc biệt trong flash sale
    SoLuongGioiHan  INT                 NOT NULL DEFAULT 0,     -- 0 = không giới hạn
    DaBan           INT                 NOT NULL DEFAULT 0,     -- Đã bán trong flash sale

    CONSTRAINT FK_CTFS_FlashSale FOREIGN KEY (FlashSaleId) REFERENCES FlashSale(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CTFS_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
);
GO

-- ================================================================
-- 16. BẢNG: Banner
-- Banner quảng cáo trên trang chủ, slider, popup...
-- ================================================================
CREATE TABLE Banner (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TieuDe          NVARCHAR(200)       NOT NULL,               -- "Summer Sale 50%"
    TieuDePhu       NVARCHAR(200)       NULL,                   -- Subtitle
    MoTa            NVARCHAR(500)       NULL,
    HinhAnh         NVARCHAR(500)       NOT NULL,               -- URL ảnh banner
    LienKet         NVARCHAR(500)       NULL,                   -- Link khi click
    LoaiBanner      NVARCHAR(30)        NOT NULL DEFAULT 'slider',
        -- slider: Slider trang chủ
        -- popup: Popup quảng cáo
        -- category: Banner danh mục
        -- promotion: Banner khuyến mãi
    ViTri           NVARCHAR(50)        NOT NULL DEFAULT 'homepage',
        -- homepage: Trang chủ
        -- category: Trang danh mục
        -- product: Trang sản phẩm
    ThuTu           INT                 NOT NULL DEFAULT 0,
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'active',
    NgayBatDau      DATETIME2           NULL,
    NgayKetThuc     DATETIME2           NULL,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ================================================================
-- 17. BẢNG: Lookbook
-- Lookbook thời trang - bộ ảnh phong cách
-- ================================================================
CREATE TABLE Lookbook (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TieuDe          NVARCHAR(200)       NOT NULL,               -- "Street Style Mùa Hè"
    TieuDePhu       NVARCHAR(200)       NULL,
    MoTa            NVARCHAR(1000)      NULL,
    HinhAnh         NVARCHAR(500)       NOT NULL,               -- Ảnh chính
    LienKet         NVARCHAR(500)       NULL,                   -- Link đến bộ sưu tập
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'active',
    ThuTu           INT                 NOT NULL DEFAULT 0,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ================================================================
-- 18. BẢNG: TonKho_LichSu
-- Lịch sử nhập/xuất kho
-- ================================================================
CREATE TABLE TonKho_LichSu (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,
    LoaiThayDoi     NVARCHAR(20)        NOT NULL,
        -- import: Nhập kho
        -- export: Xuất kho (bán)
        -- adjust: Điều chỉnh thủ công
        -- return: Trả hàng
    SoLuong         INT                 NOT NULL,               -- Số lượng thay đổi (+/-)
    TonKhoTruoc     INT                 NOT NULL,               -- Tồn kho trước khi thay đổi
    TonKhoSau       INT                 NOT NULL,               -- Tồn kho sau khi thay đổi
    GhiChu          NVARCHAR(300)       NULL,                   -- Lý do: "Nhập hàng đợt 3"
    NguoiThucHien   NVARCHAR(100)       NULL,                   -- Admin nào thực hiện
    DonHangId       INT                 NULL,                   -- Liên quan đến đơn hàng nào
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_TonKho_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id),
    CONSTRAINT FK_TonKho_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_TonKho_SanPham ON TonKho_LichSu(SanPhamId);
CREATE NONCLUSTERED INDEX IX_TonKho_NgayTao ON TonKho_LichSu(NgayTao DESC);
GO

-- ================================================================
-- 19. BẢNG: CanhBaoTonKho
-- Cảnh báo khi sản phẩm sắp hết hàng
-- ================================================================
CREATE TABLE CanhBaoTonKho (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,
    NguongCanhBao   INT                 NOT NULL DEFAULT 5,     -- Cảnh báo khi tồn kho <= 5
    TonKhoHienTai   INT                 NOT NULL,
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'active',
        -- active: Đang cảnh báo
        -- resolved: Đã xử lý (nhập thêm hàng)
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
    NgayXuLy        DATETIME2           NULL,

    CONSTRAINT FK_CanhBao_SanPham FOREIGN KEY (SanPhamId) REFERENCES SanPham(Id)
);
GO

-- ================================================================
-- 20. BẢNG: TrangTinh
-- Trang nội dung tĩnh: Giới thiệu, Chính sách, Hướng dẫn...
-- ================================================================
CREATE TABLE TrangTinh (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TieuDe          NVARCHAR(200)       NOT NULL,               -- "Chính sách đổi trả"
    Slug            NVARCHAR(200)       NOT NULL,               -- chinh-sach-doi-tra
    NoiDung         NVARCHAR(MAX)       NOT NULL,               -- Nội dung HTML
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'published',
        -- published: Đã xuất bản
        -- draft: Nháp
    MetaTitle       NVARCHAR(200)       NULL,
    MetaDescription NVARCHAR(500)       NULL,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
    NgayCapNhat     DATETIME2           NULL,

    CONSTRAINT UQ_TrangTinh_Slug UNIQUE (Slug)
);
GO

-- ================================================================
-- 21. BẢNG: MenuDieuHuong
-- Menu điều hướng trên header/footer
-- ================================================================
CREATE TABLE MenuDieuHuong (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenMenu         NVARCHAR(100)       NOT NULL,               -- "Nữ", "Nam", "Sale"
    LienKet         NVARCHAR(300)       NOT NULL,               -- /women, /men, /sale
    ViTri           NVARCHAR(30)        NOT NULL DEFAULT 'header',
        -- header: Menu chính trên header
        -- footer: Menu dưới footer
        -- mobile: Menu mobile
    MenuChaId       INT                 NULL,                   -- Menu cha (dropdown)
    ThuTu           INT                 NOT NULL DEFAULT 0,
    TrangThai       BIT                 NOT NULL DEFAULT 1,
    BieuTuong       NVARCHAR(100)       NULL,                   -- Icon class (fa fa-xxx)
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_Menu_Cha FOREIGN KEY (MenuChaId) REFERENCES MenuDieuHuong(Id)
);
GO

-- ================================================================
-- 22. BẢNG: CauHinhCuaHang
-- Cài đặt chung của shop: tên, logo, SĐT, email, ship...
-- ================================================================
CREATE TABLE CauHinhCuaHang (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    MaCauHinh       NVARCHAR(100)       NOT NULL,               -- Key cấu hình
    GiaTri          NVARCHAR(MAX)       NOT NULL,               -- Value
    NhomCauHinh     NVARCHAR(50)        NOT NULL DEFAULT 'general',
        -- general: Thông tin chung
        -- payment: Thanh toán
        -- shipping: Vận chuyển
        -- email: Email
        -- notification: Thông báo
        -- security: Bảo mật
    MoTa            NVARCHAR(300)       NULL,
    NgayCapNhat     DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT UQ_CauHinh_Ma UNIQUE (MaCauHinh)
);
GO

-- ================================================================
-- 23. BẢNG: CauHinhTrangChu
-- Cấu hình các section trên trang chủ (SP mới, bán chạy, sale)
-- ================================================================
CREATE TABLE CauHinhTrangChu (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    TenSection      NVARCHAR(100)       NOT NULL,               -- newArrivals, bestSellers, saleProducts
    DanhSachSPId    NVARCHAR(MAX)       NULL,                   -- JSON: [1,5,12,23]
    ThuTu           INT                 NOT NULL DEFAULT 0,
    TrangThai       BIT                 NOT NULL DEFAULT 1,
    NgayCapNhat     DATETIME2           NOT NULL DEFAULT GETUTCDATE()
);
GO

-- ================================================================
-- 24. BẢNG: LichSuThanhToan
-- Ghi lại lịch sử thanh toán cho từng đơn hàng
-- ================================================================
CREATE TABLE LichSuThanhToan (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    DonHangId       INT                 NOT NULL,
    PhuongThuc      NVARCHAR(30)        NOT NULL,               -- COD, VISA, ATM, Momo
    SoTien          DECIMAL(18,0)       NOT NULL,
    TrangThai       NVARCHAR(20)        NOT NULL DEFAULT 'pending',
        -- pending: Chờ thanh toán
        -- success: Thành công
        -- failed: Thất bại
        -- refunded: Đã hoàn tiền
    MaGiaoDich      NVARCHAR(100)       NULL,                   -- Mã giao dịch từ cổng TT
    GhiChu          NVARCHAR(300)       NULL,
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_ThanhToan_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id)
);
GO

-- ================================================================
-- 25. BẢNG: ThongBao
-- Thông báo cho khách hàng (đơn hàng, khuyến mãi...)
-- ================================================================
CREATE TABLE ThongBao (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,               -- Gửi cho ai
    TieuDe          NVARCHAR(200)       NOT NULL,               -- "Đơn hàng KK-xxx đã được xác nhận"
    NoiDung         NVARCHAR(500)       NOT NULL,
    LoaiThongBao    NVARCHAR(30)        NOT NULL DEFAULT 'order',
        -- order: Liên quan đơn hàng
        -- promotion: Khuyến mãi
        -- system: Hệ thống
    DaDoc           BIT                 NOT NULL DEFAULT 0,     -- 0=Chưa đọc, 1=Đã đọc
    LienKet         NVARCHAR(300)       NULL,                   -- Link đến chi tiết
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_ThongBao_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_ThongBao_NguoiDung ON ThongBao(NguoiDungId, DaDoc);
GO

-- ================================================================
-- 26. BẢNG: NhatKyHoatDong
-- Log hoạt động admin (ai làm gì, lúc nào)
-- ================================================================
CREATE TABLE NhatKyHoatDong (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    NguoiDungId     INT                 NOT NULL,               -- Admin nào
    HanhDong        NVARCHAR(50)        NOT NULL,               -- create, update, delete, login
    DoiTuong        NVARCHAR(50)        NOT NULL,               -- product, order, customer, coupon
    DoiTuongId      INT                 NULL,                   -- ID của đối tượng
    ChiTiet         NVARCHAR(500)       NULL,                   -- Mô tả chi tiết hành động
    DiaChiIP        NVARCHAR(50)        NULL,                   -- IP address
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_NhatKy_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
);
GO

CREATE NONCLUSTERED INDEX IX_NhatKy_NgayTao ON NhatKyHoatDong(NgayTao DESC);
CREATE NONCLUSTERED INDEX IX_NhatKy_DoiTuong ON NhatKyHoatDong(DoiTuong, DoiTuongId);
GO
-- Tạo các bảng nâng cao cho nghiệp vụ kho
USE KaitoKid;
GO

-- 1. Nhà cung cấp
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NhaCungCap')
BEGIN
    CREATE TABLE NhaCungCap (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TenNhaCungCap NVARCHAR(255) NOT NULL DEFAULT '',
        MaNhaCungCap NVARCHAR(50) NULL,
        NguoiLienHe NVARCHAR(100) NULL,
        SoDienThoai NVARCHAR(20) NULL,
        Email NVARCHAR(100) NULL,
        DiaChi NVARCHAR(500) NULL,
        MaSoThue NVARCHAR(50) NULL,
        GhiChu NVARCHAR(500) NULL,
        TrangThai BIT NOT NULL DEFAULT 1,
        NgayTao DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        NgayCapNhat DATETIME2 NULL
    );
    PRINT 'Created NhaCungCap';
END
GO

-- 2. Phiếu nhập
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PhieuNhap')
BEGIN
    CREATE TABLE PhieuNhap (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MaPhieu NVARCHAR(50) NOT NULL DEFAULT '',
        NhaCungCapId INT NULL,
        TenNhaCungCap NVARCHAR(255) NULL,
        NgayNhap DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        NguoiNhap NVARCHAR(100) NULL,
        TongGiaTri DECIMAL(18,0) NOT NULL DEFAULT 0,
        GhiChu NVARCHAR(1000) NULL,
        TrangThai NVARCHAR(20) NOT NULL DEFAULT 'done',
        NgayTao DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        NgayCapNhat DATETIME2 NULL
    );
    CREATE INDEX IX_PhieuNhap_NgayNhap ON PhieuNhap(NgayNhap DESC);
    CREATE UNIQUE INDEX IX_PhieuNhap_MaPhieu ON PhieuNhap(MaPhieu);
    PRINT 'Created PhieuNhap';
END
GO

-- 3. Chi tiết phiếu nhập
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ChiTietPhieuNhap')
BEGIN
    CREATE TABLE ChiTietPhieuNhap (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PhieuNhapId INT NOT NULL,
        SanPhamId INT NOT NULL,
        TenSanPham NVARCHAR(255) NOT NULL DEFAULT '',
        KichCo NVARCHAR(20) NULL,
        MauSac NVARCHAR(50) NULL,
        SoLuong INT NOT NULL DEFAULT 0,
        DonGiaNhap DECIMAL(18,0) NOT NULL DEFAULT 0,
        ThanhTien DECIMAL(18,0) NOT NULL DEFAULT 0,
        GhiChu NVARCHAR(500) NULL,
        CONSTRAINT FK_ChiTietPhieuNhap_PhieuNhap FOREIGN KEY (PhieuNhapId)
            REFERENCES PhieuNhap(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ChiTietPhieuNhap_PhieuNhapId ON ChiTietPhieuNhap(PhieuNhapId);
    CREATE INDEX IX_ChiTietPhieuNhap_SanPhamId ON ChiTietPhieuNhap(SanPhamId);
    PRINT 'Created ChiTietPhieuNhap';
END
GO

-- 4. Tồn kho biến thể (size + màu)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TonKhoBienThe')
BEGIN
    CREATE TABLE TonKhoBienThe (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SanPhamId INT NOT NULL,
        KichCo NVARCHAR(20) NOT NULL DEFAULT '',
        MauSac NVARCHAR(50) NOT NULL DEFAULT '',
        SoLuong INT NOT NULL DEFAULT 0,
        SoLuongDaBan INT NOT NULL DEFAULT 0,
        GiaVonTrungBinh DECIMAL(18,0) NULL,
        NgayTao DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        NgayCapNhat DATETIME2 NULL
    );
    CREATE INDEX IX_TonKhoBienThe_SanPhamId ON TonKhoBienThe(SanPhamId);
    CREATE UNIQUE INDEX IX_TonKhoBienThe_Variant ON TonKhoBienThe(SanPhamId, KichCo, MauSac);
    PRINT 'Created TonKhoBienThe';
END
GO

PRINT 'All inventory advanced tables created successfully.';


-- ================================================================
-- 31. BẢNG: CuocHoiThoai
-- Phiên hội thoại hỗ trợ (chatbot + live chat nhân viên)
-- ================================================================
CREATE TABLE CuocHoiThoai (
    Id                  INT IDENTITY(1,1)   PRIMARY KEY,
    NguoiDungId         INT                 NULL,                   -- NULL nếu là khách vãng lai
    MaKhachVangLai      NVARCHAR(64)        NULL,                   -- Định danh guest (localStorage)
    TenHienThi          NVARCHAR(100)       NULL,                   -- Tên khách (nếu có)
    TrangThai           NVARCHAR(20)        NOT NULL DEFAULT 'bot',
        -- bot: Chatbot đang xử lý
        -- waiting: Chờ nhân viên nhận (hàng đợi)
        -- agent: Nhân viên đang xử lý
        -- closed: Đã đóng
    NhanVienId          INT                 NULL,                   -- Nhân viên đang xử lý
    SanPhamNguCanhId    INT                 NULL,                   -- Sản phẩm khách đang xem khi mở chat
    TinNhanCuoi         NVARCHAR(500)       NULL,                   -- Preview tin cuối cho inbox
    ThoiGianTinCuoi     DATETIME2           NOT NULL DEFAULT GETUTCDATE(), -- Sắp xếp inbox
    SoTinChuaDocKhach   INT                 NOT NULL DEFAULT 0,     -- Số tin khách chưa đọc
    SoTinChuaDocNV      INT                 NOT NULL DEFAULT 0,     -- Số tin nhân viên chưa đọc
    NgayTao             DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
    NgayCapNhat         DATETIME2           NULL
);
GO

CREATE NONCLUSTERED INDEX IX_CuocHoiThoai_TrangThai_ThoiGianTinCuoi ON CuocHoiThoai(TrangThai, ThoiGianTinCuoi);
CREATE NONCLUSTERED INDEX IX_CuocHoiThoai_NguoiDungId ON CuocHoiThoai(NguoiDungId);
CREATE NONCLUSTERED INDEX IX_CuocHoiThoai_MaKhachVangLai ON CuocHoiThoai(MaKhachVangLai);
GO

-- ================================================================
-- 32. BẢNG: TinNhan
-- Tin nhắn trong một phiên hội thoại (khách / bot / nhân viên)
-- ================================================================
CREATE TABLE TinNhan (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    CuocHoiThoaiId  INT                 NOT NULL,               -- Thuộc phiên nào
    LoaiNguoiGui    NVARCHAR(20)        NOT NULL,
        -- customer: Khách hàng
        -- bot: Chatbot
        -- agent: Nhân viên
    NguoiGuiId      INT                 NULL,                   -- userId hoặc staffId; NULL cho bot/guest
    NoiDung         NVARCHAR(MAX)       NOT NULL,               -- Văn bản (escape khi render)
    LoaiDinhKem     NVARCHAR(20)        NULL,                   -- product / order / NULL
    DinhKemId       NVARCHAR(50)        NULL,                   -- Id sản phẩm hoặc mã đơn
    DinhKemJson     NVARCHAR(MAX)       NULL,                   -- Snapshot JSON để hiển thị card
    DaDoc           BIT                 NOT NULL DEFAULT 0,     -- 0=Chưa đọc, 1=Đã đọc
    NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_TinNhan_CuocHoiThoai FOREIGN KEY (CuocHoiThoaiId)
        REFERENCES CuocHoiThoai(Id) ON DELETE CASCADE
);
GO

CREATE NONCLUSTERED INDEX IX_TinNhan_CuocHoiThoaiId ON TinNhan(CuocHoiThoaiId, Id);
GO

-- ================================================================
-- BẢNG: SanPhamEmbedding
-- ================================================================
-- Vector đặc trưng (embedding) thị giác của ảnh sản phẩm — phục vụ
-- tìm kiếm bằng hình ảnh (visual similarity, CLIP/ONNX).
-- Mỗi sản phẩm tối đa 1 dòng. Vector lưu JSON float array, đã L2-normalize.
-- Bảng do API.Customer (ImageEmbeddingIndexer) tự ghi/cập nhật, không nhập tay.
-- ================================================================
CREATE TABLE SanPhamEmbedding (
    Id              INT IDENTITY(1,1)   PRIMARY KEY,
    SanPhamId       INT                 NOT NULL,               -- FK đến SanPham
    SoChieu         INT                 NOT NULL,               -- Số chiều vector (vd 512)
    Vector          NVARCHAR(MAX)       NOT NULL,               -- JSON: [0.12,-0.03,...]
    Model           NVARCHAR(200)       NOT NULL,               -- Tên/phiên bản model sinh embedding
    NguonHash       NVARCHAR(100)       NOT NULL,               -- Hash URL ảnh nguồn (phát hiện đổi ảnh)
    NgayCapNhat     DATETIME2           NOT NULL DEFAULT GETUTCDATE(),

    CONSTRAINT FK_SanPhamEmbedding_SanPham FOREIGN KEY (SanPhamId)
        REFERENCES SanPham(Id) ON DELETE CASCADE
);
GO

CREATE UNIQUE NONCLUSTERED INDEX IX_SanPhamEmbedding_SanPhamId ON SanPhamEmbedding(SanPhamId);
GO


-- ================================================================
-- ================================================================
--                    DỮ LIỆU MẪU BAN ĐẦU
-- ================================================================
-- ================================================================

-- ================================================================
-- Tài khoản admin / nhân viên KHÔNG còn nằm ở bảng NguoiDung.
-- Quản trị viên & nhân viên được quản lý ở bảng NhanVien (xem scripts/add-staff-rbac.sql),
-- đăng nhập qua /api/auth/staff/login. NguoiDung CHỈ chứa khách hàng.
-- (Fix Lỗ hổng 4 — tránh 2 mô hình người dùng chồng lấn, mơ hồ "admin" là ai.)
-- ================================================================
GO

-- Tài khoản khách hàng mẫu
-- Dùng IDENTITY_INSERT để giữ Id = 2,3,4 (khớp các đơn hàng / đánh giá mẫu phía dưới
-- vốn tham chiếu NguoiDungId = 2,3,4). Id = 1 bỏ trống do trước đây là admin,
-- nay admin nằm ở bảng NhanVien.
SET IDENTITY_INSERT NguoiDung ON;
INSERT INTO NguoiDung (Id, HoTen, Email, MatKhauHash, SoDienThoai, VaiTro)
VALUES
    (2, N'Nguyễn Thị Thảo', 'thao@gmail.com', '$2a$11$K8GpahMYCWMKJxBzXjH1/.7JYOqFHvFMiYJJSlELOUB8.p4kK6Wm6', '0912345678', 'user'),
    (3, N'Trần Minh Hoàng', 'hoang@gmail.com', '$2a$11$K8GpahMYCWMKJxBzXjH1/.7JYOqFHvFMiYJJSlELOUB8.p4kK6Wm6', '0923456789', 'user'),
    (4, N'Lê Phương Linh', 'linh@gmail.com', '$2a$11$K8GpahMYCWMKJxBzXjH1/.7JYOqFHvFMiYJJSlELOUB8.p4kK6Wm6', '0934567890', 'user');
SET IDENTITY_INSERT NguoiDung OFF;
GO

-- ================================================================
-- Danh mục sản phẩm
-- ================================================================
INSERT INTO DanhMuc (TenDanhMuc, Slug, MoTa, ThuTu) VALUES
    (N'Áo',        'ao',       N'Tất cả các loại áo',          1),
    (N'Quần',      'quan',     N'Tất cả các loại quần',        2),
    (N'Váy',       'vay',      N'Váy các kiểu',                3),
    (N'Đầm',       'dam',      N'Đầm dự tiệc, đầm công sở',   4),
    (N'Phụ kiện',  'phu-kien', N'Túi, mũ, thắt lưng, kính',   5);
GO

-- Danh mục con
INSERT INTO DanhMuc (TenDanhMuc, Slug, MoTa, DanhMucChaId, ThuTu) VALUES
    (N'Áo thun',       'ao-thun',      N'Áo thun nam nữ',         1, 1),
    (N'Áo sơ mi',      'ao-so-mi',     N'Áo sơ mi công sở',       1, 2),
    (N'Áo khoác',      'ao-khoac',     N'Áo khoác, hoodie',       1, 3),
    (N'Áo polo',       'ao-polo',      N'Áo polo nam nữ',         1, 4),
    (N'Quần jean',     'quan-jean',    N'Quần jean các kiểu',     2, 1),
    (N'Quần kaki',     'quan-kaki',    N'Quần kaki, chinos',      2, 2),
    (N'Quần short',    'quan-short',   N'Quần short, quần đùi',   2, 3);
GO

-- ================================================================
-- Bộ sưu tập
-- ================================================================
INSERT INTO BoSuuTap (TenBoSuuTap, Slug, MoTa, ThuTu) VALUES
    (N'Spring/Summer 2025',     'spring-summer-2025',   N'Bộ sưu tập Xuân Hè 2025 - Tươi mát, năng động',  1),
    (N'Streetwear Collection',  'streetwear',           N'Phong cách đường phố cá tính',                     2),
    (N'Office Essentials',      'office-essentials',    N'Trang phục công sở thanh lịch',                    3),
    (N'Weekend Casual',         'weekend-casual',       N'Thoải mái cho ngày cuối tuần',                     4);
GO

-- ================================================================
-- Sản phẩm mẫu (20 sản phẩm)
-- ================================================================
INSERT INTO SanPham (TenSanPham, DanhMucId, DanhMuc, DanhMucPhu, GioiTinh, Gia, GiaCu, TonKho, TrangThai, HinhAnh, MoTaNgan, MoTaChiTiet, MaSanPham, Slug, LaSanPhamMoi, DangGiamGia, BanChayNhat, DiemDanhGia, SoLuongDaBan, DanhSachMau, DanhSachSize, BoSuuTapId) VALUES
-- Áo thun
(N'Áo Thun Nam Cổ Tròn Basic',         6, 'Ao', N'Áo thun',   'Nam',      299000, NULL,   150, 'active', '/products/ao-thun-nam-1.jpg',
 N'Áo thun cotton 100%, form regular fit',
 N'<p>Áo thun nam cổ tròn chất liệu cotton 100% mềm mại, thoáng mát. Form regular fit phù hợp mọi vóc dáng.</p><ul><li>Chất liệu: Cotton 100%</li><li>Form: Regular fit</li><li>Xuất xứ: Việt Nam</li></ul>',
 'KK-AT-001', 'ao-thun-nam-co-tron-basic', 1, 0, 1, 4.5, 234,
 '["Đen","Trắng","Xám","Xanh navy"]', '["S","M","L","XL","XXL"]', 1),

(N'Áo Thun Nữ Oversize In Hình',       6, 'Ao', N'Áo thun',   'Nu',       349000, 450000, 80,  'active', '/products/ao-thun-nu-1.jpg',
 N'Áo thun oversize phong cách Hàn Quốc',
 N'<p>Áo thun nữ oversize in hình trendy, chất cotton pha co giãn thoải mái.</p>',
 'KK-AT-002', 'ao-thun-nu-oversize-in-hinh', 1, 1, 0, 4.8, 156,
 '["Trắng","Đen","Be"]', '["Freesize"]', 1),

(N'Áo Thun Unisex Tie-Dye',            6, 'Ao', N'Áo thun',   'Unisex',   399000, NULL,   60,  'active', '/products/ao-thun-tiedye-1.jpg',
 N'Áo thun tie-dye phong cách streetwear',
 N'<p>Áo thun unisex tie-dye độc đáo, mỗi chiếc là duy nhất.</p>',
 'KK-AT-003', 'ao-thun-unisex-tie-dye', 1, 0, 0, 4.3, 89,
 '["Tím","Xanh","Cam"]', '["S","M","L","XL"]', 2),

-- Áo sơ mi
(N'Áo Sơ Mi Nam Trắng Công Sở',        7, 'Ao', N'Áo sơ mi',  'Nam',      499000, NULL,   100, 'active', '/products/ao-somi-nam-1.jpg',
 N'Áo sơ mi trắng slim fit, chất liệu cao cấp',
 N'<p>Áo sơ mi nam trắng form slim fit, chất liệu cotton pha polyester ít nhăn.</p>',
 'KK-SM-001', 'ao-so-mi-nam-trang-cong-so', 0, 0, 1, 4.7, 312,
 '["Trắng"]', '["S","M","L","XL"]', 3),

(N'Áo Sơ Mi Nữ Cổ V Thanh Lịch',      7, 'Ao', N'Áo sơ mi',  'Nu',       459000, 599000, 70,  'active', '/products/ao-somi-nu-1.jpg',
 N'Áo sơ mi nữ cổ V, phù hợp đi làm và dạo phố',
 N'<p>Áo sơ mi nữ cổ V chất lụa mềm mại, form regular phù hợp nhiều dáng người.</p>',
 'KK-SM-002', 'ao-so-mi-nu-co-v', 1, 1, 0, 4.6, 178,
 '["Trắng","Hồng nhạt","Xanh pastel"]', '["S","M","L"]', 3),

-- Áo khoác
(N'Áo Khoác Hoodie Unisex Basic',      8, 'Ao', N'Áo khoác',  'Unisex',   599000, NULL,   90,  'active', '/products/hoodie-1.jpg',
 N'Hoodie unisex nỉ bông dày dặn, ấm áp',
 N'<p>Áo hoodie unisex chất nỉ bông cotton, mũ trùm có dây rút, túi kangaroo phía trước.</p>',
 'KK-AK-001', 'ao-khoac-hoodie-unisex-basic', 1, 0, 1, 4.9, 445,
 '["Đen","Xám","Xanh rêu","Be"]', '["S","M","L","XL"]', 2),

(N'Áo Khoác Bomber Nam',               8, 'Ao', N'Áo khoác',  'Nam',      799000, 999000, 45,  'active', '/products/bomber-nam-1.jpg',
 N'Áo bomber phong cách quân đội, chất dù nhẹ',
 N'<p>Áo khoác bomber nam chất dù nhẹ, chống gió nhẹ, phù hợp thời tiết se lạnh.</p>',
 'KK-AK-002', 'ao-khoac-bomber-nam', 0, 1, 0, 4.4, 123,
 '["Đen","Xanh rêu","Nâu"]', '["M","L","XL"]', 2),

-- Áo polo
(N'Áo Polo Nam Cổ Bẻ Classic',         9, 'Ao', N'Áo polo',   'Nam',      399000, NULL,   120, 'active', '/products/polo-nam-1.jpg',
 N'Áo polo nam cổ bẻ, chất pique cotton',
 N'<p>Áo polo nam cổ bẻ classic, chất pique cotton thoáng mát, phù hợp đi làm và đi chơi.</p>',
 'KK-PL-001', 'ao-polo-nam-co-be-classic', 0, 0, 1, 4.6, 267,
 '["Đen","Trắng","Xanh navy","Đỏ đô"]', '["S","M","L","XL"]', 4);
GO

INSERT INTO SanPham (TenSanPham, DanhMucId, DanhMuc, DanhMucPhu, GioiTinh, Gia, GiaCu, TonKho, TrangThai, HinhAnh, MoTaNgan, MoTaChiTiet, MaSanPham, Slug, LaSanPhamMoi, DangGiamGia, BanChayNhat, DiemDanhGia, SoLuongDaBan, DanhSachMau, DanhSachSize, BoSuuTapId) VALUES
-- Quần jean
(N'Quần Jean Nam Slim Fit Xanh Đậm',   10, 'Quan', N'Quần jean', 'Nam',    599000, NULL,   85,  'active', '/products/jean-nam-1.jpg',
 N'Quần jean nam slim fit, co giãn thoải mái',
 N'<p>Quần jean nam slim fit chất denim co giãn, thoải mái vận động. Wash xanh đậm classic.</p>',
 'KK-QJ-001', 'quan-jean-nam-slim-fit-xanh-dam', 1, 0, 1, 4.7, 389,
 '["Xanh đậm","Xanh nhạt","Đen"]', '["29","30","31","32","33","34"]', NULL),

(N'Quần Jean Nữ Ống Rộng',             10, 'Quan', N'Quần jean', 'Nu',     549000, 699000, 65,  'active', '/products/jean-nu-1.jpg',
 N'Quần jean nữ ống rộng phong cách Y2K',
 N'<p>Quần jean nữ ống rộng cạp cao, phong cách retro Y2K đang hot.</p>',
 'KK-QJ-002', 'quan-jean-nu-ong-rong', 1, 1, 0, 4.5, 201,
 '["Xanh nhạt","Trắng"]', '["26","27","28","29","30"]', NULL),

-- Quần kaki
(N'Quần Kaki Nam Ống Đứng',            11, 'Quan', N'Quần kaki', 'Nam',    499000, NULL,   95,  'active', '/products/kaki-nam-1.jpg',
 N'Quần kaki nam ống đứng, phù hợp công sở',
 N'<p>Quần kaki nam ống đứng chất cotton pha spandex, ít nhăn, phù hợp đi làm.</p>',
 'KK-QK-001', 'quan-kaki-nam-ong-dung', 0, 0, 1, 4.4, 198,
 '["Be","Đen","Xám","Xanh navy"]', '["29","30","31","32","33","34"]', 3),

-- Quần short
(N'Quần Short Nam Thể Thao',           12, 'Quan', N'Quần short', 'Nam',   299000, NULL,   110, 'active', '/products/short-nam-1.jpg',
 N'Quần short nam thể thao, chất gió nhẹ',
 N'<p>Quần short nam chất gió nhẹ, nhanh khô, có túi khóa kéo hai bên.</p>',
 'KK-QS-001', 'quan-short-nam-the-thao', 1, 0, 0, 4.3, 156,
 '["Đen","Xám","Xanh navy"]', '["S","M","L","XL"]', 4),

-- Váy
(N'Váy Midi Xếp Ly Thanh Lịch',        3, 'Vay', NULL,         'Nu',      599000, 799000, 50,  'active', '/products/vay-midi-1.jpg',
 N'Váy midi xếp ly chất voan, bay bổng nữ tính',
 N'<p>Váy midi xếp ly chất voan mềm mại, cạp chun co giãn, phù hợp đi làm và dự tiệc.</p>',
 'KK-VY-001', 'vay-midi-xep-ly-thanh-lich', 1, 1, 1, 4.8, 234,
 '["Đen","Be","Xanh pastel"]', '["S","M","L"]', 3),

(N'Váy Tennis Ngắn Năng Động',          3, 'Vay', NULL,         'Nu',      349000, NULL,   75,  'active', '/products/vay-tennis-1.jpg',
 N'Váy tennis ngắn phong cách sporty',
 N'<p>Váy tennis ngắn có quần lót bên trong, chất thun co giãn 4 chiều.</p>',
 'KK-VY-002', 'vay-tennis-ngan-nang-dong', 1, 0, 0, 4.5, 145,
 '["Trắng","Đen","Hồng"]', '["S","M","L"]', 1),

-- Đầm
(N'Đầm Dự Tiệc Cổ V Sang Trọng',       4, 'Dam', NULL,         'Nu',      899000, 1200000, 30, 'active', '/products/dam-du-tiec-1.jpg',
 N'Đầm dự tiệc cổ V chất lụa cao cấp',
 N'<p>Đầm dự tiệc cổ V sâu, chất lụa satin bóng mượt, dáng ôm body quyến rũ.</p>',
 'KK-DM-001', 'dam-du-tiec-co-v-sang-trong', 0, 1, 0, 4.9, 87,
 '["Đen","Đỏ đô","Xanh emerald"]', '["S","M","L"]', NULL),

(N'Đầm Suông Công Sở Tay Lỡ',          4, 'Dam', NULL,         'Nu',      699000, NULL,   55,  'active', '/products/dam-cong-so-1.jpg',
 N'Đầm suông công sở thanh lịch, tay lỡ',
 N'<p>Đầm suông công sở chất đũi mềm, tay lỡ che khuyết điểm bắp tay.</p>',
 'KK-DM-002', 'dam-suong-cong-so-tay-lo', 1, 0, 1, 4.6, 167,
 '["Đen","Xám","Be"]', '["S","M","L","XL"]', 3),

-- Phụ kiện
(N'Túi Tote Vải Canvas KaitoKid',       5, 'PhuKien', NULL,     'Unisex',  199000, NULL,   200, 'active', '/products/tui-tote-1.jpg',
 N'Túi tote vải canvas in logo KaitoKid',
 N'<p>Túi tote vải canvas dày dặn, in logo KaitoKid, đựng được laptop 14 inch.</p>',
 'KK-PK-001', 'tui-tote-vai-canvas-kaitokid', 1, 0, 0, 4.2, 312,
 '["Trắng","Đen"]', '["Freesize"]', NULL),

(N'Mũ Lưỡi Trai Thêu Logo',            5, 'PhuKien', NULL,     'Unisex',  149000, 199000, 180, 'active', '/products/mu-luoi-trai-1.jpg',
 N'Mũ lưỡi trai thêu logo KaitoKid',
 N'<p>Mũ lưỡi trai unisex, thêu logo KaitoKid, khóa điều chỉnh phía sau.</p>',
 'KK-PK-002', 'mu-luoi-trai-theu-logo', 0, 1, 0, 4.1, 234,
 '["Đen","Trắng","Be","Xanh navy"]', '["Freesize"]', NULL),

(N'Thắt Lưng Da Nam Khóa Tự Động',     5, 'PhuKien', NULL,     'Nam',     299000, NULL,   90,  'active', '/products/that-lung-1.jpg',
 N'Thắt lưng da bò thật, khóa tự động',
 N'<p>Thắt lưng da bò thật 100%, khóa tự động tiện lợi, bề mặt vân saffiano.</p>',
 'KK-PK-003', 'that-lung-da-nam-khoa-tu-dong', 0, 0, 1, 4.7, 178,
 '["Đen","Nâu"]', '["Freesize"]', NULL);
GO

-- ================================================================
-- Mã giảm giá mẫu
-- ================================================================
INSERT INTO MaGiamGia (MaCoupon, LoaiGiamGia, GiaTri, DonToiThieu, GiamToiDa, SoLuotDung, NgayBatDau, NgayKetThuc, MoTa) VALUES
    ('WELCOME10',   'percent',  10, 200000,  100000, 1000, '2025-01-01', '2025-12-31', N'Giảm 10% cho khách mới, đơn từ 200K'),
    ('SALE20',      'percent',  20, 500000,  200000, 500,  '2025-03-01', '2025-06-30', N'Giảm 20% cho đơn từ 500K'),
    ('FREESHIP',    'fixed',    30000, 300000, NULL,  2000, '2025-01-01', '2025-12-31', N'Miễn phí ship cho đơn từ 300K'),
    ('SUMMER50',    'fixed',    50000, 400000, NULL,  300,  '2025-06-01', '2025-08-31', N'Giảm 50K cho đơn từ 400K mùa hè'),
    ('VIP30',       'percent',  30, 1000000, 500000, 100,  '2025-01-01', '2025-12-31', N'Giảm 30% cho khách VIP, đơn từ 1 triệu');
GO

-- ================================================================
-- Banner trang chủ mẫu
-- ================================================================
INSERT INTO Banner (TieuDe, TieuDePhu, HinhAnh, LienKet, LoaiBanner, ViTri, ThuTu) VALUES
    (N'Spring/Summer 2025',     N'Everyday Essentials',         '/slide_1.jpg', '/collections',  'slider', 'homepage', 1),
    (N'New Arrivals',           N'Fresh & Trendy',              '/slide_2.jpg', '/new-in',       'slider', 'homepage', 2),
    (N'Summer Sale 50%',        N'Giảm giá lên đến 50%',       '/slide_3.jpg', '/sale',         'slider', 'homepage', 3);
GO

-- ================================================================
-- Lookbook mẫu
-- ================================================================
INSERT INTO Lookbook (TieuDe, TieuDePhu, MoTa, HinhAnh, LienKet, ThuTu) VALUES
    (N'Street Style Mùa Hè',       N'Summer 2025',     N'Phong cách đường phố năng động cho mùa hè',   '/lookbook/street-1.jpg',   '/collections', 1),
    (N'Office Chic',                N'Công sở thanh lịch', N'Gợi ý trang phục công sở hiện đại',        '/lookbook/office-1.jpg',   '/collections', 2);
GO

-- ================================================================
-- Menu điều hướng mẫu
-- ================================================================
INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, ThuTu) VALUES
    (N'Nữ',            '/women',       'header', 1),
    (N'Nam',            '/men',         'header', 2),
    (N'Trẻ em',         '/kids',        'header', 3),
    (N'Bộ sưu tập',    '/collections', 'header', 4),
    (N'Sale',           '/sale',        'header', 5),
    (N'New In',         '/new-in',      'header', 6);
GO

-- Menu con cho "Nữ"
INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, MenuChaId, ThuTu) VALUES
    (N'Áo thun nữ',    '/women?category=ao-thun',  'header', 1, 1),
    (N'Áo sơ mi nữ',   '/women?category=ao-so-mi', 'header', 1, 2),
    (N'Váy',            '/women?category=vay',      'header', 1, 3),
    (N'Đầm',            '/women?category=dam',      'header', 1, 4);
GO

-- Menu con cho "Nam"
INSERT INTO MenuDieuHuong (TenMenu, LienKet, ViTri, MenuChaId, ThuTu) VALUES
    (N'Áo thun nam',    '/men?category=ao-thun',    'header', 2, 1),
    (N'Áo sơ mi nam',   '/men?category=ao-so-mi',   'header', 2, 2),
    (N'Quần jean',      '/men?category=quan-jean',  'header', 2, 3),
    (N'Quần kaki',      '/men?category=quan-kaki',  'header', 2, 4);
GO

-- ================================================================
-- Cấu hình cửa hàng mẫu
-- ================================================================
INSERT INTO CauHinhCuaHang (MaCauHinh, GiaTri, NhomCauHinh, MoTa) VALUES
    ('storeName',       N'KAITO KID',                       'general',  N'Tên cửa hàng'),
    ('storePhone',      '0901234567',                       'general',  N'Số điện thoại'),
    ('storeEmail',      'contact@kaitokid.vn',              'general',  N'Email liên hệ'),
    ('storeAddress',    N'123 Nguyễn Huệ, Q.1, TP.HCM',    'general',  N'Địa chỉ cửa hàng'),
    ('storeLogo',       '/images/logokaitokid.png',         'general',  N'Logo cửa hàng'),
    ('freeShipMin',     '499000',                           'shipping', N'Đơn tối thiểu để freeship'),
    ('shippingFee',     '30000',                            'shipping', N'Phí ship mặc định'),
    ('estimatedDelivery', N'2-3 ngày làm việc',             'shipping', N'Thời gian giao hàng dự kiến'),
    ('enableCOD',       'true',                             'payment',  N'Cho phép thanh toán COD'),
    ('enableMomo',      'true',                             'payment',  N'Cho phép thanh toán Momo'),
    ('enableBankTransfer', 'true',                          'payment',  N'Cho phép chuyển khoản'),
    ('bankName',        N'Vietcombank',                     'payment',  N'Tên ngân hàng'),
    ('bankAccount',     '1234567890',                       'payment',  N'Số tài khoản'),
    ('bankOwner',       N'KAITO KID FASHION CO.,LTD',       'payment',  N'Chủ tài khoản'),
    ('enableTracking',  'true',                             'general',  N'Cho phép theo dõi đơn hàng'),
    ('maintenanceMode', 'false',                            'general',  N'Chế độ bảo trì');
GO

-- ================================================================
-- Trang tĩnh mẫu
-- ================================================================
INSERT INTO TrangTinh (TieuDe, Slug, NoiDung) VALUES
    (N'Giới thiệu',            'gioi-thieu',           N'<h2>Về KAITO KID</h2><p>KAITO KID là thương hiệu thời trang Việt Nam, hướng tới phong cách trẻ trung, hiện đại với giá cả hợp lý. Chúng tôi cam kết mang đến những sản phẩm chất lượng, thiết kế phù hợp dáng người châu Á.</p>'),
    (N'Chính sách đổi trả',    'chinh-sach-doi-tra',   N'<h2>Chính sách đổi trả</h2><p>Đổi trả miễn phí trong 7 ngày kể từ ngày nhận hàng nếu sản phẩm bị lỗi hoặc không đúng mô tả. Sản phẩm đổi trả phải còn nguyên tem mác, chưa qua sử dụng.</p>'),
    (N'Chính sách vận chuyển',  'chinh-sach-van-chuyen', N'<h2>Chính sách vận chuyển</h2><p>Miễn phí vận chuyển cho đơn hàng từ 499.000đ. Thời gian giao hàng: Nội thành 1-2 ngày, ngoại thành 2-4 ngày.</p>'),
    (N'Hướng dẫn chọn size',   'huong-dan-chon-size',  N'<h2>Hướng dẫn chọn size</h2><p>Bảng size chuẩn KAITO KID được thiết kế phù hợp với dáng người Việt Nam. Nếu bạn phân vân giữa 2 size, hãy chọn size lớn hơn.</p>'),
    (N'Chính sách bảo mật',    'chinh-sach-bao-mat',   N'<h2>Chính sách bảo mật</h2><p>Chúng tôi cam kết bảo mật thông tin cá nhân của khách hàng. Thông tin của bạn chỉ được sử dụng cho mục đích xử lý đơn hàng và chăm sóc khách hàng.</p>');
GO

-- ================================================================
-- Đơn hàng mẫu
-- ================================================================
INSERT INTO DonHang (MaDonHang, NguoiDungId, TenNguoiNhan, SoDienThoai, Email, DiaChiGiao, TinhThanh, QuanHuyen, PhuongXa, TamTinh, PhiVanChuyen, GiamGia, TongTien, PhuongThucThanhToan, TrangThai) VALUES
    ('KK-20250320-ABC123', 2, N'Nguyễn Thị Thảo', '0912345678', 'thao@gmail.com', N'45 Lê Lợi, P.Bến Nghé, Q.1, TP.HCM', N'TP.HCM', N'Quận 1', N'Bến Nghé', 898000, 0, 0, 898000, 'COD', 'completed'),
    ('KK-20250322-DEF456', 3, N'Trần Minh Hoàng', '0923456789', 'hoang@gmail.com', N'12 Trần Hưng Đạo, P.5, Q.5, TP.HCM', N'TP.HCM', N'Quận 5', N'Phường 5', 1198000, 30000, 100000, 1128000, 'shipping', 'VISA'),
    ('KK-20250325-GHI789', 4, N'Lê Phương Linh', '0934567890', 'linh@gmail.com', N'78 Nguyễn Trãi, Thanh Xuân, Hà Nội', N'Hà Nội', N'Thanh Xuân', N'Nhân Chính', 599000, 30000, 0, 629000, 'Momo', 'confirmed');
GO

-- Chi tiết đơn hàng mẫu
INSERT INTO ChiTietDonHang (DonHangId, SanPhamId, TenSanPham, HinhAnhSP, DonGia, KichCo, MauSac, SoLuong) VALUES
    (1, 1, N'Áo Thun Nam Cổ Tròn Basic',       '/products/ao-thun-nam-1.jpg',  299000, 'L',  N'Đen',         2),
    (1, 8, N'Áo Polo Nam Cổ Bẻ Classic',        '/products/polo-nam-1.jpg',     299000, 'M',  N'Xanh navy',   1),
    (2, 9, N'Quần Jean Nam Slim Fit Xanh Đậm',  '/products/jean-nam-1.jpg',     599000, '32', N'Xanh đậm',    1),
    (2, 6, N'Áo Khoác Hoodie Unisex Basic',     '/products/hoodie-1.jpg',       599000, 'L',  N'Đen',         1),
    (3, 6, N'Áo Khoác Hoodie Unisex Basic',     '/products/hoodie-1.jpg',       599000, 'M',  N'Xám',         1);
GO

-- ================================================================
-- Đánh giá mẫu
-- ================================================================
INSERT INTO DanhGia (SanPhamId, NguoiDungId, TenKhachHang, DonHangId, SoSao, NoiDung, TrangThai) VALUES
    (1, 2, N'Nguyễn Thị Thảo', 1, 5, N'Vải rất mát, form chuẩn, giao hàng nhanh. Sẽ ủng hộ thêm!', 'approved'),
    (1, 3, N'Trần Minh Hoàng', 2, 4, N'Chất lượng tốt, giá hợp lý. Đóng gói cẩn thận!', 'approved'),
    (4, 2, N'Nguyễn Thị Thảo', 1, 5, N'Áo sơ mi đẹp lắm, mặc đi làm rất sang', 'approved'),
    (6, 4, N'Lê Phương Linh',  3, 5, N'Hoodie ấm lắm, chất nỉ dày dặn, mặc mùa đông rất ổn', 'approved'),
    (9, 3, N'Trần Minh Hoàng', 2, 4, N'Jean co giãn thoải mái, wash đẹp', 'approved');
GO

-- ================================================================
-- Cấu hình trang chủ mẫu
-- ================================================================
INSERT INTO CauHinhTrangChu (TenSection, DanhSachSPId, ThuTu) VALUES
    ('newArrivals',     '[1,2,3,5,6,9,10,12]',  1),
    ('bestSellers',     '[1,4,6,8,9,11,13,17]',  2),
    ('saleProducts',    '[2,5,7,10,13,15,19]',   3);
GO

-- ================================================================
-- HOÀN THÀNH
-- ================================================================
PRINT N'=== CSDL KaitoKid đã được tạo thành công! ===';
PRINT N'=== 26 bảng + dữ liệu mẫu ===';
PRINT N'=== Tài khoản admin: admin@kaitokid.vn / Admin@123 ===';
GO
-- v1.1: Bo sung schema DonHang, GioHang, DanhGia, MaGiamGia va 14 bang con lai
-- v1.2: Them du lieu mau: admin, san pham, danh muc, don hang, cau hinh
-- v1.3: Them bang chat CuocHoiThoai + TinNhan (live chat & chatbot)
