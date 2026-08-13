import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import OffersView from '../../pages/OffersView';

export default function CustomerOutlet() {
  const { user } = useAuth();
  const location = useLocation();
  const showOffers = Boolean(user)
    && location.pathname === '/account'
    && new URLSearchParams(location.search).get('tab') === 'notifications';
  return showOffers ? <OffersView /> : <Outlet />;
}
