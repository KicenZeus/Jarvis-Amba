import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileApi } from './api';
import { APP_VERSION } from '../config';

const STORAGE_KEY_DEVICE_ID = 'jarvis_device_identifier';

export async function getOrCreateDeviceIdentifier() {
  let devId = await AsyncStorage.getItem(STORAGE_KEY_DEVICE_ID);
  if (!devId) {
    const randomHex = Math.random().toString(36).substring(2, 12);
    devId = `andro_${Date.now()}_${randomHex}`;
    await AsyncStorage.setItem(STORAGE_KEY_DEVICE_ID, devId);
  }
  return devId;
}

export async function registerCurrentDevice(pushToken = null) {
  try {
    const identifier = await getOrCreateDeviceIdentifier();
    const platformName = Platform.OS === 'android' ? 'android' : (Platform.OS === 'ios' ? 'ios' : 'web');
    const deviceName = `Android Phone (${Platform.constants?.Model || 'Mobile Device'})`;

    const result = await mobileApi.registerDevice({
      device_identifier: identifier,
      device_name: deviceName,
      platform: platformName,
      app_version: APP_VERSION,
      push_token: pushToken || null,
    });

    return result.device;
  } catch (err) {
    console.warn('⚠️ [DeviceService] Gagal meregistrasi perangkat:', err.message);
    return null;
  }
}

