/**
 * ProtectedRoute - Bảo vệ routes cần authentication
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();

  // Đang load session
  if (loading) {
    return <LoadingSpinner message="Đang kiểm tra phiên đăng nhập..." fullScreen />;
  }

  // Chưa đăng nhập -> redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Route admin nhưng user thường -> redirect to home
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Nếu có children thì render children, không thì render Outlet
  return children ? <>{children}</> : <Outlet />;
}
