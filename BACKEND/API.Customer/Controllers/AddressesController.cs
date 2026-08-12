using System.Security.Claims;
using API.Customer.DTOs;
using API.Customer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Customer.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AddressesController(IAddressService addressService) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<List<AddressDTO>>> GetAll()
    {
        return Ok(await addressService.GetAllAsync(UserId));
    }

    [HttpPost]
    public async Task<ActionResult<AddressDTO>> Create([FromBody] CreateAddressDTO dto)
    {
        var address = await addressService.CreateAsync(UserId, dto);
        return Ok(address);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AddressDTO>> Update(int id, [FromBody] CreateAddressDTO dto)
    {
        var address = await addressService.UpdateAsync(UserId, id, dto);
        return address is null ? NotFound() : Ok(address);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await addressService.DeleteAsync(UserId, id);
        return result ? NoContent() : NotFound();
    }

    [HttpPut("{id:int}/default")]
    public async Task<IActionResult> SetDefault(int id)
    {
        var result = await addressService.SetDefaultAsync(UserId, id);
        return result ? Ok(new { message = "Đã đặt làm địa chỉ mặc định" }) : NotFound();
    }
}
