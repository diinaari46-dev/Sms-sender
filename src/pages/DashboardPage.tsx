import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  DollarSign,
  Send,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Battery,
  BatteryCharging,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../i18n/LanguageContext';
import { GatewayConfig, OutboxMessage, PageRoute } from '../types/models';
import { GatewayGuideCard } from '../components/GatewayGuideCard';

interface DashboardPageProps {
  onNavigate: (page: PageRoute) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalOwed, setTotalOwed] = useState(0);
  const [sentToday, setSentToday] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [gateway, setGateway] = useState<GatewayConfig | null>(null);
  const [recentOutbox, setRecentOutbox] = useState<OutboxMessage[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Check if gateway was seen within the last 90 seconds
  const isGatewayOnline = useMemo(() => {
    if (!gateway?.last_seen) return false;
    const lastSeenTime = new Date(gateway.last_seen).getTime();
    const diffSeconds = (Date.now() - lastSeenTime) / 1000;
    return diffSeconds >= 0 && diffSeconds < 90;
  }, [gateway?.last_seen, lastRefreshed]);

  const loadDashboardData = async () => {
    try {
      // 1. Fetch customers aggregate
      const { data: customers } = await supabase.from('customers').select('balance');
      if (customers) {
        setTotalCustomers(customers.length);
        const sumOwed = customers.reduce((acc, c) => acc + (Number(c.balance) || 0), 0);
        setTotalOwed(sumOwed);
      }

      // 2. Fetch outbox stats
      const { data: outbox } = await supabase
        .from('outbox')
        .select('*')
        .order('created_at', { ascending: false });

      if (outbox) {
        const outboxList = outbox as OutboxMessage[];
        setRecentOutbox(outboxList);

        // Calculate Sent Today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        let todayCount = 0;
        let pending = 0;
        let failed = 0;
        let delivered = 0;

        outboxList.forEach((msg) => {
          if (msg.status === 'pending') pending++;
          if (msg.status === 'failed') failed++;
          if (msg.status === 'delivered') delivered++;

          if (msg.status === 'sent' || msg.status === 'delivered') {
            const timestamp = msg.sent_at || msg.delivered_at || msg.created_at;
            if (timestamp && new Date(timestamp) >= startOfToday) {
              todayCount++;
            }
          }
        });

        setSentToday(todayCount);
        setPendingCount(pending);
        setFailedCount(failed);
        setDeliveredCount(delivered);
      }

      // 3. Fetch gateway row
      const { data: gw } = await supabase.from('gateway').select('*').maybeSingle();
      if (gw) {
        setGateway(gw as GatewayConfig);
      } else {
        // Default gateway state if not yet configured
        setGateway({
          is_enabled: true,
          min_delay_ms: 3000,
          max_delay_ms: 7000,
          daily_limit: 300,
          last_seen: null,
          battery: null,
        });
      }
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // Supabase Realtime channel for live updates
    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbox' }, () => {
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gateway' }, (payload: any) => {
        if (payload?.new) {
          setGateway(payload.new as GatewayConfig);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        loadDashboardData();
      })
      .subscribe();

    // Periodic polling from Supabase every 15 seconds
    const pollInterval = setInterval(() => {
      loadDashboardData();
    }, 15000);

    // Periodic heartbeat checker every 10 seconds to update online status relative to current clock
    const timer = setInterval(() => {
      setLastRefreshed(new Date());
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      clearInterval(timer);
    };
  }, []);

  // Compute 7-day sent messages trend
  const last7DaysChartData = useMemo(() => {
    const days: Array<{ label: string; dateStr: string; count: number }> = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString('so-SO', { weekday: 'short' });
      days.push({ label: weekday, dateStr, count: 0 });
    }

    recentOutbox.forEach((msg) => {
      if (msg.status === 'sent' || msg.status === 'delivered') {
        const timeStr = msg.sent_at || msg.delivered_at || msg.created_at;
        if (timeStr) {
          const msgDate = timeStr.split('T')[0];
          const found = days.find((d) => d.dateStr === msgDate);
          if (found) {
            found.count++;
          }
        }
      }
    });

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    return { days, maxCount };
  }, [recentOutbox]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            {t('dashboardTitle')}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t('dashboardSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setLoading(true);
              loadDashboardData();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-200 shadow-2xs transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => onNavigate('send')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('quickActionSend')}</span>
          </button>
        </div>
      </div>

      {/* Gateway Telemetry Banner */}
      <div className={`rounded-xl border p-4.5 transition-all ${
        isGatewayOnline
          ? 'bg-emerald-950 text-emerald-50 border-emerald-900 shadow-sm'
          : 'bg-neutral-900 text-neutral-100 border-neutral-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isGatewayOnline ? 'bg-emerald-800 text-emerald-200' : 'bg-neutral-800 text-neutral-400'
            }`}>
              <Radio className={`w-5 h-5 ${isGatewayOnline ? 'animate-pulse text-emerald-300' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {t('gatewayStatusTitle')}
                </span>
                <span className={`w-2 h-2 rounded-full ${isGatewayOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
              </div>
              <h3 className="text-base font-semibold leading-tight mt-0.5">
                {isGatewayOnline ? t('gatewayOnline') : t('gatewayOffline')}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 md:pt-0 border-t md:border-t-0 border-neutral-800">
            {/* Battery */}
            <div className="bg-neutral-800/60 p-2.5 rounded-lg border border-neutral-700/50">
              <span className="text-[11px] text-neutral-400 block">{t('gatewayBattery')}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono tabular-nums font-semibold text-neutral-100">
                  {gateway?.battery !== null && gateway?.battery !== undefined ? `${gateway.battery}%` : '—'}
                </span>
              </div>
            </div>

            {/* Last Seen */}
            <div className="bg-neutral-800/60 p-2.5 rounded-lg border border-neutral-700/50">
              <span className="text-[11px] text-neutral-400 block">{t('gatewayLastSeen')}</span>
              <span className="font-mono tabular-nums text-xs font-semibold text-neutral-200 mt-0.5 block truncate">
                {gateway?.last_seen ? new Date(gateway.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : t('gatewayNeverSeen')}
              </span>
            </div>

            {/* Emergency Stop Switch State */}
            <div className="bg-neutral-800/60 p-2.5 rounded-lg border border-neutral-700/50">
              <span className="text-[11px] text-neutral-400 block">{t('gatewayEnabledLabel')}</span>
              <span className={`text-xs font-semibold mt-0.5 block ${
                gateway?.is_enabled ? 'text-emerald-300' : 'text-rose-400'
              }`}>
                {gateway?.is_enabled ? t('gatewayActive') : t('gatewayStopped')}
              </span>
            </div>

            {/* Daily Limit */}
            <div className="bg-neutral-800/60 p-2.5 rounded-lg border border-neutral-700/50">
              <span className="text-[11px] text-neutral-400 block">{t('dailyLimitLabel')}</span>
              <span className="font-mono tabular-nums text-xs font-semibold text-neutral-200 mt-0.5 block">
                {gateway?.daily_limit || 300} SMS/day
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6 Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Customers */}
        <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('statTotalCustomers')}</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-neutral-900">
            {totalCustomers}
          </div>
          <button
            onClick={() => onNavigate('customers')}
            className="mt-2 text-[11px] text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-0.5"
          >
            <span>View directory</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Total Owed */}
        <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('statTotalOwed')}</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-emerald-700">
            ${totalOwed.toFixed(2)}
          </div>
          <span className="mt-2 text-[11px] text-neutral-400 block">
            Customer balance total
          </span>
        </div>

        {/* Sent Today */}
        <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('statSentToday')}</span>
            <Send className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-neutral-900">
            {sentToday}
          </div>
          <span className="mt-2 text-[11px] text-neutral-400 block">
            Dispatched today
          </span>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('statPending')}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-amber-600">
            {pendingCount}
          </div>
          <button
            onClick={() => onNavigate('campaigns')}
            className="mt-2 text-[11px] text-amber-700 hover:text-amber-800 font-medium flex items-center gap-0.5"
          >
            <span>In queue</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Delivered */}
        <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('statDelivered')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-emerald-600">
            {deliveredCount}
          </div>
          <span className="mt-2 text-[11px] text-neutral-400 block">
            Confirmed delivery
          </span>
        </div>

        {/* Failed */}
        <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-500 mb-2">
            <span className="text-xs font-medium">{t('statFailed')}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="font-mono tabular-nums text-2xl font-bold text-rose-600">
            {failedCount}
          </div>
          <button
            onClick={() => onNavigate('campaigns')}
            className="mt-2 text-[11px] text-rose-700 hover:text-rose-800 font-medium flex items-center gap-0.5"
          >
            <span>Review & retry</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 7-Day Sent SMS Bar Chart */}
      <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">{t('chartTitle')}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{t('chartSubtitle')}</p>
          </div>
          <span className="text-xs font-mono tabular-nums text-neutral-400">
            Past 7 calendar days
          </span>
        </div>

        {/* Bar Chart Visualization */}
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-36 border-b border-neutral-100 pb-2">
            {last7DaysChartData.days.map((item, idx) => {
              const heightPercent = Math.max(
                Math.round((item.count / last7DaysChartData.maxCount) * 100),
                item.count > 0 ? 12 : 4
              );
              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group">
                  <span className="text-[11px] font-mono tabular-nums text-neutral-500 mb-1 group-hover:text-emerald-700 font-medium transition-colors">
                    {item.count}
                  </span>
                  <div className="w-full max-w-[40px] bg-neutral-100 rounded-t-md overflow-hidden h-28 flex items-end">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        item.count > 0
                          ? 'bg-emerald-600 group-hover:bg-emerald-700'
                          : 'bg-neutral-200'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-2 capitalize font-medium">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gateway Setup Guide Card */}
      <GatewayGuideCard />
    </div>
  );
};
