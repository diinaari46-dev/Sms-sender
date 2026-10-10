import React from 'react';
import { LayoutDashboard, Users, Send, MessageSquareText, Settings } from 'lucide-react';
import { PageRoute } from '../types/models';
import { useLanguage } from '../i18n/LanguageContext';

interface BottomNavProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentPage,
  onNavigate,
  pendingCount = 0,
}) => {
  const { t } = useLanguage();

  const navItems: Array<{ id: PageRoute; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'customers', label: t('navCustomers'), icon: Users },
    { id: 'send', label: t('navSend'), icon: Send },
    { id: 'campaigns', label: t('navCampaigns'), icon: MessageSquareText, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'settings', label: t('navSettings'), icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200/80 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors relative min-w-[56px] min-h-[44px] ${
              isActive ? 'text-emerald-700' : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[9px] font-mono px-1 py-0.2 rounded-full leading-tight">
                  {item.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-semibold' : 'font-normal'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
