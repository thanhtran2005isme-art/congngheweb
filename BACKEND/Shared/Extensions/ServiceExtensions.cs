using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Shared.Constants;

namespace Shared.Extensions;

/// <summary>
/// Extension methods dùng chung cho tất cả services — tránh duplicate code trong Program.cs
/// </summary>
public static class ServiceExtensions
{
    /// <summary>
    /// Cấu hình JWT Authentication chuẩn — dùng chung cho Auth, Customer, Admin
    /// </summary>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration config)
    {
        var key = config["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is missing in configuration");
        var issuer = config["Jwt:Issuer"] ?? AppConstants.DefaultJwtIssuer;
        var audience = config["Jwt:Audience"] ?? AppConstants.DefaultJwtAudience;

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = issuer,
                ValidAudience = audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                ClockSkew = TimeSpan.FromMinutes(1)
            };
        });

        return services;
    }

    /// <summary>
    /// Cấu hình CORS cho React frontend
    /// </summary>
    public static IServiceCollection AddFrontendCors(this IServiceCollection services, string policyName = "AllowFrontend")
    {
        services.AddCors(options =>
        {
            options.AddPolicy(policyName, policy =>
            {
                policy.WithOrigins(
                        "http://localhost:5173",
                        "http://localhost:5174",
                        "http://localhost:3000"
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        return services;
    }
}
// v1.1: Bo sung cau hinh CORS cho React frontend
