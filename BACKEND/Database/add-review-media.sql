IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DanhGia') AND name = 'DanhSachAnh')
    ALTER TABLE DanhGia ADD DanhSachAnh NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DanhGia') AND name = 'Video')
    ALTER TABLE DanhGia ADD Video NVARCHAR(500) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DanhGia') AND name = 'KichCo')
    ALTER TABLE DanhGia ADD KichCo NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DanhGia') AND name = 'MauSac')
    ALTER TABLE DanhGia ADD MauSac NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DanhGia') AND name = 'NgayPhanHoi')
    ALTER TABLE DanhGia ADD NgayPhanHoi DATETIME2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DanhGia') AND name = 'LuotHuuIch')
    ALTER TABLE DanhGia ADD LuotHuuIch INT NOT NULL DEFAULT 0;
