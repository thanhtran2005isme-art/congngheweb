// Footer - IVY moda style: 5 columns, clean, minimal

import { useState } from 'react';
import {
  PiFacebookLogoFill,
  PiInstagramLogoFill,
  PiMessengerLogoFill,
  PiTiktokLogoFill,
  PiYoutubeLogoFill,
} from 'react-icons/pi';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      alert('Đăng ký thành công! Cảm ơn bạn.');
      setEmail('');
    }
  };

  return (
    <footer className="ivy-footer">
      <div className="ivy-footer-main">
        {/* Col 1: Logo + Social + Hotline */}
        <div className="ivy-footer-col ivy-footer-brand">
          <div className="ivy-footer-logo">
            <img src="/images/logokaitokid.png" alt="KAITO KID"  loading="lazy" decoding="async" />
          </div>
          <div className="ivy-footer-socials">
            <a href="#" aria-label="Facebook"><PiFacebookLogoFill aria-hidden="true" /></a>
            <a href="#" aria-label="Messenger"><PiMessengerLogoFill aria-hidden="true" /></a>
            <a href="#" aria-label="Instagram"><PiInstagramLogoFill aria-hidden="true" /></a>
            <a href="#" aria-label="TikTok"><PiTiktokLogoFill aria-hidden="true" /></a>
            <a href="#" aria-label="YouTube"><PiYoutubeLogoFill aria-hidden="true" /></a>
          </div>
          <div className="ivy-footer-hotline">
            HOTLINE: 0246 662 3434
          </div>
        </div>

        {/* Col 2: Giới thiệu */}
        <div className="ivy-footer-col">
          <h4>Giới thiệu</h4>
          <ul>
            <li><Link to="/lookbook">Về KAITO KID</Link></li>
            <li><a href="#">Tuyển dụng</a></li>
            <li><a href="#">Hệ thống cửa hàng</a></li>
          </ul>
        </div>

        {/* Col 3: Dịch vụ khách hàng */}
        <div className="ivy-footer-col">
          <h4>Dịch vụ khách hàng</h4>
          <ul>
            <li><a href="#">Chính sách điều khoản</a></li>
            <li><a href="#">Hướng dẫn mua hàng</a></li>
            <li><a href="#">Chính sách thanh toán</a></li>
            <li><a href="#">Chính sách đổi trả</a></li>
            <li><a href="#">Chính sách bảo hành</a></li>
            <li><a href="#">Chính sách giao nhận vận chuyển</a></li>
            <li><a href="#">Chính sách thẻ thành viên</a></li>
            <li><a href="#">Q&A</a></li>
          </ul>
        </div>

        {/* Col 4: Liên hệ */}
        <div className="ivy-footer-col">
          <h4>Liên hệ</h4>
          <ul>
            <li><a href="#">Hotline</a></li>
            <li><a href="#">Email</a></li>
            <li><a href="#">Live Chat</a></li>
            <li><a href="#">Messenger</a></li>
            <li><a href="#">Liên hệ</a></li>
          </ul>
        </div>

        {/* Col 5: Newsletter + Download */}
        <div className="ivy-footer-col ivy-footer-newsletter">
          <div className="ivy-newsletter-box">
            <p className="ivy-newsletter-title">Nhận thông tin các chương trình của KAITO KID</p>
            <form className="ivy-newsletter-form" onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="Nhập địa chỉ email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <button type="submit">Đăng ký</button>
            </form>
          </div>
          <div className="ivy-download-app">
            <p>Download App</p>
            <div className="ivy-app-badges">
              <a href="#" aria-label="App Store">
                <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="App Store"  loading="lazy" decoding="async" />
              </a>
              <a href="#" aria-label="Google Play">
                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play"  loading="lazy" decoding="async" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="ivy-footer-bottom">
        <p>©KAITO KID All rights reserved</p>
      </div>
    </footer>
  );
}
