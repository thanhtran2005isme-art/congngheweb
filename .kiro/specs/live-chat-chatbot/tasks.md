# Implementation Plan — Live Chat & Chatbot

## Overview

Kế hoạch triển khai tính năng hỗ trợ khách hàng 2 tuyến (chatbot → live chat nhân viên) trong `API.Customer` + SignalR + frontend React. Mỗi task được thực thi tuần tự, bám đúng pattern hiện có của dự án (model `[Table]`/`[Column]`, `ApiResponse`, `IHostedService`, `StaffAuthContext`, `apiClient`). Sau mỗi nhóm task chạy `dotnet build` (backend) và `npm run build` (frontend) để kiểm chứng.

## Tasks

## Backend — Data layer

- [x] 1. Tạo models và đăng ký DbContext cho chat
  - Tạo `BACKEND/API.Customer/Models/Conversation.cs` (`[Table("CuocHoiThoai")]`) với đầy đủ cột map tiếng Việt theo design (UserId/GuestId/Status/AssignedStaffId/ProductContextId/LastMessagePreview/LastMessageAt/UnreadForCustomer/UnreadForAgent/CreatedAt/UpdatedAt) và navigation `ICollection<ChatMessage>`.
  - Tạo `BACKEND/API.Customer/Models/ChatMessage.cs` (`[Table("TinNhan")]`) với các cột SenderType/SenderId/Content/AttachmentType/AttachmentRefId/AttachmentData/IsRead/CreatedAt + FK ConversationId.
  - Thêm hằng số trạng thái và loại người gửi (ví dụ static class `ChatStatus` = bot/waiting/agent/closed; `ChatSender` = customer/bot/agent) để tránh "magic string".
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 2. Cập nhật CustomerDbContext + migration
  - Thêm `DbSet<Conversation>` và `DbSet<ChatMessage>` vào `CustomerDbContext`.
  - Trong `OnModelCreating`: cấu hình FK ConversationId (cascade), index `(Status, LastMessageAt)`, `(UserId)`, `(GuestId)`, và `ChatMessage (ConversationId, Id)`.
  - Tạo EF migration `AddChatTables` cho `CustomerDbContext`.
  - Cập nhật file tài liệu `BACKEND/Database/KaitoKid_Database.sql`: thêm định nghĩa bảng `CuocHoiThoai` và `TinNhan` (giữ quy ước tiếng Việt) để đồng bộ với tài liệu schema.
  - _Requirements: 12.1, 12.2, 12.4_

## Backend — DTOs và identity

- [x] 3. Tạo DTOs và kiểu định danh cho chat
  - Tạo `BACKEND/API.Customer/DTOs/ChatDTOs.cs`: `ConversationDto`, `MessageDto`, `ChatAttachment`, `QuickReply`, `SendMessageDto`, `CreateConversationDto`, `ChatInboxFilter`, `PagedResult` (tái dùng `DTOs/PagedResult.cs` nếu đã có).
  - Tạo `ChatIdentity` (record gói `UserId?`, `GuestId?`, `DisplayName?`) và helper phân giải từ `ClaimsPrincipal` + header/body `guestId`.
  - Tạo `ChatActor`/`BotIntent` enum dùng chung.
  - _Requirements: 1.3, 7.5, 12.2, 14.1_

## Backend — Chatbot (rule-based, tách interface)

- [x] 4. Định nghĩa interface bot và khung skill
  - Tạo `BACKEND/API.Customer/Services/Bot/IChatBot.cs` với `RespondAsync(BotContext)` trả `BotReply` (theo design).
  - Tạo `BotContext`/`BotReply`/`IChatSkill` (mỗi skill: `CanHandle(text, ctx)` + `HandleAsync`).
  - _Requirements: 5.4, 13.1_

- [x] 5. Triển khai các skill truy DB (chỉ đọc dữ liệu sẵn có)
- [x] 5.1 OrderLookupSkill — tra cứu đơn hàng
  - Nhận diện mã đơn bằng regex `KK-\d{8}-\w+`; nếu khách đăng nhập và không có mã → liệt kê đơn gần đây của chính họ.
  - Đọc `Orders` (+ `ShippingHistories` khi đang giao); kiểm tra quyền sở hữu: chỉ trả đơn thuộc `ChatIdentity`; khách vãng lai không mã → yêu cầu mã/đăng nhập.
  - Trả `MessageDto` kèm attachment `order` + link trang theo dõi.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 14.2_
- [x] 5.2 StockCheckSkill — kiểm tra tồn kho size/màu
  - Xác định sản phẩm theo `ProductContextId` (đang xem) hoặc khớp tên trong `Products`.
  - Đọc `VariantStocks`, dùng `Available = Stock - Reserved`; trả các biến thể còn hàng, hoặc trả lời cụ thể 1 size+màu; hết hàng → gợi ý sản phẩm tương tự còn hàng + link sản phẩm.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
- [x] 5.3 CouponSkill — mã giảm giá đang chạy
  - Đọc `Coupons` lọc `IsActive`, trong khoảng `StartDate/EndDate`, còn lượt (`UsedCount < UsageLimit`); hiển thị điều kiện (đơn tối thiểu/mức giảm/giảm tối đa/hạn dùng); không lộ mã tắt/hết lượt.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
- [x] 5.4 FaqSkill — chính sách & FAQ
  - Khớp chủ đề (đổi trả/ship/thanh toán/FAQ) từ nội dung cấu hình (`StoreSettings`/trang tĩnh); kèm link trang nội dung nếu có; không khớp → đề nghị handoff.
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6. Triển khai RuleBasedChatBot + quick replies + đếm bot-fail
  - `RuleBasedChatBot.RespondAsync`: chọn skill đầu tiên `CanHandle`; không skill nào khớp → tăng đếm fail, khi vượt `Chat:MaxBotFailBeforeHandoff` thì `ShouldHandoff=true`.
  - Tin mở đầu hội thoại trả về quick replies: tra đơn / tồn kho / mã giảm giá / chính sách / gặp nhân viên.
  - _Requirements: 5.3, 5.4, 6.2, 13.2_

- [x] 7. (Tùy chọn) Khung LlmChatBot + đăng ký DI theo config
  - Tạo `LlmChatBot` cài `IChatBot` gọi HTTP tới endpoint LLM (đọc `Chat:Llm:*`); bắt lỗi → fallback rule-based hoặc đề nghị handoff.
  - Trong `Program.cs`: nếu có `Chat:Llm:ApiKey` đăng ký `LlmChatBot`, ngược lại `RuleBasedChatBot` (giống pattern Email Brevo/Console).
  - _Requirements: 13.1, 13.2, 13.3_

## Backend — Chat service (nghiệp vụ)

- [x] 8. Triển khai IChatService + ChatService
  - Các method theo design: `GetOrCreateAsync`, `AddCustomerMessageAsync`, `AddAgentMessageAsync`, `AddBotMessageAsync`, `GetHistoryAsync`, `RequestHandoffAsync`, `ClaimAsync`, `CloseAsync`, `MarkReadAsync`, `ListForAgentAsync`.
  - Quy tắc: lưu `TinNhan` trước khi trả về; cập nhật `LastMessageAt`/preview/unread; chỉ gọi bot khi trạng thái `bot`/`waiting`.
  - Kiểm tra quyền sở hữu trong mọi truy vấn theo `ChatIdentity` (Property 1).
  - `ClaimAsync`: cập nhật điều kiện `WHERE AssignedStaffId IS NULL` + kiểm tra rowcount để chống claim trùng (Property 2).
  - `CloseAsync` + mở lại khi khách nhắn vào phiên `closed`.
  - Rate limit gửi tin theo phiên (`Chat:RateLimitPerWindow`/`WindowSeconds`).
  - Đăng ký `IChatService` trong `Program.cs`.
  - _Requirements: 6.1, 6.3, 6.4, 6.5, 7.6, 10.1, 10.2, 10.4, 12.5, 14.1, 14.4_

## Backend — Transport (REST + SignalR)

- [x] 9. Tạo ChatController (REST cho khách + admin)
  - Nhóm khách (`[AllowAnonymous]`, tự phân giải identity): tạo/lấy phiên, lịch sử, gửi tin (fallback), handoff, đánh dấu đã đọc.
  - Nhóm admin (`[Authorize(Roles="admin")]`, route `/api/admin/chat/...`): list inbox (lọc trạng thái), chi tiết+lịch sử, claim, reply, close.
  - Trả về dạng `ApiResponse`/`ApiResponse<T>` cho nhất quán.
  - _Requirements: 1.2, 2.x, 6.1, 8.1, 8.2, 8.4, 8.5, 9.2, 9.4, 9.5_

- [x] 10. Tạo ChatHub (SignalR real-time)
  - Tạo `BACKEND/API.Customer/Hubs/ChatHub.cs`: `JoinConversation`, `SendMessage`, `Typing`, `MarkRead`, `JoinAgentQueue` (chỉ token `user_type=staff`), `ClaimConversation`.
  - Broadcast: `ReceiveMessage`, `ConversationUpdated`, `TypingChanged`, `ReadReceipt`, `QueueUpdated`, `HandoffRequested`.
  - Hub gọi `IChatService` để xử lý + lưu, rồi phát tới group `conv:{id}` / `agents`.
  - Xác thực: đọc `access_token` từ query string; phân giải staff vs khách vs guest.
  - _Requirements: 6.2, 6.3, 6.5, 7.1, 7.2, 7.3, 8.3, 8.4, 11.2, 14.5_

- [x] 11. Cấu hình SignalR + JWT cho hub trong Program.cs
  - `builder.Services.AddSignalR();` và `app.MapHub<ChatHub>("/hubs/chat");`.
  - Cấu hình `JwtBearerEvents.OnMessageReceived` đọc `access_token` từ query cho path `/hubs/chat` (để WebSocket truyền token).
  - Đảm bảo CORS policy `AllowFrontend` áp dụng cho hub (đã có origin :5173 + AllowCredentials).
  - _Requirements: 7.1, 14.5_

- [x] 12. Triển khai ChatIdleSweeper (IHostedService)
  - Tạo `BACKEND/API.Customer/Services/ChatIdleSweeper.cs` theo khuôn `PaymentExpirySweeper`: quét mỗi `Chat:SweepIntervalSeconds`, phiên `waiting`/`agent` quá `Chat:IdleMinutes` không hoạt động → đóng (tùy chọn gửi tin tạm biệt) + broadcast cập nhật.
  - Đăng ký `AddHostedService<ChatIdleSweeper>()` trong `Program.cs`.
  - _Requirements: 10.3_

- [x] 13. Thêm cấu hình Chat vào appsettings
  - Thêm mục `Chat` (IdleMinutes, SweepIntervalSeconds, MaxBotFailBeforeHandoff, RateLimit*, Llm{}) vào `appsettings.json` và `appsettings.Development.json` của API.Customer.
  - _Requirements: 10.3, 13.2, 14.4_

## Backend — Gateway routing

- [x] 14. Thêm route chat vào Ocelot
  - Trong `BACKEND/API.Gateway/ocelot.json` thêm route `/api/chat`, `/api/chat/{everything}`, `/api/admin/chat/{everything}` → downstream port 5265 (theo mẫu các route hiện có, đủ method GET/POST/PUT/DELETE/OPTIONS).
  - Ghi chú: hub `/hubs/chat` KHÔNG đi qua Ocelot (frontend kết nối thẳng :5265).
  - _Requirements: 7.1, 8.1_

## Backend — RBAC seed

- [x] 15. Bổ sung permission chat vào RBAC
  - Thêm vào `BACKEND/scripts/add-staff-rbac.sql`: 3 quyền `chat.view`, `chat.reply`, `chat.manage` (nhóm `support`); gán cho vai trò `admin` (đã tự lấy tất cả) và `sales_staff` (`chat.view`, `chat.reply`).
  - _Requirements: 9.1, 9.3_

## Frontend — Hạ tầng chat (khách hàng)

- [x] 16. Cài SignalR client + tiện ích guestId
  - Thêm `@microsoft/signalr` vào `kaito-kid-react` (dependency).
  - Tạo `src/utils/guestId.ts`: tạo/đọc `kk_chat_guest_id` trong localStorage (ổn định qua reload).
  - Thêm `VITE_CHAT_HUB_URL` vào `.env` (mặc định `http://localhost:5265/hubs/chat`).
  - _Requirements: 1.3, 7.4_

- [x] 17. Tạo chatService và chatHub wrapper
  - `src/services/chatService.ts`: REST chat qua `apiClient` (Gateway) — tạo phiên, lịch sử, gửi (fallback), handoff, mark read.
  - `src/services/chatHub.ts`: bọc `HubConnectionBuilder` kết nối `VITE_CHAT_HUB_URL`, `withAutomaticReconnect`, gắn token (khách: access token nếu có; staff: staff token), expose subscribe/send.
  - _Requirements: 7.1, 7.4_

- [x] 18. Tạo ChatContext (state real-time cho khách)
  - `src/context/ChatContext.tsx`: quản lý conversation/messages/unread/connectionState; khởi tạo hub; gắn guestId; merge phiên khi user đăng nhập (Req 1.4); expose `openWidget/sendMessage/requestHandoff/markRead`.
  - Đồng bộ tin lỡ sau reconnect bằng `getHistory(beforeId)`.
  - _Requirements: 1.3, 1.4, 1.5, 7.1, 7.4_

## Frontend — UI khách hàng

- [x] 19. Tạo ChatWidget và tích hợp vào layout khách
  - `src/components/chat/ChatWidget.tsx`: bong bóng nổi + cửa sổ chat; hiển thị lịch sử + lời chào + quick replies; badge unread khi đóng; typing indicator; render attachment dạng card (sản phẩm/đơn); responsive (mobile full-screen).
  - Nội dung tin render text thuần (React tự escape) — không nhúng HTML người dùng (Req 14.3).
  - Bọc `ChatProvider` + đặt `ChatWidget` trong nhánh khách của `App.tsx`/`MainLayout` (KHÔNG ở admin); gỡ/không kích hoạt `MessengerChat` để tránh trùng bong bóng.
  - Tin mới khi widget đóng → `react-hot-toast` + badge.
  - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7, 5.4, 7.2, 7.5, 11.1, 11.3, 14.3_

- [x] 20. Nhận diện ngữ cảnh sản phẩm khi mở chat ở trang chi tiết
  - Khi đang ở `/product/:id`, truyền `productContextId` lúc tạo/mở phiên để bot trả lời đúng sản phẩm.
  - _Requirements: 3.4_

## Frontend — UI nhân viên (Admin)

- [x] 21. Tạo trang AdminChat (Inbox) + routing + sidebar
  - `src/admin/AdminChat.tsx`: layout 2 cột (danh sách hội thoại theo trạng thái chờ/đang xử lý/đã đóng | khung chat); nút Claim/Close; panel thông tin khách (đơn gần đây); badge hàng đợi.
  - Kết nối hub bằng staff token + `JoinAgentQueue()` để nhận hàng đợi/tin real-time.
  - Thêm route `/admin/chat` vào `App.tsx` (trong `AdminProtectedRoute`) và mục menu trong `AdminLayout`, gác bằng `hasPermission('chat.view')`; nút trả lời gác `hasPermission('chat.reply')`.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 10.2, 11.2_

## Kiểm thử & hoàn tất

- [x] 22. Viết test backend
  - Unit: từng skill bot (đơn hợp lệ/không sở hữu/không tồn tại; còn-hết size; coupon còn/hết hiệu lực; FAQ; unknown→handoff); `ChatService` (sở hữu, claim chống trùng, mở lại phiên đóng, mark read, rate limit); state machine.
  - Integration: REST endpoints (tạo phiên, gửi, lịch sử đúng thứ tự, handoff, inbox yêu cầu auth) + migration áp dụng sạch.
  - _Requirements: 2.3, 4.4, 6.5, 10.2, 10.4, 12.5, 14.1, 14.2_

- [x] 23. Kiểm chứng build và dọn dẹp
  - Chạy `dotnet build` toàn solution (`BACKEND/BACKEND.slnx`) và `npm run build` trong `kaito-kid-react`; sửa lỗi nếu có.
  - Kiểm tra 2 client (khách + nhân viên) trao đổi real-time, typing, read receipt, reconnect.
  - Cập nhật README (mục tính năng + roadmap "Chat real-time" → done) và xóa file tạm nếu phát sinh.
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

## Task Dependency Graph

```
1 (models)
└─ 2 (dbcontext + migration)
   ├─ 3 (DTOs + identity)
   │  ├─ 4 (IChatBot interface)
   │  │  └─ 5 (skills) ──┬─ 5.1 order
   │  │                  ├─ 5.2 stock
   │  │                  ├─ 5.3 coupon
   │  │                  └─ 5.4 faq
   │  │     └─ 6 (RuleBasedChatBot)
   │  │        └─ 7 (LlmChatBot, optional)
   │  └─ 8 (ChatService)  ← cần 3, 6
   │     ├─ 9 (ChatController REST)
   │     ├─ 10 (ChatHub) ── 11 (SignalR + JWT config)
   │     └─ 12 (ChatIdleSweeper)
   └─ 13 (appsettings Chat)

14 (Ocelot routes)        ← cần 9
15 (RBAC seed)            ← độc lập, cần trước 21 (gác UI)

Frontend:
16 (signalr client + guestId)
└─ 17 (chatService + chatHub)
   └─ 18 (ChatContext)        ← cần 9, 10, 11, 14 ở backend
      ├─ 19 (ChatWidget khách) ── 20 (product context)
      └─ 21 (AdminChat inbox)   ← cần 15

22 (tests)                 ← cần 5–12
23 (build + cleanup)       ← cần tất cả
```

Thứ tự đề xuất: 1→2→3→4→5(.1–.4)→6→8→9→10→11→12→13→14→15 (backend xong, build), rồi 16→17→18→19→20→21 (frontend), cuối cùng 7 (tùy chọn), 22, 23.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "description": "Models chat" },
    { "wave": 2, "tasks": ["2", "13", "15"], "description": "DbContext+migration, appsettings, RBAC seed (độc lập)" },
    { "wave": 3, "tasks": ["3"], "description": "DTOs + ChatIdentity" },
    { "wave": 4, "tasks": ["4"], "description": "Interface bot + khung skill" },
    { "wave": 5, "tasks": ["5.1", "5.2", "5.3", "5.4"], "description": "Các skill truy DB (song song)" },
    { "wave": 6, "tasks": ["6"], "description": "RuleBasedChatBot" },
    { "wave": 7, "tasks": ["8"], "description": "ChatService" },
    { "wave": 8, "tasks": ["9", "10", "12"], "description": "REST controller, Hub, IdleSweeper" },
    { "wave": 9, "tasks": ["11", "14"], "description": "Cấu hình SignalR/JWT, Ocelot routes" },
    { "wave": 10, "tasks": ["16"], "description": "SignalR client + guestId" },
    { "wave": 11, "tasks": ["17"], "description": "chatService + chatHub wrapper" },
    { "wave": 12, "tasks": ["18"], "description": "ChatContext" },
    { "wave": 13, "tasks": ["19", "21"], "description": "ChatWidget khách + AdminChat inbox" },
    { "wave": 14, "tasks": ["20"], "description": "Ngữ cảnh sản phẩm" },
    { "wave": 15, "tasks": ["7"], "description": "LlmChatBot (tùy chọn)" },
    { "wave": 16, "tasks": ["22", "23"], "description": "Test + build + cleanup" }
  ]
}
```

## Notes

- **SignalR thẳng cổng 5265**: hub `/hubs/chat` không qua Ocelot; chỉ REST `/api/chat/**` đi qua Gateway. Frontend dùng `VITE_CHAT_HUB_URL` riêng.
- **RBAC khớp thực tế**: endpoint admin chat dùng `[Authorize(Roles="admin")]` (nhất quán toàn hệ thống hiện tại); permission `chat.*` seed sẵn để gác UI và bật mở rộng sau. Nới cho `sales_staff` gọi API admin nằm ngoài phạm vi spec này.
- **Chatbot chỉ ĐỌC** dữ liệu sẵn có (Orders/VariantStocks/Coupons/StoreSettings); không thay đổi nghiệp vụ đơn/kho/coupon.
- **Task 7 (LLM) là tùy chọn**: mặc định chạy rule-based; chỉ bật khi có `Chat:Llm:ApiKey`.
- **Thay widget Facebook**: ngưng kích hoạt `MessengerChat` khi bật `ChatWidget` để tránh trùng 2 bong bóng (giữ file cũ, không xóa).
- Mỗi task chỉ đụng code; không chạy lệnh phá hủy. Migration áp dụng qua `dotnet ef` trên DB dev.
