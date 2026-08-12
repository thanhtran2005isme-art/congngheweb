SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Referral feature: lưu mã giới thiệu của mỗi user + bảng đối soát.
-- Idempotent: chạy nhiều lần OK.

IF COL_LENGTH('NguoiDung', 'MaGioiThieu') IS NULL
    ALTER TABLE NguoiDung ADD MaGioiThieu NVARCHAR(20) NULL;
GO

-- Unique index khi MaGioiThieu khác null
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_NguoiDung_MaGioiThieu')
BEGIN
    CREATE UNIQUE INDEX UX_NguoiDung_MaGioiThieu
        ON NguoiDung(MaGioiThieu)
        WHERE MaGioiThieu IS NOT NULL;
END
GO

-- Bảng tracking lượt giới thiệu
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GioiThieu')
BEGIN
    CREATE TABLE GioiThieu (
        Id            INT IDENTITY PRIMARY KEY,
        NguoiMoiId    INT NOT NULL,
        NguoiGioiThieuId INT NOT NULL,
        MaCouponMoi   NVARCHAR(50) NULL,
        MaCouponGT    NVARCHAR(50) NULL,
        TrangThai     NVARCHAR(20) NOT NULL DEFAULT 'pending',
        NgayTao       DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        NgayThuong    DATETIME NULL,
        CONSTRAINT FK_GioiThieu_NguoiMoi FOREIGN KEY (NguoiMoiId) REFERENCES NguoiDung(Id),
        CONSTRAINT FK_GioiThieu_NguoiGT FOREIGN KEY (NguoiGioiThieuId) REFERENCES NguoiDung(Id)
    );
    CREATE INDEX IX_GioiThieu_NguoiGT ON GioiThieu(NguoiGioiThieuId, TrangThai);
END
GO
