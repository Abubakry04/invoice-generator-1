import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  FileText,
  Users,
  Package,
  Eye,
  Edit2,
  BarChart3,
  Zap,
  ShieldCheck,
  Sparkles,
  Download,
} from 'lucide-react';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useClientStore } from '../../store/clientStore';
import { useProductStore } from '../../store/productStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useUiStore } from '../../store/uiStore';
import { calculateTotals } from '../../lib/calculateTotals';
import { formatCurrency } from '../../lib/formatCurrency';
import { getEffectiveStatus, formatDate } from '../../lib/dates';
import { exportFinancialStatementCSV } from '../../lib/exportUtils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { InvoiceViewModal } from '../invoices/InvoiceViewModal';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { Invoice, InvoiceStatus } from '../../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { invoices } = useInvoiceStore();
  const { clients } = useClientStore();
  const { products } = useProductStore();
  const { settings } = useSettingsStore();
  const { subscription, getCurrentPlan } = useSubscriptionStore();
  const { openModal } = useUiStore();

  const currentPlan = getCurrentPlan();

  const currency = settings.defaultCurrency || 'NGN';
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);

  // Compute Dashboard Metrics
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let paidCount = 0;

    for (const inv of invoices) {
      const { total } = calculateTotals(inv.items, inv.discount, inv.taxRate);
      const effectiveStatus = getEffectiveStatus(inv);

      if (effectiveStatus === 'cancelled') continue;

      const paid = Math.min(total, inv.paidAmount || (effectiveStatus === 'paid' ? total : 0));
      const outstanding = inv.outstandingAmount ?? Math.max(0, total - paid);

      totalInvoiced += total;
      totalPaid += paid;
      totalOutstanding += outstanding;

      if (effectiveStatus === 'paid') {
        paidCount++;
      } else if (effectiveStatus === 'overdue') {
        totalOverdue += outstanding;
        overdueCount++;
      }
    }

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      totalOverdue,
      overdueCount,
      paidCount,
      totalCount: invoices.length,
    };
  }, [invoices]);

  // Recent invoices sorted by issueDate descending
  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''))
      .slice(0, 5);
  }, [invoices]);

  // Top stock alert products
  const stockAlertProducts = useMemo(() => {
    return products
      .filter((p) => p.type === 'product')
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
      .slice(0, 3);
  }, [products]);

  // Monthly revenue: last 6 calendar months
  const monthlyRevenue = useMemo(() => {
    const months: { label: string; key: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      months.push({ label, key, total: 0 });
    }

    for (const inv of invoices) {
      const { total } = calculateTotals(inv.items, inv.discount, inv.taxRate);
      const monthKey = inv.issueDate ? inv.issueDate.slice(0, 7) : '';
      const bucket = months.find((m) => m.key === monthKey);
      if (bucket) bucket.total += total;
    }
    return months;
  }, [invoices]);

  // Invoice status breakdown counts
  const statusBreakdown = useMemo(() => {
    const counts: Record<InvoiceStatus, number> = {
      draft: 0,
      sent: 0,
      paid: 0,
      partially_paid: 0,
      overdue: 0,
      cancelled: 0,
    };
    for (const inv of invoices) {
      const s = getEffectiveStatus(inv);
      counts[s] = (counts[s] || 0) + 1;
    }
    return (Object.entries(counts) as [InvoiceStatus, number][])
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count }));
  }, [invoices]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-page-enter">
      {/* 1. Clean Minimal Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
              {currentPlan.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {settings.business.name || 'Workspace'} • Financial summary & invoice overview
          </p>
        </div>

        <button
          onClick={() => exportFinancialStatementCSV(invoices, currency)}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer btn-tactile shrink-0"
          title="Download complete financial ledger and revenue statement as CSV"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Export Statement (CSV)</span>
          <span className="sm:hidden">CSV</span>
        </button>
      </div>

      {/* Near-Limit Warning (Dynamically adjusts to user's plan limit) */}
      {subscription.planId !== 'business' && currentPlan.invoiceLimit !== Infinity && subscription.invoicesCreatedThisMonth >= Math.max(1, currentPlan.invoiceLimit - 1) && (
        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">
              You have used <strong className="text-slate-900 dark:text-white">{subscription.invoicesCreatedThisMonth} of {currentPlan.invoiceLimit}</strong> invoices on your {currentPlan.name}. Upgrade your plan for higher volume and features.
            </span>
          </div>
          <button
            onClick={() => navigate('/subscription')}
            className="font-bold text-[#FF7916] hover:underline shrink-0 cursor-pointer"
          >
            Manage Plan →
          </button>
        </div>
      )}

      {/* 2. Four Clean KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div
          onClick={() => navigate('/invoices')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs card-hover-elevate animate-fade-in-up stagger-1 group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Invoiced</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-200">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={stats.totalInvoiced} currency={currency} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.totalCount} total {stats.totalCount === 1 ? 'invoice' : 'invoices'}
          </p>
        </div>

        {/* Collected */}
        <div
          onClick={() => navigate('/invoices?status=paid')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs card-hover-elevate animate-fade-in-up stagger-2 group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Collected (Paid)</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            <AnimatedNumber value={stats.totalPaid} currency={currency} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.paidCount} fulfilled payments
          </p>
        </div>

        {/* Outstanding */}
        <div
          onClick={() => navigate('/invoices?status=sent')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs card-hover-elevate animate-fade-in-up stagger-3 group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Outstanding Balance</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={stats.totalOutstanding} currency={currency} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Awaiting client remittance
          </p>
        </div>

        {/* Overdue */}
        <div
          onClick={() => navigate('/invoices?status=overdue')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs card-hover-elevate animate-fade-in-up stagger-4 group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Overdue</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            <AnimatedNumber value={stats.totalOverdue} currency={currency} />
          </div>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">
            {stats.overdueCount} {stats.overdueCount === 1 ? 'invoice requires' : 'invoices require'} follow-up
          </p>
        </div>
      </div>

      {/* 2.5 Revenue Analytics & Status Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Monthly Revenue Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/60 text-[#FF7916]">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Invoiced Revenue</h2>
                <p className="text-[11px] text-slate-400">Total volume issued across the last 6 months</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold text-slate-500">
                {formatCurrency(stats.totalInvoiced, currency)} total
              </span>
              {/* <button
                onClick={() => exportFinancialStatementCSV(invoices, currency)}
                className="text-[11px] font-semibold text-[#FF7916] hover:underline flex items-center gap-1 cursor-pointer"
                title="Download financial statement CSV"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button> */}
            </div>
          </div>

          {(() => {
            const maxVal = Math.max(...monthlyRevenue.map((m) => m.total), 1);
            return (
              <div className="pt-6 pb-2">
                <div className="flex items-end justify-between gap-3 h-36">
                  {monthlyRevenue.map((m, idx) => {
                    const pct = Math.round((m.total / maxVal) * 100);
                    return (
                      <div key={m.key} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                        <span className="text-[10px] font-mono font-semibold text-slate-700 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {m.total > 0 ? formatCurrency(m.total, currency) : '—'}
                        </span>
                        <div className="w-full max-w-[48px] bg-slate-100 dark:bg-slate-800 rounded-t-lg h-28 flex items-end overflow-hidden p-0.5">
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-[#FF7916] to-amber-500 hover:from-[#ea580c] hover:to-[#FF7916] transition-all duration-300 animate-bar-grow"
                            style={{
                              height: `${Math.max(pct, m.total > 0 ? 8 : 2)}%`,
                              animationDelay: `${idx * 80}ms`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover:text-[#FF7916] transition-colors">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right: Invoice Status Breakdown (1 col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between card-hover-elevate">
          <div>
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Status Breakdown</h2>
              <p className="text-[11px] text-slate-400">Distribution of active pipeline</p>
            </div>

            <div className="pt-4 space-y-3">
              {statusBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No invoices recorded yet.</p>
              ) : (
                statusBreakdown.map(({ status, count }) => {
                  const share = stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : 0;
                  return (
                    <button
                      type="button"
                      key={status}
                      onClick={() => navigate(`/invoices?status=${status}`)}
                      className="w-full text-left space-y-1 p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <StatusBadge status={status} size="sm" />
                        <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold group-hover:text-[#FF7916] transition-colors">
                          {count} ({share}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#FF7916] animate-progress-fill transition-all duration-700"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Recent Invoices (Full Width Clean Financial Table) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in-up stagger-5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Invoices</h2>
            <p className="text-xs text-slate-400 mt-0.5">Latest billing and payment activity</p>
          </div>
          <button
            onClick={() => navigate('/invoices')}
            className="text-xs font-semibold text-[#FF7916] hover:underline flex items-center gap-1 group"
          >
            <span>View all ({invoices.length})</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-[#FF7916] flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No invoices yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Issue your first invoice to begin tracking revenue.</p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/invoices/new')}
              icon={<Plus className="w-4 h-4" />}
            >
              Create Invoice
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile & Reduced Screen Card View (< 1280px) */}
            <div className="block xl:hidden p-4 space-y-3">
              {recentInvoices.map((inv) => {
                const effectiveStatus = getEffectiveStatus(inv);
                const totals = calculateTotals(inv.items, inv.discount, inv.taxRate);

                return (
                  <div
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer row-interactive"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                        {inv.number}
                      </span>
                      <StatusBadge status={effectiveStatus} size="sm" />
                    </div>

                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 mb-2">
                      {inv.client.name}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                        <span>Due: {formatDate(inv.dueDate)}</span>
                      </div>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                        {formatCurrency(totals.total, inv.currency)}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-end gap-2 pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceForView(inv)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#FF7916] text-slate-600 dark:text-slate-300 hover:text-[#FF7916] text-xs font-semibold bg-white dark:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Clean Table (≥ 1280px) */}
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3 px-6 whitespace-nowrap">Invoice</th>
                    <th className="py-3 px-6 min-w-[150px]">Client</th>
                    <th className="py-3 px-6 whitespace-nowrap">Due Date</th>
                    <th className="py-3 px-6 whitespace-nowrap">Status</th>
                    <th className="py-3 px-6 text-right whitespace-nowrap">Amount</th>
                    <th className="py-3 px-6 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {recentInvoices.map((inv) => {
                    const effectiveStatus = getEffectiveStatus(inv);
                    const totals = calculateTotals(inv.items, inv.discount, inv.taxRate);

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all cursor-pointer group row-interactive"
                      >
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-900 dark:text-white group-hover:text-[#FF7916] transition-colors whitespace-nowrap">
                          {inv.number}
                        </td>
                        <td className="py-3.5 px-6 text-slate-800 dark:text-slate-200 font-medium min-w-[150px]">
                          {inv.client.name}
                        </td>
                        <td className="py-3.5 px-6 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <div>{formatDate(inv.dueDate)}</div>
                          <div className="text-[10px] text-slate-400">Issued {formatDate(inv.issueDate)}</div>
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <StatusBadge status={effectiveStatus} size="sm" />
                        </td>
                        <td className="py-3.5 px-6 font-mono font-bold text-slate-900 dark:text-white text-right whitespace-nowrap">
                          {formatCurrency(totals.total, inv.currency)}
                        </td>
                        <td
                          className="py-3.5 px-6 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForView(inv)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#FF7916] text-slate-600 dark:text-slate-300 hover:text-[#FF7916] text-xs font-semibold bg-white dark:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 4. Two Balanced Bottom Cards: Clients & Inventory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Saved Clients Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Clients Directory</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                  {clients.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/clients')}
                className="text-xs font-semibold text-[#FF7916] hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {clients.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No clients added yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {clients.slice(0, 3).map((client) => (
                  <div
                    key={client.id}
                    onClick={() => navigate('/clients')}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 -mx-1 px-2 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {client.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {client.email || client.phone || 'Client Contact'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Inventory & Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#FF7916]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Inventory & Stock</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                  {products.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="text-xs font-semibold text-[#FF7916] hover:underline flex items-center gap-1"
              >
                <span>View catalog</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {stockAlertProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No physical items in inventory.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {stockAlertProducts.map((product) => {
                  const stock = product.stock ?? 0;
                  const isLow = stock <= (product.lowStockThreshold ?? 5);

                  return (
                    <div
                      key={product.id}
                      onClick={() => navigate('/inventory')}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 -mx-1 px-2 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {formatCurrency(product.unitPrice, currency)}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1.5 ${
                          stock === 0
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40'
                            : isLow
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            stock === 0 ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                        {stock} in stock
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Quick Preview Modal */}
      <InvoiceViewModal
        invoice={selectedInvoiceForView}
        isOpen={selectedInvoiceForView !== null}
        onClose={() => setSelectedInvoiceForView(null)}
      />
    </div>
  );
};
