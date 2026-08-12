IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'MaVanDon')
    ALTER TABLE DonHang ADD MaVanDon NVARCHAR(100) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'LinkTracking')
    ALTER TABLE DonHang ADD LinkTracking NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'TrangThaiVanChuyen')
    ALTER TABLE DonHang ADD TrangThaiVanChuyen NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'NhaVanChuyen')
    ALTER TABLE DonHang ADD NhaVanChuyen NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'MaDichVuVanChuyen')
    ALTER TABLE DonHang ADD MaDichVuVanChuyen NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DonHang') AND name = 'ThoiGianGiaoDuKien')
    ALTER TABLE DonHang ADD ThoiGianGiaoDuKien INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LichSuTrangThaiVanChuyen')
BEGIN
    CREATE TABLE LichSuTrangThaiVanChuyen (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DonHangId INT NOT NULL,
        TrangThai NVARCHAR(50) NOT NULL,
        MoTa NVARCHAR(500) NULL,
        ViTri NVARCHAR(200) NULL,
        ThoiGian DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_LSTTVC_DonHang FOREIGN KEY (DonHangId) REFERENCES DonHang(Id)
    );
    CREATE INDEX IX_LSTTVC_DonHangId ON LichSuTrangThaiVanChuyen(DonHangId);
END
