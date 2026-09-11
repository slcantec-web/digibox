import React, { useState } from 'react';
import { ArrowLeft, KeyRound, Lock, Shield, User } from 'lucide-react';
import { Operator, Organization } from '../types';

interface OperatorLoginProps {
  onLoginSuccess: (token: string, operator: Operator, organization: Organization) => void;
  onBackToPublic: () => void;
}

export const OperatorLogin: React.FC<OperatorLoginProps> = ({
  onLoginSuccess,
  onBackToPublic,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/operator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (res.status === 404) {
          throw new Error('API route /api/operator/login not found (404). Ensure Cloudflare Pages Functions are deployed.');
        }
        throw new Error(`Server returned status ${res.status}: ${res.statusText || 'Non-JSON response'}`);
      }

      if (!res.ok) {
        throw new Error(data.error || `Authentication failed (Status ${res.status})`);
      }

      if (!data.token) {
        throw new Error('Server did not return a session token.');
      }

      // Store token in localStorage for persistence
      localStorage.setItem('cb_operator_token', data.token);
      onLoginSuccess(data.token, data.operator, data.organization);
    } catch (err: any) {
      setError(err.message || 'Login error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back link */}
        <button
          id="btn-login-back-public"
          onClick={onBackToPublic}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Public Feedback Box</span>
        </button>

        {/* Login Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Operator Portal</h2>
              <p className="text-xs text-slate-400">CloudBase Digital Feedback System</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Operator Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="input-login-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or operator"
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 outline-hidden transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="input-login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 outline-hidden transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300">
                {error}
              </div>
            )}

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 font-semibold text-sm text-slate-950 transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-[0.99] disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Log In to Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fillers */}
          <div className="mt-6 pt-5 border-t border-slate-700/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Quick Demo Logins
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-demo-admin"
                type="button"
                onClick={() => fillDemo('admin', 'password123')}
                className="py-2 px-3 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs text-slate-200 border border-slate-600/50 text-left transition"
              >
                <div className="font-semibold text-sky-400">Admin</div>
                <div className="text-[10px] text-slate-400">admin / password123</div>
              </button>

              <button
                id="btn-demo-operator"
                type="button"
                onClick={() => fillDemo('operator', 'cantec2026')}
                className="py-2 px-3 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs text-slate-200 border border-slate-600/50 text-left transition"
              >
                <div className="font-semibold text-emerald-400">Staff Operator</div>
                <div className="text-[10px] text-slate-400">operator / cantec2026</div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-5">
          Multi-tenant secure session · Isolated by Organization ID
        </p>
      </div>
    </div>
  );
};
