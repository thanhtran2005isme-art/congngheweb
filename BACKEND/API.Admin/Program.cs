using API.Admin.Data;
using DbHelper;
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
