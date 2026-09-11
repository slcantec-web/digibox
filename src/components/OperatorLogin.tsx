import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Shield,
  User,
  X,
} from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Password Reset Modal State ---
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUsername, setResetUsername] = useState('operator');
  const [resetOrgCode, setResetOrgCode] = useState('CTP');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // --- Automated Email Change Field / Modal State ---
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [currentReportEmail, setCurrentReportEmail] = useState('management@cantec.lk');
  const [newReportEmail, setNewReportEmail] = useState('');
  const [emailAdminUsername, setEmailAdminUsername] = useState('admin');
  const [emailAdminPassword, setEmailAdminPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Fetch current automated dispatch email on mount
  useEffect(() => {
    fetch('/api/public/automated-email')
      .then((res) => res.json())
      .then((data) => {
        if (data.contact_email) {
          setCurrentReportEmail(data.contact_email);
        }
      })
      .catch(() => {});
  }, []);

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
          throw new Error('API route /api/operator/login not found (404). Ensure server is running.');
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

  // Handle password reset submission
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('New passwords do not match. Please verify.');
      return;
    }

    if (resetNewPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/public/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername.trim(),
          org_code: resetOrgCode.trim().toUpperCase(),
          new_password: resetNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetSuccess(data.message || 'Password reset successfully!');
      // Pre-fill main login form with new password
      setUsername(resetUsername.trim());
      setPassword(resetNewPassword);
    } catch (err: any) {
      setResetError(err.message || 'Password reset failed. Please check inputs.');
    } finally {
      setResetLoading(false);
    }
  };

  // Handle Automated Email change submission
  const handleEmailChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (!newReportEmail || !newReportEmail.includes('@')) {
      setEmailError('Please provide a valid recipient email address.');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch('/api/public/automated-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_username: emailAdminUsername.trim(),
          admin_password: emailAdminPassword,
          new_email: newReportEmail.trim(),
          org_code: 'CTP',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update automated email.');
      }

      setEmailSuccess(data.message || `Automated report email updated to ${data.contact_email}`);
      setCurrentReportEmail(data.contact_email);
      setNewReportEmail('');
      setEmailAdminPassword('');
    } catch (err: any) {
      setEmailError(err.message || 'Failed to update automated email.');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back link */}
        <button
          id="btn-login-back-public"
          onClick={onBackToPublic}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-6 cursor-pointer"
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <button
                  id="btn-forgot-password-link"
                  type="button"
                  onClick={() => {
                    setResetUsername(username.trim() || 'operator');
                    setResetError(null);
                    setResetSuccess(null);
                    setShowResetModal(true);
                  }}
                  className="text-[11px] text-sky-400 hover:text-sky-300 transition cursor-pointer hover:underline"
                >
                  Forgot / Reset Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl bg-slate-900/80 border border-slate-700 pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 outline-hidden transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
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

          {/* Automated Email Setting Action Button directly in Login */}
          <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Automated Daily Reports
              </span>
              <p className="text-xs text-slate-300 font-mono truncate" title={currentReportEmail}>
                {currentReportEmail}
              </p>
            </div>
            <button
              id="btn-change-automated-email-login"
              type="button"
              onClick={() => {
                setEmailError(null);
                setEmailSuccess(null);
                setNewReportEmail(currentReportEmail);
                setShowEmailModal(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-xs font-semibold border border-slate-700 transition shrink-0 flex items-center gap-1.5 cursor-pointer"
              title="Change automated report recipient email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Change Email</span>
            </button>
          </div>

          {/* Quick Demo Fillers */}
          <div className="mt-5 pt-4 border-t border-slate-700/60">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Quick Demo Logins
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-demo-admin"
                type="button"
                onClick={() => fillDemo('admin', 'password123')}
                className="py-2 px-3 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs text-slate-200 border border-slate-600/50 text-left transition cursor-pointer"
              >
                <div className="font-semibold text-sky-400">Admin</div>
                <div className="text-[10px] text-slate-400">admin / password123</div>
              </button>

              <button
                id="btn-demo-operator"
                type="button"
                onClick={() => fillDemo('operator', 'cantec2026')}
                className="py-2 px-3 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs text-slate-200 border border-slate-600/50 text-left transition cursor-pointer"
              >
                <div className="font-semibold text-emerald-400">Staff Operator</div>
                <div className="text-[10px] text-slate-400">operator / cantec2026</div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-5">
          Multi-tenant secure session · Isolated by Organization ID (CTP)
        </p>
      </div>

      {/* MODAL 1: User Password Reset Options */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-sky-400" />
                <span>User Password Reset</span>
              </h3>
              <button
                id="btn-close-reset-modal"
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Reset the password for an operator or admin account using your organization verification code.
            </p>

            {resetSuccess ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
                <button
                  id="btn-reset-success-login"
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-3.5">
                {resetError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Username to Reset *
                  </label>
                  <input
                    id="input-reset-username"
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="e.g. operator or admin"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Organization Verification Code *
                  </label>
                  <input
                    id="input-reset-org-code"
                    type="text"
                    required
                    value={resetOrgCode}
                    onChange={(e) => setResetOrgCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CTP"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-mono uppercase text-white placeholder:text-slate-500 focus:border-sky-500 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Default demo code is <span className="text-sky-400 font-mono font-bold">CTP</span> (Cantec Printing & Packaging).
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      id="input-reset-new-password"
                      type={showResetPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-xl bg-slate-900 border border-slate-700 pl-3 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    id="input-reset-confirm-password"
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700/60"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-password-reset"
                    type="submit"
                    disabled={resetLoading || !resetUsername.trim() || !resetNewPassword}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Automated Email Change Field in Admin Login */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/80 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400" />
                <span>Automated Report Email Settings</span>
              </h3>
              <button
                id="btn-close-email-modal"
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Configure the destination email address for automated daily reports, repeat alert notifications, and summary digests.
            </p>

            {emailSuccess ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{emailSuccess}</span>
                </div>
                <button
                  id="btn-email-success-close"
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailChangeSubmit} className="space-y-3.5">
                {emailError && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{emailError}</span>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Current Automated Email
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    {currentReportEmail || 'management@cantec.lk'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    New Automated Recipient Email *
                  </label>
                  <input
                    id="input-new-automated-email"
                    type="email"
                    required
                    value={newReportEmail}
                    onChange={(e) => setNewReportEmail(e.target.value)}
                    placeholder="e.g. director@cantec.lk or hr@company.com"
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    All scheduled reports will be delivered to this address.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-700/60">
                  <span className="text-[11px] font-bold text-slate-300 block mb-2">
                    Administrator Authorization
                  </span>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Admin Username
                      </label>
                      <input
                        id="input-email-admin-username"
                        type="text"
                        required
                        value={emailAdminUsername}
                        onChange={(e) => setEmailAdminUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Admin Password
                      </label>
                      <input
                        id="input-email-admin-password"
                        type="password"
                        required
                        value={emailAdminPassword}
                        onChange={(e) => setEmailAdminPassword(e.target.value)}
                        placeholder="Enter admin password to confirm"
                        className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 outline-hidden"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Demo admin password: <span className="font-mono text-slate-400">password123</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700/60"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-submit-automated-email"
                    type="submit"
                    disabled={emailLoading || !newReportEmail || !emailAdminPassword}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {emailLoading ? 'Updating...' : 'Save Automated Email'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

