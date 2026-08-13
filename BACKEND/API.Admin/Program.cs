using API.Admin.Data;
using DbHelper;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);

// DbContext với AuditInterceptor từ DbHelper
builder.Services.AddSqlServerDb<AdminDbContext>(builder.Configuration);

// JWT Authentication từ Shared
builder.Services.AddJwtAuthentication(builder.Configuration);

// Permission-based authorization (RBAC granular) — thay cho Roles="admin" cứng
builder.Services.AddPermissionAuthorization();

// CORS cho React frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:3000",
                "https://kaitokid.io.vn",
                "https://www.kaitokid.io.vn"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Compatibility repair cho database được tạo từ KaitoKid_Database.sql cũ.
// Model TonKhoLichSu đã dùng TenSanPham nhưng schema cũ chưa có cột này,
// khiến tạo phiếu nhập/điều chỉnh kho lỗi 500 khi SaveChanges.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AdminDbContext>();
    await db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'dbo.TonKho_LichSu', N'U') IS NOT NULL
           AND COL_LENGTH(N'dbo.TonKho_LichSu', N'TenSanPham') IS NULL
        BEGIN
            ALTER TABLE dbo.TonKho_LichSu
            ADD TenSanPham NVARCHAR(255) NOT NULL
                CONSTRAINT DF_TonKho_LichSu_TenSanPham DEFAULT N'' WITH VALUES;

            UPDATE ls
            SET ls.TenSanPham = sp.TenSanPham
            FROM dbo.TonKho_LichSu AS ls
            INNER JOIN dbo.SanPham AS sp ON sp.Id = ls.SanPhamId;
        END
        """);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// CORS phải đặt trước Authentication
app.UseCors("AllowFrontend");

// Middleware từ Shared
app.UseRequestLogging();
app.UseGlobalExceptionHandler();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
