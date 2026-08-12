// Trang thanh toán - đã refactor thành các sub-component
//   <CheckoutForm />        — form địa chỉ + sổ địa chỉ
//   <ShippingSelector />    — chọn ĐVVC + service
//   <PaymentMethodSelector />
//   <OrderSummaryBox />     — tóm tắt + nhập coupon
//   <ReviewOrderModal />    — xem lại trước khi gửi backend
//   <PaymentStep />         — step 3 QR + countdown
//   <OrderCompleted />      — step 4

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  couponApi, settingsApi, shippingApi, paymentApi, cartApi, addressApi,
  type SettingDTO, type ShippingQuoteOption, type ComboDiscountResult,
} from '../services/api';
import apiClient from '../services/apiClient';
import CheckoutForm from '../components/checkout/CheckoutForm';
import ShippingSelector from '../components/checkout/ShippingSelector';
import PaymentMethodSelector from '../components/checkout/PaymentMethodSelector';
import OrderSummaryBox from '../components/checkout/OrderSummaryBox';
import ReviewOrderModal from '../components/checkout/ReviewOrderModal';
import PaymentStep from '../components/checkout/PaymentStep';
import OrderCompleted from '../components/checkout/OrderCompleted';
import { EMPTY_ADDRESS_FORM, type BankAccount, type CheckoutAddressForm } from '../components/checkout/types';

type PaymentMethod = 'atm' | 'cod';

export default function Checkout() {
  const { cart, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [addressForm, setAddressForm] = useState<CheckoutAddressForm>({
    ...EMPTY_ADDRESS_FORM,
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [promoInput, setPromoInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Bank accounts (for QR step)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Shipping
  const [shippingProvider, setShippingProvider] = useState<'mock' | 'ghn' | 'ghtk' | 'all'>('all');
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuoteOption | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  // Combo discount (server-evaluated)
  const [combo, setCombo] = useState<ComboDiscountResult | null>(null);

  // Step state
  const [paymentStep, setPaymentStep] = useState(false);
  const [completedStep, setCompletedStep] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ orderCode: string; total: number } | null>(null);

  // Backend cho phép simulate paid hay không (chỉ dev)
  const [allowSimulatePaid, setAllowSimulatePaid] = useState(false);

  const shippingFee = selectedShipping?.fee ?? 0;
  const comboDiscount = combo?.eligible ? combo.discount : 0;
  const total = useMemo(
    () => Math.max(0, subtotal - couponDiscount - comboDiscount) + shippingFee,
    [subtotal, couponDiscount, comboDiscount, shippingFee],
  );

  // ==================== EFFECTS ====================

  // Load bank accounts từ admin settings
  useEffect(() => {
    void settingsApi.getAll('payment').then((result) => {
      if (!result.success || !result.data) return;
      result.data.forEach((dto: SettingDTO) => {
        if (dto.maCauHinh === 'bankAccounts') {
          try {
            const parsed = JSON.parse(dto.giaTri);
            if (Array.isArray(parsed)) setBankAccounts(parsed);
          } catch { /* ignore */ }
        }
      });
    });
  }, []);

  // Lấy cấu hình payment để biết có hiển thị nút mô phỏng hay không
  useEffect(() => {
    void paymentApi.getConfig().then((r) => {
      if (r.success && r.data) setAllowSimulatePaid(r.data.allowSimulatePaid);
    });
  }, []);

  // Auto load coupon đã apply từ trang Cart
  useEffect(() => {
    const pending = sessionStorage.getItem('kk_pending_coupon');
    if (!pending || appliedCoupon) return;
    setPromoInput(pending);
    sessionStorage.removeItem('kk_pending_coupon');
    void couponApi.validate({ code: pending, orderAmount: subtotal }).then((r) => {
      if (r.success && r.data?.isValid) {
        setCouponDiscount(r.data.discountAmount);
        setAppliedCoupon(pending);
      }
    });
  }, [subtotal, appliedCoupon]);

  // Combo discount
  useEffect(() => {
    if (cart.length === 0) { setCombo(null); return; }
    void cartApi.getComboDiscount().then((r) => {
      if (r.success && r.data) setCombo(r.data); else setCombo(null);
    });
  }, [cart]);

  // Quote phí ship khi địa chỉ đổi
  useEffect(() => {
    if (!addressForm.city || !addressForm.district) {
      setShippingOptions([]);
      setSelectedShipping(null);
      return;
    }
    const totalWeight = cart.reduce((s, i) => s + 300 * i.quantity, 0);
    setShippingLoading(true);
    void shippingApi.quote({
      provider: shippingProvider,
      toProvince: addressForm.city,
      toDistrict: addressForm.district,
      toWard: addressForm.ward || undefined,
      toAddress: addressForm.street || undefined,
      weightGram: Math.max(300, totalWeight),
      orderValue: subtotal,
    }).then((r) => {
      if (r.success && r.data?.success && r.data.options.length > 0) {
        setShippingOptions(r.data.options);
        const found = selectedShipping
          ? r.data.options.find((o) => o.provider === selectedShipping.provider && o.serviceCode === selectedShipping.serviceCode)
          : null;
        setSelectedShipping(found || r.data.options[0]);
      } else {
        setShippingOptions([]);
        setSelectedShipping(null);
      }
    }).finally(() => setShippingLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressForm.city, addressForm.district, addressForm.ward, addressForm.street, subtotal, shippingProvider]);

  // ==================== ACTIONS ====================

  const applyCoupon = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const result = await couponApi.validate({ code, orderAmount: subtotal });
    if (result.success && result.data) {
      if (result.data.isValid) {
        setCouponDiscount(result.data.discountAmount);
        setAppliedCoupon(code);
        setError('');
      } else {
        setError(result.data.message || 'Mã không hợp lệ');
      }
    } else {
      setError(result.error || 'Không thể kiểm tra mã giảm giá');
    }
  };

  const validateForm = (): string | null => {
    if (!addressForm.name.trim()) return 'Vui lòng nhập họ tên';
    if (!addressForm.phone.trim()) return 'Vui lòng nhập số điện thoại';
    if (!addressForm.street.trim()) return 'Vui lòng nhập địa chỉ';
    if (!addressForm.city || !addressForm.district) return 'Vui lòng chọn tỉnh/quận';
    if (!selectedShipping) return 'Vui lòng chọn đơn vị vận chuyển';
    return null;
  };

  /** Bấm "Xem lại đơn" → mở review modal. */
  const handleOpenReview = () => {
    const err = validateForm();
    if (err) { setError(err); return; }
    setError('');
    setShowReview(true);
  };

  const fullAddress = useMemo(
    () => [addressForm.street, addressForm.ward, addressForm.district, addressForm.city]
      .filter(Boolean).join(', '),
    [addressForm],
  );

  /** Sau khi user bấm "Xác nhận đặt hàng" trong review modal. */
  const handleConfirmOrder = async () => {
    setError('');
    setSubmitting(true);
    try {
      const response = await apiClient.post('/api/orders', {
        customerName: addressForm.name.trim(),
        customerPhone: addressForm.phone.trim(),
        customerEmail: user?.email || '',
        customerAddress: fullAddress,
        paymentMethod: paymentMethod.toUpperCase(),
        couponCode: appliedCoupon || undefined,
        shippingProvider: selectedShipping?.provider,
        shippingServiceCode: selectedShipping?.serviceCode,
        shippingFee: selectedShipping?.fee ?? shippingFee,
        leadTimeHours: selectedShipping?.leadTimeHours,
      });
      const data = response.data as { id?: number; orderCode?: string; total?: number };

      const orderInfo = {
        orderCode: data.orderCode || String(data.id || ''),
        total: data.total || total,
      };

      // Lưu địa chỉ vào sổ nếu user check
      if (user && addressForm.saveToBook) {
        void addressApi.create({
          fullName: addressForm.name.trim(),
          phone: addressForm.phone.trim(),
          province: addressForm.city,
          district: addressForm.district,
          ward: addressForm.ward,
          street: addressForm.street,
          isDefault: false,
        });
      }

      await clearCart();
      setShowReview(false);
      setPendingOrder(orderInfo);

      if (paymentMethod === 'atm') {
        setPaymentStep(true);
      } else {
        setCompletedStep(true);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Không thể đặt hàng. Vui lòng thử lại.';
      setError(msg);
      setShowReview(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== RENDER ====================

  // Empty cart guard (chỉ check khi chưa qua step 3/4)
  if (cart.length === 0 && !paymentStep && !completedStep) {
    return (
      <div className="ivy-checkout-page">
        <div className="ivy-cart-empty">
          <h3>Giỏ hàng trống</h3>
          <p>Vui lòng thêm sản phẩm trước khi thanh toán</p>
          <Link to="/products" className="ivy-btn-continue">← Tiếp tục mua hàng</Link>
        </div>
      </div>
    );
  }

  if (completedStep && pendingOrder) {
    return <OrderCompleted orderCode={pendingOrder.orderCode} total={pendingOrder.total} paymentMethod={paymentMethod} />;
  }

  if (paymentStep && pendingOrder) {
    return (
      <PaymentStep
        orderCode={pendingOrder.orderCode}
        total={pendingOrder.total}
        bankAccounts={bankAccounts}
        allowSimulatePaid={allowSimulatePaid}
        onPaid={() => {
          setPaymentStep(false);
          setCompletedStep(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="ivy-checkout-page">
      {/* Steps: step 2 active */}
      <div className="ivy-cart-steps">
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Giỏ hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step active"><div className="ivy-step-num">2</div><span>Đặt hàng</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">3</div><span>Thanh toán</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">4</div><span>Hoàn thành đơn</span></div>
      </div>

      <div className="ivy-checkout-layout">
        {/* LEFT */}
        <div className="ivy-checkout-left">
          <CheckoutForm
            isLoggedIn={!!user}
            value={addressForm}
            onChange={setAddressForm}
            error={error}
          />

          <ShippingSelector
            provider={shippingProvider}
            onProviderChange={setShippingProvider}
            options={shippingOptions}
            selected={selectedShipping}
            onSelect={(opt) => setSelectedShipping(opt)}
            hasAddress={!!(addressForm.city && addressForm.district)}
            loading={shippingLoading}
          />

          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
        </div>

        {/* RIGHT */}
        <OrderSummaryBox
          subtotal={subtotal}
          shippingFee={shippingFee}
          couponCode={appliedCoupon}
          couponDiscount={couponDiscount}
          comboLabel={combo?.eligible ? `Mua kèm −${combo.percent}%` : undefined}
          comboDiscount={comboDiscount}
          total={total}
          promoInput={promoInput}
          onPromoInputChange={setPromoInput}
          onApplyCoupon={applyCoupon}
          submitting={submitting}
          onSubmit={handleOpenReview}
          submitLabel="XEM LẠI ĐƠN"
        />
      </div>

      <ReviewOrderModal
        open={showReview}
        cart={cart}
        customerName={addressForm.name}
        customerPhone={addressForm.phone}
        customerAddress={fullAddress}
        paymentMethod={paymentMethod}
        shippingName={selectedShipping?.serviceName || ''}
        subtotal={subtotal}
        shippingFee={shippingFee}
        couponCode={appliedCoupon}
        couponDiscount={couponDiscount}
        comboDiscount={comboDiscount}
        total={total}
        submitting={submitting}
        onCancel={() => setShowReview(false)}
        onConfirm={handleConfirmOrder}
      />
    </div>
  );
}
