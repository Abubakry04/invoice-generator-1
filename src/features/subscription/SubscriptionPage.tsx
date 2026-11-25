import React from 'react';
import {
  CreditCard,
  Zap,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  useSubscriptionStore,
  SUBSCRIPTION_PLANS,
} from '../../store/subscriptionStore';
import { useUiStore } from '../../store/uiStore';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { SubscriptionPlanId } from '../../types';

export const SubscriptionPage: React.FC = () => {
  const {
    subscription,
    getCurrentPlan,
    getRemainingInvoices,
    upgradePlan,
  } = useSubscriptionStore();
  const { openModal } = useUiStore();
  const toast = useToast();

  const currentPlan = getCurrentPlan();
  const remaining = getRemainingInvoices();
  const usageCount = subscription.invoicesCreatedThisMonth;
  const limit = currentPlan.invoiceLimit;
  const isUnlimited = limit === Infinity;

  // When unmetered (Business plan), show 0% when empty, or an active volume representation
  const usagePercent = isUnlimited
    ? usageCount === 0
      ? 0
      : Math.min(100, Math.round((usageCount / 50) * 100))
    : Math.min(100, Math.round((usageCount / limit) * 100));

  const planList = Object.values(SUBSCRIPTION_PLANS);

  const handleSwitchPlan = (planId: SubscriptionPlanId) => {
    upgradePlan(planId);
    toast.success(
      `🎉 Workspace switched to ${SUBSCRIPTION_PLANS[planId].name}! All ${planId} features are now active.`
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Subscription & Plans
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your workspace billing tier, monitor monthly usage, and scale your invoicing limits.
        </p>
      </div>

      {/* 2. Current Subscription Overview Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/80 text-[#FF7916] flex items-center justify-center font-bold text-lg shrink-0">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {currentPlan.name}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase">
                  {subscription.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Quick Switch Pills */}
            {/* <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-semibold text-slate-400 px-1.5">Active Plan:</span>
              {(['free', 'starter', 'business'] as SubscriptionPlanId[]).map((pid) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => handleSwitchPlan(pid)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                    subscription.planId === pid
                      ? pid === 'business'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : pid === 'starter'
                        ? 'bg-[#FF7916] text-white shadow-xs'
                        : 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                  }`}
                >
                  {pid}
                </button>
              ))}
            </div> */}
          </div>
        </div>

        {/* Usage Progress Bar */}
        <div className="pt-6">
          <div className="flex items-center justify-between text-xs mb-2 gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
              Monthly Invoices
            </span>
            <span className="font-mono text-slate-500 text-right text-[11px] sm:text-xs truncate">
              {usageCount} / {isUnlimited ? 'Unlimited' : limit} ({isUnlimited ? 'Unmetered' : `${remaining} left`})
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 animate-progress-fill ${
                isUnlimited
                  ? 'bg-purple-600'
                  : usagePercent >= 90
                  ? 'bg-rose-500'
                  : usagePercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-[#FF7916]'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            Usage automatically resets on the 1st of every month. Upgrade to Starter or Business for higher volume.
          </p>
        </div>
      </div>

      {/* 3. Available Plan Tiers */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Available Subscription Tiers
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planList.map((plan, planIdx) => {
            const isCurrent = subscription.planId === plan.id;
            const borderStyle = isCurrent
              ? plan.id === 'business'
                ? 'border-purple-500 bg-purple-50/20 dark:bg-purple-950/20 shadow-md ring-2 ring-purple-500/20'
                : plan.id === 'starter'
                ? 'border-[#FF7916] bg-orange-50/20 dark:bg-orange-950/20 shadow-md ring-2 ring-[#FF7916]/20'
                : 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between border card-hover-elevate animate-fade-in-up ${
                  planIdx === 0 ? 'stagger-1' : planIdx === 1 ? 'stagger-2' : 'stagger-3'
                } ${borderStyle}`}
              >
                {isCurrent && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-[10px] font-extrabold uppercase tracking-wider shadow-xs flex items-center gap-1.5 ${
                      plan.id === 'business'
                        ? 'bg-purple-600'
                        : plan.id === 'starter'
                        ? 'bg-[#FF7916]'
                        : 'bg-emerald-600'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-beacon" />
                    Active Plan
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {isCurrent ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Current
                      </span>
                    ) : (
                      plan.id === 'starter' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          Popular
                        </span>
                      )
                    )}
                  </div>

                  <div className="my-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">/month</span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 min-h-[32px]">
                    {plan.id === 'free'
                      ? 'Best for freelancers getting started with essential invoicing.'
                      : plan.id === 'starter'
                      ? 'Ideal for growing businesses requiring custom branding and online client payments.'
                      : 'Full scale invoicing for teams, high volumes, and multi-business setups.'}
                  </p>

                  <ul className="space-y-3 mb-8 text-xs text-slate-600 dark:text-slate-300">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleSwitchPlan(plan.id)}
                    disabled={isCurrent}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : plan.id === 'business'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 cursor-pointer'
                        : 'bg-[#FF7916] hover:bg-[#ea580c] text-white shadow-md shadow-[#FF7916]/25 cursor-pointer'
                    }`}
                  >
                    {isCurrent ? 'Current Plan' : `Switch to ${plan.name}`}
                  </button>

                  {!isCurrent && plan.id !== 'free' && (
                    <button
                      type="button"
                      onClick={() => openModal('upgrade', { targetPlan: plan.id })}
                      className="w-full text-center text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1"
                    >
                      Simulate Payment Flow →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

