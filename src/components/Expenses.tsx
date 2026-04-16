import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Wallet, 
  Calendar,
  Search,
  Filter,
  ArrowDownCircle,
  TrendingDown,
  MoreVertical,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag
} from 'lucide-react';
import { db, Expense, ExpenseCategory } from '../db';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Expenses() {
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray()) || [];
  const expenseCategories = useLiveQuery(() => db.expenseCategories.toArray()) || [];
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [dateRange, setDateRange] = useState<'Today' | '7d' | '30d' | 'All'>('All');
  
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof Expense; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc'
  });
  
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: 'Other',
    date: Date.now()
  });

  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    const exists = expenseCategories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase());
    if (exists) {
      toast.error('Category already exists');
      return;
    }

    try {
      const categoryData = {
        name: newCategoryName.trim(),
        createdAt: Date.now()
      };
      await db.expenseCategories.add(categoryData as any);
      
      setNewExpense({ ...newExpense, category: newCategoryName.trim() });
      setNewCategoryName('');
      setIsAddingCategory(false);
      toast.success('Category added');
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const expenseData = {
        description: newExpense.description,
        amount: Number(newExpense.amount),
        category: newExpense.category || 'Other',
        date: newExpense.date || Date.now(),
        processedBy: 'Admin'
      };
      
      await db.expenses.add(expenseData as any);
      
      setNewExpense({ description: '', amount: 0, category: 'Other', date: Date.now() });
      setIsAdding(false);
      toast.success('Expense recorded');
    } catch (error) {
      toast.error('Failed to record expense');
    }
  };

  const handleDelete = async (id: number | string) => {
    if (confirm('Are you sure you want to delete this expense record?')) {
      try {
        await db.expenses.delete(id as any);
        toast.success('Expense deleted');
      } catch (error) {
        toast.error('Delete failed');
      }
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || exp.category === filterCategory;
    
    let matchesDate = true;
    const expDate = new Date(exp.date);
    const now = new Date();
    
    if (dateRange === 'Today') {
      matchesDate = expDate.toDateString() === now.toDateString();
    } else if (dateRange === '7d') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      matchesDate = expDate >= sevenDaysAgo;
    } else if (dateRange === '30d') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      matchesDate = expDate >= thirtyDaysAgo;
    }

    return matchesSearch && matchesCategory && matchesDate;
  }).sort((a, b) => {
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

  const handleSort = (key: keyof Expense) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: keyof Expense }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={12} className="ml-1 text-primary" /> 
      : <ArrowDown size={12} className="ml-1 text-primary" />;
  };

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-zinc-100">Expense Tracking</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage business costs, salaries, and overheads</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-2xl font-black hover:brightness-110 shadow-xl shadow-red-600/20 transition-all active:scale-95"
        >
          <Plus size={20} />
          Record Expense
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center text-red-600">
              <TrendingDown size={20} />
            </div>
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Expenses</span>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
            {formatCurrency(totalExpenses)}
          </div>
          <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase">Based on current filters</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search expenses..." 
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Date Range Filter */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700">
          {(['Today', '7d', '30d', 'All'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                dateRange === range 
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select 
            className="w-full md:w-auto px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {expenseCategories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expense List */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th 
                  className="px-6 py-4 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Date <SortIcon columnKey="date" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center">
                    Description <SortIcon columnKey="description" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">
                    Category <SortIcon columnKey="category" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center">
                    Amount <SortIcon columnKey="amount" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{expense.description}</div>
                    <div className="text-[10px] text-zinc-400 uppercase font-bold">By {expense.processedBy}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full text-[10px] font-black uppercase">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-red-600">
                    -{formatCurrency(expense.amount)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(expense.id!)}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredExpenses.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ArrowDownCircle size={32} className="text-zinc-300" />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium italic">No expense records found.</p>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                    <TrendingDown size={20} />
                  </div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Record Expense</h3>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAdd} className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Description</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Monthly Rent, Staff Salary"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all"
                    value={newExpense.description}
                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Amount ({currency})</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold"
                      value={newExpense.amount}
                      onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0})}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Category</label>
                      <button 
                        type="button"
                        onClick={() => setIsAddingCategory(!isAddingCategory)}
                        className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                      >
                        {isAddingCategory ? 'Cancel' : '+ New'}
                      </button>
                    </div>
                    
                    {isAddingCategory ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Category name"
                          className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold text-sm"
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                        />
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="p-3 bg-primary text-white rounded-2xl hover:brightness-110 transition-all"
                        >
                          <Check size={20} />
                        </button>
                      </div>
                    ) : (
                      <select
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold"
                        value={newExpense.category}
                        onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                      >
                        {expenseCategories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 transition-all font-bold"
                    value={new Date(newExpense.date || Date.now()).toISOString().split('T')[0]}
                    onChange={e => setNewExpense({...newExpense, date: new Date(e.target.value).getTime()})}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-6 py-3 text-zinc-600 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-3 bg-red-600 text-white font-black rounded-2xl hover:brightness-110 shadow-xl shadow-red-600/20 transition-all active:scale-95"
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
