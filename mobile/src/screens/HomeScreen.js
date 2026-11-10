import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';

export default function HomeScreen({ summary, onNavigate, onRefresh, refreshing }) {
  const formatRupiah = (val) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
    >
      {/* Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Halo, Komandan</Text>
        <Text style={styles.bannerSubtitle}>
          Jarvis Core siap membantu Anda mengelola tugas, pengingat, dan keuangan hari ini.
        </Text>
      </View>

      {/* 4 Cards Grid */}
      <View style={styles.grid}>
        {/* Card 1: Finance */}
        <TouchableOpacity style={styles.card} onPress={() => onNavigate('finance')}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Pengeluaran Bulan Ini</Text>
            <Text style={styles.cardIcon}>💸</Text>
          </View>
          <Text style={styles.cardValue}>{formatRupiah(summary?.monthlyExpense)}</Text>
          <Text style={styles.cardSub}>Masuk: {formatRupiah(summary?.monthlyIncome)}</Text>
        </TouchableOpacity>

        {/* Card 2: Tasks */}
        <TouchableOpacity style={styles.card} onPress={() => onNavigate('tasks')}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Tugas Belum Selesai</Text>
            <Text style={styles.cardIcon}>📋</Text>
          </View>
          <Text style={styles.cardValue}>{summary?.pendingTasks || 0} Tugas</Text>
          <Text style={[styles.cardSub, { color: '#10b981' }]}>
            {summary?.completedTasks || 0} selesai
          </Text>
        </TouchableOpacity>

        {/* Card 3: Reminder */}
        <TouchableOpacity style={styles.card} onPress={() => onNavigate('reminders')}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Alarm / Pengingat</Text>
            <Text style={styles.cardIcon}>⏰</Text>
          </View>
          <Text style={[styles.cardValue, { fontSize: 13 }]} numberOfLines={1}>
            {summary?.nextReminder ? summary.nextReminder.reminder_text || summary.nextReminder.title : 'Tidak ada alarm aktif'}
          </Text>
          <Text style={[styles.cardSub, { color: '#f59e0b' }]}>
            {summary?.nextReminder 
              ? new Date(summary.nextReminder.remind_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
              : 'Santai'}
          </Text>
        </TouchableOpacity>

        {/* Card 4: System */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>Status Jarvis Core</Text>
            <Text style={styles.cardIcon}>🚀</Text>
          </View>
          <View style={styles.onlineRow}>
            <View style={styles.greenDot} />
            <Text style={[styles.cardValue, { color: '#10b981' }]}>ONLINE</Text>
          </View>
          <Text style={styles.cardSub}>Versi {summary?.system?.version || '3.1.0'}</Text>
        </View>
      </View>

      {/* Quick Action Grid */}
      <Text style={styles.sectionHeader}>AKSI CEPAT</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('chat')}>
          <Text style={styles.actionIcon}>🤖</Text>
          <Text style={styles.actionTitle}>Tanya Jarvis</Text>
          <Text style={styles.actionDesc}>Chat AI Direct Gemini</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('finance')}>
          <Text style={styles.actionIcon}>💳</Text>
          <Text style={styles.actionTitle}>Catat Uang</Text>
          <Text style={styles.actionDesc}>Input mutasi manual</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('tasks')}>
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={styles.actionTitle}>Buat Tugas</Text>
          <Text style={styles.actionDesc}>Tambah to-do baru</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('reminders')}>
          <Text style={styles.actionIcon}>🔔</Text>
          <Text style={styles.actionTitle}>Set Alarm</Text>
          <Text style={styles.actionDesc}>Pengingat fisik HP</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 32,
  },
  banner: {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    flex: 1,
  },
  cardIcon: {
    fontSize: 14,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 11,
    color: '#64748b',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    width: '48%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 10,
    color: '#64748b',
  },
});

