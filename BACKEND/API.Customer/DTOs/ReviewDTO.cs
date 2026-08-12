namespace API.Customer.DTOs;

public class ReviewDTO
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int OrderId { get; set; }
    public List<string> Images { get; set; } = new();
    public string? VideoUrl { get; set; }
    public string? Size { get; set; }
    public string? Color { get; set; }
    public string? AdminReply { get; set; }
    public DateTime? RepliedAt { get; set; }
    public int HelpfulCount { get; set; }
    public bool IsVerifiedPurchase { get; set; }
}

public class CreateReviewDTO
{
    public int ProductId { get; set; }
    public int OrderId { get; set; }
    public int Rating { get; set; }
    public string Comment { get; set; } = string.Empty;
    public List<string>? Images { get; set; }
    public string? VideoUrl { get; set; }
    public string? Size { get; set; }
    public string? Color { get; set; }
}
