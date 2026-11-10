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

export default function TasksScreen({ tasks, onRefresh, refreshing }) {
  const [filter, setFilter] = useState('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [loading, setLoading] = useState(false);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'completed') return t.status === 'completed';
    return t.status !== 'completed';
  });

  const handleToggle = async (task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await mobileApi.updateTask(task.id, { status: nextStatus });
      onRefresh();
    } catch (err) {
      Alert.alert('Gagal', err.message);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Hapus Tugas', 'Apakah Anda yakin ingin menghapus tugas ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await mobileApi.deleteTask(id);
            onRefresh();
          } catch (err) {
            Alert.alert('Gagal', err.message);
          }
        },
      },
    ]);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await mobileApi.createTask({
        title: title.trim(),
        priority,
      });
      setTitle('');
      setModalVisible(false);
      onRefresh();
    } catch (err) {
      Alert.alert('Gagal', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (p) => {
    const prio = (p || 'NORMAL').toUpperCase();
    if (prio === 'HIGH' || prio === 'URGENT') {
      return { text: 'TINGGI', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.2)' };
    }
    if (prio === 'LOW') {
      return { text: 'RENDAH', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' };
    }
    return { text: 'NORMAL', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.2)' };
  };

  return (
    <View style={styles.container}>
      {/* Filter and Add Bar */}
      <View style={styles.topBar}>
        <View style={styles.filterGroup}>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'ALL' && styles.activeFilter]}
            onPress={() => setFilter('ALL')}
          >
            <Text style={[styles.filterText, filter === 'ALL' && styles.activeFilterText]}>
              Semua ({tasks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'pending' && styles.activeFilter]}
            onPress={() => setFilter('pending')}
          >
            <Text style={[styles.filterText, filter === 'pending' && styles.activeFilterText]}>
              Pending ({tasks.filter(t => t.status !== 'completed').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, filter === 'completed' && styles.activeFilter]}
            onPress={() => setFilter('completed')}
          >
            <Text style={[styles.filterText, filter === 'completed' && styles.activeFilterText]}>
              Selesai
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Tambah</Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      <ScrollView 
        style={styles.list} 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
      >
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>Semua tugas beres!</Text>
            <Text style={styles.emptySub}>Tidak ada pekerjaan yang tertunda saat ini.</Text>
          </View>
        ) : (
          filteredTasks.map((t) => {
            const isDone = t.status === 'completed';
            const badge = getPriorityBadge(t.priority);
            return (
              <View key={t.id} style={[styles.taskCard, isDone && styles.taskCardDone]}>
                <TouchableOpacity onPress={() => handleToggle(t)} style={styles.checkCircle}>
                  <Text style={{ fontSize: 16 }}>{isDone ? '✅' : '⚪'}</Text>
                </TouchableOpacity>

                <View style={styles.taskInfo}>
                  <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                    {t.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.prioTag, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.prioText, { color: badge.color }]}>{badge.text}</Text>
                    </View>
                    <Text style={styles.metaDate}>
                      {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => handleDelete(t.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal Tambah Tugas */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Buat Tugas Baru</Text>

            <TextInput
              style={styles.modalInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Judul tugas..."
              placeholderTextColor="#64748b"
              autoFocus
            />

            <Text style={styles.label}>Prioritas</Text>
            <View style={styles.prioSelector}>
              {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.prioOption, priority === p && styles.activePrioOption]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.prioOptionText, priority === p && styles.activePrioOptionText]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
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
                <Text style={styles.saveText}>{loading ? 'Menyimpan...' : 'Simpan'}</Text>
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
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  activeFilter: {
    backgroundColor: '#4f46e5',
  },
  filterText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#ffffff',
    fontWeight: '700',
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
    gap: 10,
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
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 12,
  },
  taskCardDone: {
    opacity: 0.5,
  },
  checkCircle: {
    padding: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prioTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prioText: {
    fontSize: 9,
    fontWeight: '700',
  },
  metaDate: {
    fontSize: 10,
    color: '#64748b',
  },
  deleteBtn: {
    padding: 6,
  },
  deleteText: {
    fontSize: 14,
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
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#030712',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  prioSelector: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  prioOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  activePrioOption: {
    backgroundColor: '#4f46e5',
  },
  prioOptionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activePrioOptionText: {
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

