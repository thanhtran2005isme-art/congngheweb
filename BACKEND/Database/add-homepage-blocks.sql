-- Bảng HomepageBlock: lưu các block động trên trang chủ.
-- BlockType: 'hero' | 'categoryTile' | 'brandValue' | 'socialImage'
-- Idempotent.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HomepageBlock')
BEGIN
    CREATE TABLE HomepageBlock (
        Id          INT IDENTITY PRIMARY KEY,
        BlockType   NVARCHAR(40)  NOT NULL,    -- hero | categoryTile | brandValue | socialImage
        TieuDe      NVARCHAR(200) NULL,
        TieuDePhu   NVARCHAR(200) NULL,
        MoTa        NVARCHAR(500) NULL,
        HinhAnh     NVARCHAR(500) NULL,
        LienKet     NVARCHAR(500) NULL,
        Icon        NVARCHAR(80)  NULL,        -- icon key cho brandValue
        ThuTu       INT NOT NULL DEFAULT 0,
        TrangThai   BIT NOT NULL DEFAULT 1,
        NgayTao     DATETIME NOT NULL DEFAULT (GETUTCDATE()),
        NgayCapNhat DATETIME NULL
    );
    CREATE INDEX IX_HomepageBlock_Type ON HomepageBlock(BlockType, TrangThai, ThuTu);
END
GO

-- Seed dữ liệu mặc định nếu chưa có (giữ tương đương hardcode trên FE).
IF NOT EXISTS (SELECT 1 FROM HomepageBlock WHERE BlockType='categoryTile')
BEGIN
    INSERT INTO HomepageBlock (BlockType, TieuDe, TieuDePhu, HinhAnh, LienKet, ThuTu) VALUES
        ('categoryTile', N'Thời trang nữ',  N'Bộ sưu tập mới',     '/images/slide_1.jpg', '/women', 1),
        ('categoryTile', N'Thời trang nam', N'Phong cách hiện đại', '/images/slide_2.jpg', '/men',   2),
        ('categoryTile', N'Trẻ em',         N'Đáng yêu, thoải mái', '/images/slide_3.jpg', '/kids',  3),
        ('categoryTile', N'Khuyến mãi',     N'Săn deal hot',         '/images/slide_4.jpg', '/sale',  4);
END
GO

IF NOT EXISTS (SELECT 1 FROM HomepageBlock WHERE BlockType='brandValue')
BEGIN
    INSERT INTO HomepageBlock (BlockType, TieuDe, MoTa, Icon, ThuTu) VALUES
        ('brandValue', N'Freeship đơn 499K', N'Miễn phí vận chuyển toàn quốc',         'truck',     1),
        ('brandValue', N'Đổi trả 7 ngày',    N'Đổi trả miễn phí trong 7 ngày',         'refresh',   2),
        ('brandValue', N'Hàng chính hãng',   N'Cam kết chất lượng, bảo hành dài hạn',  'shield',    3);
END
GO
