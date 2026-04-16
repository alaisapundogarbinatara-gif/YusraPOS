import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  UserPlus, 
  Search, 
  Star, 
  Phone, 
  Mail,
  Award,
  Trash2,
  X,
  Wallet,
  ArrowDownCircle,
  Plus,
  AlertTriangle,
  GripHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2
} from 'lucide-react';
import { db, type Customer } from '../db';
import { toast } from 'sonner';
import { motion, AnimatePresence, useDragControls } from 'motion/react';

export default function Accounts() {
  const dragControls = useDragControls();
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [newAccount, setNewAccount] = useState({ name: '', email: '', phone: '' });
  const [editAccount, setEditAccount] = useState({ name: '', email: '', phone: '' });
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof Customer | 'createdAt'; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc'
  });
  
  // Modals state
  const [editingPointsId, setEditingPointsId] = useState<number | string | null>(null);
  const [pointsAdjustment, setPointsAdjustment] = useState<string>('');
  
  const [payingCustomerCreditId, setPayingCustomerCreditId] = useState<number | string | null>(null);
  const [customerCreditPayment, setCustomerCreditPayment] = useState<string>('');
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<'cash' | 'e-wallet' | 'bank-transfer'>('cash');
  
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [viewingHistoryId, setViewingHistoryId] = useState<number | string | null>(null);

  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const customerHistory = viewingHistoryId ? sales.filter(s => s.customerId === viewingHistoryId).reverse() : [];
  const activeHistory = customerHistory.filter(s => !s.isVoided);
  const viewingCustomer = customers.find(c => c.id === viewingHistoryId);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  ).sort((a, b) => {
    const aValue = a[sortConfig.key] ?? '';
    const bValue = b[sortConfig.key] ?? '';
    
    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleSort = (key: keyof Customer | 'createdAt') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof Customer | 'createdAt' }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="ml-1 text-primary" /> 
      : <ArrowDown size={12} className="ml-1 text-primary" />;
  };

  const totalReceivable = customers.reduce((acc, c) => acc + (c.creditBalance || 0), 0);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerData = {
        ...newAccount,
        loyaltyPoints: 0,
        creditBalance: 0,
        createdAt: Date.now()
      };
      await db.customers.add(customerData as any);
      toast.success('Customer registered');
      setIsAdding(false);
      setNewAccount({ name: '', email: '', phone: '' });
    } catch (error) {
      toast.error('Failed to add account');
    }
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await db.customers.update(editingId as any, editAccount);
      toast.success('Customer updated');
      setEditingId(null);
    } catch (error) {
      toast.error('Failed to update account');
    }
  };

  const startEditing = (customer: Customer) => {
    setEditingId(customer.id || null);
    setEditAccount({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || ''
    });
  };

  const handleDeleteCustomer = async () => {
    if (!deletingId) return;
    try {
      await db.customers.delete(deletingId as any);
      toast.success('Customer deleted');
      setDeletingId(null);
    } catch (error) {
      toast.error('Failed to delete customer');
    }
  };

  const handleAdjustPoints = async (id: number | string, currentPoints: number) => {
    const adjustment = parseInt(pointsAdjustment);
    if (isNaN(adjustment)) {
      toast.error('Please enter a valid number');
      return;
    }
    try {
      const newPoints = Math.max(0, currentPoints + adjustment);
      if (typeof id === 'number') await db.customers.update(id, { loyaltyPoints: newPoints });
      setEditingPointsId(null);
      setPointsAdjustment('');
      toast.success('Points updated');
    } catch (error) {
      toast.error('Failed to update points');
    }
  };

  const handlePayCustomerCredit = async (id: number | string, currentBalance: number) => {
    const payment = parseFloat(customerCreditPayment);
    if (isNaN(payment) || payment <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    try {
      const customer = customers.find(c => c.id === id);
      if (!customer) return;

      const newBalance = Math.max(0, currentBalance - payment);

      // Record as a transaction
      const sale: any = {
        items: [{
          productId: 0,
          quantity: 1,
          price: payment,
          name: `Debt Payment: ${customer.name}`
        }],
        subtotal: payment,
        discountAmount: 0,
        discountPercentage: 0,
        total: payment,
        paymentMethod: debtPaymentMethod,
        type: 'sale',
        customerId: id,
        timestamp: Date.now(),
        processedBy: 'System',
        isDebtPayment: true
      };

      await db.sales.add(sale);
      await db.customers.update(id as any, { creditBalance: newBalance });

      setPayingCustomerCreditId(null);
      setCustomerCreditPayment('');
      toast.success('Credit payment recorded');
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Accounts Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-zinc-400 dark:text-zinc-500 text-[10px] lg:text-xs font-bold uppercase tracking-widest mb-2">Total Receivable (Regulars)</div>
            <div className="text-3xl lg:text-4xl font-black text-green-600 dark:text-green-400">
              {formatCurrency(totalReceivable)}
            </div>
          </div>
          <div className="text-zinc-500 dark:text-zinc-400 text-[10px] lg:text-xs font-medium mt-4">Money owed to you</div>
        </div>
        <div className="bg-zinc-900 dark:bg-zinc-100 p-6 lg:p-8 rounded-3xl shadow-xl flex flex-col justify-between text-white dark:text-zinc-900">
          <div>
            <div className="text-zinc-400 dark:text-zinc-500 text-[10px] lg:text-xs font-bold uppercase tracking-widest mb-2">Total Regulars</div>
            <div className="text-3xl lg:text-4xl font-black">
              {customers.length}
            </div>
          </div>
          <div className="text-zinc-400 dark:text-zinc-500 text-[10px] lg:text-xs font-medium mt-4">Registered accounts</div>
        </div>
      </div>

      {/* Actions & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Search regulars..." 
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:brightness-110 transition-all shadow-lg shadow-primary-light"
        >
          <UserPlus size={20} />
          Add Regular
        </button>
      </div>

      {/* Unified List */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredCustomers.map((customer) => (
            <div key={`cust-mob-${customer.id}`} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setViewingHistoryId(customer.id || null)}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {customer.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{customer.name}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{customer.phone || 'No phone'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-black ${customer.creditBalance > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                    {customer.creditBalance > 0 ? formatCurrency(customer.creditBalance) : 'No Debt'}
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase">Balance</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, (customer.loyaltyPoints / 500) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-500">{customer.loyaltyPoints} pts</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setViewingHistoryId(customer.id || null)}
                    className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400"
                    title="View Full History"
                  >
                    <ArrowUpDown size={16} />
                  </button>
                  <button 
                    onClick={() => setPayingCustomerCreditId(customer.id || null)}
                    className={`p-2 rounded-lg transition-colors ${customer.creditBalance > 0 ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-zinc-300'}`}
                    disabled={!(customer.creditBalance > 0)}
                  >
                    <ArrowDownCircle size={16} />
                  </button>
                  <button 
                    onClick={() => setEditingPointsId(customer.id || null)}
                    className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400"
                  >
                    <Award size={16} />
                  </button>
                  <button 
                    onClick={() => startEditing(customer)}
                    className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setDeletingId(customer.id || null)}
                    className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                <th 
                  className="px-6 py-4 font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    Account Name <SortIcon columnKey="name" />
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th 
                  className="px-6 py-4 font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('loyaltyPoints')}
                >
                  <div className="flex items-center">
                    Loyalty / Status <SortIcon columnKey="loyaltyPoints" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('creditBalance')}
                >
                  <div className="flex items-center">
                    Balance <SortIcon columnKey="creditBalance" />
                  </div>
                </th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredCustomers.map((customer) => (
                <tr key={`cust-${customer.id}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div 
                      className="flex items-center gap-3 cursor-pointer group/name"
                      onClick={() => setViewingHistoryId(customer.id || null)}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold group-hover/name:scale-110 transition-transform">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover/name:text-primary transition-colors">{customer.name}</div>
                        <div className="text-[10px] text-zinc-400 font-bold uppercase">View History</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{customer.phone || 'No phone'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (customer.loyaltyPoints / 500) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100">{customer.loyaltyPoints} pts</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-black ${customer.creditBalance > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                      {customer.creditBalance > 0 ? `Receivable: ${formatCurrency(customer.creditBalance)}` : 'No Debt'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setPayingCustomerCreditId(customer.id || null)}
                        className={`p-2 rounded-lg transition-colors ${customer.creditBalance > 0 ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-zinc-300 cursor-not-allowed'}`}
                        disabled={!(customer.creditBalance > 0)}
                        title="Record Payment from Customer"
                      >
                        <ArrowDownCircle size={18} />
                      </button>
                      <button 
                        onClick={() => startEditing(customer)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-primary transition-colors"
                        title="Edit Customer Info"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => setEditingPointsId(customer.id || null)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-primary transition-colors"
                        title="Adjust Points"
                      >
                        <Award size={18} />
                      </button>
                      <button 
                        onClick={() => setViewingHistoryId(customer.id || null)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-primary transition-colors"
                        title="View Full History"
                      >
                        <ArrowUpDown size={18} />
                      </button>
                      <button 
                        onClick={() => setDeletingId(customer.id || null)}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredCustomers.length === 0 && (
          <div className="p-12 text-center text-zinc-400 italic text-sm">No accounts found</div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {/* Add Account Modal */}
        {isAdding && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              drag
              dragMomentum={false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div 
                className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center cursor-move bg-zinc-50/50 dark:bg-zinc-800/50 touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="flex items-center gap-2">
                  <GripHorizontal size={18} className="text-zinc-400" />
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Add New Regular</h3>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddAccount} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Name / Company</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary outline-none"
                    value={newAccount.name}
                    onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Phone</label>
                    <input 
                      type="tel" 
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary outline-none"
                      value={newAccount.phone}
                      onChange={e => setNewAccount({...newAccount, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary outline-none"
                      value={newAccount.email}
                      onChange={e => setNewAccount({...newAccount, email: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:brightness-110 shadow-lg shadow-primary-light transition-all mt-4"
                >
                  Register Regular
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Account Modal */}
        {editingId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              drag
              dragMomentum={false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div 
                className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center cursor-move bg-zinc-50/50 dark:bg-zinc-800/50 touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="flex items-center gap-2">
                  <GripHorizontal size={18} className="text-zinc-400" />
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edit Regular Info</h3>
                </div>
                <button onClick={() => setEditingId(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEditAccount} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Name / Company</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary outline-none"
                    value={editAccount.name}
                    onChange={e => setEditAccount({...editAccount, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Phone</label>
                    <input 
                      type="tel" 
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary outline-none"
                      value={editAccount.phone}
                      onChange={e => setEditAccount({...editAccount, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Email</label>
                    <input 
                      type="email" 
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary outline-none"
                      value={editAccount.email}
                      onChange={e => setEditAccount({...editAccount, email: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:brightness-110 shadow-lg shadow-primary-light transition-all mt-4"
                >
                  Update Information
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingId && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Delete Account?</h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">This action cannot be undone. All data for this account will be removed.</p>
              <div className="flex gap-3">
                <button 
                  onClick={handleDeleteCustomer}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Adjust Points Modal */}
        {editingPointsId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl w-full max-w-xs border border-zinc-200 dark:border-zinc-800 shadow-2xl">
              <h4 className="text-sm font-bold mb-4 uppercase tracking-wider">Adjust Loyalty Points</h4>
              <input 
                type="number" 
                placeholder="+/- Points"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold mb-4 outline-none focus:ring-2 focus:ring-primary"
                value={pointsAdjustment}
                onChange={(e) => setPointsAdjustment(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => handleAdjustPoints(editingPointsId, customers.find(c => c.id === editingPointsId)?.loyaltyPoints || 0)} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl">Apply</button>
                <button onClick={() => setEditingPointsId(null)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-xl">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Pay Customer Credit Modal */}
        {payingCustomerCreditId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl w-full max-w-xs border border-zinc-200 dark:border-zinc-800 shadow-2xl">
              <h4 className="text-sm font-bold mb-2 uppercase tracking-wider">Record Customer Payment</h4>
              <p className="text-[10px] text-zinc-500 mb-4">Debt: {formatCurrency(customers.find(c => c.id === payingCustomerCreditId)?.creditBalance || 0)}</p>
              
              <div className="space-y-4">
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setDebtPaymentMethod('cash')}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                      debtPaymentMethod === 'cash' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'text-zinc-500'
                    }`}
                  >
                    Cash
                  </button>
                  <button 
                    onClick={() => setDebtPaymentMethod('e-wallet')}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                      debtPaymentMethod === 'e-wallet' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'text-zinc-500'
                    }`}
                  >
                    E-Wallet
                  </button>
                  <button 
                    onClick={() => setDebtPaymentMethod('bank-transfer')}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
                      debtPaymentMethod === 'bank-transfer' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'text-zinc-500'
                    }`}
                  >
                    Bank
                  </button>
                </div>

                <input 
                  type="number" 
                  placeholder="Payment Amount"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-green-500"
                  value={customerCreditPayment}
                  onChange={(e) => setCustomerCreditPayment(e.target.value)}
                  autoFocus
                />
                
                <div className="flex gap-2">
                  <button onClick={() => handlePayCustomerCredit(payingCustomerCreditId, customers.find(c => c.id === payingCustomerCreditId)?.creditBalance || 0)} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl">Record</button>
                  <button onClick={() => setPayingCustomerCreditId(null)} className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-xl">Cancel</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {/* Customer History Modal */}
        {viewingHistoryId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
                    {viewingCustomer?.name[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{viewingCustomer?.name}</h3>
                    <p className="text-xs text-zinc-500 font-medium">{viewingCustomer?.phone || 'No phone'}</p>
                  </div>
                </div>
                <button onClick={() => setViewingHistoryId(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Spent</div>
                    <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(activeHistory.reduce((acc, s) => acc + s.total, 0))}
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Visits</div>
                    <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">{activeHistory.length}</div>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Loyalty</div>
                    <div className="text-lg font-black text-primary">{viewingCustomer?.loyaltyPoints} pts</div>
                  </div>
                </div>

                {viewingCustomer && viewingCustomer.creditBalance > 0 && (
                  <div className="p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-3xl">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="text-orange-600" size={20} />
                      <h4 className="text-sm font-black text-orange-600 uppercase tracking-wider">Outstanding Credit Evidence</h4>
                    </div>
                    <div className="space-y-4">
                      {customerHistory.filter(s => s.paymentMethod === 'credit').map(sale => (
                        <div key={sale.id} className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-orange-100 dark:border-orange-900/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-zinc-500">{new Date(sale.timestamp).toLocaleDateString()}</span>
                            <span className="text-xs font-black text-orange-600">{formatCurrency(sale.total)}</span>
                          </div>
                          <div className="space-y-1">
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[10px]">
                                <span className="text-zinc-600 dark:text-zinc-400">{item.quantity}x {item.name}</span>
                                <span className="font-medium text-zinc-500">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Transaction History</h4>
                    <div className="flex gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={10} /> Credit
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <ArrowDownCircle size={10} /> Paid
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {customerHistory.map(sale => {
                      const isCredit = sale.paymentMethod === 'credit';
                      return (
                        <div key={sale.id} className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl flex flex-col gap-3 hover:border-primary/30 transition-colors ${
                          sale.isVoided ? 'opacity-50 grayscale' : isCredit ? 'border-orange-200 bg-orange-50/10' : 'border-zinc-100 dark:border-zinc-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                {sale.isVoided && <span className="text-[8px] font-black bg-zinc-500 text-white px-1.5 py-0.5 rounded mr-2 align-middle uppercase tracking-widest">VOIDED</span>}
                                {isCredit && <span className="text-[8px] font-black bg-orange-600 text-white px-1.5 py-0.5 rounded mr-2 align-middle">CREDIT</span>}
                                {sale.items.map(i => i.name).join(', ')}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-bold uppercase mt-1">
                                {new Date(sale.timestamp).toLocaleString()} • {sale.paymentMethod}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-black ${isCredit ? 'text-orange-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                {formatCurrency(sale.total)}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-bold uppercase">#TRX-{sale.id}</div>
                            </div>
                          </div>
                          
                          {/* Itemized List for Evidence */}
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                            <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Itemized Evidence</div>
                            <div className="space-y-1.5">
                              {sale.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[11px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-zinc-400 font-bold">{item.quantity}x</span>
                                    <span className="text-zinc-700 dark:text-zinc-300">{item.name}</span>
                                    <span className={`text-[8px] font-black uppercase px-1 rounded ${item.type === 'service' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                      {item.type}
                                    </span>
                                  </div>
                                  <span className="font-bold text-zinc-600 dark:text-zinc-400">{formatCurrency(item.price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {customerHistory.length === 0 && (
                      <div className="py-12 text-center text-zinc-400 italic text-sm">No transactions found for this customer.</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
                <button 
                  onClick={() => setViewingHistoryId(null)}
                  className="w-full py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-bold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
