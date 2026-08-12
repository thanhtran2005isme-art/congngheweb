-- ================================================================
--  CONSOLIDATE USER/STAFF — fix Lỗ hổng 4
--  Nguyên tắc: NguoiDung = CHỈ khách hàng. NhanVien = nhân viên/admin.
--
--  Trước đây schema gốc seed 1 admin vào NguoiDung (VaiTro='admin'),
--  trùng email với super admin trong NhanVien → 2 mô hình chồng lấn,
--  mơ hồ "admin" là ai. Sau khi siết RBAC, tài khoản admin trong
--  NguoiDung KHÔNG còn vào được API.Admin (không có permission claim)
--  → nó chỉ còn là bản trùng vô dụng cho mục đích quản trị.
--
--  Script này hạ tất cả NguoiDung.VaiTro='admin' về 'user' để NguoiDung
--  chỉ còn chứa khách hàng. An toàn & idempotent — chạy lại nhiều lần OK.
--  KHÔNG xoá dữ liệu (đề phòng tài khoản đó có đơn hàng / lịch sử).
--
--  Admin/nhân viên thật quản trị qua bảng NhanVien (add-staff-rbac.sql),
--  đăng nhập qua /api/auth/staff/login.
-- ================================================================
USE KaitoKid;
GO

-- 1) Báo cáo trước khi sửa
DECLARE @adminCount INT = (SELECT COUNT(*) FROM NguoiDung WHERE VaiTro = 'admin');
PRINT N'NguoiDung có VaiTro=admin trước khi consolidate: ' + CAST(@adminCount AS NVARCHAR(10));

-- 2) Cảnh báo nếu email admin trong NguoiDung KHÔNG tồn tại bên NhanVien
--    (tránh trường hợp demote xong không còn đường nào quản trị)
IF EXISTS (
    SELECT 1 FROM NguoiDung nd
    WHERE nd.VaiTro = 'admin'
      AND NOT EXISTS (SELECT 1 FROM NhanVien nv WHERE LOWER(nv.Email) = LOWER(nd.Email))
)
BEGIN
    PRINT N'⚠ CẢNH BÁO: Có admin trong NguoiDung chưa có tài khoản NhanVien tương ứng.';
    PRINT N'  → Hãy tạo NhanVien (admin/super admin) tương ứng TRƯỚC khi demote,';
    PRINT N'    nếu không bạn có thể mất đường truy cập quản trị.';
    -- Liệt kê các email cần xử lý
    SELECT nd.Id, nd.Email, nd.HoTen
    FROM NguoiDung nd
    WHERE nd.VaiTro = 'admin'
      AND NOT EXISTS (SELECT 1 FROM NhanVien nv WHERE LOWER(nv.Email) = LOWER(nd.Email));
END
GO

-- 3) Demote: chỉ hạ những admin ĐÃ có tài khoản NhanVien tương ứng (an toàn).
UPDATE nd
SET nd.VaiTro = 'user',
    nd.NgayCapNhat = GETUTCDATE()
FROM NguoiDung nd
WHERE nd.VaiTro = 'admin'
  AND EXISTS (SELECT 1 FROM NhanVien nv WHERE LOWER(nv.Email) = LOWER(nd.Email));
GO

DECLARE @remaining INT = (SELECT COUNT(*) FROM NguoiDung WHERE VaiTro = 'admin');
PRINT N'NguoiDung còn VaiTro=admin sau consolidate: ' + CAST(@remaining AS NVARCHAR(10));
PRINT N'(Số còn lại là admin CHƯA có NhanVien tương ứng — xử lý thủ công nếu cần.)';
GO

PRINT N'=== Consolidate user/staff hoàn tất ===';
GO
