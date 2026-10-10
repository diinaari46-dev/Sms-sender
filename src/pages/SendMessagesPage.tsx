import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  MessageSquare,
  Eye,
  Send,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Search,
  Filter,
  Save,
  Bookmark,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Customer, Template, GatewayConfig, PageRoute } from '../types/models';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';

interface SendMessagesPageProps {
  onNavigate: (page: PageRoute) => void;
}

export const SendMessagesPage: React.FC<SendMessagesPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Customers data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState('');
  const [filterOwingOnly, setFilterOwingOnly] = useState(true); // Default to owing only as owners want to remind debtors!

  // Templates & Composition
  const [campaignTitle, setCampaignTitle] = useState('');
  const [templateBody, setTemplateBody] = useState(
    'Salaan {name}, waxaa kugu leeyahay {amount}. Fadlan bixi {amount} adigoo mahadsan. - {company}'
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Gateway Settings for ETA calculation & company name
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);

  // Customized preview messages per customer (customerId -> custom string)
  const [customizedMessages, setCustomizedMessages] = useState<Record<string, string>>({});

  // Sending state & confirm modal
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    // Generate default campaign title
    const todayStr = new Date().toLocaleDateString('so-SO', { month: 'short', day: 'numeric' });
    setCampaignTitle(`Xasuusin Deyn - ${todayStr}`);

    // Load customers
    supabase
      .from('customers')
      .select('*')
      .order('balance', { ascending: false })
      .then(({ data }) => {
        if (data) {
          const list = data as Customer[];
          setCustomers(list);
          // Auto-select customers who have balance > 0 by default
          const debtors = list.filter((c) => Number(c.balance) > 0).map((c) => c.id);
          setSelectedIds(new Set(debtors));
        }
      });

    // Load saved templates
    loadTemplates();

    // Load gateway config
    supabase
      .from('gateway')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setGatewayConfig(data as GatewayConfig);
        }
      });
  }, []);

  const loadTemplates = async () => {
    const { data } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
    if (data) {
      setTemplates(data as Template[]);
    }
  };

  // Filtered customer list for selection in Step 1
  const selectableCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch);
      const matchesOwing = !filterOwingOnly || Number(c.balance) > 0;
      return matchesSearch && matchesOwing;
    });
  }, [customers, customerSearch, filterOwingOnly]);

  // Selected customer objects
  const selectedCustomers = useMemo(() => {
    return customers.filter((c) => selectedIds.has(c.id));
  }, [customers, selectedIds]);

  const totalSelectedBalance = useMemo(() => {
    return selectedCustomers.reduce((acc, c) => acc + (Number(c.balance) || 0), 0);
  }, [selectedCustomers]);

  // Selection toggles
  const handleToggleCustomer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const next = new Set(selectedIds);
      selectableCustomers.forEach((c) => next.add(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      selectableCustomers.forEach((c) => next.delete(c.id));
      setSelectedIds(next);
    }
  };

  // Insert variable tokens into textarea at cursor
  const handleInsertVariable = (token: '{name}' | '{amount}' | '{company}') => {
    if (!textareaRef.current) {
      setTemplateBody((prev) => prev + token);
      return;
    }
    const elem = textareaRef.current;
    const start = elem.selectionStart;
    const end = elem.selectionEnd;
    const text = templateBody;
    const nextText = text.substring(0, start) + token + text.substring(end);
    setTemplateBody(nextText);
    setTimeout(() => {
      elem.focus();
      elem.setSelectionRange(start + token.length, start + token.length);
    }, 10);
  };

  // SMS length metrics
  const charCount = templateBody.length;
  const smsParts = Math.max(1, Math.ceil(charCount / 160));

  // Save template
  const handleSaveTemplate = async () => {
    if (!newTemplateTitle.trim() || !templateBody.trim()) return;
    setIsSavingTemplate(true);
    try {
      const { error } = await supabase.from('templates').insert([
        {
          title: newTemplateTitle.trim(),
          body: templateBody,
        },
      ]);
      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('Template saved successfully', 'success');
        setNewTemplateTitle('');
        await loadTemplates();
      }
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (!error) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      showToast('Template deleted', 'success');
    }
  };

  // Personalized message resolver (replaces {name}, {amount}, and {company})
  const getPersonalizedMessage = (customer: Customer): string => {
    if (customizedMessages[customer.id] !== undefined) {
      return customizedMessages[customer.id];
    }
    const amountStr = `$${Number(customer.balance).toFixed(2)}`;
    const companyStr = gatewayConfig?.company_name?.trim() || '{company}';
    return templateBody
      .replace(/\{name\}/g, customer.name)
      .replace(/\{amount\}/g, amountStr)
      .replace(/\{company\}/g, companyStr);
  };

  const handleEditPreviewMessage = (customerId: string, val: string) => {
    setCustomizedMessages((prev) => ({
      ...prev,
      [customerId]: val,
    }));
  };

  const handleResetPreviewMessage = (customerId: string) => {
    setCustomizedMessages((prev) => {
      const next = { ...prev };
      delete next[customerId];
      return next;
    });
  };

  // Estimated Duration Calculation
  const estimatedSeconds = useMemo(() => {
    const count = selectedCustomers.length;
    if (count === 0) return 0;
    const minD = gatewayConfig?.min_delay_ms ?? 3000;
    const maxD = gatewayConfig?.max_delay_ms ?? 7000;
    const avgDelayMs = (minD + maxD) / 2;
    return Math.round((count * avgDelayMs) / 1000);
  }, [selectedCustomers.length, gatewayConfig]);

  const formattedDuration = useMemo(() => {
    if (estimatedSeconds < 60) {
      return `${estimatedSeconds} seconds`;
    }
    const mins = Math.floor(estimatedSeconds / 60);
    const secs = estimatedSeconds % 60;
    return `${mins} min ${secs > 0 ? `${secs}s` : ''}`;
  }, [estimatedSeconds]);

  // Submit and Queue messages via database RPC
  const handleConfirmSend = async () => {
    if (selectedCustomers.length === 0) {
      showToast(t('noCustomersSelectedErr'), 'error');
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      const cleanTitle = campaignTitle.trim() || `Ololaha ${new Date().toLocaleDateString()}`;
      const customerIds = selectedCustomers.map((c) => c.id);

      // Call database RPC: send_campaign(p_title, p_template, p_customer_ids)
      const { data, error } = await supabase.rpc('send_campaign', {
        p_title: cleanTitle,
        p_template: templateBody,
        p_customer_ids: customerIds,
      });

      if (error) {
        console.error('send_campaign RPC error:', error);
        // If send_campaign does not exist in DB, fallback to create_campaign(p_title, p_template, p_min_balance)
        if (
          error.message &&
          (error.message.includes('send_campaign') && (error.message.includes('does not exist') || error.message.includes('not found')))
        ) {
          const minBalance = Math.min(...selectedCustomers.map((c) => Number(c.balance) || 0));
          const { error: fallbackErr } = await supabase.rpc('create_campaign', {
            p_title: cleanTitle,
            p_template: templateBody,
            p_min_balance: isNaN(minBalance) ? 0 : minBalance,
          });

          if (fallbackErr) {
            // Show real error message from Supabase
            const msg = fallbackErr.message || JSON.stringify(fallbackErr);
            setSendError(msg);
            showToast(msg, 'error');
            return;
          }
        } else {
          // Show real error message from Supabase
          const msg = error.message || JSON.stringify(error);
          setSendError(msg);
          showToast(msg, 'error');
          return;
        }
      }

      showToast(t('messagesQueuedToast'), 'success');
      setIsConfirmSendOpen(false);
      onNavigate('campaigns');
    } catch (err: any) {
      const msg = err?.message || JSON.stringify(err);
      setSendError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
          {t('sendTitle')}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {t('sendSubtitle')}
        </p>
      </div>

      {/* 3-Step Wizard Navigation */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-100 rounded-xl border border-neutral-200/80">
        <button
          onClick={() => setStep(1)}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            step === 1
              ? 'bg-white text-emerald-800 shadow-2xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="truncate">{t('step1Label')}</span>
        </button>

        <button
          onClick={() => {
            if (selectedCustomers.length === 0) {
              showToast(t('noCustomersSelectedErr'), 'error');
              return;
            }
            setStep(2);
          }}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            step === 2
              ? 'bg-white text-emerald-800 shadow-2xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="truncate">{t('step2Label')}</span>
        </button>

        <button
          onClick={() => {
            if (selectedCustomers.length === 0) {
              showToast(t('noCustomersSelectedErr'), 'error');
              return;
            }
            setStep(3);
          }}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            step === 3
              ? 'bg-white text-emerald-800 shadow-2xs'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="truncate">{t('step3Label')}</span>
        </button>
      </div>

      {/* STEP 1: Select Customers */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Controls Bar */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder={t('searchCustomersPlaceholder')}
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-50/70 border border-neutral-200 rounded-lg text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 text-xs">
                <button
                  onClick={() => setFilterOwingOnly(false)}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    !filterOwingOnly ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600'
                  }`}
                >
                  {t('filterAllCustomers')}
                </button>
                <button
                  onClick={() => setFilterOwingOnly(true)}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    filterOwingOnly ? 'bg-emerald-600 text-white shadow-2xs font-semibold' : 'text-neutral-600'
                  }`}
                >
                  {t('filterOwingOnly')}
                </button>
              </div>

              {/* Next Step CTA */}
              <button
                onClick={() => {
                  if (selectedCustomers.length === 0) {
                    showToast(t('noCustomersSelectedErr'), 'error');
                    return;
                  }
                  setStep(2);
                }}
                disabled={selectedCustomers.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
              >
                <span>{t('nextStepBtn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Selection Stats Strip */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t('selectedCountLabel')}:</span>
              <span className="font-mono tabular-nums font-bold text-sm bg-white px-2 py-0.5 rounded border border-emerald-200">
                {selectedCustomers.length} / {customers.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">{t('totalSelectedBalance')}:</span>
              <span className="font-mono tabular-nums font-bold text-emerald-800 text-sm">
                ${totalSelectedBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-neutral-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-neutral-50/90 backdrop-blur-xs border-b border-neutral-200 z-10">
                  <tr className="text-neutral-600">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectableCustomers.length > 0 &&
                          selectableCustomers.every((c) => selectedIds.has(c.id))
                        }
                        onChange={handleSelectAllVisible}
                        className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4 font-semibold text-neutral-800">{t('colName')}</th>
                    <th className="py-3 px-4 font-semibold text-neutral-800">{t('colPhone')}</th>
                    <th className="py-3 px-4 font-semibold text-neutral-800 text-right">{t('colBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {selectableCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-neutral-500">
                        {t('emptyCustomersTitle')}
                      </td>
                    </tr>
                  ) : (
                    selectableCustomers.map((c) => {
                      const isSelected = selectedIds.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleToggleCustomer(c.id)}
                          className={`cursor-pointer hover:bg-neutral-50 transition-colors ${
                            isSelected ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleCustomer(c.id)}
                              className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-medium text-neutral-900">{c.name}</td>
                          <td className="py-3 px-4 font-mono tabular-nums text-neutral-600">{c.phone}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-neutral-900">
                            ${Number(c.balance).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Template Editor */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Warning Banner if company_name is empty */}
          {!gatewayConfig?.company_name?.trim() && (
            <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <p className="text-xs font-bold leading-tight">{t('companyWarningTitle')}</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">{t('companyWarningDesc')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 shadow-2xs transition-colors shrink-0"
              >
                {t('setCompanyNowBtn')} →
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Template Editor */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs space-y-4">
                {/* Campaign Title */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
                    {t('campaignTitleLabel')}
                  </label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder={t('campaignTitlePlaceholder')}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Template Body Textarea with Insert Variable buttons */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-neutral-800">
                      {t('templateBodyLabel')}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('{name}')}
                        className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        {t('insertNameBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('{amount}')}
                        className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        {t('insertAmountBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertVariable('{company}')}
                        className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      >
                        {t('insertCompanyBtn')}
                      </button>
                    </div>
                  </div>

                <textarea
                  ref={textareaRef}
                  rows={5}
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  className="w-full p-3 text-xs leading-relaxed border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-sans"
                />

                {/* Character & SMS parts counter */}
                <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
                  <span>
                    {t('charCountLabel')}: <strong className="text-neutral-800">{charCount}</strong>
                  </span>
                  <span>
                    {t('smsPartsLabel')}: <strong className="text-emerald-700">{smsParts}</strong>
                  </span>
                </div>
              </div>

              {/* Bottom Nav Buttons */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t('prevStepBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!templateBody.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                >
                  <span>{t('nextStepBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Saved Templates Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-2 text-neutral-800 font-semibold text-xs border-b border-neutral-100 pb-2">
                <Bookmark className="w-4 h-4 text-emerald-600" />
                <span>{t('savedTemplatesTitle')}</span>
              </div>

              {/* Save current as new template */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder={t('templateTitlePlaceholder')}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={!newTemplateTitle.trim() || isSavingTemplate}
                  className="w-full py-1.5 px-3 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('saveTemplateBtn')}</span>
                </button>
              </div>

              {/* List of saved templates */}
              <div className="space-y-2 max-h-72 overflow-y-auto pt-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-2.5 rounded-lg border border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-neutral-900 truncate">
                        {tpl.title}
                      </h4>
                      <button
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="text-neutral-400 hover:text-rose-600 p-0.5"
                        title="Delete template"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-600 line-clamp-2 leading-tight font-sans">
                      {tpl.body}
                    </p>
                    <button
                      type="button"
                      onClick={() => setTemplateBody(tpl.body)}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      {t('loadTemplateBtn')} →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* STEP 3: Live Preview & Send */}
      {step === 3 && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Warning Banner if company_name is empty */}
          {!gatewayConfig?.company_name?.trim() && (
            <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start sm:items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <p className="text-xs font-bold leading-tight">{t('companyWarningTitle')}</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">{t('companyWarningDesc')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="self-start sm:self-center px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 shadow-2xs transition-colors shrink-0"
              >
                {t('setCompanyNowBtn')} →
              </button>
            </div>
          )}

          {/* Dispatch Summary Card */}
          <div className="bg-emerald-950 text-emerald-50 rounded-xl p-4.5 border border-emerald-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                {campaignTitle}
              </span>
              <h3 className="text-base font-semibold text-white mt-0.5">
                {selectedCustomers.length} {t('selectedCountLabel')} · Total ${totalSelectedBalance.toFixed(2)}
              </h3>
              <p className="text-xs text-emerald-200 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {t('estimatedDurationLabel')}: <strong>{formattedDuration}</strong> ({t('avgDelayInfo')})
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-3.5 py-2 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
              >
                {t('prevStepBtn')}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmSendOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{t('sendNowBtn')}</span>
              </button>
            </div>
          </div>

          {/* List of personalized message previews (editable) */}
          <div className="bg-white rounded-xl border border-neutral-200/90 p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                {t('previewSectionTitle')}
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                {t('previewSectionSubtitle')}
              </p>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {selectedCustomers.map((c) => {
                const isCustom = customizedMessages[c.id] !== undefined;
                const messageText = getPersonalizedMessage(c);

                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2 hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{c.name}</span>
                        <span className="text-neutral-400">·</span>
                        <span className="font-mono tabular-nums text-neutral-600">{c.phone}</span>
                        <span className="text-neutral-400">·</span>
                        <span className="font-mono tabular-nums font-semibold text-emerald-700">
                          ${Number(c.balance).toFixed(2)}
                        </span>
                      </div>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleResetPreviewMessage(c.id)}
                          className="text-[11px] text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{t('resetMessageBtn')}</span>
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      value={messageText}
                      onChange={(e) => handleEditPreviewMessage(c.id, e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Send Modal */}
      <ConfirmModal
        isOpen={isConfirmSendOpen}
        title={t('confirmSendTitle')}
        message={`${t('confirmSendMsg')} (${selectedCustomers.length} messages, ${formattedDuration})`}
        confirmLabel={t('sendNowBtn')}
        cancelLabel={t('cancelBtn')}
        isDestructive={false}
        isLoading={isSending}
        errorMessage={sendError}
        onConfirm={handleConfirmSend}
        onCancel={() => {
          setIsConfirmSendOpen(false);
          setSendError(null);
        }}
      />
    </div>
  );
};
