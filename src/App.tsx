/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { PageRoute, OutboxMessage, GatewayConfig } from './types/models';
import { supabase } from './lib/supabase';

// Components & Pages
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { SendMessagesPage } from './pages/SendMessagesPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { SettingsPage } from './pages/SettingsPage';

const MainShell: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageRoute>('dashboard');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isGatewayOnline, setIsGatewayOnline] = useState<boolean>(false);

  // Global outbox pending badge and gateway status
  const updateGlobalStatus = async () => {
    try {
      const { data: outbox } = await supabase
        .from('outbox')
        .select('status')
        .in('status', ['pending', 'sending']);

      if (outbox) {
        setPendingCount(outbox.length);
      }

      const { data: gw } = await supabase.from('gateway').select('last_seen').maybeSingle();
      if (gw?.last_seen) {
        const diffSeconds = (Date.now() - new Date(gw.last_seen).getTime()) / 1000;
        setIsGatewayOnline(diffSeconds >= 0 && diffSeconds < 60);
      } else {
        setIsGatewayOnline(false);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    if (!user) return;
    updateGlobalStatus();

    const channel = supabase
      .channel('app_shell_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbox' }, () => {
        updateGlobalStatus();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gateway' }, () => {
        updateGlobalStatus();
      })
      .subscribe();

    const interval = setInterval(updateGlobalStatus, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md animate-pulse mb-3">
          SMS
        </div>
        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-neutral-500 font-medium mt-3">Loading SMS Gateway Panel...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row antialiased text-neutral-900">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:block">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          pendingCount={pendingCount}
          isGatewayOnline={isGatewayOnline}
        />
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        {/* Top Navbar */}
        <Navbar currentPage={currentPage} />

        {/* Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentPage === 'dashboard' && <DashboardPage onNavigate={setCurrentPage} />}
          {currentPage === 'customers' && <CustomersPage />}
          {currentPage === 'send' && <SendMessagesPage onNavigate={setCurrentPage} />}
          {currentPage === 'campaigns' && <CampaignsPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Mobile Bottom Navigation (hidden on desktop) */}
      <BottomNav
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        pendingCount={pendingCount}
      />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <MainShell />
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
