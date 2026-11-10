/**
 * Jarvis Financial Notification Listener Abstraction (PRD V3 Sec 21 & 41)
 * Memfilter notifikasi aplikasi perbankan berbasis Allowlist di perangkat
 * sebelum dikirimkan ke server backend Railway untuk parsing LLM / Regex.
 */

export const BANK_NOTIFICATION_ALLOWLIST = [
  { package: 'com.bca', name: 'BCA mobile', defaultMethod: 'BCA' },
  { package: 'id.co.bri.brimo', name: 'BRImo BRI', defaultMethod: 'BRI' },
  { package: 'com.bankmandiri.livin', name: 'Livin by Mandiri', defaultMethod: 'Mandiri' },
  { package: 'com.gojek.app', name: 'GoPay / Gojek', defaultMethod: 'GoPay' },
  { package: 'com.btpn.dc', name: 'Jenius BTPN', defaultMethod: 'Jenius' },
  { package: 'com.shopee.id', name: 'ShopeePay', defaultMethod: 'ShopeePay' },
  { package: 'com.telkom.indihome.external', name: 'MyTelkomsel', defaultMethod: 'Telkomsel' },
];

export function isAllowedBankingNotification(packageName) {
  if (!packageName) return false;
  return BANK_NOTIFICATION_ALLOWLIST.some(bank => bank.package === packageName.trim().toLowerCase());
}

export function getBankInfo(packageName) {
  return BANK_NOTIFICATION_ALLOWLIST.find(bank => bank.package === packageName?.trim().toLowerCase()) || null;
}

/**
 * Sensor nomor rekening / kartu di sisi HP (PRD Sec 44.2)
 * dan strip informasi sisa saldo sebelum data dikirim keluar perangkat
 */
export function maskSensitiveFinanceText(text) {
  if (!text || typeof text !== 'string') return '';
  let masked = text;
  // Sensor digit nomor rekening / kartu -> **** 1234
  masked = masked.replace(/\b(\d{6,12})(\d{4})\b/g, '**** $2');
  // Strip sisa saldo rekening
  masked = masked.replace(/(?:sisa\s+)?saldo(?:\s+anda)?\s*(?:saat\s+ini)?\s*[:=]?\s*(?:rp\.?\s*)?[\d.,]+/gi, '');
  return masked.replace(/\s+/g, ' ').trim();
}

/**
 * Menyusun payload bersih untuk dikirim ke HTTPS POST /api/v1/finance/events
 */
export function buildFinanceEventPayload(notification) {
  const { packageName, key, postTime, title, text } = notification;
  return {
    package_name: packageName,
    notification_key: key || `notif_${Date.now()}`,
    post_time: postTime || Date.now(),
    title: maskSensitiveFinanceText(title),
    text: maskSensitiveFinanceText(text),
  };
}

