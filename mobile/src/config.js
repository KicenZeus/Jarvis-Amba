import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra || {};

export const APP_VERSION = '3.1.0';
export const MIN_SUPPORTED_VERSION = '3.0.0';

// Deteksi environment API gateway
export const API_BASE_URL = extra.apiUrl || (
  Platform.OS === 'android' 
    ? 'http://10.0.2.2:5001/api/v1' 
    : 'http://localhost:5001/api/v1'
);

export const SUPABASE_URL = extra.supabaseUrl || 'https://yrqdmvssmrzjafayefty.supabase.co';
export const SUPABASE_ANON_KEY = extra.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';

