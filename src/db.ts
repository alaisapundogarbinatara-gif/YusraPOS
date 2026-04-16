import Dexie, { type Table } from 'dexie';
import { hashPin } from './lib/security';

export interface Service {
  id?: string | number;
  name: string;
  sku: string;
  price: number;
  cost: number; // Cost of materials used
  duration: number; // in minutes
  category: string;
  isFlexiblePrice?: boolean;
  image?: string;
  barcode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Product {
  id?: string | number;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  isFlexiblePrice?: boolean;
  image?: string;
  barcode?: string;
  expiryDate?: number;
  supplierId?: string | number;
  createdAt: number;
  updatedAt: number;
}

export interface Supplier {
  id?: string | number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: number;
}

export interface Staff {
  id?: string | number;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  commissionRate: number; // percentage
  assignedServiceIds?: number[]; // IDs of services they can perform
  createdAt: number;
}

export interface Sale {
  id?: string | number;
  items: Array<{
    serviceId?: number;
    productId?: number;
    staffIds?: number[];
    quantity: number;
    price: number;
    name: string;
    duration?: number;
    type: 'product' | 'service';
  }>;
  total: number;
  subtotal: number;
  discountAmount: number;
  discountPercentage: number;
  paymentMethod: 'cash' | 'e-wallet' | 'credit' | 'bank-transfer';
  type: 'sale' | 'cash-in' | 'cash-out';
  fee?: number;
  customerId?: number;
  appointmentId?: string | number;
  timestamp: number;
  processedBy?: string; // User name or ID
  notes?: string;
  isVoided?: boolean;
  voidedAt?: number;
  voidedBy?: string;
  paidAmount?: number;
  remainingBalance?: number;
  isDebtPayment?: boolean;
}

export interface Customer {
  id?: string | number;
  name: string;
  email?: string;
  phone?: string;
  loyaltyPoints: number;
  creditBalance: number;
  createdAt: number;
}

export interface ZakatRecord {
  id?: number;
  year: number;
  totalWealth: number;
  zakatAmount: number;
  status: 'calculated' | 'paid';
  timestamp: number;
}

export interface AppSettings {
  id?: number;
  storeName: string;
  storeLogo?: string;
  storeAddress?: string;
  storePhone?: string;
  primaryColor: string;
  currency: string;
  goldPricePerGram?: number;
  silverPricePerGram?: number;
  isKioskMode?: boolean;
  showProducts?: boolean;
  showServices?: boolean;
  language?: 'en' | 'ar' | 'tl';
  learnProgress?: number;
}

export interface BiometricCredential {
  id: string;
  publicKey: string;
  counter: number;
  createdAt: number;
}

export interface User {
  id?: number;
  name: string;
  pin: string; // This will now store the SHA-256 hash
  role: 'admin' | 'cashier' | 'staff';
  staffId?: number; // Link to staff record if role is 'staff'
  failedAttempts?: number;
  lockoutUntil?: number;
  biometricCredentials?: BiometricCredential[];
  createdAt: number;
}

export interface Category {
  id?: number;
  name: string;
  createdAt: number;
}

export interface ExpenseCategory {
  id?: string | number;
  name: string;
  createdAt: number;
}

export interface Appointment {
  id?: string | number;
  items: Array<{
    serviceId?: string | number;
    productId?: string | number;
    staffIds?: (string | number)[];
    quantity: number;
    price: number;
    name: string;
    duration?: number;
    type: 'product' | 'service';
  }>;
  staffIds: (string | number)[]; // Primary staff assigned to the appointment
  customerId?: string | number;
  customerName: string;
  customerPhone?: string;
  startTime: number; // timestamp
  endTime: number; // timestamp
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'claimed';
  serviceStatus?: 'no-progress' | 'in-progress' | 'nearly-due' | 'completed';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod?: 'cash' | 'e-wallet' | 'credit' | 'bank-transfer';
  downPayment: number;
  paidAmount?: number;
  subtotal: number;
  discountAmount: number;
  discountPercentage: number;
  totalAmount: number;
  dueDate?: number;
  notes?: string;
  description?: string;
  inventoryDeducted?: boolean;
  createdAt: number;
}

export interface Expense {
  id?: string | number;
  description: string;
  amount: number;
  category: string; // Salary, Food, Rent, Utilities, etc.
  date: number;
  processedBy?: string;
}

export interface Attendance {
  id?: string | number;
  staffId: string | number;
  type: 'clock-in' | 'clock-out' | 'lunch-start' | 'lunch-end' | 'break-start' | 'break-end';
  timestamp: number;
  notes?: string;
}

export interface BusinessEvent {
  id?: string | number;
  title: string;
  type: 'lease' | 'delivery' | 'expiry' | 'essential' | 'other';
  description?: string;
  date: number; // timestamp for the day
  startTime?: number; // optional specific time
  endTime?: number; // optional specific time
  recurrence?: 'none' | 'bi-weekly' | 'monthly' | 'annually';
  recurrenceId?: string; // To group recurring events
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface Shift {
  id?: string | number;
  startTime: number;
  endTime?: number;
  openedBy: string;
  closedBy?: string;
  startingCash: number;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export class POSDatabase extends Dexie {
  services!: Table<Service>;
  products!: Table<Product>;
  staff!: Table<Staff>;
  sales!: Table<Sale>;
  customers!: Table<Customer>;
  zakat!: Table<ZakatRecord>;
  settings!: Table<AppSettings>;
  users!: Table<User>;
  categories!: Table<Category>;
  expenseCategories!: Table<ExpenseCategory>;
  expenses!: Table<Expense>;
  appointments!: Table<Appointment>;
  attendance!: Table<Attendance>;
  businessEvents!: Table<BusinessEvent>;
  suppliers!: Table<Supplier>;
  shifts!: Table<Shift>;

  constructor() {
    super('POSDatabase_v3');
    this.version(1).stores({
      services: '++id, sku, name, category, barcode',
      products: '++id, sku, name, category, barcode, supplierId',
      staff: '++id, name',
      sales: '++id, timestamp, processedBy, type, paymentMethod, isVoided',
      customers: '++id, phone, email',
      zakat: '++id, year',
      settings: '++id',
      users: '++id, pin, role',
      categories: '++id, name',
      expenseCategories: '++id, name',
      expenses: '++id, date, category',
      appointments: '++id, startTime, staffId, serviceId, status',
      attendance: '++id, staffId, timestamp, type',
      businessEvents: '++id, date, type, status',
      suppliers: '++id, name',
      shifts: '++id, startTime, status'
    });
  }
}

export const db = new POSDatabase();

export async function exportData() {
  const data = {
    services: await db.services.toArray(),
    products: await db.products.toArray(),
    staff: await db.staff.toArray(),
    sales: await db.sales.toArray(),
    customers: await db.customers.toArray(),
    zakat: await db.zakat.toArray(),
    settings: await db.settings.toArray(),
    users: await db.users.toArray(),
    categories: await db.categories.toArray(),
    expenseCategories: await db.expenseCategories.toArray(),
    expenses: await db.expenses.toArray(),
    appointments: await db.appointments.toArray(),
    exportDate: Date.now(),
    version: 1
  };
  return JSON.stringify(data);
}

export async function importData(jsonString: string) {
  const data = JSON.parse(jsonString);
  
  await db.transaction('rw', [
    db.services, db.products, db.staff, db.sales, db.customers, db.zakat, 
    db.settings, db.users, db.categories, db.expenseCategories, db.expenses, db.appointments
  ], async () => {
    if (data.services) { await db.services.clear(); await db.services.bulkAdd(data.services); }
    if (data.products) { await db.products.clear(); await db.products.bulkAdd(data.products); }
    if (data.staff) { await db.staff.clear(); await db.staff.bulkAdd(data.staff); }
    if (data.sales) { await db.sales.clear(); await db.sales.bulkAdd(data.sales); }
    if (data.customers) { await db.customers.clear(); await db.customers.bulkAdd(data.customers); }
    if (data.zakat) { await db.zakat.clear(); await db.zakat.bulkAdd(data.zakat); }
    if (data.settings) { await db.settings.clear(); await db.settings.bulkAdd(data.settings); }
    if (data.users) { await db.users.clear(); await db.users.bulkAdd(data.users); }
    if (data.categories) { await db.categories.clear(); await db.categories.bulkAdd(data.categories); }
    if (data.expenseCategories) { await db.expenseCategories.clear(); await db.expenseCategories.bulkAdd(data.expenseCategories); }
    if (data.expenses) { await db.expenses.clear(); await db.expenses.bulkAdd(data.expenses); }
    if (data.appointments) { await db.appointments.clear(); await db.appointments.bulkAdd(data.appointments); }
  });
}

export async function clearAllTransactions() {
  await db.sales.clear();
  await db.expenses.clear();
  await db.zakat.clear();
  await db.appointments.clear();
}

export async function resetAllData() {
  await db.transaction('rw', [
    db.services, db.products, db.staff, db.sales, db.customers, db.zakat, 
    db.categories, db.expenseCategories, db.expenses, db.appointments, db.attendance, db.users
  ], async () => {
    await db.services.clear();
    await db.products.clear();
    await db.staff.clear();
    await db.sales.clear();
    await db.customers.clear();
    await db.zakat.clear();
    await db.categories.clear();
    await db.expenseCategories.clear();
    await db.expenses.clear();
    await db.appointments.clear();
    await db.attendance.clear();
  });
}

export async function seedData() {
  // Clear existing data as requested by user
  const hasCleared = localStorage.getItem('data_cleared_v3');
  if (!hasCleared) {
    await db.sales.clear();
    await db.expenses.clear();
    await db.zakat.clear();
    localStorage.setItem('data_cleared_v3', 'true');
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      storeName: 'ServicePOS',
      primaryColor: '#6366f1', // Indigo
      currency: 'PHP',
      goldPricePerGram: 3800,
      showProducts: true,
      showServices: true,
      language: 'en'
    });
  }

  const userCount = await db.users.count();
  if (userCount === 0) {
    const hashedPin = await hashPin('1234');
    await db.users.add({
      name: 'Admin',
      pin: hashedPin,
      role: 'admin',
      failedAttempts: 0,
      createdAt: Date.now()
    });
  }

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    const defaultCategories = ['Hair', 'Nails', 'Massage', 'Facial', 'Consultation', 'Other'];
    await db.categories.bulkAdd(defaultCategories.map(name => ({ name, createdAt: Date.now() })));
  }

  const expenseCategoryCount = await db.expenseCategories.count();
  if (expenseCategoryCount === 0) {
    const defaultExpenseCategories = [
      'Salary',
      'Food',
      'Rent',
      'Utilities',
      'Supplies',
      'Maintenance',
      'Marketing',
      'Taxes',
      'Other'
    ];
    await db.expenseCategories.bulkAdd(defaultExpenseCategories.map(name => ({ name, createdAt: Date.now() })));
  }

  const staffCount = await db.staff.count();
  if (staffCount === 0) {
    await db.staff.add({
      name: 'Default Staff',
      role: 'Specialist',
      commissionRate: 10,
      createdAt: Date.now()
    });
  }
}
