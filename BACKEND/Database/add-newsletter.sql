IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DangKyNewsletter')
BEGIN
    CREATE TABLE DangKyNewsletter (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL,
        Source NVARCHAR(50) NULL,            -- homepage | popup | footer
        VoucherCode NVARCHAR(100) NULL,      -- mã voucher đã cấp
        Ip NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        SubscribedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UnsubscribedAt DATETIME2 NULL
    );
    CREATE UNIQUE INDEX IX_Newsletter_Email ON DangKyNewsletter(Email);
END

-- Banner column SubTitle nếu chưa có (để map vào hero slides)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Banner') AND name = 'NutChinh')
    ALTER TABLE Banner ADD NutChinh NVARCHAR(100) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Banner') AND name = 'NutPhu')
    ALTER TABLE Banner ADD NutPhu NVARCHAR(100) NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Banner') AND name = 'LinkPhu')
    ALTER TABLE Banner ADD LinkPhu NVARCHAR(500) NULL;
