import { Outlet, useLocation } from 'react-router-dom';
import AccountNotificationCenter from '../../pages/AccountNotificationCenter';

export default function CustomerOutlet() {
  const location = useLocation();
  const isNotificationCenter = location.pathname === '/account'
    && new URLSearchParams(location.search).get('tab') === 'notifications';

  return isNotificationCenter ? <AccountNotificationCenter /> : <Outlet />;
}
