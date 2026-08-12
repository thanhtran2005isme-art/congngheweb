// Layout chính cho trang khách hàng

import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import RecentlyViewedStrip from './RecentlyViewedStrip';
import { ChatProvider } from '../../context/ChatContext';
import ChatWidget from '../chat/ChatWidget';

export default function MainLayout() {
  return (
    <ChatProvider>
      <Header />
      <main>
        <Outlet />
      </main>
      <RecentlyViewedStrip />
      <Footer />
      {/* Widget chat tự xây thay cho Facebook Messenger plugin (tránh trùng 2 bong bóng) */}
      <ChatWidget />
    </ChatProvider>
  );
}
