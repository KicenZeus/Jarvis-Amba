import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { mobileApi } from '../services/api';
import { getOrCreateDeviceIdentifier } from '../services/deviceService';
import { getDeviceBatteryGuide } from '../native/BatteryOptimizer';
import { APP_VERSION } from '../config';

export default function SettingsScreen({ user, onSignOut }) {
  const [deviceId, setDeviceId] = useState('');
  const [linkCodeData, setLinkCodeData] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [batteryGuide, setBatteryGuide] = useState(getDeviceBatteryGuide());

  // Personality & Policy states (Phase 8 & 11 - PRD V3 Sec 59-64, Sec 77)
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [responseStyle, setResponseStyle] = useState('CASUAL');
  const [responseLength, setResponseLength] = useState('NORMAL');
  const [tone, setTone] = useState('Tenang');
  const [autoCapturePolicy, setAutoCapturePolicy] = useState('AUTO_IF_CONFIDENT');

  useEffect(() => {
    getOrCreateDeviceIdentifier().then(setDeviceId);
    loadPersonalityPrefs();
  }, []);

  const loadPersonalityPrefs = async () => {
    try {
      setPrefLoading(true);
      const res = await mobileApi.getPreferences({ channel: 'ANDROID' });
      if (res?.resolved) {
        setResponseStyle(res.resolved.response_style || 'CASUAL');
        setResponseLength(res.resolved.response_length || 'NORMAL');
        setTone(res.resolved.tone || 'Tenang');
      }
      if (res?.preferences?.global?.auto_capture_policy) {
        setAutoCapturePolicy(res.preferences.global.auto_capture_policy);
      }
    } catch (_) {
      // Abaikan jika offline / dev mode
    } finally {
      setPrefLoading(false);
    }
  };

  const handleSavePolicy = async (newPolicy) => {
    try {
      setAutoCapturePolicy(newPolicy);
      await mobileApi.updateGlobalPreferences({ auto_capture_policy: newPolicy });
      Alert.alert('Sukses', `Kebijakan auto-capture berhasil diubah ke: ${newPolicy}`);
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Gagal mengubah kebijakan');
    }
  };

  const handleSavePersonality = async () => {
    try {
      setPrefSaving(true);
      await mobileApi.updateChannelPreferences('ANDROID', {
        response_style: responseStyle,
        response_length: responseLength,
        tone,
      });
      Alert.alert('Sukses', 'Preferensi kepribadian Jarvis untuk Android berhasil diperbarui!');
    } catch (err) {
      Alert.alert('Gagal', err.message || 'Gagal menyimpan preferensi');
    } finally {
      setPrefSaving(false);
    }
  };

  const handleGenerateLinkCode = async () => {
    setLinkLoading(true);
    try {
      const res = await mobileApi.getWhatsAppLinkCode();
      setLinkCodeData(res);
    } catch (err) {
      Alert.alert('Gagal', err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>PROFIL PENGGUNA</Text>
        <Text style={styles.userName}>{user?.displayName || user?.email || 'Komandan'}</Text>
        <Text style={styles.userRole}>Hak Akses: {user?.role || 'OWNER'}</Text>
        <Text style={styles.userSub}>ID: {user?.id || '-'}</Text>
      </View>

      {/* WhatsApp Linking */}
      <View style={[styles.card, styles.waCard]}>
        <Text style={[styles.sectionHeader, { color: '#10b981' }]}>PENAUTAN WHATSAPP INBOUND (!link)</Text>
        <Text style={styles.waDesc}>
          Tautkan nomor WhatsApp Anda ke akun Jarvis untuk mengakses asisten dan reminder dari WA.
        </Text>

        <TouchableOpacity 
          style={styles.linkBtn} 
          onPress={handleGenerateLinkCode}
          disabled={linkLoading}
        >
          <Text style={styles.linkBtnText}>
            {linkLoading ? 'Membuat Kode...' : 'Dapatkan Kode !link 6-Digit'}
          </Text>
        </TouchableOpacity>

        {linkCodeData && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Kirim pesan ini ke bot WhatsApp Jarvis:</Text>
            <Text style={styles.codeText}>!link {linkCodeData.code}</Text>
            <Text style={styles.codeExpire}>Berlaku selama 10 menit.</Text>
          </View>
        )}
      </View>

      {/* Personality & Persona Center (Phase 8 - PRD Sec 59 - 64) */}
      <View style={styles.card}>
        <Text style={[styles.sectionHeader, { color: '#6366f1' }]}>KEPRIBADIAN ASISTEN (ANDROID OVERRIDE)</Text>
        <Text style={styles.waDesc}>
          Atur bagaimana Jarvis merespons Anda saat membuka aplikasi Android ini.
        </Text>

        {/* Style Selector */}
        <Text style={styles.prefSubLabel}>Gaya Bahasa (response_style):</Text>
        <View style={styles.chipsRow}>
          {['CASUAL', 'FORMAL', 'FRIENDLY', 'TECHNICAL'].map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.chip, responseStyle === st && styles.chipActive]}
              onPress={() => setResponseStyle(st)}
            >
              <Text style={[styles.chipText, responseStyle === st && styles.chipTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Length Selector */}
        <Text style={styles.prefSubLabel}>Panjang Respon (response_length):</Text>
        <View style={styles.chipsRow}>
          {['SHORT', 'NORMAL', 'DETAILED'].map((ln) => (
            <TouchableOpacity
              key={ln}
              style={[styles.chip, responseLength === ln && styles.chipActive]}
              onPress={() => setResponseLength(ln)}
            >
              <Text style={[styles.chipText, responseLength === ln && styles.chipTextActive]}>
                {ln}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tone Selector */}
        <Text style={styles.prefSubLabel}>Nada Suasana (Tone):</Text>
        <View style={styles.chipsRow}>
          {['Tenang', 'Ceria', 'Netral', 'Fokus'].map((tn) => (
            <TouchableOpacity
              key={tn}
              style={[styles.chip, tone === tn && styles.chipActive]}
              onPress={() => setTone(tn)}
            >
              <Text style={[styles.chipText, tone === tn && styles.chipTextActive]}>
                {tn}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.savePrefBtn} 
          onPress={handleSavePersonality}
          disabled={prefSaving}
        >
          <Text style={styles.savePrefBtnText}>
            {prefSaving ? 'Menyimpan...' : 'Simpan Preferensi Android'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Finance Auto-Capture Policy (Phase 11 - PRD Sec 77) */}
      <View style={styles.card}>
        <Text style={[styles.sectionHeader, { color: '#818cf8' }]}>KEBIJAKAN AUTO-CAPTURE FINANSIAL</Text>
        <Text style={styles.cardDesc}>
          Atur bagaimana transaksi dari notifikasi perbankan diproses dan disetujui (PRD Sec 77).
        </Text>

        <View style={styles.policyRow}>
          {[
            { id: 'AUTO_IF_CONFIDENT', label: 'Auto (≥95%)', desc: 'Otomatis catat jika yakin, ragu masuk Approval' },
            { id: 'CONFIRM_ALWAYS', label: 'Konfirmasi Semua', desc: 'Wajib disetujui di Approval Center' },
            { id: 'DISABLED', label: 'Nonaktif', desc: 'Matikan auto-capture notifikasi bank' },
          ].map((pol) => (
            <TouchableOpacity
              key={pol.id}
              style={[styles.policyOption, autoCapturePolicy === pol.id && styles.policyOptionActive]}
              onPress={() => handleSavePolicy(pol.id)}
            >
              <Text style={[styles.policyTitle, autoCapturePolicy === pol.id && styles.policyTitleActive]}>
                {pol.label}
              </Text>
              <Text style={styles.policyDesc}>{pol.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Device Info */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>INFORMASI PERANGKAT</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Device Identifier:</Text>
          <Text style={styles.infoVal} numberOfLines={1}>{deviceId || 'Loading...'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>App Version:</Text>
          <Text style={styles.infoVal}>v{APP_VERSION} (Android Sideload)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Platform:</Text>
          <Text style={styles.infoVal}>Android Sideload Native</Text>
        </View>
      </View>

      {/* Battery Optimization Guide (DontKillMyApp) */}
      <View style={styles.card}>
        <Text style={styles.sectionHeader}>PANDUAN ANTI-KILL BACKGROUND ({batteryGuide.brand})</Text>
        <Text style={styles.batterySub}>
          Agar alarm dan sinkronisasi tepat waktu saat HP terkunci (Doze Mode), ikuti langkah berikut:
        </Text>
        {batteryGuide.steps.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            <Text style={styles.stepNum}>{idx + 1}.</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onSignOut}>
        <Text style={styles.logoutText}>Keluar dari Akun</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  waCard: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#818cf8',
    letterSpacing: 1,
    marginBottom: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 4,
  },
  userSub: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  waDesc: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 12,
  },
  linkBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  linkBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  codeBox: {
    marginTop: 12,
    backgroundColor: '#030712',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  codeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },
  codeExpire: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  infoKey: {
    fontSize: 11,
    color: '#94a3b8',
  },
  infoVal: {
    fontSize: 11,
    color: '#f8fafc',
    fontWeight: '600',
    maxWidth: '60%',
  },
  batterySub: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818cf8',
  },
  stepText: {
    fontSize: 11,
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 16,
  },
  prefSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  chipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  savePrefBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  savePrefBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#f43f5e',
    fontSize: 13,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 10,
    lineHeight: 16,
  },
  policyRow: {
    gap: 8,
  },
  policyOption: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  policyOptionActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 2,
  },
  policyTitleActive: {
    color: '#818cf8',
  },
  policyDesc: {
    fontSize: 10,
    color: '#64748b',
    lineHeight: 14,
  },
});

