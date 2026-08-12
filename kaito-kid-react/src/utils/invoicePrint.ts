// Tạo cửa sổ in hoá đơn — user bấm Ctrl+P / Save as PDF.
// Tránh thêm dependency QuestPDF/PDFKit ở backend cho việc đơn thuần là một bản in.

import { formatCurrency, formatDate } from './format';
import type { CustomerOrderDTO } from '../services/api';

export function openInvoicePrintWindow(order: CustomerOrderDTO) {
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) {
    alert('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up và thử lại.');
    return;
  }

  const itemsHtml = order.items
    .map(
      (i) => `
        <tr>
          <td>
            <div class="prod-name">${escape(i.productName)}</div>
            <div class="prod-meta">${escape(i.color)}${i.size ? ' / ' + escape(i.size) : ''}</div>
          </td>
          <td class="num">${i.quantity}</td>
          <td class="num">${formatCurrency(i.price)}</td>
          <td class="num">${formatCurrency(i.price * i.quantity)}</td>
        </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Hoá đơn ${escape(order.orderCode || String(order.id))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 40px; max-width: 800px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; border-bottom: 3px solid #ec4899; padding-bottom: 16px; margin-bottom: 24px; }
  header .brand h1 { margin: 0; font-size: 24px; color: #be185d; letter-spacing: 1px; }
  header .brand p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
  header .meta { text-align: right; font-size: 13px; color: #475569; }
  header .meta .order-code { font-size: 18px; font-weight: 700; color: #0f172a; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; margin: 0 0 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .info-block { background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; background: #0f172a; color: #fff; padding: 10px 12px; font-size: 13px; }
  td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
  td.num, th.num { text-align: right; }
  .prod-name { font-weight: 600; color: #0f172a; }
  .prod-meta { color: #64748b; font-size: 12px; margin-top: 2px; }
  .totals { margin-left: auto; width: 360px; font-size: 13px; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 0; }
  .totals .row.bold { font-size: 16px; font-weight: 700; color: #dc2626; padding-top: 12px; border-top: 2px solid #0f172a; }
  footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; }
  .badge {
    display: inline-block; padding: 2px 10px; border-radius: 999px;
    background: #dcfce7; color: #166534;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
  }
  @media print {
    body { padding: 20px; }
    button { display: none; }
  }
  .print-bar { text-align: right; margin-bottom: 20px; }
  .print-bar button {
    padding: 10px 20px; background: #0f172a; color: #fff; border: none; border-radius: 6px;
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
</style>
</head>
<body>
  <div class="print-bar">
    <button onclick="window.print()">In / Lưu PDF</button>
  </div>

  <header>
    <div class="brand">
      <h1>KAITO KID</h1>
      <p>123 Nguyễn Huệ, Q.1, TP.HCM · 0901 234 567</p>
    </div>
    <div class="meta">
      <div class="order-code">#${escape(order.orderCode || String(order.id))}</div>
      <div>Ngày đặt: ${formatDate(order.createdAt)}</div>
      <div>Trạng thái: <span class="badge">${escape(statusLabel(order.status))}</span></div>
    </div>
  </header>

  <div class="info-grid">
    <div>
      <h2>Người nhận</h2>
      <div class="info-block">
        <strong>${escape(order.customerName)}</strong><br/>
        ${escape(order.customerPhone)}${order.customerEmail ? ' · ' + escape(order.customerEmail) : ''}<br/>
        ${escape(order.customerAddress)}
      </div>
    </div>
    <div>
      <h2>Thanh toán &amp; vận chuyển</h2>
      <div class="info-block">
        Phương thức: <strong>${escape(order.paymentMethod)}</strong><br/>
        Đơn vị vận chuyển: <strong>${escape(order.shippingProvider || '—')}</strong>
        ${order.trackingCode ? '<br/>Mã vận đơn: <strong>' + escape(order.trackingCode) + '</strong>' : ''}
      </div>
    </div>
  </div>

  <h2>Sản phẩm (${order.items.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Sản phẩm</th>
        <th class="num">SL</th>
        <th class="num">Đơn giá</th>
        <th class="num">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>Tạm tính</span><span>${formatCurrency(order.subtotal)}</span></div>
    <div class="row"><span>Phí vận chuyển</span><span>${order.shippingFee === 0 ? 'Miễn phí' : formatCurrency(order.shippingFee)}</span></div>
    ${order.discount > 0 ? '<div class="row"><span>Giảm giá' + (order.couponCode ? ' (' + escape(order.couponCode) + ')' : '') + '</span><span>−' + formatCurrency(order.discount) + '</span></div>' : ''}
    <div class="row bold"><span>Tổng cộng</span><span>${formatCurrency(order.total)}</span></div>
  </div>

  <footer>
    Cảm ơn bạn đã mua sắm tại KaitoKid · Hoá đơn này có giá trị tham khảo, không phải hoá đơn VAT chính thức.
  </footer>

  <script>
    // Tự mở dialog in sau khi page load xong
    setTimeout(function(){ window.print(); }, 300);
  </script>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escape(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'Chờ xác nhận';
    case 'confirmed': return 'Đã xác nhận';
    case 'shipping': return 'Đang giao';
    case 'completed': return 'Hoàn thành';
    case 'cancelled': return 'Đã huỷ';
    default: return status;
  }
}
