import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BusinessProfile } from '../types';
import { SAMPLE_LOGO_DATA_URI } from './sampleData';

interface BusinessState {
  businesses: BusinessProfile[];
  activeBusinessId: string;

  // Selectors & Actions
  getActiveBusiness: () => BusinessProfile;
  updateActiveBusiness: (updates: Partial<BusinessProfile>) => void;
  setActiveBusiness: (businessId: string) => void;
  setBusinesses: (businesses: BusinessProfile[], activeId?: string) => void;
  addBusiness: (business: Omit<BusinessProfile, 'id' | 'createdAt'>) => BusinessProfile;
  resetToDefault: () => void;
}

export const DEFAULT_BUSINESS: BusinessProfile = {
  id: 'biz-default-01',
  name: 'EgolePay LTD',
  email: 'hello@egolepay.com',
  phone: '+234 913 933 0394',
  address: '41, Industrial Avenue, Sabo, Yaba, Lagos, Nigeria',
  website: 'https://egolepay.com',
  taxId: 'TIN-98765432-0001',
  bankDetails:
    'Guaranty Trust Bank (GTBank)\nAccount Name: EgolePay LTD\nAccount No: 0123456789\nSort Code: 058152062',
  logo: SAMPLE_LOGO_DATA_URI,
  defaultCurrency: 'NGN',
  defaultTaxRate: 7.5,
  defaultPaymentTermsDays: 14,
  invoicePrefix: 'INV-',
  accentColor: '#FF7916',
  defaultTemplate: 'minimal',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Purge any legacy demo secondary businesses from browser localStorage
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem('egolepay-business');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.state?.businesses)) {
        parsed.state.businesses = parsed.state.businesses.filter(
          (b: any) => b.id !== 'biz-demo-02'
        );
        localStorage.setItem('egolepay-business', JSON.stringify(parsed));
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set, get) => ({
      businesses: [DEFAULT_BUSINESS],
      activeBusinessId: DEFAULT_BUSINESS.id,

      getActiveBusiness: () => {
        const { businesses, activeBusinessId } = get();
        return (
          businesses.find((b) => b.id === activeBusinessId) ||
          businesses[0] ||
          DEFAULT_BUSINESS
        );
      },

      updateActiveBusiness: (updates) => {
        set((state) => ({
          businesses: state.businesses.map((b) =>
            b.id === state.activeBusinessId ? { ...b, ...updates } : b
          ),
        }));
      },

      setActiveBusiness: (businessId: string) => {
        set({ activeBusinessId: businessId });
      },

      setBusinesses: (businesses: BusinessProfile[], activeId?: string) => {
        set({
          businesses: businesses.length > 0 ? businesses : [DEFAULT_BUSINESS],
          activeBusinessId: activeId || businesses[0]?.id || DEFAULT_BUSINESS.id,
        });
      },

      addBusiness: (businessData) => {
        const newBiz: BusinessProfile = {
          ...businessData,
          id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          businesses: [...state.businesses, newBiz],
          activeBusinessId: newBiz.id,
        }));
        return newBiz;
      },

      resetToDefault: () => {
        set({
          businesses: [DEFAULT_BUSINESS],
          activeBusinessId: DEFAULT_BUSINESS.id,
        });
      },
    }),
    {
      name: 'egolepay-business',
    }
  )
);

