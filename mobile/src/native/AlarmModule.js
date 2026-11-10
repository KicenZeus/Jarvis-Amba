import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileApi } from '../services/api';

const STORAGE_KEY_LOCAL_ALARMS = 'jarvis_local_alarms';

/**
 * Jarvis Android Alarm Engine (PRD V3 Sec 20, 25 & 31)
 * Menjadwalkan alarm fisik presisi via Android AlarmManager.setAlarmClock()
 */
class JarvisAlarmEngine {
  constructor() {
    this.scheduledAlarms = new Map();
  }

  /**
   * Menjadwalkan alarm lokal pada waktu presisi
   * @param {object} reminder - { id, reminder_text, remind_at, channel_id }
   */
  async scheduleAlarm(reminder) {
    if (!reminder || !reminder.remind_at) return false;

    const triggerMs = new Date(reminder.remind_at).getTime();
    if (isNaN(triggerMs) || triggerMs <= Date.now()) {
      return false; // Jangan jadwalkan alarm di masa lalu
    }

    try {
      // 1. Simpan ke local cache untuk reboot recovery
      await this.persistAlarmLocally(reminder);

      // 2. Jika di Android native, panggil AlarmManager.setAlarmClock via bridge jika terpasang
      if (Platform.OS === 'android' && NativeModules.JarvisAlarmModule) {
        NativeModules.JarvisAlarmModule.setExactAlarm(
          reminder.id,
          triggerMs,
          reminder.reminder_text || reminder.title || 'Pengingat Jarvis'
        );
      } else {
        // Fallback timer untuk mode expo development
        const delayMs = triggerMs - Date.now();
        if (delayMs < 2147483647) { // 32-bit int limit
          const timerId = setTimeout(() => {
            this.triggerLocalAlarm(reminder);
          }, delayMs);
          this.scheduledAlarms.set(reminder.id, timerId);
        }
      }

      console.log(`⏰ [AlarmEngine] Alarm '${reminder.reminder_text || reminder.title}' dijadwalkan pada ${new Date(triggerMs).toLocaleTimeString()}`);
      return true;
    } catch (err) {
      console.warn('⚠️ [AlarmEngine] Gagal menjadwalkan alarm:', err.message);
      return false;
    }
  }

  /**
   * Membatalkan alarm terjadwal
   */
  async cancelAlarm(reminderId) {
    try {
      if (this.scheduledAlarms.has(reminderId)) {
        clearTimeout(this.scheduledAlarms.get(reminderId));
        this.scheduledAlarms.delete(reminderId);
      }

      if (Platform.OS === 'android' && NativeModules.JarvisAlarmModule) {
        NativeModules.JarvisAlarmModule.cancelAlarm(reminderId);
      }

      await this.removeLocalAlarm(reminderId);
      console.log(`⏰ [AlarmEngine] Alarm #${reminderId} dibatalkan.`);
      return true;
    } catch (err) {
      console.warn('⚠️ [AlarmEngine] Gagal membatalkan alarm:', err.message);
      return false;
    }
  }

  /**
   * Memicu bunyi alarm layar penuh dan mengirimkan ACK ke server
   */
  async triggerLocalAlarm(reminder) {
    console.log(`🚨 [AlarmEngine] ALARM BUNYI: "${reminder.reminder_text || reminder.title}"`);
    
    // Kirim ACK penerimaan alarm ke server (PRD V3 Sec 35)
    try {
      await mobileApi.ackAlarm(reminder.id);
    } catch (_) {}
  }

  /**
   * Menyelaraskan seluruh alarm lokal dengan 20 reminder mendatang dari server (PRD V3 Sec 20.3)
   */
  async syncWithServer() {
    try {
      const data = await mobileApi.getReminders();
      const upcoming = (data.reminders || [])
        .filter(r => r.status === 'pending' && new Date(r.remind_at).getTime() > Date.now())
        .slice(0, 20);

      for (const r of upcoming) {
        await this.scheduleAlarm(r);
      }
      return upcoming.length;
    } catch (err) {
      console.warn('⚠️ [AlarmEngine] Gagal sinkronisasi alarm dari server:', err.message);
      return 0;
    }
  }

  // --- Helper Storage ---
  async persistAlarmLocally(reminder) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_LOCAL_ALARMS);
      const list = raw ? JSON.parse(raw) : [];
      const updated = list.filter(item => item.id !== reminder.id);
      updated.push(reminder);
      await AsyncStorage.setItem(STORAGE_KEY_LOCAL_ALARMS, JSON.stringify(updated));
    } catch (_) {}
  }

  async removeLocalAlarm(id) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_LOCAL_ALARMS);
      if (!raw) return;
      const list = JSON.parse(raw);
      const filtered = list.filter(item => item.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY_LOCAL_ALARMS, JSON.stringify(filtered));
    } catch (_) {}
  }
}

export const AlarmModule = new JarvisAlarmEngine();

