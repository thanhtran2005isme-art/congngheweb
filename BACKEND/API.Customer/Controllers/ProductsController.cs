using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController(IProductService productService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductDTO>>> GetAll([FromQuery] ProductFilterDTO filter)
    {
        return Ok(await productService.GetAllAsync(filter));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductDetailDTO>> GetById(int id)
    {
        var product = await productService.GetByIdAsync(id);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("slug/{slug}")]
    public async Task<ActionResult<ProductDetailDTO>> GetBySlug(string slug)
    {
        var product = await productService.GetBySlugAsync(slug);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("new-arrivals")]
    public async Task<ActionResult<List<ProductDTO>>> GetNewArrivals([FromQuery] int count = 8)
    {
        return Ok(await productService.GetNewArrivalsAsync(count));
    }

    [HttpGet("best-sellers")]
    public async Task<ActionResult<List<ProductDTO>>> GetBestSellers([FromQuery] int count = 8)
    {
        return Ok(await productService.GetBestSellersAsync(count));
    }

    [HttpGet("sale")]
    public async Task<ActionResult<List<ProductDTO>>> GetSaleProducts([FromQuery] int count = 8)
    {
        return Ok(await productService.GetSaleProductsAsync(count));
    }

    [HttpGet("{id:int}/related")]
    public async Task<ActionResult<List<ProductDTO>>> GetRelated(int id, [FromQuery] int count = 4)
    {
        return Ok(await productService.GetRelatedAsync(id, count));
    }
}
