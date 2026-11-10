/**
 * Jarvis Battery Optimization & Autostart Guide (PRD V3 Sec 25.2 - DontKillMyApp)
 * Menampilkan instruksi optimasi baterai agar alarm & background sync tidak terbunuh oleh OS.
 */

let Platform = { constants: {} };
try {
  Platform = require('react-native').Platform || Platform;
} catch (_) {}

export const OEM_BATTERY_GUIDELINES = {
  xiaomi: {
    brand: 'Xiaomi / Redmi / POCO',
    steps: [
      'Buka Pengaturan > Aplikasi > Kelola Aplikasi > Jarvis',
      'Aktifkan opsi "Mulai Otomatis" (Autostart)',
      'Buka Penghemat Baterai > Pilih "Tidak Ada Pembatasan" (No Restrictions)',
    ],
  },
  samsung: {
    brand: 'Samsung (One UI)',
    steps: [
      'Buka Pengaturan > Perawatan Perangkat > Baterai',
      'Batas Penggunaan Latar Belakang > Tambahkan Jarvis ke "Aplikasi yang Tidak Pernah Tidur"',
      'Matikan opsi "Put the unused apps to sleep"',
    ],
  },
  oppo: {
    brand: 'Oppo / Realme (ColorOS / Realme UI)',
    steps: [
      'Buka Pengaturan > Manajemen Aplikasi > Jarvis',
      'Izin Mulai Otomatis > Aktifkan Mulai Otomatis & Latar Belakang',
      'Konsumsi Daya > Izinkan Aktivitas Latar Belakang',
    ],
  },
  vivo: {
    brand: 'Vivo / iQOO (Funtouch OS)',
    steps: [
      'Buka Pengaturan > Baterai > Manajemen Konsumsi Daya Tinggi di Latar Belakang',
      'Pilih Jarvis > Izinkan Konsumsi Daya Tinggi',
      'Pengaturan Aplikasi > Autostart > Aktifkan Jarvis',
    ],
  },
  general: {
    brand: 'Android Umum / Pixel',
    steps: [
      'Buka Info Aplikasi Jarvis > Penggunaan Baterai',
      'Ubah dari "Dioptimalkan" menjadi "Tanpa Batasan" (Unrestricted)',
      'Pastikan opsi "Jeda aktivitas aplikasi jika tidak digunakan" dinonaktifkan',
    ],
  },
};

export function getDeviceBatteryGuide() {
  const model = (Platform?.constants?.Model || '').toLowerCase();
  const brand = (Platform?.constants?.Brand || '').toLowerCase();

  if (brand.includes('xiaomi') || brand.includes('redmi') || brand.includes('poco')) {
    return OEM_BATTERY_GUIDELINES.xiaomi;
  }
  if (brand.includes('samsung')) {
    return OEM_BATTERY_GUIDELINES.samsung;
  }
  if (brand.includes('oppo') || brand.includes('realme')) {
    return OEM_BATTERY_GUIDELINES.oppo;
  }
  if (brand.includes('vivo')) {
    return OEM_BATTERY_GUIDELINES.vivo;
  }
  return OEM_BATTERY_GUIDELINES.general;
}
