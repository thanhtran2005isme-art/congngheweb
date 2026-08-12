# GIẢI THÍCH CÁC ĐOẠN CSS QUAN TRỌNG

## 1. CSS Variables (Biến CSS) - `:root`

```css
:root {
    --bodyBack: #00827f;
    --textColor: #1b2741;
    --starColor: #f67034;
    --sectionBack: #f7f6f9;
}
```

**Giải thích:**
- `:root` là pseudo-class đại diện cho phần tử gốc của document (thẻ `<html>`)
- `--tên-biến` là cách khai báo biến CSS
- Dùng biến bằng cách: `color: var(--textColor);`
- **Lợi ích:** Dễ thay đổi màu sắc toàn bộ website chỉ cần sửa 1 chỗ

---

## 2. Flexbox

```css
.namePrice {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
```

**Giải thích:**
- `display: flex` - Biến container thành flex container
- `justify-content: space-between` - Căn các phần tử con ra 2 đầu, khoảng cách đều giữa chúng
- `align-items: center` - Căn giữa theo chiều dọc

**Các giá trị justify-content phổ biến:**
- `flex-start` - Căn về đầu
- `flex-end` - Căn về cuối
- `center` - Căn giữa
- `space-between` - Khoảng cách đều, không có ở 2 đầu
- `space-around` - Khoảng cách đều, có ở 2 đầu

---

## 3. CSS Grid

```css
.sanphams {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 30px;
}
```

**Giải thích:**
- `display: grid` - Biến container thành grid container
- `grid-template-columns` - Định nghĩa số cột và kích thước
- `repeat(auto-fill, minmax(250px, 1fr))`:
  - `auto-fill` - Tự động tạo nhiều cột nhất có thể
  - `minmax(250px, 1fr)` - Mỗi cột tối thiểu 250px, tối đa 1fr (chia đều)
- `gap: 30px` - Khoảng cách giữa các ô

---

## 4. Box Shadow

```css
.sanpham {
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
}
```

**Giải thích:** `box-shadow: X Y blur spread color`
- `0` - Độ lệch ngang (X)
- `4px` - Độ lệch dọc (Y) - bóng đổ xuống dưới
- `15px` - Độ mờ (blur)
- `rgba(0,0,0,0.15)` - Màu đen với độ trong suốt 15%

---

## 5. Transition (Hiệu ứng chuyển đổi)

```css
.sanpham {
    transition: transform 0.3s ease;
}

.sanpham:hover {
    transform: translateY(-10px);
}
```

**Giải thích:**
- `transition: thuộc-tính thời-gian kiểu-chuyển-động`
- `transform 0.3s ease` - Hiệu ứng transform diễn ra trong 0.3 giây với kiểu ease
- `transform: translateY(-10px)` - Di chuyển lên trên 10px khi hover

**Các kiểu transition:**
- `ease` - Chậm đầu, nhanh giữa, chậm cuối
- `linear` - Đều từ đầu đến cuối
- `ease-in` - Chậm đầu
- `ease-out` - Chậm cuối
- `ease-in-out` - Chậm đầu và cuối

---

## 6. Position

```css
.header-menu {
    position: sticky;
    top: 0;
    z-index: 999;
}
```

**Giải thích:**
- `position: sticky` - Dính ở vị trí khi scroll đến
- `top: 0` - Dính ở đầu trang
- `z-index: 999` - Thứ tự xếp chồng (số lớn = ở trên)

**Các loại position:**
- `static` - Mặc định, theo luồng document
- `relative` - Tương đối so với vị trí gốc
- `absolute` - Tuyệt đối so với parent có position
- `fixed` - Cố định so với viewport
- `sticky` - Kết hợp relative và fixed

---

## 7. Pseudo-elements (::before, ::after)

```css
.menu-1 ul li a::after {
    content: "";
    position: absolute;
    width: 0;
    height: 2px;
    background: #ffda79;
    bottom: 0;
    left: 50%;
    transition: all 0.3s ease;
}

.menu-1 ul li a:hover::after {
    width: 100%;
    left: 0;
}
```

**Giải thích:**
- `::after` - Tạo phần tử giả sau nội dung
- `::before` - Tạo phần tử giả trước nội dung
- `content: ""` - BẮT BUỘC phải có, dù rỗng
- Hiệu ứng: Tạo đường gạch chân mở rộng từ giữa ra khi hover

---

## 8. Media Queries (Responsive)

```css
@media (max-width: 768px) {
    .sanphams {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }
}

@media (max-width: 480px) {
    .sanphams {
        grid-template-columns: 1fr;
    }
}
```

**Giải thích:**
- `@media (max-width: 768px)` - Áp dụng khi màn hình ≤ 768px (tablet)
- `@media (max-width: 480px)` - Áp dụng khi màn hình ≤ 480px (mobile)

**Breakpoints phổ biến:**
- `1200px` - Desktop lớn
- `1024px` - Desktop/Tablet ngang
- `768px` - Tablet dọc
- `480px` - Mobile

---

## 9. Linear Gradient

```css
.btn-submit {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**Giải thích:**
- `linear-gradient(góc, màu1 vị-trí1, màu2 vị-trí2)`
- `135deg` - Góc gradient (từ trên trái xuống dưới phải)
- `#667eea 0%` - Màu tím nhạt ở đầu
- `#764ba2 100%` - Màu tím đậm ở cuối

---

## 10. Transform

```css
.buy button:hover {
    transform: scale(1.05);
}

.search.active .btn {
    transform: translateX(140px);
}
```

**Giải thích:**
- `scale(1.05)` - Phóng to 105%
- `translateX(140px)` - Di chuyển sang phải 140px
- `translateY(-10px)` - Di chuyển lên trên 10px
- `rotate(180deg)` - Xoay 180 độ

---

## 11. Overflow

```css
.text-sp {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    text-overflow: ellipsis;
}
```

**Giải thích:**
- Giới hạn text hiển thị tối đa 3 dòng
- `overflow: hidden` - Ẩn phần text thừa
- `text-overflow: ellipsis` - Thêm dấu "..." ở cuối

---

## 12. Border-radius

```css
.buy button {
    border-radius: 20px;      /* Bo tròn 4 góc */
}

.btn {
    border-radius: 50%;       /* Bo tròn thành hình tròn */
}

.sanpham {
    border-radius: 15px;      /* Bo góc vừa phải */
}
```

**Giải thích:**
- `border-radius: 50%` - Tạo hình tròn (khi width = height)
- `border-radius: 20px` - Bo góc 20px
- `border-radius: 10px 20px 30px 40px` - Bo 4 góc khác nhau (trên-trái, trên-phải, dưới-phải, dưới-trái)

---

## 13. Keyframes Animation

```css
@keyframes fadeIn {
    from { 
        opacity: 0; 
        transform: translateY(10px); 
    }
    to { 
        opacity: 1; 
        transform: translateY(0); 
    }
}

.auth-form.active {
    animation: fadeIn 0.3s ease;
}
```

**Giải thích:**
- `@keyframes tên-animation` - Định nghĩa animation
- `from` / `0%` - Trạng thái bắt đầu
- `to` / `100%` - Trạng thái kết thúc
- `animation: tên thời-gian kiểu` - Áp dụng animation

---

## 14. Object-fit

```css
.sanpham .image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
```

**Giải thích:**
- `object-fit: cover` - Ảnh phủ kín container, có thể bị cắt
- `object-fit: contain` - Ảnh nằm gọn trong container, có thể có khoảng trống
- `object-fit: fill` - Ảnh kéo giãn để phủ kín (có thể méo)

---

## 15. Cursor

```css
.buy button {
    cursor: pointer;
}
```

**Giải thích:**
- `cursor: pointer` - Con trỏ hình bàn tay (clickable)
- `cursor: default` - Con trỏ mặc định
- `cursor: not-allowed` - Con trỏ cấm
- `cursor: grab` - Con trỏ nắm tay

---

## TÓM TẮT CÁC THUỘC TÍNH HAY BỊ HỎI

| Thuộc tính | Công dụng |
|------------|-----------|
| `display: flex` | Bố cục linh hoạt 1 chiều |
| `display: grid` | Bố cục lưới 2 chiều |
| `position: sticky` | Dính khi scroll |
| `position: absolute` | Định vị tuyệt đối |
| `z-index` | Thứ tự xếp chồng |
| `transition` | Hiệu ứng chuyển đổi mượt |
| `transform` | Biến đổi (scale, translate, rotate) |
| `box-shadow` | Đổ bóng |
| `border-radius` | Bo góc |
| `@media` | Responsive design |
| `::before/::after` | Tạo phần tử giả |
| `:hover` | Trạng thái khi rê chuột |
| `var(--tên)` | Sử dụng biến CSS |
