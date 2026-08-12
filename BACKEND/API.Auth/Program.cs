using API.Auth.Data;
using API.Auth.Services;
using DbHelper;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSqlServerDb<AuthDbContext>(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:3000",
                "http://127.0.0.1:5173",
                "https://kaitokid.io.vn",
                "https://www.kaitokid.io.vn"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Core auth
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IStaffAuthService, StaffAuthService>();

// Email: ConsoleEmailService nếu Brevo:ApiKey rỗng → mock log ra console
var brevoKey = builder.Configuration["Email:Brevo:ApiKey"];
if (!string.IsNullOrWhiteSpace(brevoKey))
{
    builder.Services.AddHttpClient<IEmailService, BrevoEmailService>();
}
else
{
    builder.Services.AddScoped<IEmailService, ConsoleEmailService>();
}

builder.Services.AddScoped<IOtpService, OtpService>();
builder.Services.AddHttpClient<IRecaptchaService, RecaptchaService>();
builder.Services.AddHttpClient<IGoogleAuthService, GoogleAuthService>();
builder.Services.AddHttpClient<IFacebookAuthService, FacebookAuthService>();
builder.Services.AddSingleton<ITwoFactorService, TwoFactorService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ILoginActivityService, LoginActivityService>();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment()) app.MapOpenApi();

app.UseCors("AllowFrontend");
app.UseRequestLogging();
app.UseGlobalExceptionHandler();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("=== AUTH SERVICE ===");
logger.LogInformation(" Email backend  : {B}", string.IsNullOrWhiteSpace(brevoKey) ? "CONSOLE (mock)" : "BREVO");
logger.LogInformation(" Recaptcha      : {R}", string.IsNullOrWhiteSpace(app.Configuration["Recaptcha:SecretKey"]) ? "DISABLED" : "ENABLED");
logger.LogInformation(" Google OAuth   : {G}", string.IsNullOrWhiteSpace(app.Configuration["Google:ClientId"]) ? "DISABLED" : "ENABLED");
logger.LogInformation(" Require OTP    : {O}", app.Configuration["Auth:RequireOtpForRegister"] ?? "false");
logger.LogInformation(" Reset URL      : {U}", app.Configuration["Auth:ResetPasswordUrl"] ?? "(default)");

app.Run();
