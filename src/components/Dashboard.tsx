import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  TrendingUp, 
  Users, 
  Package, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Wallet,
  Store,
  Building2,
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  Zap,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { db, Sale, Service, Product, Staff, User, Appointment, Customer, Attendance, Expense, Shift } from '../db';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

export default function Dashboard({ onViewAllTransactions, currentUser }: { onViewAllTransactions?: () => void, currentUser?: User }) {
  const { t } = useLanguage();
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const appointments = useLiveQuery(() => db.appointments.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const attendance = useLiveQuery(() => db.attendance.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const shifts = useLiveQuery(() => db.shifts.toArray()) || [];
  const businessEvents = useLiveQuery(() => db.businessEvents.toArray()) || [];
  const activeShift = useLiveQuery(() => db.shifts.where('status').equals('open').first());

  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [timeRange, setTimeRange] = useState('7d');
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [startingCash, setStartingCash] = useState(0);
  const [actualCash, setActualCash] = useState(0);
  const [shiftNotes, setShiftNotes] = useState('');

  const handleOpenShift = async () => {
    try {
      await db.shifts.add({
        startTime: Date.now(),
        openedBy: currentUser?.name || 'Admin',
        startingCash,
        status: 'open',
        createdAt: Date.now()
      } as any);
      setIsOpeningShift(false);
      setStartingCash(0);
      toast.success('Shift opened successfully');
    } catch (error) {
      toast.error('Failed to open shift');
    }
  };

  const calculateExpectedCash = () => {
    if (!activeShift) return 0;
    const shiftSales = sales.filter(s => 
      s.timestamp >= activeShift.startTime && 
      s.paymentMethod === 'cash' && 
      !s.isVoided
    );
    const shiftExpenses = expenses.filter(e => 
      e.date >= activeShift.startTime && 
      e.category !== 'Salary' // Assuming salaries aren't paid from drawer cash
    );

    const cashIn = shiftSales.reduce((acc, s) => acc + (s.type === 'cash-in' ? (s.fee || 0) : s.total), 0);
    const cashOut = shiftExpenses.reduce((acc, e) => acc + e.amount, 0);

    return activeShift.startingCash + cashIn - cashOut;
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    const expected = calculateExpectedCash();
    try {
      await db.shifts.update(activeShift.id!, {
        endTime: Date.now(),
        closedBy: currentUser?.name || 'Admin',
        expectedCash: expected,
        actualCash,
        difference: actualCash - expected,
        status: 'closed',
        notes: shiftNotes
      });
      setIsClosingShift(false);
      setActualCash(0);
      setShiftNotes('');
      toast.success('Shift closed successfully');
    } catch (error) {
      toast.error('Failed to close shift');
    }
  };

  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const filteredSales = sales.filter(s => {
    const now = Date.now();
    const diff = now - s.timestamp;
    const today = new Date().toDateString();
    if (timeRange === '24h') return new Date(s.timestamp).toDateString() === today;
    if (timeRange === '7d') return diff <= 7 * 24 * 60 * 60 * 1000;
    if (timeRange === '30d') return diff <= 30 * 24 * 60 * 60 * 1000;
    if (timeRange === 'all') return true;
    return true;
  });

  const filteredExpenses = expenses.filter(e => {
    const now = Date.now();
    const diff = now - e.date;
    const today = new Date().toDateString();
    if (timeRange === '24h') return new Date(e.date).toDateString() === today;
    if (timeRange === '7d') return diff <= 7 * 24 * 60 * 60 * 1000;
    if (timeRange === '30d') return diff <= 30 * 24 * 60 * 60 * 1000;
    if (timeRange === 'all') return true;
    return true;
  });

  const today = new Date().toDateString();
  const todayRevenue = sales
    .filter(s => new Date(s.timestamp).toDateString() === today && !s.isVoided)
    .reduce((acc, s) => {
      const amount = (s.type === 'cash-in' || s.type === 'cash-out') ? (s.fee || 0) : s.total;
      return acc + amount;
    }, 0);
  
  const totalRevenue = filteredSales
    .filter(s => !s.isVoided)
    .reduce((acc, s) => {
      const amount = (s.type === 'cash-in' || s.type === 'cash-out') ? (s.fee || 0) : s.total;
      return acc + amount;
    }, 0);

  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const totalProfit = totalRevenue - totalExpenses;

  const pendingAppointments = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
  const lowStockItems = products.filter(p => p.stock < 10).length;

  const expiringSoonItems = products.filter(p => {
    if (!p.expiryDate) return false;
    const now = Date.now();
    const diff = p.expiryDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 30;
  }).sort((a, b) => (a.expiryDate || 0) - (b.expiryDate || 0));

  const upcomingEvents = businessEvents.filter(e => {
    const now = Date.now();
    // Show events from today up to 30 days in the future
    return e.date >= now - (24 * 60 * 60 * 1000) && e.date <= now + (30 * 24 * 60 * 60 * 1000);
  }).sort((a, b) => a.date - b.date).slice(0, 5);

  // Calculate On-Duty Staff
  const onDutyStaff = users.filter(user => {
    const userLogs = attendance
      .filter(l => l.staffId === user.id)
      .sort((a, b) => b.timestamp - a.timestamp);
    const lastLog = userLogs[0];
    const status = lastLog?.type || 'clock-out';
    return status === 'clock-in' || status === 'lunch-end' || status === 'break-end';
  });

  const rangeLabel = {
    '24h': 'Today',
    '7d': '7d',
    '30d': '30d',
    'all': 'All'
  }[timeRange] || 'Today';

  const salesByDay = filteredSales.reduce((acc: any[], t) => {
    if (t.isVoided) return acc;
    const date = new Date(t.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const existing = acc.find(item => item.date === date);
    const amount = (t.type === 'cash-in' || t.type === 'cash-out') ? (t.fee || 0) : t.total;
    if (existing) existing.total += amount;
    else acc.push({ date, total: amount });
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const chartData = salesByDay.length > 0 ? salesByDay : [{ date: 'No Data', total: 0 }];

  const stats = [
    { label: `${rangeLabel} Revenue`, value: formatCurrency(totalRevenue), icon: DollarSign, trend: 'Revenue', up: true },
    { label: `${rangeLabel} Profit`, value: formatCurrency(totalProfit), icon: TrendingUp, trend: 'Profit', up: totalProfit >= 0 },
    { label: `${rangeLabel} Expenses`, value: formatCurrency(totalExpenses), icon: Wallet, trend: 'Costs', up: false },
    ...(settings?.showServices !== false ? [{ label: 'Pending Tasks', value: pendingAppointments.toString(), icon: CalendarIcon, trend: 'Schedules', up: true }] : []),
    ...(upcomingEvents.length > 0 ? [{ label: 'Upcoming Events', value: upcomingEvents.length.toString(), icon: Zap, trend: 'Business', up: true }] : []),
    ...(settings?.showProducts !== false ? [{ label: 'Low Stock', value: lowStockItems.toString(), icon: Package, trend: 'Inventory', up: lowStockItems < 5 }] : []),
    ...(expiringSoonItems.length > 0 ? [{ label: 'Expiring Soon', value: expiringSoonItems.length.toString(), icon: AlertTriangle, trend: 'Alerts', up: false }] : []),
  ].slice(0, 4);

  const topItems = filteredSales.reduce((acc: any, sale) => {
    if (sale.isVoided) return acc;
    sale.items.forEach(item => {
      const key = `${item.type}-${item.productId || item.serviceId}`;
      if (!acc[key]) acc[key] = { name: item.name, quantity: 0, type: item.type };
      acc[key].quantity += item.quantity;
    });
    return acc;
  }, {});

  const topSellingItems = Object.values(topItems)
    .filter((item: any) => {
      if (item.type === 'product' && settings?.showProducts === false) return false;
      if (item.type === 'service' && settings?.showServices === false) return false;
      return true;
    })
    .sort((a: any, b: any) => b.quantity - a.quantity)
    .slice(0, 5);

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {settings?.storeLogo ? (
            <img 
              src={settings.storeLogo} 
              alt={settings.storeName} 
              className="w-16 h-16 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-800 shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Store size={32} />
            </div>
          )}
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-zinc-100">
              {t.welcome}, <span className="text-primary">{currentUser?.name || settings?.storeName || 'Admin'}</span>
            </h1>
            <p className="text-sm text-zinc-500 font-medium">{t.dashboardSubtitle}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            {[
              { id: '24h', label: 'Today' },
              { id: '7d', label: '7d' },
              { id: '30d', label: '30d' },
              { id: 'all', label: 'All' }
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  timeRange === range.id
                    ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Clock size={14} />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: t.newSale, icon: ShoppingCart, color: 'bg-primary', action: () => (window as any).setActiveView?.('sales') },
          { label: t.attendance, icon: Clock, color: 'bg-blue-600', action: () => (window as any).setActiveView?.('attendance') },
          { label: t.newAppointment, icon: CalendarIcon, color: 'bg-purple-600', action: () => (window as any).setActiveView?.('schedules') },
          { label: t.addCustomer, icon: Users, color: 'bg-green-600', action: () => (window as any).setActiveView?.('accounts') },
        ].map((item, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={item.action}
            className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm text-center sm:text-left group"
          >
            <div className={`p-2 rounded-xl ${item.color} text-white group-hover:scale-110 transition-transform`}>
              <item.icon size={18} />
            </div>
            <span className="text-[10px] sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Shift Management */}
      <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${activeShift ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-400'} dark:bg-zinc-800`}>
              <Store size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {activeShift ? t.shiftOpen : t.shiftClosed}
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                {activeShift 
                  ? `${t.openedBy} ${activeShift.openedBy} at ${new Date(activeShift.startTime).toLocaleTimeString()}`
                  : t.openShiftPrompt}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {activeShift ? (
              <>
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Expected Cash</div>
                  <div className="text-lg font-black text-primary">{formatCurrency(calculateExpectedCash())}</div>
                </div>
                <button 
                  onClick={() => { setActualCash(calculateExpectedCash()); setIsClosingShift(true); }}
                  className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl text-sm shadow-lg shadow-zinc-900/20 dark:shadow-zinc-100/20"
                >
                  {t.closeShift}
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsOpeningShift(true)}
                className="px-6 py-3 bg-primary text-white font-bold rounded-2xl text-sm shadow-lg shadow-primary-light"
              >
                {t.openShift}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-zinc-900 p-4 lg:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2 lg:mb-4">
              <div className="p-2 lg:p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl lg:rounded-2xl text-zinc-600 dark:text-zinc-400">
                <stat.icon size={16} className="lg:w-5 lg:h-5" />
              </div>
              <div className={`flex items-center gap-1 text-[8px] lg:text-[10px] font-black uppercase tracking-wider ${stat.up ? 'text-green-600' : 'text-primary'}`}>
                {stat.trend}
              </div>
            </div>
            <div className="text-lg lg:text-3xl font-black text-zinc-900 dark:text-zinc-100">{stat.value}</div>
            <div className="text-[10px] lg:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 lg:mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-base lg:text-lg font-bold text-zinc-900 dark:text-zinc-100">Revenue Performance</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Sales</span>
              </div>
            </div>
          </div>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10, fontWeight: 600}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10, fontWeight: 600}} />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                    fontSize: '12px',
                    backgroundColor: '#18181b',
                    color: '#f4f4f5'
                  }}
                  itemStyle={{ color: '#f4f4f5' }}
                />
                <Area type="monotone" dataKey="total" stroke="var(--primary-color)" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* On Duty Staff */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base lg:text-lg font-bold text-zinc-900 dark:text-zinc-100">On Duty Staff</h3>
            <span className="px-2 py-1 bg-green-100 text-green-600 text-[10px] font-black rounded-lg uppercase">
              {onDutyStaff.length} Active
            </span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar max-h-[300px] pr-1">
            {onDutyStaff.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                    {user.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{user.name}</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">{user.role}</div>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
            ))}
            {onDutyStaff.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                <Users size={32} className="text-zinc-300 dark:text-zinc-700" />
                <p className="text-xs text-zinc-500 italic">No staff members are currently on duty.</p>
              </div>
            )}
          </div>
          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
              <span>Total Team</span>
              <span>{users.length} Members</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Top Selling */}
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <h3 className="text-base lg:text-lg font-bold mb-6 text-zinc-900 dark:text-zinc-100">Top Selling Items</h3>
          <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar max-h-[300px] pr-1">
            {topSellingItems.map((item: any, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary font-black rounded-xl text-xs border border-primary/20">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.name}</div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{item.quantity} units sold • {item.type}</div>
                  </div>
                </div>
                <Zap size={16} className="text-primary opacity-20" />
              </div>
            ))}
            {topSellingItems.length === 0 && (
              <div className="text-center py-12 text-zinc-400 italic text-sm">No sales data yet</div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-base lg:text-lg font-bold text-zinc-900 dark:text-zinc-100">Recent Transactions</h3>
            <button 
              onClick={onViewAllTransactions}
              className="text-xs font-bold text-primary hover:brightness-110 uppercase tracking-wider"
            >
              View All
            </button>
          </div>
          
          <div className="flex-1 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto no-scrollbar max-h-[300px]">
            {sales.filter(s => !s.isVoided).slice(-5).reverse().map((sale) => {
              const customer = customers.find(c => c.id === sale.customerId);
              return (
                <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 dark:text-zinc-500 border border-zinc-100 dark:border-zinc-800">
                      <ShoppingCart size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {customer?.name || 'Walk-in Customer'}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase">
                        #TRX-{sale.id} • {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(sale.total)}</div>
                    <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md inline-block ${
                      sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-600' : 
                      sale.paymentMethod === 'bank-transfer' ? 'bg-blue-100 text-blue-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {sale.paymentMethod}
                    </div>
                  </div>
                </div>
              );
            })}
            {sales.length === 0 && (
              <div className="p-12 text-center text-zinc-400 dark:text-zinc-500 italic text-sm">No transactions yet</div>
            )}
          </div>
        </div>
      </div>

      {upcomingEvents.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Zap size={20} />
              </div>
              <h3 className="text-base lg:text-lg font-bold text-zinc-900 dark:text-zinc-100">Upcoming Business Events</h3>
            </div>
            <button 
              onClick={() => (window as any).setActiveView?.('business-calendar')}
              className="text-xs font-bold text-primary hover:brightness-110 uppercase tracking-wider"
            >
              View Calendar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {upcomingEvents.map(event => {
              const isToday = new Date(event.date).toDateString() === new Date().toDateString();
              return (
                <div key={event.id} className={`flex flex-col p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border ${isToday ? 'border-primary shadow-lg shadow-primary-light' : 'border-zinc-100 dark:border-zinc-800'}`}>
                   <div className="flex justify-between items-start mb-3">
                     <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                       event.type === 'lease' ? 'bg-blue-100 text-blue-600' : 
                       event.type === 'delivery' ? 'bg-purple-100 text-purple-600' :
                       event.type === 'expiry' ? 'bg-red-100 text-red-600' :
                       'bg-primary/10 text-primary'
                     }`}>
                       {event.type}
                     </span>
                     {isToday && <span className="text-[10px] font-black text-primary animate-pulse">TODAY</span>}
                   </div>
                   <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">{event.title}</h4>
                   <p className="text-[10px] text-zinc-500 font-medium mb-3 line-clamp-1">{event.description || 'Business Essential'}</p>
                   <div className="mt-auto flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                     <div className="flex items-center gap-1 text-zinc-400">
                       <Clock size={10} />
                       <span className="text-[9px] font-bold">{new Date(event.date).toLocaleDateString()}</span>
                     </div>
                     {event.recurrence && event.recurrence !== 'none' && (
                       <span className="text-[9px] font-bold text-primary capitalize">{event.recurrence}</span>
                     )}
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {settings?.showProducts !== false && expiringSoonItems.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base lg:text-lg font-bold text-zinc-900 dark:text-zinc-100">Inventory Expiry Alerts</h3>
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{expiringSoonItems.length} Items At Risk</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expiringSoonItems.map(item => {
              const days = Math.ceil(((item.expiryDate || 0) - Date.now()) / (1000 * 60 * 60 * 24));
              const isExpired = days < 0;
              return (
                <div key={item.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-100 dark:border-zinc-800">
                      {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <Package size={20} className="text-zinc-300" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Stock: {item.stock}</div>
                    </div>
                  </div>
                  <div className={`text-right px-3 py-1 rounded-lg ${isExpired ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    <div className="text-[10px] font-black uppercase leading-none">{isExpired ? 'Expired' : 'Expires In'}</div>
                    <div className="text-xs font-bold">{isExpired ? `${Math.abs(days)}d ago` : `${days} days`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shift Modals */}
      {isOpeningShift && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Open New Shift</h3>
              <button onClick={() => setIsOpeningShift(false)} className="p-2 text-zinc-500">
                <Clock size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Starting Cash in Drawer</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none text-lg font-bold" 
                  value={startingCash} 
                  onChange={e => setStartingCash(parseFloat(e.target.value) || 0)}
                  autoFocus
                />
              </div>
              <button 
                onClick={handleOpenShift}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary-light"
              >
                Start Shift
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isClosingShift && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold">Close Shift</h3>
              <button onClick={() => setIsClosingShift(false)} className="p-2 text-zinc-500">
                <Clock size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Expected Cash</div>
                  <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">{formatCurrency(calculateExpectedCash())}</div>
                </div>
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Difference</div>
                  <div className={`text-lg font-black ${actualCash - calculateExpectedCash() === 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatCurrency(actualCash - calculateExpectedCash())}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Actual Cash in Drawer</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none text-lg font-bold" 
                  value={actualCash} 
                  onChange={e => setActualCash(parseFloat(e.target.value) || 0)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Shift Notes (Optional)</label>
                <textarea 
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none text-sm min-h-[80px]" 
                  placeholder="Any discrepancies or notes..."
                  value={shiftNotes}
                  onChange={e => setShiftNotes(e.target.value)}
                />
              </div>
              <button 
                onClick={handleCloseShift}
                className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl shadow-lg"
              >
                End Shift & Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
