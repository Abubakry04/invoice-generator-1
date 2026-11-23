import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Save,
  ArrowLeft,
  Eye,
  Send,
  ChevronRight,
  Link as LinkIcon,
  Lock,
  AlertCircle,
  Zap,
  MoreHorizontal,
  Download,
  Printer,
} from 'lucide-react';
import { invoiceFormSchema, InvoiceFormData } from './invoiceSchema';
import { InvoiceForm } from './InvoiceForm';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import { InvoicePDF } from './InvoicePDF';
import { pdf } from '@react-pdf/renderer';
import { SendInvoiceModal } from './SendInvoiceModal';
import { useInvoiceStore } from '../../store/invoiceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useClientStore } from '../../store/clientStore';
import { useProductStore } from '../../store/productStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useUiStore } from '../../store/uiStore';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { generateInvoiceNumber } from '../../lib/generateInvoiceNumber';
import { getTodayDateString, getDefaultDueDate } from '../../lib/dates';
import { formatCurrency } from '../../lib/formatCurrency';
import { calculateTotals } from '../../lib/calculateTotals';
import { Invoice, InvoiceStatus, InvoiceTemplate } from '../../types';

export const InvoiceEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { invoices, addInvoice, updateInvoice, getInvoice } = useInvoiceStore();
  const { settings } = useSettingsStore();
  const { clients } = useClientStore();
  const { products, deductStockForInvoice } = useProductStore();
  const {
    canCreateInvoice,
    getCurrentPlan,
    hasFeature,
    isTemplateAllowed,
    getRequiredPlanForTemplate,
  } = useSubscriptionStore();
  const { openModal } = useUiStore();

  const canUsePaymentPortal = hasFeature('payment_portal');

  const isEditing = Boolean(id);
  const existingInvoice = isEditing && id ? getInvoice(id) : undefined;

  // Preview & Send modal states
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [sendModalInvoice, setSendModalInvoice] = useState<Invoice | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // Compute initial default values
  const defaultValues = useMemo<InvoiceFormData>(() => {
    // Resolve safe template according to subscription plan allowance
    const resolveAllowedTemplate = (preferred?: string): InvoiceTemplate => {
      const candidate = (preferred as InvoiceTemplate) || 'minimal';
      return isTemplateAllowed(candidate) ? candidate : 'minimal';
    };

    if (existingInvoice) {
      return {
        number: existingInvoice.number,
        issueDate: existingInvoice.issueDate,
        dueDate: existingInvoice.dueDate,
        currency: existingInvoice.currency,
        status: existingInvoice.status,
        template: existingInvoice.template || resolveAllowedTemplate(settings.defaultTemplate),
        accentColor: existingInvoice.accentColor || settings.accentColor || '#FF7916',
        business: {
          name: existingInvoice.business.name || settings.business.name,
          address: existingInvoice.business.address || settings.business.address,
          email: existingInvoice.business.email || settings.business.email,
          phone: existingInvoice.business.phone || settings.business.phone,
          logo: existingInvoice.business.logo || settings.business.logo || '',
          bankDetails: existingInvoice.business.bankDetails || settings.business.bankDetails || '',
        },
        client: {
          name: existingInvoice.client.name,
          email: existingInvoice.client.email || '',
          address: existingInvoice.client.address || '',
          phone: existingInvoice.client.phone || '',
        },
        items: existingInvoice.items.length > 0
          ? existingInvoice.items
          : [{ id: 'item-1', description: '', quantity: 1, unitPrice: 0 }],
        discount: existingInvoice.discount || 0,
        taxRate: existingInvoice.taxRate ?? settings.defaultTaxRate,
        notes: existingInvoice.notes || '',
      };
    }

    // Auto-generate invoice number
    const existingNumbers = invoices.map((inv) => inv.number);
    const nextNumber = generateInvoiceNumber(existingNumbers, settings.invoicePrefix || 'INV-');

    // Prepopulate client if query param clientName is set
    const clientParam = searchParams.get('clientName');
    const matchedClient = clientParam
      ? clients.find((c) => c.name.toLowerCase() === clientParam.toLowerCase())
      : undefined;

    // Prepopulate product if query param prefillProductId is set
    const productParam = searchParams.get('prefillProductId');
    const matchedProduct = productParam
      ? products.find((p) => p.id === productParam)
      : undefined;

    return {
      number: nextNumber,
      issueDate: getTodayDateString(),
      dueDate: getDefaultDueDate(14),
      currency: settings.defaultCurrency || 'NGN',
      status: 'draft',
      template: resolveAllowedTemplate(settings.defaultTemplate),
      accentColor: settings.accentColor || '#FF7916',
      business: {
        name: settings.business.name,
        address: settings.business.address,
        email: settings.business.email,
        phone: settings.business.phone,
        logo: settings.business.logo || '',
        bankDetails: settings.business.bankDetails || '',
      },
      client: {
        name: matchedClient ? matchedClient.name : '',
        email: matchedClient ? matchedClient.email : '',
        address: matchedClient ? matchedClient.address : '',
        phone: matchedClient?.phone || '',
      },
      items: matchedProduct
        ? [
            {
              id: `item-${Date.now()}-1`,
              productId: matchedProduct.id,
              description:
                matchedProduct.name +
                (matchedProduct.description ? ` - ${matchedProduct.description}` : ''),
              quantity: 1,
              unitPrice: matchedProduct.unitPrice,
            },
          ]
        : [
            {
              id: `item-${Date.now()}-1`,
              description: '',
              quantity: 1,
              unitPrice: 0,
            },
          ],
      discount: 0,
      taxRate: settings.defaultTaxRate || 7.5,
      notes: 'Payment is due within 14 days of issue. Kindly quote invoice number in bank transfer remarks.',
    };
  }, [existingInvoice, invoices, settings, searchParams, clients, products]);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema) as any,
    defaultValues,
    mode: 'onTouched',
  });

  const { handleSubmit, watch, reset, setValue } = form;

  useEffect(() => {
    if (existingInvoice) {
      reset(defaultValues);
    }
  }, [existingInvoice?.id]);

  // Watch current live values to stream to preview and PDF
  const formValues = watch();

  // Create real Invoice object for preview & PDF export
  const liveInvoice: Invoice = useMemo(() => {
    return {
      id: id || 'temp-id',
      number: formValues.number || 'INV-0001',
      issueDate: formValues.issueDate || getTodayDateString(),
      dueDate: formValues.dueDate || getDefaultDueDate(14),
      currency: formValues.currency || 'NGN',
      status: formValues.status || 'draft',
      template: formValues.template || 'modern',
      accentColor: formValues.accentColor || '#FF7916',
      business: {
        name: formValues.business?.name || settings.business.name,
        address: formValues.business?.address || settings.business.address,
        email: formValues.business?.email || settings.business.email,
        phone: formValues.business?.phone || settings.business.phone,
        logo: formValues.business?.logo || settings.business.logo,
        bankDetails: formValues.business?.bankDetails || settings.business.bankDetails,
      },
      client: {
        name: formValues.client?.name || '',
        email: formValues.client?.email || '',
        address: formValues.client?.address || '',
        phone: formValues.client?.phone || '',
      },
      items: formValues.items || [],
      discount: Number(formValues.discount) || 0,
      taxRate: Number(formValues.taxRate) || 0,
      notes: formValues.notes || '',
    };
  }, [formValues, id, settings]);

  const liveTotals = calculateTotals(liveInvoice.items, liveInvoice.discount, liveInvoice.taxRate);

  const onSave = (data: InvoiceFormData, targetStatus?: InvoiceStatus) => {
    const finalStatus = targetStatus || data.status;
    const finalData = {
      ...data,
      status: finalStatus,
    };

    // If invoice is being sent or marked paid, deduct stock for physical products
    if (finalStatus === 'sent' || finalStatus === 'paid') {
      const deducted = deductStockForInvoice(data.items);
      if (deducted > 0) {
        toast.info(`Updated stock: ${deducted} product unit(s) deducted from catalog`);
      }
    }

    // SaaS Quota Gate: check limits for free tier
    if (!isEditing && !canCreateInvoice()) {
      const plan = getCurrentPlan();
      openModal('upgrade', {
        trigger: `Monthly allowance reached (${plan.invoiceLimit} invoices/mo). Upgrade to create more invoices.`,
      });
      return;
    }

    let savedInvoice: Invoice;
    if (isEditing && id) {
      updateInvoice(id, finalData);
      savedInvoice = { ...finalData, id };
      toast.success(`Invoice ${finalData.number} updated successfully`);
    } else {
      savedInvoice = addInvoice(finalData);
      toast.success(`Invoice ${finalData.number} created successfully`);
    }

    if (finalStatus === 'sent' || targetStatus === 'sent') {
      setSendModalInvoice(savedInvoice);
    } else {
      navigate('/invoices');
    }
  };

  const handleSaveDraft: SubmitHandler<InvoiceFormData> = (data) => onSave(data, 'draft');
  const handleSaveAndSend: SubmitHandler<InvoiceFormData> = (data) => onSave(data, 'sent');

  const handleCloseSendModal = () => {
    setSendModalInvoice(null);
    navigate('/invoices');
  };

  const handleDownloadPdf = async () => {
    try {
      const doc = (
        <InvoicePDF
          invoice={liveInvoice}
          accentColor={liveInvoice.accentColor}
          template={liveInvoice.template}
        />
      );
      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${liveInvoice.number || 'Invoice'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${liveInvoice.number}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  // Handle template change from preview modal
  const handleTemplateChange = (newTemplate: InvoiceTemplate) => {
    if (!isTemplateAllowed(newTemplate)) {
      const requiredPlan = getRequiredPlanForTemplate(newTemplate);
      openModal('upgrade', {
        targetPlan: requiredPlan,
        trigger: `The "${newTemplate}" template requires the ${
          requiredPlan === 'starter' ? 'Starter' : 'Business'
        } plan. Upgrade now to unlock it.`,
      });
      return;
    }
    setValue('template', newTemplate, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-28 sm:pb-16">
      {/* 1. Sticky Action & Navigation Bar */}
      <div className="sticky top-16 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs print:hidden">
        {/* Left: Breadcrumbs & Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/invoices')}
            className="hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 px-2 shrink-0"
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Invoices</span>
          </Button>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-mono truncate">
              {isEditing ? existingInvoice?.number || 'Edit Invoice' : 'New Invoice'}
            </h1>
            <StatusBadge status={liveInvoice.status} size="sm" />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Preview Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreviewModal(true)}
            icon={<Eye className="w-3.5 h-3.5 text-slate-500" />}
            className="text-xs font-semibold"
          >
            <span className="hidden sm:inline">Preview</span>
          </Button>

          {/* More Actions Dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              icon={<MoreHorizontal className="w-3.5 h-3.5 text-slate-500" />}
              className="text-xs px-2.5"
              title="More actions"
            >
              <span className="hidden md:inline">More</span>
            </Button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-1 z-30 animate-in fade-in-0 zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleSubmit(handleSaveDraft)();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                  <span>Save as Draft</span>
                </button>

                {isEditing && id && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (!canUsePaymentPortal) {
                        openModal('upgrade', {
                          targetPlan: 'starter',
                          trigger: 'Client online payment links are available on Starter and Business plans.',
                        });
                        return;
                      }
                      const payUrl = `${window.location.origin}/pay/${id}`;
                      navigator.clipboard.writeText(payUrl);
                      toast.success('Payment link copied to clipboard!');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
                    <span>Copy Payment Link</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleDownloadPdf();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    window.print();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  <span>Print Document</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit(handleSaveAndSend)}
            icon={<Send className="w-3.5 h-3.5" />}
            className="bg-[#FF7916] hover:bg-[#ea580c] active:bg-[#c2410c] text-white shadow-xs rounded-xl font-bold px-3.5 text-xs shrink-0"
          >
            {isEditing ? 'Save & Send' : 'Save & Issue'}
          </Button>
        </div>
      </div>

      {/* SaaS Plan Quota Warning Banner */}
      {!isEditing && !canCreateInvoice() && (
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-800 dark:text-rose-200 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">Monthly Invoice Allowance Reached</p>
              <p className="text-rose-600/90 dark:text-rose-400/90 text-[11px] mt-0.5">
                You have reached your limit of {getCurrentPlan().invoiceLimit} invoices this month on the{' '}
                {getCurrentPlan().name}. Upgrade to Starter or Business to create more invoices.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() =>
              openModal('upgrade', {
                trigger: 'Invoice allowance reached. Upgrade to continue creating invoices.',
              })
            }
            className="bg-[#FF7916] hover:bg-[#ea580c] text-white shrink-0 font-bold"
            icon={<Zap className="w-3.5 h-3.5 fill-current" />}
          >
            Upgrade Plan
          </Button>
        </div>
      )}

      {/* 2. Main Editor Form */}
      <div className="space-y-6">
        <InvoiceForm form={form} />
      </div>

      {/* 3. Mobile Floating Action Dock (Always within thumb reach) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xl md:hidden print:hidden">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
            Total Due
          </span>
          <span className="font-mono font-bold text-base text-[#FF7916]">
            {formatCurrency(liveTotals.total, liveInvoice.currency)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreviewModal(true)}
            icon={<Eye className="w-4 h-4 text-[#FF7916]" />}
            className="rounded-xl border-orange-200 dark:border-orange-900/60 font-semibold"
          >
            Preview
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit(handleSaveAndSend)}
            icon={<Send className="w-4 h-4" />}
            className="bg-[#FF7916] hover:bg-[#ea580c] text-white font-bold rounded-xl px-4 shadow-sm"
          >
            {isEditing ? 'Update' : 'Issue'}
          </Button>
        </div>
      </div>

      {/* 4. Full Document Preview Modal */}
      <InvoicePreviewModal
        invoice={liveInvoice}
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onTemplateChange={handleTemplateChange}
        onSaveAndSend={handleSubmit(handleSaveAndSend)}
      />

      {/* 5. Send & Dispatch Modes Modal (Email, WhatsApp, Link, PDF) */}
      <SendInvoiceModal
        isOpen={Boolean(sendModalInvoice)}
        onClose={handleCloseSendModal}
        invoice={sendModalInvoice}
      />
    </div>
  );
};
