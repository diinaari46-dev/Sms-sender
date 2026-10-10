import React, { useState } from 'react';
import { Smartphone, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { normalizeSomaliPhone } from '../lib/phone';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';

export const AuthPage: React.FC = () => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [phoneInput, setPhoneInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  const { signInWithPhone, signUpWithPhone } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { showToast } = useToast();

  const phoneNorm = normalizeSomaliPhone(phoneInput);

  const executeSignUp = async () => {
    setShowSignupConfirm(false);
    setLoading(true);
    try {
      const res = await signUpWithPhone(phoneInput, password);
      if (!res.success) {
        if (res.error?.includes('User already registered') || res.error?.includes('already registered')) {
          setFormError(t('errAccountExists'));
        } else {
          setFormError(res.error || t('errGenericAuth'));
        }
      } else {
        showToast(t('signupSuccess'), 'success');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate Phone
    if (!phoneNorm.isValid) {
      setFormError(t('errInvalidPhone'));
      return;
    }

    // Validate Password length
    if (password.length < 6) {
      setFormError(t('errPasswordShort'));
      return;
    }

    // Validate Confirm Password on signup
    if (tab === 'signup' && password !== confirmPassword) {
      setFormError(t('errPasswordMismatch'));
      return;
    }

    if (tab === 'signup') {
      setShowSignupConfirm(true);
      return;
    }

    setLoading(true);

    try {
      const res = await signInWithPhone(phoneInput, password);
      if (!res.success) {
        if (res.error?.includes('Invalid login credentials') || res.error?.includes('invalid_grant')) {
          setFormError(t('errWrongCredentials'));
        } else {
          setFormError(t('errWrongCredentials'));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Language Switcher in top right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <div className="flex items-center bg-white border border-neutral-200/90 rounded-lg p-0.5 text-xs shadow-xs">
          <button
            type="button"
            onClick={() => setLang('so')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              lang === 'so' ? 'bg-emerald-600 text-white font-semibold' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Soomaali
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              lang === 'en' ? 'bg-emerald-600 text-white font-semibold' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            English
          </button>
        </div>
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md mx-auto mb-3">
            SMS
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
            {t('appName')}
          </h1>
          <p className="mt-1.5 text-xs text-neutral-600 max-w-sm mx-auto leading-relaxed">
            {t('authSubtitle')}
          </p>
        </div>

        {/* Auth Container */}
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm overflow-hidden">
          {/* Two Tabs: Login / Create account */}
          <div className="grid grid-cols-2 border-b border-neutral-200 bg-neutral-50/70 p-1">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setFormError(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                tab === 'login'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t('loginTab')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setFormError(null);
              }}
              className={`py-2.5 text-xs font-semibold rounded-lg transition-all ${
                tab === 'signup'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {t('signupTab')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-snug animate-in fade-in">
                {formError}
              </div>
            )}

            {/* Phone Number Field */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t('phoneLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder={t('phonePlaceholder')}
                  autoComplete="tel"
                  className="w-full pl-9 pr-3 py-2.5 bg-neutral-50/50 border border-neutral-300 rounded-lg text-sm text-neutral-900 font-mono placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  required
                />
              </div>

              {/* Dynamic Normalization Helper */}
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                {phoneNorm.isValid ? (
                  <span className="text-emerald-700 font-mono font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{phoneNorm.normalized}</span>
                  </span>
                ) : (
                  <span className="text-neutral-500">
                    {t('phoneHelper')}
                  </span>
                )}
                <span className="text-neutral-400 font-mono text-[10px]">Hormuud 61xxxxxxx</span>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {t('passwordLabel')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder={t('passwordPlaceholder')}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  className="w-full pl-9 pr-10 py-2.5 bg-neutral-50/50 border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field (Sign-up only) */}
            {tab === 'signup' && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                  {t('confirmPasswordLabel')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={t('confirmPasswordPlaceholder')}
                    autoComplete="new-password"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-50/50 border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{tab === 'login' ? t('loginButton') : t('signupButton')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Android Gateway Integration note */}
          <div className="p-4 bg-neutral-50 border-t border-neutral-100 text-[11px] text-neutral-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {lang === 'so'
                ? 'Akoonkan ayaa sidoo kale lagu galaa App-ka Android Gateway.'
                : 'Use these exact same credentials in the companion Android Gateway app.'}
            </span>
          </div>
        </div>
      </div>

      {/* Signup Confirmation Modal */}
      <ConfirmModal
        isOpen={showSignupConfirm}
        title={t('signupConfirmTitle')}
        message={`${t('signupConfirmMsg')} ${phoneNorm.normalized}?`}
        confirmLabel={t('signupButton')}
        cancelLabel={t('cancelBtn')}
        isDestructive={false}
        isLoading={loading}
        onConfirm={executeSignUp}
        onCancel={() => setShowSignupConfirm(false)}
      />
    </div>
  );
};
