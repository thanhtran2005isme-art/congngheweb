-- 2FA columns
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'TwoFactorEnabled')
    ALTER TABLE NguoiDung ADD TwoFactorEnabled BIT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'TwoFactorSecret')
    ALTER TABLE NguoiDung ADD TwoFactorSecret NVARCHAR(100) NULL;

-- Lockout columns
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'SoLanDangNhapSai')
    ALTER TABLE NguoiDung ADD SoLanDangNhapSai INT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'BiKhoaDenLuc')
    ALTER TABLE NguoiDung ADD BiKhoaDenLuc DATETIME2 NULL;

-- Activity log
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LoginActivity')
BEGIN
    CREATE TABLE LoginActivity (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NULL,
        Email NVARCHAR(255) NOT NULL,
        Provider NVARCHAR(20) NOT NULL DEFAULT 'local',  -- local | google | facebook
        Ip NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        DeviceType NVARCHAR(30) NULL,
        Browser NVARCHAR(50) NULL,
        Os NVARCHAR(50) NULL,
        Country NVARCHAR(50) NULL,
        Success BIT NOT NULL,
        FailReason NVARCHAR(200) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_LoginActivity_UserId ON LoginActivity(UserId);
    CREATE INDEX IX_LoginActivity_Email ON LoginActivity(Email);
END

-- Email verification token (link kiểu OTP nhưng dạng URL)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmailVerificationToken')
BEGIN
    CREATE TABLE EmailVerificationToken (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        Token NVARCHAR(200) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        VerifiedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX IX_EVT_Token ON EmailVerificationToken(Token);
END
