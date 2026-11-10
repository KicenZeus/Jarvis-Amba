import React, { useState, useEffect, useCallback } from 'react';
import { 
  SafeAreaView, 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TextInput, 
  TouchableOpacity, 
  StatusBar 
} from 'react-native';
import { mobileApi, setMobileAuthToken, getMobileAuthToken } from './src/services/api';
import { supabase } from './src/services/supabase';
import { registerCurrentDevice, getOrCreateDeviceIdentifier } from './src/services/deviceService';
import { AlarmModule } from './src/native/AlarmModule';
import Header from './src/components/Header';
import BottomTabBar from './src/components/BottomTabBar';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import TasksScreen from './src/screens/TasksScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import RemindersScreen from './src/screens/RemindersScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // App data state
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reminders, setReminders] = useState([]);

  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Load User Data & Sync
  const loadData = useCallback(async () => {
    try {
      const [userRes, sumRes, taskRes, finRes, remRes] = await Promise.allSettled([
        mobileApi.getMe(),
        mobileApi.getFinanceSummary(),
        mobileApi.getTasks(),
        mobileApi.getTransactions({ limit: 30 }),
        mobileApi.getReminders(),
      ]);

      if (userRes.status === 'fulfilled') setUser(userRes.value.user);
      if (taskRes.status === 'fulfilled') setTasks(taskRes.value.tasks || []);
      if (finRes.status === 'fulfilled') setTransactions(finRes.value.transactions || []);
      if (remRes.status === 'fulfilled') setReminders(remRes.value.reminders || []);

      // Hitung kartu ringkasan
      const pendingCount = (taskRes.value?.tasks || []).filter(t => t.status !== 'completed').length;
      const completedCount = (taskRes.value?.tasks || []).filter(t => t.status === 'completed').length;
      const nextRem = (remRes.value?.reminders || []).find(r => r.status === 'pending');

      setSummary({
        monthlyExpense: sumRes.value?.currentMonth?.expense || 0,
        monthlyIncome: sumRes.value?.currentMonth?.income || 0,
        pendingTasks: pendingCount,
        completedTasks: completedCount,
        nextReminder: nextRem || null,
        system: { version: '3.1.0' },
      });

      // Sinkronkan alarm ke AlarmManager lokal
      await AlarmModule.syncWithServer();
    } catch (err) {
      console.warn('Failed to load user data:', err.message);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Check saved token on boot
  useEffect(() => {
    getMobileAuthToken().then((savedToken) => {
      if (savedToken) {
        setToken(savedToken);
        registerCurrentDevice();
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, loadData]);

  // Periodic Heartbeat & Active Presence Ping (Phase 9 - PRD Sec 67)
  useEffect(() => {
    if (!token) return;

    let heartbeatTimer = null;
    getOrCreateDeviceIdentifier().then((devId) => {
      const pingHeartbeat = () => {
        mobileApi.sendHeartbeat({
          device_identifier: devId,
          platform: 'android',
          app_version: '3.1.0',
        }).catch(() => {});
      };

      pingHeartbeat();
      heartbeatTimer = setInterval(pingHeartbeat, 60000); // 60 detik
    });

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [token]);

  // Realtime Subscriptions via Supabase
  useEffect(() => {
    if (!token) return;

    let channel = null;
    try {
      channel = supabase
        .channel('mobile-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          mobileApi.getTasks().then(res => setTasks(res.tasks || [])).catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => {
          mobileApi.getReminders().then(res => {
            setReminders(res.reminders || []);
            AlarmModule.syncWithServer();
          }).catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => {
          mobileApi.getTransactions().then(res => setTransactions(res.transactions || [])).catch(() => {});
        })
        .subscribe();
    } catch (_) {}

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [token]);

  // Login Handlers
  const handleLogin = async () => {
    if (!email || !password) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;
      if (data.session) {
        await setMobileAuthToken(data.session.access_token);
        setToken(data.session.access_token);
        await registerCurrentDevice();
      }
    } catch (err) {
      setAuthError(err.message || 'Login gagal');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOwnerBypass = async () => {
    // Simulated token for owner mode
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(JSON.stringify({
      sub: '713137141072396370',
      email: 'owner@jarvis.internal',
      role: 'OWNER',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    })).replace(/=/g, '');
    const mockJwt = `${header}.${payload}.mobile_dev_signature`;

    await setMobileAuthToken(mockJwt);
    setToken(mockJwt);
    await registerCurrentDevice();
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    await setMobileAuthToken(null);
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingLabel}>Memuat Jarvis Mobile...</Text>
      </View>
    );
  }

  // Auth Screen
  if (!token) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#030712" />
        <View style={styles.authCard}>
          <Text style={styles.authBrand}>JARVIS V3</Text>
          <Text style={styles.authTitle}>Mobile Command Center</Text>
          <Text style={styles.authSub}>Masuk untuk menghubungkan perangkat Anda ke AI Core</Text>

          {authError && <Text style={styles.errorText}>{authError}</Text>}

          <TextInput
            style={styles.authInput}
            value={email}
            onChangeText={setEmail}
            placeholder="Email..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.authInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Password..."
            placeholderTextColor="#64748b"
            secureTextEntry
          />

          <TouchableOpacity 
            style={[styles.authBtn, authLoading && { opacity: 0.6 }]} 
            onPress={handleLogin}
            disabled={authLoading}
          >
            <Text style={styles.authBtnText}>{authLoading ? 'Memproses...' : 'Masuk'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bypassBtn} onPress={handleOwnerBypass}>
            <Text style={styles.bypassText}>👑 Masuk Cepat sebagai Owner (KicenZeus)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Header 
        title={
          activeTab === 'home' ? 'Ringkasan Harian' :
          activeTab === 'chat' ? 'Obrolan AI' :
          activeTab === 'tasks' ? 'Daftar Tugas' :
          activeTab === 'finance' ? 'Keuangan' :
          activeTab === 'reminders' ? 'Alarm & Pengingat' : 'Pengaturan'
        }
        subtitle={user?.displayName || user?.email}
      />

      <View style={styles.screenContainer}>
        {activeTab === 'home' && (
          <HomeScreen 
            summary={summary} 
            onNavigate={setActiveTab} 
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
        {activeTab === 'chat' && <ChatScreen />}
        {activeTab === 'tasks' && (
          <TasksScreen 
            tasks={tasks} 
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
        {activeTab === 'finance' && (
          <FinanceScreen 
            transactions={transactions} 
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
        {activeTab === 'reminders' && (
          <RemindersScreen 
            reminders={reminders} 
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsScreen 
            user={user} 
            onSignOut={handleSignOut} 
          />
        )}
      </View>

      <BottomTabBar activeTab={activeTab} onSelectTab={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#030712',
  },
  screenContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'center',
    padding: 20,
  },
  authCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  authBrand: {
    fontSize: 12,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 2,
    marginBottom: 4,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  authSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 20,
    lineHeight: 18,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  authInput: {
    backgroundColor: '#030712',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  authBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  authBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  bypassBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bypassText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
});

