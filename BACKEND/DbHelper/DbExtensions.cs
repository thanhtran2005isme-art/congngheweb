using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DbHelper;

/// <summary>
/// Extension methods de dang ky DbContext trong Program.cs
/// </summary>
public static class DbExtensions
{
    /// <summary>
    /// Dang ky DbContext voi SQL Server + AuditInterceptor
    /// Usage: builder.Services.AddSqlServerDb&lt;MyDbContext&gt;(config);
    /// </summary>
    public static IServiceCollection AddSqlServerDb<TContext>(
        this IServiceCollection services,
        IConfiguration config,
        string connectionStringName = "DefaultConnection")
        where TContext : DbContext
    {
        var connectionString = config.GetConnectionString(connectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{connectionStringName}' not found");

        services.AddDbContext<TContext>(options =>
        {
            options.UseSqlServer(connectionString);
            options.AddInterceptors(new AuditInterceptor());
        });

        return services;
    }
}
