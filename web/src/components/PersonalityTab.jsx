import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  Sliders, 
  Volume2, 
  Check, 
  RotateCcw, 
  AlertCircle,
  Smartphone,
  Globe,
  Radio
} from 'lucide-react';
import { api } from '../api';

const RESPONSE_STYLES = [
  { id: 'CASUAL', label: 'Casual / Santai', desc: 'Akrab, luwes, santai layaknya kawan dekat' },
  { id: 'FORMAL', label: 'Formal / Baku', desc: 'Sopan, profesional, tata bahasa rapi' },
  { id: 'FRIENDLY', label: 'Friendly / Ramah', desc: 'Hangat, suportif, penuh perhatian & positif' },
  { id: 'TECHNICAL', label: 'Technical / Analitis', desc: 'Langsung to-the-point, analitis, minim basa-basi' },
];

const RESPONSE_LENGTHS = [
  { id: 'SHORT', label: 'Short (Kilat)', desc: '1-2 kalimat padat to the point' },
  { id: 'NORMAL', label: 'Normal (Standar)', desc: 'Penjelasan proporsional dan jelas' },
  { id: 'DETAILED', label: 'Detailed (Rinci)', desc: 'Komprehensif dengan elaborasi & poin lengkap' },
];

const HUMOR_LEVELS = [
  { id: 'NONE', label: 'None (Serius)' },
  { id: 'LOW', label: 'Low (Minimal)' },
  { id: 'BALANCED', label: 'Balanced (Seimbang)' },
  { id: 'WITTY', label: 'Witty (Jenaka & Cerdas)' },
];

const CHANNELS = [
  { id: 'GLOBAL', label: 'Global (Bawaan)', icon: Globe },
  { id: 'DISCORD', label: 'Discord', icon: MessageSquare },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: Radio },
  { id: 'ANDROID', label: 'Android App', icon: Smartphone },
  { id: 'WEB', label: 'Web Dashboard', icon: Globe },
];

export default function PersonalityTab({ user }) {
  const [selectedChannel, setSelectedChannel] = useState('GLOBAL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Preference state
  const [summaryData, setSummaryData] = useState(null);
  const [formData, setFormData] = useState({
    response_style: 'CASUAL',
    response_length: 'NORMAL',
    tone: 'Tenang',
    humor_level: 'BALANCED',
    language: 'id-ID',
    default_response_type: 'TEXT',
    auto_capture_policy: 'AUTO_IF_CONFIDENT',
    callsign: '',
    custom_prompt_instructions: '',
  });

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const res = await api.getPreferences({ channel: selectedChannel });
      setSummaryData(res);

      const target = selectedChannel === 'GLOBAL' 
        ? res.global 
        : (res.channels?.[selectedChannel] || res.global || {});

      setFormData({
        response_style: target.response_style || 'CASUAL',
        response_length: target.response_length || 'NORMAL',
        tone: target.tone || 'Tenang',
        humor_level: target.humor_level || 'BALANCED',
        language: target.language || 'id-ID',
        default_response_type: target.default_response_type || 'TEXT',
        auto_capture_policy: res.global?.auto_capture_policy || 'AUTO_IF_CONFIDENT',
        callsign: res.callsign || '',
        custom_prompt_instructions: target.custom_prompt_instructions || '',
      });
    } catch (err) {
      console.error('Failed to load personality preferences:', err);
      setMessage({ type: 'error', text: err.message || 'Gagal memuat preferensi' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, [selectedChannel]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);

      if (selectedChannel === 'GLOBAL') {
        await api.updateGlobalPreferences(formData);
      } else {
        await api.updateChannelPreferences(selectedChannel, formData);
      }

      setMessage({ type: 'success', text: `Preferensi ${selectedChannel} berhasil disimpan!` });
      await loadPreferences();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Gagal menyimpan preferensi' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetChannel = async () => {
    if (selectedChannel === 'GLOBAL') return;
    if (!confirm(`Hapus override untuk ${selectedChannel} dan kembali ke aturan GLOBAL?`)) return;

    try {
      setSaving(true);
      await api.deleteChannelPreferences(selectedChannel);
      setMessage({ type: 'success', text: `Override ${selectedChannel} dihapus. Sekarang mengikuti aturan GLOBAL.` });
      await loadPreferences();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Gagal menghapus override' });
    } finally {
      setSaving(false);
    }
  };

  const hasOverride = selectedChannel !== 'GLOBAL' && !!summaryData?.channels?.[selectedChannel];

  if (loading && !summaryData) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Sparkles className="w-6 h-6 animate-spin mr-3 text-indigo-400" />
        Memuat preferensi kepribadian...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Personality & Preference Center (PRD V3)
          </h2>
          <p className="text-xs text-slate-400">
            Atur persona, taksonomi gaya bicara, dan respon Jarvis secara terpusat atau spesifik kanal.
          </p>
        </div>

        {/* Channel Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const isSelected = selectedChannel === ch.id;
            const channelOverridden = ch.id !== 'GLOBAL' && !!summaryData?.channels?.[ch.id];

            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannel(ch.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ch.label}</span>
                {channelOverridden && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50' 
            : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Override Notice */}
      {selectedChannel !== 'GLOBAL' && (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
          <div className="text-xs text-slate-300">
            Status Kanal <strong className="text-white">{selectedChannel}</strong>:{' '}
            {hasOverride ? (
              <span className="text-emerald-400 font-semibold">Menggunakan Override Kustom</span>
            ) : (
              <span className="text-slate-400">Mengikuti Konfigurasi Global (Belum Di-override)</span>
            )}
          </div>
          {hasOverride && (
            <button
              onClick={handleResetChannel}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 border border-rose-800/40 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Kembalikan ke Global
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Callsign & Persona Info */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Panggilan & Identitas
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Panggilan Khusus (Callsign)
              </label>
              <input
                type="text"
                placeholder="Contoh: Bos, Kapten, Komandan"
                value={formData.callsign}
                onChange={(e) => setFormData({ ...formData, callsign: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Jarvis akan menyapa Anda dengan sebutan ini secara konsisten.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Bahasa Utama
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="id-ID">Bahasa Indonesia (id-ID)</option>
                <option value="en-US">English (en-US)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Response Style (Taksonomi Persona V3) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Gaya Bahasa (`response_style`)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RESPONSE_STYLES.map((style) => {
              const isSelected = formData.response_style === style.id;
              return (
                <div
                  key={style.id}
                  onClick={() => setFormData({ ...formData, response_style: style.id })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/30 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-200">{style.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{style.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Response Length (Taksonomi Persona V3) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Panjang Respon (`response_length`)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {RESPONSE_LENGTHS.map((len) => {
              const isSelected = formData.response_length === len.id;
              return (
                <div
                  key={len.id}
                  onClick={() => setFormData({ ...formData, response_length: len.id })}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/30 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-200">{len.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{len.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tone, Humor, and Default Type */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">
            Nada Suasana & Respon Lanjutan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nada Suasana (Tone)
              </label>
              <select
                value={formData.tone}
                onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Tenang">Tenang (Default)</option>
                <option value="Ceria">Ceria & Bersemangat</option>
                <option value="Netral">Netral & Obyektif</option>
                <option value="Fokus">Tegas & Fokus</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Tingkat Humor
              </label>
              <select
                value={formData.humor_level}
                onChange={(e) => setFormData({ ...formData, humor_level: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {HUMOR_LEVELS.map((h) => (
                  <option key={h.id} value={h.id}>{h.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Bentuk Balasan Bawaan
              </label>
              <select
                value={formData.default_response_type}
                onChange={(e) => setFormData({ ...formData, default_response_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="TEXT">Teks Saja (TEXT)</option>
                <option value="VOICE">Sertakan Suara (VOICE)</option>
                <option value="AUTO">Otomatis / Adaptif (AUTO)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Instruksi Persona Khusus (Opsional)
            </label>
            <textarea
              rows={3}
              placeholder="Contoh: Selalu ingatkan minum air putih di akhir pesan, jangan gunakan emoji berlebihan..."
              value={formData.custom_prompt_instructions}
              onChange={(e) => setFormData({ ...formData, custom_prompt_instructions: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Edge TTS Voice Separation Notice (PRD Sec 60) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-violet-400" />
            <span>
              Suara TTS Edge Voice ID:{' '}
              <strong className="text-slate-200">
                {summaryData?.voice_preferences?.voice_id || 'id-ID-ArdiNeural (Bawaan)'}
              </strong>{' '}
              (Terisolasi di tabel terpisah `user_voice_preferences`).
            </span>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Simpan Preferensi {selectedChannel}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

