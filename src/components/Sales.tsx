import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Search, 
  Barcode, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote,
  UserPlus,
  Award,
  CheckCircle2,
  Wallet,
  QrCode,
  X,
  Printer,
  Download,
  Check,
  Receipt,
  Wrench,
  Package,
  ArrowLeftRight,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, type Service, type Product, type Sale, type Customer, type User, type Staff } from '../db';
import QRScanner from './QRScanner';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

interface CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  type: 'product' | 'service';
  staffIds?: (string | number)[];
  duration?: number;
  appointmentId?: string | number;
  isFlexiblePrice?: boolean;
}

interface SalesProps {
  currentUser: User;
}

export default function Sales({ currentUser }: SalesProps) {
  const { t } = useLanguage();
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const appointments = useLiveQuery(() => db.appointments.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toArray().then(s => s[0])) || {
    storeName: 'Qadar Printing',
    storeAddress: '123 Business St.',
    storePhone: '+63 123 456 7890',
    currency: 'PHP',
    showProducts: true,
    showServices: true
  };
  
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemData, setNewItemData] = useState({
    name: '',
    price: '',
    cost: '0',
    category: 'Other',
    type: 'service' as 'service' | 'product',
    duration: '30',
    stock: '0',
    barcode: '',
    isFlexiblePrice: false
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isSelectingCustomer, setIsSelectingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [paymentStep, setPaymentStep] = useState<'cart' | 'payment' | 'success'>('cart');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'e-wallet' | 'credit' | 'bank-transfer'>('cash');
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'services' | 'cart' | 'cash-services' | 'unpaid'>('all');

  const availableTabs = [
    'all',
    ...(settings?.showServices !== false ? ['services'] : []),
    ...(settings?.showProducts !== false ? ['products'] : []),
    'cart',
    'cash-services',
    ...(settings?.showServices !== false ? ['unpaid'] : [])
  ] as const;

  const handleSwipe = (direction: 'left' | 'right') => {
    const currentIndex = availableTabs.indexOf(activeTab as any);
    if (currentIndex === -1) return;

    if (direction === 'left') {
      const nextIndex = (currentIndex + 1) % availableTabs.length;
      setActiveTab(availableTabs[nextIndex] as any);
    } else {
      const prevIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
      setActiveTab(availableTabs[prevIndex] as any);
    }
  };

  useEffect(() => {
    if (settings) {
      if (settings.showServices === false && activeTab === 'services') {
        setActiveTab('products');
      } else if (settings.showProducts === false && activeTab === 'products') {
        setActiveTab('services');
      }
    }
  }, [settings]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [saleNotes, setSaleNotes] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  
  // Payment Type: Full or Down Payment
  const [paymentType, setPaymentType] = useState<'full' | 'down-payment'>('full');
  const [downPaymentAmount, setDownPaymentAmount] = useState<string>('');

  // Cash-in/out state
  const [cashServiceType, setCashServiceType] = useState<'cash-in' | 'cash-out'>('cash-in');
  const [cashServiceAmount, setCashServiceAmount] = useState<string>('');
  const [cashServiceFee, setCashServiceFee] = useState<string>('');

  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getExpiryStatus = (expiryDate?: number) => {
    if (!expiryDate) return null;
    const now = Date.now();
    const diff = expiryDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { label: 'Expired', color: 'text-red-600' };
    if (days <= 30) return { label: `Expiring soon (${days}d)`, color: 'text-amber-600' };
    return null;
  };

  // Filter services
  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.barcode?.includes(searchTerm);
    return matchesSearch;
  });

  const unpaidAppointments = appointments.filter(app => 
    (app.status === 'completed' || app.status === 'claimed') && app.paymentStatus !== 'paid'
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.barcode?.includes(searchTerm)
  );

  const combinedItems = [
    ...filteredServices.map(s => ({ ...s, type: 'service' as const })),
    ...filteredProducts.map(p => ({ ...p, type: 'product' as const }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone?.includes(customerSearch)
  );

  const addToCart = (item: Service | Product, type: 'product' | 'service') => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.type === type);
      if (existing) {
        return prev.map(i => 
          (i.id === item.id && i.type === type) ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { 
        id: item.id!, 
        name: item.name, 
        price: item.price, 
        quantity: 1, 
        type,
        staffIds: type === 'service' ? [] : undefined,
        duration: type === 'service' ? (item as Service).duration : undefined,
        isFlexiblePrice: item.isFlexiblePrice
      }];
    });
    if (window.innerWidth < 1024) {
      toast.success(`Added ${item.name}`);
    }
  };

  const removeFromCart = (id: string | number, type: 'product' | 'service') => {
    setCart(prev => prev.filter(item => !(item.id === id && item.type === type)));
  };

  const updateQuantity = (id: string | number, type: 'product' | 'service', delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id && i.type === type);
      if (item && item.quantity + delta <= 0) {
        return prev.filter(i => !(i.id === id && i.type === type));
      }
      return prev.map(item => {
        if (item.id === id && item.type === type) {
          return { ...item, quantity: item.quantity + delta };
        }
        return item;
      });
    });
  };

  const handleManualQuantity = (id: string | number, type: 'product' | 'service', value: string) => {
    if (value === '') {
      setCart(prev => prev.map(item => {
        if (item.id === id && item.type === type) {
          return { ...item, quantity: 0 };
        }
        return item;
      }));
      return;
    }

    const qty = parseInt(value);
    if (isNaN(qty) || qty < 0) return;
    
    setCart(prev => prev.map(item => {
      if (item.id === id && item.type === type) {
        return { ...item, quantity: qty };
      }
      return item;
    }));
  };

  const handleManualPrice = (id: string | number, type: 'product' | 'service', value: string) => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) return;
    
    setCart(prev => prev.map(item => {
      if (item.id === id && item.type === type) {
        return { ...item, price };
      }
      return item;
    }));
  };

  const toggleStaff = (id: string | number, staffId: string | number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id && item.type === 'service') {
        const currentIds = item.staffIds || [];
        const newIds = currentIds.includes(staffId)
          ? currentIds.filter(sid => sid !== staffId)
          : [...currentIds, staffId];
        return { ...item, staffIds: newIds };
      }
      return item;
    }));
  };

  const handleBarcodeSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm) {
      const barcodeProduct = products.find(p => p.barcode === searchTerm);
      const barcodeService = services.find(s => s.barcode === searchTerm);
      
      if (barcodeProduct) {
        addToCart(barcodeProduct, 'product');
        setSearchTerm('');
        toast.success(`Added ${barcodeProduct.name} via barcode`);
      } else if (barcodeService) {
        addToCart(barcodeService, 'service');
        setSearchTerm('');
        toast.success(`Added ${barcodeService.name} via barcode`);
      }
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const loyaltyDiscount = usePoints ? 10 : 0;
  const manualDiscountPercent = parseFloat(discountPercent) || 0;
  const manualDiscountAmt = parseFloat(discountAmount) || 0;
  
  let totalDiscount = loyaltyDiscount;
  if (manualDiscountPercent > 0) {
    totalDiscount += (subtotal * manualDiscountPercent) / 100;
  } else if (manualDiscountAmt > 0) {
    totalDiscount += manualDiscountAmt;
  }
  
  const total = Math.max(0, subtotal - totalDiscount);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemData.name || !newItemData.price) return;

    try {
      const price = parseFloat(newItemData.price);
      const cost = parseFloat(newItemData.cost) || 0;
      const sku = `SKU-${Date.now()}`;
      const now = Date.now();

      const itemData: any = {
        name: newItemData.name,
        sku,
        price,
        cost,
        category: newItemData.category,
        barcode: newItemData.barcode || undefined,
        isFlexiblePrice: newItemData.isFlexiblePrice,
        createdAt: now,
        updatedAt: now
      };

      if (newItemData.type === 'service') {
        itemData.duration = parseInt(newItemData.duration) || 30;
        await db.services.add(itemData);
      } else {
        itemData.stock = parseInt(newItemData.stock) || 0;
        await db.products.add(itemData);
      }
      
      setIsAddingItem(false);
      setNewItemData({
        name: '',
        price: '',
        cost: '0',
        category: 'Other',
        type: 'service',
        duration: '30',
        stock: '0',
        barcode: '',
        isFlexiblePrice: false
      });
      toast.success(`New ${newItemData.type} added`);
    } catch (error) {
      toast.error(`Failed to add ${newItemData.type}`);
    }
  };

  const handlePreviewReceipt = () => {
    const activeCart = cart.filter(item => item.quantity > 0);
    if (activeCart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const previewSale: Sale = {
      items: activeCart.map(item => ({
        serviceId: item.type === 'service' ? item.id : (undefined as any),
        productId: item.type === 'product' ? item.id : (undefined as any),
        staffIds: item.staffIds as any,
        quantity: item.quantity,
        price: item.price,
        name: item.name,
        duration: item.duration,
        type: item.type
      })),
      subtotal,
      discountAmount: totalDiscount,
      discountPercentage: manualDiscountPercent,
      total: total,
      paymentMethod,
      type: 'sale',
      customerId: selectedCustomer?.id as any,
      timestamp: Date.now(),
      processedBy: currentUser.name,
      notes: saleNotes
    };
    setLastSale(previewSale);
    setIsReceiptOpen(true);
  };

  const handleCheckout = async () => {
    const activeCart = cart.filter(item => item.quantity > 0);
    if (activeCart.length === 0) return;

    try {
      // If payment method is credit, the paid amount is 0
      // If it's a down payment, the paid amount is the down payment
      // Otherwise it's the full total
      let paidAmount = total;
      if (paymentMethod === 'credit') {
        paidAmount = 0;
      } else if (paymentType === 'down-payment') {
        paidAmount = parseFloat(downPaymentAmount) || 0;
      }

      const remainingBalance = total - paidAmount;
      
      const sale: Sale = {
        items: activeCart.map(item => ({
          serviceId: item.type === 'service' ? item.id : undefined,
          productId: item.type === 'product' ? item.id : undefined,
          staffIds: item.staffIds,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          duration: item.duration,
          type: item.type
        })),
        subtotal,
        discountAmount: totalDiscount,
        discountPercentage: manualDiscountPercent,
        total: total, // Record the FULL total as revenue (including credit)
        paymentMethod,
        type: 'sale',
        customerId: selectedCustomer?.id,
        timestamp: Date.now(),
        processedBy: currentUser.name,
        notes: saleNotes,
        paidAmount,
        remainingBalance
      };

      const saleId = await db.sales.add(sale);

      // Update stock for products
      for (const item of activeCart) {
        if (item.type === 'product' && !item.appointmentId) {
          const product = products.find(p => p.id === item.id);
          if (product) {
            const newStock = Math.max(0, product.stock - item.quantity);
            await db.products.update(item.id, { stock: newStock });
          }
        }
      }

      // Update linked appointments
      const appointmentIds = [...new Set(activeCart.filter(i => i.appointmentId).map(i => i.appointmentId))];
      for (const appId of appointmentIds) {
        const linkedApp = appointments.find(app => app.id === appId);
        if (linkedApp) {
          // Calculate how much of this payment goes to this appointment
          const appItemsTotal = activeCart
            .filter(i => i.appointmentId === appId)
            .reduce((acc, i) => acc + (i.price * i.quantity), 0);
          
          const newPaidAmount = (linkedApp.paidAmount || 0) + appItemsTotal;
          const isFullyPaid = newPaidAmount >= linkedApp.totalAmount;
          const appUpdate: any = {
            paidAmount: newPaidAmount,
            paymentStatus: isFullyPaid ? 'paid' : 'partial'
          };
          await db.appointments.update(linkedApp.id!, appUpdate);
        }
      }

      // Update loyalty points and credit balance
      if (selectedCustomer) {
        let newPoints = selectedCustomer.loyaltyPoints;
        if (usePoints) {
          newPoints -= 500;
        }
        const pointsEarned = Math.floor(paidAmount);
        
        const updateData: any = {
          loyaltyPoints: Math.max(0, newPoints + pointsEarned)
        };

        // Add remaining balance to debt if any
        if (remainingBalance > 0) {
          updateData.creditBalance = (selectedCustomer.creditBalance || 0) + remainingBalance;
        }

        await db.customers.update(selectedCustomer.id!, updateData);
      }

      setLastSale({ ...sale, id: saleId });
      setIsReceiptOpen(true);
      setPaymentStep('success');
      setCart([]);
      setSelectedCustomer(null);
      setUsePoints(false);
      setPaymentType('full');
      setDownPaymentAmount('');
      setSaleNotes('');
      toast.success('Transaction completed successfully');
    } catch (error) {
      toast.error('Checkout failed');
    }
  };

  const handleCashService = async () => {
    const amount = parseFloat(cashServiceAmount);
    const fee = parseFloat(cashServiceFee) || 0;
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const sale: Sale = {
        items: [{
          serviceId: 0,
          quantity: 1,
          price: amount + fee,
          name: cashServiceType === 'cash-in' ? 'Cash-In Service' : 'Cash-Out Service',
          type: 'service'
        }],
        subtotal: amount + fee,
        discountAmount: 0,
        discountPercentage: 0,
        total: amount + fee,
        paymentMethod: 'cash',
        type: cashServiceType,
        fee: fee,
        customerId: selectedCustomer?.id,
        timestamp: Date.now(),
        processedBy: currentUser.name,
        notes: saleNotes
      };

      await db.sales.add(sale);
      
      setPaymentStep('success');
      setCashServiceAmount('');
      setCashServiceFee('');
      toast.success(`${cashServiceType === 'cash-in' ? 'Cash-in' : 'Cash-out'} recorded`);
    } catch (error) {
      toast.error('Failed to record service');
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    try {
      const customerData = {
        name: newCustomer.name,
        phone: newCustomer.phone,
        loyaltyPoints: 0,
        creditBalance: 0,
        createdAt: Date.now()
      };
      const id = await db.customers.add(customerData);
      
      const added = await db.customers.get(id);
      if (added) {
        setSelectedCustomer(added);
        setIsAddingNewCustomer(false);
        setIsSelectingCustomer(false);
        setNewCustomer({ name: '', phone: '' });
        toast.success('Customer added and selected');
      }
    } catch (error) {
      toast.error('Failed to add customer');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] lg:h-[calc(100vh-12rem)]">
      {paymentStep === 'success' ? (
        <div className="flex flex-col items-center justify-center py-12 lg:py-20 space-y-6 flex-1">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 lg:w-24 lg:h-24 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center"
          >
            <CheckCircle2 size={40} />
          </motion.div>
          <div className="text-center">
            <h2 className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-zinc-100">Success!</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">Transaction completed successfully.</p>
          </div>
          <button 
            onClick={() => setPaymentStep('cart')}
            className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-primary-light transition-all"
          >
            New Transaction
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Tab Switcher */}
          <div className="md:hidden flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl mb-4 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-2 px-4 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                activeTab === 'all' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <ShoppingCart size={14} />
              All
            </button>
            {settings?.showServices !== false && (
              <button 
                onClick={() => setActiveTab('services')}
                className={`flex-1 py-2 px-4 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                  activeTab === 'services' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Wrench size={14} />
                Services
              </button>
            )}
            {settings?.showProducts !== false && (
              <button 
                onClick={() => setActiveTab('products')}
                className={`flex-1 py-2 px-4 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                  activeTab === 'products' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Package size={14} />
                Products
              </button>
            )}
            <button 
              onClick={() => setActiveTab('cart')}
              className={`flex-1 py-2 px-4 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-2 relative ${
                activeTab === 'cart' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <ShoppingCart size={14} />
              Cart
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] flex items-center justify-center rounded-full border border-white dark:border-zinc-800">
                  {cart.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('cash-services')}
              className={`flex-1 py-2 px-4 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                activeTab === 'cash-services' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <ArrowLeftRight size={14} />
              Cash In/Out
            </button>
            {settings?.showServices !== false && (
              <button 
                onClick={() => setActiveTab('unpaid')}
                className={`flex-1 py-2 px-4 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                  activeTab === 'unpaid' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Clock size={14} />
                Unpaid ({unpaidAppointments.length})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6 h-full overflow-hidden relative">
        {/* Selection & Cash Services */}
        <div className="md:col-span-12 flex flex-col space-y-4 lg:space-y-6 overflow-hidden">
          {/* Desktop Tab Switcher */}
          <div className="hidden md:flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'all' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <ShoppingCart size={16} />
              All Items
            </button>
            {settings?.showServices !== false && (
              <button 
                onClick={() => setActiveTab('services')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'services' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Wrench size={16} />
                Services
              </button>
            )}
            {settings?.showProducts !== false && (
              <button 
                onClick={() => setActiveTab('products')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'products' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Package size={16} />
                Products
              </button>
            )}
            {settings?.showServices !== false && (
              <button 
                onClick={() => setActiveTab('unpaid')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'unpaid' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Clock size={16} />
                Unpaid ({unpaidAppointments.length})
              </button>
            )}
            <button 
              onClick={() => setActiveTab('cash-services')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === 'cash-services' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <ArrowLeftRight size={16} />
              Cash In/Out
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (window.innerWidth >= 1024) return;
                const threshold = 100;
                const velocity = 500;
                if (info.offset.x < -threshold || info.velocity.x < -velocity) {
                  handleSwipe('left');
                } else if (info.offset.x > threshold || info.velocity.x > velocity) {
                  handleSwipe('right');
                }
              }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {(activeTab === 'services' || activeTab === 'products' || activeTab === 'all') && (
                <>
                  <div className="flex gap-2 lg:gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={16} />
                      <input 
                        id="pos-search-input"
                        type="text" 
                        placeholder={`Search ${activeTab === 'all' ? 'all items' : activeTab} or scan barcode...`} 
                        className="w-full pl-9 pr-10 py-2.5 lg:py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm text-zinc-900 dark:text-zinc-100"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleBarcodeSearch}
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        setNewItemData(prev => ({ ...prev, type: activeTab === 'services' ? 'service' : 'product' }));
                        setIsAddingItem(true);
                      }}
                      className="p-2.5 lg:p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                      title={`Add New ${activeTab === 'services' ? 'Service' : 'Product'}`}
                    >
                      <Plus size={20} />
                    </button>
                    <button 
                      onClick={() => setIsScanning(true)}
                      className="p-2.5 lg:p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      title="Scan QR Code"
                    >
                      <QrCode size={20} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 lg:pr-2">
                    {(activeTab === 'all' ? combinedItems : activeTab === 'services' ? filteredServices : filteredProducts).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-20 text-zinc-400 dark:text-zinc-600 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <Search size={24} />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold uppercase tracking-widest">No items found</p>
                          <p className="text-xs">Try a different search term or add a new item</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
                        {(activeTab === 'all' ? combinedItems : activeTab === 'services' ? filteredServices : filteredProducts).map((item) => {
                        const itemType = (item as any).type || activeTab.slice(0, -1);
                        const cartItem = cart.find(i => i.id === item.id && i.type === itemType);
                        return (
                          <motion.div
                            layout
                            key={`${activeTab}-${itemType}-${item.id}`}
                            className="bg-white dark:bg-zinc-900 p-3 lg:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all text-left group flex gap-3 lg:gap-4 items-start"
                          >
                            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-100 dark:border-zinc-800">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingCart size={20} className="text-zinc-300 dark:text-zinc-600 group-hover:text-primary transition-colors" />
                              )}
                            </div>
                            
                            <div className="flex-1 flex flex-col h-full min-w-0">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-sm mb-1 flex items-center gap-2">
                                {item.name}
                                {getExpiryStatus((item as Product).expiryDate) && (
                                  <AlertTriangle size={12} className={getExpiryStatus((item as Product).expiryDate)?.color} />
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <div className="text-primary font-bold text-xs lg:text-sm">{formatCurrency(item.price)}</div>
                                <div className="text-[9px] lg:text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase flex items-center gap-1">
                                  {itemType === 'service' ? `${(item as Service).duration}m duration` : `${(item as Product).stock} in stock`}
                                  {getExpiryStatus((item as Product).expiryDate) && (
                                    <span className={`font-black ${getExpiryStatus((item as Product).expiryDate)?.color}`}>
                                      • {getExpiryStatus((item as Product).expiryDate)?.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-auto pt-3">
                                {cartItem ? (
                                  <div className="flex items-center justify-between bg-primary/10 rounded-xl p-1 border border-primary/20 max-w-[120px]">
                                    <button 
                                      onClick={() => updateQuantity(item.id!, itemType as any, -1)}
                                      className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors text-primary"
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <input 
                                      type="number"
                                      className="w-8 text-center font-bold text-primary text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      value={cartItem.quantity === 0 ? '' : cartItem.quantity}
                                      onChange={(e) => handleManualQuantity(item.id!, itemType as any, e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      onBlur={() => {
                                        if (cartItem.quantity === 0) removeFromCart(item.id!, itemType as any);
                                      }}
                                      placeholder="0"
                                      min="0"
                                    />
                                    <button 
                                      onClick={() => updateQuantity(item.id!, itemType as any, 1)}
                                      className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg transition-colors text-primary"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => addToCart(item, itemType as any)}
                                    className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold rounded-xl text-xs hover:bg-primary hover:text-white transition-all"
                                  >
                                    Add to Cart
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </>
              )}

              {activeTab === 'unpaid' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-2xl flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">Total Outstanding</div>
                      <div className="text-xl font-black text-orange-600 dark:text-orange-400">
                        {formatCurrency(unpaidAppointments.reduce((acc, app) => acc + (app.totalAmount - (app.paidAmount || 0)), 0))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Pending Orders</div>
                      <div className="text-xl font-black text-zinc-900 dark:text-zinc-100">{unpaidAppointments.length}</div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-1 lg:pr-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {unpaidAppointments.map(app => {
                        const balance = app.totalAmount - (app.paidAmount || 0);
                        return (
                          <div key={app.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors group">
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  app.status === 'claimed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                  {app.status}
                                </span>
                                <span className="text-xs font-bold text-primary">{formatCurrency(app.totalAmount)}</span>
                              </div>
                              <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{app.customerName}</h4>
                              <p className="text-[10px] text-zinc-400 font-mono">#{app.id}</p>
                              
                              <div className="mt-3 space-y-1">
                                {app.items?.map((item: any, idx: number) => (
                                  <div key={idx} className="text-[10px] text-zinc-500 flex justify-between">
                                    <span>{item.quantity}x {item.name}</span>
                                    <span>{formatCurrency(item.price * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                              
                              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-zinc-400 font-bold uppercase">Paid</span>
                                  <span className="text-green-600 font-bold">{formatCurrency(app.paidAmount || 0)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-900 dark:text-zinc-100 font-black uppercase">Outstanding</span>
                                  <span className="text-red-500 font-black">{formatCurrency(balance)}</span>
                                </div>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                const itemsToAdd = app.items?.map((item: any) => ({
                                  id: item.serviceId || item.productId,
                                  name: item.name,
                                  price: item.price,
                                  quantity: item.quantity,
                                  type: item.type,
                                  staffIds: item.staffIds,
                                  duration: item.duration,
                                  appointmentId: app.id
                                })) || [];

                                if (itemsToAdd.length > 0) {
                                  if (app.paidAmount && app.paidAmount > 0) {
                                    itemsToAdd.push({
                                      id: `deduction-${app.id}`,
                                      name: `Already Paid (Order #${app.id})`,
                                      price: -app.paidAmount,
                                      quantity: 1,
                                      type: 'service',
                                      staffIds: [],
                                      duration: 0,
                                      appointmentId: app.id
                                    });
                                  }
                                  
                                  setCart(prev => [...prev, ...itemsToAdd]);
                                  if (app.customerId) {
                                    const customer = customers.find(c => c.id === app.customerId);
                                    if (customer) setSelectedCustomer(customer);
                                  }
                                  if (app.discountPercentage) setDiscountPercent(app.discountPercentage.toString());
                                  if (app.discountAmount) setDiscountAmount(app.discountAmount.toString());
                                  setIsCartOpen(true);
                                  toast.success(`Added items from ${app.customerName}'s order`);
                                } else {
                                  toast.error('No items found in this order');
                                }
                              }}
                              className="mt-4 w-full py-2.5 bg-primary text-white font-bold rounded-xl text-xs shadow-md shadow-primary-light hover:brightness-110 transition-all flex items-center justify-center gap-2"
                            >
                              <ShoppingCart size={14} />
                              Settle in POS
                            </button>
                          </div>
                        );
                      })}
                      {unpaidAppointments.length === 0 && (
                        <div className="col-span-full py-12 text-center text-zinc-400 italic">No unpaid completed services</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'cash-services' && (
                <div className="flex-1 flex flex-col items-center justify-start lg:justify-center p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-y-auto">
                  <div className="w-full max-w-sm space-y-6 my-auto">
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Cash Services</h3>
                      <p className="text-xs text-zinc-500">Record cash-in or cash-out transactions with fees.</p>
                    </div>

                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
                      <button 
                        onClick={() => setCashServiceType('cash-in')}
                        className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                          cashServiceType === 'cash-in' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'text-zinc-500'
                        }`}
                      >
                        Cash In
                      </button>
                      <button 
                        onClick={() => setCashServiceType('cash-out')}
                        className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
                          cashServiceType === 'cash-out' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'text-zinc-500'
                        }`}
                      >
                        Cash Out
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount</label>
                        <div className="relative">
                          <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                          <input 
                            type="number" 
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-black text-lg outline-none focus:ring-2 focus:ring-primary"
                            value={cashServiceAmount}
                            onChange={(e) => setCashServiceAmount(e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Service Fee (Manual)</label>
                        <div className="relative">
                          <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                          <input 
                            type="number" 
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-black text-lg outline-none focus:ring-2 focus:ring-primary"
                            value={cashServiceFee}
                            onChange={(e) => setCashServiceFee(e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <div className="flex justify-between items-center mb-4 px-2">
                          <span className="text-sm font-bold text-zinc-500">Total to Collect</span>
                          <span className="text-2xl font-black text-primary">
                            {formatCurrency((parseFloat(cashServiceAmount) || 0) + (parseFloat(cashServiceFee) || 0))}
                          </span>
                        </div>
                        <button 
                          onClick={handleCashService}
                          className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary-light hover:brightness-110 transition-all"
                        >
                          Process {cashServiceType === 'cash-in' ? 'Cash In' : 'Cash Out'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Cart & Checkout Floating Panel */}
        <AnimatePresence>
          {(isCartOpen || activeTab === 'cart') && (
            <>
              {/* Backdrop for mobile */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setIsCartOpen(false);
                  if (activeTab === 'cart') setActiveTab('services');
                }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
              />
              
              <motion.div 
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-20 right-4 bottom-24 lg:bottom-8 w-[calc(100%-2rem)] sm:w-[400px] bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden z-[60]"
              >
                <div className="p-4 lg:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <ShoppingCart size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{t.currentOrder}</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{cart.length} {t.itemsSelected}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCart([])}
                      className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                      title="Clear Cart"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsCartOpen(false);
                        if (activeTab === 'cart') setActiveTab('services');
                      }}
                      className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                  <div className="p-4 lg:p-6 space-y-3">
                    {cart.map((item) => (
                      <div key={`${item.id}-${item.type}`} className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{item.name}</div>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${item.type === 'service' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                {item.type}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {item.isFlexiblePrice ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="font-bold text-zinc-400 uppercase text-[9px]">Price:</span>
                                  <input 
                                    type="number"
                                    className="w-20 px-2 py-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-xs font-bold text-primary outline-none focus:ring-1 focus:ring-primary"
                                    value={item.price}
                                    onChange={(e) => handleManualPrice(item.id, item.type, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                  />
                                </div>
                              ) : (
                                <>{formatCurrency(item.price)} {item.type === 'service' ? `| ${item.duration}m` : ''}</>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <button 
                              onClick={() => updateQuantity(item.id, item.type, -1)}
                              className="p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400"
                            >
                              <Minus size={14} />
                            </button>
                            <input 
                              type="number"
                              className="text-sm font-bold w-10 text-center text-zinc-900 dark:text-zinc-100 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => handleManualQuantity(item.id, item.type, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => {
                                if (item.quantity === 0) removeFromCart(item.id, item.type);
                              }}
                              placeholder="0"
                              min="0"
                            />
                            <button 
                              onClick={() => updateQuantity(item.id, item.type, 1)}
                              className="p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button onClick={() => removeFromCart(item.id, item.type)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                        </div>
                        
                        {item.type === 'service' && (
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">Assigned Staff:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {staff.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => toggleStaff(item.id, s.id!)}
                                  className={`px-3 py-1 rounded-lg text-[9px] font-bold transition-all ${
                                    item.staffIds?.includes(s.id!)
                                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                      : 'bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800'
                                  }`}
                                >
                                  {s.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 space-y-3 py-16">
                        <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                          <ShoppingCart size={32} strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-medium">Your cart is empty</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 lg:p-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
                    {/* Customer Selection */}
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
                          <UserPlus size={18} className="text-zinc-400 dark:text-zinc-500" />
                        </div>
                        {selectedCustomer ? (
                          <div>
                            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{selectedCustomer.name}</div>
                            <div className="text-[10px] text-primary font-bold uppercase tracking-wider">{selectedCustomer.loyaltyPoints} Points</div>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Add Customer</span>
                        )}
                      </div>
                      {selectedCustomer ? (
                        <button onClick={() => setSelectedCustomer(null)} className="text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Change</button>
                      ) : (
                        <button 
                          onClick={() => setIsSelectingCustomer(true)}
                          className="px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary/20 transition-all"
                        >
                          Select
                        </button>
                      )}
                    </div>

                    {selectedCustomer && selectedCustomer.loyaltyPoints >= 500 && (
                      <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Award size={16} className="text-primary" />
                          <span className="text-xs font-bold text-primary">Redeem 500 pts for ₱10 discount?</span>
                        </div>
                        <button 
                          onClick={() => setUsePoints(!usePoints)}
                          className={`w-10 h-5 rounded-full transition-all relative ${usePoints ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${usePoints ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{t.subtotal}</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      
                      <div className="flex flex-col gap-2 py-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t.discount} (%)</span>
                          <div className="relative w-24">
                            <input 
                              type="number" 
                              className="w-full px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-right outline-none focus:ring-1 focus:ring-primary"
                              value={discountPercent}
                              onChange={(e) => {
                                setDiscountPercent(e.target.value);
                                setDiscountAmount('0');
                              }}
                              onFocus={(e) => e.target.select()}
                              min="0"
                              max="100"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 pointer-events-none">%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t.discount} (Amt)</span>
                          <div className="relative w-24">
                            <input 
                              type="number" 
                              className="w-full px-3 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-right outline-none focus:ring-1 focus:ring-primary"
                              value={discountAmount}
                              onChange={(e) => {
                                setDiscountAmount(e.target.value);
                                setDiscountPercent('0');
                              }}
                              onFocus={(e) => e.target.select()}
                              min="0"
                            />
                          </div>
                        </div>
                      </div>

                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-xs text-green-600 font-bold">
                          <span>Total Discount</span>
                          <span>-{formatCurrency(totalDiscount)}</span>
                        </div>
                      )}

                      {usePoints && (
                        <div className="flex justify-between text-xs text-green-600 font-bold">
                          <span>Loyalty Discount</span>
                          <span>-{formatCurrency(10)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold text-zinc-900 dark:text-zinc-100 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <span>{t.total}</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                      {paymentType === 'down-payment' && (
                        <div className="flex justify-between text-base font-bold text-primary">
                          <span>Down Payment</span>
                          <span>{formatCurrency(parseFloat(downPaymentAmount) || 0)}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        onClick={() => setPaymentType('full')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                          paymentType === 'full' ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <CheckCircle2 size={16} />
                        <span className="text-[10px] font-bold uppercase">Full Payment</span>
                      </button>
                      <button 
                        onClick={() => {
                          setPaymentType('down-payment');
                          if (paymentMethod === 'credit') setPaymentMethod('cash');
                        }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                          paymentType === 'down-payment' ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <Wallet size={16} />
                        <span className="text-[10px] font-bold uppercase">Down Payment</span>
                      </button>
                    </div>

                    {paymentType === 'down-payment' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Down Payment Amount</label>
                        <input 
                          type="number" 
                          placeholder="Enter amount"
                          className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary"
                          value={downPaymentAmount}
                          onChange={(e) => setDownPaymentAmount(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2 pt-2">
                      <button 
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          paymentMethod === 'cash' ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <Banknote size={16} />
                        <span className="text-[10px] font-bold uppercase">{t.cash}</span>
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('e-wallet')}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          paymentMethod === 'e-wallet' ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <Wallet size={16} className="text-blue-500" />
                        <span className="text-[10px] font-bold uppercase">{t.eWallet}</span>
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('bank-transfer')}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                          paymentMethod === 'bank-transfer' ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <QrCode size={16} className="text-purple-500" />
                        <span className="text-[10px] font-bold uppercase">Bank</span>
                      </button>
                      <button 
                        disabled={!selectedCustomer || paymentType === 'down-payment'}
                        onClick={() => setPaymentMethod('credit')}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all disabled:opacity-30 ${
                          paymentMethod === 'credit' ? 'bg-primary/10 border-primary text-primary' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <Award size={16} />
                        <span className="text-[10px] font-bold uppercase">{t.credit}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sale Notes</label>
                      <textarea 
                        placeholder="Optional notes..."
                        className="w-full px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary resize-none h-20"
                        value={saleNotes}
                        onChange={(e) => setSaleNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 lg:p-6 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex flex-col gap-2">
                    {paymentType === 'down-payment' && !selectedCustomer && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-bold text-center mb-1">
                        Please select a customer for down payment
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button 
                        disabled={cart.length === 0}
                        onClick={handlePreviewReceipt}
                        className="p-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                        title="Preview Receipt"
                      >
                        <Receipt size={18} />
                      </button>
                      <button 
                        disabled={cart.length === 0 || (paymentType === 'down-payment' && !selectedCustomer)}
                        onClick={handleCheckout}
                        className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-primary-light text-sm flex items-center justify-center gap-2"
                      >
                        <ShoppingCart size={18} />
                        <span>
                          {paymentType === 'down-payment' ? t.processDownPayment : t.checkout}
                        </span>
                      </button>
                      {paymentMethod === 'cash' && cart.length > 0 && paymentType === 'full' && (
                        <button 
                          onClick={handleCheckout}
                          className="px-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg shadow-green-500/20 hover:brightness-110 active:scale-95 transition-all flex flex-col items-center justify-center"
                          title="Exact Cash"
                        >
                          <Banknote size={18} />
                          <span className="text-[8px] uppercase">Exact</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Floating Cart Button */}
        <AnimatePresence>
          {cart.length > 0 && !isCartOpen && activeTab !== 'cart' && (
            <motion.button
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsCartOpen(true)}
              className="fixed bottom-24 lg:bottom-8 right-6 lg:right-8 w-16 h-16 bg-primary text-white rounded-full shadow-2xl shadow-primary-light flex items-center justify-center z-40 group transition-all"
            >
              <div className="relative">
                <ShoppingCart size={28} />
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              </div>
              <span className="absolute right-full mr-3 px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                View Cart ({formatCurrency(total)})
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  )}

  {isScanning && (
        <QRScanner 
          onScan={(code) => {
            const service = services.find(s => s.barcode === code);
            const product = products.find(p => p.barcode === code);
            if (service) {
              addToCart(service, 'service');
              toast.success(`Added ${service.name}`);
            } else if (product) {
              addToCart(product, 'product');
              toast.success(`Added ${product.name}`);
            } else {
              toast.error('Item not found');
            }
          }} 
          onClose={() => setIsScanning(false)} 
        />
      )}

      <AnimatePresence>
        {isAddingItem && (
          <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  New {newItemData.type === 'service' ? 'Service' : 'Product'}
                </h3>
                <button onClick={() => setIsAddingItem(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddItem} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Name</label>
                  <input 
                    required
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                    value={newItemData.name} 
                    onChange={e => setNewItemData({...newItemData, name: e.target.value})}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Price</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newItemData.price} 
                      onChange={e => setNewItemData({...newItemData, price: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Cost</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newItemData.cost} 
                      onChange={e => setNewItemData({...newItemData, cost: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Category</label>
                    <select 
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none"
                      value={newItemData.category}
                      onChange={e => setNewItemData({...newItemData, category: e.target.value})}
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  {newItemData.type === 'service' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Duration (min)</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newItemData.duration} 
                        onChange={e => setNewItemData({...newItemData, duration: e.target.value})}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Initial Stock</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newItemData.stock} 
                        onChange={e => setNewItemData({...newItemData, stock: e.target.value})}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <input 
                    type="checkbox" 
                    id="posFlexiblePrice"
                    className="w-4 h-4 accent-primary" 
                    checked={newItemData.isFlexiblePrice} 
                    onChange={e => setNewItemData({...newItemData, isFlexiblePrice: e.target.checked})} 
                  />
                  <label htmlFor="posFlexiblePrice" className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer uppercase">
                    Flexible Price (Allow price override at Sales)
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Barcode (Optional)</label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newItemData.barcode} 
                      onChange={e => setNewItemData({...newItemData, barcode: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light mt-2"
                >
                  Save {newItemData.type === 'service' ? 'Service' : 'Product'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSelectingCustomer && (
          <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {isAddingNewCustomer ? 'New Customer' : 'Select Customer'}
                </h3>
                <button 
                  onClick={() => {
                    setIsSelectingCustomer(false);
                    setIsAddingNewCustomer(false);
                  }} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto flex-1">
                {isAddingNewCustomer ? (
                  <form onSubmit={handleAddCustomer} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Full Name</label>
                      <input 
                        required
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newCustomer.name} 
                        onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Phone Number</label>
                      <input 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newCustomer.phone} 
                        onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button 
                        type="submit"
                        className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light"
                      >
                        Add Customer
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsAddingNewCustomer(false)}
                        className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-xl"
                      >
                        Back
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="Search by name or phone..."
                          className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <button 
                        onClick={() => setIsAddingNewCustomer(true)}
                        className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                        title="Add New Customer"
                      >
                        <UserPlus size={20} />
                      </button>
                    </div>
                    <div className="space-y-2 pr-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Customers</div>
                      {filteredCustomers.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsSelectingCustomer(false);
                            setCustomerSearch('');
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700 transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {customer.name[0]}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{customer.name}</div>
                              <div className="text-[10px] text-zinc-500">{customer.phone || 'No phone'}</div>
                            </div>
                          </div>
                          <div className="text-xs font-black text-primary">{customer.loyaltyPoints} pts</div>
                        </button>
                      ))}

                      {filteredCustomers.length === 0 && (
                        <div className="py-8 text-center text-zinc-400 italic text-sm">No results found</div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex-shrink-0">
                <button 
                  onClick={() => setIsSelectingCustomer(false)}
                  className="w-full py-3 text-zinc-500 font-bold text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {isReceiptOpen && lastSale && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto print:shadow-none print:rounded-none print:w-full print:max-w-none"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-primary" />
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                    {lastSale.id === 'PREVIEW' ? 'Receipt Preview' : 'Official Receipt'}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsReceiptOpen(false)}
                  className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors print:hidden"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-zinc-100 dark:bg-zinc-950/50 print:bg-white print:p-0">
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  id="receipt-content" 
                  className="receipt-paper receipt-torn-edge-top receipt-torn-edge-bottom mx-auto w-full max-w-[320px] p-8 bg-white text-zinc-900 font-mono text-sm shadow-2xl print:shadow-none print:max-w-none print:p-4 overflow-hidden"
                >
                  <div className="text-center space-y-1 mb-6">
                    <div className="text-[9px] font-black border-y border-zinc-200 py-1 mb-4 tracking-[0.2em]">
                      {lastSale.id === 'PREVIEW' ? '*** PREVIEW ONLY ***' : '*** OFFICIAL RECEIPT ***'}
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">{settings.storeName}</h2>
                    <p className="text-[10px] text-zinc-600 leading-tight">{settings.storeAddress}</p>
                    <p className="text-[10px] text-zinc-600">{settings.storePhone}</p>
                    <div className="pt-4 border-b border-dashed border-zinc-300" />
                  </div>

                  <div className="space-y-1 text-[10px] mb-6 text-zinc-600">
                    <div className="flex justify-between">
                      <span className="font-bold">DATE:</span>
                      <span>{new Date(lastSale.timestamp).toLocaleString().toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">REF#:</span>
                      <span>{lastSale.id?.toString().slice(-8).toUpperCase() || 'PREVIEW'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold">CASHIER:</span>
                      <span>{lastSale.processedBy.toUpperCase()}</span>
                    </div>
                    {selectedCustomer && (
                      <div className="flex justify-between pt-1 border-t border-zinc-100 mt-1">
                        <span className="font-bold">CUSTOMER:</span>
                        <span className="truncate ml-4">{selectedCustomer.name.toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-y-2 border-zinc-900 py-3 mb-6">
                    <div className="flex justify-between text-[10px] font-black mb-3 px-1 tracking-widest">
                      <span>DESCRIPTION</span>
                      <span>TOTAL</span>
                    </div>
                    <div className="space-y-4 receipt-striped">
                      {lastSale.items.map((item, idx) => (
                        <div key={idx} className="relative">
                          <div className="flex justify-between text-[11px] font-bold leading-tight mb-0.5">
                            <span className="uppercase pr-4">{item.name}</span>
                            <span className="flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                          <div className="flex justify-between text-[9px] text-zinc-500 font-medium">
                            <span>{item.quantity} x {formatCurrency(item.price)}</span>
                          </div>
                          {idx < lastSale.items.length - 1 && (
                            <div className="mt-3 border-b border-zinc-100 border-dotted" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-[10px]">
                      <span>SUBTOTAL</span>
                      <span>{formatCurrency(lastSale.subtotal)}</span>
                    </div>
                    {lastSale.discountAmount > 0 && (
                      <div className="flex justify-between text-[10px] text-zinc-600">
                        <span>DISCOUNT ({lastSale.discountPercentage}%)</span>
                        <span>-{formatCurrency(lastSale.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-lg pt-2 border-t-2 border-zinc-900 mt-2">
                      <span>TOTAL</span>
                      <span>{formatCurrency(lastSale.total)}</span>
                    </div>
                  </div>

                  <div className="space-y-4 text-center">
                    <div className="py-2 border-y border-dashed border-zinc-300">
                      <div className="text-[10px] font-black uppercase tracking-widest">
                        PAID VIA: {lastSale.paymentMethod.toUpperCase()}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase">Thank you for visiting!</p>
                      <p className="text-[9px] text-zinc-500 italic">Please come again</p>
                    </div>

                    <div className="flex flex-col items-center gap-1 pt-2">
                      <div className="w-full h-8 flex justify-center gap-1">
                        {[...Array(24)].map((_, i) => (
                          <div 
                            key={i} 
                            className="w-1 bg-zinc-900" 
                            style={{ height: `${Math.random() * 100}%` }}
                          />
                        ))}
                      </div>
                      <div className="text-[8px] font-bold tracking-[0.5em] text-zinc-400">
                        {lastSale.id?.toString().slice(-12).toUpperCase() || '000000000000'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 print:hidden">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                >
                  <Printer size={18} />
                  <span>Print Receipt</span>
                </button>
                <button 
                  onClick={() => setIsReceiptOpen(false)}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                >
                  <Check size={18} />
                  <span>Done</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
