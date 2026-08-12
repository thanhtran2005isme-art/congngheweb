using API.Customer.Models;
using API.Customer.Services.Bot;
using Xunit;

namespace API.Customer.Tests;

public class ChatRetrieverTests
{
    private static async Task SeedProducts(TestDb db)
    {
        db.Context.Products.AddRange(
            new Product { Id = 1, Name = "Áo khoác bomber nam", Category = "Ao", Subcategory = "Ao Khoac", Gender = "Nam", Price = 450000, Image = "b.jpg", Description = "d", Sku = "KK-AK-001", Status = "active", Stock = 10, Colors = "[\"Đen\",\"Be\"]", Sizes = "[\"M\",\"L\"]" },
            new Product { Id = 2, Name = "Quần jean nữ", Category = "Quan", Subcategory = "Quan Jean", Gender = "Nu", Price = 320000, Image = "j.jpg", Description = "d", Sku = "KK-QJ-001", Status = "active", Stock = 5, Colors = "[\"Xanh\"]", Sizes = "[\"S\",\"M\"]" }
        );
        await db.Context.SaveChangesAsync();
    }

    [Fact]
    public async Task Retrieve_MatchesRelevantProduct()
    {
        using var db = new TestDb();
        await SeedProducts(db);
        var retriever = new DbChatRetriever(db.Context);

        var ctx = await retriever.RetrieveAsync("shop có áo khoác nam không", null);

        Assert.Contains("Áo khoác bomber nam", ctx);
        Assert.Contains("/product/1", ctx);
        // Không kéo sản phẩm không liên quan
        Assert.DoesNotContain("Quần jean nữ", ctx);
    }

    [Fact]
    public async Task Retrieve_NoMatch_ReturnsEmpty()
    {
        using var db = new TestDb();
        await SeedProducts(db);
        var retriever = new DbChatRetriever(db.Context);

        var ctx = await retriever.RetrieveAsync("thời tiết hôm nay thế nào", null);

        Assert.True(string.IsNullOrEmpty(ctx));
    }

    [Fact]
    public async Task Retrieve_ProductContext_IncludesVariants()
    {
        using var db = new TestDb();
        await SeedProducts(db);
        db.Context.VariantStocks.Add(new VariantStock { ProductId = 1, Size = "M", Color = "Đen", Stock = 8, Reserved = 1 });
        await db.Context.SaveChangesAsync();
        var retriever = new DbChatRetriever(db.Context);

        var ctx = await retriever.RetrieveAsync("còn size nào", productContextId: 1);

        Assert.Contains("Tồn kho", ctx);
        Assert.Contains("M", ctx);
    }

    [Fact]
    public async Task Retrieve_PolicyQuestion_IncludesPolicy()
    {
        using var db = new TestDb();
        await SeedProducts(db);
        db.Context.StoreSettings.Add(new StoreSetting { Code = "policy.return", Group = "policy", Description = "Đổi trả", Value = "Đổi trả trong 7 ngày" });
        await db.Context.SaveChangesAsync();
        var retriever = new DbChatRetriever(db.Context);

        var ctx = await retriever.RetrieveAsync("chính sách đổi trả thế nào", null);

        Assert.Contains("Chính sách", ctx);
        Assert.Contains("7 ngày", ctx);
    }
}
