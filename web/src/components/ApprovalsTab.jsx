import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Check, 
  X, 
  Clock, 
  CreditCard, 
  ListTree, 
  AlertTriangle,
  RefreshCw,
  Lock,
  History,
  CheckCircle2,
  XCircle,
  Smartphone
} from 'lucide-react';
import { api } from '../api';

export default function ApprovalsTab({ user }) {
  const [approvals, setApprovals] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' | 'history' | 'policy'
  
  // Policy state
  const [policy, setPolicy] = useState('AUTO_IF_CONFIDENT');
  const [savingPolicy, setSavingPolicy] = useState(false);

  const formatRupiah = (val) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [apprvRes, histRes, prefRes] = await Promise.allSettled([
        api.getApprovals(),
        api.getApprovalHistory({ limit: 20 }),
        api.getPreferences(),
      ]);

      if (apprvRes.status === 'fulfilled') {
        setApprovals(apprvRes.value?.approvals || []);
      }
      if (histRes.status === 'fulfilled') {
        setHistory(histRes.value?.history || []);
      }
      if (prefRes.status === 'fulfilled') {
        const p = prefRes.value?.preferences?.global?.auto_capture_policy;
        if (p) setPolicy(p);
      }
    } catch (err) {
      console.warn('Gagal memuat approval data:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (id, action) => {
    try {
      setActionLoading(id);
      await api.actionApproval(id, action);
      await loadData();
    } catch (err) {
      alert(`Gagal memproses approval: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSavePolicy = async (newPolicy) => {
    try {
      setSavingPolicy(true);
      setPolicy(newPolicy);
      await api.updateGlobalPreferences({ auto_capture_policy: newPolicy });
    } catch (err) {
      alert(`Gagal menyimpan kebijakan: ${err.message}`);
    } finally {
      setSavingPolicy(false);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'FINANCE_TRANSACTION':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CreditCard className="w-3 h-3" /> Transaksi Keuangan
          </span>
        );
      case 'TASK_CHAIN':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <ListTree className="w-3 h-3" /> Rangkaian Tugas
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Aksi Sensitif
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>Approval & Security Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pusat kendali otorisasi tindakan sensitif, konfirmasi auto-capture finansial, dan audit keamanan (PRD Sec 74–79)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab('pending')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeSubTab === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Antrean ({approvals.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeSubTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Riwayat</span>
            </button>
            <button
              onClick={() => setActiveSubTab('policy')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeSubTab === 'policy' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Kebijakan</span>
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors shrink-0"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Security Privacy Notice (PRD Sec 76) */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
        <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-white">Privasi & Keamanan Data (Zero Raw Retention):</span>{' '}
          Teks mentah notifikasi perbankan tidak disimpan permanen. Nomor rekening di-masking secara otomatis dan saldo tidak dicatat. Klien Web & Mobile berjalan di bawah kebijakan Row Level Security (RLS) terisolasi.
        </div>
      </div>

      {/* SubTab 1: PENDING APPROVAL QUEUE */}
      {activeSubTab === 'pending' && (
        <div className="space-y-3">
          {approvals.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800/80">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">Semua Bersih & Aman!</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Tidak ada tindakan sensitif atau mutasi perbankan yang menunggu persetujuan Anda saat ini.
              </p>
            </div>
          ) : (
            approvals.map((item) => {
              const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload || {});
              const isFinance = item.type === 'FINANCE_TRANSACTION';
              return (
                <div
                  key={item.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getTypeBadge(item.type)}
                      <span className="text-[10px] text-slate-400 font-mono">
                        Keyakinan: {Math.round((item.confidence_score || 1) * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-500">
                        • {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white tracking-tight">{item.title}</h3>
                    {item.description && (
                      <p className="text-xs text-slate-400">{item.description}</p>
                    )}

                    {isFinance && (
                      <div className="flex items-center gap-3 pt-1 text-xs">
                        <span className="font-mono font-bold text-rose-400 text-sm">
                          {formatRupiah(payload.amount)}
                        </span>
                        <span className="text-slate-500">via</span>
                        <span className="font-mono text-slate-300 px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {payload.paymentMethod || 'Cash'}
                        </span>
                        <span className="text-slate-500">• Kategori: {payload.category || 'Lainnya'}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <button
                      onClick={() => handleAction(item.id, 'REJECT')}
                      disabled={actionLoading === item.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Tolak</span>
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'APPROVE')}
                      disabled={actionLoading === item.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Setujui</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SubTab 2: HISTORY */}
      {activeSubTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-slate-800/80">
              <History className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Belum ada riwayat persetujuan</p>
            </div>
          ) : (
            history.map((h) => {
              const isApproved = h.status === 'APPROVED';
              return (
                <div
                  key={h.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    {isApproved ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">{h.title}</span>
                        {getTypeBadge(h.type)}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(h.resolved_at || h.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} WIB
                      </p>
                    </div>
                  </div>

                  <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                    isApproved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {h.status}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SubTab 3: POLICY SETTINGS (PRD Sec 77) */}
      {activeSubTab === 'policy' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>Kebijakan Persetujuan Auto-Capture Finansial (PRD Sec 77)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Tentukan bagaimana Jarvis memperlakukan mutasi perbankan yang ditangkap dari notifikasi Android.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Option 1: AUTO_IF_CONFIDENT */}
            <div
              onClick={() => handleSavePolicy('AUTO_IF_CONFIDENT')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                policy === 'AUTO_IF_CONFIDENT'
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">AUTO IF CONFIDENT</span>
                {policy === 'AUTO_IF_CONFIDENT' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Keyakinan tinggi (≥ 95%) otomatis dicatat. Jika meragukan atau dari AI fallback, dialihkan ke Approval Center.
              </p>
              <span className="inline-block mt-3 text-[10px] text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded">
                Rekomendasi
              </span>
            </div>

            {/* Option 2: CONFIRM_ALWAYS */}
            <div
              onClick={() => handleSavePolicy('CONFIRM_ALWAYS')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                policy === 'CONFIRM_ALWAYS'
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">CONFIRM ALWAYS</span>
                {policy === 'CONFIRM_ALWAYS' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Semua notifikasi perbankan wajib disetujui manual sebelum dicatat ke buku kas.
              </p>
              <span className="inline-block mt-3 text-[10px] text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded">
                Maksimal Kontrol
              </span>
            </div>

            {/* Option 3: DISABLED */}
            <div
              onClick={() => handleSavePolicy('DISABLED')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                policy === 'DISABLED'
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white">DISABLED</span>
                {policy === 'DISABLED' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Fitur auto-capture dimatikan sepenuhnya. Transaksi hanya dicatat via chat atau input manual.
              </p>
              <span className="inline-block mt-3 text-[10px] text-slate-400 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                Nonaktif
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

