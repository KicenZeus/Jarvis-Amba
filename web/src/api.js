/**
 * Jarvis API Client
 * Berkomunikasi dengan Railway Express 5 Gateway (/api/v1/*)
 * Seluruh mutasi & analitik melewati endpoint terproteksi ini.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

let authToken = localStorage.getItem('jarvis_auth_token') || null;

export function setApiAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('jarvis_auth_token', token);
  } else {
    localStorage.removeItem('jarvis_auth_token');
  }
}

export function getApiAuthToken() {
  return authToken;
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));

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

export const api = {
  // Auth & Profile
  getMe: () => request('/auth/me'),
  getWhatsAppLinkCode: () => request('/auth/link-code/whatsapp', { method: 'POST' }),
  getProfile: () => request('/profile'),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),
  getDashboardAnalytics: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard/analytics${qs ? `?${qs}` : ''}`);
  },

  // Tasks
  getTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

  // Schedules
  getSchedules: () => request('/schedules'),
  createSchedule: (data) => request('/schedules', { method: 'POST', body: JSON.stringify(data) }),
  deleteSchedule: (id) => request(`/schedules/${id}`, { method: 'DELETE' }),

  // Reminders
  getReminders: () => request('/reminders'),
  createReminder: (data) => request('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  snoozeReminder: (id, minutes = 10) => request(`/reminders/${id}/snooze`, { method: 'POST', body: JSON.stringify({ minutes }) }),
  dismissReminder: (id) => request(`/reminders/${id}/dismiss`, { method: 'POST' }),
  deleteReminder: (id) => request(`/reminders/${id}`, { method: 'DELETE' }),

  // Finance
  getFinanceTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/finance/transactions${qs ? `?${qs}` : ''}`);
  },
  createFinanceTransaction: (data) => request('/finance/transactions', { method: 'POST', body: JSON.stringify(data) }),
  getFinanceSummary: () => request('/finance/summary'),
  getFinanceEvents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/finance/events${qs ? `?${qs}` : ''}`);
  },
  getFinanceSources: () => request('/finance/sources'),
  addFinanceSource: (data) => request('/finance/sources', { method: 'POST', body: JSON.stringify(data) }),
  updateFinanceSource: (id, data) => request(`/finance/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Devices & Presence (Phase 9 - PRD Sec 65 - 68)
  getDevices: () => request('/devices'),
  registerDevice: (data) => request('/devices/register', { method: 'POST', body: JSON.stringify(data) }),
  revokeDevice: (id) => request(`/devices/${id}/revoke`, { method: 'POST' }),
  revokeOtherDevices: () => request('/devices/revoke-others', { method: 'POST' }),
  sendHeartbeat: (data) => request('/devices/heartbeat', { method: 'POST', body: JSON.stringify(data) }),
  getPresence: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/devices/presence${qs ? `?${qs}` : ''}`);
  },
  sendOffline: (data) => request('/devices/offline', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotificationPreferences: () => request('/notifications/preferences'),
  updateQuietHours: (data) => request('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  setNotificationPreference: (data) => request('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  getNotificationHistory: (limit = 20) => request(`/notifications/history?limit=${limit}`),

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
  getSystemHealth: () => request('/system/health'),
  getSystemVersion: () => request('/system/version'),
};

