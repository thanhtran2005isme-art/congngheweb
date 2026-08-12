using System.Text;
using API.Customer.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Controllers;

/// <summary>
/// Sitemap động cho SEO - liệt kê toàn bộ sản phẩm + collection còn active.
/// Truy cập tại GET /sitemap.xml. Cache 1 giờ.
/// </summary>
[ApiController]
public class SitemapController(CustomerDbContext db) : ControllerBase
{
    [HttpGet("/sitemap.xml")]
    [ResponseCache(Duration = 3600, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> Get()
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}".TrimEnd('/');

        var products = await db.Products
            .Where(p => p.Status == "active")
            .Select(p => new { p.Id, p.Slug, p.UpdatedAt, p.CreatedAt })
            .ToListAsync();

        var collections = await db.Collections
            .Where(c => c.IsActive)
            .Select(c => new { c.Slug, c.Name, c.CreatedAt })
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");

        // Static pages
        var staticUrls = new[]
        {
            ("/", 1.0, "daily"),
            ("/products", 0.9, "daily"),
            ("/women", 0.9, "daily"),
            ("/men", 0.9, "daily"),
            ("/kids", 0.9, "daily"),
            ("/new-in", 0.8, "daily"),
            ("/sale", 0.8, "daily"),
            ("/bestseller", 0.8, "daily"),
            ("/collections", 0.7, "weekly"),
            ("/lookbook", 0.7, "weekly"),
        };
        foreach (var (path, prio, freq) in staticUrls)
        {
            sb.Append("<url><loc>").Append(baseUrl).Append(path).Append("</loc>")
              .Append("<changefreq>").Append(freq).Append("</changefreq>")
              .Append("<priority>").Append(prio.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture)).Append("</priority>")
              .AppendLine("</url>");
        }

        // Products
        foreach (var p in products)
        {
            var loc = string.IsNullOrEmpty(p.Slug)
                ? $"{baseUrl}/product/{p.Id}"
                : $"{baseUrl}/p/{p.Slug}";
            var lastmod = (p.UpdatedAt ?? p.CreatedAt).ToString("yyyy-MM-dd");
            sb.Append("<url><loc>").Append(loc).Append("</loc>")
              .Append("<lastmod>").Append(lastmod).Append("</lastmod>")
              .Append("<changefreq>weekly</changefreq><priority>0.6</priority>")
              .AppendLine("</url>");
        }

        // Collections
        foreach (var c in collections)
        {
            var slug = string.IsNullOrEmpty(c.Slug) ? c.Name : c.Slug;
            sb.Append("<url><loc>").Append(baseUrl).Append("/products?collection=").Append(Uri.EscapeDataString(slug)).Append("</loc>")
              .Append("<changefreq>weekly</changefreq><priority>0.5</priority>")
              .AppendLine("</url>");
        }

        sb.AppendLine("</urlset>");
        return Content(sb.ToString(), "application/xml", Encoding.UTF8);
    }

    [HttpGet("/robots.txt")]
    public IActionResult Robots()
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}".TrimEnd('/');
        var body = $@"User-agent: *
Allow: /

Disallow: /admin/
Disallow: /account
Disallow: /address
Disallow: /cart
Disallow: /checkout
Disallow: /wishlist
Disallow: /orders

Sitemap: {baseUrl}/sitemap.xml
";
        return Content(body, "text/plain", Encoding.UTF8);
    }
}
