using Microsoft.AspNetCore.Builder;
using Shared.Middleware;

namespace Shared.Extensions;

/// <summary>
/// Extension methods để đăng ký middleware dễ dàng trong Program.cs
/// </summary>
public static class MiddlewareExtensions
{
    /// <summary>
    /// Thêm global exception handler
    /// </summary>
    public static IApplicationBuilder UseGlobalExceptionHandler(this IApplicationBuilder app)
    {
        return app.UseMiddleware<ExceptionMiddleware>();
    }

    /// <summary>
    /// Thêm request logging (thời gian xử lý)
    /// </summary>
    public static IApplicationBuilder UseRequestLogging(this IApplicationBuilder app)
    {
        return app.UseMiddleware<RequestLoggingMiddleware>();
    }
}
