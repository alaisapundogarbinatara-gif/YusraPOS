import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  BarChart3, TrendingUp, TrendingDown, Download, Calendar, Filter, PieChart as PieChartIcon, LineChart as LineChartIcon, Wallet, Building2, Clock, AlertCircle
} from 'lucide-react';
import { db, Service, Sale, Expense, Product, Customer, Staff, Appointment } from '../db';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLanguage } from '../contexts/LanguageContext';
import { downloadFile } from '../lib/download';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Brush
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl">
        <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
              {entry.name}: {typeof entry.value === 'number' ? new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(entry.value) : entry.value}
            </p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const { t } = useLanguage();
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const expenses = useLiveQuery(() => db.expenses.toArray()) || [];
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  const appointments = useLiveQuery(() => db.appointments.toArray()) || [];
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [timeRange, setTimeRange] = useState('7d');

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

  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);

  const totalRevenue = filteredSales.reduce((acc, t) => {
    if (t.isVoided) return acc;
    if (t.type === 'cash-in' || t.type === 'cash-out') return acc + (t.fee || 0);
    return acc + t.total;
  }, 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const totalProfit = filteredSales.reduce((acc, t) => {
    if (t.isVoided) return acc;
    // COGS is always counted when the sale happens (inventory is gone)
    const saleCOGS = t.items.reduce((itemAcc, item) => {
      const cost = item.type === 'service' 
        ? services.find(s => s.id === item.serviceId)?.cost || 0
        : products.find(p => p.id === item.productId)?.cost || 0;
      return itemAcc + (cost * item.quantity);
    }, 0);

    // Revenue is counted for all non-voided sales (including credit)
    const saleRevenue = (t.type === 'cash-in' || t.type === 'cash-out') ? (t.fee || 0) : t.total;
    
    return acc + (saleRevenue - saleCOGS);
  }, 0) - totalExpenses;

  const totalCustomerDebt = customers.reduce((acc, c) => acc + (c.creditBalance || 0), 0);

  const itemSales = filteredSales.reduce((acc: any, sale) => {
    if (sale.isVoided) return acc;
    sale.items.forEach(item => {
      if (item.type === 'product' && settings?.showProducts === false) return;
      if (item.type === 'service' && settings?.showServices === false) return;
      
      const key = `${item.type}-${item.productId || item.serviceId}`;
      if (!acc[key]) acc[key] = { name: item.name, quantity: 0, revenue: 0, type: item.type };
      acc[key].quantity += item.quantity;
      
      const revenue = (sale.type === 'cash-in' || sale.type === 'cash-out') 
          ? (sale.fee || 0) 
          : (item.quantity * item.price);
        
      acc[key].revenue += revenue;
    });
    return acc;
  }, {});

  const topItems = Object.values(itemSales).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 6);

  const slowMovingItems = products
    .filter(p => {
      const key = `product-${p.id}`;
      const salesCount = itemSales[key]?.quantity || 0;
      return salesCount < 5; // Arbitrary threshold for "slow moving"
    })
    .sort((a, b) => {
      const salesA = itemSales[`product-${a.id}`]?.quantity || 0;
      const salesB = itemSales[`product-${b.id}`]?.quantity || 0;
      return salesA - salesB;
    })
    .slice(0, 6);

  const peakHoursData = filteredSales.reduce((acc: any[], sale) => {
    if (sale.isVoided) return acc;
    const hour = new Date(sale.timestamp).getHours();
    const existing = acc.find(item => item.hour === hour);
    if (existing) existing.count += 1;
    else acc.push({ hour, count: 1 });
    return acc;
  }, [])
  .sort((a, b) => a.hour - b.hour)
  .map(item => ({
    ...item,
    label: `${item.hour}:00`
  }));

  const voidedSales = filteredSales.filter(s => s.isVoided);
  const totalVoidedAmount = voidedSales.reduce((acc, s) => acc + s.total, 0);

  const generateSalesReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`${settings?.storeName || 'Business'} - Sales Report`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Range: ${timeRange.toUpperCase()}`, 14, 35);

    const tableData = filteredSales
      .filter(s => !s.isVoided)
      .map(s => [
        new Date(s.timestamp).toLocaleString(),
        s.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
        s.paymentMethod.toUpperCase(),
        formatCurrency(s.total)
      ]);

    autoTable(doc, {
      startY: 45,
      head: [['Date', 'Items', 'Method', 'Total']],
      body: tableData,
      foot: [['', '', 'TOTAL REVENUE', formatCurrency(totalRevenue)]]
    });

    const fileName = `sales_report_${timeRange}_${Date.now()}.pdf`;
    const pdfOutput = doc.output('arraybuffer');
    downloadFile(new Uint8Array(pdfOutput), fileName, 'application/pdf')
      .then(() => toast.success('Sales report downloaded'))
      .catch(() => toast.error('Failed to download report'));
  };

  const generateStaffReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`${settings?.storeName || 'Business'} - Staff Performance`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    const performanceData = staff.map(s => {
      const staffSales = filteredSales.filter(sale => 
        !sale.isVoided && sale.items.some(item => item.staffIds?.includes(Number(s.id)))
      );
      const staffAppointments = appointments.filter(a => 
        a.staffIds.includes(s.id!) || a.staffIds.includes(String(s.id))
      );
      
      const totalGenerated = staffSales.reduce((acc, sale) => acc + sale.total, 0);
      
      return [
        s.name,
        s.role,
        staffSales.length,
        staffAppointments.length,
        formatCurrency(totalGenerated)
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['Name', 'Role', 'Sales', 'Appointments', 'Revenue Generated']],
      body: performanceData
    });

    const fileName = `staff_report_${Date.now()}.pdf`;
    const pdfOutput = doc.output('arraybuffer');
    downloadFile(new Uint8Array(pdfOutput), fileName, 'application/pdf')
      .then(() => toast.success('Staff report downloaded'))
      .catch(() => toast.error('Failed to download report'));
  };

  const generateCreditReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`${settings?.storeName || 'Business'} - Credit Report`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    const creditData = customers
      .filter(c => (c.creditBalance || 0) > 0)
      .map(c => [
        c.name,
        c.phone || 'N/A',
        formatCurrency(c.creditBalance || 0),
        new Date(c.createdAt).toLocaleDateString()
      ]);

    autoTable(doc, {
      startY: 45,
      head: [['Customer', 'Phone', 'Balance', 'Customer Since']],
      body: creditData,
      foot: [['', 'TOTAL DEBT', formatCurrency(totalCustomerDebt), '']]
    });

    const fileName = `credit_report_${Date.now()}.pdf`;
    const pdfOutput = doc.output('arraybuffer');
    downloadFile(new Uint8Array(pdfOutput), fileName, 'application/pdf')
      .then(() => toast.success('Credit report downloaded'))
      .catch(() => toast.error('Failed to download report'));
  };

  const generateStockReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`${settings?.storeName || 'Business'} - Stock Report`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    const stockData = products.map(p => [
      p.name,
      p.sku,
      p.category,
      p.stock,
      formatCurrency(p.price),
      formatCurrency(p.stock * p.price)
    ]);

    const totalStockValue = products.reduce((acc, p) => acc + (p.stock * p.price), 0);

    autoTable(doc, {
      startY: 45,
      head: [['Product', 'SKU', 'Category', 'Stock', 'Price', 'Value']],
      body: stockData,
      foot: [['', '', '', '', 'TOTAL VALUE', formatCurrency(totalStockValue)]]
    });

    const fileName = `stock_report_${Date.now()}.pdf`;
    const pdfOutput = doc.output('arraybuffer');
    downloadFile(new Uint8Array(pdfOutput), fileName, 'application/pdf')
      .then(() => toast.success('Stock report downloaded'))
      .catch(() => toast.error('Failed to download report'));
  };

  const salesByDay = filteredSales.reduce((acc: any[], t) => {
    if (t.isVoided) return acc;
    const date = new Date(t.timestamp).toLocaleDateString();
    const existing = acc.find(item => item.date === date);
    const amount = (t.type === 'cash-in' || t.type === 'cash-out') ? (t.fee || 0) : t.total;
    if (existing) existing.sales += amount;
    else acc.push({ date, sales: amount });
    return acc;
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const categoryData = [
    ...(settings?.showServices !== false ? services.map(s => ({ name: s.category, type: 'Service' })) : []),
    ...(settings?.showProducts !== false ? products.map(p => ({ name: p.category, type: 'Product' })) : [])
  ].reduce((acc: any[], item) => {
    const existing = acc.find(i => i.name === item.name);
    if (existing) existing.value += 1;
    else acc.push({ name: item.name, value: 1 });
    return acc;
  }, []);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-zinc-100">{t.reports}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.reportsSubtitle}</p>
        </div>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Revenue</div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Profit</div>
          <div className="text-2xl font-black text-green-600">{formatCurrency(totalProfit)}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Expenses</div>
          <div className="text-2xl font-black text-primary">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Customer Debt</div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{formatCurrency(totalCustomerDebt)}</div>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Voided Sales</div>
          <div className="text-2xl font-black text-red-500">{formatCurrency(totalVoidedAmount)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Detailed Reports</h3>
            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Download PDF</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button 
              onClick={generateSalesReport}
              className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t.reports}</span>
              <span className="text-[10px] text-zinc-500 mt-1">{t.reportsSubtitle}</span>
            </button>

            {settings?.showServices !== false && (
              <button 
                onClick={generateStaffReport}
                className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <BarChart3 size={24} />
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t.staffPerformance}</span>
                <span className="text-[10px] text-zinc-500 mt-1">{t.revenueByStaff}</span>
              </button>
            )}

            <button 
              onClick={generateCreditReport}
              className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Wallet size={24} />
              </div>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t.creditReport}</span>
              <span className="text-[10px] text-zinc-500 mt-1">{t.outstandingBalances}</span>
            </button>

            {settings?.showProducts !== false && (
              <button 
                onClick={generateStockReport}
                className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Building2 size={24} />
                </div>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t.stockReport}</span>
                <span className="text-[10px] text-zinc-500 mt-1">{t.inventoryStatus}</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6">Sales Trend</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDay}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="var(--primary-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6">Category Distribution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {categoryData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            Peak Hours
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Bar dataKey="count" name="Transactions" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6">Top Performing Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topItems.map((item: any, index) => (
              <div key={index} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.name}</div>
                    <span className={`px-1 py-0.5 rounded text-[7px] font-black uppercase ${item.type === 'service' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                      {item.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase">{item.quantity} units sold</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-primary">{formatCurrency(item.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {settings?.showProducts !== false && (
          <div className="bg-white dark:bg-zinc-900 p-6 lg:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm lg:col-span-2">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2">
              <AlertCircle size={18} className="text-orange-500" />
              Slow-Moving Items
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {slowMovingItems.map((item, index) => {
                const salesCount = itemSales[`product-${item.id}`]?.quantity || 0;
                return (
                  <div key={index} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-between border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.name}</div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">{salesCount} units sold</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase">Stock: {item.stock}</div>
                    </div>
                  </div>
                );
              })}
              {slowMovingItems.length === 0 && (
                <div className="col-span-full py-10 text-center text-zinc-500 text-sm italic">All items are moving well!</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
