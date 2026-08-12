using API.Customer.DTOs;

namespace API.Customer.Services;

public interface IAddressService
{
    Task<List<AddressDTO>> GetAllAsync(int userId);
    Task<AddressDTO> CreateAsync(int userId, CreateAddressDTO dto);
    Task<AddressDTO?> UpdateAsync(int userId, int addressId, CreateAddressDTO dto);
    Task<bool> DeleteAsync(int userId, int addressId);
    Task<bool> SetDefaultAsync(int userId, int addressId);
}
