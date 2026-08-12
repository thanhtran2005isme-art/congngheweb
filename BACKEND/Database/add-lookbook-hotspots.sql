-- Mở rộng bảng Lookbook + thêm bảng LookbookHotspot
-- Chạy 1 lần trên DB. Idempotent.

-- 1) Cột video / season / style cho Lookbook
IF COL_LENGTH('Lookbook', 'VideoUrl') IS NULL
    ALTER TABLE Lookbook ADD VideoUrl NVARCHAR(500) NULL;

IF COL_LENGTH('Lookbook', 'Season') IS NULL
    ALTER TABLE Lookbook ADD Season NVARCHAR(50) NULL;

IF COL_LENGTH('Lookbook', 'Style') IS NULL
    ALTER TABLE Lookbook ADD Style NVARCHAR(80) NULL;

-- 2) Bảng LookbookHotspot: pin sản phẩm trên ảnh
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LookbookHotspot')
BEGIN
    CREATE TABLE LookbookHotspot (
        Id          INT IDENTITY PRIMARY KEY,
        LookbookId  INT NOT NULL,
        SanPhamId   INT NOT NULL,
        ToaDoX      DECIMAL(5,2) NOT NULL,  -- 0..100 (%)
        ToaDoY      DECIMAL(5,2) NOT NULL,  -- 0..100 (%)
        GhiChu      NVARCHAR(255) NULL,
        ThuTu       INT NOT NULL DEFAULT 0,
        NgayTao     DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        CONSTRAINT FK_LookbookHotspot_Lookbook FOREIGN KEY (LookbookId)
            REFERENCES Lookbook(Id) ON DELETE CASCADE,
        CONSTRAINT FK_LookbookHotspot_SanPham FOREIGN KEY (SanPhamId)
            REFERENCES SanPham(Id)
    );
    CREATE INDEX IX_LookbookHotspot_Lookbook ON LookbookHotspot(LookbookId);
END
GO
