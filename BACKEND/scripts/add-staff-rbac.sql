-- Tạo schema RBAC cho nhân viên + phân quyền
USE KaitoKid;
GO

-- 1. Vai trò (Role) — admin, quản lý kho, NV bán hàng, marketing...
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VaiTro')
BEGIN
    CREATE TABLE VaiTro (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TenVaiTro NVARCHAR(100) NOT NULL,         -- "Quản lý kho"
        MaVaiTro NVARCHAR(50) NOT NULL,            -- "warehouse_manager"
        MoTa NVARCHAR(500) NULL,
        LaMacDinh BIT NOT NULL DEFAULT 0,          -- vai trò hệ thống không thể xóa
        TrangThai BIT NOT NULL DEFAULT 1,
        NgayTao DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        NgayCapNhat DATETIME2 NULL
    );
    CREATE UNIQUE INDEX IX_VaiTro_MaVaiTro ON VaiTro(MaVaiTro);
    PRINT 'Created VaiTro';
END
GO

-- 2. Quyền hạn (Permission) — granular: orders.view, products.delete...
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'QuyenHan')
BEGIN
    CREATE TABLE QuyenHan (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MaQuyen NVARCHAR(100) NOT NULL,            -- "orders.update_status"
        TenQuyen NVARCHAR(255) NOT NULL,           -- "Cập nhật trạng thái đơn hàng"
        Nhom NVARCHAR(50) NOT NULL,                -- "orders" / "products" / ...
        MoTa NVARCHAR(500) NULL
    );
    CREATE UNIQUE INDEX IX_QuyenHan_MaQuyen ON QuyenHan(MaQuyen);
    CREATE INDEX IX_QuyenHan_Nhom ON QuyenHan(Nhom);
    PRINT 'Created QuyenHan';
END
GO

-- 3. Liên kết Role × Permission
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VaiTro_QuyenHan')
BEGIN
    CREATE TABLE VaiTro_QuyenHan (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VaiTroId INT NOT NULL,
        QuyenHanId INT NOT NULL,
        CONSTRAINT FK_VaiTroQuyen_VaiTro FOREIGN KEY (VaiTroId) REFERENCES VaiTro(Id) ON DELETE CASCADE,
        CONSTRAINT FK_VaiTroQuyen_QuyenHan FOREIGN KEY (QuyenHanId) REFERENCES QuyenHan(Id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IX_VaiTro_QuyenHan ON VaiTro_QuyenHan(VaiTroId, QuyenHanId);
    PRINT 'Created VaiTro_QuyenHan';
END
GO

-- 4. Bảng nhân viên - tách hoàn toàn khỏi NguoiDung (khách hàng)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NhanVien')
BEGIN
    CREATE TABLE NhanVien (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(150) NOT NULL,
        MatKhauHash NVARCHAR(255) NOT NULL,
        HoTen NVARCHAR(150) NOT NULL,
        SoDienThoai NVARCHAR(20) NULL,
        AnhDaiDien NVARCHAR(500) NULL,
        VaiTroId INT NOT NULL,                     -- FK → VaiTro
        LaSuperAdmin BIT NOT NULL DEFAULT 0,       -- toàn quyền (bypass permission check)
        NgaySinh DATE NULL,
        GioiTinh NVARCHAR(20) NULL,
        DiaChi NVARCHAR(500) NULL,
        NgayVaoLam DATETIME2 NULL,
        TrangThai BIT NOT NULL DEFAULT 1,          -- 1 = đang làm, 0 = nghỉ
        LanDangNhapCuoi DATETIME2 NULL,
        SoLanDangNhapSai INT NOT NULL DEFAULT 0,
        BiKhoa BIT NOT NULL DEFAULT 0,
        GhiChu NVARCHAR(500) NULL,
        NgayTao DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        NgayCapNhat DATETIME2 NULL,
        CONSTRAINT FK_NhanVien_VaiTro FOREIGN KEY (VaiTroId) REFERENCES VaiTro(Id)
    );
    CREATE UNIQUE INDEX IX_NhanVien_Email ON NhanVien(Email);
    CREATE INDEX IX_NhanVien_VaiTroId ON NhanVien(VaiTroId);
    CREATE INDEX IX_NhanVien_TrangThai ON NhanVien(TrangThai);
    PRINT 'Created NhanVien';
END
GO

-- 5. Lịch sử đăng nhập của NV
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LichSuDangNhapNV')
BEGIN
    CREATE TABLE LichSuDangNhapNV (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NhanVienId INT NULL,                       -- NULL nếu sai email (không xác định được NV)
        Email NVARCHAR(150) NOT NULL,
        DiaChiIP NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        ThanhCong BIT NOT NULL DEFAULT 0,
        LyDoThatBai NVARCHAR(255) NULL,
        ThoiGian DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_LichSuDangNhapNV_NhanVienId ON LichSuDangNhapNV(NhanVienId);
    CREATE INDEX IX_LichSuDangNhapNV_ThoiGian ON LichSuDangNhapNV(ThoiGian DESC);
    PRINT 'Created LichSuDangNhapNV';
END
GO

-- =====================================================
-- SEED DATA
-- =====================================================

-- Seed quyền hạn
IF (SELECT COUNT(*) FROM QuyenHan) = 0
BEGIN
    INSERT INTO QuyenHan (MaQuyen, TenQuyen, Nhom, MoTa) VALUES
    -- Dashboard & Reports
    (N'dashboard.view', N'Xem dashboard', N'dashboard', N'Truy cập trang tổng quan'),
    (N'reports.view', N'Xem báo cáo', N'reports', N'Xem báo cáo doanh thu, top SP'),
    -- Products
    (N'products.view', N'Xem sản phẩm', N'products', N'Xem danh sách sản phẩm'),
    (N'products.create', N'Tạo sản phẩm', N'products', N'Thêm sản phẩm mới'),
    (N'products.update', N'Sửa sản phẩm', N'products', N'Cập nhật thông tin sản phẩm'),
    (N'products.delete', N'Xóa sản phẩm', N'products', N'Xóa sản phẩm'),
    -- Categories
    (N'categories.view', N'Xem danh mục', N'categories', N'Xem danh sách danh mục'),
    (N'categories.manage', N'Quản lý danh mục', N'categories', N'Tạo/sửa/xóa danh mục'),
    -- Inventory
    (N'inventory.view', N'Xem tồn kho', N'inventory', N'Xem tồn kho sản phẩm'),
    (N'inventory.manage', N'Quản lý kho', N'inventory', N'Điều chỉnh tồn kho, tạo phiếu nhập'),
    (N'inventory.history', N'Xem lịch sử kho', N'inventory', N'Xem lịch sử nhập/xuất'),
    -- Suppliers
    (N'suppliers.view', N'Xem nhà cung cấp', N'suppliers', N'Xem danh sách NCC'),
    (N'suppliers.manage', N'Quản lý nhà cung cấp', N'suppliers', N'Tạo/sửa/xóa NCC'),
    -- Stock Receipts
    (N'stock_receipts.view', N'Xem phiếu nhập', N'stock_receipts', N'Xem danh sách phiếu nhập'),
    (N'stock_receipts.create', N'Tạo phiếu nhập', N'stock_receipts', N'Tạo phiếu nhập mới'),
    (N'stock_receipts.cancel', N'Hủy phiếu nhập', N'stock_receipts', N'Hủy phiếu và rollback'),
    -- Orders
    (N'orders.view', N'Xem đơn hàng', N'orders', N'Xem danh sách đơn'),
    (N'orders.update_status', N'Cập nhật trạng thái đơn', N'orders', N'Đổi trạng thái đơn hàng'),
    (N'orders.cancel', N'Hủy đơn hàng', N'orders', N'Hủy đơn hàng'),
    -- Customers
    (N'customers.view', N'Xem khách hàng', N'customers', N'Xem danh sách khách'),
    (N'customers.manage', N'Quản lý khách hàng', N'customers', N'Khóa/mở khách hàng'),
    -- Marketing
    (N'banners.manage', N'Quản lý banner', N'marketing', N'Banner trang chủ'),
    (N'collections.manage', N'Quản lý bộ sưu tập', N'marketing', N'Bộ sưu tập SP'),
    (N'lookbook.manage', N'Quản lý lookbook', N'marketing', N'Lookbook'),
    (N'coupons.manage', N'Quản lý mã giảm giá', N'marketing', N'Coupon'),
    (N'promotions.manage', N'Quản lý khuyến mãi', N'marketing', N'Chương trình KM'),
    (N'flash_sales.manage', N'Quản lý flash sale', N'marketing', N'Flash sale'),
    (N'homepage.manage', N'Quản lý trang chủ', N'marketing', N'Section trang chủ'),
    (N'pages.manage', N'Quản lý trang tĩnh', N'marketing', N'Trang nội dung'),
    (N'menus.manage', N'Quản lý menu', N'marketing', N'Menu điều hướng'),
    -- Reviews
    (N'reviews.view', N'Xem đánh giá', N'reviews', N'Xem review SP'),
    (N'reviews.moderate', N'Duyệt đánh giá', N'reviews', N'Duyệt/từ chối review'),
    -- Attributes
    (N'attributes.manage', N'Quản lý thuộc tính', N'attributes', N'Size, màu, chất liệu'),
    -- Settings
    (N'settings.view', N'Xem cài đặt', N'settings', N'Cài đặt cửa hàng'),
    (N'settings.manage', N'Quản lý cài đặt', N'settings', N'Thay đổi cài đặt'),
    -- Staff
    (N'staff.view', N'Xem nhân viên', N'staff', N'Xem danh sách NV'),
    (N'staff.manage', N'Quản lý nhân viên', N'staff', N'Thêm/sửa/xóa NV'),
    -- Roles
    (N'roles.manage', N'Quản lý vai trò', N'staff', N'Cấu hình quyền cho vai trò'),
    -- Support (chat/live chat)
    (N'chat.view', N'Xem hội thoại hỗ trợ', N'support', N'Xem inbox và lịch sử chat'),
    (N'chat.reply', N'Trả lời hội thoại', N'support', N'Nhận phiên và trả lời khách'),
    (N'chat.manage', N'Quản lý hội thoại', N'support', N'Gán/đóng/quản lý phiên chat');

    PRINT 'Seeded QuyenHan';
END
GO

-- Seed các vai trò mặc định
IF (SELECT COUNT(*) FROM VaiTro) = 0
BEGIN
    INSERT INTO VaiTro (MaVaiTro, TenVaiTro, MoTa, LaMacDinh) VALUES
    (N'admin', N'Quản trị viên', N'Toàn quyền hệ thống', 1),
    (N'warehouse_manager', N'Quản lý kho', N'Quản lý kho hàng + nhập xuất', 1),
    (N'sales_staff', N'Nhân viên bán hàng', N'Xử lý đơn hàng + chăm khách', 1),
    (N'marketing_staff', N'Nhân viên marketing', N'Banner, khuyến mãi, lookbook', 1);
    PRINT 'Seeded VaiTro';
END
GO

-- Liên kết Role × Permission
IF (SELECT COUNT(*) FROM VaiTro_QuyenHan) = 0
BEGIN
    DECLARE @AdminId INT = (SELECT Id FROM VaiTro WHERE MaVaiTro = 'admin');
    DECLARE @WarehouseId INT = (SELECT Id FROM VaiTro WHERE MaVaiTro = 'warehouse_manager');
    DECLARE @SalesId INT = (SELECT Id FROM VaiTro WHERE MaVaiTro = 'sales_staff');
    DECLARE @MarketingId INT = (SELECT Id FROM VaiTro WHERE MaVaiTro = 'marketing_staff');

    -- Admin: tất cả quyền
    INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId)
    SELECT @AdminId, Id FROM QuyenHan;

    -- Quản lý kho
    INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId)
    SELECT @WarehouseId, Id FROM QuyenHan
    WHERE MaQuyen IN (
        N'dashboard.view',
        N'products.view',
        N'inventory.view', N'inventory.manage', N'inventory.history',
        N'suppliers.view', N'suppliers.manage',
        N'stock_receipts.view', N'stock_receipts.create', N'stock_receipts.cancel',
        N'reports.view'
    );

    -- NV bán hàng
    INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId)
    SELECT @SalesId, Id FROM QuyenHan
    WHERE MaQuyen IN (
        N'dashboard.view',
        N'orders.view', N'orders.update_status', N'orders.cancel',
        N'customers.view', N'customers.manage',
        N'products.view',
        N'reviews.view', N'reviews.moderate',
        N'chat.view', N'chat.reply',
        N'reports.view'
    );

    -- Marketing
    INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId)
    SELECT @MarketingId, Id FROM QuyenHan
    WHERE MaQuyen IN (
        N'dashboard.view',
        N'banners.manage', N'collections.manage', N'lookbook.manage',
        N'coupons.manage', N'promotions.manage', N'flash_sales.manage',
        N'homepage.manage', N'pages.manage', N'menus.manage',
        N'products.view',
        N'reports.view'
    );

    PRINT 'Seeded VaiTro_QuyenHan';
END
GO

-- Tạo tài khoản Admin mặc định nếu chưa có NV nào
IF (SELECT COUNT(*) FROM NhanVien) = 0
BEGIN
    DECLARE @AdminRoleId INT = (SELECT Id FROM VaiTro WHERE MaVaiTro = 'admin');

    -- Hash của "Admin@123" (BCrypt sẽ generate ở backend, đây tạm dùng plain để admin đổi sau)
    -- Cách đơn giản: tạo user với mật khẩu rỗng, force admin tạo qua /api/staff trước
    INSERT INTO NhanVien (Email, MatKhauHash, HoTen, VaiTroId, LaSuperAdmin, TrangThai, NgayVaoLam)
    VALUES (
        N'admin@kaitokid.vn',
        N'$2a$11$rPlaceholderHashWillBeReplacedAtFirstStartup',
        N'Quản trị viên',
        @AdminRoleId,
        1,
        1,
        GETUTCDATE()
    );
    PRINT 'Created default admin@kaitokid.vn (cần đổi mật khẩu qua API)';
END
GO

PRINT 'Staff & RBAC schema setup completed.';
