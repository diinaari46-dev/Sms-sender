import React from 'react';
import { Smartphone, LogOut, Globe, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PageRoute } from '../types/models';

interface NavbarProps {
  currentPage: PageRoute;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage }) => {
  const { userPhone, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const getPageTitle = (page: PageRoute) => {
    switch (page) {
      case 'dashboard':
        return t('navDashboard');
      case 'customers':
        return t('navCustomers');
      case 'send':
        return t('navSend');
      case 'campaigns':
        return t('navCampaigns');
      case 'settings':
        return t('navSettings');
      default:
        return t('appName');
    }
  };

  return (
    <header className="h-16 border-b border-neutral-200/80 bg-white sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      {/* Zone 1: Brand & Page Context */}
      <div className="flex items-center gap-3">
        <div className="flex md:hidden items-center gap-2 text-emerald-700 font-bold text-base tracking-tight">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
            SMS
          </div>
          <span>SMS Gateway</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm text-neutral-500">
          <span className="font-semibold text-neutral-900">{t('appName')}</span>
          <span aria-hidden="true" className="text-neutral-300">/</span>
          <span className="text-emerald-700 font-medium">{getPageTitle(currentPage)}</span>
        </div>
      </div>

      {/* Zone 3: Account Phone + Language Toggle + Logout */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Language Segmented Toggle */}
        <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 text-xs">
          <button
            onClick={() => setLang('so')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              lang === 'so'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title="Soomaali"
          >
            SO
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              lang === 'en'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
            title="English"
          >
            EN
          </button>
        </div>

        {/* User Phone Number Display */}
        {userPhone && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-50 border border-neutral-200/80 text-xs text-neutral-700">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-mono tabular-nums font-semibold text-neutral-900">
              {t('accountLabel')}: {userPhone}
            </span>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
          title={t('logout')}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('logout')}</span>
        </button>
      </div>
    </header>
  );
};
