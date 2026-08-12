using API.Customer.Data;
using API.Customer.DTOs;
using API.Customer.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Customer.Services;

public class AddressService(CustomerDbContext db) : IAddressService
{
    public async Task<List<AddressDTO>> GetAllAsync(int userId)
    {
        return await db.Addresses
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.IsDefault)
            .ThenByDescending(a => a.CreatedAt)
            .Select(a => MapToDTO(a))
            .ToListAsync();
    }

    public async Task<AddressDTO> CreateAsync(int userId, CreateAddressDTO dto)
    {
        if (dto.IsDefault)
            await ClearDefaultAsync(userId);

        var address = new Address
        {
            UserId = userId,
            FullName = dto.FullName,
            Phone = dto.Phone,
            Province = dto.Province,
            District = dto.District,
            Ward = dto.Ward,
            Street = dto.Street,
            IsDefault = dto.IsDefault
        };

        db.Addresses.Add(address);
        await db.SaveChangesAsync();
        return MapToDTO(address);
    }

    public async Task<AddressDTO?> UpdateAsync(int userId, int addressId, CreateAddressDTO dto)
    {
        var address = await db.Addresses
            .FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId);

        if (address is null) return null;

        if (dto.IsDefault)
            await ClearDefaultAsync(userId);

        address.FullName = dto.FullName;
        address.Phone = dto.Phone;
        address.Province = dto.Province;
        address.District = dto.District;
        address.Ward = dto.Ward;
        address.Street = dto.Street;
        address.IsDefault = dto.IsDefault;

        await db.SaveChangesAsync();
        return MapToDTO(address);
    }

    public async Task<bool> DeleteAsync(int userId, int addressId)
    {
        var address = await db.Addresses
            .FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId);

        if (address is null) return false;

        db.Addresses.Remove(address);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetDefaultAsync(int userId, int addressId)
    {
        var address = await db.Addresses
            .FirstOrDefaultAsync(a => a.Id == addressId && a.UserId == userId);

        if (address is null) return false;

        await ClearDefaultAsync(userId);
        address.IsDefault = true;
        await db.SaveChangesAsync();
        return true;
    }

    private async Task ClearDefaultAsync(int userId)
    {
        await db.Addresses
            .Where(a => a.UserId == userId && a.IsDefault)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsDefault, false));
    }

    private static AddressDTO MapToDTO(Address a) => new()
    {
        Id = a.Id,
        FullName = a.FullName,
        Phone = a.Phone,
        Province = a.Province,
        District = a.District,
        Ward = a.Ward,
        Street = a.Street,
        IsDefault = a.IsDefault
    };
}
// refactor: dung ExecuteUpdateAsync thay vi load toan bo
