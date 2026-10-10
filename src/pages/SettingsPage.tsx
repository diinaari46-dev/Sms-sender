import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldAlert,
  Power,
  Clock,
  Gauge,
  Lock,
  Globe,
  Save,
  CheckCircle2,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GatewayConfig } from '../types/models';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GatewayGuideCard } from '../components/GatewayGuideCard';

export const SettingsPage: React.FC = () => {
  const { lang, setLang, t } = useLanguage();
  const { updatePassword } = useAuth();
  const { showToast } = useToast();

  // Gateway config state
  const [gateway, setGateway] = useState<GatewayConfig>({
    is_enabled: true,
    min_delay_ms: 3000,
    max_delay_ms: 7000,
    daily_limit: 300,
    last_seen: null,
    battery: null,
    company_name: '',
  });
  const [loadingGateway, setLoadingGateway] = useState(true);
  const [savingGateway, setSavingGateway] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPass, setUpdatingPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('gateway')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setGateway({
            ...data,
            company_name: data.company_name || '',
          } as GatewayConfig);
        }
        setLoadingGateway(false);
      });
  }, []);

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGateway(true);

    try {
      const payload = {
        company_name: gateway.company_name?.trim() || null,
        is_enabled: gateway.is_enabled,
        min_delay_ms: Number(gateway.min_delay_ms),
        max_delay_ms: Number(gateway.max_delay_ms),
        daily_limit: Number(gateway.daily_limit),
      };

      // 1. Try update existing row for user
      const { data: updateData, error: updateError } = await supabase
        .from('gateway')
        .update(payload)
        .select();

      if (updateError || !updateData || updateData.length === 0) {
        // Fallback: upsert on user_id
        const { error: upsertError } = await supabase
          .from('gateway')
          .upsert([payload], { onConflict: 'user_id' });

        if (upsertError) {
          showToast(upsertError.message, 'error');
          return;
        }
      }

      showToast(t('gatewaySavedToast'), 'success');
    } catch (err: any) {
      showToast(err.message || 'Error saving settings', 'error');
    } finally {
      setSavingGateway(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError(t('errPasswordShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('errPasswordMismatch'));
      return;
    }

    setUpdatingPass(true);
    try {
      const res = await updatePassword(newPassword);
      if (res.success) {
        showToast(t('passwordUpdatedToast'), 'success');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res.error || 'Failed to update password');
      }
    } finally {
      setUpdatingPass(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
          {t('settingsTitle')}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {t('settingsSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Gateway Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company / Sender Name Card */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-neutral-900">
                {t('companyNameSectionTitle')}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  {t('companyNameLabel')}
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    value={gateway.company_name || ''}
                    onChange={(e) =>
                      setGateway((prev) => ({ ...prev, company_name: e.target.value }))
                    }
                    placeholder={t('companyNamePlaceholder')}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  {t('companyNameDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Stop & Dispatch Throttling Card */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs space-y-5">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
              <Power className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-neutral-900">
                {t('emergencyStopTitle')}
              </h3>
            </div>

            <form onSubmit={handleSaveGateway} className="space-y-5">
              {/* Emergency Stop Toggle */}
              <div className={`p-4 rounded-xl border transition-colors flex items-center justify-between gap-4 ${
                gateway.is_enabled
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/60 border-rose-200 text-rose-950'
              }`}>
                <div>
                  <h4 className="text-xs font-bold">
                    {gateway.is_enabled ? t('gatewayEnabledToggle') : t('gatewayDisabledToggle')}
                  </h4>
                  <p className="text-[11px] text-neutral-600 mt-0.5 leading-relaxed">
                    {t('emergencyStopDesc')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setGateway((prev) => ({ ...prev, is_enabled: !prev.is_enabled }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    gateway.is_enabled ? 'bg-emerald-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      gateway.is_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Delay & Daily Limit Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Min Delay */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    {t('minDelayLabel')}
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="number"
                      min="1000"
                      step="500"
                      value={gateway.min_delay_ms}
                      onChange={(e) =>
                        setGateway((prev) => ({ ...prev, min_delay_ms: Number(e.target.value) }))
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono tabular-nums border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">e.g. 3000ms = 3 sec</span>
                </div>

                {/* Max Delay */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    {t('maxDelayLabel')}
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="number"
                      min="2000"
                      step="500"
                      value={gateway.max_delay_ms}
                      onChange={(e) =>
                        setGateway((prev) => ({ ...prev, max_delay_ms: Number(e.target.value) }))
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono tabular-nums border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">e.g. 7000ms = 7 sec</span>
                </div>

                {/* Daily Limit */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">
                    {t('dailyLimitLabel')}
                  </label>
                  <div className="relative">
                    <Gauge className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="number"
                      min="10"
                      max="5000"
                      value={gateway.daily_limit}
                      onChange={(e) =>
                        setGateway((prev) => ({ ...prev, daily_limit: Number(e.target.value) }))
                      }
                      required
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono tabular-nums border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">Protects SIM against carrier blocks</span>
                  {gateway.daily_limit > 200 && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{t('dailyLimitWarning')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingGateway}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  {savingGateway ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{t('saveGatewayBtn')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
              <Lock className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-neutral-900">
                {t('changePasswordTitle')}
              </h3>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3.5 max-w-md">
              {passwordError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  {t('newPasswordLabel')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  {t('confirmNewPasswordLabel')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type password"
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-start">
                <button
                  type="submit"
                  disabled={updatingPass}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  {updatingPass && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{t('updatePasswordBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Language & Gateway Setup Guide */}
        <div className="space-y-6">
          {/* Language Preference Card */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-neutral-100 pb-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-neutral-900">
                {t('languageLabel')}
              </h3>
            </div>
            <p className="text-xs text-neutral-500">
              Select your preferred display language for the control panel.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLang('so')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  lang === 'so'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                🇸🇴 {t('somali')}
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  lang === 'en'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                }`}
              >
                🇬🇧 {t('english')}
              </button>
            </div>
          </div>

          {/* Gateway Setup Guide */}
          <GatewayGuideCard />
        </div>
      </div>
    </div>
  );
};
