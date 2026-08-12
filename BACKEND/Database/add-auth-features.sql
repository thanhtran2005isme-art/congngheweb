-- Bảng token đặt lại mật khẩu (sống 30 phút)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PasswordResetToken')
BEGIN
    CREATE TABLE PasswordResetToken (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        Token NVARCHAR(200) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        UsedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_PRT_NguoiDung FOREIGN KEY (UserId) REFERENCES NguoiDung(Id)
    );
    CREATE UNIQUE INDEX IX_PRT_Token ON PasswordResetToken(Token);
    CREATE INDEX IX_PRT_UserId ON PasswordResetToken(UserId);
END

-- Bảng OTP xác thực email/phone khi đăng ký
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OtpCode')
BEGIN
    CREATE TABLE OtpCode (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Identifier NVARCHAR(255) NOT NULL,    -- email hoặc phone
        Channel NVARCHAR(20) NOT NULL,        -- email | sms
        Purpose NVARCHAR(30) NOT NULL,        -- register | reset_password | verify_phone
        Code NVARCHAR(10) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        VerifiedAt DATETIME2 NULL,
        AttemptCount INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_OtpCode_Identifier ON OtpCode(Identifier, Purpose);
END

-- Mở rộng NguoiDung: email_verified, phone_verified, provider, provider_id (Google), avatar
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'EmailDaXacThuc')
    ALTER TABLE NguoiDung ADD EmailDaXacThuc BIT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'SDTDaXacThuc')
    ALTER TABLE NguoiDung ADD SDTDaXacThuc BIT NOT NULL DEFAULT 0;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'NhaCungCap')
    ALTER TABLE NguoiDung ADD NhaCungCap NVARCHAR(20) NULL;     -- 'local' | 'google' | 'facebook'
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('NguoiDung') AND name = 'MaNhaCungCap')
    ALTER TABLE NguoiDung ADD MaNhaCungCap NVARCHAR(255) NULL;

-- AuthDbContext còn dùng bảng Users (cùng table NguoiDung) nên cần đảm bảo column tồn tại
