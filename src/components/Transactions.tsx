import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Search, 
  Calendar, 
  Filter, 
  Download,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Wallet,
  History,
  X
} from 'lucide-react';
import { db, Sale, Staff, Customer, Expense, Appointment, Product } from '../db';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

type TimeFilter = 'daily' | 'weekly' | 'monthly' | 'annually' | 'all';
type ViewTab = 'history';

export default function Transactions() {
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const appointments = useLiveQuery(() => db.appointments.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  
  const [activeTab] = useState<ViewTab>('history');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('daily');
  const [showVoidedOnly, setShowVoidedOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<number | string | null>(null);
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);

  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(new Date().setDate(new Date().getDate() - new Date().getDay())).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  // Combine sales and expenses into a single transaction list
  const allTransactions = [
    ...sales.map(s => ({ ...s, trxType: 'sale' as const })),
    ...expenses.map(e => ({
      id: e.id,
      timestamp: e.date,
      total: e.amount,
      paymentMethod: 'cash' as const,
      type: 'expense' as const,
      trxType: 'expense' as const,
      description: e.description,
      category: e.category,
      processedBy: e.processedBy,
      isVoided: false,
      items: []
    }))
  ];

  const filteredTransactions = allTransactions.filter(trx => {
    const matchesSearch = trx.id?.toString().includes(searchTerm) || 
                         trx.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (trx.trxType === 'sale' ? trx.type.toLowerCase().includes(searchTerm.toLowerCase()) : trx.description?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTime = timeFilter === 'all' || (
      timeFilter === 'daily' ? trx.timestamp >= startOfDay :
      timeFilter === 'weekly' ? trx.timestamp >= startOfWeek :
      timeFilter === 'monthly' ? trx.timestamp >= startOfMonth :
      timeFilter === 'annually' ? trx.timestamp >= startOfYear : true
    );

    const matchesVoided = showVoidedOnly ? trx.isVoided : !trx.isVoided;

    return matchesSearch && matchesTime && matchesVoided;
  }).sort((a, b) => b.timestamp - a.timestamp);

  const totalRevenue = allTransactions
    .filter(trx => {
      const matchesTime = timeFilter === 'all' || (
        timeFilter === 'daily' ? trx.timestamp >= startOfDay :
        timeFilter === 'weekly' ? trx.timestamp >= startOfWeek :
        timeFilter === 'monthly' ? trx.timestamp >= startOfMonth :
        timeFilter === 'annually' ? trx.timestamp >= startOfYear : true
      );
      return matchesTime && trx.trxType === 'sale' && trx.paymentMethod !== 'credit' && !trx.isVoided;
    })
    .reduce((acc, s) => {
      if (s.type === 'cash-in' || s.type === 'cash-out') return acc + (s.fee || 0);
      return acc + s.total;
    }, 0);
  
  const totalExpenses = allTransactions
    .filter(trx => {
      const matchesTime = timeFilter === 'all' || (
        timeFilter === 'daily' ? trx.timestamp >= startOfDay :
        timeFilter === 'weekly' ? trx.timestamp >= startOfWeek :
        timeFilter === 'monthly' ? trx.timestamp >= startOfMonth :
        timeFilter === 'annually' ? trx.timestamp >= startOfYear : true
      );
      return matchesTime && trx.trxType === 'expense';
    })
    .reduce((acc, e) => acc + e.total, 0);

  const handleVoidSale = async (sale: Sale) => {
    try {
      if (!sale.id) return;

      await db.transaction('rw', [db.sales, db.products, db.customers], async () => {
        // Mark as voided
        await db.sales.update(sale.id as any, {
          isVoided: true,
          voidedAt: Date.now(),
          voidedBy: 'Admin' // Should ideally be current user
        });

        // Restore stock for products
        for (const item of sale.items) {
          if (item.type === 'product' && item.productId) {
            const product = await db.products.get(item.productId as any);
            if (product) {
              await db.products.update(item.productId as any, {
                stock: product.stock + item.quantity,
                updatedAt: Date.now()
              });
            }
          }
        }

        // Restore customer balance and points if applicable
        if (sale.customerId) {
          const customer = await db.customers.get(sale.customerId as any);
          if (customer) {
            const updateData: any = {};
            
            // Reverse credit balance impact
            if (sale.isDebtPayment) {
              // If it was a debt payment, voiding it means the debt is back
              updateData.creditBalance = (customer.creditBalance || 0) + sale.total;
            } else {
              // If it was a normal sale (or down payment), voiding it means the debt is gone
              const balanceToDeduct = sale.remainingBalance !== undefined 
                ? sale.remainingBalance 
                : (sale.paymentMethod === 'credit' ? sale.total : 0);
              
              if (balanceToDeduct > 0) {
                updateData.creditBalance = Math.max(0, (customer.creditBalance || 0) - balanceToDeduct);
              }
            }
            
            // Reverse loyalty points
            // Use stored paidAmount if available, otherwise fallback to total (if not credit)
            const pointsPaid = sale.paidAmount !== undefined
              ? sale.paidAmount
              : (sale.paymentMethod === 'credit' ? 0 : sale.total);
            
            const pointsToReverse = Math.floor(pointsPaid);
            if (pointsToReverse > 0) {
              updateData.loyaltyPoints = Math.max(0, (customer.loyaltyPoints || 0) - pointsToReverse);
            }
            
            if (Object.keys(updateData).length > 0) {
              await db.customers.update(sale.customerId as any, updateData);
            }
          }
        }

        // Update linked appointment if any
        if (sale.appointmentId) {
          const appointment = await db.appointments.get(sale.appointmentId as any);
          if (appointment) {
            const newPaidAmount = Math.max(0, (appointment.paidAmount || 0) - sale.total);
            await db.appointments.update(sale.appointmentId as any, {
              paidAmount: newPaidAmount,
              paymentStatus: newPaidAmount === 0 ? 'unpaid' : 'partial'
            });
          }
        }
      });

      toast.success('Transaction voided and stock restored');
      setSelectedSaleId(null);
      setSaleToVoid(null);
    } catch (error) {
      toast.error('Failed to void transaction');
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-zinc-100">Financial Records</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">View and manage your sales history and receivables.</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 px-6 py-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-6">
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Period Revenue</div>
            <div className="text-xl font-black text-primary">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800" />
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Period Expenses</div>
            <div className="text-xl font-black text-red-500">{formatCurrency(totalExpenses)}</div>
          </div>
          <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800" />
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Count</div>
            <div className="text-xl font-black text-zinc-900 dark:text-zinc-100">
              {filteredTransactions.length}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by ID or method..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-primary outline-none text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-1">
            {(['daily', 'weekly', 'monthly', 'annually', 'all'] as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                  timeFilter === filter 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowVoidedOnly(!showVoidedOnly)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold border transition-all flex items-center gap-2 ${
              showVoidedOnly 
                ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' 
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <AlertCircle size={14} />
            {showVoidedOnly ? 'Showing Voided' : 'Show Voided'}
          </button>
        </div>
      </div>

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Mobile List View */}
          <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredTransactions.map((trx) => {
              const customer = trx.trxType === 'sale' ? customers.find(c => c.id === trx.customerId) : null;
              const isExpense = trx.trxType === 'expense';
              
              return (
                <div 
                  key={`trx-mob-${trx.trxType}-${trx.id}`} 
                  className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => isExpense ? null : setSelectedSaleId(trx.id || null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                      #{isExpense ? 'EXP' : 'TRX'}-{trx.id}
                      {trx.trxType === 'sale' && trx.isVoided && (
                        <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Voided</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(trx.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {isExpense ? trx.description : (customer?.name || 'Walk-in Customer')}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-tighter ${
                          isExpense ? 'bg-red-100 text-red-600' :
                          trx.paymentMethod === 'credit' ? 'bg-orange-100 text-orange-600' : 
                          trx.paymentMethod === 'e-wallet' ? 'bg-blue-100 text-blue-600' :
                          trx.paymentMethod === 'bank-transfer' ? 'bg-purple-100 text-purple-600' :
                          'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}>
                          {isExpense ? trx.category : trx.paymentMethod}
                        </span>
                        {trx.trxType === 'sale' && trx.type !== 'sale' && (
                          <span className="px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-tighter bg-purple-100 text-purple-600">
                            {trx.type}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black ${isExpense ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {isExpense ? '-' : ''}{formatCurrency(trx.total)}
                      </div>
                      {!isExpense && !trx.isVoided && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSaleToVoid(trx as Sale); }}
                          className="mt-2 px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100"
                        >
                          Void Sale
                        </button>
                      )}
                      {!isExpense && trx.isVoided && <div className="text-[10px] text-zinc-400 font-bold">Voided</div>}
                      {!isExpense && !trx.isVoided && <div className="text-[10px] text-primary font-bold mt-1">View Items</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">ID</th>
                  <th className="px-6 py-4 font-semibold">Date & Time</th>
                  <th className="px-6 py-4 font-semibold">Description/Customer</th>
                  <th className="px-6 py-4 font-semibold">Method/Category</th>
                  <th className="px-6 py-4 font-semibold">Processed By</th>
                  <th className="px-6 py-4 font-semibold">Total</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredTransactions.map((trx) => {
                  const customer = trx.trxType === 'sale' ? customers.find(c => c.id === trx.customerId) : null;
                  const isExpense = trx.trxType === 'expense';
                  
                  return (
                    <tr key={`${trx.trxType}-${trx.id}`} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group ${trx.trxType === 'sale' && trx.isVoided ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 text-xs font-mono text-zinc-400">
                        <div className="flex flex-col gap-1">
                          <span>#{isExpense ? 'EXP' : 'TRX'}-{trx.id}</span>
                          {trx.trxType === 'sale' && trx.isVoided && (
                            <span className="bg-red-500 text-white px-1.5 py-0.5 rounded text-[8px] font-black uppercase w-fit">Voided</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100 font-medium">
                          <Clock size={14} className="text-zinc-400" />
                          {new Date(trx.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {isExpense ? trx.description : (customer?.name || 'Walk-in Customer')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter w-fit ${
                            isExpense ? 'bg-red-100 text-red-600' :
                            trx.paymentMethod === 'credit' ? 'bg-orange-100 text-orange-600' : 
                            trx.paymentMethod === 'e-wallet' ? 'bg-blue-100 text-blue-600' :
                            trx.paymentMethod === 'bank-transfer' ? 'bg-purple-100 text-purple-600' :
                            'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}>
                            {isExpense ? trx.category : trx.paymentMethod}
                          </span>
                          {trx.trxType === 'sale' && trx.type !== 'sale' && (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tighter w-fit bg-purple-100 text-purple-600">
                              {trx.type}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {trx.processedBy || 'System'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-black ${isExpense ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                          {isExpense ? '-' : ''}{formatCurrency(trx.total)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isExpense && (
                            <button 
                              onClick={() => setSelectedSaleId(trx.id || null)}
                              className="px-3 py-1 bg-zinc-50 dark:bg-zinc-800 text-primary text-[10px] font-bold rounded-lg border border-zinc-100 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                              View Items
                            </button>
                          )}
                          {!isExpense && !trx.isVoided && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSaleToVoid(trx as Sale); }}
                              className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center text-zinc-400 italic text-sm">No transactions found for this period</div>
          )}
        </div>
      )}

      {/* Sale Details Modal */}
      <AnimatePresence>
        {selectedSaleId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Transaction Details</h3>
                <button onClick={() => setSelectedSaleId(null)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <ChevronLeft size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  {sales.find(s => s.id === selectedSaleId)?.items?.map((item, i) => {
                    return (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-400">
                            {item.quantity}x
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</div>
                              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                item.type === 'service' 
                                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                                  : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {item.type}
                              </span>
                            </div>
                            {item.staffIds && item.staffIds.length > 0 && (
                              <div className="text-[10px] text-zinc-500 flex flex-wrap gap-1">
                                Staff: {item.staffIds.map(sid => staff.find(s => s.id === sid)?.name).filter(Boolean).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    );
                  })}
                </div>
                {sales.find(s => s.id === selectedSaleId)?.notes && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Sale Notes</div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                      "{sales.find(s => s.id === selectedSaleId)?.notes}"
                    </p>
                  </div>
                )}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-zinc-500">Total Amount</span>
                    <span className="text-xl font-black text-primary">
                      {formatCurrency(sales.find(s => s.id === selectedSaleId)?.total || 0)}
                    </span>
                  </div>
                </div>
                {sales.find(s => s.id === selectedSaleId)?.processedBy && (
                  <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    <span>Processed By</span>
                    <span>{sales.find(s => s.id === selectedSaleId)?.processedBy}</span>
                  </div>
                )}
                {sales.find(s => s.id === selectedSaleId)?.isVoided && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30 text-center">
                    <div className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Voided Transaction</div>
                    <div className="text-[10px] text-red-500 mt-1">
                      Voided on {new Date(sales.find(s => s.id === selectedSaleId)?.voidedAt || 0).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                {!sales.find(s => s.id === selectedSaleId)?.isVoided && (
                  <button 
                    onClick={() => handleVoidSale(selectedSaleId!)}
                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl text-sm shadow-lg shadow-red-600/20"
                  >
                    Void Sale
                  </button>
                )}
                <button 
                  onClick={() => setSelectedSaleId(null)}
                  className="flex-1 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Void Confirmation Modal */}
      <AnimatePresence>
        {saleToVoid && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="text-red-600" size={32} />
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 mb-2">Void Transaction?</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                  Are you sure you want to void transaction <span className="font-mono font-bold">#{saleToVoid.id}</span>? 
                  This will restore product stock and mark the sale as invalid. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSaleToVoid(null)}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleVoidSale(saleToVoid)}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 transition-colors"
                  >
                    Yes, Void Sale
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
