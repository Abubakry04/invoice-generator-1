import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  UserProfile,
  BusinessProfile,
  Invoice,
  Customer,
  ProductItem,
  SubscriptionState,
} from '../types';
import { useBusinessStore, DEFAULT_BUSINESS } from './businessStore';
import { useInvoiceStore } from './invoiceStore';
import { useCustomerStore } from './customerStore';
import { useProductStore } from './productStore';
import { useSubscriptionStore } from './subscriptionStore';

export interface UserAccountWorkspace {
  user: UserProfile;
  password?: string;
  businesses: BusinessProfile[];
  activeBusinessId: string;
  invoices: Invoice[];
  customers: Customer[];
  products: ProductItem[];
  subscription: SubscriptionState;
}

const ACCOUNTS_STORAGE_KEY = 'egolepay-user-accounts';

function loadAccountsFromStorage(): Record<string, UserAccountWorkspace> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage parse errors
  }
  return {
    'hello@egolepay.com': {
      user: {
        id: 'usr-default-01',
        name: 'EgolePay Admin',
        email: 'hello@egolepay.com',
        role: 'owner',
      },
      businesses: [DEFAULT_BUSINESS],
      activeBusinessId: DEFAULT_BUSINESS.id,
      invoices: [],
      customers: [],
      products: [],
      subscription: {
        planId: 'business',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        invoicesCreatedThisMonth: 0,
      },
    },
  };
}

function saveAccountsToStorage(accounts: Record<string, UserAccountWorkspace>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage write errors
  }
}

interface RegisterData {
  name: string;
  email: string;
  businessName: string;
  phone?: string;
  password?: string;
}

interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string, name?: string, role?: 'owner' | 'admin' | 'member') => void;
  register: (data: RegisterData) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  saveActiveWorkspace: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,

      saveActiveWorkspace: () => {
        const current = get().currentUser;
        if (!current || !current.email) return;

        const normEmail = current.email.trim().toLowerCase();
        const accounts = loadAccountsFromStorage();
        const existing = accounts[normEmail];

        const updatedAccount: UserAccountWorkspace = {
          user: current,
          password: existing?.password,
          businesses: useBusinessStore.getState().businesses,
          activeBusinessId: useBusinessStore.getState().activeBusinessId,
          invoices: useInvoiceStore.getState().invoices,
          customers: useCustomerStore.getState().customers,
          products: useProductStore.getState().products,
          subscription: useSubscriptionStore.getState().subscription,
        };

        accounts[normEmail] = updatedAccount;
        saveAccountsToStorage(accounts);
      },

      login: (email: string, password?: string, name?: string, role = 'owner') => {
        const normEmail = email.trim().toLowerCase();

        // Save current active workspace before switching
        get().saveActiveWorkspace();

        const accounts = loadAccountsFromStorage();
        let account = accounts[normEmail];

        if (!account) {
          const derivedName =
            name ||
            (normEmail.split('@')[0]
              ? normEmail.split('@')[0].charAt(0).toUpperCase() + normEmail.split('@')[0].slice(1)
              : 'Workspace User');

          const isEgolePay = normEmail === 'hello@egolepay.com' || normEmail === 'admin@egolepay.com';
          const initialBiz: BusinessProfile = isEgolePay
            ? DEFAULT_BUSINESS
            : {
                id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: `${derivedName}'s Business`,
                email: normEmail,
                phone: '+234 800 000 0000',
                address: 'Lagos, Nigeria',
                defaultCurrency: 'NGN',
                defaultTaxRate: 7.5,
                defaultPaymentTermsDays: 14,
                invoicePrefix: 'INV-',
                accentColor: '#FF7916',
                defaultTemplate: 'modern',
                createdAt: new Date().toISOString(),
              };

          account = {
            user: {
              id: `usr-${Date.now()}`,
              name: derivedName,
              email: normEmail,
              role: role as any,
            },
            password,
            businesses: [initialBiz],
            activeBusinessId: initialBiz.id,
            invoices: [],
            customers: [],
            products: [],
            subscription: {
              planId: 'free',
              status: 'active',
              currentPeriodStart: new Date().toISOString(),
              currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
              invoicesCreatedThisMonth: 0,
            },
          };

          accounts[normEmail] = account;
          saveAccountsToStorage(accounts);
        }

        // Load into active stores
        useBusinessStore.getState().setBusinesses(account.businesses, account.activeBusinessId);
        useInvoiceStore.getState().setInvoices(account.invoices || []);
        useCustomerStore.getState().setCustomers(account.customers || []);
        useProductStore.getState().setProducts(account.products || []);
        useSubscriptionStore.getState().setSubscription(
          account.subscription || {
            planId: 'free',
            status: 'active',
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
            invoicesCreatedThisMonth: (account.invoices || []).length,
          }
        );

        set({
          currentUser: account.user,
          isAuthenticated: true,
        });
      },

      register: ({ name, email, businessName, phone, password }) => {
        // Save current active workspace before switching
        get().saveActiveWorkspace();

        const normEmail = email.trim().toLowerCase();
        const accounts = loadAccountsFromStorage();

        const newUser: UserProfile = {
          id: `usr-${Date.now()}`,
          name: name.trim(),
          email: normEmail,
          phone: phone?.trim(),
          role: 'owner',
        };

        const newBiz: BusinessProfile = {
          id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: businessName.trim(),
          email: normEmail,
          phone: phone?.trim() || '+234 800 000 0000',
          address: 'Lagos, Nigeria',
          defaultCurrency: 'NGN',
          defaultTaxRate: 7.5,
          defaultPaymentTermsDays: 14,
          invoicePrefix: (businessName.trim().slice(0, 3).toUpperCase() || 'INV') + '-',
          accentColor: '#FF7916',
          defaultTemplate: 'modern',
          createdAt: new Date().toISOString(),
        };

        const newAccount: UserAccountWorkspace = {
          user: newUser,
          password,
          businesses: [newBiz],
          activeBusinessId: newBiz.id,
          invoices: [],
          customers: [],
          products: [],
          subscription: {
            planId: 'free',
            status: 'active',
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
            invoicesCreatedThisMonth: 0,
          },
        };

        accounts[normEmail] = newAccount;
        saveAccountsToStorage(accounts);

        // Apply to active stores immediately
        useBusinessStore.getState().setBusinesses([newBiz], newBiz.id);
        useInvoiceStore.getState().setInvoices([]);
        useCustomerStore.getState().setCustomers([]);
        useProductStore.getState().setProducts([]);
        useSubscriptionStore.getState().setSubscription(newAccount.subscription);

        set({
          currentUser: newUser,
          isAuthenticated: true,
        });
      },

      logout: () => {
        get().saveActiveWorkspace();

        useBusinessStore.getState().setBusinesses([DEFAULT_BUSINESS], DEFAULT_BUSINESS.id);
        useInvoiceStore.getState().setInvoices([]);
        useCustomerStore.getState().setCustomers([]);
        useProductStore.getState().setProducts([]);

        set({
          currentUser: null,
          isAuthenticated: false,
        });

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('egolepay-auth-session');
        }
      },

      updateProfile: (updates) => {
        set((state) => {
          const updatedUser = state.currentUser ? { ...state.currentUser, ...updates } : null;
          return { currentUser: updatedUser };
        });
        get().saveActiveWorkspace();
      },
    }),
    {
      name: 'egolepay-auth-session',
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && state?.currentUser?.email) {
          const normEmail = state.currentUser.email.trim().toLowerCase();
          const accounts = loadAccountsFromStorage();
          const account = accounts[normEmail];
          if (account) {
            useBusinessStore.getState().setBusinesses(account.businesses, account.activeBusinessId);
            useInvoiceStore.getState().setInvoices(account.invoices || []);
            useCustomerStore.getState().setCustomers(account.customers || []);
            useProductStore.getState().setProducts(account.products || []);
            useSubscriptionStore.getState().setSubscription(account.subscription);
          }
        }
      },
    }
  )
);

// Auto-sync stores to active account on state changes
if (typeof window !== 'undefined') {
  useInvoiceStore.subscribe(() => {
    useAuthStore.getState().saveActiveWorkspace();
  });
  useCustomerStore.subscribe(() => {
    useAuthStore.getState().saveActiveWorkspace();
  });
  useProductStore.subscribe(() => {
    useAuthStore.getState().saveActiveWorkspace();
  });
  useBusinessStore.subscribe(() => {
    useAuthStore.getState().saveActiveWorkspace();
  });
  useSubscriptionStore.subscribe(() => {
    useAuthStore.getState().saveActiveWorkspace();
  });
}
