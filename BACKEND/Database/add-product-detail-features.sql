-- Bảng kích cỡ chuẩn theo nhóm sản phẩm (áo/quần/đầm/váy/giày...)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BangSize')
BEGIN
    CREATE TABLE BangSize (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Loai NVARCHAR(50) NOT NULL,         -- 'top' | 'bottom' | 'dress' | 'shoes' | 'kids'
        DanhMuc NVARCHAR(100) NULL,         -- optional category name
        TenSize NVARCHAR(20) NOT NULL,      -- S, M, L, XL, 38, 39...
        Vai INT NULL,                       -- vai (cm)
        Nguc INT NULL,                      -- ngực
        Eo INT NULL,                        -- eo
        Hong INT NULL,                      -- hông
        DaiAo INT NULL,                     -- dài áo
        DaiQuan INT NULL,                   -- dài quần
        ChieuCao NVARCHAR(50) NULL,         -- vd "1m60 - 1m65"
        CanNang NVARCHAR(50) NULL,          -- vd "50-55kg"
        ThuTu INT NOT NULL DEFAULT 0,
        TrangThai BIT NOT NULL DEFAULT 1,
        NgayTao DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_BangSize_Loai ON BangSize(Loai);
END

-- Bảng Q&A: khách hỏi, admin trả lời
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CauHoiSanPham')
BEGIN
    CREATE TABLE CauHoiSanPham (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SanPhamId INT NOT NULL,
        NguoiHoiId INT NULL,                -- null nếu guest
        TenNguoiHoi NVARCHAR(100) NULL,
        CauHoi NVARCHAR(1000) NOT NULL,
        TraLoi NVARCHAR(2000) NULL,
        NguoiTraLoi NVARCHAR(100) NULL,     -- "Shop KaitoKid"
        TrangThai NVARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | answered | hidden
        LuotHuuIch INT NOT NULL DEFAULT 0,
        NgayHoi DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        NgayTraLoi DATETIME2 NULL
    );
    CREATE INDEX IX_QA_SanPhamId ON CauHoiSanPham(SanPhamId);
END

-- Thêm video URL cho sản phẩm (để hiển thị trong gallery)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SanPham') AND name = 'VideoUrl')
    ALTER TABLE SanPham ADD VideoUrl NVARCHAR(500) NULL;

-- Bảng phiên xem sản phẩm để đếm "X người đang xem" thật
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PhienXemSanPham')
BEGIN
    CREATE TABLE PhienXemSanPham (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SanPhamId INT NOT NULL,
        SessionId NVARCHAR(100) NOT NULL,
        Ip NVARCHAR(50) NULL,
        LastSeenAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_PhienXem_SP_Session ON PhienXemSanPham(SanPhamId, SessionId);
    CREATE INDEX IX_PhienXem_LastSeen ON PhienXemSanPham(LastSeenAt);
END
