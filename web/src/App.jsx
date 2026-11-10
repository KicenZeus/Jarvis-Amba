import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { api, setApiAuthToken, getApiAuthToken } from './api';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import HomeTab from './components/HomeTab';
import TasksTab from './components/TasksTab';
import SchedulesTab from './components/SchedulesTab';
import RemindersTab from './components/RemindersTab';
import FinanceTab from './components/FinanceTab';
import ApprovalsTab from './components/ApprovalsTab';
import DevicesTab from './components/DevicesTab';
import PersonalityTab from './components/PersonalityTab';

export default function App() {
  const [token, setToken] = useState(getApiAuthToken());
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Fetch initial profile & data
  const loadUserData = useCallback(async () => {
    try {
      setLoading(true);
      const meRes = await api.getMe();
      setUser(meRes.user);

      // Register web client device idempotently
      try {
        const webDeviceId = 'web_' + (localStorage.getItem('jarvis_web_dev_id') || Math.random().toString(36).substring(2, 10));
        localStorage.setItem('jarvis_web_dev_id', webDeviceId);
        await api.registerDevice({
          device_identifier: webDeviceId,
          device_name: 'Jarvis Web Client (' + navigator.platform + ')',
          platform: 'web',
          app_version: '3.1.0',
        });
      } catch (_) {}

      // Fetch dashboard & modules
      await refreshAllData();
    } catch (err) {
      console.warn('Session expired or invalid:', err.message);
      handleSignOut();
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAllData = async () => {
    try {
      const [sumRes, taskRes, schedRes, remRes, finRes] = await Promise.allSettled([
        api.getDashboardSummary(),
        api.getTasks(),
        api.getSchedules(),
        api.getReminders(),
        api.getFinanceTransactions({ limit: 50 }),
      ]);

      if (sumRes.status === 'fulfilled') setSummary(sumRes.value?.summary);
      if (taskRes.status === 'fulfilled') setTasks(taskRes.value?.tasks || []);
      if (schedRes.status === 'fulfilled') setSchedules(schedRes.value?.schedules || []);
      if (remRes.status === 'fulfilled') setReminders(remRes.value?.reminders || []);
      if (finRes.status === 'fulfilled') setTransactions(finRes.value?.transactions || []);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadUserData();
    } else {
      setLoading(false);
    }
  }, [token, loadUserData]);

  // Periodic Heartbeat & Active Presence Ping (Phase 9 - PRD Sec 67)
  useEffect(() => {
    if (!token) return;

    const webDeviceId = localStorage.getItem('jarvis_web_dev_id') || 'web_default';
    const pingHeartbeat = () => {
      if (document.visibilityState === 'visible') {
        api.sendHeartbeat({
          device_identifier: webDeviceId,
          platform: 'web',
          app_version: '3.1.0',
        }).catch(() => {});
      }
    };

    pingHeartbeat();
    const interval = setInterval(pingHeartbeat, 45000); // Setiap 45 detik

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pingHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  // Setup Supabase Realtime Subscription (PRD V3 Sec 18)
  useEffect(() => {
    if (!token) return;

    let channel = null;
    try {
      channel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          api.getTasks().then(res => setTasks(res.tasks || [])).catch(() => {});
          api.getDashboardSummary().then(res => setSummary(res.summary)).catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
          api.getSchedules().then(res => setSchedules(res.schedules || [])).catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
          api.getReminders().then(res => setReminders(res.reminders || [])).catch(() => {});
          api.getDashboardSummary().then(res => setSummary(res.summary)).catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => {
          api.getFinanceTransactions().then(res => setTransactions(res.transactions || [])).catch(() => {});
          api.getDashboardSummary().then(res => setSummary(res.summary)).catch(() => {});
        })
        .subscribe((status) => {
          setIsRealtimeConnected(status === 'SUBSCRIBED');
        });
    } catch (err) {
      console.warn('Realtime subscription fallback:', err.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [token]);

  const handleAuthenticated = (accessToken, authUser) => {
    setApiAuthToken(accessToken);
    setToken(accessToken);
    setUser(authUser);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    setApiAuthToken(null);
    setToken(null);
    setUser(null);
    setIsRealtimeConnected(false);
  };

  if (!token) {
    return <AuthModal onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onSignOut={handleSignOut}
        isRealtimeConnected={isRealtimeConnected}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
            <span className="animate-pulse">Menghubungkan ke Jarvis Gateway...</span>
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeTab
                summary={summary}
                onNavigate={setActiveTab}
                onRefresh={refreshAllData}
              />
            )}
            {activeTab === 'tasks' && (
              <TasksTab
                tasks={tasks}
                onRefresh={refreshAllData}
              />
            )}
            {activeTab === 'schedules' && (
              <SchedulesTab
                schedules={schedules}
                onRefresh={refreshAllData}
              />
            )}
            {activeTab === 'reminders' && (
              <RemindersTab
                reminders={reminders}
                onRefresh={refreshAllData}
              />
            )}
            {activeTab === 'finance' && (
              <FinanceTab
                transactions={transactions}
                onRefresh={refreshAllData}
              />
            )}
            {activeTab === 'approvals' && (
              <ApprovalsTab
                user={user}
              />
            )}
            {activeTab === 'personality' && (
              <PersonalityTab
                user={user}
              />
            )}
            {activeTab === 'devices' && (
              <DevicesTab
                onRefresh={refreshAllData}
              />
            )}
          </>
        )}
      </main>

      <footer className="py-4 border-t border-slate-900 text-center text-xs text-slate-600">
        JARVIS Autonomous System V3.1 • Express 5 & Railway Cloud Native
      </footer>
    </div>
  );
}

