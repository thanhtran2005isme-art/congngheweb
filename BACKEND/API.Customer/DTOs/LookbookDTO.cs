namespace API.Customer.DTOs;

public class LookbookDTO
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? Description { get; set; }
    public string Image { get; set; } = string.Empty;
    public string? Link { get; set; }
    public string? VideoUrl { get; set; }
    public string? Season { get; set; }
    public string? Style { get; set; }
    public int SortOrder { get; set; }
    public List<LookbookHotspotDTO> Hotspots { get; set; } = new();
}

public class LookbookHotspotDTO
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductImage { get; set; }
    public decimal ProductPrice { get; set; }
    public decimal? ProductOldPrice { get; set; }
    public decimal X { get; set; }
    public decimal Y { get; set; }
    public string? Note { get; set; }
    public int SortOrder { get; set; }
}
