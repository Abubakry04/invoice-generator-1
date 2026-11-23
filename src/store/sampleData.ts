import { Client, Invoice, ProductItem, Settings } from '../types';
import logoImg from '../assets/logo3.png';

export const SAMPLE_LOGO_DATA_URI = logoImg;

export const SAMPLE_SETTINGS: Settings = {
  business: {
    name: 'EgolePay LTD',
    address: '41, Industrial Avenue, Sabo, Yaba, Lagos, Nigeria',
    email: 'hello@egolepay.com',
    phone: '+234 913 933 0394',
    bankDetails: 'Guaranty Trust Bank (GTBank)\nAccount Name: EgolePay LTD\nAccount No: 0123456789\nSort Code: 058152062',
    logo: logoImg,
  },
  defaultCurrency: 'NGN',
  defaultTaxRate: 7.5,
  invoicePrefix: 'INV-',
  accentColor: '#FF7916', // Modern vibrant brand orange
  defaultTemplate: 'modern',
};

export const SAMPLE_CLIENTS: Client[] = [];

export const SAMPLE_PRODUCTS: ProductItem[] = [];

export const SAMPLE_INVOICES: Invoice[] = [];
