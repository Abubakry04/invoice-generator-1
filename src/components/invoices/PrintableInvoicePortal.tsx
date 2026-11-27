import React from 'react';
import { createPortal } from 'react-dom';
import { Invoice } from '../../types';
import { InvoicePreview } from '../../features/invoices/InvoicePreview';

/**
 * Triggers window.print() while isolating #invoice-print-portal so modals,
 * sidebars, and background UI are excluded from the printed output.
 */
export function triggerInvoicePrint(): void {
  document.body.classList.add('printing-invoice');

  const cleanup = () => {
    document.body.classList.remove('printing-invoice');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();

  // Fallback cleanup in case afterprint does not fire in some browsers
  setTimeout(cleanup, 1500);
}

interface PrintableInvoicePortalProps {
  invoice: Invoice | null;
}

/**
 * Hidden on screen, visible only during isolated invoice printing.
 */
export const PrintableInvoicePortal: React.FC<PrintableInvoicePortalProps> = ({ invoice }) => {
  if (!invoice || typeof document === 'undefined') return null;

  return createPortal(
    <div id="invoice-print-portal" className="hidden print:block">
      <InvoicePreview invoice={invoice} showShadow={false} id="invoice-print-portal-doc" />
    </div>,
    document.body
  );
};
