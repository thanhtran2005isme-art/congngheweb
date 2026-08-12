using API.Customer.DTOs;

namespace API.Customer.Services;

public interface ICouponService
{
    Task<CouponResultDTO> ValidateAsync(CouponValidateDTO dto);
}
