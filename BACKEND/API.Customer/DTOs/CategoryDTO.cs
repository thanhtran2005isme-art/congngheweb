namespace API.Customer.DTOs;

public class CategoryDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public string? Description { get; set; }
    public string? Image { get; set; }
    public int? ParentId { get; set; }
    public int SortOrder { get; set; }
}
