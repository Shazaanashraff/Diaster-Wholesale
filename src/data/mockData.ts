import { 
  Code2, 
  Gamepad2, 
  Gift, 
  Globe, 
  Server,
  MonitorCheck
} from 'lucide-react';

export interface Product {
  id: string;
  item_code: string;
  name: string;
  model: string;
  description: string;
  category: string;
  wholesale_price: number;
  retail_price: number;
  pieces_per_carton: number;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  creditBalance: number;
}

export interface Category {
  id: string;
  name: string;
  icon: any;
}

export const CATEGORIES: Category[] = [
  { id: 'all', name: 'All Products', icon: Code2 },
  { id: 'software', name: 'Software', icon: MonitorCheck },
  { id: 'gaming', name: 'Gaming', icon: Gamepad2 },
  { id: 'giftcards', name: 'Gift Cards', icon: Gift },
  { id: 'cloud', name: 'Cloud & Hosting', icon: Server },
  { id: 'subscriptions', name: 'Subscriptions', icon: Globe },
];

export const PRODUCTS: Product[] = [
  {
    id: '1',
    item_code: 'SW-PRO-11',
    name: 'Windows 11 Pro License',
    model: 'Global Retail',
    description: 'Lifetime activation key for Windows 11 Professional.',
    category: 'software',
    wholesale_price: 45.00,
    retail_price: 89.00,
    pieces_per_carton: 10,
    created_at: '2024-01-15',
  },
  {
    id: '2',
    item_code: 'CC-YEAR-AD',
    name: 'Adobe Creative Cloud',
    model: '12 Month Sub',
    description: 'Full suite access for 1 user, 100GB cloud storage.',
    category: 'software',
    wholesale_price: 320.00,
    retail_price: 549.00,
    pieces_per_carton: 10,
    created_at: '2024-02-10',
  },
  {
    id: '3',
    item_code: 'GG-PSN-100',
    name: 'PSN $100 Gift Card',
    model: 'US Region',
    description: 'Digital code for PlayStation Store US accounts.',
    category: 'giftcards',
    wholesale_price: 88.00,
    retail_price: 100.00,
    pieces_per_carton: 10,
    created_at: '2024-03-01',
  },
  {
    id: '4',
    item_code: 'GM-FC24-ULT',
    name: 'EA Sports FC 24',
    model: 'Ultimate Edition',
    description: 'Digital key for EA App (PC) platform.',
    category: 'gaming',
    wholesale_price: 42.00,
    retail_price: 69.99,
    pieces_per_carton: 10,
    created_at: '2024-03-05',
  },
  {
    id: '5',
    item_code: 'CL-AWS-500',
    name: 'AWS Credit Voucher',
    model: '$500 Credit',
    description: 'Redeemable credit for Amazon Web Services.',
    category: 'cloud',
    wholesale_price: 350.00,
    retail_price: 480.00,
    pieces_per_carton: 10,
    created_at: '2024-03-12',
  },
  {
    id: '6',
    item_code: 'SB-SPOT-FAM',
    name: 'Spotify Family Premium',
    model: '6 Months Plan',
    description: 'Premium subscription for up to 6 family members.',
    category: 'subscriptions',
    wholesale_price: 32.00,
    retail_price: 54.00,
    pieces_per_carton: 10,
    created_at: '2024-03-15',
  },
];

export const CUSTOMERS: Customer[] = [
  { id: '1', name: 'Walk-in Customer', phone: '-', creditBalance: 0 },
  { id: '2', name: 'Rijal', phone: '+62 1234 5678', creditBalance: 15400 },
];
