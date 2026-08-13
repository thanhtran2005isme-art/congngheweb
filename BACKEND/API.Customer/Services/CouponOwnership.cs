namespace API.Customer.Services;

public static class CouponOwnership
{
    public static int? OwnerId(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        var value = code.Trim().ToUpperInvariant();
        if (!value.StartsWith("PT", StringComparison.Ordinal) && !value.StartsWith("BD", StringComparison.Ordinal)) return null;
        var dash = value.IndexOf('-', 2);
        if (dash <= 2) return null;
        return int.TryParse(value[2..dash], out var id) && id > 0 ? id : null;
    }
}
