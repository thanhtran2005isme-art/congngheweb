// Trang tài khoản — Gamification edition
// Hiển thị: cấp bậc, điểm thưởng, lộ trình tiến tier, đổi điểm, voucher cá nhân, lịch sử

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PiCrownSimpleFill,
  PiCoinsFill,
  PiCalendarBlankFill,
  PiPhoneFill,
  PiEnvelopeSimple,
  PiUserCircleFill,
  PiPackageFill,
  PiTrendUpBold,
  PiGiftFill,
  PiTicketFill,
  PiClockClockwiseBold,
  PiSignOut,
  PiPencilSimpleLineFill,
  PiCheckCircleFill,
  PiCopyBold,
} from 'react-icons/pi';
import { useAuth } from '../context/AuthContext';
import { accountApi, type AccountDTO, type PointsHistoryDTO, type PersonalVoucher } from '../services/api';
import AvatarUploader from '../components/AvatarUploader';
import { authApi } from '../services/api/authApi';
import { PiShieldCheckBold, PiClockCounterClockwiseBold as PiClockHistory, PiQrCodeBold } from 'react-icons/pi';
import { formatCurrency, formatDate } from '../utils/format';
import toast from 'react-hot-toast';

type TabKey = 'overview' | 'profile' | 'points' | 'vouchers' | 'security';

const TIER_META: Record<string, { color: string; bg: string; icon: string; perks: string[] }> = {
  Member:  { color: '#475569', bg: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)', icon: '🥉', perks: ['Tích điểm 1%', 'Sinh nhật giảm 5%'] },
  Silver:  { color: '#0f172a', bg: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)', icon: '🥈', perks: ['Tích điểm 1.5%', 'Sinh nhật giảm 10%', 'Freeship đơn từ 399k'] },
  Gold:    { color: '#7c2d12', bg: 'linear-gradient(135deg, #fde047 0%, #ca8a04 100%)', icon: '🥇', perks: ['Tích điểm 2%', 'Sinh nhật giảm 15%', 'Freeship đơn từ 299k', 'Tặng quà sinh nhật'] },
  Diamond: { color: '#1e3a8a', bg: 'linear-gradient(135deg, #93c5fd 0%, #6366f1 100%)', icon: '💎', perks: ['Tích điểm 3%', 'Sinh nhật giảm 20%', 'Freeship toàn bộ đơn', 'Quà sinh nhật + Black card', 'Hotline VIP 24/7'] },
};

const REDEEM_TIERS = [
  { points: 100, value: 10_000 },
  { points: 300, value: 35_000 },
  { points: 500, value: 60_000 },
  { points: 1000, value: 130_000 },
];

export default function Account() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<AccountDTO | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  const [editForm, setEditForm] = useState({ name: '', phone: '', birthday: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<PointsHistoryDTO[]>([]);
  const [vouchers, setVouchers] = useState<PersonalVoucher[]>([]);
  const [redeemingPoints, setRedeemingPoints] = useState<number | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const r = await accountApi.getProfile();
    if (r.success && r.data) {
      setProfile(r.data);
      setEditForm({
        name: r.data.name || '',
        phone: r.data.phone || '',
        birthday: r.data.birthday ? r.data.birthday.split('T')[0] : '',
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (activeTab === 'points') {
      void accountApi.getPointsHistory().then((r) => r.success && r.data && setHistory(r.data));
    } else if (activeTab === 'vouchers') {
      void accountApi.getMyVouchers().then((r) => r.success && r.data && setVouchers(r.data));
    }
  }, [activeTab]);

  const handleSave = async () => {
    if (editForm.birthday) {
      const bd = new Date(editForm.birthday);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(bd.getTime())) {
        toast.error('NgNgày sinh không hợp lệ');
        return;
      }
      if (bd > today) {
        toast.error('NgNgày sinh không được ở tương lai');
        return;
      }
      const minYear = new Date();
      minYear.setFullYear(today.getFullYear() - 120);
      if (bd < minYear) {
        toast.error('NgNgày sinh không hợp lệ');
        return;
      }
    }
    setSaving(true);
    const r = await accountApi.updateProfile({
      name: editForm.name || undefined,
      phone: editForm.phone || undefined,
      birthday: editForm.birthday || undefined,
    });
    setSaving(false);
    if (r.success && r.data) {
      setProfile(r.data);
      setEditing(false);
      toast.success('Đã cập nhật thông tin');
    } else {
      toast.error(r.error || 'Cập nhật thất bại');
    }
  };

  const handleAvatarSave = async (blob: Blob) => {
    const r = await accountApi.uploadAvatar(blob);
    if (r.success && r.data) {
      // Backend đã update User.Avatar. Gọi getProfile để có URL mới (kèm cache-bust nhẹ).
      const pr = await accountApi.getProfile();
      if (pr.success && pr.data) setProfile(pr.data);
      toast.success('Đã cập nhật ảnh đại diện');
    } else {
      toast.error(r.error || 'Tải ảnh thất bại');
    }
  };
  const handleRedeem = async (points: number) => {
    if (!profile || profile.loyaltyPoints < points) {
      toast.error('Bạn không đủ điểm');
      return;
    }
    if (!confirm(`Đổi ${points} điểm để lấy voucher giảm ${formatCurrency(points * 100)}?`)) return;
    setRedeemingPoints(points);
    const r = await accountApi.redeemPoints(points);
    setRedeemingPoints(null);
    if (r.success && r.data) {
      toast.success(`Đã tạo voucher ${r.data.couponCode} — giảm ${formatCurrency(r.data.discountValue)}`);
      void loadProfile();
      void accountApi.getMyVouchers().then((vr) => vr.success && vr.data && setVouchers(vr.data));
      setActiveTab('vouchers');
    } else {
      toast.error(r.error || 'Đổi điểm thất bại');
    }
  };

  // Tự động đề xuất voucher sinh nhật khi user vào trang trong tháng sinh.
  useEffect(() => {
    if (!profile?.birthday) return;
    const flag = 'kk-bday-claimed-' + profile.id + '-' + new Date().getFullYear();
    if (sessionStorage.getItem(flag)) return;
    const bd = new Date(profile.birthday);
    if (Number.isNaN(bd.getTime())) return;
    if (bd.getMonth() !== new Date().getMonth()) return;
    sessionStorage.setItem(flag, '1');
    void accountApi.claimBirthdayVoucher().then((r) => {
      if (r.success && r.data) {
        toast.success(r.data.message || 'Đã nhận voucher sinh nhật!');
        void accountApi.getMyVouchers().then((vr) => vr.success && vr.data && setVouchers(vr.data));
      }
      // Im lặng nếu BadRequest (đã claim hoặc không trong tháng) — không làm phiền user
    });
  }, [profile?.id, profile?.birthday]);
  if (loading || !profile) {
    return <div style={{ padding: 80, textAlign: 'center', color: '#64748b' }}>Đang tải tài khoản...</div>;
  }

  const tier = TIER_META[profile.memberTier] || TIER_META.Member;
  const tierPct = profile.nextTierAt > 0
    ? Math.min(100, Math.round((profile.totalSpent / profile.nextTierAt) * 100))
    : 100;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* HEADER CARD */}
      <div style={{
        background: tier.bg,
        borderRadius: 16,
        padding: '28px 32px',
        color: tier.color,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, fontSize: 200, opacity: 0.15 }}>{tier.icon}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 700, color: '#fff',
          }}>
            {(profile.name || 'K').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.85 }}>
              {tier.icon} Thành viên {profile.memberTier}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>
              Xin chào, {profile.name}!
            </div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
              Đã cùng KaitoKid {Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))} ngày
            </div>
          </div>
          <button
            onClick={() => { logout(); window.location.href = '/'; }}
            style={{
              background: 'rgba(0,0,0,0.15)', color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <PiSignOut /> Đăng xuất
          </button>
        </div>

        {/* Tier progress */}
        {profile.amountToNextTier > 0 && profile.nextTier !== profile.memberTier && (
          <div style={{ marginTop: 24, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span><PiTrendUpBold style={{ verticalAlign: -2 }} /> Còn {formatCurrency(profile.amountToNextTier)} để lên hạng <strong>{profile.nextTier}</strong></span>
              <span style={{ fontWeight: 600 }}>{tierPct}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.3)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: '#fff', height: '100%', width: `${tierPct}%`, transition: 'width 0.6s' }} />
            </div>
          </div>
        )}
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, margin: '20px 0' }}>
        <StatCard icon={<PiCoinsFill />} value={profile.loyaltyPoints} label="Điểm thưởng" color="#f59e0b" hint={`= ${formatCurrency(profile.loyaltyPoints * 100)}`} />
        <StatCard icon={<PiPackageFill />} value={profile.totalOrders} label="Đơn hàng" color="#6366f1" />
        <StatCard icon={<PiCrownSimpleFill />} value={profile.memberTier} label="Cấp bậc" color={tier.color} isText />
        <StatCard icon={<PiTicketFill />} value={vouchers.length} label="Voucher cá nhân" color="#ec4899" />
      </div>

      {/* TABS */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
          {([
            ['overview', 'Tổng quan', PiUserCircleFill],
            ['profile', 'Thông tin', PiPencilSimpleLineFill],
            ['points', 'Điểm thưởng', PiCoinsFill],
            ['vouchers', 'Voucher', PiTicketFill],
            ['security', 'Bảo mật', PiShieldCheckBold],
          ] as [TabKey, string, typeof PiUserCircleFill][]).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setActiveTab(k)}
              style={{
                flex: '0 0 auto', padding: '14px 22px', border: 'none',
                background: 'transparent', cursor: 'pointer', fontSize: 14,
                fontWeight: activeTab === k ? 600 : 500,
                color: activeTab === k ? '#ec4899' : '#64748b',
                borderBottom: `2px solid ${activeTab === k ? '#ec4899' : 'transparent'}`,
                marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 28 }}>
          {/* ===== OVERVIEW ===== */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <Card title="Quyền lợi cấp bậc của bạn" icon={<PiCrownSimpleFill style={{ color: '#f59e0b' }} />}>
                <ul style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9, fontSize: 14 }}>
                  {tier.perks.map((p) => (
                    <li key={p}><PiCheckCircleFill style={{ color: '#16a34a', verticalAlign: -3, marginRight: 6 }} />{p}</li>
                  ))}
                </ul>
              </Card>
              <Card title="Lộ trình thăng hạng" icon={<PiTrendUpBold style={{ color: '#6366f1' }} />}>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: '#475569' }}>
                  {profile.memberTier !== 'Diamond' ? (
                    <>
                      Mua thêm <strong style={{ color: '#0f172a' }}>{formatCurrency(profile.amountToNextTier)}</strong> để
                      đạt hạng <strong style={{ color: '#ec4899' }}>{profile.nextTier}</strong>.
                      <br />Mỗi đơn hàng đều được tích vào hạng tiếp theo.
                    </>
                  ) : (
                    <>🎉 Bạn đã đạt hạng cao nhất Diamond!</>
                  )}
                </div>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed #e5e7eb', fontSize: 13, color: '#64748b' }}>
                  <PiCalendarBlankFill style={{ verticalAlign: -2 }} /> Tổng chi tiêu: <strong style={{ color: '#0f172a' }}>{formatCurrency(profile.totalSpent)}</strong>
                </div>
              </Card>
            </div>
          )}

          {/* ===== PROFILE ===== */}
          {activeTab === 'profile' && (
            <div style={{ maxWidth: 600 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Thông tin cá nhân</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Họ và tên" icon={<PiUserCircleFill />}>
                  {editing ? (
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} />
                  ) : <div style={readonly}>{profile.name}</div>}
                </Field>
                <Field label="Số điện thoại" icon={<PiPhoneFill />}>
                  {editing ? (
                    <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={inputStyle} />
                  ) : <div style={readonly}>{profile.phone || '—'}</div>}
                </Field>
                <Field label="Email" icon={<PiEnvelopeSimple />}>
                  <div style={{ ...readonly, color: '#94a3b8' }}>{profile.email}</div>
                </Field>
                <Field label="Ngày sinh" icon={<PiCalendarBlankFill />}>
                  {editing ? (
                    <input type="date" value={editForm.birthday} onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })} style={inputStyle} />
                  ) : (
                    <div style={readonly}>{profile.birthday ? formatDate(profile.birthday).split(' ')[0] : '—'}</div>
                  )}
                </Field>
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
                {editing ? (
                  <>
                    <button onClick={handleSave} disabled={saving} style={primaryBtn}>
                      {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                    <button onClick={() => setEditing(false)} style={secondaryBtn}>Hủy</button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} style={primaryBtn}>
                    <PiPencilSimpleLineFill style={{ marginRight: 6, verticalAlign: -2 }} /> Chỉnh sửa
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ===== POINTS ===== */}
          {activeTab === 'points' && (
            <div>
              <Card title="Đổi điểm lấy voucher" icon={<PiGiftFill style={{ color: '#ec4899' }} />}>
                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
                  Tỷ lệ quy đổi: <strong>100 điểm = 10.000đ</strong>. Voucher có hạn 60 ngày.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  {REDEEM_TIERS.map((t) => {
                    const enough = profile.loyaltyPoints >= t.points;
                    return (
                      <div key={t.points} style={{
                        padding: 16, border: `1px solid ${enough ? '#fbcfe8' : '#e5e7eb'}`,
                        background: enough ? '#fdf2f8' : '#f8fafc',
                        borderRadius: 10, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: enough ? '#be185d' : '#94a3b8' }}>
                          {t.points} điểm
                        </div>
                        <div style={{ fontSize: 13, color: '#475569', margin: '4px 0 12px' }}>
                          → giảm {formatCurrency(t.value)}
                        </div>
                        <button
                          onClick={() => handleRedeem(t.points)}
                          disabled={!enough || redeemingPoints === t.points}
                          style={{
                            ...primaryBtn, width: '100%',
                            background: enough ? '#ec4899' : '#cbd5e1',
                            cursor: enough ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {redeemingPoints === t.points ? '...' : enough ? 'Đổi ngay' : 'Chưa đủ điểm'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <h3 style={{ margin: '32px 0 12px', fontSize: 16 }}>
                <PiClockClockwiseBold style={{ verticalAlign: -3, marginRight: 6 }} /> Lịch sử điểm
              </h3>
              {history.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>Chưa có lịch sử giao dịch.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={th}>Thời gian</th>
                      <th style={th}>Loại</th>
                      <th style={th}>Mô tả</th>
                      <th style={{ ...th, textAlign: 'right' }}>Điểm</th>
                      <th style={{ ...th, textAlign: 'right' }}>Số dư</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={td}>{formatDate(h.createdAt)}</td>
                        <td style={td}>
                          <span style={{
                            background: h.type === 'earn' ? '#dcfce7' : h.type === 'redeem' ? '#fef2f2' : '#fef3c7',
                            color: h.type === 'earn' ? '#166534' : h.type === 'redeem' ? '#991b1b' : '#92400e',
                            padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          }}>{h.type === 'earn' ? 'NHẬN' : h.type === 'redeem' ? 'ĐỔI' : h.type.toUpperCase()}</span>
                        </td>
                        <td style={td}>{h.description}</td>
                        <td style={{ ...td, textAlign: 'right', color: h.points > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {h.points > 0 ? '+' : ''}{h.points}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{h.balanceAfter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ===== SECURITY ===== */}
          {activeTab === 'security' && <SecurityTab profile={profile} onReload={loadProfile} />}

          {/* ===== VOUCHERS ===== */}
          {activeTab === 'vouchers' && (
            <div>
              {vouchers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <PiTicketFill style={{ fontSize: 60, color: '#cbd5e1' }} />
                  <p style={{ color: '#64748b', marginTop: 16 }}>Chưa có voucher cá nhân nào</p>
                  <button onClick={() => setActiveTab('points')} style={primaryBtn}>
                    Đổi điểm lấy voucher
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {vouchers.map((v) => (
                    <div key={v.code} style={{
                      background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
                      border: '1px dashed #ec4899',
                      borderRadius: 10, padding: 16, position: 'relative',
                    }}>
                      <div style={{ fontSize: 12, color: '#be185d', fontWeight: 600 }}>VOUCHER CÁ NHÂN</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626', margin: '6px 0' }}>
                        −{formatCurrency(v.value)}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569' }}>
                        Đơn từ {formatCurrency(v.minOrderAmount)} • Hết hạn {formatDate(v.endDate).split(' ')[0]}
                      </div>
                      <div style={{
                        marginTop: 12, padding: '8px 12px', background: '#fff',
                        border: '1px dashed #f9a8d4', borderRadius: 6,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <code style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>{v.code}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(v.code); toast.success('Đã copy mã'); }}
                          style={{ background: 'none', border: 'none', color: '#ec4899', cursor: 'pointer', fontSize: 14 }}
                        >
                          <PiCopyBold />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ============ SECURITY TAB ============
function SecurityTab({ profile, onReload }: { profile: AccountDTO; onReload: () => void }) {
  const [setupQr, setSetupQr] = useState<{ secret: string; otpAuthUri: string } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [busy, setBusy] = useState(false);

  type ActivityRow = { id: number; provider: string; ip?: string; browser?: string; os?: string; deviceType?: string; success: boolean; failReason?: string; createdAt: string };
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  useEffect(() => {
    void authApi.getMyActivity().then((r) => {
      if (r.success && r.data) setActivities(r.data);
    });
  }, []);

  const handleStartSetup = async () => {
    setBusy(true);
    const r = await authApi.setup2Fa();
    setBusy(false);
    if (r.success && r.data) setSetupQr(r.data);
    else toast.error(r.error || 'Không setup được 2FA');
  };

  const handleEnable2Fa = async () => {
    if (twoFaCode.length !== 6) {
      toast.error('Nhập đủ 6 số');
      return;
    }
    setBusy(true);
    const r = await authApi.enable2Fa(twoFaCode);
    setBusy(false);
    if (r.success) {
      toast.success(r.data?.message || 'Đã bật 2FA');
      setSetupQr(null);
      setTwoFaCode('');
      onReload();
    } else {
      toast.error(r.error || 'Mã không đúng');
    }
  };

  const handleDisable2Fa = async () => {
    const code = prompt('Nhập mã 6 số từ Authenticator để xác nhận tắt 2FA:');
    if (!code) return;
    const r = await authApi.disable2Fa(code);
    if (r.success) {
      toast.success('Đã tắt 2FA');
      onReload();
    } else {
      toast.error(r.error || 'Mã không đúng');
    }
  };

  const handleSendVerify = async () => {
    const r = await authApi.sendVerifyEmail();
    if (r.success) toast.success(r.data?.message || 'Đã gửi email');
    else toast.error(r.error || 'Lỗi');
  };

  // QR code: dùng api.qrserver.com (free, không cần install lib)
  const qrUrl = setupQr ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupQr.otpAuthUri)}` : '';

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Email verify */}
      <Card title="Xác thực Email" icon={<PiShieldCheckBold style={{ color: '#16a34a' }} />}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>{profile.email}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Trạng thái: <strong style={{ color: '#16a34a' }}>Đã xác thực</strong>
            </div>
          </div>
          <button onClick={handleSendVerify} style={secondaryBtn}>
            Gửi lại email xác thực
          </button>
        </div>
      </Card>

      {/* Đổi mật khẩu */}
      <Card title="Đổi mật khẩu" icon={<PiShieldCheckBold style={{ color: '#0ea5e9' }} />}>
        <ChangePasswordForm />
      </Card>
      {/* 2FA */}
      <Card title="Xác thực 2 yếu tố (2FA)" icon={<PiQrCodeBold style={{ color: '#6366f1' }} />}>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
          Bảo vệ tài khoản với mã 6 số từ Google Authenticator / Authy / Microsoft Authenticator.
        </p>

        {!setupQr ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: '#fef3c7', color: '#92400e',
            }}>
              CHƯA BẬT
            </span>
            <button onClick={handleStartSetup} disabled={busy} style={primaryBtn}>
              {busy ? 'Đang tải...' : 'Bật 2FA ngay'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
            <div style={{ background: '#fff', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <img src={qrUrl} alt="QR 2FA" style={{ width: '100%', height: 'auto' }}  loading="lazy" decoding="async" />
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Bước 1: Quét QR bằng app Authenticator</h4>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                Hoặc nhập tay secret này:
              </p>
              <code style={{
                display: 'block', padding: '8px 12px', background: '#f1f5f9',
                borderRadius: 6, fontSize: 13, fontFamily: 'monospace',
                marginBottom: 16, wordBreak: 'break-all',
              }}>{setupQr.secret}</code>

              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Bước 2: Nhập mã 6 số đang hiện trong app</h4>
              <input
                type="text"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                style={{
                  width: 200, padding: '12px 14px', fontSize: 18, fontWeight: 700,
                  letterSpacing: 4, textAlign: 'center', border: '1.5px solid #e5e7eb',
                  borderRadius: 8, marginBottom: 12, fontFamily: 'monospace',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleEnable2Fa} disabled={busy || twoFaCode.length !== 6} style={primaryBtn}>
                  Xác nhận bật 2FA
                </button>
                <button onClick={() => { setSetupQr(null); setTwoFaCode(''); }} style={secondaryBtn}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Activity log */}
      <Card title="Lịch sử đăng nhập" icon={<PiClockHistory style={{ color: '#ec4899' }} />}>
        {activities.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Chưa có lịch sử đăng nhập.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={th}>Thời gian</th>
                <th style={th}>Phương thức</th>
                <th style={th}>Thiết bị</th>
                <th style={th}>IP</th>
                <th style={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={td}>{formatDate(a.createdAt)}</td>
                  <td style={td}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: '#e0e7ff', color: '#4338ca',
                    }}>{a.provider}</span>
                  </td>
                  <td style={td}>{a.browser} / {a.os}</td>
                  <td style={td}>{a.ip || '—'}</td>
                  <td style={td}>
                    {a.success ? (
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                        <i className="fa fa-check-circle"></i> Thành công
                      </span>
                    ) : (
                      <span style={{ color: '#dc2626' }} title={a.failReason}>
                        <i className="fa fa-times-circle"></i> Thất bại
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {/* Hủy tài khoản */}
      <Card title="Hủy tài khoản" icon={<PiSignOut style={{ color: '#dc2626' }} />}>
        <DeleteAccountSection />
      </Card>
    </div>
  );
}

// ---------- ChangePassword form ----------
function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error('Mật khẩu mới cần tối thiểu 8 ký tự');
    if (next !== confirm) return toast.error('Xác nhận mật khẩu không khớp');
    setBusy(true);
    const r = await accountApi.changePassword({ currentPassword: current, newPassword: next });
    setBusy(false);
    if (r.success) {
      toast.success(r.data?.message || 'Đã đổi mật khẩu');
      setCurrent(''); setNext(''); setConfirm('');
    } else {
      toast.error(r.error || 'Đổi mật khẩu th?t b?i');
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
      <Field label="Mật khẩu hiện tại" icon={<PiShieldCheckBold />}>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle} autoComplete="current-password" />
      </Field>
      <Field label="Mật khẩu mới (≥ 8 ký tự)" icon={<PiShieldCheckBold />}>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} style={inputStyle} autoComplete="new-password" />
      </Field>
      <Field label="Nhập lại mật khẩu mới" icon={<PiShieldCheckBold />}>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} autoComplete="new-password" />
      </Field>
      <button type="submit" disabled={busy || !current || !next} style={{ ...primaryBtn, justifySelf: 'start', marginTop: 4 }}>
        {busy ? 'Đang đổi...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}

// ---------- Delete account section ----------
function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (confirm.trim().toUpperCase() !== 'DELETE') {
      toast.error('Vui lòng gõ đúng "DELETE" để xác nhận');
      return;
    }
    setBusy(true);
    const r = await accountApi.deleteAccount(confirm);
    setBusy(false);
    if (r.success) {
      toast.success(r.data?.message || 'Đã hủy tài khoản');
      // Logout & redirect home
      authApi.logout();
      window.location.href = '/';
    } else {
      toast.error(r.error || 'Hủy tài khoản th?t b?i');
    }
  };

  if (!open) {
    return (
      <div>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 0 }}>
          Hành động này sẽ ẩn danh hóa toàn bộ thông tin cá nhân (tên, email, SĐT, avatar, ngày sinh) theo GDPR.
          Đơn hàng đã đặt sẽ được giữ lại cho mục đích kế toán nhưng không liên kết tới bạn nữa.
          <br />
          <strong style={{ color: '#dc2626' }}>Không thể hoàn tác.</strong>
        </p>
        <button onClick={() => setOpen(true)} style={{
          padding: '10px 18px', background: '#fef2f2', color: '#dc2626',
          border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
        }}>Tôi muốn hủy tài khoản</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
      <p style={{ fontSize: 13, color: '#7f1d1d', margin: '0 0 8px' }}>
        Gõ <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>DELETE</code> rồi bấm xác nhận:
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        style={{ ...inputStyle, marginBottom: 10, borderColor: '#fecaca' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleDelete} disabled={busy} style={{
          padding: '10px 18px', background: '#dc2626', color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
        }}>
          {busy ? 'Đang hủy...' : 'Xác nhận hủy tài khoản'}
        </button>
        <button onClick={() => { setOpen(false); setConfirm(''); }} style={secondaryBtn}>
          Quay l?i
        </button>
      </div>
    </div>
  );
}

// ============ HELPERS ============
function StatCard({ icon, value, label, color, hint, isText }: { icon: React.ReactNode; value: string | number; label: string; color: string; hint?: string; isText?: boolean }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: 16, display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}1a`, color, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: isText ? 16 : 22, fontWeight: 700, color: '#0f172a' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{label}{hint && ` • ${hint}`}</div>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        {icon} {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1',
  borderRadius: 6, fontSize: 14,
};
const readonly: React.CSSProperties = { padding: '10px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 14, color: '#0f172a' };
const primaryBtn: React.CSSProperties = {
  padding: '10px 18px', background: '#ec4899', color: '#fff', border: 'none',
  borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const secondaryBtn: React.CSSProperties = {
  padding: '10px 18px', background: '#f1f5f9', color: '#0f172a',
  border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 13,
};
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 12 };
const td: React.CSSProperties = { padding: '10px 12px', color: '#0f172a', verticalAlign: 'top' };
