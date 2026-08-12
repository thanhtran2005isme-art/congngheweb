namespace API.Customer.Models;

/// <summary>Trạng thái của một phiên hội thoại (CuocHoiThoai.TrangThai).</summary>
public static class ChatStatus
{
    public const string Bot = "bot";
    public const string Waiting = "waiting";
    public const string Agent = "agent";
    public const string Closed = "closed";
}

/// <summary>Loại người gửi tin nhắn (TinNhan.LoaiNguoiGui).</summary>
public static class ChatSender
{
    public const string Customer = "customer";
    public const string Bot = "bot";
    public const string Agent = "agent";
}

/// <summary>Loại nội dung đính kèm trong tin nhắn (TinNhan.LoaiDinhKem).</summary>
public static class ChatAttachmentType
{
    public const string Product = "product";
    public const string Order = "order";
}
