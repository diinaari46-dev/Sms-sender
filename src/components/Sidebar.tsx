import React from 'react';
import { LayoutDashboard, Users, Send, MessageSquareText, Settings, Smartphone, Radio } from 'lucide-react';
import { PageRoute } from '../types/models';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  pendingCount?: number;
  isGatewayOnline?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  pendingCount = 0,
  isGatewayOnline = false,
}) => {
  const { t } = useLanguage();
  const { userPhone } = useAuth();

  const navItems: Array<{ id: PageRoute; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'customers', label: t('navCustomers'), icon: Users },
    { id: 'send', label: t('navSend'), icon: Send },
    { id: 'campaigns', label: t('navCampaigns'), icon: MessageSquareText, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'settings', label: t('navSettings'), icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-neutral-200/80 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-neutral-100">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
          SMS
        </div>
        <div>
          <h1 className="text-sm font-bold text-neutral-900 leading-tight">SMS Reminder</h1>
          <p className="text-[11px] text-neutral-500 font-medium">Somalia Gateway Panel</p>
        </div>
      </div>

      {/* Gateway Live Status Pill */}
      <div className="px-4 pt-4">
        <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
          isGatewayOnline
            ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-800'
            : 'bg-neutral-50 border-neutral-200 text-neutral-600'
        }`}>
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${isGatewayOnline ? 'text-emerald-600 animate-pulse' : 'text-neutral-400'}`} />
            <span className="font-medium text-[11px]">
              {isGatewayOnline ? 'Gateway Online' : 'Gateway Offline'}
            </span>
          </div>
          <span className={`w-2 h-2 rounded-full ${isGatewayOnline ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
                  isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-800 font-semibold'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info Footer */}
      <div className="p-4 border-t border-neutral-100">
        <div className="flex items-center gap-2.5 text-xs text-neutral-600">
          <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="truncate">
            <p className="text-[10px] text-neutral-400 font-medium">{t('loggedInAs')}</p>
            <p className="font-mono tabular-nums font-semibold text-neutral-900 text-xs truncate">
              {userPhone || '—'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
