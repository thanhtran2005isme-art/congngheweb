using Ocelot.DependencyInjection;
using Ocelot.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Load cấu hình Ocelot
builder.Configuration.AddJsonFile("ocelot.json", optional: false, reloadOnChange: true);

// Route hậu mãi mới. Frontend local luôn đi qua Gateway :5155, trong khi
// OrderReturnsController thuộc API.Customer :5265. Bổ sung route tại runtime
// để tương thích ngay với ocelot.json hiện tại mà không làm thay đổi các route cũ.
// Dùng index cao để không đụng các route đã có trong file cấu hình.
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Routes:990:UpstreamPathTemplate"] = "/api/order-returns/{everything}",
    ["Routes:990:UpstreamHttpMethod:0"] = "GET",
    ["Routes:990:UpstreamHttpMethod:1"] = "POST",
    ["Routes:990:UpstreamHttpMethod:2"] = "DELETE",
    ["Routes:990:UpstreamHttpMethod:3"] = "OPTIONS",
    ["Routes:990:DownstreamPathTemplate"] = "/api/order-returns/{everything}",
    ["Routes:990:DownstreamScheme"] = "http",
    ["Routes:990:DownstreamHostAndPorts:0:Host"] = "localhost",
    ["Routes:990:DownstreamHostAndPorts:0:Port"] = "5265",

    ["Routes:991:UpstreamPathTemplate"] = "/api/order-returns",
    ["Routes:991:UpstreamHttpMethod:0"] = "GET",
    ["Routes:991:UpstreamHttpMethod:1"] = "POST",
    ["Routes:991:UpstreamHttpMethod:2"] = "DELETE",
    ["Routes:991:UpstreamHttpMethod:3"] = "OPTIONS",
    ["Routes:991:DownstreamPathTemplate"] = "/api/order-returns",
    ["Routes:991:DownstreamScheme"] = "http",
    ["Routes:991:DownstreamHostAndPorts:0:Host"] = "localhost",
    ["Routes:991:DownstreamHostAndPorts:0:Port"] = "5265",
});

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
