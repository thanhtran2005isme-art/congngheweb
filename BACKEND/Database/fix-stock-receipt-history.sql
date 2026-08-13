-- Fix lỗi tạo phiếu nhập kho 500
-- Nguyên nhân: API.Admin.Models.TonKhoLichSu có thuộc tính TenSanPham
-- nhưng schema KaitoKid cũ chưa có cột dbo.TonKho_LichSu.TenSanPham.
-- Script idempotent: có thể chạy nhiều lần.

USE [KaitoKid];
GO

IF OBJECT_ID(N'dbo.TonKho_LichSu', N'U') IS NULL
BEGIN
    THROW 50001, N'Không tìm thấy bảng dbo.TonKho_LichSu.', 1;
END
GO

IF COL_LENGTH(N'dbo.TonKho_LichSu', N'TenSanPham') IS NULL
BEGIN
    ALTER TABLE dbo.TonKho_LichSu
    ADD TenSanPham NVARCHAR(255) NOT NULL
        CONSTRAINT DF_TonKho_LichSu_TenSanPham DEFAULT N'' WITH VALUES;

    PRINT N'Đã thêm cột TonKho_LichSu.TenSanPham.';
END
ELSE
BEGIN
    PRINT N'Cột TonKho_LichSu.TenSanPham đã tồn tại.';
END
GO

UPDATE ls
SET ls.TenSanPham = sp.TenSanPham
FROM dbo.TonKho_LichSu AS ls
INNER JOIN dbo.SanPham AS sp ON sp.Id = ls.SanPhamId
WHERE NULLIF(LTRIM(RTRIM(ls.TenSanPham)), N'') IS NULL;
GO

SELECT TOP (20)
    Id,
    SanPhamId,
    TenSanPham,
    LoaiThayDoi,
    SoLuong,
    TonKhoTruoc,
    TonKhoSau,
    NgayTao
FROM dbo.TonKho_LichSu
ORDER BY Id DESC;
GO
