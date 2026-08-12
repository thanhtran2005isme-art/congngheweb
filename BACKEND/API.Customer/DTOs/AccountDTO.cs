namespace API.Customer.DTOs;

public class AccountDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Avatar { get; set; }
    public DateTime CreatedAt { get; set; }
    public int LoyaltyPoints { get; set; }
    public string MemberTier { get; set; } = "Member";
    public decimal TotalSpent { get; set; }
    public DateTime? Birthday { get; set; }
    // Bonus tier info
    public decimal NextTierAt { get; set; }
    public decimal AmountToNextTier { get; set; }
    public string NextTier { get; set; } = string.Empty;
    public int TotalOrders { get; set; }
}

public class UpdateAccountDTO
{
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public string? Avatar { get; set; }
    public DateTime? Birthday { get; set; }
}

public class PointsHistoryDTO
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public int Points { get; set; }
    public int BalanceAfter { get; set; }
    public int? OrderId { get; set; }
    public string? OrderCode { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class RedeemPointsDTO
{
    public int Points { get; set; }   // số điểm muốn đổi
}

public class RedeemResultDTO
{
    public string CouponCode { get; set; } = string.Empty;
    public decimal DiscountValue { get; set; }
    public int RemainingPoints { get; set; }
    public DateTime ExpiresAt { get; set; }
}

public class DeleteAccountDTO
{
    /// <summary>Phải nhập đúng "DELETE" để xác nhận.</summary>
    public string Confirm { get; set; } = string.Empty;
}