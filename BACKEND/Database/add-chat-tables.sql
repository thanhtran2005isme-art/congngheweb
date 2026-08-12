-- ================================================================
-- Tính năng: Live chat + Chatbot hỗ trợ khách hàng
-- Tạo 2 bảng: CuocHoiThoai (phiên) + TinNhan (tin nhắn) — idempotent
-- Khớp với model EF Core API.Customer (Conversation / ChatMessage)
-- Chạy: sqlcmd -S localhost -d KaitoKid -E -C -i add-chat-tables.sql
-- ================================================================
USE KaitoKid;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CuocHoiThoai')
BEGIN
    CREATE TABLE CuocHoiThoai (
        Id                  INT IDENTITY(1,1)   PRIMARY KEY,
        NguoiDungId         INT                 NULL,                   -- NULL nếu khách vãng lai
        MaKhachVangLai      NVARCHAR(64)        NULL,                   -- Định danh guest (localStorage)
        TenHienThi          NVARCHAR(100)       NULL,                   -- Tên khách (nếu có)
        TrangThai           NVARCHAR(20)        NOT NULL DEFAULT 'bot', -- bot / waiting / agent / closed
        NhanVienId          INT                 NULL,                   -- Nhân viên đang xử lý
        SanPhamNguCanhId    INT                 NULL,                   -- Sản phẩm khách đang xem khi mở chat
        TinNhanCuoi         NVARCHAR(500)       NULL,                   -- Preview tin cuối cho inbox
        ThoiGianTinCuoi     DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
        SoTinChuaDocKhach   INT                 NOT NULL DEFAULT 0,
        SoTinChuaDocNV      INT                 NOT NULL DEFAULT 0,
        NgayTao             DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
        NgayCapNhat         DATETIME2           NULL
    );
    CREATE NONCLUSTERED INDEX IX_CuocHoiThoai_TrangThai_ThoiGianTinCuoi ON CuocHoiThoai(TrangThai, ThoiGianTinCuoi);
    CREATE NONCLUSTERED INDEX IX_CuocHoiThoai_NguoiDungId ON CuocHoiThoai(NguoiDungId);
    CREATE NONCLUSTERED INDEX IX_CuocHoiThoai_MaKhachVangLai ON CuocHoiThoai(MaKhachVangLai);
    PRINT 'Created CuocHoiThoai';
END
ELSE PRINT 'CuocHoiThoai already exists';
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TinNhan')
BEGIN
    CREATE TABLE TinNhan (
        Id              INT IDENTITY(1,1)   PRIMARY KEY,
        CuocHoiThoaiId  INT                 NOT NULL,               -- Thuộc phiên nào
        LoaiNguoiGui    NVARCHAR(20)        NOT NULL,               -- customer / bot / agent
        NguoiGuiId      INT                 NULL,                   -- userId hoặc staffId; NULL cho bot/guest
        NoiDung         NVARCHAR(MAX)       NOT NULL,
        LoaiDinhKem     NVARCHAR(20)        NULL,                   -- product / order / NULL
        DinhKemId       NVARCHAR(50)        NULL,
        DinhKemJson     NVARCHAR(MAX)       NULL,
        DaDoc           BIT                 NOT NULL DEFAULT 0,
        NgayTao         DATETIME2           NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TinNhan_CuocHoiThoai FOREIGN KEY (CuocHoiThoaiId)
            REFERENCES CuocHoiThoai(Id) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX IX_TinNhan_CuocHoiThoaiId ON TinNhan(CuocHoiThoaiId, Id);
    PRINT 'Created TinNhan';
END
ELSE PRINT 'TinNhan already exists';
GO
