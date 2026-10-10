import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Eye,
  CheckCheck,
  Ban,
  Layers,
} from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { Campaign, OutboxMessage, OutboxStatus } from '../types/models';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';

export const CampaignsPage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [outboxMessages, setOutboxMessages] = useState<OutboxMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Campaign to focus on (null means "All Campaigns / Full Outbox")
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Status Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Cancel Pending Confirm Modal
  const [isCancelPendingModalOpen, setIsCancelPendingModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const loadData = async () => {
    try {
      // 1. Fetch campaigns
      const { data: cData } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (cData) {
        setCampaigns(cData as Campaign[]);
      }

      // 2. Fetch outbox
      const { data: oData } = await supabase
        .from('outbox')
        .select('*')
        .order('created_at', { ascending: false });

      if (oData) {
        setOutboxMessages(oData as OutboxMessage[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Supabase Realtime subscription
    const channel = supabase
      .channel('campaigns_outbox_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbox' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute stats per campaign
  const campaignStats = useMemo(() => {
    const stats: Record<string, { total: number; delivered: number; sent: number; pending: number; failed: number; paused: number }> = {};

    campaigns.forEach((c) => {
      stats[c.id] = { total: 0, delivered: 0, sent: 0, pending: 0, failed: 0, paused: 0 };
    });

    outboxMessages.forEach((msg) => {
      if (msg.campaign_id && stats[msg.campaign_id]) {
        const s = stats[msg.campaign_id];
        s.total++;
        if (msg.status === 'delivered') s.delivered++;
        else if (msg.status === 'sent') s.sent++;
        else if (msg.status === 'pending' || msg.status === 'sending') s.pending++;
        else if (msg.status === 'failed') s.failed++;
        else if (msg.status === 'paused') s.paused++;
      }
    });

    return stats;
  }, [campaigns, outboxMessages]);

  // Selected Campaign Object
  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Filtered Outbox Messages
  const filteredMessages = useMemo(() => {
    return outboxMessages.filter((msg) => {
      const matchesCampaign = !selectedCampaignId || msg.campaign_id === selectedCampaignId;
      const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;
      const matchesSearch =
        msg.phone.includes(search) ||
        msg.message.toLowerCase().includes(search.toLowerCase());
      return matchesCampaign && matchesStatus && matchesSearch;
    });
  }, [outboxMessages, selectedCampaignId, statusFilter, search]);

  // Pause Campaign: set outbox pending -> 'paused'
  const handlePauseCampaign = async () => {
    if (!selectedCampaignId) return;
    setIsActionLoading(true);
    try {
      const { error: outboxErr } = await supabase
        .from('outbox')
        .update({ status: 'paused' })
        .eq('campaign_id', selectedCampaignId)
        .eq('status', 'pending');

      const { error: campErr } = await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', selectedCampaignId);

      if (outboxErr || campErr) {
        showToast(outboxErr?.message || campErr?.message || 'Error pausing campaign', 'error');
      } else {
        showToast('Campaign paused', 'success');
        await loadData();
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // Resume Campaign: set outbox paused -> 'pending'
  const handleResumeCampaign = async () => {
    if (!selectedCampaignId) return;
    setIsActionLoading(true);
    try {
      const { error: outboxErr } = await supabase
        .from('outbox')
        .update({ status: 'pending' })
        .eq('campaign_id', selectedCampaignId)
        .eq('status', 'paused');

      const { error: campErr } = await supabase
        .from('campaigns')
        .update({ status: 'queued' })
        .eq('id', selectedCampaignId);

      if (outboxErr || campErr) {
        showToast(outboxErr?.message || campErr?.message || 'Error resuming campaign', 'error');
      } else {
        showToast('Campaign resumed and pending messages queued', 'success');
        await loadData();
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // Retry Failed: set failed -> 'pending' and clear error
  const handleRetryFailed = async () => {
    setIsActionLoading(true);
    try {
      let query = supabase
        .from('outbox')
        .update({ status: 'pending', error: null, attempts: 0 })
        .eq('status', 'failed');

      if (selectedCampaignId) {
        query = query.eq('campaign_id', selectedCampaignId);
      }

      const { error } = await query;
      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('Failed messages requeued to pending', 'success');
        await loadData();
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // Cancel Pending: delete pending and paused rows
  const handleCancelPending = async () => {
    setIsActionLoading(true);
    try {
      let query = supabase.from('outbox').delete().in('status', ['pending', 'paused']);
      if (selectedCampaignId) {
        query = query.eq('campaign_id', selectedCampaignId);
      }

      const { error } = await query;
      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('Pending messages cancelled and removed from queue', 'success');
        setIsCancelPendingModalOpen(false);
        await loadData();
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // Export report to CSV
  const handleExportReport = () => {
    const rowsToExport = filteredMessages.map((m) => ({
      Phone: m.phone,
      Message: m.message,
      Status: m.status,
      Attempts: m.attempts,
      Error: m.error || '',
      Created_At: m.created_at,
      Sent_At: m.sent_at || '',
      Delivered_At: m.delivered_at || '',
    }));

    const csvContent = Papa.unparse(rowsToExport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const namePrefix = activeCampaign ? activeCampaign.title.replace(/\s+/g, '_') : 'outbox_report';
    link.setAttribute('download', `${namePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge Helper
  const renderStatusBadge = (status: OutboxStatus) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCheck className="w-3 h-3" />
            <span>{t('statusDelivered')}</span>
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Send className="w-3 h-3" />
            <span>{t('statusSent')}</span>
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-cyan-50 text-cyan-800 border border-cyan-200">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            <span>{t('statusSending')}</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>{t('statusPending')}</span>
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-300">
            <Pause className="w-3 h-3" />
            <span>{t('statusPaused')}</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            <span>{t('statusFailed')}</span>
          </span>
        );
      default:
        return <span className="text-neutral-500 font-mono text-[11px]">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
          {t('campaignsTitle')}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {t('campaignsSubtitle')}
        </p>
      </div>

      {/* Campaigns Progress Section */}
      <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-neutral-900">
              {t('allCampaignsHeader')} ({campaigns.length})
            </h3>
          </div>

          {selectedCampaignId && (
            <button
              onClick={() => setSelectedCampaignId(null)}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Show All Outbox Messages
            </button>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className="py-8 text-center text-neutral-500 text-xs">
            <MessageSquareText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-medium">{t('emptyCampaignsTitle')}</p>
            <p className="text-neutral-400 text-[11px] mt-0.5">{t('emptyCampaignsSubtitle')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {campaigns.map((camp) => {
              const st = campaignStats[camp.id] || { total: camp.total, delivered: 0, sent: 0, pending: 0, failed: 0, paused: 0 };
              const doneCount = st.delivered + st.sent;
              const effectiveTotal = Math.max(camp.total, st.total, 1);
              const progressPct = Math.min(100, Math.round((doneCount / effectiveTotal) * 100));
              const isSelected = selectedCampaignId === camp.id;

              return (
                <div
                  key={camp.id}
                  onClick={() => setSelectedCampaignId(isSelected ? null : camp.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-neutral-900 line-clamp-1">
                      {camp.title}
                    </h4>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                      ['queued', 'running', 'sending', 'pending'].includes(String(camp.status))
                        ? 'bg-emerald-100 text-emerald-800'
                        : camp.status === 'paused'
                        ? 'bg-neutral-200 text-neutral-700'
                        : camp.status === 'done' || camp.status === 'completed'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {camp.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1 font-sans">
                    {camp.template_body}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-600">
                      <span>{doneCount} / {effectiveTotal} sent</span>
                      <span className="font-semibold text-emerald-700">{progressPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Badges footer */}
                  <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                    <span className="text-emerald-700 font-medium">Delivered: {st.delivered}</span>
                    <span className="text-amber-700 font-medium">Pending: {st.pending + st.paused}</span>
                    <span className="text-rose-700 font-medium">Failed: {st.failed}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Outbox Realtime Messages Table & Action Controls */}
      <div className="bg-white rounded-xl border border-neutral-200/90 shadow-2xs overflow-hidden space-y-3 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">
                {t('outboxMessagesHeader')}
              </h3>
              {activeCampaign && (
                <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                  {activeCampaign.title}
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Showing {filteredMessages.length} messages (realtime queue updates)
            </p>
          </div>

          {/* Action buttons: Pause, Resume, Retry Failed, Cancel Pending, Export */}
          <div className="flex flex-wrap items-center gap-2">
            {selectedCampaignId && ['queued', 'running', 'sending', 'pending'].includes(String(activeCampaign?.status)) && (
              <button
                onClick={handlePauseCampaign}
                disabled={isActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>{t('pauseCampaignBtn')}</span>
              </button>
            )}

            {selectedCampaignId && activeCampaign?.status === 'paused' && (
              <button
                onClick={handleResumeCampaign}
                disabled={isActionLoading}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('resumeCampaignBtn')}</span>
              </button>
            )}

            <button
              onClick={handleRetryFailed}
              disabled={isActionLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('retryFailedBtn')}</span>
            </button>

            <button
              onClick={() => setIsCancelPendingModalOpen(true)}
              disabled={isActionLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('cancelPendingBtn')}</span>
            </button>

            <button
              onClick={handleExportReport}
              disabled={filteredMessages.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('exportReportBtn')}</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Search Phone or Message */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchOutboxPlaceholder')}
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-50/70 border border-neutral-200 rounded-lg text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Status Segmented Filter */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-0.5 bg-neutral-100 rounded-lg border border-neutral-200 text-xs">
            {['all', 'pending', 'sending', 'sent', 'delivered', 'failed', 'paused'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Realtime Messages Table */}
        <div className="border border-neutral-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                <th className="py-2.5 px-3">{t('colPhone')}</th>
                <th className="py-2.5 px-3">{t('colMessage')}</th>
                <th className="py-2.5 px-3">{t('colStatus')}</th>
                <th className="py-2.5 px-3">{t('colAttempts')}</th>
                <th className="py-2.5 px-3">{t('colError')}</th>
                <th className="py-2.5 px-3">{t('colTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-500">
                    {t('emptyOutboxTitle')}
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-neutral-50/80 transition-colors">
                    {/* Phone */}
                    <td className="py-2.5 px-3 font-mono tabular-nums font-medium text-neutral-900 whitespace-nowrap">
                      {msg.phone}
                    </td>

                    {/* Message Body */}
                    <td className="py-2.5 px-3 text-neutral-700 max-w-xs sm:max-w-md truncate font-sans" title={msg.message}>
                      {msg.message}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {renderStatusBadge(msg.status)}
                    </td>

                    {/* Attempts */}
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-600">
                      {msg.attempts}
                    </td>

                    {/* Error */}
                    <td className="py-2.5 px-3 text-rose-600 text-[11px] max-w-[150px] truncate" title={msg.error || ''}>
                      {msg.error || '—'}
                    </td>

                    {/* Time */}
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-400 text-[11px] whitespace-nowrap">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Pending Confirm Modal */}
      <ConfirmModal
        isOpen={isCancelPendingModalOpen}
        title={t('confirmCancelPendingTitle')}
        message={t('confirmCancelPendingMsg')}
        confirmLabel={t('cancelPendingBtn')}
        cancelLabel={t('cancelBtn')}
        isDestructive={true}
        isLoading={isActionLoading}
        onConfirm={handleCancelPending}
        onCancel={() => setIsCancelPendingModalOpen(false)}
      />
    </div>
  );
};
