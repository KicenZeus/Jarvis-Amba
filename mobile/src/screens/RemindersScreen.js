import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  Alert, 
  RefreshControl 
} from 'react-native';
import { mobileApi } from '../services/api';
import { AlarmModule } from '../native/AlarmModule';

export default function RemindersScreen({ reminders, onRefresh, refreshing }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('ALARM');
  const [loading, setLoading] = useState(false);

  const active = reminders.filter(r => r.status === 'pending');

  const setQuickTime = (minutesAhead) => {
    const target = new Date(Date.now() + minutesAhead * 60 * 1000);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const mins = String(target.getMinutes()).padStart(2, '0');
    setRemindAt(`${year}-${month}-${day}T${hours}:${mins}:00`);
  };

  const setTomorrowMorning = () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(6, 0, 0, 0);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    setRemindAt(`${year}-${month}-${day}T06:00:00`);
  };

  const handleOpenModal = () => {
    setQuickTime(10);
    setModalVisible(true);
  };

  const handleSnooze = async (id) => {
    try {
      await mobileApi.snoozeReminder(id, 10);
      onRefresh();
    } catch (err) {
      Alert.alert('Gagal', err.message);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await mobileApi.dismissReminder(id);
      await AlarmModule.cancelAlarm(id);
      onRefresh();
    } catch (err) {
      Alert.alert('Gagal', err.message);
    }
  };

  const handleCreate = async () => {
    if (!reminderText.trim() || !remindAt) {
      Alert.alert('Validasi', 'Teks pengingat dan waktu wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const res = await mobileApi.createReminder({
        reminder_text: reminderText.trim(),
        title: reminderText.trim(),
        remind_at: new Date(remindAt).toISOString(),
        delivery_mode: deliveryMode,
      });

      if (res.reminder) {
        await AlarmModule.scheduleAlarm(res.reminder);
      }

      setReminderText('');
      setRemindAt('');
      setModalVisible(false);
      onRefresh();
    } catch (err) {
      Alert.alert('Gagal', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>Alarm & Pengingat Aktif ({active.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenModal}>
          <Text style={styles.addBtnText}>+ Set Alarm</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.list} 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
      >
        {active.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>⏰</Text>
            <Text style={styles.emptyTitle}>Tidak ada alarm aktif</Text>
            <Text style={styles.emptySub}>Semua jadwal pengingat sudah selesai atau belum diatur.</Text>
          </View>
        ) : (
          active.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.infoCol}>
                <Text style={styles.remText}>{r.reminder_text || r.title}</Text>
                <View style={styles.timeRow}>
                  <Text style={styles.timeClock}>
                    {new Date(r.remind_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                  </Text>
                  <Text style={styles.dateText}>
                    {new Date(r.remind_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.snoozeBtn} onPress={() => handleSnooze(r.id)}>
                  <Text style={styles.snoozeText}>+10m</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dismissBtn} onPress={() => handleDismiss(r.id)}>
                  <Text style={styles.dismissText}>Matikan</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Set Alarm Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Alarm / Pengingat</Text>

            <TextInput
              style={styles.modalInput}
              value={reminderText}
              onChangeText={setReminderText}
              placeholder="Contoh: Bangun tidur / Minum obat"
              placeholderTextColor="#64748b"
            />

            <TextInput
              style={styles.modalInput}
              value={remindAt}
              onChangeText={setRemindAt}
              placeholder="Waktu: YYYY-MM-DDTHH:mm:ss"
              placeholderTextColor="#64748b"
            />

            {/* Quick Presets */}
            <View style={styles.presetsRow}>
              <TouchableOpacity style={styles.presetChip} onPress={() => setQuickTime(5)}>
                <Text style={styles.presetChipText}>+5 Mnt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => setQuickTime(15)}>
                <Text style={styles.presetChipText}>+15 Mnt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => setQuickTime(30)}>
                <Text style={styles.presetChipText}>+30 Mnt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={() => setQuickTime(60)}>
                <Text style={styles.presetChipText}>+1 Jam</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetChip} onPress={setTomorrowMorning}>
                <Text style={styles.presetChipText}>Pagi 06:00</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modeSelector}>
              <TouchableOpacity 
                style={[styles.modeBtn, deliveryMode === 'ALARM' && styles.activeMode]}
                onPress={() => setDeliveryMode('ALARM')}
              >
                <Text style={[styles.modeText, deliveryMode === 'ALARM' && styles.activeModeText]}>
                  Alarm Fisik HP
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeBtn, deliveryMode === 'CHAT' && styles.activeMode]}
                onPress={() => setDeliveryMode('CHAT')}
              >
                <Text style={[styles.modeText, deliveryMode === 'CHAT' && styles.activeModeText]}>
                  Pesan Chat
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveBtn, loading && { opacity: 0.5 }]} 
                onPress={handleCreate}
                disabled={loading}
              >
                <Text style={styles.saveText}>{loading ? 'Menyetel...' : 'Pasang Alarm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  addBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCol: {
    flex: 1,
    paddingRight: 12,
  },
  remText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeClock: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  snoozeBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  snoozeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  dismissBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  dismissText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: '#030712',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  presetChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#030712',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeMode: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
  },
  modeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeModeText: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  saveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

