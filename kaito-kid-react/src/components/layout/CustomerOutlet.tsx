import { Outlet, useLocation } from 'react-router-dom';
import OffersView from '../../pages/OffersView';

export default function CustomerOutlet() {
  const location = useLocation();
  const showOffers = location.pathname === '/account'
    && new URLSearchParams(location.search).get('tab') === 'notifications';
  return showOffers ? <OffersView /> : <Outlet />;
}
