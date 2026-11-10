import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  MessageSquare, 
  CreditCard, 
  Smartphone, 
  Cpu, 
  Coins,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';

export default function FinanceTab({ transactions, onRefresh }) {
  const [filter, setFilter] = useState('ALL'); // ALL, EXPENSE, INCOME
  const [period, setPeriod] = useState('30d'); // 7d, 30d, month
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [transactionType, setTransactionType] = useState('EXPENSE');
  const [category, setCategory] = useState('Makanan');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BCA');
  const [loading, setLoading] = useState(false);

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const loadAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await api.getDashboardAnalytics({ period });
      setAnalytics(res.analytics);
    } catch (err) {
      console.warn('Gagal memuat analitik keuangan:', err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleRefresh = async () => {
    await Promise.all([loadAnalytics(), onRefresh && onRefresh()]);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'ALL') return true;
    return String(t.transaction_type || t.kind).toUpperCase() === filter;
  });

  const getSourceBadge = (source) => {
    const s = String(source || 'CHAT').toUpperCase();
    if (s === 'BANK_NOTIFICATION' || s === 'AUTO_NOTIFICATION') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
          <Smartphone className="w-3 h-3" /> Notifikasi Bank
        </span>
      );
    }
    if (s === 'MANUAL') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <CreditCard className="w-3 h-3" /> Input Web
        </span>
      );
    }
    if (s === 'SYSTEM') {
      return (
        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
          <Cpu className="w-3 h-3" /> Otomasi Sistem
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <MessageSquare className="w-3 h-3" /> Chat AI
      </span>
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    setLoading(true);

    try {
      await api.createFinanceTransaction({
        amount: parsedAmount,
        transaction_type: transactionType,
        category,
        description: description.trim() || undefined,
        payment_method: paymentMethod,
        source_type: 'MANUAL',
      });
      setAmount('');
      setDescription('');
      setIsModalOpen(false);
      await handleRefresh();
    } catch (err) {
      alert(`Gagal mencatat transaksi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fin = analytics?.finance;
  const insights = analytics?.insights || [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <span>Manajemen & Analisis Keuangan 2.0</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visualisasi cashflow, proporsi pengeluaran, instrumen kas, dan analitik multi-sumber (PRD Sec 69–73)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector chips */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                period === '7d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                period === '30d' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              30 Hari
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                period === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Transaksi</span>
          </button>
        </div>
      </div>

      {/* Automated AI Insights Banner (PRD Sec 72) */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((item, idx) => {
            const isWarn = item.severity === 'warning';
            const isSuccess = item.severity === 'success';
            return (
              <div 
                key={idx}
                className={`p-4 rounded-xl border flex items-start gap-3 transition-colors ${
                  isWarn 
                    ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                    : isSuccess 
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                    : 'bg-indigo-950/20 border-indigo-800/40 text-indigo-200'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isWarn && <AlertCircle className="w-4 h-4 text-amber-400" />}
                  {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {!isWarn && !isSuccess && <Sparkles className="w-4 h-4 text-indigo-400" />}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{item.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Finance Overview Cards (PRD Sec 70) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pemasukan */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Pemasukan</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {formatRupiah(fin?.totalIncome)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Periode {analytics?.period?.label || '30 Hari'}</p>
        </div>

        {/* Pengeluaran */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Pengeluaran</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono">
            {formatRupiah(fin?.totalExpense)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{fin?.totalTransactions || 0} transaksi tercatat</p>
        </div>

        {/* Net Cashflow Balance */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Arus Kas Bersih (Net)</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              (fin?.netBalance || 0) >= 0 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-bold font-mono ${
            (fin?.netBalance || 0) >= 0 ? 'text-indigo-300' : 'text-rose-400'
          }`}>
            {(fin?.netBalance || 0) >= 0 ? '+' : ''}{formatRupiah(fin?.netBalance)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {(fin?.netBalance || 0) >= 0 ? 'Surplus anggaran aman' : 'Pengeluaran defisit'}
          </p>
        </div>
      </div>

      {/* Visualizations Grid: Categories & Instruments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown (PRD Sec 70) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-400" />
              <span>Proporsi Kategori Pengeluaran</span>
            </h3>
            <span className="text-xs text-slate-500">{fin?.categories?.length || 0} kategori</span>
          </div>

          <div className="space-y-3">
            {!fin?.categories || fin.categories.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Belum ada pengeluaran pada rentang waktu ini</p>
            ) : (
              fin.categories.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">{c.category}</span>
                    <span className="font-mono text-slate-400">
                      {formatRupiah(c.total)} <span className="text-slate-600">({c.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        i === 0 ? 'bg-indigo-500' : i === 1 ? 'bg-sky-500' : i === 2 ? 'bg-emerald-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, c.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instruments & Recording Source (PRD Sec 70 & 71) */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-5">
          {/* Payment Methods */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Instrumen Pembayaran (Payment Method)</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {!fin?.paymentMethods || fin.paymentMethods.length === 0 ? (
                <p className="text-xs text-slate-500 col-span-2 py-2 text-center">Belum ada data pembayaran</p>
              ) : (
                fin.paymentMethods.map((m, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-200">{m.method}</span>
                      <span className="text-[10px] text-slate-500">{m.count} tx</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-300">
                      {formatRupiah(m.total)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Source Type Breakdown (PRD Sec 71) */}
          <div className="space-y-3 pt-2 border-t border-slate-800/60">
            <h3 className="text-xs font-semibold text-slate-400 flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>Metode Pencatatan (Source Type)</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {fin?.sourceTypes?.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  {getSourceBadge(s.source_type)}
                  <span className="font-mono text-slate-300 font-bold">{s.count} tx</span>
                  <span className="text-[10px] text-slate-500">({formatRupiah(s.total)})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Largest Expenses (PRD Sec 70) */}
      {fin?.largestExpenses && fin.largestExpenses.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <span>5 Pengeluaran Terbesar Periode Ini</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fin.largestExpenses.map((ex) => (
              <div key={ex.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200 truncate">{ex.category}</span>
                    {getSourceBadge(ex.source_type)}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{ex.description || ex.notes || '-'}</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/50">
                  <span className="text-[10px] text-slate-500 font-mono">{ex.payment_method}</span>
                  <span className="text-xs font-mono font-bold text-rose-400">-{formatRupiah(ex.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Transactions Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Riwayat Mutasi Transaksi</h3>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilter('EXPENSE')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === 'EXPENSE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pengeluaran
            </button>
            <button
              onClick={() => setFilter('INCOME')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filter === 'INCOME' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pemasukan
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800/80">
              <Coins className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-400">Belum ada transaksi tercatat</p>
              <p className="text-xs text-slate-600 mt-1">Gunakan tombol di atas atau chat "beli makan 25rb" ke Jarvis</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const isExpense = String(tx.transaction_type || tx.kind).toUpperCase() === 'EXPENSE';
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isExpense ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {isExpense ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{tx.category}</span>
                        {getSourceBadge(tx.source_type)}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{tx.description || tx.notes || '-'}</p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="font-mono text-slate-400">{tx.payment_method || 'Cash'}</span>
                        <span>•</span>
                        <span>
                          {new Date(tx.transaction_date || tx.occurred_at || tx.created_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`text-right font-mono font-bold text-sm ${isExpense ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isExpense ? '-' : '+'} {formatRupiah(tx.amount)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Catat Transaksi Manual</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransactionType('EXPENSE')}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    transactionType === 'EXPENSE'
                      ? 'bg-rose-600/20 text-rose-300 border-rose-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType('INCOME')}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    transactionType === 'INCOME'
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Pemasukan
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nominal (Rupiah) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Makanan">Makanan & Minuman</option>
                  <option value="Transportasi">Transportasi</option>
                  <option value="Belanja">Belanja / Kebutuhan</option>
                  <option value="Tagihan">Tagihan & Utilitas</option>
                  <option value="Gaji">Gaji / Penghasilan</option>
                  <option value="Investasi">Investasi / Tabungan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="BCA">BCA</option>
                  <option value="Mandiri">Mandiri</option>
                  <option value="GoPay">GoPay</option>
                  <option value="OVO">OVO</option>
                  <option value="Cash">Cash / Tunai</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Misal: Nasi Padang siang hari"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
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
                  {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
