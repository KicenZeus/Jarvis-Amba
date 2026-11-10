import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Bot, Lock, Mail, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react';

export default function AuthModal({ onAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        if (data.session) {
          onAuthenticated(data.session.access_token, data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        if (data.session) {
          onAuthenticated(data.session.access_token, data.user);
        } else {
          setInfoMessage('Pendaftaran berhasil! Silakan periksa inbox email konfirmasi Anda.');
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Gagal melakukan autentikasi');
    } finally {
      setLoading(false);
    }
  };

  // Login Cepat untuk Mode Pengembang / Owner
  const handleDeveloperBypass = () => {
    // Generate valid simulated JWT structure: header.payload.sig
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(JSON.stringify({
      sub: '713137141072396370', // Owner Canonical ID
      email: 'owner@jarvis.internal',
      role: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 hari
    })).replace(/=/g, '');
    const mockJwt = `${header}.${payload}.dev_local_signature`;

    onAuthenticated(mockJwt, {
      id: '713137141072396370',
      email: 'owner@jarvis.internal',
      role: 'OWNER',
      displayName: 'KicenZeus (Owner)',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-3">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">JARVIS V3 Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">Masuk dengan Supabase Auth untuk mengakses pusat kendali</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-950/80 p-1 rounded-xl mb-5 border border-slate-800">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setErrorMessage(null); setInfoMessage(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              isLogin ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Masuk (Login)
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setErrorMessage(null); setInfoMessage(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              !isLogin ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daftar Akun Baru
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}
        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
            {infoMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domain.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-pulse">Memproses...</span>
            ) : (
              <>
                <span>{isLogin ? 'Masuk ke Dashboard' : 'Buat Akun'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider & Dev Bypass */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span>Akses Cepat Pengembang</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Owner Mode
            </span>
          </div>
          <button
            type="button"
            onClick={handleDeveloperBypass}
            className="w-full bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-medium py-2 px-3 rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span>Masuk Langsung sebagai Owner (KicenZeus)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

