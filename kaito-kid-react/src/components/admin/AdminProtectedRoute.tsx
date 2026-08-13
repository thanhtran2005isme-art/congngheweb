// Bảo vệ route admin: chỉ cho phép NV đã đăng nhập (qua StaffAuthContext) truy cập
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useStaffAuth } from '../../context/StaffAuthContext';
import AdminIcon from './AdminIcon';

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
        background: '#f8fafc',
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
      <div style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{
          width: 'min(520px, 100%)',
          padding: 32,
          borderRadius: 20,
          background: '#fff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 18px 42px rgba(15,23,42,.08)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            margin: '0 auto 16px',
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            background: '#fff1f2',
            color: '#dc2626',
            fontSize: 24,
          }}>
            <AdminIcon name="fa-ban" />
          </div>
          <h2 style={{ margin: 0, color: '#0f172a' }}>Không có quyền truy cập</h2>
          <p style={{ margin: '10px 0 22px', color: '#64748b', lineHeight: 1.7 }}>
            Tài khoản hiện tại chưa được cấp quyền <strong>{permission}</strong> cho khu vực này.
            <br />Liên hệ quản trị viên nếu bạn cần được bổ sung quyền.
          </p>
          <Link
            to="/admin/dashboard"
            style={{
              minHeight: 42,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
              borderRadius: 10,
              background: '#6366f1',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            ← Quay lại Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
