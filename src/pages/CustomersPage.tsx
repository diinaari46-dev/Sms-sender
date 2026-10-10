import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  ArrowUpDown,
  Filter,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Customer } from '../types/models';
import { normalizeSomaliPhone } from '../lib/phone';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ConfirmModal } from '../components/ConfirmModal';

export const CustomersPage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOwingOnly, setFilterOwingOnly] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'phone' | 'balance'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Customer Add/Edit Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerBalance, setCustomerBalance] = useState('0');
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Inline Balance Editing
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineBalanceValue, setInlineBalanceValue] = useState('');

  // Delete Modals
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import CSV/Excel Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<Array<{ name: string; phone: string; balance: number; rawPhone: string; isValid: boolean }>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        showToast(error.message, 'error');
      } else if (data) {
        setCustomers(data as Customer[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();

    const channel = supabase
      .channel('customers_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        loadCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter & Sort
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        const matchesSearch =
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search);
        const matchesOwing = !filterOwingOnly || Number(c.balance) > 0;
        return matchesSearch && matchesOwing;
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortField === 'balance') {
          return (Number(a.balance) - Number(b.balance)) * dir;
        }
        if (sortField === 'phone') {
          return a.phone.localeCompare(b.phone) * dir;
        }
        return a.name.localeCompare(b.name) * dir;
      });
  }, [customers, search, filterOwingOnly, sortField, sortAsc]);

  const handleSort = (field: 'name' | 'phone' | 'balance') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Selection logic
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredCustomers.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Add / Edit Modal Open
  const openAddModal = () => {
    setEditingCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerBalance('0');
    setModalError(null);
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setCustomerBalance(String(c.balance));
    setModalError(null);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const norm = normalizeSomaliPhone(customerPhone);
    if (!norm.isValid) {
      setModalError(t('errInvalidPhone'));
      return;
    }

    const balanceNum = parseFloat(customerBalance) || 0;
    setSavingCustomer(true);

    try {
      if (editingCustomer) {
        // Update
        const { error } = await supabase
          .from('customers')
          .update({
            name: customerName.trim(),
            phone: norm.normalized,
            balance: balanceNum,
          })
          .eq('id', editingCustomer.id);

        if (error) {
          setModalError(error.message);
          return;
        }
      } else {
        // Insert (Never send user_id manually; DB sets it)
        const { error } = await supabase.from('customers').insert([
          {
            name: customerName.trim(),
            phone: norm.normalized,
            balance: balanceNum,
          },
        ]);

        if (error) {
          setModalError(error.message);
          return;
        }
      }

      showToast(t('customerSavedToast'), 'success');
      setIsCustomerModalOpen(false);
      await loadCustomers();
    } finally {
      setSavingCustomer(false);
    }
  };

  // Inline balance edit
  const startInlineEdit = (c: Customer) => {
    setInlineEditingId(c.id);
    setInlineBalanceValue(String(c.balance));
  };

  const saveInlineBalance = async (id: string) => {
    const nextVal = parseFloat(inlineBalanceValue);
    if (isNaN(nextVal) || nextVal < 0) {
      setInlineEditingId(null);
      return;
    }

    const { error } = await supabase
      .from('customers')
      .update({ balance: nextVal })
      .eq('id', id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(t('balanceUpdatedToast'), 'success');
      setCustomers((prev) =>
        prev.map((c) => (c.id === id ? { ...c, balance: nextVal } : c))
      );
    }
    setInlineEditingId(null);
  };

  // Delete single
  const handleDeleteCustomer = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast(t('customerDeletedToast'), 'success');
        setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('customers')
        .delete()
        .in('id', idsArray);

      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast(t('customerDeletedToast'), 'success');
        setCustomers((prev) => prev.filter((c) => !selectedIds.has(c.id)));
        setSelectedIds(new Set());
      }
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const csvContent = Papa.unparse(
      customers.map((c) => ({
        name: c.name,
        phone: c.phone,
        balance: c.balance,
      }))
    );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV / Excel File Upload & Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    const processRows = (rawRows: any[]) => {
      const parsed = rawRows
        .filter((row) => row && typeof row === 'object')
        .map((row) => {
          // Normalize column headers (case-insensitive)
          const keys = Object.keys(row);
          const nameKey = keys.find((k) => /name|magac/i.test(k)) || keys[0] || 'name';
          const phoneKey = keys.find((k) => /phone|tel|tele|number|lambar/i.test(k)) || keys[1] || 'phone';
          const balanceKey = keys.find((k) => /balance|amount|deyn|lacag/i.test(k)) || keys[2] || 'balance';

          const rawName = String(row[nameKey] || '').trim();
          const rawPhone = String(row[phoneKey] || '').trim();
          const rawBalance = parseFloat(row[balanceKey]) || 0;

          const norm = normalizeSomaliPhone(rawPhone);
          return {
            name: rawName || 'Macmiil',
            phone: norm.isValid ? norm.normalized : rawPhone,
            rawPhone,
            balance: rawBalance,
            isValid: norm.isValid,
          };
        });

      // Deduplicate rows within the imported file by phone (taking the last occurrence)
      const phoneMap = new Map<string, typeof parsed[0]>();
      parsed.forEach((p) => {
        if (p.isValid) {
          phoneMap.set(p.phone, p);
        } else {
          // Keep invalid rows for preview error reporting
          phoneMap.set(`invalid_${Math.random()}`, p);
        }
      });

      setImportPreviewData(Array.from(phoneMap.values()));
      setIsImportModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processRows(results.data);
        },
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processRows(data);
      };
      reader.readAsBinaryString(file);
    } else {
      showToast('Please upload a valid .csv, .xlsx, or .xls file', 'error');
    }
  };

  // Confirm Import & Upsert
  const handleConfirmImport = async () => {
    const validRows = importPreviewData.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    try {
      // Upsert into customers table on conflict (phone, user_id)
      const rowsToInsert = validRows.map((r) => ({
        name: r.name,
        phone: r.phone,
        balance: r.balance,
      }));

      const { error } = await supabase
        .from('customers')
        .upsert(rowsToInsert, { onConflict: 'phone' });

      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast(t('importSuccessToast'), 'success');
        setIsImportModalOpen(false);
        await loadCustomers();
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            {t('customersTitle')}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t('customersSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-200 shadow-2xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t('importCsvBtn')}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={customers.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-200 shadow-2xs transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t('exportCsvBtn')}</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addCustomerBtn')}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="bg-white rounded-xl border border-neutral-200/90 p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchCustomersPlaceholder')}
            className="w-full pl-9 pr-3 py-1.5 bg-neutral-50/70 border border-neutral-200 rounded-lg text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filters & Bulk Delete */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2.5">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('bulkDeleteBtn')} ({selectedIds.size})</span>
            </button>
          )}

          {/* Balance > 0 Toggle */}
          <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 text-xs">
            <button
              onClick={() => setFilterOwingOnly(false)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                !filterOwingOnly
                  ? 'bg-white text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t('filterAllCustomers')}
            </button>
            <button
              onClick={() => setFilterOwingOnly(true)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                filterOwingOnly
                  ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {t('filterOwingOnly')}
            </button>
          </div>
        </div>
      </div>

      {/* Customers Data Table */}
      <div className="bg-white rounded-xl border border-neutral-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredCustomers.length > 0 &&
                      selectedIds.size === filteredCustomers.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 font-semibold text-neutral-800 cursor-pointer hover:bg-neutral-100/60 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{t('colName')}</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('phone')}
                  className="py-3 px-4 font-semibold text-neutral-800 cursor-pointer hover:bg-neutral-100/60 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{t('colPhone')}</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('balance')}
                  className="py-3 px-4 font-semibold text-neutral-800 text-right cursor-pointer hover:bg-neutral-100/60 select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{t('colBalance')}</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold text-neutral-800 text-right w-24">
                  {t('colActions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="max-w-xs mx-auto">
                      <Users className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="font-semibold text-neutral-700">{t('emptyCustomersTitle')}</p>
                      <p className="text-neutral-500 text-[11px] mt-1">{t('emptyCustomersSubtitle')}</p>
                      <button
                        onClick={openAddModal}
                        className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-2xs transition-colors"
                      >
                        {t('addCustomerBtn')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  const isEditingInline = inlineEditingId === c.id;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-neutral-50/70 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(c.id)}
                          className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-medium text-neutral-900">
                        {c.name}
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono tabular-nums text-neutral-700">
                        {c.phone}
                      </td>

                      {/* Balance (with inline edit) */}
                      <td className="py-3 px-4 text-right">
                        {isEditingInline ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-neutral-400 font-mono">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={inlineBalanceValue}
                              onChange={(e) => setInlineBalanceValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveInlineBalance(c.id);
                                if (e.key === 'Escape') setInlineEditingId(null);
                              }}
                              autoFocus
                              className="w-20 px-1.5 py-0.5 text-right font-mono tabular-nums text-xs border border-emerald-500 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              onClick={() => saveInlineBalance(c.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Save balance"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setInlineEditingId(null)}
                              className="p-1 text-neutral-400 hover:bg-neutral-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => startInlineEdit(c)}
                            className="group inline-flex items-center gap-1.5 cursor-pointer px-1.5 py-0.5 rounded hover:bg-neutral-100 transition-colors"
                            title={t('inlineBalanceHint')}
                          >
                            <span className={`font-mono tabular-nums font-semibold ${
                              Number(c.balance) > 0 ? 'text-emerald-700' : 'text-neutral-500'
                            }`}>
                              ${Number(c.balance).toFixed(2)}
                            </span>
                            <Edit2 className="w-3 h-3 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                            title={t('editBtn')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title={t('deleteBtn')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 max-w-md w-full p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">
                {editingCustomer ? t('editCustomerTitle') : t('addCustomerTitle')}
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-3.5">
              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {modalError}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  {t('customerNameLabel')}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('customerNamePlaceholder')}
                  required
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  {t('colPhone')}
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="61xxxxxxx or +25261xxxxxxx"
                  required
                  className="w-full px-3 py-2 font-mono tabular-nums text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[11px] text-neutral-500 mt-1 block">
                  {t('phoneHelper')}
                </span>
              </div>

              {/* Balance */}
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  {t('customerBalanceLabel')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-neutral-400 font-mono text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customerBalance}
                    onChange={(e) => setCustomerBalance(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 font-mono tabular-nums text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingCustomer && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>{t('saveBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-neutral-200 max-w-2xl w-full p-5 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-semibold text-neutral-900">{t('importPreviewTitle')}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{t('importModalSubtitle')}</p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Counts breakdown */}
            <div className="my-3 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('importValidRows')}: {importPreviewData.filter((r) => r.isValid).length}</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{t('importInvalidRows')}: {importPreviewData.filter((r) => !r.isValid).length}</span>
              </span>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-y-auto border border-neutral-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">{t('colName')}</th>
                    <th className="py-2 px-3">{t('colPhone')}</th>
                    <th className="py-2 px-3 text-right">{t('colBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {importPreviewData.map((row, idx) => (
                    <tr key={idx} className={row.isValid ? '' : 'bg-rose-50/50'}>
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Valid
                          </span>
                        ) : (
                          <span className="text-[10px] text-rose-700 font-medium bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Invalid Phone
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-medium text-neutral-900">{row.name}</td>
                      <td className="py-2 px-3 font-mono tabular-nums text-neutral-700">
                        {row.isValid ? row.phone : `${row.rawPhone} (Err)`}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-neutral-800">
                        ${Number(row.balance).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                {t('cancelBtn')}
              </button>
              <button
                type="button"
                disabled={isImporting || importPreviewData.filter((r) => r.isValid).length === 0}
                onClick={handleConfirmImport}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isImporting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <span>{t('importConfirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title={t('confirmDeleteCustomerTitle')}
        message={t('confirmDeleteCustomerMsg')}
        confirmLabel={t('deleteBtn')}
        cancelLabel={t('cancelBtn')}
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteCustomer}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Bulk Delete Confirm Modal */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        title={t('confirmBulkDeleteTitle')}
        message={t('confirmBulkDeleteMsg')}
        confirmLabel={t('deleteBtn')}
        cancelLabel={t('cancelBtn')}
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
};
