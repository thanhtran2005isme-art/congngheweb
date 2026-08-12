using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Shared.Middleware;

/// <summary>
/// Log thời gian xử lý request — hữu ích cho debug performance
/// </summary>
public class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var method = context.Request.Method;
        var path = context.Request.Path;

        try
        {
            await next(context);
        }
        finally
        {
            stopwatch.Stop();
            var statusCode = context.Response.StatusCode;
            var elapsed = stopwatch.ElapsedMilliseconds;

            if (elapsed > 500)
                logger.LogWarning("{Method} {Path} → {StatusCode} ({Elapsed}ms) [SLOW]", method, path, statusCode, elapsed);
            else
                logger.LogInformation("{Method} {Path} → {StatusCode} ({Elapsed}ms)", method, path, statusCode, elapsed);
        }
    }
}
// v1.1: Them canh bao request cham > 500ms
