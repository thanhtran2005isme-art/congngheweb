// Shared types & helpers cho các sub-component checkout.

export interface BankAccount {
  id: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch: string;
  qrImage?: string;
}

export interface CheckoutAddressForm {
  name: string;
  phone: string;
  city: string;
  district: string;
  ward: string;
  street: string;
  selectedProvinceCode: number | null;
  selectedDistrictCode: number | null;
  saveToBook: boolean;
}

export const EMPTY_ADDRESS_FORM: CheckoutAddressForm = {
  name: '',
  phone: '',
  city: '',
  district: '',
  ward: '',
  street: '',
  selectedProvinceCode: null,
  selectedDistrictCode: null,
  saveToBook: false,
};

/** Map tên ngân hàng dài → mã VietQR. */
const BANK_CODE_MAP: Record<string, string> = {
  mbbank: 'MB', 'mb bank': 'MB', mb: 'MB',
  vietcombank: 'VCB', vcb: 'VCB',
  techcombank: 'TCB', tcb: 'TCB',
  bidv: 'BIDV',
  vietinbank: 'CTG', ctg: 'CTG', vtb: 'CTG',
  agribank: 'AGRIBANK', agri: 'AGRIBANK',
  acb: 'ACB',
  sacombank: 'STB', stb: 'STB',
  tpbank: 'TPB', tpb: 'TPB',
  vpbank: 'VPB', vpb: 'VPB',
  mbank: 'MB',
};

export function getBankCode(bankName: string): string {
  const key = bankName.toLowerCase().trim();
  return BANK_CODE_MAP[key] || bankName.toUpperCase().replace(/\s+/g, '');
}

export function buildVietQrUrl(bank: BankAccount, amount: number, content: string): string {
  const bankCode = getBankCode(bank.bankName);
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: content,
    accountName: bank.accountHolder,
  });
  return `https://img.vietqr.io/image/${bankCode}-${bank.accountNumber}-compact2.png?${params.toString()}`;
}
