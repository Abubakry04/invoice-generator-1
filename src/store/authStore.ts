import { create } from 'zustand';
import { UserProfile } from '../types';
import { useBusinessStore } from './businessStore';

// Purge any legacy stored auth flags from localStorage and sessionStorage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('egolepay-auth');
    localStorage.removeItem('egolepay-auth-session');
    sessionStorage.removeItem('egolepay-auth');
    sessionStorage.removeItem('egolepay-auth-session');
  } catch {
    // Ignore storage access errors
  }
}

interface RegisterData {
  name: string;
  email: string;
  businessName: string;
  password?: string;
}

interface AuthState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, name?: string, role?: 'owner' | 'admin' | 'member') => void;
  register: (data: RegisterData) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  isAuthenticated: false,

  login: (email: string, name?: string, role = 'owner') => {
    const userName = name || (email.split('@')[0] ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : 'Demo User');
    set({
      currentUser: {
        id: `usr-${Date.now()}`,
        name: userName,
        email,
        role,
      },
      isAuthenticated: true,
    });
  },

  register: ({ name, email, businessName }) => {
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role: 'owner',
    };

    // Create or update active business profile
    useBusinessStore.getState().addBusiness({
      name: businessName,
      email,
      phone: '+234 800 000 0000',
      address: 'Lagos, Nigeria',
      defaultCurrency: 'NGN',
      defaultTaxRate: 7.5,
      defaultPaymentTermsDays: 14,
      invoicePrefix: businessName.slice(0, 3).toUpperCase() + '-',
      accentColor: '#FF7916',
      defaultTemplate: 'modern',
    });

    set({
      currentUser: newUser,
      isAuthenticated: true,
    });
  },

  logout: () => {
    set({
      currentUser: null,
      isAuthenticated: false,
    });
  },

  updateProfile: (updates) => {
    set((state) => ({
      currentUser: state.currentUser ? { ...state.currentUser, ...updates } : null,
    }));
  },
}));
