import { Link } from 'react-router-dom';
import AdminIcon from './AdminIcon';
import AdminLayout from './AdminLayout';
import { AdminUiProvider } from './AdminUiProvider';

export default function AdminShell() {
  return (
    <AdminUiProvider>
      <AdminLayout />
      <Link
        to="/admin/returns"
        aria-label="Quản lý đổi trả hàng"
        title="Quản lý đổi / trả hàng"
        style={{
          position: 'fixed',
          left: 18,
          bottom: 104,
          zIndex: 1200,
          minHeight: 42,
          padding: '0 12px',
          borderRadius: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#fff',
          border: '1px solid #e4e7ec',
          boxShadow: '0 8px 24px rgba(15,23,42,.10)',
          color: '#475467',
          fontSize: 12,
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        <AdminIcon name="fa-undo" />
        <span>Đổi / Trả</span>
      </Link>
    </AdminUiProvider>
  );
}
