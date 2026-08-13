using API.Customer.Data;
using API.Customer.Services;
using API.Customer.Services.Shipping;
using DbHelper;
using Microsoft.EntityFrameworkCore;
using Shared.Authorization;
using Shared.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSqlServerDb<CustomerDbContext>(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);

// Permission-based authorization (RBAC granular) — dùng cho AdminShippingController
builder.Services.AddPermissionAuthorization();

// SignalR cho chat real-time. Cho phép đọc access_token từ query string khi kết nối hub
// (WebSocket không gửi được header Authorization) — chỉ áp dụng cho path /hubs.
builder.Services.Configure<Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions>(
    Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme,
    options =>
    {
        options.Events ??= new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents();
        options.Events.OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        };
    });

builder.Services.AddSignalR();

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

builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<ISearchService, SearchService>();

// ===== Tìm kiếm bằng hình ảnh (visual similarity với CLIP embedding qua ONNX) =====
builder.Services.Configure<API.Customer.Services.ImageSearch.ImageSearchOptions>(
    builder.Configuration.GetSection(API.Customer.Services.ImageSearch.ImageSearchOptions.SectionName));
// Embedder nạp model 1 lần → singleton. Store giữ vector in-memory → singleton.
builder.Services.AddSingleton<API.Customer.Services.ImageSearch.IImageEmbedder, API.Customer.Services.ImageSearch.OnnxClipImageEmbedder>();
builder.Services.AddSingleton<API.Customer.Services.ImageSearch.ImageEmbeddingStore>();
builder.Services.AddHttpClient<API.Customer.Services.ImageSearch.ProductImageFetcher>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddScoped<API.Customer.Services.ImageSearch.IImageSearchService, API.Customer.Services.ImageSearch.ImageSearchService>();
builder.Services.AddHostedService<API.Customer.Services.ImageSearch.ImageEmbeddingIndexer>();
builder.Services.AddScoped<ICartService, CartService>();
builder.Services.AddScoped<IComboDiscountService, ComboDiscountService>();
builder.Services.AddScoped<API.Customer.Services.Email.IEmailService, API.Customer.Services.Email.SmtpEmailService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IWishlistService, WishlistService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<IAddressService, AddressService>();
builder.Services.AddScoped<ICouponService, CouponService>();

// ===== Chat (live chat + chatbot) =====
// Các skill rule-based truy DB
builder.Services.AddScoped<API.Customer.Services.Bot.IChatSkill, API.Customer.Services.Bot.Skills.OrderLookupSkill>();
builder.Services.AddScoped<API.Customer.Services.Bot.IChatSkill, API.Customer.Services.Bot.Skills.StockCheckSkill>();
builder.Services.AddScoped<API.Customer.Services.Bot.IChatSkill, API.Customer.Services.Bot.Skills.CouponSkill>();
builder.Services.AddScoped<API.Customer.Services.Bot.IChatSkill, API.Customer.Services.Bot.Skills.FaqSkill>();

// Chatbot: dispatcher chọn rule-based hay LLM tại runtime theo cấu hình trong DB
// (admin đổi trên trang /admin/settings là có hiệu lực ngay, không cần restart)
builder.Services.AddScoped<API.Customer.Services.Bot.IChatSettingsProvider, API.Customer.Services.Bot.ChatSettingsProvider>();
builder.Services.AddScoped<API.Customer.Services.Bot.IChatRetriever, API.Customer.Services.Bot.DbChatRetriever>();
builder.Services.AddScoped<API.Customer.Services.Bot.RuleBasedChatBot>();
builder.Services.AddHttpClient<API.Customer.Services.Bot.LlmChatBot>();
builder.Services.AddScoped<API.Customer.Services.Bot.IChatBot, API.Customer.Services.Bot.ChatBotDispatcher>();

builder.Services.AddScoped<IChatService, ChatService>();

// Shipping providers — Mock luôn bật, GHTK/GHN bật khi có token
// Shipping config service (singleton để cache nhẹ trong process)
builder.Services.AddSingleton<IShippingConfigService, ShippingConfigService>();
builder.Services.AddHttpClient<IGhnMasterDataService, GhnMasterDataService>(c =>
{
    c.Timeout = TimeSpan.FromSeconds(15);
});

builder.Services.AddScoped<IShippingProvider, MockShippingProvider>();
builder.Services.AddHttpClient<IShippingProvider, GhtkShippingProvider>(c =>
{
    var baseUrl = builder.Configuration["GHTK:BaseUrl"]
        ?? "https://services.giaohangtietkiem.vn";
    c.BaseAddress = new Uri(baseUrl);
    c.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddHttpClient<IShippingProvider, GhnShippingProvider>(c =>
{
    // Mặc định trỏ vào DEV endpoint của GHN — token production sẽ trả 401, không thể tạo đơn thật.
    var baseUrl = builder.Configuration["GHN:BaseUrl"]
        ?? "https://dev-online-gateway.ghn.vn";
    c.BaseAddress = new Uri(baseUrl);
    c.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<IShippingService, ShippingService>();

builder.Services.AddHostedService<ShippingStatusSimulator>();
builder.Services.AddHostedService<API.Customer.Services.PaymentExpirySweeper>();
builder.Services.AddHostedService<API.Customer.Services.CartReservationSweeper>();
builder.Services.AddHostedService<API.Customer.Services.ChatIdleSweeper>();

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Compatibility repair: các database cũ chưa có bảng yêu cầu đổi/trả.
// Tạo idempotent khi API.Customer khởi động để người dùng không phải chạy SQL thủ công.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CustomerDbContext>();
    await db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'dbo.YeuCauDoiTra', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.YeuCauDoiTra (
                Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_YeuCauDoiTra PRIMARY KEY,
                DonHangId INT NOT NULL,
                NguoiDungId INT NOT NULL,
                LyDo NVARCHAR(200) NOT NULL,
                GhiChu NVARCHAR(1000) NULL,
                TrangThai VARCHAR(30) NOT NULL CONSTRAINT DF_YeuCauDoiTra_TrangThai DEFAULT 'pending',
                PhanHoiAdmin NVARCHAR(1000) NULL,
                NgayTao DATETIME2 NOT NULL CONSTRAINT DF_YeuCauDoiTra_NgayTao DEFAULT SYSUTCDATETIME(),
                NgayCapNhat DATETIME2 NULL,
                CONSTRAINT FK_YeuCauDoiTra_DonHang FOREIGN KEY (DonHangId) REFERENCES dbo.DonHang(Id) ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX UX_YeuCauDoiTra_DonHangId ON dbo.YeuCauDoiTra(DonHangId);
            CREATE INDEX IX_YeuCauDoiTra_User_Status ON dbo.YeuCauDoiTra(NguoiDungId, TrangThai);
        END
        """);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseStaticFiles();
app.UseCors("AllowFrontend");
app.UseRequestLogging();
app.UseGlobalExceptionHandler();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<API.Customer.Hubs.ChatHub>("/hubs/chat");

// Banner an toàn ở console khi khởi động
var shippingMode = (app.Configuration["Shipping:Mode"] ?? "dev").ToLowerInvariant();
var allowRealCreate = bool.TryParse(app.Configuration["Shipping:AllowRealCreate"], out var v) && v;
var ghnBase = app.Configuration["GHN:BaseUrl"] ?? "(default dev)";
var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("=========================================================");
logger.LogInformation(" SHIPPING MODE   : {Mode}", shippingMode.ToUpperInvariant());
logger.LogInformation(" REAL CREATE     : {Allow}", allowRealCreate ? "ALLOWED" : "BLOCKED (safe)");
logger.LogInformation(" GHN BASE URL    : {Url}", ghnBase);
logger.LogInformation(" → KHÔNG có hàm gọi /shipping-order/create. Đơn luôn sinh mã giả lập.");
logger.LogInformation("=========================================================");

app.Run();
