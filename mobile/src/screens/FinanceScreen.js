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
  RefreshControl,
  Platform
} from 'react-native';
import { mobileApi } from '../services/api';

export default function FinanceScreen({ transactions, onRefresh, refreshing }) {
  const [filter, setFilter] = useState('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('EXPENSE');
  const [category, setCategory] = useState('Makanan');
  const [paymentMethod, setPaymentMethod] = useState('BCA');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const formatRupiah = (val) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  const filtered = transactions.filter((t) => {
    const k = (t.kind || t.transaction_type || 'EXPENSE').toUpperCase();
    if (filter === 'ALL') return true;
    return k === filter;
  });

  const handleCreate = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Validasi', 'Nominal harus angka lebih besar dari 0');
      return;
    }

    setLoading(true);
    try {
      await mobileApi.createTransaction({
        amount: num,
        kind,
        transaction_type: kind,
        category,
        payment_method: paymentMethod,
        description: description.trim() || undefined,
        source_type: 'MANUAL',
      });
      setAmount('');
      setDescription('');
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
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.filterGroup}>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'ALL' && styles.activeFilter]}
            onPress={() => setFilter('ALL')}
          >
            <Text style={[styles.filterText, filter === 'ALL' && styles.activeFilterText]}>Semua</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'EXPENSE' && styles.activeFilter]}
            onPress={() => setFilter('EXPENSE')}
          >
            <Text style={[styles.filterText, filter === 'EXPENSE' && styles.activeFilterText]}>Keluar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterChip, filter === 'INCOME' && styles.activeFilter]}
            onPress={() => setFilter('INCOME')}
          >
            <Text style={[styles.filterText, filter === 'INCOME' && styles.activeFilterText]}>Masuk</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Catat</Text>
        </TouchableOpacity>
      </View>

      {/* Transaction List */}
      <ScrollView 
        style={styles.list} 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>Belum ada transaksi</Text>
            <Text style={styles.emptySub}>Catat pengeluaran Anda atau biarkan Jarvis merekamnya dari notifikasi.</Text>
          </View>
        ) : (
          filtered.map((t) => {
            const isExp = (t.kind || t.transaction_type || 'EXPENSE').toUpperCase() === 'EXPENSE';
            const source = (t.source_type || 'CHAT').toUpperCase();
            return (
              <View key={t.id} style={styles.card}>
                <View style={styles.leftCol}>
                  <View style={styles.rowTitle}>
                    <Text style={styles.category}>{t.category}</Text>
                    <View style={styles.sourceTag}>
                      <Text style={styles.sourceText}>
                        {source === 'BANK_NOTIFICATION' ? '📱 Bank' : (source === 'MANUAL' ? '✍️ Manual' : '🤖 Chat')}
                      </Text>
                    </View>
                  </View>
                  {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
                  <View style={styles.metaRow}>
                    <Text style={styles.method}>{t.payment_method || 'Cash'}</Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.date}>
                      {new Date(t.occurred_at || t.transaction_date || t.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.amount, isExp ? styles.expText : styles.incText]}>
                  {isExp ? '-' : '+'} {formatRupiah(t.amount)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Catat Transaksi Finansial</Text>

            {/* Kind Switcher */}
            <View style={styles.kindSelector}>
              <TouchableOpacity 
                style={[styles.kindOption, kind === 'EXPENSE' && styles.activeExpense]}
                onPress={() => setKind('EXPENSE')}
              >
                <Text style={[styles.kindText, kind === 'EXPENSE' && styles.activeKindText]}>Pengeluaran</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.kindOption, kind === 'INCOME' && styles.activeIncome]}
                onPress={() => setKind('INCOME')}
              >
                <Text style={[styles.kindText, kind === 'INCOME' && styles.activeKindText]}>Pemasukan</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="Nominal (contoh: 35000)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <TextInput
              style={styles.modalInput}
              value={category}
              onChangeText={setCategory}
              placeholder="Kategori (Makanan, Bensin, dll)"
              placeholderTextColor="#64748b"
            />

            <TextInput
              style={styles.modalInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Catatan / keterangan..."
              placeholderTextColor="#64748b"
            />

            {/* Payment Method Selector */}
            <Text style={styles.methodLabel}>Metode Pembayaran / Sumber Dana:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.methodScroll}>
              {['Cash', 'BCA', 'Mandiri', 'BRI', 'GoPay', 'OVO', 'Dana', 'ShopeePay', 'QRIS'].map((m) => (
                <TouchableOpacity 
                  key={m}
                  style={[styles.methodChip, paymentMethod === m && styles.activeMethodChip]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text style={[styles.methodChipText, paymentMethod === m && styles.activeMethodChipText]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  leftCol: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  category: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  sourceTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 9,
    color: '#94a3b8',
  },
  desc: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  method: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#818cf8',
  },
  dot: {
    fontSize: 8,
    color: '#64748b',
  },
  date: {
    fontSize: 10,
    color: '#64748b',
  },
  amount: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  expText: {
    color: '#f43f5e',
  },
  incText: {
    color: '#10b981',
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
  kindSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kindOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#030712',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeExpense: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: '#f43f5e',
  },
  activeIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  kindText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeKindText: {
    color: '#ffffff',
  },
  modalInput: {
    backgroundColor: '#030712',
    color: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
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
  methodLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
    fontWeight: '600',
  },
  methodScroll: {
    marginBottom: 12,
  },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  activeMethodChip: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
  },
  methodChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  activeMethodChipText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

