-- Cột "đang giữ" trong tồn kho biến thể
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TonKhoBienThe') AND name = 'SoLuongDaGiu')
    ALTER TABLE TonKhoBienThe ADD SoLuongDaGiu INT NOT NULL DEFAULT 0;

-- Cột giữ stock cho SanPham gốc (cho các SP chưa có variant)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SanPham') AND name = 'SoLuongDaGiu')
    ALTER TABLE SanPham ADD SoLuongDaGiu INT NOT NULL DEFAULT 0;

-- Cột thời điểm reserve cho từng item giỏ hàng
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('GioHang') AND name = 'GiuDenLuc')
    ALTER TABLE GioHang ADD GiuDenLuc DATETIME2 NULL;
