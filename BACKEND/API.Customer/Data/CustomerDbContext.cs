using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Data;

public class CustomerDbContext(DbContextOptions<CustomerDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<Collection> Collections => Set<Collection>();
    public DbSet<Lookbook> Lookbooks => Set<Lookbook>();
    public DbSet<LookbookHotspot> LookbookHotspots => Set<LookbookHotspot>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ProductAttribute> ProductAttributes => Set<ProductAttribute>();
    public DbSet<ShippingHistory> ShippingHistories => Set<ShippingHistory>();
    public DbSet<StoreSetting> StoreSettings => Set<StoreSetting>();
    public DbSet<PointsHistory> PointsHistories => Set<PointsHistory>();
    public DbSet<NewsletterSubscriber> NewsletterSubscribers => Set<NewsletterSubscriber>();
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<HomepageBlock> HomepageBlocks => Set<HomepageBlock>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Referral> Referrals => Set<Referral>();
    public DbSet<SizeChart> SizeCharts => Set<SizeChart>();
    public DbSet<ProductQA> ProductQAs => Set<ProductQA>();
    public DbSet<ProductViewSession> ProductViewSessions => Set<ProductViewSession>();
    public DbSet<VariantStock> VariantStocks => Set<VariantStock>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<ProductImageEmbedding> ProductImageEmbeddings => Set<ProductImageEmbedding>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(e =>
        {
            e.HasIndex(p => p.Slug).IsUnique().HasFilter("[Slug] IS NOT NULL");
            e.HasIndex(p => p.Status);
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.HasIndex(o => o.OrderCode).IsUnique();
            e.HasMany(o => o.Items).WithOne(i => i.Order).HasForeignKey(i => i.OrderId);
            e.HasMany(o => o.ShippingHistories).WithOne(h => h.Order).HasForeignKey(h => h.OrderId);
        });

        modelBuilder.Entity<WishlistItem>(e =>
        {
            e.HasIndex(w => new { w.UserId, w.ProductId }).IsUnique();
        });

        modelBuilder.Entity<Review>(e =>
        {
            e.HasOne(r => r.Product).WithMany(p => p.Reviews).HasForeignKey(r => r.ProductId);
        });

        modelBuilder.Entity<Coupon>(e =>
        {
            e.HasIndex(c => c.Code).IsUnique();
        });

        modelBuilder.Entity<ShippingHistory>(e =>
        {
            e.HasIndex(h => h.OrderId);
        });

        modelBuilder.Entity<Conversation>(e =>
        {
            e.HasIndex(c => new { c.Status, c.LastMessageAt });
            e.HasIndex(c => c.UserId);
            e.HasIndex(c => c.GuestId);
            e.HasMany(c => c.Messages).WithOne(m => m.Conversation!).HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatMessage>(e =>
        {
            e.HasIndex(m => new { m.ConversationId, m.Id });
        });

        modelBuilder.Entity<ProductImageEmbedding>(e =>
        {
            e.HasIndex(x => x.ProductId).IsUnique();
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
// v1.1: Them indexes cho Slug, Status, OrderCode, Wishlist
// v1.2: Them ShippingHistories cho luong van chuyen
// v1.3: Them bang chat CuocHoiThoai + TinNhan
