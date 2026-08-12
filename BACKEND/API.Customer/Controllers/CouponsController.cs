using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CouponsController(ICouponService couponService) : ControllerBase
{
    [HttpPost("validate")]
    [Authorize]
    public async Task<ActionResult<CouponResultDTO>> Validate([FromBody] CouponValidateDTO dto)
    {
        var result = await couponService.ValidateAsync(dto);
        return Ok(result);
    }
}
