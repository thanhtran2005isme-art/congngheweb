// Layout chính cho trang khách hàng

import Header from './Header';
import Footer from './Footer';
import RecentlyViewedStrip from './RecentlyViewedStrip';
import CustomerOutlet from './CustomerOutlet';
import { ChatProvider } from '../../context/ChatContext';
import ChatWidget from '../chat/ChatWidget';

export default function MainLayout() {
  return (
    <ChatProvider>
      <Header />
      <main>
        <CustomerOutlet />
      </main>
      <RecentlyViewedStrip />
      <Footer />
      {/* Widget chat tự xây thay cho Facebook Messenger plugin (tránh trùng 2 bong bóng) */}
      <ChatWidget />
    </ChatProvider>
  );
}
