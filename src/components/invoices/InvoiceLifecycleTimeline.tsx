import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { Invoice } from '../../types';
import { formatDate, isOverdue } from '../../lib/dates';

interface InvoiceLifecycleTimelineProps {
  invoice: Invoice;
  className?: string;
}

export const InvoiceLifecycleTimeline: React.FC<InvoiceLifecycleTimelineProps> = ({
  invoice,
  className = '',
}) => {
  const isPaid = invoice.status === 'paid' || (invoice.outstandingAmount !== undefined && invoice.outstandingAmount <= 0);
  const isPartiallyPaid = invoice.status === 'partially_paid';
  const isSent = invoice.status === 'sent' || isPartiallyPaid || isPaid || Boolean(invoice.sentAt);
  const isViewed = Boolean(invoice.viewedAt) || isPartiallyPaid || isPaid;
  const isPastDueDate = invoice.status === 'overdue' || isOverdue(invoice.dueDate, invoice.status);

  const steps = [
    {
      id: 'created',
      label: 'Created',
      date: formatDate(invoice.issueDate),
      state: 'completed' as const,
    },
    {
      id: 'sent',
      label: 'Sent',
      date: isSent ? (invoice.sentAt ? formatDate(invoice.sentAt) : 'Dispatched') : 'Draft',
      state: isSent ? ('completed' as const) : ('current' as const),
    },
    {
      id: 'viewed',
      label: 'Viewed',
      date: isViewed ? (invoice.viewedAt ? formatDate(invoice.viewedAt) : 'Opened') : 'Awaiting view',
      state: isViewed ? ('completed' as const) : (isSent ? ('current' as const) : ('pending' as const)),
    },
    {
      id: 'paid',
      label: isPaid ? 'Settled' : (isPastDueDate ? 'Overdue' : 'Due'),
      date: isPaid
        ? (invoice.paidAt ? formatDate(invoice.paidAt) : 'Paid in full')
        : formatDate(invoice.dueDate),
      state: isPaid
        ? ('completed' as const)
        : isPastDueDate
        ? ('overdue' as const)
        : isPartiallyPaid
        ? ('current' as const)
        : ('pending' as const),
    },
  ];

  return (
    <div className={`p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 ${className}`}>
      {/* Hairline Tracker */}
      <div className="grid grid-cols-4 gap-2 relative">
        {/* Subtle connector line between step points */}
        <div className="absolute top-2.5 left-4 right-4 h-0.5 bg-slate-100 dark:bg-slate-800 -z-0" />

        {steps.map((step) => {
          const isDone = step.state === 'completed';
          const isCurrent = step.state === 'current';
          const isOverdueState = step.state === 'overdue';

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center text-center">
              {/* Step Marker */}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isOverdueState
                    ? 'bg-rose-500 text-white'
                    : isCurrent
                    ? 'bg-white dark:bg-slate-900 border-2 border-[#FF7916] text-[#FF7916]'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-transparent'
                }`}
              >
                {isDone ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : isOverdueState ? (
                  <AlertCircle className="w-3 h-3" />
                ) : isCurrent ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF7916]" />
                ) : null}
              </div>

              {/* Title */}
              <span
                className={`text-xs font-semibold mt-2 ${
                  isDone
                    ? 'text-slate-800 dark:text-slate-200'
                    : isCurrent
                    ? 'text-[#FF7916] font-bold'
                    : isOverdueState
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {step.label}
              </span>

              {/* Date / Metadata */}
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-full px-1">
                {step.date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
