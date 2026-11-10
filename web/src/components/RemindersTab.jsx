import React, { useState } from 'react';
import { Bell, Plus, Clock, Moon, Check, Trash2, BellRing } from 'lucide-react';
import { api } from '../api';

export default function RemindersTab({ reminders, onRefresh }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('ALARM');
  const [loading, setLoading] = useState(false);

  const activeReminders = reminders.filter(r => r.status === 'pending');
  const completedReminders = reminders.filter(r => r.status !== 'pending');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!reminderText.trim() || !remindAt) return;
    setLoading(true);
    try {
      await api.createReminder({
        reminder_text: reminderText.trim(),
        remind_at: new Date(remindAt).toISOString(),
        delivery_mode: deliveryMode,
      });
      setReminderText('');
      setRemindAt('');
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      alert(`Gagal membuat pengingat: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async (id) => {
    try {
      await api.snoozeReminder(id, 10);
      onRefresh();
    } catch (err) {
      alert(`Gagal menunda pengingat: ${err.message}`);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.dismissReminder(id);
      onRefresh();
    } catch (err) {
      alert(`Gagal menyelesaikan pengingat: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus/batalkan pengingat ini?')) return;
    try {
      await api.deleteReminder(id);
      onRefresh();
    } catch (err) {
      alert(`Gagal menghapus pengingat: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <span>Pengingat & Alarm (Reminders)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pengingat terjadwal yang dibunyikan lewat WhatsApp, Discord, atau alarm native Android
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Set Pengingat Baru</span>
        </button>
      </div>

      {/* Active Reminders */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Pengingat Aktif ({activeReminders.length})
        </h3>

        {activeReminders.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/40 rounded-2xl border border-slate-800/80">
            <BellRing className="w-10 h-10 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-400">Tidak ada pengingat aktif saat ini</p>
          </div>
        ) : (
          activeReminders.map((rem) => (
            <div
              key={rem.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-colors"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{rem.reminder_text}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-amber-400 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(rem.remind_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })} WIB
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {rem.channel_id || 'ALARM'}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleSnooze(rem.id)}
                  title="Tunda 10 menit"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Snooze +10m</span>
                </button>
                <button
                  onClick={() => handleDismiss(rem.id)}
                  title="Tandai selesai"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Selesai</span>
                </button>
                <button
                  onClick={() => handleDelete(rem.id)}
                  title="Hapus"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Reminder Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Set Pengingat Baru</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Teks Pengingat *</label>
                <input
                  type="text"
                  required
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  placeholder="Misal: Minum obat / Cek server backup"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Waktu Alarm *</label>
                <input
                  type="datetime-local"
                  required
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mode Pengiriman</label>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALARM">Alarm Penuh (Bunyi Keras / Bypass Jam Tenang)</option>
                  <option value="CHAT">Pesan Chat (WhatsApp / Discord)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20"
                >
                  {loading ? 'Menyimpan...' : 'Set Pengingat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

