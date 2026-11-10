import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingDown, 
  CheckCircle2, 
  BellRing, 
  Activity, 
  ArrowUpRight,
  PlusCircle,
  Smartphone,
  CalendarDays,
  Sparkles,
  Server,
  Database,
  Bot,
  Percent,
  Clock
} from 'lucide-react';
import { api } from '../api';

export default function HomeTab({ summary, onNavigate, onRefresh }) {
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs} jam ${mins} m`;
  };

  const loadAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await api.getDashboardAnalytics({ period: '30d' });
      setAnalytics(res.analytics);
    } catch (err) {
      console.warn('Gagal memuat analitik home:', err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const prod = analytics?.productivity;
  const jarvis = analytics?.jarvis;
  const today = analytics?.today;
  const insights = analytics?.insights || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
            <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>JARVIS CORE ONLINE • V3.1</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Selamat Datang di Command Center Jarvis
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Pusat monitoring visual terpadu untuk memantau keuangan, tugas harian, alarm aktif, analitik produktivitas, dan status ekosistem Jarvis.
          </p>
        </div>
      </div>

      {/* Automated AI Insights Banner (PRD Sec 72) */}
      {insights.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Insight AI Terkini</h3>
            <p className="text-xs text-slate-200 mt-1 leading-relaxed">
              {insights[0].message}
            </p>
          </div>
        </div>
      )}

      {/* 4 Summary Cards (PRD Sec 70) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pengeluaran Hari Ini & Bulan Ini */}
        <div 
          onClick={() => onNavigate('finance')}
          className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Pengeluaran Bulan Ini</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {formatRupiah(summary?.monthlyExpense)}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-500">
              Hari ini: <span className="font-mono text-slate-300">{formatRupiah(today?.expense || 0)}</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        {/* Card 2: Sisa Tugas & Completion Rate */}
        <div 
          onClick={() => onNavigate('tasks')}
          className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Tugas Belum Selesai</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white">
            {summary?.pendingTasks ?? 0} <span className="text-sm font-normal text-slate-400">tugas</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-emerald-400">
              {prod?.completionRate ?? 0}% selesai ({summary?.completedTasks ?? 0})
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        {/* Card 3: Pengingat Terdekat */}
        <div 
          onClick={() => onNavigate('reminders')}
          className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Pengingat Terdekat</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <BellRing className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {summary?.nextReminder ? summary.nextReminder.reminder_text : 'Tidak ada pengingat aktif'}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-amber-400">
              {summary?.nextReminder
                ? new Date(summary.nextReminder.remind_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                : 'Santai'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>

        {/* Card 4: Status Bot & Health */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium">Status Jarvis Health</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-lg font-bold text-white">ONLINE</span>
            <span className="text-xs text-slate-500 ml-auto font-mono">v{jarvis?.version || '3.1.0'}</span>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <span>Uptime:</span>
            <span className="font-mono text-slate-300">{formatUptime(jarvis?.uptimeSeconds || summary?.system?.uptimeSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Productivity & Health Metrics Grid (PRD Sec 70) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Productivity Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Metrik Produktivitas Tugas & Pengingat</span>
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Tingkat Selesai</p>
              <p className="text-lg font-bold text-emerald-400 mt-1">{prod?.completionRate ?? 0}%</p>
              <p className="text-[10px] text-slate-500">{prod?.tasksCompleted ?? 0} dari {prod?.tasksTotal ?? 0}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Rata-rata / Hari</p>
              <p className="text-lg font-bold text-indigo-400 mt-1">{prod?.avgTasksPerDay ?? 0}</p>
              <p className="text-[10px] text-slate-500">tugas selesai/hari</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Rasio Snooze</p>
              <p className="text-lg font-bold text-amber-400 mt-1">{prod?.remindersSnoozedRatio ?? 0}%</p>
              <p className="text-[10px] text-slate-500">{prod?.remindersSnoozed ?? 0} di-snooze</p>
            </div>
          </div>
        </div>

        {/* Jarvis Ecosystem Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <span>Kesehatan Ekosistem & Gateway</span>
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[10px] uppercase font-semibold">Database Pool</span>
              </div>
              <p className="text-sm font-bold text-slate-200">
                {jarvis?.dbPool?.idle ?? 1} idle / {jarvis?.dbPool?.total ?? 1} pool
              </p>
              <p className="text-[10px] text-slate-500">Supabase / Postgres</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] uppercase font-semibold">AI Direct</span>
              </div>
              <p className="text-sm font-bold text-purple-300">
                {jarvis?.geminiDirect || 'CONNECTED'}
              </p>
              <p className="text-[10px] text-slate-500">Gemini 2.5 Flash</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] uppercase font-semibold">Environment</span>
              </div>
              <p className="text-sm font-bold text-emerald-400 uppercase">
                {jarvis?.environment || 'PROD'}
              </p>
              <p className="text-[10px] text-slate-500">Express 5 + ESM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('tasks')}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-left transition-colors"
          >
            <PlusCircle className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-200">Tambah Tugas</p>
              <p className="text-[10px] text-slate-400">Buat to-do item baru</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('finance')}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-left transition-colors"
          >
            <TrendingDown className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-200">Catat Pengeluaran</p>
              <p className="text-[10px] text-slate-400">Input mutasi manual</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('reminders')}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-left transition-colors"
          >
            <BellRing className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-200">Set Pengingat</p>
              <p className="text-[10px] text-slate-400">Alarm & reminder</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('devices')}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-left transition-colors"
          >
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-slate-200">Tautkan WhatsApp</p>
              <p className="text-[10px] text-slate-400">Generate kode !link</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
