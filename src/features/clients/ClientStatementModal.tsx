import React from 'react';
import {
  FileText,
  Download,
  Printer,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Client, Invoice } from '../../types';
import { formatCurrency } from '../../lib/formatCurrency';
import { formatDate } from '../../lib/dates';
import { calculateTotals } from '../../lib/calculateTotals';
import { useSettingsStore } from '../../store/settingsStore';
import { useToast } from '../../components/ui/Toast';
import { exportInvoicesToCSV } from '../../lib/exportUtils';

interface ClientStatementModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  onOpenInvoice?: (invoice: Invoice) => void;
}

export const ClientStatementModal: React.FC<ClientStatementModalProps> = ({
  client,
  isOpen,
  onClose,
  invoices,
  onOpenInvoice,
}) => {
  const { settings } = useSettingsStore();
  const toast = useToast();

  if (!client) return null;

  // Filter invoices for this specific client
  const clientInvoices = invoices.filter(
    (inv) =>
      inv.client.name.toLowerCase().trim() === client.name.toLowerCase().trim() ||
      (inv.client.email && client.email && inv.client.email.toLowerCase() === client.email.toLowerCase())
  );

  // Calculate aggregates
  let totalBilled = 0;
  let totalPaid = 0;
  const primaryCurrency = clientInvoices[0]?.currency || settings.defaultCurrency || 'NGN';

  for (const inv of clientInvoices) {
    const t = calculateTotals(inv.items, inv.discount, inv.taxRate);
    totalBilled += t.total;
    totalPaid += inv.paidAmount || (inv.status === 'paid' ? t.total : 0);
  }

  const outstandingBalance = Math.max(0, totalBilled - totalPaid);
  const overdueCount = clientInvoices.filter((inv) => inv.status === 'overdue').length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (clientInvoices.length === 0) {
      toast.error('No invoices to export for this client');
      return;
    }
    exportInvoicesToCSV(clientInvoices, `${client.name.replace(/\s+/g, '_')}_Statement.csv`);
    toast.success('Statement exported as CSV');
  };

  const handleSendWhatsAppStatement = () => {
    if (!client.phone) {
      toast.error('Client does not have a phone number saved');
      return;
    }

    let cleanPhone = client.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      cleanPhone = '234' + cleanPhone.slice(1);
    } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('234')) {
      cleanPhone = '234' + cleanPhone;
    }

    const businessName = settings.business.name || 'EgolePay';
    const message = `Hello *${client.name}* 👋

Here is your current Statement of Account from *${businessName}*:

• *Total Invoices Issued:* ${clientInvoices.length}
• *Total Billed:* ${formatCurrency(totalBilled, primaryCurrency)}
• *Total Settled:* ${formatCurrency(totalPaid, primaryCurrency)}
• *Net Outstanding Balance:* ${formatCurrency(outstandingBalance, primaryCurrency)}

Please let us know if you require any breakdown or payment reconciliation. Thank you for your continued business!

Best regards,
*${businessName}*`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={<FileText className="w-5 h-5 text-[#FF7916]" />}
      title={`${client.name} • Statement of Account`}
      description="Chronological ledger of billings, receipts, and receivables."
      maxWidth="4xl"
      footer={
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              icon={<Download className="w-3.5 h-3.5" />}
              className="text-xs font-semibold"
            >
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-3.5 h-3.5" />}
              className="text-xs font-semibold"
            >
              Print Statement
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {client.phone && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSendWhatsAppStatement}
                icon={<Smartphone className="w-3.5 h-3.5" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Send via WhatsApp
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Billed (LTV)
            </span>
            <span className="font-mono font-bold text-lg text-slate-900 dark:text-white mt-0.5 block">
              {formatCurrency(totalBilled, primaryCurrency)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Across {clientInvoices.length} {clientInvoices.length === 1 ? 'invoice' : 'invoices'}
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Total Collected
            </span>
            <span className="font-mono font-bold text-lg text-emerald-700 dark:text-emerald-300 mt-0.5 block">
              {formatCurrency(totalPaid, primaryCurrency)}
            </span>
            <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1 block">
              Settled payments
            </span>
          </div>

          <div className={`p-3.5 rounded-xl border ${
            outstandingBalance > 0
              ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/40'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
          }`}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${
              outstandingBalance > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
            }`}>
              Net Outstanding
            </span>
            <span className={`font-mono font-bold text-lg mt-0.5 block ${
              outstandingBalance > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-slate-900 dark:text-white'
            }`}>
              {formatCurrency(outstandingBalance, primaryCurrency)}
            </span>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {overdueCount > 0 ? `${overdueCount} overdue` : 'Up to date'}
            </span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Transaction History
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              {clientInvoices.length} Records
            </span>
          </div>

          {clientInvoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No invoices created for this client yet.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <tr>
                    <th className="py-2.5 px-3.5">Invoice #</th>
                    <th className="py-2.5 px-3">Issue Date</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {clientInvoices.map((inv) => {
                    const t = calculateTotals(inv.items, inv.discount, inv.taxRate);
                    const paid = inv.paidAmount || (inv.status === 'paid' ? t.total : 0);
                    const bal = inv.outstandingAmount ?? Math.max(0, t.total - paid);

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenInvoice) {
                                onOpenInvoice(inv);
                              }
                            }}
                            className="hover:text-[#FF7916] hover:underline"
                          >
                            {inv.number}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <StatusBadge status={inv.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(t.total, inv.currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(paid, inv.currency)}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold whitespace-nowrap">
                          <span className={bal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}>
                            {formatCurrency(bal, inv.currency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
