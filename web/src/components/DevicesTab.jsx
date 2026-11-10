import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  ShieldAlert, 
  Key, 
  Copy, 
  Check, 
  RefreshCw, 
  MessageCircle, 
  Laptop, 
  Clock,
  ShieldCheck
} from 'lucide-react';
import { api } from '../api';

export default function DevicesTab({ onRefresh }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkCodeData, setLinkCodeData] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const data = await api.getDevices();
      setDevices(data.devices || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleGenerateLinkCode = async () => {
    try {
      setLinkLoading(true);
      setErrorMsg(null);
      const res = await api.getWhatsAppLinkCode();
      setLinkCodeData(res);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal membuat kode penautan');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!linkCodeData?.code) return;
    navigator.clipboard.writeText(`!link ${linkCodeData.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id) => {
    if (!confirm('Cabut akses untuk perangkat ini?')) return;
    try {
      await api.revokeDevice(id);
      fetchDevices();
    } catch (err) {
      alert(`Gagal mencabut sesi: ${err.message}`);
    }
  };

  const handleRevokeOthers = async () => {
    if (!confirm('Cabut semua sesi perangkat lain?')) return;
    try {
      await api.revokeOtherDevices();
      fetchDevices();
    } catch (err) {
      alert(`Gagal mencabut sesi: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>Manajemen Perangkat & Saluran (Devices)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Daftar perangkat keras aktif dan penautan nomor WhatsApp ke akun Jarvis Anda
          </p>
        </div>

        <button
          onClick={handleRevokeOthers}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Cabut Semua Perangkat Lain</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* WhatsApp Linking Card (PRD Sec 16.3) */}
      <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Penautan WhatsApp Inbound (!link)</span>
          </div>
          <h3 className="text-lg font-bold text-white">Tautkan Akun WhatsApp Anda</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Ingin mengakses Jarvis langsung dari nomor WhatsApp Anda? Generate kode 6-digit di bawah, lalu kirimkan pesan perintah <code className="text-emerald-300 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded">!link &lt;kode&gt;</code> ke nomor bot Jarvis.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleGenerateLinkCode}
              disabled={linkLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${linkLoading ? 'animate-spin' : ''}`} />
              <span>{linkCodeData ? 'Generate Kode Baru' : 'Dapatkan Kode Penautan'}</span>
            </button>

            {linkCodeData && (
              <div className="flex items-center gap-2 bg-slate-950/90 border border-emerald-500/40 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-slate-400">Kode:</span>
                <span className="text-base font-mono font-bold text-emerald-400 tracking-wider">
                  {linkCodeData.code}
                </span>
                <button
                  onClick={handleCopyCode}
                  title="Salin perintah !link"
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {linkCodeData && (
            <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Berlaku selama 10 menit. Kirim ke nomor bot WhatsApp Jarvis:</span>
              <strong className="text-emerald-300 font-mono">!link {linkCodeData.code}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Registered Devices List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Perangkat Terdaftar ({devices.length})
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Memuat data perangkat...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/40 rounded-2xl border border-slate-800/80">
            <Smartphone className="w-10 h-10 text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-400">Belum ada perangkat terdaftar</p>
          </div>
        ) : (
          devices.map((dev) => {
            const isRevoked = dev.status === 'REVOKED';
            return (
              <div
                key={dev.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  isRevoked
                    ? 'bg-slate-900/40 border-slate-800/50 opacity-50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400">
                    {dev.platform === 'web' ? <Laptop className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{dev.device_name || 'Perangkat'}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isRevoked ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {dev.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="font-mono text-slate-500 text-[11px] truncate max-w-[150px] sm:max-w-xs">
                        {dev.device_identifier}
                      </span>
                      <span>•</span>
                      <span>Platform: {dev.platform}</span>
                      <span>•</span>
                      <span>v{dev.app_version || '3.0.0'}</span>
                    </div>
                  </div>
                </div>

                {!isRevoked && (
                  <button
                    onClick={() => handleRevoke(dev.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-rose-600/20 hover:text-rose-300 text-slate-300 transition-colors"
                  >
                    Cabut Akses
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

