import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { mobileApi } from '../services/api';

// 1. Konfigurasi handler notifikasi agar alarm berbunyi keras dengan getar di foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

const ALARM_CHANNEL_ID = 'jarvis-physical-alarm';
const STORAGE_KEY_LOCAL_ALARMS = 'jarvis_local_alarms';

/**
 * Jarvis Android Alarm Engine (PRD V3 Sec 20, 25 & 31)
 * Menggunakan expo-notifications channel berkategori ALARM dengan prioritas MAX,
 * bypass Do Not Disturb, dan getaran berulang menyerupai alarm fisik bawaan ponsel.
 */
class JarvisAlarmEngine {
  constructor() {
    this.channelReady = false;
    this.initAlarmChannel();
  }

  /**
   * Inisialisasi saluran notifikasi berkategori ALARM di Android
   */
  async initAlarmChannel() {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
          name: 'Alarm Fisik Jarvis',
          description: 'Saluran alarm fisik dengan prioritas maksimal & getaran keras',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800],
          bypassDnd: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          enableLights: true,
          lightColor: '#6366f1',
        });
        this.channelReady = true;
      } catch (err) {
        console.warn('⚠️ [AlarmEngine] Gagal inisialisasi channel alarm:', err.message);
      }
    }
  }

  /**
   * Menjadwalkan alarm lokal fisik pada waktu presisi
   * @param {object} reminder - { id, reminder_text, remind_at, delivery_mode }
   */
  async scheduleAlarm(reminder) {
    if (!reminder || !reminder.remind_at) return false;

    const triggerDate = new Date(reminder.remind_at);
    const triggerMs = triggerDate.getTime();
    if (isNaN(triggerMs) || triggerMs <= Date.now()) {
      return false; // Jangan jadwalkan alarm di masa lalu
    }

    try {
      await this.initAlarmChannel();
      await this.persistAlarmLocally(reminder);

      // Batalkan alarm lama jika ada id yang sama
      await this.cancelAlarm(reminder.id);

      // Jadwalkan notifikasi fisik Android berbasis AlarmManager
      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: `alarm_${reminder.id}`,
        content: {
          title: '⏰ ALARM JARVIS',
          body: reminder.reminder_text || reminder.title || 'Waktunya pengingat Jarvis!',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 800, 400, 800, 400, 800, 400, 800],
          data: {
            reminderId: reminder.id,
            isAlarm: true,
            deliveryMode: reminder.delivery_mode || 'ALARM',
          },
        },
        trigger: {
          date: triggerDate,
          channelId: ALARM_CHANNEL_ID,
        },
      });

      console.log(`⏰ [AlarmEngine] Alarm fisik dijadwalkan: ${notificationId} pada ${triggerDate.toLocaleTimeString()}`);
      return true;
    } catch (err) {
      console.warn('⚠️ [AlarmEngine] Gagal menjadwalkan alarm fisik:', err.message);
      return false;
    }
  }

  /**
   * Membatalkan alarm terjadwal
   */
  async cancelAlarm(reminderId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`alarm_${reminderId}`);
      await this.removeLocalAlarm(reminderId);
      console.log(`⏰ [AlarmEngine] Alarm #${reminderId} dibatalkan.`);
      return true;
    } catch (err) {
      console.warn('⚠️ [AlarmEngine] Gagal membatalkan alarm:', err.message);
      return false;
    }
  }

  /**
   * Menyelaraskan seluruh alarm lokal dengan reminder mendatang dari server (PRD V3 Sec 20.3)
   */
  async syncWithServer() {
    try {
      const data = await mobileApi.getReminders();
      const upcoming = (data.reminders || [])
        .filter(r => r.status === 'pending' && new Date(r.remind_at).getTime() > Date.now())
        .slice(0, 20);

      for (const r of upcoming) {
        if (r.delivery_mode === 'ALARM' || !r.delivery_mode) {
          await this.scheduleAlarm(r);
        }
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
