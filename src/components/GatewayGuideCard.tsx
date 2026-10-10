import React from 'react';
import { Smartphone, LogIn, Wifi, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface GatewayGuideCardProps {
  compact?: boolean;
}

export const GatewayGuideCard: React.FC<GatewayGuideCardProps> = ({ compact = false }) => {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-xl border border-neutral-200/90 shadow-xs p-5 transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-medium">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-neutral-900">{t('guideTitle')}</h3>
          </div>
          {!compact && (
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              {t('guideSubtitle')}
            </p>
          )}
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-3'}`}>
        {/* Step 1 */}
        <div className="flex flex-col p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/70">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center justify-center">
              1
            </span>
            <span className="text-xs font-semibold text-neutral-800">{t('guideStep1Title')}</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            {t('guideStep1Body')}
          </p>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/70">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center justify-center">
              2
            </span>
            <span className="text-xs font-semibold text-neutral-800">{t('guideStep2Title')}</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            {t('guideStep2Body')}
          </p>
        </div>

        {/* Step 3 */}
        <div className="flex flex-col p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/70">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center justify-center">
              3
            </span>
            <span className="text-xs font-semibold text-neutral-800">{t('guideStep3Title')}</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed">
            {t('guideStep3Body')}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between text-xs text-neutral-500 gap-2">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Hormuud Telecom (61xxxxxxx) SMS Protocol</span>
        </span>
        <span className="text-neutral-400 font-mono text-[11px]">
          Gateway reads pending outbox automatically
        </span>
      </div>
    </div>
  );
};
