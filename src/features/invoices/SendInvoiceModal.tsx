import React, { useState } from 'react';
import {
  Mail,
  MessageSquare,
  Link as LinkIcon,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Send,
  Smartphone,
  Share2,
  QrCode,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Invoice } from '../../types';
import { calculateTotals } from '../../lib/calculateTotals';
import { formatCurrency } from '../../lib/formatCurrency';
import { formatDate } from '../../lib/dates';
import { useToast } from '../../components/ui/Toast';
import { useInvoiceStore } from '../../store/invoiceStore';
import { InvoicePDFDownloadButton } from './InvoicePDFDownloadButton';

export interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

type SendMode = 'email' | 'whatsapp' | 'link' | 'pdf';

export const SendInvoiceModal: React.FC<SendInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
}) => {
  const toast = useToast();
  const { updateStatus } = useInvoiceStore();

  const [activeMode, setActiveMode] = useState<SendMode>('email');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmailText, setCopiedEmailText] = useState(false);
  const [copiedWhatsAppText, setCopiedWhatsAppText] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [autoMarkSent, setAutoMarkSent] = useState(true);

  // Form states initialized from invoice
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  // Sync state whenever invoice opens
  React.useEffect(() => {
    if (invoice) {
      setRecipientEmail(invoice.client.email || '');
      setEmailSubject(`Invoice ${invoice.number} from ${invoice.business.name || 'EgolePay'}`);
      setRecipientPhone(invoice.client.phone || '');
      setCopiedLink(false);
      setCopiedEmailText(false);
      setCopiedWhatsAppText(false);
      setShowQr(false);
    }
  }, [invoice, isOpen]);

  if (!invoice) return null;

  const totals = calculateTotals(invoice.items, invoice.discount, invoice.taxRate);
  const payUrl = `${window.location.origin}/pay/${invoice.id}`;
  const isAlreadySentOrPaid = invoice.status === 'sent' || invoice.status === 'paid';

  const markAsSentIfRequested = () => {
    if (autoMarkSent && !isAlreadySentOrPaid) {
      updateStatus(invoice.id, 'sent');
      toast.success(`Invoice ${invoice.number} marked as Sent`);
    }
  };

  // Pre-formatted email content
  const emailBody = `Hello ${invoice.client.name || 'there'},

Please find invoice ${invoice.number} for ${formatCurrency(totals.total, invoice.currency)} from ${invoice.business.name || 'EgolePay'}.

Invoice Summary:
• Invoice Number: ${invoice.number}
• Amount Due: ${formatCurrency(totals.total, invoice.currency)}
• Due Date: ${formatDate(invoice.dueDate)}

You can view the full breakdown and make payment online directly via this link:
${payUrl}

Thank you for your business!

Best regards,
${invoice.business.name || 'EgolePay'}
${invoice.business.email ? `Email: ${invoice.business.email}` : ''}
${invoice.business.phone ? `Phone: ${invoice.business.phone}` : ''}`;

  // Pre-formatted WhatsApp content
  const whatsappBody = `Hello *${invoice.client.name || 'there'}* 👋

Here is Invoice *#${invoice.number}* from *${invoice.business.name || 'EgolePay'}*:
• *Amount Due:* ${formatCurrency(totals.total, invoice.currency)}
• *Due Date:* ${formatDate(invoice.dueDate)}

👉 *View & Pay Online:*
${payUrl}

Thank you for your business!`;

  // Handlers for sending
  const handleSendEmail = () => {
    markAsSentIfRequested();
    const mailto = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailto;
  };

  const handleOpenGmail = () => {
    markAsSentIfRequested();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      recipientEmail
    )}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyEmailText = async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopiedEmailText(true);
      markAsSentIfRequested();
      toast.success('Email message copied to clipboard!');
      setTimeout(() => setCopiedEmailText(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleSendWhatsApp = () => {
    markAsSentIfRequested();
    // Normalize phone number (strip spaces, symbols, plus)
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappBody)}`
      : `https://wa.me/?text=${encodeURIComponent(whatsappBody)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyWhatsAppText = async () => {
    try {
      await navigator.clipboard.writeText(whatsappBody);
      setCopiedWhatsAppText(true);
      markAsSentIfRequested();
      toast.success('WhatsApp message copied to clipboard!');
      setTimeout(() => setCopiedWhatsAppText(false), 2500);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopyPayLink = async () => {
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopiedLink(true);
      markAsSentIfRequested();
      toast.success('Invoice link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    payUrl
  )}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={<Send className="w-5 h-5 text-[#FF7916]" />}
      title={`Send Invoice ${invoice.number}`}
      description={`${invoice.client.name || 'Client'} • Total: ${formatCurrency(
        totals.total,
        invoice.currency
      )}`}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveMode('email')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'email'
                ? 'bg-white dark:bg-slate-900 text-[#FF7916] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('whatsapp')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'whatsapp'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('link')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'link'
                ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>Share Link</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('pdf')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeMode === 'pdf'
                ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>PDF & Print</span>
          </button>
        </div>

        {/* MODE 1: EMAIL */}
        {activeMode === 'email' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Recipient Email"
                type="email"
                placeholder="client@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <Input
                label="Subject Line"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Message Preview
              </label>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {emailBody}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleSendEmail}
                icon={<Mail className="w-4 h-4" />}
                className="bg-[#FF7916] hover:bg-[#ea580c] text-white font-bold text-xs"
              >
                Send via Email App
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleOpenGmail}
                icon={<ExternalLink className="w-4 h-4 text-rose-500" />}
                className="text-xs font-semibold"
              >
                Open in Gmail Web
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleCopyEmailText}
                icon={
                  copiedEmailText ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )
                }
                className="text-xs"
              >
                {copiedEmailText ? 'Copied Body!' : 'Copy Email Text'}
              </Button>
            </div>
          </div>
        )}

        {/* MODE 2: WHATSAPP */}
        {activeMode === 'whatsapp' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <Input
              label="Client WhatsApp Phone Number"
              placeholder="+234 810 000 0000"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              helperText="Enter with country code (e.g. 2348012345678 or +234...)"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                WhatsApp Message Preview
              </label>
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed shadow-2xs">
                <div className="flex items-center gap-2 mb-2 font-semibold text-emerald-800 dark:text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                  <span>WhatsApp Message</span>
                </div>
                {whatsappBody}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="button"
                variant="primary"
                onClick={handleSendWhatsApp}
                icon={<MessageSquare className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Open WhatsApp
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleCopyWhatsAppText}
                icon={
                  copiedWhatsAppText ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )
                }
                className="text-xs"
              >
                {copiedWhatsAppText ? 'Copied Message!' : 'Copy WhatsApp Text'}
              </Button>
            </div>
          </div>
        )}

        {/* MODE 3: SHARE LINK & QR CODE */}
        {activeMode === 'link' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Direct Client Payment & View Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={payUrl}
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 select-all focus:outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCopyPayLink}
                  icon={
                    copiedLink ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )
                  }
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0"
                >
                  {copiedLink ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  markAsSentIfRequested();
                  window.open(payUrl, '_blank', 'noopener,noreferrer');
                }}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Preview Client Portal ↗
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowQr(!showQr)}
                icon={<QrCode className="w-3.5 h-3.5 text-slate-500" />}
                className="text-xs"
              >
                {showQr ? 'Hide QR Code' : 'Show Mobile QR Code'}
              </Button>
            </div>

            {showQr && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 animate-in fade-in-50 zoom-in-95 duration-200">
                <img
                  src={qrApiUrl}
                  alt="Invoice QR Code"
                  className="w-40 h-40 rounded-xl bg-white p-2 shadow-xs border border-slate-200"
                />
                <p className="text-[11px] text-slate-500 text-center">
                  Client can scan this QR code with their mobile phone camera to view and pay immediately.
                </p>
              </div>
            )}
          </div>
        )}

        {/* MODE 4: PDF & PRINT */}
        {activeMode === 'pdf' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Official PDF Document
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Download a high-resolution PDF styled with your brand colors and selected template.
                </p>
              </div>
              <div onClick={markAsSentIfRequested}>
                <InvoicePDFDownloadButton
                  invoice={invoice}
                  size="md"
                  variant="primary"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Print Invoice
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Print a hard copy or save as PDF via your browser's native print dialogue.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  markAsSentIfRequested();
                  window.print();
                }}
                icon={<Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
                className="font-semibold text-xs"
              >
                Print Hard Copy
              </Button>
            </div>
          </div>
        )}

        {/* Footer: Automatic status update & Close */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={autoMarkSent}
              onChange={(e) => setAutoMarkSent(e.target.checked)}
              disabled={isAlreadySentOrPaid}
              className="w-4 h-4 rounded text-[#FF7916] focus:ring-[#FF7916] border-slate-300 dark:border-slate-700"
            />
            <span>
              {isAlreadySentOrPaid
                ? `Invoice is currently marked as ${invoice.status.toUpperCase()}`
                : 'Automatically mark invoice as "Sent" when dispatched'}
            </span>
          </label>

          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
