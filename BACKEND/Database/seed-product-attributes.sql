USE [KaitoKid];
GO

-- ================================================================
-- Seed dữ liệu core cho ThuocTinhSanPham
-- Có thể chạy nhiều lần, chỉ thêm cặp Tên + Giá trị còn thiếu.
-- ================================================================

DECLARE @Seed TABLE (
    TenThuocTinh NVARCHAR(100) NOT NULL,
    GiaTri NVARCHAR(200) NOT NULL,
    NhomThuocTinh NVARCHAR(100) NULL,
    ThuTu INT NOT NULL
);

INSERT INTO @Seed (TenThuocTinh, GiaTri, NhomThuocTinh, ThuTu)
VALUES
    (N'Chất liệu', N'Cotton',      N'material', 0),
    (N'Chất liệu', N'Linen',       N'material', 1),
    (N'Chất liệu', N'Denim',       N'material', 2),
    (N'Chất liệu', N'Polyester',   N'material', 3),
    (N'Chất liệu', N'Wool blend',  N'material', 4),

    (N'Form dáng', N'Slim fit',     N'select', 0),
    (N'Form dáng', N'Regular fit',  N'select', 1),
    (N'Form dáng', N'Relaxed fit',  N'select', 2),
    (N'Form dáng', N'Oversized',    N'select', 3),

    (N'Màu sắc', N'Đen',       N'color', 0),
    (N'Màu sắc', N'Trắng',     N'color', 1),
    (N'Màu sắc', N'Xám',       N'color', 2),
    (N'Màu sắc', N'Be',        N'color', 3),
    (N'Màu sắc', N'Xanh navy', N'color', 4),
    (N'Màu sắc', N'Đỏ',        N'color', 5),

    (N'Size', N'XS',  N'size', 0),
    (N'Size', N'S',   N'size', 1),
    (N'Size', N'M',   N'size', 2),
    (N'Size', N'L',   N'size', 3),
    (N'Size', N'XL',  N'size', 4),
    (N'Size', N'XXL', N'size', 5);

INSERT INTO dbo.ThuocTinhSanPham (TenThuocTinh, GiaTri, NhomThuocTinh, ThuTu, NgayTao)
SELECT s.TenThuocTinh, s.GiaTri, s.NhomThuocTinh, s.ThuTu, SYSUTCDATETIME()
FROM @Seed s
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.ThuocTinhSanPham t
    WHERE t.TenThuocTinh = s.TenThuocTinh
      AND t.GiaTri = s.GiaTri
);

PRINT N'Đã đồng bộ dữ liệu core cho ThuocTinhSanPham.';
GO

SELECT
    TenThuocTinh,
    NhomThuocTinh,
    COUNT(*) AS SoGiaTri
FROM dbo.ThuocTinhSanPham
GROUP BY TenThuocTinh, NhomThuocTinh
ORDER BY TenThuocTinh;
GO
