import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountApi, adminApi } from '../services/api';
import { formatDate } from '../utils/format';
import {
  pushSecurityActivity,
  readAdminSettings,
  readSecurityActivities,
  saveAdminSettings,
} from '../utils/adminSettingsConfig';
import {
  readAdminProfile,
  saveAdminProfile,
  syncAdminProfileToSession,
  type AdminProfileRecord,
} from '../utils/adminProfileConfig';
import AdminIcon from '../components/admin/AdminIcon';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

type ProfileTab = 'overview' | 'security';
type EditableSection = 'basic' | 'work' | null;

interface PasswordFormState {
  currentPassword: string;
  nextPassword: string;
  confirmPassword: string;
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Chưa có dữ liệu';
  }

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return formatDate(value);
  }
}

export default function AdminProfile() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Build profile from JWT user data
  const baseProfile = readAdminProfile();
  const initialProfile: AdminProfileRecord = {
    ...baseProfile,
    basic: {
      ...baseProfile.basic,
      fullName: user?.name || baseProfile.basic.fullName,
      email: user?.email || baseProfile.basic.email,
      phone: user?.phone || baseProfile.basic.phone,
    },
  };

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [editingSection, setEditingSection] = useState<EditableSection>(null);
  const [savedProfile, setSavedProfile] = useState<AdminProfileRecord>(initialProfile);
  const [profile, setProfile] = useState<AdminProfileRecord>(initialProfile);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [metrics, setMetrics] = useState<Array<{ label: string; value: string; detail: string }>>([]);
  const [securityActivities, setSecurityActivities] = useState(() => readSecurityActivities().slice(0, 6));
  const [securityOptions, setSecurityOptions] = useState({
    enable2FA: false,
    loginNotification: true,
  });
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });

  const adminName = user?.name || profile.basic.displayName || profile.basic.fullName;
  const profilePosition = profile.work.position || 'Administrator';
  const avatarFallback = adminName.charAt(0).toUpperCase();

  useEffect(() => {
    fetchProfile();
    fetchDashboardMetrics();
  }, []);

  async function fetchProfile() {
    try {
      setLoadingProfile(true);
      const response = await accountApi.getProfile();
      if (response.success && response.data) {
        const updatedProfile: AdminProfileRecord = {
          ...profile,
          basic: {
            ...profile.basic,
            fullName: response.data.name,
            email: response.data.email,
            phone: response.data.phone || '',
            avatar: response.data.avatar || profile.basic.avatar,
          },
        };
        setProfile(updatedProfile);
        setSavedProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function fetchDashboardMetrics() {
    try {
      const response = await adminApi.getDashboardStats();
      if (response.success && response.data) {
        const stats = response.data;
        setMetrics([
          {
            label: 'Đơn cần theo dõi',
            value: String(stats.pendingOrders || 0),
            detail: `${stats.totalOrders || 0} tổng đơn hàng`,
          },
          {
            label: 'Sản phẩm đang bán',
            value: String(stats.totalProducts || 0),
            detail: `${stats.lowStockProducts || 0} SP sắp hết hàng`,
          },
          {
            label: 'Doanh thu',
            value: new Intl.NumberFormat('vi-VN').format(stats.totalRevenue || 0),
            detail: 'VND',
          },
          {
            label: 'Khách hàng',
            value: String(stats.totalCustomers || 0),
            detail: 'Tổng số khách hàng',
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
    }
  }

  const refreshDerivedState = () => {
    setSecurityActivities(readSecurityActivities().slice(0, 6));
    const latestSettings = readAdminSettings();
    setSecurityOptions({
      enable2FA: latestSettings.enable2FA,
      loginNotification: latestSettings.loginNotification,
    });
  };

  const handleCancelEdit = (section: EditableSection) => {
    if (!section) {
      return;
    }
    setProfile((currentProfile) => ({
      ...currentProfile,
      [section]: savedProfile[section],
    }));
    setEditingSection(null);
  };

  const handleSaveBasic = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!/\S+@\S+\.\S+/.test(profile.basic.email)) {
      toast.error('Email admin không hợp lệ.');
      return;
    }

    try {
      setSavingProfile(true);
      const response = await accountApi.updateProfile({
        name: profile.basic.fullName,
        phone: profile.basic.phone,
        avatar: profile.basic.avatar,
      });

      if (response.success && response.data) {
        // Save local extended profile (display name, gender, birthday)
        const saved = saveAdminProfile(profile);
        syncAdminProfileToSession(saved);
        setSavedProfile(saved);
        setProfile(saved);
        refreshUser();
        toast.success('Đã lưu thông tin cá nhân admin.');
        setEditingSection(null);
      } else {
        toast.error(response.error || 'Không thể lưu thông tin.');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Không thể lưu thông tin.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveWork = (event: React.FormEvent) => {
    event.preventDefault();
    // Work info still uses local config (position, department, joinedAt)
    const saved = saveAdminProfile(profile);
    syncAdminProfileToSession(saved);
    setSavedProfile(saved);
    setProfile(saved);
    toast.success('Đã lưu thông tin công việc admin.');
    setEditingSection(null);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh hợp lệ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const avatar = typeof reader.result === 'string' ? reader.result : '';

      try {
        const response = await accountApi.updateProfile({ avatar });
        if (response.success) {
          const nextProfile = {
            ...profile,
            basic: {
              ...profile.basic,
              avatar,
            },
          };
          const saved = saveAdminProfile(nextProfile);
          syncAdminProfileToSession(saved);
          setSavedProfile(saved);
          setProfile(saved);
          refreshUser();
          toast.success('Đã cập nhật avatar admin.');
        } else {
          toast.error(response.error || 'Không thể cập nhật avatar.');
        }
      } catch (error) {
        console.error('Failed to upload avatar:', error);
        toast.error('Không thể cập nhật avatar.');
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSaveSecurityOptions = () => {
    const currentSettings = readAdminSettings();
    saveAdminSettings({
      ...currentSettings,
      enable2FA: securityOptions.enable2FA,
      loginNotification: securityOptions.loginNotification,
    });
    refreshDerivedState();
    toast.success('Đã đồng bộ tùy chọn bảo mật với Admin Settings.');
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (passwordForm.nextPassword.length < 6) {
      toast.error('Mật khẩu mới cần ít nhất 6 ký tự.');
      return;
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setSavingPassword(true);
      const response = await accountApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.nextPassword,
      });

      if (response.success) {
        pushSecurityActivity({
          type: 'password-change',
          title: 'Mật khẩu admin đã được thay đổi',
          detail: 'Cập nhật từ trang Hồ sơ Admin.',
        });

        setPasswordForm({
          currentPassword: '',
          nextPassword: '',
          confirmPassword: '',
        });
        refreshDerivedState();
        toast.success('Đã đổi mật khẩu admin thành công.');
      } else {
        toast.error(response.error || 'Mật khẩu hiện tại không đúng.');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      toast.error('Không thể đổi mật khẩu.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loadingProfile) {
    return <LoadingSpinner />;
  }

  return (
    <div className="admin-profile-page">
      <section className="admin-profile-hero">
        <div className="admin-profile-cover"></div>
        <div className="admin-profile-hero-content">
          <div className="admin-profile-avatar-wrap">
            <div className="admin-profile-avatar">
              {profile.basic.avatar ? (
                <img src={profile.basic.avatar} alt={adminName} />
              ) : (
                <span>{avatarFallback}</span>
              )}
            </div>
            <button type="button" className="admin-profile-avatar-btn" onClick={() => fileInputRef.current?.click()}>
              <AdminIcon name="fa fa-camera" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="admin-profile-file-input"
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="admin-profile-identity">
            <h1>{adminName}</h1>
            <p className="admin-profile-role">
              <AdminIcon name="fa fa-shield-alt" /> {profilePosition}
            </p>
            <p className="admin-profile-meta">
              <AdminIcon name="fa fa-envelope" /> {profile.basic.email}
            </p>
            <p className="admin-profile-meta">
              <AdminIcon name="fa fa-calendar-alt" /> Tham gia từ {formatDate(profile.work.joinedAt)}
            </p>
          </div>

          <div className="admin-profile-hero-actions">
            <Link to="/admin/settings" className="btn btn-outline btn-sm">
              <AdminIcon name="fa fa-cog" /> Đồng bộ với Settings
            </Link>
          </div>
        </div>

        <div className="admin-profile-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="admin-profile-metric-card">
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <small>{metric.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-profile-tabs">
        <button
          type="button"
          className={`admin-profile-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <AdminIcon name="fa fa-user" /> Tổng quan
        </button>
        <button
          type="button"
          className={`admin-profile-tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <AdminIcon name="fa fa-lock" /> Bảo mật
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="admin-profile-grid">
          <section className="admin-profile-card">
            <div className="admin-profile-card-header">
              <div>
                <h3><AdminIcon name="fa fa-id-card" /> Thông tin cá nhân</h3>
                <p>Dữ liệu này được sync với backend và session đăng nhập hiện tại.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingSection('basic')}>
                <AdminIcon name="fa fa-edit" /> Chỉnh sửa
              </button>
            </div>

            <form onSubmit={handleSaveBasic}>
              <div className="admin-profile-form-grid">
                <div className="form-group">
                  <label className="form-label">Họ và tên</label>
                  <input
                    className="form-control"
                    value={profile.basic.fullName}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        basic: { ...currentProfile.basic, fullName: event.target.value },
                      }))
                    }
                    disabled={editingSection !== 'basic'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên hiển thị</label>
                  <input
                    className="form-control"
                    value={profile.basic.displayName}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        basic: { ...currentProfile.basic, displayName: event.target.value },
                      }))
                    }
                    disabled={editingSection !== 'basic'}
                  />
                </div>
              </div>

              <div className="admin-profile-form-grid">
                <div className="form-group">
                  <label className="form-label">Email admin</label>
                  <input
                    className="form-control"
                    type="email"
                    value={profile.basic.email}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số điện thoại</label>
                  <input
                    className="form-control"
                    value={profile.basic.phone}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        basic: { ...currentProfile.basic, phone: event.target.value },
                      }))
                    }
                    disabled={editingSection !== 'basic'}
                  />
                </div>
              </div>

              <div className="admin-profile-form-grid">
                <div className="form-group">
                  <label className="form-label">Ngày sinh</label>
                  <input
                    className="form-control"
                    type="date"
                    value={profile.basic.birthday}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        basic: { ...currentProfile.basic, birthday: event.target.value },
                      }))
                    }
                    disabled={editingSection !== 'basic'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Giới tính</label>
                  <select
                    className="form-control"
                    value={profile.basic.gender}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        basic: {
                          ...currentProfile.basic,
                          gender: event.target.value as AdminProfileRecord['basic']['gender'],
                        },
                      }))
                    }
                    disabled={editingSection !== 'basic'}
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>

              {editingSection === 'basic' && (
                <div className="admin-profile-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => handleCancelEdit('basic')}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
                    <AdminIcon name="fa fa-save" /> {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                </div>
              )}
            </form>
          </section>

          <section className="admin-profile-card">
            <div className="admin-profile-card-header">
              <div>
                <h3><AdminIcon name="fa fa-briefcase" /> Thông tin công việc</h3>
                <p>Hiển thị xuyên suốt trong sidebar, dropdown admin và các log vận hành.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingSection('work')}>
                <AdminIcon name="fa fa-edit" /> Chỉnh sửa
              </button>
            </div>

            <form onSubmit={handleSaveWork}>
              <div className="admin-profile-form-grid">
                <div className="form-group">
                  <label className="form-label">Vị trí</label>
                  <input
                    className="form-control"
                    value={profile.work.position}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        work: { ...currentProfile.work, position: event.target.value },
                      }))
                    }
                    disabled={editingSection !== 'work'}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phòng ban</label>
                  <input
                    className="form-control"
                    value={profile.work.department}
                    onChange={(event) =>
                      setProfile((currentProfile) => ({
                        ...currentProfile,
                        work: { ...currentProfile.work, department: event.target.value },
                      }))
                    }
                    disabled={editingSection !== 'work'}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả công việc</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={profile.work.jobDescription}
                  onChange={(event) =>
                    setProfile((currentProfile) => ({
                      ...currentProfile,
                      work: { ...currentProfile.work, jobDescription: event.target.value },
                    }))
                  }
                  disabled={editingSection !== 'work'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ngày tham gia</label>
                <input
                  className="form-control"
                  type="date"
                  value={profile.work.joinedAt.slice(0, 10)}
                  onChange={(event) =>
                    setProfile((currentProfile) => ({
                      ...currentProfile,
                      work: { ...currentProfile.work, joinedAt: new Date(event.target.value).toISOString() },
                    }))
                  }
                  disabled={editingSection !== 'work'}
                />
              </div>

              {editingSection === 'work' && (
                <div className="admin-profile-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => handleCancelEdit('work')}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    <AdminIcon name="fa fa-save" /> Lưu công việc
                  </button>
                </div>
              )}
            </form>
          </section>

          <section className="admin-profile-card admin-profile-card-wide">
            <div className="admin-profile-card-header">
              <div>
                <h3><AdminIcon name="fa fa-wave-square" /> Hoạt động gần đây</h3>
                <p>Lấy từ audit log nội bộ.</p>
              </div>
            </div>

            <div className="admin-profile-activity-list">
              {securityActivities.length > 0 ? (
                securityActivities.map((activity) => (
                  <div key={activity.id} className="admin-profile-activity-item">
                    <div className="admin-profile-activity-icon">
                      <AdminIcon name={activity.type === 'password-change' ? 'fa-key' : 'fa-user-shield'} />
                    </div>
                    <div className="admin-profile-activity-copy">
                      <strong>{activity.title}</strong>
                      <span>{activity.detail}</span>
                      <small>{formatDateTime(activity.createdAt)}</small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="admin-profile-empty-state">
                  <AdminIcon name="fa fa-inbox" />
                  <p>Chưa có hoạt động admin nào được ghi nhận.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="admin-profile-grid">
          <section className="admin-profile-card">
            <div className="admin-profile-card-header">
              <div>
                <h3><AdminIcon name="fa fa-key" /> Đổi mật khẩu</h3>
                <p>Cập nhật mật khẩu trực tiếp với backend qua API.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label className="form-label">Mật khẩu hiện tại</label>
                <input
                  className="form-control"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((currentForm) => ({ ...currentForm, currentPassword: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mật khẩu mới</label>
                <input
                  className="form-control"
                  type="password"
                  value={passwordForm.nextPassword}
                  onChange={(event) => setPasswordForm((currentForm) => ({ ...currentForm, nextPassword: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu mới</label>
                <input
                  className="form-control"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((currentForm) => ({ ...currentForm, confirmPassword: event.target.value }))}
                />
              </div>
              <div className="admin-profile-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingPassword}>
                  <AdminIcon name="fa fa-lock" /> {savingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-profile-card">
            <div className="admin-profile-card-header">
              <div>
                <h3><AdminIcon name="fa fa-shield-alt" /> Tùy chọn bảo mật</h3>
                <p>Đồng bộ trực tiếp với Admin Settings để dùng cùng một policy.</p>
              </div>
            </div>

            <div className="admin-profile-toggle-list">
              <label className="admin-profile-toggle-row">
                <div>
                  <strong>Chính sách 2FA</strong>
                  <span>Đánh dấu policy cho tài khoản admin ở các màn quản trị.</span>
                </div>
                <input
                  type="checkbox"
                  checked={securityOptions.enable2FA}
                  onChange={(event) =>
                    setSecurityOptions((currentOptions) => ({
                      ...currentOptions,
                      enable2FA: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="admin-profile-toggle-row">
                <div>
                  <strong>Audit login</strong>
                  <span>Tự động ghi lại mỗi lần admin đăng nhập thành công.</span>
                </div>
                <input
                  type="checkbox"
                  checked={securityOptions.loginNotification}
                  onChange={(event) =>
                    setSecurityOptions((currentOptions) => ({
                      ...currentOptions,
                      loginNotification: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>

            <div className="admin-profile-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveSecurityOptions}>
                <AdminIcon name="fa fa-save" /> Lưu tùy chọn
              </button>
              <Link to="/admin/settings" className="btn btn-outline btn-sm">
                <AdminIcon name="fa fa-cog" /> Mở Settings
              </Link>
            </div>
          </section>

          <section className="admin-profile-card admin-profile-card-wide">
            <div className="admin-profile-card-header">
              <div>
                <h3><AdminIcon name="fa fa-history" /> Audit timeline</h3>
                <p>Thông tin này được dùng chung với trang Admin Settings.</p>
              </div>
            </div>

            <div className="admin-profile-activity-list">
              {securityActivities.length > 0 ? (
                securityActivities.map((activity) => (
                  <div key={activity.id} className="admin-profile-activity-item">
                    <div className="admin-profile-activity-icon">
                      <AdminIcon name={activity.type === 'password-change' ? 'fa-key' : 'fa-user-shield'} />
                    </div>
                    <div className="admin-profile-activity-copy">
                      <strong>{activity.title}</strong>
                      <span>{activity.detail}</span>
                      <small>{formatDateTime(activity.createdAt)}</small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="admin-profile-empty-state">
                  <AdminIcon name="fa fa-shield-alt" />
                  <p>Chưa có audit log nào.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
