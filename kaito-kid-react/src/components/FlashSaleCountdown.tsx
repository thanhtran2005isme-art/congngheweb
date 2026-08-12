// Banner countdown cho trang Sale - hiển thị thời gian còn lại tới khi flash sale kết thúc.
// Tự ẩn khi không có flash sale đang chạy.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PiTimerBold, PiLightningFill, PiCaretRightBold } from 'react-icons/pi';
import { flashSaleApi, type PublicFlashSale } from '../services/api';

function calcRemaining(endDate: string) {
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const ms = Math.max(0, end - now);
  const totalSec = Math.floor(ms / 1000);
  return {
    ms,
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

export default function FlashSaleCountdown() {
  const [sale, setSale] = useState<PublicFlashSale | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    void flashSaleApi.getActive().then((r) => {
      if (alive && r.success && r.data?.active) setSale(r.data);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!sale?.endDate) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [sale?.endDate]);

  if (!sale?.active || !sale.endDate) return null;

  const remaining = calcRemaining(sale.endDate);
  if (remaining.ms === 0) return null;

  void now; // re-render trigger

  const Box = ({ value, label }: { value: number; label: string }) => (
    <div style={{
      background: 'rgba(255,255,255,0.16)',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(255,255,255,0.3)',
      borderRadius: 10,
      padding: '8px 14px',
      minWidth: 64,
      textAlign: 'center',
      color: '#fff',
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {value.toString().padStart(2, '0')}
      </div>
      <div style={{ fontSize: 11, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 60%, #a855f7 100%)',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 24,
      color: '#fff',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      boxShadow: '0 12px 30px rgba(244, 63, 94, 0.35)',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 0.9 }}>
          <PiLightningFill /> Flash Sale đang diễn ra
        </div>
        <h2 style={{ margin: '6px 0 4px', fontSize: 24, fontWeight: 800 }}>
          {sale.name || 'Flash Sale Hôm Nay'}
        </h2>
        <div style={{ fontSize: 13, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
          <PiTimerBold /> Kết thúc vào {new Date(sale.endDate).toLocaleString('vi-VN')}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {remaining.days > 0 && <Box value={remaining.days} label="Ngày" />}
        <Box value={remaining.hours} label="Giờ" />
        <Box value={remaining.minutes} label="Phút" />
        <Box value={remaining.seconds} label="Giây" />
      </div>

      <Link
        to="/?flash-sale=1"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#fff', color: '#dc2626', padding: '10px 18px',
          borderRadius: 999, fontWeight: 700, fontSize: 14, textDecoration: 'none',
          boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
        }}
      >
        Mua ngay <PiCaretRightBold />
      </Link>
    </div>
  );
}
