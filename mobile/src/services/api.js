import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, APP_VERSION } from '../config';

let cachedToken = null;

export async function setMobileAuthToken(token) {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem('jarvis_mobile_token', token);
  } else {
    await AsyncStorage.removeItem('jarvis_mobile_token');
  }
}

export async function getMobileAuthToken() {
  if (!cachedToken) {
    cachedToken = await AsyncStorage.getItem('jarvis_mobile_token');
  }
  return cachedToken;
}

async function request(endpoint, options = {}) {
  const token = await getMobileAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-Min-App-Version': APP_VERSION,
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));

  if (response.status === 426) {
    throw new Error('Aplikasi telah usang. Silakan perbarui ke versi terbaru di Web Dashboard.');
  }

  if (!response.ok || json.success === false) {
    const errorMsg = json.error?.message || json.message || `HTTP ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.code = json.error?.code || 'ERROR';
    err.details = json.error?.details || [];
    throw err;
  }

  return json.data;
}

export const mobileApi = {
  // Auth & Profile
  getMe: () => request('/auth/me'),
  getWhatsAppLinkCode: () => request('/auth/link-code/whatsapp', { method: 'POST' }),

  // Chat AI Direct Gemini
  sendChatMessage: (message, wantsVoice = false) => request('/conversations/chat', {
    method: 'POST',
    body: JSON.stringify({ message, channel: 'ANDROID_APP', wantsVoice }),
  }),

  // Tasks
  getTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Reminders & Alarms
  getReminders: () => request('/reminders'),
  createReminder: (data) => request('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  snoozeReminder: (id, minutes = 10) => request(`/reminders/${id}/snooze`, { method: 'POST', body: JSON.stringify({ minutes }) }),
  dismissReminder: (id) => request(`/reminders/${id}/dismiss`, { method: 'POST' }),
  ackAlarm: (id, deliveryId = null, deviceId = null) => request(`/reminders/${id}/ack`, {
    method: 'POST',
    body: JSON.stringify({ delivery_id: deliveryId, device_id: deviceId }),
  }),

  // Dashboard & Analytics (Phase 10 - PRD Sec 69 - 73)
  getDashboardSummary: () => request('/dashboard/summary'),
  getDashboardAnalytics: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard/analytics${qs ? `?${qs}` : ''}`);
  },

  // Finance
  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/finance/transactions${qs ? `?${qs}` : ''}`);
  },
  createTransaction: (data) => request('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
  getFinanceSummary: () => request('/finance/summary'),
  ingestFinanceEvent: (data) => request('/finance/events', { method: 'POST', body: JSON.stringify(data) }),
  getFinanceSources: () => request('/finance/sources'),

  // Devices & Presence (Phase 9 - PRD Sec 65 - 68)
  registerDevice: (data) => request('/devices/register', { method: 'POST', body: JSON.stringify(data) }),
  getDevices: () => request('/devices'),
  revokeDevice: (id) => request(`/devices/${id}/revoke`, { method: 'POST' }),
  sendHeartbeat: (data) => request('/devices/heartbeat', { method: 'POST', body: JSON.stringify(data) }),
  getPresence: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/devices/presence${qs ? `?${qs}` : ''}`);
  },
  sendOffline: (data) => request('/devices/offline', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications & Quiet Hours
  getNotificationPreferences: () => request('/notifications/preferences'),
  updateQuietHours: (data) => request('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  setNotificationPreference: (data) => request('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),

  // Personality & Preference Center (PRD V3 Phase 8 Sec 59 - 64)
  getPreferences: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/personality${qs ? `?${qs}` : ''}`);
  },
  updateGlobalPreferences: (data) => request('/personality/global', { method: 'PUT', body: JSON.stringify(data) }),
  updateChannelPreferences: (channel, data) => request(`/personality/channels/${channel}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteChannelPreferences: (channel) => request(`/personality/channels/${channel}`, { method: 'DELETE' }),

  // Approval Center (PRD V3 Phase 11 Sec 74 - 79)
  getApprovals: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/approvals${qs ? `?${qs}` : ''}`);
  },
  getApprovalHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/approvals/history${qs ? `?${qs}` : ''}`);
  },
  actionApproval: (id, action, reason = null) => request(`/approvals/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  }),

  // Offline Sync & Recovery (PRD V3 Phase 12 Sec 80 - 84)
  syncOfflineOperations: (operations) => request('/sync', {
    method: 'POST',
    body: JSON.stringify({ operations }),
  }),

  // System
  getHealth: () => request('/system/health'),
  getVersion: () => request('/system/version'),
};

