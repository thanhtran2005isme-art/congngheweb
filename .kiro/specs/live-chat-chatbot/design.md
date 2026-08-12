# Design Document — Live Chat & Chatbot

## Overview

Tính năng hỗ trợ khách hàng 2 tuyến (chatbot tuyến đầu → live chat nhân viên tuyến sau), tự xây trong hệ thống, lưu toàn bộ hội thoại vào CSDL của shop.

Mục tiêu thiết kế:

- **Bám sát kiến trúc hiện tại**: đặt trong `API.Customer` (port 5265), dùng chung `CustomerDbContext`; route đi qua Gateway; model C# tiếng Anh map sang bảng/cột tiếng Việt bằng `[Table]`/`[Column]`.
- **Real-time bằng SignalR**, kết nối thẳng tới API.Customer (không qua Ocelot vì Ocelot không proxy WebSocket mượt); REST vẫn qua Gateway.
- **Chatbot rule-based truy DB** trước, tách sau interface để cắm LLM về sau.
- **Tận dụng tài sản sẵn có**: `react-hot-toast` (toast), `Notification`/`ThongBao` (thông báo), `StaffAuthContext` + JWT staff (inbox nhân viên), pattern background service (`PaymentExpirySweeper`/`CartReservationSweeper`) cho auto-close phiên nguội.

### Ràng buộc thực tế đã xác minh từ code (ảnh hưởng tới thiết kế)

1. **JWT đồng nhất một khóa**: API.Auth phát cả token khách (`GenerateAccessToken`) lẫn token nhân viên (`GenerateStaffAccessToken`), cùng `Jwt:Key`/`Issuer`/`Audience`. Token staff có thêm claim `user_type=staff`, `is_super_admin`, và nhiều claim `permission`. → API.Customer **có thể xác thực cả hai loại token** bằng cấu hình JWT sẵn có (`AddJwtAuthentication`). SignalR cũng dùng được cùng khóa.
2. **Phân quyền admin thực tế = `[Authorize(Roles = "admin")]`**: mọi controller admin đang chặn theo role "admin", còn `hasPermission('...')` chỉ gác ở frontend (`StaffAuthContext`). Token staff đặt `role = LaSuperAdmin ? "admin" : roleCode`. → Để nhất quán với phần còn lại của hệ thống, endpoint chat cho nhân viên sẽ dùng `[Authorize(Roles = "admin")]`; phần permission chat (`chat.view`/`chat.reply`) sẽ được seed vào RBAC và gác ở frontend (giống các module khác). Đây là cách "đúng kiểu dự án", không phát minh cơ chế mới.
3. **Khách vãng lai**: nhiều endpoint khách đang `[Authorize]`. Chat cần phục vụ cả khách chưa đăng nhập → endpoint chat khách dùng `[AllowAnonymous]` và tự phân giải danh tính theo JWT (nếu có) hoặc `guestId` (nếu không).
4. **Frontend `apiClient`** tự gắn token khách + tự refresh khi 401. Token nhân viên lưu riêng (`staff_access_token`). → Gọi API chat khách dùng `apiClient`; gọi API chat admin dùng client kèm staff token (theo pattern admin hiện có).

---

## Architecture

### Sơ đồ tổng thể

```
                         Frontend (React 19 + Vite, :5173)
   ┌───────────────────────────────────────────────────────────────────┐
   │  Khách hàng                         │  Nhân viên (Admin)            │
   │  - ChatWidget (bong bóng nổi)       │  - /admin/chat (Inbox)        │
   │  - ChatContext (state + signalR)    │  - useStaffAuth + hasPermission│
   └─────────────┬───────────────────────┴───────────────┬─────────────┘
                 │ REST (qua Gateway :5155)               │ WebSocket (thẳng :5265)
                 │ /api/chat/**                            │ /hubs/chat
                 ▼                                         ▼
   ┌───────────────────────────┐            ┌──────────────────────────────┐
   │  API.Gateway (Ocelot:5155)│            │     API.Customer (:5265)       │
   │  route /api/chat/** →5265 │            │  ┌──────────────────────────┐ │
   └─────────────┬─────────────┘            │  │ ChatHub (SignalR)        │ │
                 │                           │  ├──────────────────────────┤ │
                 └──────────────────────────►│  │ ChatController (REST)    │ │
                                             │  ├──────────────────────────┤ │
                                             │  │ ChatService              │ │
                                             │  │ ChatBotService (IBot)    │ │
                                             │  │   ├─ RuleBasedBot (mặc định)│
                                             │  │   └─ LlmBot (tùy chọn)   │ │
                                             │  │ ChatIdleSweeper (hosted) │ │
                                             │  └──────────────────────────┘ │
                                             │            │ EF Core           │
                                             │            ▼                    │
                                             │   CustomerDbContext             │
                                             │   + CuocHoiThoai / TinNhan      │
                                             │   (đọc DonHang, TonKhoBienThe,  │
                                             │    MaGiamGia, SanPham cho bot)  │
                                             └────────────────┬───────────────┘
                                                              ▼
                                                      SQL Server (KaitoKid)
```

### Vì sao SignalR kết nối thẳng :5265 mà không qua Gateway

- Ocelot trong cấu hình hiện tại chỉ định tuyến HTTP method thông thường; WebSocket upgrade qua Ocelot cần cấu hình thêm và dễ phát sinh lỗi. Kết nối thẳng tới hub đơn giản và ổn định hơn ở quy mô dự án.
- **Tradeoff**: frontend cần biết URL hub riêng. Giải pháp: thêm biến môi trường `VITE_CHAT_HUB_URL` (mặc định `http://localhost:5265/hubs/chat`), tách khỏi `VITE_API_BASE_URL` (Gateway). REST chat vẫn qua Gateway nên không phá vỡ mô hình "một cửa ngõ" cho API thường.
- CORS: API.Customer đã cho phép origin `:5173` + `AllowCredentials()` — đáp ứng yêu cầu của SignalR.

### Luồng dữ liệu chính

**A. Khách gửi tin (đang ở tuyến bot):**

1. Frontend gửi tin qua SignalR `SendMessage(conversationId, text)` (hoặc REST fallback `POST /api/chat/messages`).
2. `ChatService` lưu `TinNhan` (sender=customer), cập nhật `CuocHoiThoai.LastMessageAt`.
3. Nếu phiên ở trạng thái `bot` → gọi `IChatBot.RespondAsync(context)`; lưu `TinNhan` (sender=bot); đẩy về client qua hub.
4. Nếu phiên ở trạng thái `agent`/`waiting` → KHÔNG gọi bot; chỉ broadcast cho nhân viên đang xử lý.

**B. Escalation sang nhân viên:**

1. Khách bấm "Gặp nhân viên" hoặc bot trả về intent `handoff` → `ChatService.RequestHandoff(conversationId)` đặt trạng thái `waiting`.
2. Hub broadcast tới group `agents` (tất cả nhân viên đang mở inbox) → cập nhật hàng đợi real-time.
3. Nhân viên `ClaimConversation(conversationId)` → trạng thái `agent`, gán `AssignedStaffId`, khóa optimistic để tránh nhận trùng.
4. Hai bên vào cùng group `conv:{id}` để chat real-time.

**C. Auto-close phiên nguội:** `ChatIdleSweeper` (IHostedService) quét định kỳ; phiên `agent`/`waiting` quá `Chat:IdleMinutes` không hoạt động → chuyển `closed` (hoặc trả về hàng đợi tùy trạng thái) + thông báo.

---

## Components and Interfaces

### Backend — API.Customer

#### 1. Models (EF Core, map bảng tiếng Việt)

`Models/Conversation.cs` → bảng `CuocHoiThoai`
`Models/ChatMessage.cs` → bảng `TinNhan`

(Chi tiết cột ở mục Data Models.)

Đăng ký vào `CustomerDbContext`:

```csharp
public DbSet<Conversation> Conversations => Set<Conversation>();
public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
```

Trong `OnModelCreating`: index theo `(Status, LastMessageAt)`, `(UserId)`, `(GuestId)`, và `ChatMessage.ConversationId`.

#### 2. ChatService (`Services/ChatService.cs` + `IChatService`)

Trách nhiệm: nghiệp vụ thuần (không biết transport), gọi từ cả Controller lẫn Hub.

```csharp
public interface IChatService
{
    Task<ConversationDto> GetOrCreateAsync(ChatIdentity who, int? productContextId);
    Task<MessageDto> AddCustomerMessageAsync(ChatIdentity who, int conversationId, string text, ChatAttachment? attach);
    Task<MessageDto> AddAgentMessageAsync(int staffId, int conversationId, string text, ChatAttachment? attach);
    Task<MessageDto> AddBotMessageAsync(int conversationId, BotReply reply);
    Task<IReadOnlyList<MessageDto>> GetHistoryAsync(ChatIdentity who, int conversationId, int take, int beforeId);
    Task RequestHandoffAsync(int conversationId, string? reason);
    Task<bool> ClaimAsync(int staffId, int conversationId);     // false nếu đã bị người khác claim
    Task CloseAsync(int conversationId, ChatActor by);
    Task MarkReadAsync(int conversationId, ChatActor reader);
    // Inbox nhân viên
    Task<PagedResult<ConversationDto>> ListForAgentAsync(ChatInboxFilter filter);
}
```

- `ChatIdentity`: gói `UserId?` + `GuestId?` để phân giải chủ sở hữu phiên (đáp ứng Req 14.1 — chỉ chủ sở hữu xem được phiên).
- Mọi truy vấn lịch sử/đọc đều kiểm tra quyền sở hữu trước khi trả dữ liệu.

#### 3. IChatBot (tách để cắm LLM) — `Services/Bot/`

```csharp
public interface IChatBot
{
    Task<BotReply> RespondAsync(BotContext context);
}

public record BotContext(
    int ConversationId,
    ChatIdentity Who,
    string UserText,
    int? ProductContextId,
    IReadOnlyList<MessageDto> RecentHistory);

public record BotReply(
    string Text,
    BotIntent Intent,           // OrderLookup, StockCheck, Coupon, Faq, Handoff, Unknown
    IReadOnlyList<QuickReply> QuickReplies,
    ChatAttachment? Attachment, // link sản phẩm/đơn dạng card
    bool ShouldHandoff);
```

- `RuleBasedChatBot` (mặc định): nhận diện intent bằng từ khóa tiếng Việt + regex (mã đơn `KK-\d{8}-\w+`, từ khóa "đơn hàng/size/màu/còn hàng/mã giảm/giảm giá/đổi trả/ship/nhân viên"...), rồi gọi các "skill" truy DB:
  - `OrderLookupSkill` → đọc `Orders` (kiểm soát quyền sở hữu theo Req 2.3).
  - `StockCheckSkill` → đọc `VariantStocks` + `Products` (dùng `Available = Stock - Reserved`).
  - `CouponSkill` → đọc `Coupons` còn hiệu lực (IsActive, trong khoảng ngày, còn lượt — Req 4.4).
  - `FaqSkill` → đọc nội dung FAQ/chính sách từ `StoreSettings`/trang tĩnh đã có, fallback bảng cấu hình FAQ.
- `LlmChatBot` (tùy chọn): chỉ đăng ký khi có `Chat:Llm:ApiKey`. Theo đúng pattern Email Brevo/Console trong `API.Auth/Program.cs`. Nếu gọi LLM lỗi → fallback rule-based hoặc đề nghị handoff (Req 13.3).

Đăng ký DI (Program.cs API.Customer):

```csharp
var llmKey = builder.Configuration["Chat:Llm:ApiKey"];
if (!string.IsNullOrWhiteSpace(llmKey))
    builder.Services.AddHttpClient<IChatBot, LlmChatBot>();
else
    builder.Services.AddScoped<IChatBot, RuleBasedChatBot>();
```

#### 4. ChatHub (SignalR) — `Hubs/ChatHub.cs`

```csharp
[AllowAnonymous] // tự phân giải danh tính trong hub
public class ChatHub : Hub
{
    // Client → Server
    Task JoinConversation(int conversationId);
    Task SendMessage(int conversationId, string text, ChatAttachment? attach);
    Task Typing(int conversationId, bool isTyping);
    Task MarkRead(int conversationId);
    // Nhân viên
    Task JoinAgentQueue();        // chỉ token staff mới được vào group "agents"
    Task ClaimConversation(int conversationId);

    // Server → Client (broadcast):
    // "ReceiveMessage", "ConversationUpdated", "TypingChanged",
    // "ReadReceipt", "QueueUpdated", "HandoffRequested"
}
```

- Xác thực: SignalR đọc token từ query string `access_token` (chuẩn SignalR cho WebSocket). Hub phân biệt staff bằng claim `user_type=staff`. Khách vãng lai gửi `guestId` khi join.
- Group: `conv:{id}` cho mỗi phiên; `agents` cho nhân viên trực inbox.
- Hub gọi `IChatService` để xử lý nghiệp vụ + lưu DB, rồi broadcast.

#### 5. ChatController (REST) — `Controllers/ChatController.cs`

Fallback/khởi tạo khi chưa kết nối hub được, và cho mobile/SEO an toàn:

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| POST | `/api/chat/conversations` | AllowAnonymous | Lấy/tạo phiên cho khách (kèm productContextId) |
| GET | `/api/chat/conversations/{id}/messages` | AllowAnonymous (check sở hữu) | Lịch sử tin nhắn |
| POST | `/api/chat/messages` | AllowAnonymous (check sở hữu) | Gửi tin (fallback không có hub) |
| POST | `/api/chat/conversations/{id}/handoff` | AllowAnonymous | Yêu cầu gặp nhân viên |
| POST | `/api/chat/conversations/{id}/read` | AllowAnonymous | Đánh dấu đã đọc |

Nhóm admin (nhân viên):

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| GET | `/api/admin/chat/conversations` | `[Authorize(Roles="admin")]` | Danh sách inbox (lọc theo trạng thái) |
| GET | `/api/admin/chat/conversations/{id}` | Roles=admin | Chi tiết + lịch sử |
| POST | `/api/admin/chat/conversations/{id}/claim` | Roles=admin | Nhận phiên |
| POST | `/api/admin/chat/conversations/{id}/reply` | Roles=admin | Trả lời (fallback) |
| POST | `/api/admin/chat/conversations/{id}/close` | Roles=admin | Đóng phiên |

Thêm vào `ocelot.json`: route `/api/chat/{everything}`, `/api/chat`, `/api/admin/chat/{everything}` → port 5265 (tương tự các route đang có).

#### 6. ChatIdleSweeper (IHostedService) — `Services/ChatIdleSweeper.cs`

Theo đúng khuôn `PaymentExpirySweeper`. Quét mỗi `Chat:SweepIntervalSeconds`; phiên `waiting`/`agent` quá `Chat:IdleMinutes` không hoạt động → đóng + (tùy chọn) gửi tin tạm biệt tự động. Đăng ký `builder.Services.AddHostedService<ChatIdleSweeper>();`.

### Frontend — React

#### Khách hàng

- `components/chat/ChatWidget.tsx`: bong bóng nổi + cửa sổ chat (thay vai trò `MessengerChat`). Responsive: mobile mở full-screen.
- `context/ChatContext.tsx`: quản lý state (messages, conversation, unread, trạng thái kết nối), khởi tạo SignalR, gắn `guestId`, expose `sendMessage/openWidget/requestHandoff`.
- `services/chatService.ts`: REST chat (qua `apiClient`/Gateway) + helper khởi tạo phiên.
- `services/chatHub.ts`: bọc `@microsoft/signalr` HubConnection (kết nối `VITE_CHAT_HUB_URL`, tự reconnect — Req 7.4).
- `utils/guestId.ts`: tạo/đọc `kk_chat_guest_id` trong localStorage (Req 1.3); khi đăng nhập thì merge phiên (Req 1.4).
- Provider `ChatProvider` thêm vào `App.tsx` trong nhánh khách (trong `MainLayout`), KHÔNG bọc admin.

#### Nhân viên (Admin)

- `admin/AdminChat.tsx`: layout inbox 2 cột (danh sách hội thoại | khung chat), badge hàng đợi, nút Claim/Close, panel thông tin khách (đơn gần đây).
- Route `/admin/chat` thêm vào `App.tsx` (trong `AdminProtectedRoute`) + mục sidebar trong `AdminLayout` (gác bằng `hasPermission('chat.view')`).
- Dùng chung `services/chatHub.ts` nhưng truyền staff token; `JoinAgentQueue()` để nhận hàng đợi real-time.

#### Thông báo

- Tin mới khi widget đóng → `react-hot-toast` + badge unread (Req 11.1).
- Inbox admin có tin/hàng đợi mới → badge trên sidebar (Req 11.2).

---

## Data Models

### Bảng `CuocHoiThoai` (Conversation)

| Cột (SQL, tiếng Việt) | Kiểu | Thuộc tính C# | Ghi chú |
|---|---|---|---|
| Id | INT IDENTITY PK | Id | |
| NguoiDungId | INT NULL | UserId | NULL nếu khách vãng lai |
| MaKhachVangLai | NVARCHAR(64) NULL | GuestId | định danh guest (localStorage) |
| TenHienThi | NVARCHAR(100) NULL | DisplayName | tên khách (nếu có) |
| TrangThai | NVARCHAR(20) | Status | `bot` / `waiting` / `agent` / `closed` |
| NhanVienId | INT NULL | AssignedStaffId | nhân viên đang xử lý |
| SanPhamNguCanhId | INT NULL | ProductContextId | sản phẩm khách đang xem khi mở chat |
| TinNhanCuoi | NVARCHAR(500) NULL | LastMessagePreview | preview cho inbox |
| ThoiGianTinCuoi | DATETIME2 | LastMessageAt | sắp xếp inbox |
| SoTinChuaDocKhach | INT | UnreadForCustomer | |
| SoTinChuaDocNV | INT | UnreadForAgent | |
| NgayTao | DATETIME2 | CreatedAt | |
| NgayCapNhat | DATETIME2 NULL | UpdatedAt | |

Index: `(TrangThai, ThoiGianTinCuoi DESC)`, `(NguoiDungId)`, `(MaKhachVangLai)`.

### Bảng `TinNhan` (ChatMessage)

| Cột (SQL) | Kiểu | C# | Ghi chú |
|---|---|---|---|
| Id | INT IDENTITY PK | Id | |
| CuocHoiThoaiId | INT FK | ConversationId | → CuocHoiThoai, cascade |
| LoaiNguoiGui | NVARCHAR(20) | SenderType | `customer` / `bot` / `agent` |
| NguoiGuiId | INT NULL | SenderId | userId hoặc staffId (NULL cho bot/guest) |
| NoiDung | NVARCHAR(MAX) | Content | văn bản (escape khi render — Req 14.3) |
| LoaiDinhKem | NVARCHAR(20) NULL | AttachmentType | `product` / `order` / null |
| DinhKemId | NVARCHAR(50) NULL | AttachmentRefId | id sản phẩm/mã đơn |
| DinhKemJson | NVARCHAR(MAX) NULL | AttachmentData | snapshot hiển thị card |
| DaDoc | BIT | IsRead | |
| NgayTao | DATETIME2 | CreatedAt | thứ tự tăng dần (Req 12.5) |

Index: `(CuocHoiThoaiId, Id)`.

### Trạng thái phiên (state machine)

```
        khách mở chat
             │
             ▼
   ┌──────► bot ──────► (handoff) ──────► waiting
   │         ▲                               │ nhân viên claim
   │         │ khách nhắn lại                ▼
   │      closed ◄──────────────────────── agent
   │         ▲   (đóng / idle sweeper)       │
   └─────────┴──────────────────────────────┘
```

- `bot`: chatbot trả lời. `waiting`: trong hàng đợi chờ nhân viên (bot vẫn trả lời cơ bản — Req 6.4). `agent`: nhân viên đang xử lý. `closed`: đã đóng; khách nhắn lại → mở lại (Req 10.4).

### Quan hệ với dữ liệu sẵn có (chatbot chỉ ĐỌC)

- `Orders` / `OrderItems` / `ShippingHistories` → tra cứu đơn (Req 2).
- `Products` / `VariantStocks` → kiểm tra tồn kho biến thể (Req 3).
- `Coupons` → mã giảm giá còn hiệu lực (Req 4).
- `StoreSettings` (+ FAQ config) → chính sách/FAQ (Req 5).

---

## Permissions (RBAC) — khớp cơ chế hiện có

Thêm vào seed `scripts/add-staff-rbac.sql` (nhóm `support`):

| MaQuyen | TenQuyen |
|---|---|
| `chat.view` | Xem hội thoại hỗ trợ |
| `chat.reply` | Trả lời hội thoại |
| `chat.manage` | Quản lý/đóng/gán hội thoại |

- Gán mặc định cho vai trò `admin` (tất cả quyền — đã có sẵn `SELECT @AdminId, Id FROM QuyenHan`) và `sales_staff` (`chat.view`, `chat.reply`).
- Backend: endpoint admin chat dùng `[Authorize(Roles="admin")]` (nhất quán toàn hệ thống hiện tại). Frontend gác hiển thị menu/nút bằng `hasPermission('chat.view'|'chat.reply')`.
- Lưu ý ràng buộc đã biết: vì các controller admin hiện chặn `Roles="admin"`, chỉ super admin (role="admin") thực sự gọi được API admin. Việc nới cho `sales_staff` gọi API chat (theo permission) là một cải tiến RBAC backend **nằm ngoài phạm vi** spec này; ở đây ta giữ đúng hành vi hiện tại và chuẩn bị sẵn permission để bật sau.

---

## Error Handling

- **Kết nối real-time gián đoạn**: SignalR auto-reconnect; khi khôi phục, client gọi `GET messages?beforeId=` để đồng bộ tin lỡ (Req 7.4). REST luôn là fallback gửi/nhận.
- **Truy cập sai chủ sở hữu**: `ChatService` trả 403/404 và không lộ dữ liệu (Req 14.1, 14.2). Khách vãng lai hỏi đơn không mã → bot yêu cầu mã/đăng nhập (Req 2.4).
- **LLM lỗi** (nếu bật): bắt exception → fallback rule-based hoặc đề nghị handoff, không để hội thoại lỗi (Req 13.3).
- **Claim trùng**: `ClaimAsync` dùng cập nhật có điều kiện (`WHERE AssignedStaffId IS NULL`) + kiểm tra rowcount; nếu đã bị claim → trả false, hub báo `ConversationUpdated` để UI nhân viên đồng bộ (Req 10.2).
- **XSS**: nội dung tin hiển thị dạng text thuần (React tự escape); link đính kèm chỉ render từ dữ liệu nội bộ (id sản phẩm/đơn), không nhúng HTML người dùng (Req 14.3).
- **Spam/flood**: rate limit gửi tin theo phiên (ví dụ tối đa N tin/10 giây) ở `ChatService`/hub (Req 14.4).
- **Lỗi chung**: tái dùng `GlobalExceptionHandler` + `ApiResponse` đã có để đồng nhất định dạng lỗi REST.

---

## Configuration

`appsettings.json` (API.Customer), mục `Chat`:

```jsonc
"Chat": {
  "IdleMinutes": 30,            // phiên nguội → auto-close
  "SweepIntervalSeconds": 120,  // chu kỳ ChatIdleSweeper
  "MaxBotFailBeforeHandoff": 2, // bot bí mấy lần thì đề nghị gặp NV (Req 6.2)
  "RateLimitPerWindow": 10,
  "RateLimitWindowSeconds": 10,
  "Llm": { "ApiKey": "", "Endpoint": "", "Model": "" } // rỗng = chạy rule-based
}
```

Frontend `.env`:

```
VITE_CHAT_HUB_URL=http://localhost:5265/hubs/chat
```

Dependencies mới: backend không cần package ngoài (SignalR nằm trong ASP.NET Core). Frontend thêm `@microsoft/signalr`.

---

## Correctness Properties

Các bất biến hệ thống phải luôn đúng (dùng làm cơ sở viết test và review):

### Property 1: Cô lập quyền sở hữu
Một `ChatIdentity` chỉ đọc/ghi được phiên mà `UserId` hoặc `GuestId` của nó khớp với phiên. Không truy vấn chat nào trả về dữ liệu của phiên thuộc người khác.

**Validates: Requirements 14.1, 1.3, 8.2**

### Property 2: Claim độc quyền
Tại mọi thời điểm, một phiên ở trạng thái `agent` có đúng một `AssignedStaffId`. Hai nhân viên không thể cùng claim một phiên (đảm bảo bằng cập nhật điều kiện + kiểm tra rowcount).

**Validates: Requirements 10.2, 6.5**

### Property 3: Bot chỉ chạy ở trạng thái cho phép
Chatbot chỉ sinh phản hồi khi phiên ở `bot` hoặc `waiting`; không bao giờ chen tin khi phiên đang `agent`.

**Validates: Requirements 6.4, 7.1**

### Property 4: Thứ tự tin nhắn
Lịch sử một phiên luôn trả về theo `CreatedAt`/`Id` tăng dần, không trùng, không thiếu sau reconnect.

**Validates: Requirements 12.5, 7.4**

### Property 5: Tính bền vững của tin nhắn
Mọi tin nhắn hiển thị cho người dùng (khách/bot/nhân viên) đều đã được ghi vào `TinNhan` trước khi broadcast; không có tin "ảo" chỉ tồn tại trên client.

**Validates: Requirements 7.6, 12.2**

### Property 6: Chuyển trạng thái hợp lệ
Trạng thái phiên chỉ đi theo các cạnh của state machine đã định nghĩa (bot→waiting→agent→closed, và closed→(bot|waiting) khi mở lại). Không có chuyển trạng thái ngoài đồ thị.

**Validates: Requirements 10.1, 10.4, 6.1**

### Property 7: Đếm chưa đọc nhất quán
`UnreadForCustomer`/`UnreadForAgent` bằng đúng số tin bên kia gửi mà bên này chưa đánh dấu đọc; về 0 sau khi `MarkRead`.

**Validates: Requirements 1.6, 7.3, 11.1**

### Property 8: Bot không rò rỉ dữ liệu
Chatbot không trả thông tin đơn hàng/mã giảm giá khi người hỏi chưa chứng minh quyền sở hữu hoặc khi dữ liệu không đủ điều kiện hiển thị (mã đã tắt/hết lượt/hết hạn).

**Validates: Requirements 2.3, 4.4, 14.2**

## Testing Strategy

- **Unit (backend)**:
  - `RuleBasedChatBot`: từng intent (mã đơn hợp lệ/không thuộc sở hữu/không tồn tại; còn-hết size; coupon còn/hết hiệu lực; FAQ; unknown → handoff).
  - `ChatService`: kiểm tra quyền sở hữu (user vs guest), claim chống trùng, mở lại phiên đã đóng, đánh dấu đã đọc, rate limit.
  - State machine: các chuyển trạng thái hợp lệ/không hợp lệ.
- **Integration**: REST endpoints (tạo phiên, gửi tin, lịch sử theo thứ tự thời gian, handoff, inbox admin yêu cầu auth). Migration áp dụng sạch trên DB test.
- **Real-time**: kịch bản hub 2 client (khách + nhân viên) — gửi/nhận, typing, read receipt, reconnect đồng bộ tin lỡ.
- **Frontend**: ChatWidget mở/đóng, badge unread, gắn guestId, merge phiên khi đăng nhập; AdminChat hiển thị hàng đợi + claim.
- **Bảo mật**: khách A không xem được phiên khách B; nội dung có `<script>` hiển thị an toàn; endpoint admin chat từ chối khi không phải role admin.
- Chạy `dotnet build` toàn solution và `npm run build` frontend trước khi coi là hoàn tất; dọn file tạm.
