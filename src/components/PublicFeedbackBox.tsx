import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Info,
  Languages,
  Lightbulb,
  Lock,
  MessageSquare,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getOrCreateDeviceToken } from '../lib/deviceToken';
import { FeedbackBox, SubmissionType } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { PublicLanguage, publicTranslations } from '../locales/publicTranslations';

interface PublicFeedbackBoxProps {
  initialBoxCode?: string;
  onNavigateToOperator: () => void;
}

export const PublicFeedbackBox: React.FC<PublicFeedbackBoxProps> = ({
  initialBoxCode = 'CTP-CANTEEN',
  onNavigateToOperator,
}) => {
  const [boxes, setBoxes] = useState<FeedbackBox[]>([]);
  const [selectedBoxCode, setSelectedBoxCode] = useState<string>(initialBoxCode);
  const [currentBox, setCurrentBox] = useState<FeedbackBox | null>(null);
  const [orgName, setOrgName] = useState<string>('Cantec Printing & Packaging');
  const [welcomeMessage, setWelcomeMessage] = useState<string>('');
  const [thankYouMessage, setThankYouMessage] = useState<string>('');
  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);

  // Language state (Sinhala & English toggle - Public View Only)
  const [language, setLanguage] = useState<PublicLanguage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('public_feedback_lang');
      if (saved === 'si' || saved === 'en') return saved;
    }
    return 'en';
  });

  const handleLanguageChange = (lang: PublicLanguage) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('public_feedback_lang', lang);
    }
  };

  const t = publicTranslations[language];

  // Form State
  const [category, setCategory] = useState<SubmissionType | null>(null);
  const [message, setMessage] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [submitterName, setSubmitterName] = useState<string>('');
  const [submitterContact, setSubmitterContact] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [submittedResponseMsg, setSubmittedResponseMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [boxSelectorOpen, setBoxSelectorOpen] = useState<boolean>(false);

  // Fetch available feedback boxes and initial config
  useEffect(() => {
    async function loadBoxes() {
      try {
        const res = await fetch('/api/public/boxes');
        if (res.ok) {
          const data = await res.json();
          setBoxes(data.boxes || []);
          if (data.organization?.name) {
            setOrgName(data.organization.name);
          }
          if (data.organization?.welcome_message) {
            setWelcomeMessage(data.organization.welcome_message);
          }
          if (data.organization?.thank_you_message) {
            setThankYouMessage(data.organization.thank_you_message);
          }
          const matched = data.boxes?.find(
            (b: FeedbackBox) => b.box_code.toUpperCase() === selectedBoxCode.toUpperCase()
          );
          if (matched) {
            setCurrentBox(matched);
          } else if (data.boxes?.length > 0) {
            setCurrentBox(data.boxes[0]);
            setSelectedBoxCode(data.boxes[0].box_code);
          }
        }
      } catch (err) {
        console.error('Failed to load boxes', err);
      } finally {
        setLoadingConfig(false);
      }
    }
    loadBoxes();
  }, []);

  // Update current box when selectedBoxCode changes
  useEffect(() => {
    if (boxes.length > 0) {
      const match = boxes.find((b) => b.box_code.toUpperCase() === selectedBoxCode.toUpperCase());
      if (match) {
        setCurrentBox(match);
      }
    }
  }, [selectedBoxCode, boxes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setErrorMessage(t.errorMinLength);
      return;
    }

    if (trimmed.length > 2000) {
      setErrorMessage(t.errorMaxLength);
      return;
    }

    setSubmitting(true);
    try {
      const deviceToken = getOrCreateDeviceToken();

      const response = await fetch('/api/public/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          box_code: selectedBoxCode,
          type: category,
          message: trimmed,
          name: isAnonymous ? undefined : submitterName.trim() || undefined,
          contact: isAnonymous ? undefined : submitterContact.trim() || undefined,
          anonymous: isAnonymous,
          device_token: deviceToken,
        }),
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Server returned unexpected response (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.error || t.errorGeneric);
      }

      setSubmittedResponseMsg(data.message || '');
      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || t.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setMessage('');
    setSubmitterName('');
    setSubmitterContact('');
    setIsAnonymous(true);
    setCategory(null);
    setSubmitted(false);
    setSubmittedResponseMsg('');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-sm shadow-sky-600/30 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-tight truncate">
                {t.appTitle}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium leading-none truncate">
                {orgName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Native Sinhala / English Toggle */}
            <div
              className="flex items-center rounded-xl bg-slate-100 p-0.5 sm:p-1 border border-slate-200 shadow-2xs"
              role="group"
              aria-label="Language selection"
            >
              <button
                id="btn-lang-en"
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  language === 'en'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to English"
              >
                EN
              </button>
              <button
                id="btn-lang-si"
                type="button"
                onClick={() => handleLanguageChange('si')}
                className={`px-2 sm:px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                  language === 'si'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="සිංහල භාෂාවට මාරු වන්න"
              >
                <span className="text-[12px] sm:text-[13px] leading-none">සිංහල</span>
              </button>
            </div>

            <PWAInstallButton />
            <button
              id="btn-switch-operator"
              onClick={onNavigateToOperator}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Open Operator Dashboard"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">{t.operatorLogin}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 flex flex-col justify-center transition-all">
        {/* Box Picker Card */}
        <div className="mb-5 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 shrink-0">
                <QrCode className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  {t.locationLabel}
                </span>
                <h2 className="text-sm font-semibold text-slate-900 truncate">
                  {currentBox?.title || selectedBoxCode}
                </h2>
              </div>
            </div>

            <button
              id="btn-toggle-box-selector"
              onClick={() => setBoxSelectorOpen(!boxSelectorOpen)}
              className="shrink-0 flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800 bg-sky-50/80 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg border border-sky-200 transition"
            >
              <span>{selectedBoxCode}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${boxSelectorOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {currentBox?.description && (
            <p className="mt-2 text-xs text-slate-500 pl-1">
              {currentBox.description}
            </p>
          )}

          {/* Dropdown list of boxes */}
          {boxSelectorOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-600">
                {t.selectBoxTitle}
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {boxes.map((b) => (
                  <button
                    key={b.box_code}
                    id={`box-option-${b.box_code}`}
                    onClick={() => {
                      setSelectedBoxCode(b.box_code);
                      setBoxSelectorOpen(false);
                      if (submitted) handleResetForm();
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-center justify-between ${
                      selectedBoxCode === b.box_code ? 'bg-sky-50/70 font-medium' : ''
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{b.title}</div>
                      <div className="text-[11px] text-slate-500">{b.description || t.defaultBoxDescription}</div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      {b.box_code}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* State 1: Submitted Confirmation Screen (Spec #8) */}
        {submitted ? (
          <div
            id="view-thank-you"
            className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-lg shadow-slate-200/50 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 ring-8 ring-emerald-50/50">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
              {t.thankYouTitle}
            </h2>
            <p className="text-base font-medium text-slate-700 mb-1 leading-relaxed">
              {submittedResponseMsg || (language === 'si' ? t.thankYouMessageDefault : (thankYouMessage || t.thankYouMessageDefault))}
            </p>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {t.thankYouSubtext}
            </p>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5 mb-6 text-xs text-slate-600 flex items-center gap-2.5 justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isAnonymous
                  ? t.anonymousConfirmedBadge
                  : t.namedConfirmedBadge(submitterName)}
              </span>
            </div>

            <div className="space-y-3">
              <button
                id="btn-submit-another"
                onClick={handleResetForm}
                className="w-full py-3.5 px-4 rounded-xl bg-sky-600 text-white font-semibold text-sm hover:bg-sky-700 active:scale-[0.99] transition shadow-md shadow-sky-600/20 cursor-pointer"
              >
                {t.submitAnotherBtn}
              </button>
            </div>
          </div>
        ) : category === null ? (
          /* State 2: Category Choice Screen (Spec #3 & #5: Suggestion vs Complaint) */
          <div
            id="view-category-selection"
            className="bg-white border border-slate-200 rounded-3xl p-7 shadow-lg shadow-slate-200/50 text-center"
          >
            {/* Helpful Native Language Quick Switcher */}
            <div className="mb-4 inline-flex items-center gap-1.5 bg-slate-100/90 py-1 px-3 rounded-full border border-slate-200 text-xs">
              <Languages className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold text-slate-600">{t.languageSwitchPrompt}:</span>
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`px-2 py-0.5 rounded-md font-bold text-xs transition ${
                  language === 'en'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => handleLanguageChange('si')}
                className={`px-2 py-0.5 rounded-md font-bold text-xs transition ${
                  language === 'si'
                    ? 'bg-white text-sky-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                සිංහල
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {t.helpQuestion}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
                {language === 'si' ? t.welcomeMessageDefault : (welcomeMessage || t.welcomeMessageDefault)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Suggestion Option */}
              <button
                id="btn-select-suggestion"
                onClick={() => {
                  setCategory('suggestion');
                  setErrorMessage(null);
                }}
                className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/50 text-left transition duration-150 flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Lightbulb className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-700 flex items-center gap-1.5">
                    {t.suggestionTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {t.suggestionDesc}
                  </p>
                </div>
              </button>

              {/* Complaint Option */}
              <button
                id="btn-select-complaint"
                onClick={() => {
                  setCategory('complaint');
                  setErrorMessage(null);
                }}
                className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-rose-400 bg-white hover:bg-rose-50/50 text-left transition duration-150 flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-rose-700 flex items-center gap-1.5">
                    {t.complaintTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {t.complaintDesc}
                  </p>
                </div>
              </button>
            </div>

            {/* Anonymous note */}
            <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 leading-normal">
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
              <span>{t.anonymousGuarantee}</span>
            </div>
          </div>
        ) : (
          /* State 3: Category Form (Spec #6 & #7) */
          <div
            id="view-feedback-form"
            className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-lg shadow-slate-200/50 animate-in fade-in-50 duration-150"
          >
            {/* Header with Back button and category badge */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
              <button
                id="btn-back-to-category"
                onClick={() => setCategory(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.backToCategory}</span>
              </button>

              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-tight ${
                  category === 'suggestion'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {category === 'suggestion' ? t.suggestionBadge : t.complaintBadge}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="feedback-message"
                  className="block text-sm font-bold text-slate-900 mb-1.5"
                >
                  {category === 'suggestion' ? t.suggestionPrompt : t.complaintPrompt}
                  <span className="text-rose-500 ml-1">*</span>
                </label>
                <textarea
                  id="feedback-message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    category === 'suggestion'
                      ? t.suggestionPlaceholder
                      : t.complaintPlaceholder
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-hidden transition resize-y"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 px-1">
                  <span>{t.repeatedSubmissionsNote}</span>
                  <span>{message.length} / 2000 {t.characterCount}</span>
                </div>
              </div>

              {/* Anonymous Checkbox */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    id="checkbox-anonymous"
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">
                      {t.anonymousCheckboxLabel}
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-normal mt-0.5">
                      {t.anonymousCheckboxSubtext}
                    </span>
                  </div>
                </label>
              </div>

              {/* Optional Name & Contact (Only if not anonymous) */}
              {!isAnonymous && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                  <div>
                    <label
                      htmlFor="submitter-name"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      {t.optionalNameLabel}
                    </label>
                    <input
                      id="submitter-name"
                      type="text"
                      value={submitterName}
                      onChange={(e) => setSubmitterName(e.target.value)}
                      placeholder={t.optionalNamePlaceholder}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-hidden"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="submitter-contact"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      {t.optionalContactLabel}
                    </label>
                    <input
                      id="submitter-contact"
                      type="text"
                      value={submitterContact}
                      onChange={(e) => setSubmitterContact(e.target.value)}
                      placeholder={t.optionalContactPlaceholder}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="btn-submit-feedback"
                type="submit"
                disabled={submitting || message.trim().length < 3}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  category === 'suggestion'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                {submitting ? (
                  <span>{t.submittingText}</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {category === 'suggestion' ? t.submitSuggestionBtn : t.submitComplaintBtn}
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white/50">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{t.footerSystemTitle}</span>
          <span className="text-[11px] font-mono text-slate-400">
            Box: {selectedBoxCode} · {t.footerSecurityNote}
          </span>
        </div>
      </footer>
    </div>
  );
};
