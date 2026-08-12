// Bảo vệ route admin: chỉ cho phép NV đã đăng nhập (qua StaffAuthContext) truy cập
import { Navigate, Outlet } from 'react-router-dom';
import { useStaffAuth } from '../../context/StaffAuthContext';

interface Props {
  permission?: string; // VD: "staff.manage" — nếu set, phải có permission này
}

export default function AdminProtectedRoute({ permission }: Props) {
  const { staff, loading, isAuthenticated, hasPermission } = useStaffAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid #e2e8f0',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: '#64748b', fontSize: 14 }}>Đang xác thực...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated || !staff) {
    return <Navigate to="/admin/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: '#dc2626' }}>
          <i className="fa fa-ban"></i>
        </div>
        <h2 style={{ color: '#0f172a' }}>Không có quyền truy cập</h2>
        <p style={{ color: '#64748b' }}>
          Tài khoản của bạn không có quyền truy cập trang này.
          <br />Liên hệ quản trị viên nếu bạn cần quyền {permission}.
        </p>
        <a href="/admin/dashboard" style={{ color: '#6366f1', fontWeight: 600 }}>
          ← Quay lại Dashboard
        </a>
      </div>
    );
  }

  return <Outlet />;
}
