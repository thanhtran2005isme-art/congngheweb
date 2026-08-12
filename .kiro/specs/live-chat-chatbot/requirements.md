# Requirements Document

## Introduction

Tính năng bổ sung kênh hỗ trợ khách hàng trực tiếp trên website Kaito Kid Shop theo mô hình **2 tuyến** giống các sàn lớn (Shopee, Lazada):

- **Tuyến 1 — Chatbot (24/7)**: xử lý 70–80% câu hỏi lặp lại bằng cách truy thẳng dữ liệu sẵn có của shop (đơn hàng, tồn kho theo size/màu, mã giảm giá, chính sách đổi trả/vận chuyển). Không tốn phí bên thứ ba, trả lời tức thì.
- **Tuyến 2 — Live chat với nhân viên**: tiếp nhận khi chatbot không xử lý được hoặc khách chủ động bấm "Gặp nhân viên" (khiếu nại, đổi trả, tư vấn phối đồ, chốt đơn).

Tính năng tự xây trong hệ thống (không phụ thuộc Facebook Messenger), lưu toàn bộ hội thoại vào CSDL của shop, để nhân viên trả lời ngay trong dashboard admin và để chatbot có thể truy xuất dữ liệu nội bộ.

### Phạm vi tích hợp với hệ thống hiện tại

- Đặt trong **API.Customer** (port 5265), dùng chung `CustomerDbContext` — vì chat gắn chặt với khách hàng, sản phẩm, đơn hàng đã nằm ở service này.
- Tái dùng pattern sẵn có: `ThongBao`/Notification (thông báo + polling), `StaffAuthContext` + RBAC permission claims (nhân viên), background service (auto-close phiên nguội).
- Quy ước CSDL: **tên bảng/cột tiếng Việt**, model C# tiếng Anh map bằng `[Table]`/`[Column]` (giống `Notification`).
- Route mới `/api/chat/**` thêm vào `ocelot.json` của Gateway.

### Quyết định kỹ thuật cần xác nhận (ghi nhận giả định)

Những điểm sau được chốt ở mức requirements theo đề xuất; chi tiết kỹ thuật sẽ làm rõ ở tài liệu Design:

- **Real-time**: ưu tiên SignalR (WebSocket, kết nối thẳng tới API.Customer cho kênh real-time); có phương án dự phòng polling nếu cần đơn giản hóa.
- **Khách vãng lai (chưa đăng nhập)** ĐƯỢC phép chat (dùng `guestId` lưu localStorage), vì đây là kênh chốt đơn quan trọng.
- **Chatbot** triển khai rule-based truy DB ở giai đoạn 1; chừa cửa cắm LLM về sau (bật/tắt bằng config, theo pattern Email/Brevo hiện có).
- **Facebook Messenger widget cũ**: thay thế bằng widget tự xây (giữ lại file cũ nhưng không kích hoạt song song để tránh trùng 2 bong bóng chat).

## Glossary

- **Chatbot (tuyến 1)**: thành phần tự động trả lời câu hỏi lặp lại bằng cách truy dữ liệu nội bộ; không cần nhân viên.
- **Live chat (tuyến 2)**: hội thoại real-time giữa khách và nhân viên hỗ trợ.
- **Escalation (chuyển tiếp)**: hành động chuyển một phiên từ chatbot sang nhân viên.
- **Phiên/Hội thoại (Conversation — `CuocHoiThoai`)**: một chuỗi trao đổi giữa một khách và shop, có trạng thái và lịch sử tin nhắn.
- **Tin nhắn (Message — `TinNhan`)**: một dòng tin trong phiên, do khách, bot hoặc nhân viên gửi.
- **Khách vãng lai (Guest)**: người dùng chưa đăng nhập, được định danh bằng `guestId` lưu localStorage.
- **Hàng đợi (Queue)**: tập các phiên đang chờ nhân viên nhận xử lý.
- **Claim (nhận phiên)**: hành động một nhân viên nhận một phiên để xử lý, khóa không cho người khác nhận trùng.
- **RBAC**: phân quyền theo vai trò/permission của nhân viên (tái dùng permission claim trong JWT staff hiện có).
- **SignalR**: thư viện real-time của ASP.NET Core dùng cho kênh chat.
- **LLM**: mô hình ngôn ngữ lớn, tùy chọn cắm thêm ở giai đoạn sau cho câu hỏi tự do.

---

## Requirements

### Requirement 1: Widget chat cho khách hàng

**User Story:** Là một khách hàng (đã đăng nhập hoặc vãng lai), tôi muốn mở một cửa sổ chat nổi trên mọi trang, để tôi đặt câu hỏi và nhận hỗ trợ ngay mà không rời trang đang xem.

#### Acceptance Criteria

1. WHEN khách truy cập bất kỳ trang nào của website THEN hệ thống SHALL hiển thị một nút chat nổi (bong bóng) ở góc màn hình.
2. WHEN khách bấm vào nút chat THEN hệ thống SHALL mở cửa sổ chat hiển thị lịch sử hội thoại của phiên hiện tại (nếu có) và một lời chào mở đầu.
3. IF khách chưa đăng nhập THEN hệ thống SHALL tạo và lưu một `guestId` ổn định trong localStorage để duy trì phiên chat qua các lần tải lại trang.
4. WHEN khách vãng lai đăng nhập trong lúc đang có phiên chat THEN hệ thống SHALL gắn phiên chat đang mở của `guestId` đó vào tài khoản vừa đăng nhập.
5. WHEN khách gửi một tin nhắn THEN hệ thống SHALL hiển thị tin nhắn đó trong cửa sổ chat ngay lập tức và lưu vào CSDL.
6. WHILE cửa sổ chat đang đóng và có tin nhắn mới chưa đọc THE hệ thống SHALL hiển thị chỉ báo số tin chưa đọc trên nút chat.
7. WHERE thiết bị là màn hình nhỏ (mobile) THE cửa sổ chat SHALL hiển thị ở chế độ phù hợp (toàn màn hình hoặc co giãn) và không che khuất thao tác mua hàng.

---

### Requirement 2: Chatbot tra cứu đơn hàng

**User Story:** Là một khách hàng, tôi muốn hỏi chatbot về tình trạng đơn hàng của tôi, để biết đơn đang ở trạng thái nào mà không cần chờ nhân viên.

#### Acceptance Criteria

1. WHEN khách hỏi về tình trạng đơn hàng và cung cấp mã đơn (ví dụ KK-20250326-XXXX) THEN chatbot SHALL tra cứu trong bảng đơn hàng và trả về trạng thái, ngày đặt, và tổng tiền của đơn.
2. IF khách đã đăng nhập AND không cung cấp mã đơn THEN chatbot SHALL liệt kê các đơn hàng gần đây của chính khách đó để khách chọn.
3. IF mã đơn không tồn tại HOẶC không thuộc về khách đang hỏi THEN chatbot SHALL trả lời không tìm thấy đơn và KHÔNG tiết lộ thông tin đơn của người khác.
4. IF khách là khách vãng lai AND hỏi đơn hàng mà không có mã đơn THEN chatbot SHALL yêu cầu khách cung cấp mã đơn hoặc đăng nhập.
5. WHEN chatbot trả về thông tin đơn THEN chatbot SHALL kèm liên kết tới trang theo dõi đơn hàng tương ứng.
6. WHERE đơn ở trạng thái đang giao THE chatbot SHALL hiển thị thông tin vận chuyển mới nhất nếu có.

---

### Requirement 3: Chatbot kiểm tra tồn kho theo size/màu

**User Story:** Là một khách hàng, tôi muốn hỏi chatbot xem một sản phẩm còn size/màu tôi cần không, để quyết định mua mà không phải tự dò trên trang.

#### Acceptance Criteria

1. WHEN khách hỏi về tồn kho của một sản phẩm (theo tên hoặc khi đang xem trang sản phẩm) THEN chatbot SHALL trả về các biến thể (size/màu) còn hàng của sản phẩm đó.
2. WHEN khách hỏi cụ thể một size và màu THEN chatbot SHALL trả lời còn hàng hoặc hết hàng cho biến thể đó.
3. IF sản phẩm hết hàng toàn bộ THEN chatbot SHALL thông báo hết hàng và gợi ý sản phẩm tương tự còn hàng.
4. WHEN khách đang ở trang chi tiết một sản phẩm và mở chat THEN chatbot SHALL nhận biết ngữ cảnh sản phẩm hiện tại để trả lời chính xác.
5. WHEN chatbot trả về sản phẩm còn hàng THEN chatbot SHALL kèm liên kết tới trang sản phẩm để khách thêm vào giỏ.

---

### Requirement 4: Chatbot tra cứu mã giảm giá đang chạy

**User Story:** Là một khách hàng, tôi muốn hỏi chatbot về các mã giảm giá đang có hiệu lực, để áp dụng khi mua hàng.

#### Acceptance Criteria

1. WHEN khách hỏi về mã giảm giá/khuyến mãi THEN chatbot SHALL liệt kê các mã đang còn hiệu lực (trong khoảng thời gian áp dụng, còn lượt dùng, đang bật).
2. WHEN chatbot liệt kê một mã THEN chatbot SHALL hiển thị điều kiện áp dụng (đơn tối thiểu, mức giảm, giảm tối đa, hạn dùng).
3. IF hiện tại không có mã nào còn hiệu lực THEN chatbot SHALL thông báo chưa có chương trình giảm giá và gợi ý theo dõi trang khuyến mãi.
4. The chatbot SHALL KHÔNG tiết lộ mã bí mật/đã tắt hoặc mã đã hết lượt.

---

### Requirement 5: Chatbot trả lời chính sách & câu hỏi thường gặp (FAQ)

**User Story:** Là một khách hàng, tôi muốn hỏi chatbot về chính sách đổi trả, vận chuyển, thanh toán, để hiểu rõ trước khi mua.

#### Acceptance Criteria

1. WHEN khách hỏi về chính sách đổi trả, phí/thời gian vận chuyển, phương thức thanh toán, hoặc các FAQ khác THEN chatbot SHALL trả lời dựa trên nội dung chính sách/FAQ được cấu hình trong hệ thống.
2. WHERE đã tồn tại trang nội dung tĩnh tương ứng (ví dụ trang chính sách) THE chatbot SHALL kèm liên kết tới trang đó.
3. IF câu hỏi không khớp bất kỳ chủ đề FAQ nào THEN chatbot SHALL đề nghị chuyển sang nhân viên hỗ trợ.
4. WHEN khởi đầu hội thoại THEN chatbot SHALL hiển thị các nút gợi ý nhanh (quick replies) cho các chủ đề phổ biến: tra đơn, kiểm tra tồn kho, mã giảm giá, chính sách, gặp nhân viên.

---

### Requirement 6: Chuyển tiếp từ chatbot sang nhân viên (Escalation)

**User Story:** Là một khách hàng, tôi muốn được chuyển sang nhân viên thật khi chatbot không giải quyết được vấn đề, để được hỗ trợ ca khó.

#### Acceptance Criteria

1. WHEN khách bấm nút "Gặp nhân viên" THEN hệ thống SHALL chuyển phiên chat sang trạng thái chờ nhân viên và đưa vào hàng đợi hỗ trợ.
2. WHEN chatbot không nhận diện được ý định của khách sau một số lần nhất định THEN chatbot SHALL chủ động đề nghị chuyển sang nhân viên.
3. WHEN phiên được chuyển sang nhân viên THEN hệ thống SHALL thông báo cho khách rằng yêu cầu đang được chuyển và hiển thị thời gian chờ ước tính hoặc trạng thái hàng đợi.
4. WHILE chưa có nhân viên nào nhận phiên THE chatbot SHALL vẫn có thể tiếp tục trả lời các câu hỏi cơ bản của khách.
5. WHEN một nhân viên nhận phiên THEN hệ thống SHALL chuyển phiên sang trạng thái "đang được nhân viên xử lý" và thông báo cho khách tên/định danh người hỗ trợ.

---

### Requirement 7: Live chat real-time giữa khách và nhân viên

**User Story:** Là một khách hàng và một nhân viên, chúng tôi muốn trao đổi tin nhắn theo thời gian thực, để hội thoại diễn ra mượt như chat thông thường.

#### Acceptance Criteria

1. WHEN một bên gửi tin nhắn trong phiên đang hoạt động THEN bên kia SHALL nhận được tin nhắn gần như tức thì mà không cần tải lại trang.
2. WHILE bên kia đang soạn tin THE hệ thống SHOULD hiển thị chỉ báo "đang nhập…" (typing indicator).
3. WHEN một tin nhắn được bên nhận xem THEN hệ thống SHALL cập nhật trạng thái đã đọc cho bên gửi.
4. IF kết nối real-time bị gián đoạn THEN hệ thống SHALL tự kết nối lại và đồng bộ các tin nhắn bị lỡ khi khôi phục.
5. WHEN gửi tin nhắn THEN hệ thống SHALL hỗ trợ kèm liên kết sản phẩm hoặc đơn hàng (đính kèm ngữ cảnh) bên cạnh văn bản.
6. The hệ thống SHALL lưu mọi tin nhắn (khách, bot, nhân viên) vào CSDL kèm thời điểm và người gửi.

---

### Requirement 8: Inbox quản lý hội thoại cho nhân viên (Admin)

**User Story:** Là một nhân viên hỗ trợ, tôi muốn có một trang Inbox trong dashboard admin để xem và trả lời tất cả hội thoại, để xử lý hỗ trợ tập trung.

#### Acceptance Criteria

1. WHEN nhân viên mở trang `/admin/chat` THEN hệ thống SHALL hiển thị danh sách hội thoại chia theo trạng thái (chờ xử lý, đang xử lý, đã đóng) và sắp xếp theo tin nhắn mới nhất.
2. WHEN nhân viên chọn một hội thoại THEN hệ thống SHALL hiển thị toàn bộ lịch sử tin nhắn của phiên đó, kèm thông tin khách (tên/định danh, đăng nhập hay vãng lai).
3. WHEN có hội thoại mới trong hàng đợi THEN hệ thống SHALL cập nhật danh sách và hiển thị chỉ báo trên menu chat của admin.
4. WHEN nhân viên gửi trả lời THEN tin nhắn SHALL được gửi real-time tới khách và lưu vào CSDL.
5. WHEN nhân viên đánh dấu một hội thoại là đã đóng/giải quyết THEN hệ thống SHALL chuyển phiên sang trạng thái đóng và cho phép mở lại nếu khách nhắn tiếp.
6. WHERE nhân viên cần ngữ cảnh THE Inbox SHOULD hiển thị nhanh thông tin liên quan của khách (đơn gần đây) để hỗ trợ tư vấn.
7. The trang `/admin/chat` SHALL được thêm vào routing và sidebar admin theo đúng cách các trang admin khác đang làm.

---

### Requirement 9: Phân quyền nhân viên cho chức năng chat (RBAC)

**User Story:** Là quản trị viên, tôi muốn kiểm soát nhân viên nào được xem và trả lời chat, để bảo vệ dữ liệu khách hàng.

#### Acceptance Criteria

1. The hệ thống SHALL định nghĩa các permission cho chat (ví dụ `chat.view`, `chat.reply`, `chat.manage`).
2. WHEN một nhân viên không có permission chat truy cập trang Inbox hoặc API chat của admin THEN hệ thống SHALL từ chối truy cập.
3. WHERE nhân viên là super admin THE hệ thống SHALL cho phép toàn quyền với chức năng chat.
4. The các endpoint chat dành cho nhân viên SHALL yêu cầu xác thực JWT staff và kiểm tra permission tương ứng (theo cơ chế permission claim hiện có).
5. The endpoint chat dành cho khách hàng SHALL KHÔNG yêu cầu permission staff và SHALL hoạt động cho cả khách đăng nhập lẫn vãng lai.

---

### Requirement 10: Hàng đợi, phân công và trạng thái phiên

**User Story:** Là nhân viên/quản lý hỗ trợ, tôi muốn các phiên chờ được quản lý thành hàng đợi và phân công rõ ràng, để không bỏ sót khách và tránh hai người trả lời trùng.

#### Acceptance Criteria

1. The mỗi phiên chat SHALL có một trạng thái rõ ràng: do bot xử lý, chờ nhân viên, đang được nhân viên xử lý, đã đóng.
2. WHEN một nhân viên nhận (claim) một phiên đang chờ THEN hệ thống SHALL gán phiên đó cho nhân viên và ngăn nhân viên khác nhận trùng phiên đó.
3. IF một phiên đang được nhân viên xử lý nhưng không có hoạt động trong một khoảng thời gian cấu hình THEN hệ thống SHALL tự động chuyển phiên về trạng thái phù hợp (ví dụ trả lại hàng đợi hoặc đánh dấu nguội) thông qua background service.
4. WHEN khách gửi tin trong một phiên đã đóng THEN hệ thống SHALL mở lại phiên (hoặc tạo phiên mới liên kết) và đưa vào hàng đợi xử lý.

---

### Requirement 11: Thông báo tin nhắn mới

**User Story:** Là khách hàng và nhân viên, tôi muốn được thông báo khi có tin nhắn mới, để không bỏ lỡ phản hồi.

#### Acceptance Criteria

1. WHEN khách nhận tin nhắn mới từ bot/nhân viên trong khi cửa sổ chat đang đóng THEN hệ thống SHALL hiển thị thông báo (toast và/hoặc badge số chưa đọc).
2. WHEN nhân viên có hội thoại mới hoặc tin mới trong hàng đợi THEN hệ thống SHALL hiển thị chỉ báo trên giao diện admin.
3. The thông báo SHALL tái dùng cơ chế hiển thị hiện có của frontend (toast) để đồng nhất trải nghiệm.
4. WHERE phù hợp THE hệ thống MAY tạo bản ghi thông báo (Notification) cho khách đã đăng nhập về tin nhắn hỗ trợ quan trọng.

---

### Requirement 12: Lưu trữ lịch sử & mô hình dữ liệu

**User Story:** Là chủ shop, tôi muốn toàn bộ hội thoại được lưu lại trong CSDL của shop, để tra cứu, đánh giá chất lượng hỗ trợ và để chatbot/nhân viên có ngữ cảnh.

#### Acceptance Criteria

1. The hệ thống SHALL lưu hội thoại trong bảng (đề xuất `CuocHoiThoai`) gồm tối thiểu: khách (userId hoặc guestId), trạng thái, nhân viên được gán, thời điểm tạo và thời điểm tin nhắn cuối.
2. The hệ thống SHALL lưu từng tin nhắn trong bảng (đề xuất `TinNhan`) gồm tối thiểu: phiên liên kết, loại người gửi (khách/bot/nhân viên), nội dung, đã đọc, đính kèm (link sản phẩm/đơn), thời điểm tạo.
3. The model C# SHALL ánh xạ sang tên bảng/cột tiếng Việt bằng `[Table]`/`[Column]`, đồng nhất với quy ước hiện tại (ví dụ `Notification` → `ThongBao`).
4. The thay đổi schema SHALL được áp dụng qua EF Core migration của `CustomerDbContext`, đồng thời cập nhật script SQL tài liệu nếu dự án duy trì file SQL.
5. WHEN truy vấn lịch sử của một phiên THEN hệ thống SHALL trả về tin nhắn theo thứ tự thời gian tăng dần.

---

### Requirement 13: Khả năng mở rộng chatbot bằng LLM (tùy chọn, giai đoạn sau)

**User Story:** Là chủ shop, tôi muốn có thể nâng cấp chatbot dùng LLM cho câu hỏi tự do về sau, để cải thiện chất lượng trả lời mà không phải viết lại hệ thống.

#### Acceptance Criteria

1. The kiến trúc chatbot SHALL tách biệt phần nhận diện ý định/sinh câu trả lời sau một interface, để có thể thay rule-based bằng LLM mà không đổi phần còn lại.
2. WHERE chưa cấu hình khóa/endpoint LLM THE hệ thống SHALL chạy hoàn toàn bằng rule-based (mặc định), theo đúng pattern bật/tắt bằng config hiện có (ví dụ Email Brevo/Console).
3. IF LLM được bật nhưng gọi thất bại THEN hệ thống SHALL fallback về rule-based hoặc đề nghị gặp nhân viên, KHÔNG để hội thoại rơi vào trạng thái lỗi.

---

### Requirement 14: Bảo mật, riêng tư và chống lạm dụng

**User Story:** Là chủ shop, tôi muốn kênh chat an toàn và không bị lạm dụng, để bảo vệ khách hàng và hệ thống.

#### Acceptance Criteria

1. The hệ thống SHALL chỉ cho phép một khách truy cập hội thoại của chính mình (theo userId hoặc guestId), KHÔNG cho xem hội thoại của người khác.
2. The chatbot SHALL KHÔNG tiết lộ dữ liệu nhạy cảm của đơn hàng/khách hàng khi người hỏi không chứng minh được quyền sở hữu (ví dụ yêu cầu mã đơn cho khách vãng lai).
3. The nội dung tin nhắn do người dùng nhập SHALL được xử lý an toàn khi hiển thị (chống XSS) và khi lưu trữ.
4. WHERE phù hợp THE hệ thống SHOULD giới hạn tần suất gửi tin (rate limit) để chống spam/flood.
5. The kênh real-time SHALL xác thực danh tính (JWT cho khách đăng nhập/nhân viên; định danh guest cho khách vãng lai) trước khi cho tham gia phiên.
