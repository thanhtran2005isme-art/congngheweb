IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'DiemThuong')
    ALTER TABLE NguoiDung ADD DiemThuong INT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'CapBac')
    ALTER TABLE NguoiDung ADD CapBac NVARCHAR(20) NOT NULL DEFAULT N'Member';
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'TongChiTieu')
    ALTER TABLE NguoiDung ADD TongChiTieu DECIMAL(18,0) NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'NgaySinh')
    ALTER TABLE NguoiDung ADD NgaySinh DATE NULL;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LichSuDiem')
BEGIN
    CREATE TABLE LichSuDiem (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        NguoiDungId INT NOT NULL,
        LoaiGiaoDich NVARCHAR(20) NOT NULL,  -- earn | redeem | expire | bonus
        SoDiem INT NOT NULL,                 -- dương = nhận, âm = dùng
        SoDuSauGiaoDich INT NOT NULL,
        DonHangId INT NULL,
        MoTa NVARCHAR(500) NULL,
        NgayTao DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_LichSuDiem_NguoiDung FOREIGN KEY (NguoiDungId) REFERENCES NguoiDung(Id)
    );
    CREATE INDEX IX_LichSuDiem_NguoiDungId ON LichSuDiem(NguoiDungId);
END
