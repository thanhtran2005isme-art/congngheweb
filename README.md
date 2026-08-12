<div align="center">

# 🎩 KAITO KID SHOP

### Nền tảng thương mại điện tử thời trang hiện đại

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Active-success)](https://github.com/thanhtran2005isme-art/kaitokidshop)
[![GitHub stars](https://img.shields.io/github/stars/thanhtran2005isme-art/kaitokidshop?style=social)](https://github.com/thanhtran2005isme-art/kaitokidshop)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![SQL Server](https://img.shields.io/badge/SQL_Server-2022-CC2927?logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

<p align="center">
  <strong>Một hệ thống e-commerce hoàn chỉnh với kiến trúc microservices, giao diện hiện đại và hệ thống quản trị mạnh mẽ.</strong>
</p>

[Demo](#-demo) • [Tính năng](#-tính-năng-nổi-bật) • [Cài đặt](#-hướng-dẫn-cài-đặt) • [Tech Stack](#-công-nghệ-sử-dụng) • [Architecture](#-kiến-trúc-hệ-thống)

</div>

---

## 📌 Giới thiệu

**Kaito Kid Shop** là một nền tảng thương mại điện tử thời trang hoàn chỉnh, được xây dựng theo mô hình **Microservices** với 4 service backend độc lập, hệ thống Gateway thống nhất và frontend SPA hiện đại sử dụng React + TypeScript.

Dự án mô phỏng đầy đủ các tính năng của một sàn thương mại điện tử thực tế như Shopee, Lazada với:
- 🛍️ Hệ thống mua sắm đa dạng cho Nam, Nữ, Trẻ em
- 🎯 Gợi ý sản phẩm thông minh dựa trên hành vi người dùng
- ⚡ Flash Sale theo thời gian thực với countdown
- 📊 Dashboard quản trị chuyên nghiệp với biểu đồ
- 🔐 Xác thực JWT với refresh token

---

## ✨ Tính năng nổi bật

### 🛒 Phía khách hàng
- **🏠 Trang chủ động**: Banner xoay, sản phẩm mới, bán chạy, sale, gợi ý cá nhân hóa
- **🔍 Tìm kiếm thông minh**: Tracking lịch sử tìm kiếm để gợi ý sản phẩm
- **👀 Lịch sử xem**: Tự động ghi nhớ sản phẩm đã xem để đề xuất tương tự
- **🛍️ Lọc đa tiêu chí**: Theo danh mục, giới tính, kích cỡ, màu sắc, giá
- **❤️ Wishlist**: Yêu thích sản phẩm, đồng bộ với backend
- **🛒 Giỏ hàng**: Quản lý giỏ hàng theo session + backend
- **💳 Thanh toán đa kênh**: COD, chuyển khoản, ATM
- **📦 Tracking đơn hàng**: Theo dõi trạng thái đơn hàng real-time
- **⭐ Đánh giá sản phẩm**: Sau khi giao hàng thành công
- **⚡ Flash Sale**: Hiển thị động khi có chương trình, countdown timer
- **🎫 Mã giảm giá**: Áp dụng coupon, voucher khi thanh toán
- **👤 Quản lý tài khoản**: Profile, địa chỉ, lịch sử đơn hàng
- **💬 Hỗ trợ trực tuyến**: Chatbot 24/7 (tra đơn, kiểm tra tồn kho, mã giảm giá, chính sách) + live chat với nhân viên khi cần

### 🎯 Phía quản trị (Admin)
- **📊 Dashboard**: Thống kê doanh thu, đơn hàng, khách hàng theo ngày/tháng/năm
- **📦 Quản lý sản phẩm**: CRUD đầy đủ với hình ảnh, biến thể, SEO
- **🏷️ Danh mục & Thuộc tính**: Tổ chức sản phẩm theo cây danh mục, màu sắc, size
- **📋 Quản lý đơn hàng**: Cập nhật trạng thái, ghi chú admin
- **👥 Quản lý khách hàng**: Active/Inactive, xem orderCount, totalSpent
- **🎁 Khuyến mãi**: Coupon, Flash Sale, Promotion
- **🖼️ Banner & Trang chủ**: Quản lý layout, banner, menu, lookbook
- **📈 Báo cáo**: Biểu đồ doanh thu, top sản phẩm, thống kê chi tiết
- **🎨 Bộ sưu tập**: Tạo collection, link sản phẩm
- **📦 Kho hàng**: Quản lý tồn kho, lịch sử xuất nhập, cảnh báo
- **💬 Hỗ trợ chat**: Inbox tiếp nhận hội thoại, nhận phiên, trả lời real-time, đóng phiên (RBAC: chat.view/reply)
- **⚙️ Cài đặt**: Cấu hình cửa hàng, thông tin chung

---

## 🏗️ Kiến trúc hệ thống

### Microservices Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React + Vite)                │
│                    http://localhost:5173                │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  API Gateway (Ocelot)                   │
│                   http://localhost:5155                 │
└─────┬──────────────┬──────────────┬─────────────────────┘
      │              │              │
      ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│ API.Auth │   │API.Admin │   │API.Customer│
│   5053   │   │   5089   │   │   5265    │
└─────┬────┘   └────┬─────┘   └─────┬─────┘
      │             │                │
      └─────────────┴────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │  SQL Server   │
            │   KaitoKid    │
            └───────────────┘
```

### Backend Services

| Service | Port | Trách nhiệm |
|---------|------|-------------|
| **API.Gateway** | 5155 | Cửa ngõ duy nhất, định tuyến request đến các service |
| **API.Auth** | 5053 | Đăng ký, đăng nhập, JWT, refresh token, đổi mật khẩu |
| **API.Admin** | 5089 | Quản trị: sản phẩm, đơn hàng, khách hàng, báo cáo, kho |
| **API.Customer** | 5265 | Phía khách: giỏ hàng, đơn hàng, wishlist, đánh giá |

### Frontend Modules

```
kaito-kid-react/
├── src/
│   ├── admin/         # 25+ trang quản trị
│   ├── pages/         # 19 trang khách hàng
│   ├── components/    # Component dùng chung
│   ├── context/       # AuthContext, CartContext
│   ├── services/api/  # 25+ API services
│   ├── utils/         # Helpers, validators, trackers
│   ├── styles/        # CSS theo module
│   └── types/         # TypeScript definitions
```

---

## 💻 Công nghệ sử dụng

### Frontend
<p align="left">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/React_Router-6-CA4245?logo=reactrouter&logoColor=white" />
  <img src="https://img.shields.io/badge/Axios-1-5A29E4?logo=axios&logoColor=white" />
  <img src="https://img.shields.io/badge/Recharts-2-FF6384" />
  <img src="https://img.shields.io/badge/React_Hot_Toast-2-FF4154" />
</p>

### Backend
<p align="left">
  <img src="https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white" />
  <img src="https://img.shields.io/badge/ASP.NET_Core-10-512BD4?logo=dotnet&logoColor=white" />
  <img src="https://img.shields.io/badge/Entity_Framework-Core-68217A?logo=dotnet&logoColor=white" />
  <img src="https://img.shields.io/badge/Ocelot_Gateway-22-512BD4" />
  <img src="https://img.shields.io/badge/JWT_Bearer-Auth-000000?logo=jsonwebtokens&logoColor=white" />
  <img src="https://img.shields.io/badge/BCrypt-Hash-blue" />
</p>

### Database
<p align="left">
  <img src="https://img.shields.io/badge/SQL_Server-2022-CC2927?logo=microsoftsqlserver&logoColor=white" />
  <img src="https://img.shields.io/badge/Migrations-EF_Core-68217A" />
</p>

---

## 🚀 Hướng dẫn cài đặt

### Yêu cầu môi trường

- **Node.js** 18+ và npm
- **.NET SDK** 10.0+
- **SQL Server** 2019+ (LocalDB hoặc full)
- **Git**

### 1️⃣ Clone repository

```bash
git clone https://github.com/thanhtran2005isme-art/kaitokidshop.git
cd kaitokidshop
```

### 2️⃣ Cài đặt Database

```bash
# Cập nhật connection string trong appsettings.json của các service

# Chạy migrations
cd BACKEND/API.Auth
dotnet ef database update

cd ../API.Admin
dotnet ef database update

cd ../API.Customer
dotnet ef database update
```

### 3️⃣ Chạy Backend (mở 4 terminal)

```bash
# Terminal 1: API.Gateway
cd BACKEND/API.Gateway
dotnet run

# Terminal 2: API.Auth
cd BACKEND/API.Auth
dotnet run

# Terminal 3: API.Admin
cd BACKEND/API.Admin
dotnet run

# Terminal 4: API.Customer
cd BACKEND/API.Customer
dotnet run
```

### 4️⃣ Chạy Frontend

```bash
cd kaito-kid-react
npm install
npm run dev
```

### 5️⃣ Truy cập

- 🌐 **Frontend**: http://localhost:5173
- 🚪 **API Gateway**: http://localhost:5155
- 🔧 **Admin Dashboard**: http://localhost:5173/admin (yêu cầu role admin)

---

## 📸 Demo

### 🏠 Trang chủ
> Hero banner, sản phẩm mới, gợi ý cá nhân hóa, flash sale động

### 🛍️ Trang sản phẩm
> Lọc đa tiêu chí theo danh mục, size, màu, giá - 3 trang Nam/Nữ/Trẻ em

### 🛒 Giỏ hàng & Thanh toán
> Áp mã giảm giá, chọn địa chỉ, thanh toán đa phương thức (COD, ATM, chuyển khoản)

### 📊 Admin Dashboard
> Biểu đồ doanh thu, top sản phẩm, thống kê đơn hàng, báo cáo theo ngày/tháng/năm

---

## 🎨 Tính năng nổi bật về UX

### 🎯 Hệ thống gợi ý thông minh (Shopee-like)
Theo dõi hành vi người dùng để đưa ra đề xuất phù hợp:

```
1. Sản phẩm xem gần đây  → "Tương tự áo X bạn vừa xem"
2. Danh mục yêu thích    → "Dành cho bạn yêu thích Áo"
3. Lịch sử tìm kiếm       → "Liên quan đến quần jean bạn đã tìm"
4. Đơn hàng đã mua        → "Dựa trên đơn hàng đã mua"
5. Wishlist               → "Dựa trên sản phẩm bạn yêu thích"
6. Fallback              → Sản phẩm bán chạy
```

### ⚡ Flash Sale động
- Chỉ hiển thị khi có chương trình **active**
- Countdown timer real-time
- Tự động ẩn khi hết giờ
- Progress bar "Đã bán X / Tổng Y"

### 🔐 Bảo mật
- JWT Bearer authentication
- Refresh token tự động
- BCrypt password hashing
- Role-based authorization (admin/user)
- Phân quyền theo route

---

## 📂 Cấu trúc dự án

```
kaitokidshop/
├── 📁 BACKEND/                 # .NET Backend
│   ├── 📁 API.Gateway/         # Ocelot Gateway
│   ├── 📁 API.Auth/            # Authentication service
│   ├── 📁 API.Admin/           # Admin management service
│   ├── 📁 API.Customer/        # Customer-facing service
│   ├── 📁 Database/            # SQL scripts
│   └── 📄 BACKEND.slnx         # Solution file
│
├── 📁 kaito-kid-react/         # React Frontend
│   ├── 📁 src/
│   │   ├── 📁 admin/           # 25+ admin pages
│   │   ├── 📁 pages/           # 19 customer pages
│   │   ├── 📁 components/      # Reusable components
│   │   ├── 📁 services/        # API clients
│   │   ├── 📁 context/         # React contexts
│   │   ├── 📁 utils/           # Helpers
│   │   └── 📁 types/           # TypeScript types
│   ├── 📄 package.json
│   └── 📄 vite.config.ts
│
└── 📄 README.md
```

---

## 🗺️ Roadmap

- [x] Hệ thống microservices với Gateway
- [x] Frontend SPA với React + TypeScript
- [x] Authentication với JWT
- [x] Quản lý sản phẩm, danh mục, thuộc tính
- [x] Giỏ hàng, đơn hàng, đánh giá
- [x] Flash Sale với countdown
- [x] Gợi ý sản phẩm thông minh
- [x] Dashboard admin với biểu đồ
- [x] Quản lý tồn kho
- [x] Live chat + Chatbot hỗ trợ khách hàng (2 tuyến: bot tự động → nhân viên)
- [ ] Tích hợp thanh toán online (VNPay, Momo)
- [ ] Push notifications
- [x] Chat real-time với khách hàng
- [ ] Mobile app (React Native)
- [ ] AI recommendation engine

---

## 📊 Thống kê dự án

<div align="center">

![Stats](https://img.shields.io/badge/Backend_Services-4-blue)
![Stats](https://img.shields.io/badge/Admin_Pages-25+-purple)
![Stats](https://img.shields.io/badge/Customer_Pages-19-green)
![Stats](https://img.shields.io/badge/API_Endpoints-100+-orange)
![Stats](https://img.shields.io/badge/Database_Tables-30+-red)
![Stats](https://img.shields.io/badge/Lines_of_Code-50K+-yellow)

</div>

---

## 🤝 Đóng góp

Dự án rất hoan nghênh mọi đóng góp! Bạn có thể:

1. Fork dự án
2. Tạo branch mới (`git checkout -b feature/AmazingFeature`)
3. Commit thay đổi (`git commit -m 'Add some AmazingFeature'`)
4. Push lên branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

---

## 📝 License

Dự án được phát hành dưới giấy phép **MIT License**. Xem file `LICENSE` để biết chi tiết.

---

## 👨‍💻 Tác giả

<div align="center">

**Thanh Tran**

[![GitHub](https://img.shields.io/badge/GitHub-thanhtran2005isme--art-181717?logo=github&logoColor=white)](https://github.com/thanhtran2005isme-art)

</div>

---

<div align="center">

### ⭐ Nếu bạn thấy dự án hữu ích, hãy cho một star nhé!

<sub>Made with ❤️ in Vietnam</sub>

</div>
#   c o n g n g h e w e b  
 