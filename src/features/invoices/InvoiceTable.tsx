import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Eye,
  Edit2,
  Copy,
  Trash2,
  Download,
  MoreVertical,
  MoreHorizontal,
  CheckCircle,
  Clock,
  Send,
  AlertCircle,
  ExternalLink,
  Link as LinkIcon,
  Lock,
  CreditCard,
  Repeat,
  Receipt,
  XCircle,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BellRing,
} from 'lucide-react';
import { Invoice, InvoiceStatus } from '../../types';
import { calculateTotals } from '../../lib/calculateTotals';
import { formatCurrency } from '../../lib/formatCurrency';
import { formatDate, formatRelativeTime, getEffectiveStatus, getTodayDateString } from '../../lib/dates';
import { exportInvoicesToCSV } from '../../lib/exportUtils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { InvoiceViewModal } from './InvoiceViewModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { CreateRecurringModal } from './CreateRecurringModal';
import { ExportInvoicesModal } from './ExportInvoicesModal';
import { SendInvoiceModal } from './SendInvoiceModal';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import { useToast } from '../../components/ui/Toast';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useUiStore } from '../../store/uiStore';

interface InvoiceTableProps {
  invoices: Invoice[];
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
}

type FilterStatus = 'all' | InvoiceStatus;

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  onDuplicate,
  onDelete,
  onStatusChange,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { hasFeature } = useSubscriptionStore();
  const { openModal } = useUiStore();
  const canUsePaymentPortal = hasFeature('payment_portal');

  const urlStatus = searchParams.get('status') as FilterStatus | null;
  const validStatuses: FilterStatus[] = ['all', 'draft', 'sent', 'paid', 'overdue', 'partially_paid', 'cancelled'];
  const initialFilter: FilterStatus = urlStatus && validStatuses.includes(urlStatus) ? urlStatus : 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>(initialFilter);
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_30_days'>('all');
  const [sortBy, setSortBy] = useState<'issueDate' | 'dueDate' | 'amount' | 'client'>('issueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [viewModalTab, setViewModalTab] = useState<'document' | 'payments'>('document');
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [recurringModalInvoice, setRecurringModalInvoice] = useState<Invoice | null>(null);
  const [sendModalInvoice, setSendModalInvoice] = useState<Invoice | null>(null);
  const [sendModalMode, setSendModalMode] = useState<'send' | 'reminder'>('send');

  useEffect(() => {
    if (urlStatus && validStatuses.includes(urlStatus) && urlStatus !== activeFilter) {
      setActiveFilter(urlStatus);
    }
  }, [urlStatus]);

  const handleSelectFilterTab = (tab: FilterStatus) => {
    setActiveFilter(tab);
    if (tab === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', tab);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleSort = (field: 'issueDate' | 'dueDate' | 'amount' | 'client') => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'client' ? 'asc' : 'desc');
    }
  };
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close floating action menu on window scroll or resize, unless scrolling inside menu
  useEffect(() => {
    if (!activeMenuId) return;
    const handleClose = (e: Event) => {
      const target = e.target as Node | null;
      if (
        (menuRef.current && target && (menuRef.current === target || menuRef.current.contains(target))) ||
        (mobileMenuRef.current && target && (mobileMenuRef.current === target || mobileMenuRef.current.contains(target)))
      ) {
        return;
      }
      setActiveMenuId(null);
      setMenuCoords(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [activeMenuId]);

  const activeMenuInvoice = useMemo(
    () => invoices.find((inv) => inv.id === activeMenuId) || null,
    [invoices, activeMenuId]
  );

  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>, invoiceId: string) => {
    e.stopPropagation();
    if (activeMenuId === invoiceId) {
      setActiveMenuId(null);
      setMenuCoords(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuDesiredHeight = 440;
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;

    let top: number;
    let maxHeight: number;

    if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
      top = rect.bottom + 6;
      maxHeight = Math.max(200, Math.min(menuDesiredHeight, spaceBelow));
    } else {
      maxHeight = Math.max(200, Math.min(menuDesiredHeight, spaceAbove));
      top = Math.max(16, rect.top - maxHeight - 6);
    }

    setMenuCoords({
      top,
      right: Math.max(16, window.innerWidth - rect.right),
      maxHeight,
    });

    setActiveMenuId(invoiceId);
  };

  // Filter, Search & Sort
  const filteredInvoices = useMemo(() => {
    const todayStr = getTodayDateString();
    const currentMonthPrefix = todayStr.slice(0, 7);
    const thirtyDaysAgoDate = new Date();
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgoDate.toISOString().slice(0, 10);

    const filtered = invoices.filter((inv) => {
      const effStatus = getEffectiveStatus(inv);

      // Status filter
      if (activeFilter !== 'all' && effStatus !== activeFilter) {
        return false;
      }

      // Date range quick filter
      if (dateFilter === 'this_month' && !(inv.issueDate || '').startsWith(currentMonthPrefix)) {
        return false;
      }
      if (dateFilter === 'last_30_days' && (inv.issueDate || '') < thirtyDaysAgoStr) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNumber = inv.number.toLowerCase().includes(q);
        const matchClient = inv.client.name.toLowerCase().includes(q) || inv.client.email.toLowerCase().includes(q);
        const matchItems = inv.items.some((i) => i.description.toLowerCase().includes(q));
        if (!matchNumber && !matchClient && !matchItems) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'issueDate') {
        cmp = (a.issueDate || '').localeCompare(b.issueDate || '');
      } else if (sortBy === 'dueDate') {
        cmp = (a.dueDate || '').localeCompare(b.dueDate || '');
      } else if (sortBy === 'client') {
        cmp = (a.client.name || '').localeCompare(b.client.name || '');
      } else if (sortBy === 'amount') {
        const totalA = calculateTotals(a.items, a.discount, a.taxRate).total;
        const totalB = calculateTotals(b.items, b.discount, b.taxRate).total;
        cmp = totalA - totalB;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [invoices, activeFilter, dateFilter, searchQuery, sortBy, sortDir]);

  // Counts for each tab
  const statusCounts = useMemo(() => {
    const counts: Record<FilterStatus, number> = {
      all: invoices.length,
      draft: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      partially_paid: 0,
      cancelled: 0,
    };
    for (const inv of invoices) {
      const st = getEffectiveStatus(inv);
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    }
    return counts;
  }, [invoices]);

  // Direct fast PDF download
  const handleDownloadPdf = async (inv: Invoice) => {
    try {
      const doc = <InvoicePDF invoice={inv} accentColor={inv.accentColor} template={inv.template} />;
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${inv.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${inv.number}.pdf`);
    } catch {
      toast.error('Could not download PDF');
    }
  };

  const invoiceToDelete = invoices.find((inv) => inv.id === deletingInvoiceId);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (filteredInvoices.length === 0) return;
    const allFilteredIds = filteredInvoices.map((i) => i.id);
    const areAllSelected = allFilteredIds.every((id) => selectedIds.includes(id));
    if (areAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const isAllSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => selectedIds.includes(inv.id));
  const isSomeSelected =
    filteredInvoices.some((inv) => selectedIds.includes(inv.id)) && !isAllSelected;

  const handleCopyPayLink = (inv: Invoice) => {
    const payUrl = `${window.location.origin}/pay/${inv.id}`;
    navigator.clipboard.writeText(payUrl);
    toast.success(`Copied payment link for ${inv.number}`);
  };

  const handleBulkMarkSent = () => {
    let count = 0;
    for (const id of selectedIds) {
      const inv = invoices.find((i) => i.id === id);
      if (inv && inv.status !== 'paid') {
        onStatusChange(id, 'sent');
        count++;
      }
    }
    toast.success(`Marked ${count} invoice(s) as Sent`);
    setSelectedIds([]);
  };

  const handleBulkMarkPaid = () => {
    for (const id of selectedIds) {
      onStatusChange(id, 'paid');
    }
    toast.success(`Marked ${selectedIds.length} invoice(s) as Paid`);
    setSelectedIds([]);
  };

  const handleBulkExportCSV = () => {
    const selectedInvoices = invoices.filter((i) => selectedIds.includes(i.id));
    if (selectedInvoices.length === 0) return;
    exportInvoicesToCSV(selectedInvoices, 'Selected_Invoices.csv');
    toast.success(`Exported ${selectedInvoices.length} invoices to CSV`);
  };

  const handleBulkDeleteConfirm = () => {
    for (const id of selectedIds) {
      onDelete(id);
    }
    toast.info(`Deleted ${selectedIds.length} invoice(s)`);
    setSelectedIds([]);
    setIsBulkDeleting(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar: Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: 'all', label: 'All Invoices' },
              { id: 'draft', label: 'Draft' },
              { id: 'sent', label: 'Sent' },
              { id: 'paid', label: 'Paid' },
              { id: 'overdue', label: 'Overdue' },
            ] as const
          ).map((tab) => {
            const count = statusCounts[tab.id];
            const isSelected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#FF7916] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Period Filter & Export Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex-1 md:w-56">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, client..."
              leftAddon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'all' | 'this_month' | 'last_30_days')}
            className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7916]/40 cursor-pointer shrink-0"
            aria-label="Filter by period"
          >
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>
          <button
            type="button"
            onClick={() => {
              if (invoices.length === 0) {
                toast.error('No invoices to export');
                return;
              }
              setIsExportModalOpen(true);
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
            title="Export invoices to Excel / CSV with date range limit"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invoices List / Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<AlertCircle className="w-10 h-10" />}
          title={searchQuery ? 'No matching invoices' : `No ${activeFilter === 'all' ? '' : activeFilter} invoices`}
          description={
            searchQuery
              ? `No invoices matched "${searchQuery}". Clear your search or change filters.`
              : 'Create a new invoice to get started.'
          }
          actionLabel="New Invoice"
          onAction={() => navigate('/invoices/new')}
        />
      ) : (
        <>
          {/* Mobile & Reduced Screen Card View (< 1280px) */}
          <div className="block xl:hidden space-y-3">
            {filteredInvoices.map((inv) => {
              const effectiveStatus = getEffectiveStatus(inv);
              const totals = calculateTotals(inv.items, inv.discount, inv.taxRate);
              const paid = inv.paidAmount || (effectiveStatus === 'paid' ? totals.total : 0);
              const balanceDue = inv.outstandingAmount ?? Math.max(0, totals.total - paid);

              return (
                <div
                  key={inv.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border transition-colors p-4 shadow-sm ${
                    selectedIds.includes(inv.id)
                      ? 'border-[#FF7916] bg-orange-50/20 dark:bg-orange-950/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Header: Checkbox + Number + Retainer + Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(inv.id)}
                        onChange={() => handleToggleSelect(inv.id)}
                        className="w-4 h-4 rounded text-[#FF7916] focus:ring-[#FF7916] border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                        aria-label={`Select invoice ${inv.number}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoiceForView(inv);
                          setViewModalTab('document');
                        }}
                        className="font-mono font-bold text-sm text-slate-900 dark:text-white hover:text-[#FF7916] transition-colors"
                      >
                        {inv.number}
                      </button>
                      {inv.isRecurring && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/80 text-[#FF7916] border border-orange-200 dark:border-orange-900/60">
                          <Repeat className="w-2.5 h-2.5" /> Retainer
                        </span>
                      )}
                    </div>
                    <StatusBadge status={effectiveStatus} size="sm" />
                  </div>

                  {/* Client Info */}
                  <div className="mb-3">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                      {inv.client.name || 'Unnamed Client'}
                    </p>
                    {inv.client.email && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {inv.client.email}
                      </p>
                    )}
                  </div>

                  {/* Dates & Amount Row */}
                  <div className="flex items-end justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/80 mb-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Due: {formatDate(inv.dueDate)}</span>
                      <span className="text-slate-500 text-[10px] block">Issued: {formatDate(inv.issueDate)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 block">
                        {formatCurrency(totals.total, inv.currency)}
                      </span>
                      {effectiveStatus !== 'paid' && balanceDue > 0 && paid > 0 && (
                        <span className="text-[11px] text-[#FF7916] font-semibold block">
                          {formatCurrency(balanceDue, inv.currency)} due
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Toolbar */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoiceForView(inv);
                          setViewModalTab('document');
                        }}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="View Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                        className="p-2 rounded-xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title="Edit Invoice"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendModalInvoice(inv)}
                        className="p-2 rounded-xl text-slate-500 hover:text-[#FF7916] dark:text-slate-400 dark:hover:text-[#FF7916] hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors"
                        title="Send / Share Invoice"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      {effectiveStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalInvoice(inv)}
                          className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          title="Record Payment"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(inv)}
                        className="p-2 rounded-xl text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleMenu(e, inv.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <span>More</span>
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Large View: Full Table (≥ 1280px) */}
          <div className="hidden xl:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded text-[#FF7916] focus:ring-[#FF7916] border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                        aria-label="Select all invoices"
                      />
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('issueDate')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Sort by issue date"
                      >
                        <span>Invoice</span>
                        {sortBy === 'issueDate' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#FF7916]" /> : <ArrowDown className="w-3 h-3 text-[#FF7916]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 min-w-[150px]">
                      <button
                        type="button"
                        onClick={() => handleSort('client')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Sort by client name"
                      >
                        <span>Client</span>
                        {sortBy === 'client' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#FF7916]" /> : <ArrowDown className="w-3 h-3 text-[#FF7916]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('dueDate')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Sort by due date"
                      >
                        <span>Due Date</span>
                        {sortBy === 'dueDate' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#FF7916]" /> : <ArrowDown className="w-3 h-3 text-[#FF7916]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleSort('amount')}
                        className="inline-flex items-center justify-end gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ml-auto"
                        title="Sort by amount"
                      >
                        <span>Amount</span>
                        {sortBy === 'amount' ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#FF7916]" /> : <ArrowDown className="w-3 h-3 text-[#FF7916]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {filteredInvoices.map((inv) => {
                    const effectiveStatus = getEffectiveStatus(inv);
                    const totals = calculateTotals(inv.items, inv.discount, inv.taxRate);
                    const isMenuOpen = activeMenuId === inv.id;

                    return (
                      <tr
                        key={inv.id}
                        className={`transition-colors group ${
                          selectedIds.includes(inv.id)
                            ? 'bg-orange-50/40 dark:bg-orange-950/20'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(inv.id)}
                            onChange={() => handleToggleSelect(inv.id)}
                            className="w-4 h-4 rounded text-[#FF7916] focus:ring-[#FF7916] border-slate-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                            aria-label={`Select invoice ${inv.number}`}
                          />
                        </td>

                        {/* Invoice # */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-nowrap">
                            <button
                              onClick={() => {
                                setSelectedInvoiceForView(inv);
                                setViewModalTab('document');
                              }}
                              className="hover:text-[#FF7916] hover:underline whitespace-nowrap font-mono"
                            >
                              {inv.number}
                            </button>
                            {inv.isRecurring && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/80 text-[#FF7916] border border-orange-200 dark:border-orange-900/60 whitespace-nowrap">
                                <Repeat className="w-2.5 h-2.5" /> Retainer
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Client */}
                        <td className="py-3 px-4 min-w-[150px]">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {inv.client.name || 'Unnamed Client'}
                          </div>
                          {inv.client.email && (
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {inv.client.email}
                            </div>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                            {formatDate(inv.dueDate)}
                          </div>
                          <div className="text-[10px] text-slate-400 whitespace-nowrap">
                            Issued {formatDate(inv.issueDate)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={effectiveStatus} size="sm" />
                            {inv.lastRemindedAt && effectiveStatus !== 'paid' && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Reminded {formatRelativeTime(inv.lastRemindedAt)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
                            {formatCurrency(totals.total, inv.currency)}
                          </div>
                          {(inv.paidAmount || 0) > 0 && effectiveStatus !== 'paid' && (
                            <div className="text-[10px] text-[#FF7916] font-semibold whitespace-nowrap">
                              {formatCurrency(
                                Math.max(0, totals.total - (inv.paidAmount || 0)),
                                inv.currency
                              )}{' '}
                              due
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right relative whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* View button */}
                            <button
                              onClick={() => {
                                setSelectedInvoiceForView(inv);
                                setViewModalTab('document');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="View Invoice"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Copy Public Payment Link */}
                            <button
                              type="button"
                              onClick={() => handleCopyPayLink(inv)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#FF7916] hover:bg-orange-50 dark:hover:bg-orange-950/50 transition-colors"
                              title="Copy Payment Link"
                            >
                              <LinkIcon className="w-4 h-4" />
                            </button>

                            {/* Smart Overdue Reminder (only when overdue) */}
                            {effectiveStatus === 'overdue' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSendModalMode('reminder');
                                  setSendModalInvoice(inv);
                                }}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="Send Overdue Reminder"
                              >
                                <BellRing className="w-4 h-4" />
                              </button>
                            )}

                            {/* Quick Send */}
                            <button
                              type="button"
                              onClick={() => {
                                setSendModalMode('send');
                                setSendModalInvoice(inv);
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#FF7916] hover:bg-orange-50 dark:hover:bg-orange-950/50 transition-colors"
                              title="Send / Share Invoice"
                            >
                              <Send className="w-4 h-4" />
                            </button>

                            {/* Quick Mark Paid (if unpaid) */}
                            {effectiveStatus !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onStatusChange(inv.id, 'paid');
                                  toast.success(`Marked ${inv.number} as Paid`);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                                title="Mark Paid"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}

                            {/* More dropdown trigger */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleMenu(e, inv.id)}
                              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                                isMenuOpen
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-700 shadow-2xs'
                                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title="Invoice actions"
                              aria-label="Invoice actions"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
      </>
      )}

      {/* Floating Action Menu / Bottom Sheet */}
      {activeMenuId && activeMenuInvoice && (() => {
        const effStatus = getEffectiveStatus(activeMenuInvoice);
        const invTotals = calculateTotals(
          activeMenuInvoice.items,
          activeMenuInvoice.discount,
          activeMenuInvoice.taxRate
        );
        const paidAmount = activeMenuInvoice.paidAmount || (effStatus === 'paid' ? invTotals.total : 0);
        const balanceDue = activeMenuInvoice.outstandingAmount ?? Math.max(0, invTotals.total - paidAmount);
        const hasPaymentRecords = (activeMenuInvoice.payments && activeMenuInvoice.payments.length > 0) || paidAmount > 0;

        const closeMenu = () => {
          setActiveMenuId(null);
          setMenuCoords(null);
        };

        const renderActionGroups = (isMobile: boolean) => (
          <div className={isMobile ? 'space-y-1' : 'space-y-0.5'}>
            {/* Core Actions */}
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  const inv = activeMenuInvoice;
                  closeMenu();
                  setSelectedInvoiceForView(inv);
                  setViewModalTab('document');
                }}
                className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <Eye className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0`} />
                <span>View Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const id = activeMenuInvoice.id;
                  closeMenu();
                  navigate(`/invoices/${id}/edit`);
                }}
                className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <Edit2 className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0`} />
                <span>Edit Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const inv = activeMenuInvoice;
                  closeMenu();
                  setSendModalInvoice(inv);
                }}
                className={`w-full flex items-center gap-2.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-[#FF7916] transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <Send className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-[#FF7916] shrink-0`} />
                <span>Send / Share Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const inv = activeMenuInvoice;
                  closeMenu();
                  handleDownloadPdf(inv);
                }}
                className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <Download className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0`} />
                <span>Download PDF</span>
              </button>
            </div>

            {/* Billing & Links */}
            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
            <div className={`pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isMobile ? 'px-3' : 'px-2.5'}`}>
              Payments & Links
            </div>
            <div className="space-y-0.5">
              {effStatus !== 'paid' && (
                <button
                  type="button"
                  onClick={() => {
                    const inv = activeMenuInvoice;
                    closeMenu();
                    setPaymentModalInvoice(inv);
                  }}
                  className={`w-full flex items-center justify-between rounded-xl font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer group ${
                    isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-emerald-500 shrink-0`} />
                    <span>Record Payment</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md">
                    Collect
                  </span>
                </button>
              )}

              {hasPaymentRecords && (
                <button
                  type="button"
                  onClick={() => {
                    const inv = activeMenuInvoice;
                    closeMenu();
                    setSelectedInvoiceForView(inv);
                    setViewModalTab('payments');
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                    isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                  }`}
                >
                  <Receipt className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-blue-500 shrink-0`} />
                  <span>Payment History</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const inv = activeMenuInvoice;
                  closeMenu();
                  const url = `${window.location.origin}/pay/${inv.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success('Payment link copied to clipboard!');
                }}
                className={`w-full flex items-center justify-between rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LinkIcon className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-blue-500 shrink-0`} />
                  <span>Copy Payment Link</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const inv = activeMenuInvoice;
                  closeMenu();
                  window.open(`/pay/${inv.id}`, '_blank');
                }}
                className={`w-full flex items-center justify-between rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ExternalLink className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 shrink-0`} />
                  <span>Open Payment Portal</span>
                </div>
                <span className="text-[10px] text-[#FF7916] font-semibold">Open ↗</span>
              </button>
            </div>

            {/* Workflow */}
            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
            <div className={`pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isMobile ? 'px-3' : 'px-2.5'}`}>
              Workflow
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  const id = activeMenuInvoice.id;
                  closeMenu();
                  onDuplicate(id);
                }}
                className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <Copy className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 shrink-0`} />
                <span>Duplicate Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const inv = activeMenuInvoice;
                  closeMenu();
                  setRecurringModalInvoice(inv);
                }}
                className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group ${
                  isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                }`}
              >
                <Repeat className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-[#FF7916] shrink-0`} />
                <span>Convert to Recurring</span>
              </button>
            </div>

            {/* Status Updates */}
            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
            <div className={`pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isMobile ? 'px-3' : 'px-2.5'}`}>
              Change Status
            </div>
            <div className="space-y-0.5">
              {effStatus !== 'paid' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = activeMenuInvoice.id;
                    closeMenu();
                    onStatusChange(id, 'paid');
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${
                    isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                  }`}
                >
                  <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-emerald-500 shrink-0`} />
                  <span>Mark as Paid</span>
                </button>
              )}

              {effStatus !== 'sent' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = activeMenuInvoice.id;
                    closeMenu();
                    onStatusChange(id, 'sent');
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${
                    isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                  }`}
                >
                  <Send className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-blue-500 shrink-0`} />
                  <span>Mark as Sent</span>
                </button>
              )}

              {effStatus !== 'draft' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = activeMenuInvoice.id;
                    closeMenu();
                    onStatusChange(id, 'draft');
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${
                    isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                  }`}
                >
                  <Clock className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-slate-400 shrink-0`} />
                  <span>Revert to Draft</span>
                </button>
              )}

              {effStatus !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    const id = activeMenuInvoice.id;
                    closeMenu();
                    onStatusChange(id, 'cancelled');
                  }}
                  className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer ${
                    isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
                  }`}
                >
                  <XCircle className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-amber-500 shrink-0`} />
                  <span>Cancel Invoice</span>
                </button>
              )}
            </div>

            {/* Destructive */}
            <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
            <button
              type="button"
              onClick={() => {
                const id = activeMenuInvoice.id;
                closeMenu();
                setDeletingInvoiceId(id);
              }}
              className={`w-full flex items-center gap-2.5 rounded-xl font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer group ${
                isMobile ? 'px-3 py-2.5 text-sm' : 'px-2.5 py-1.5 text-xs'
              }`}
            >
              <Trash2 className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-rose-500 shrink-0`} />
              <span>Delete Invoice</span>
            </button>
          </div>
        );

        return createPortal(
          <>
            {/* MOBILE & TABLET: Dark overlay + Slide-up Bottom Sheet */}
            <div
              className="block xl:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
              onClick={closeMenu}
            />
            <div
              ref={mobileMenuRef}
              className="block xl:hidden fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto overscroll-contain touch-pan-y rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-5 text-left animate-in slide-in-from-bottom duration-200"
            >
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />
              
              {/* Context Header */}
              <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                      {activeMenuInvoice.number}
                    </span>
                    <StatusBadge status={effStatus} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                    {activeMenuInvoice.client.name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block">
                    {formatCurrency(invTotals.total, activeMenuInvoice.currency)}
                  </span>
                  {effStatus !== 'paid' && balanceDue > 0 && (
                    <span className="text-xs text-[#FF7916] font-semibold block">
                      {formatCurrency(balanceDue, activeMenuInvoice.currency)} due
                    </span>
                  )}
                </div>
              </div>

              {/* Action items */}
              {renderActionGroups(true)}

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={closeMenu}
                className="w-full mt-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>

            {/* DESKTOP: Backdrop + Anchored Dropdown Menu */}
            {menuCoords && (
              <>
                <div
                  className="hidden xl:block fixed inset-0 z-50 bg-transparent"
                  onClick={closeMenu}
                />
                <div
                  ref={menuRef}
                  style={{
                    position: 'fixed',
                    top: `${menuCoords.top}px`,
                    right: `${menuCoords.right}px`,
                    maxHeight: `${menuCoords.maxHeight}px`,
                  }}
                  className="hidden xl:block z-50 w-72 overflow-y-auto overscroll-contain touch-pan-y rounded-2xl bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/15 dark:shadow-black/60 border border-slate-200 dark:border-slate-800 p-2 text-left text-xs animate-in fade-in-0 zoom-in-95 duration-100 ease-out ring-1 ring-black/5 dark:ring-white/10"
                >
                  {/* Context Header */}
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/70 rounded-xl mb-1.5 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        {activeMenuInvoice.number}
                      </span>
                      <StatusBadge status={effStatus} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[130px] font-medium" title={activeMenuInvoice.client.name}>
                        {activeMenuInvoice.client.name}
                      </span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {effStatus !== 'paid' && balanceDue > 0
                          ? `${formatCurrency(balanceDue, activeMenuInvoice.currency)} due`
                          : formatCurrency(invTotals.total, activeMenuInvoice.currency)}
                      </span>
                    </div>
                  </div>

                  {renderActionGroups(false)}
                </div>
              </>
            )}
          </>,
          document.body
        );
      })()}

      {/* Quick View Modal */}
      <InvoiceViewModal
        invoice={selectedInvoiceForView}
        isOpen={!!selectedInvoiceForView}
        onClose={() => setSelectedInvoiceForView(null)}
        initialTab={viewModalTab}
      />

      {/* Record Partial / Full Payment Modal */}
      <RecordPaymentModal
        invoice={paymentModalInvoice}
        isOpen={paymentModalInvoice !== null}
        onClose={() => setPaymentModalInvoice(null)}
      />

      {/* Set as Recurring Retainer Modal */}
      <CreateRecurringModal
        invoice={recurringModalInvoice}
        isOpen={recurringModalInvoice !== null}
        onClose={() => setRecurringModalInvoice(null)}
      />

      {/* Delete Invoice Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingInvoiceId}
        onClose={() => setDeletingInvoiceId(null)}
        onConfirm={() => {
          if (deletingInvoiceId) {
            onDelete(deletingInvoiceId);
            setDeletingInvoiceId(null);
          }
        }}
        title="Delete Invoice?"
        message={`Are you sure you want to permanently delete invoice ${invoiceToDelete?.number}? This action cannot be undone.`}
        confirmLabel="Delete Invoice"
        variant="danger"
      />

      {/* Export Date Range Limit Modal */}
      <ExportInvoicesModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        invoices={invoices}
      />

      {/* Send Invoice Multi-Channel Modal */}
      <SendInvoiceModal
        isOpen={Boolean(sendModalInvoice)}
        onClose={() => setSendModalInvoice(null)}
        invoice={sendModalInvoice}
        mode={sendModalMode}
      />

      {/* Bulk Action Floating Dock */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3 border border-slate-800 dark:border-slate-200 animate-in slide-in-from-bottom-4 duration-150 max-w-[95vw] overflow-x-auto">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 dark:bg-slate-100 dark:text-slate-800 shrink-0">
            {selectedIds.length} selected
          </span>
          <div className="h-4 w-px bg-slate-700 dark:bg-slate-300 shrink-0" />
          <button
            type="button"
            onClick={handleBulkMarkSent}
            className="flex items-center gap-1.5 text-xs font-medium hover:text-[#FF7916] transition-colors shrink-0 px-1 py-0.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mark Sent</span>
          </button>
          <button
            type="button"
            onClick={handleBulkMarkPaid}
            className="flex items-center gap-1.5 text-xs font-medium hover:text-emerald-500 transition-colors shrink-0 px-1 py-0.5 cursor-pointer"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mark Paid</span>
          </button>
          <button
            type="button"
            onClick={handleBulkExportCSV}
            className="flex items-center gap-1.5 text-xs font-medium hover:text-[#FF7916] transition-colors shrink-0 px-1 py-0.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsBulkDeleting(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors shrink-0 px-1 py-0.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
          <div className="h-4 w-px bg-slate-700 dark:bg-slate-300 shrink-0" />
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="p-1 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-900 shrink-0 cursor-pointer"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleting}
        onClose={() => setIsBulkDeleting(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={`Delete ${selectedIds.length} Invoice${selectedIds.length > 1 ? 's' : ''}?`}
        message={`Are you sure you want to permanently delete ${selectedIds.length} selected invoice${selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.length} Invoice${selectedIds.length > 1 ? 's' : ''}`}
        variant="danger"
      />
    </div>
  );
};
