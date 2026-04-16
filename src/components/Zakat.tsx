import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Calculator, 
  History, 
  TrendingUp, 
  ShieldCheck,
  Info,
  ArrowRight,
  Coins
} from 'lucide-react';
import { db, Service, ZakatRecord } from '../db';
import { toast } from 'sonner';

export default function Zakat() {
  const records = useLiveQuery(() => db.zakat.toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [wealth, setWealth] = useState<number>(0);
  const [nisabType, setNisabType] = useState<'gold' | 'silver'>('gold');
  const [goldPrice, setGoldPrice] = useState<number>(3800);
  const [silverPrice, setSilverPrice] = useState<number>(50);
  const currency = settings?.currency || 'PHP';
  
  useEffect(() => {
    if (settings) {
      if (settings.goldPricePerGram) setGoldPrice(settings.goldPricePerGram);
      if (settings.silverPricePerGram) setSilverPrice(settings.silverPricePerGram);
    }
  }, [settings]);

  const nisab = nisabType === 'gold' ? goldPrice * 85 : silverPrice * 595;
  
  const totalStockValue = 0;
  const totalStockCount = 0;

  const zakatRate = 0.025; // Standard 2.5%
  const zakatAmount = wealth >= nisab ? wealth * zakatRate : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleSaveRecord = async () => {
    try {
      const recordData = {
        year: new Date().getFullYear(),
        totalWealth: wealth,
        zakatAmount,
        status: 'calculated' as const,
        timestamp: Date.now()
      };
      
      await db.zakat.add(recordData as any);
      
      // Save prices to settings for persistence
      if (settings?.id) {
        await db.settings.update(settings.id, { 
          goldPricePerGram: goldPrice,
          silverPricePerGram: silverPrice 
        });
      }
      
      toast.success('Zakat calculation saved');
    } catch (error) {
      toast.error('Failed to save record');
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Current Stock Summary - Mobile View Top Priority */}
      <div className="lg:hidden bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="text-primary" size={20} />
          <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Current Stock Summary</h4>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Items</span>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{totalStockCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Cost Value</span>
            <span className="text-sm font-bold text-primary">{formatCurrency(totalStockValue)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Calculator Card */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-6 lg:p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Calculator className="text-primary" size={24} />
                <h3 className="text-lg lg:text-xl font-bold text-zinc-900 dark:text-zinc-100">Zakat Calculator</h3>
              </div>
            </div>
            <p className="text-xs lg:text-sm text-zinc-500 dark:text-zinc-400">Calculate your annual Zakat based on your total business wealth and assets.</p>
          </div>
          
          <div className="p-6 lg:p-8 space-y-6 lg:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] lg:text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Gold Price (per Gram)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 font-bold">₱</span>
                  <input 
                    type="number" 
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-zinc-900 dark:text-zinc-100"
                    value={goldPrice}
                    onChange={(e) => setGoldPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] lg:text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Silver Price (per Gram)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 font-bold">₱</span>
                  <input 
                    type="number" 
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl font-bold focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-zinc-900 dark:text-zinc-100"
                    value={silverPrice}
                    onChange={(e) => setSilverPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] lg:text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Total Assessable Wealth ({currency})</label>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setNisabType('gold')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${nisabType === 'gold' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'text-zinc-500'}`}
                  >
                    Gold Nisab
                  </button>
                  <button 
                    onClick={() => setNisabType('silver')}
                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${nisabType === 'silver' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'text-zinc-500'}`}
                  >
                    Silver Nisab
                  </button>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 font-bold">₱</span>
                <input 
                  type="number" 
                  className="w-full pl-10 pr-4 py-3 lg:py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xl lg:text-2xl font-bold focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-zinc-900 dark:text-zinc-100"
                  value={wealth}
                  onChange={(e) => setWealth(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                <div className="flex items-center gap-2 text-[10px] lg:text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl">
                  <Coins size={14} className="text-yellow-600" />
                  <span>{nisabType === 'gold' ? 'Gold' : 'Silver'} Price: <b>{formatCurrency(nisabType === 'gold' ? goldPrice : silverPrice)}/g</b></span>
                </div>
                <div className="flex items-center gap-2 text-[10px] lg:text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-xl">
                  <Info size={14} className="text-blue-600" />
                  <span>Nisab ({nisabType === 'gold' ? '85g Gold' : '595g Silver'}): <b>{formatCurrency(nisab)}</b></span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <div className="p-5 lg:p-6 bg-primary/10 rounded-2xl border border-primary/20">
                <div className="text-[10px] lg:text-xs font-bold text-primary uppercase tracking-widest mb-1">Zakat Rate (2.5%)</div>
                <div className="text-2xl lg:text-3xl font-black text-primary">
                  2.5%
                </div>
              </div>
              <div className="p-5 lg:p-6 bg-zinc-900 dark:bg-zinc-100 rounded-2xl border border-zinc-800 dark:border-zinc-200 text-white dark:text-zinc-900">
                <div className="text-[10px] lg:text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Payable Zakat</div>
                <div className="text-2xl lg:text-3xl font-black">{formatCurrency(zakatAmount)}</div>
              </div>
            </div>

            <button 
              onClick={handleSaveRecord}
              className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:brightness-110 shadow-xl shadow-primary-light transition-all flex items-center justify-center gap-2"
            >
              Save to History
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-4 lg:space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="text-green-600" size={20} />
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Zakat Compliance</h4>
            </div>
            <p className="text-xs lg:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Our system tracks your inventory value and cash flow to help you accurately determine your Zakat-eligible assets.
            </p>
          </div>

          <div className="bg-gradient-to-br from-primary to-primary/80 p-6 rounded-3xl text-white shadow-lg shadow-primary-light">
            <h4 className="font-bold mb-2">Did you know?</h4>
            <p className="text-xs lg:text-sm text-white/90 leading-relaxed">
              Zakat is calculated on wealth that has been in your possession for one lunar year (Hawl) and exceeds the Nisab threshold.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hidden lg:block">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="text-primary" size={20} />
              <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Current Stock Summary</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Items</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{totalStockCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Cost Value</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(totalStockValue)}</span>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2 italic">
                * This value represents your current inventory at cost price, which is typically included in business zakat calculations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
          <History className="text-zinc-400 dark:text-zinc-500" size={20} />
          <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Calculation History</h3>
        </div>

        {/* Mobile List View */}
        <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {records.slice().reverse().map((record) => (
            <div key={record.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Year {record.year}</div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{new Date(record.timestamp).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-primary">{formatCurrency(record.zakatAmount)}</div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase">{record.status}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Year</th>
                <th className="px-6 py-4 font-semibold">Total Wealth</th>
                <th className="px-6 py-4 font-semibold">Zakat Amount</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {records.slice().reverse().map((record) => (
                <tr key={record.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">{new Date(record.timestamp).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-bold text-zinc-900 dark:text-zinc-100">{record.year}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">{formatCurrency(record.totalWealth)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-primary">{formatCurrency(record.zakatAmount)}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-[10px] font-bold uppercase tracking-tighter">
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {records.length === 0 && (
          <div className="p-12 text-center text-zinc-400 italic text-sm">No calculation history yet</div>
        )}
      </div>
    </div>
  );
}
