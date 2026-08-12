using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Load cấu hình Ocelot
builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);

// CORS cho React frontend (Vite dev server + Production domain)
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

// Đăng ký Ocelot
builder.Services.AddOcelot(builder.Configuration);

var app = builder.Build();

app.UseCors("AllowFrontend");

// Health check endpoint cho Gateway
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "API.Gateway",
    timestamp = DateTime.UtcNow
}));

// Ocelot middleware — điều hướng request đến downstream services
await app.UseOcelot();

app.Run();
