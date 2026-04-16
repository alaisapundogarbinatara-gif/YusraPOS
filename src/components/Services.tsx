import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, Search, Edit2, Trash2, Clock, Settings, X as CloseIcon, Check, LayoutGrid, Briefcase, Package, Barcode, QrCode
} from 'lucide-react';
import { db, type Service, type Category } from '../db';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import QRScanner from './QRScanner';

export default function Services() {
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [activeTab, setActiveTab] = useState<'services' | 'categories'>('services');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategoryId) {
        await db.categories.update(editingCategoryId as any, { name: editCategoryName });
        toast.success('Category updated');
        setEditingCategoryId(null);
      } else {
        await db.categories.add({ name: newCategoryName, createdAt: Date.now() });
        toast.success('Category added');
        setNewCategoryName('');
        setIsAddingCategory(false);
      }
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  const deleteCategory = async (id: number | string) => {
    if (confirm('Delete this category? Services in this category will remain but their category label might be orphaned.')) {
      try {
        await db.categories.delete(id as any);
        toast.success('Category deleted');
      } catch (error) {
        toast.error('Failed to delete category');
      }
    }
  };

  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
  
  const DEFAULT_SERVICE: Partial<Service> = {
    name: '', sku: '', price: 0, cost: 0, duration: 30, category: 'General', image: '', isFlexiblePrice: false
  };

  const [newService, setNewService] = useState<Partial<Service>>(DEFAULT_SERVICE);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 512 * 1024) { // 512KB limit for service thumbnails
        toast.error('Image is too large. Please select an image under 512KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewService(prev => ({ ...prev, image: reader.result as string }));
        toast.success('Image uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.barcode && s.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const serviceData = { ...newService as Service, updatedAt: Date.now() };
      if (editingService) {
        await db.services.update(editingService.id!, serviceData);
        toast.success('Service updated');
      } else {
        await db.services.add({ ...serviceData, createdAt: Date.now() });
        toast.success('Service added');
      }
      setIsAddingService(false);
      setEditingService(null);
      setNewService(DEFAULT_SERVICE);
    } catch (error) {
      toast.error('Failed to save service');
    }
  };

  const deleteService = async (id: number | string) => {
    if (confirm('Delete this service?')) {
      try {
        if (typeof id === 'number') await db.services.delete(id);
        toast.success('Service deleted');
      } catch (error) {
        toast.error('Failed to delete service');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('services')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'services' ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm' : 'text-zinc-500'}`}>Services</button>
        <button onClick={() => setActiveTab('categories')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'categories' ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm' : 'text-zinc-500'}`}>Categories</button>
      </div>

      {activeTab === 'services' ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input type="text" placeholder="Search services..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => setIsAddingService(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold shadow-lg shadow-primary-light"><Plus size={18} /> Add Service</button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
            <table className="w-full text-left hidden lg:table">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4">Barcode</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredServices.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {s.image ? <img src={s.image} className="w-full h-full object-cover" /> : <Briefcase size={20} className="text-zinc-400" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{s.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{s.sku}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                      {s.barcode || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400"><Clock size={14} className="inline mr-1" /> {s.duration} min</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold uppercase">{s.category}</span></td>
                    <td className="px-6 py-4 text-sm font-bold">{formatCurrency(s.price)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { 
                          setEditingService(s); 
                          setNewService({ ...DEFAULT_SERVICE, ...s }); 
                          setIsAddingService(true); 
                        }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => deleteService(s.id!)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredServices.map(s => (
                <div key={s.id} className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                    {s.image ? <img src={s.image} className="w-full h-full object-cover" /> : <Briefcase size={20} className="text-zinc-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{s.name}</div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                      <Clock size={12} /> {s.duration}m | <span className="text-primary font-bold">{formatCurrency(s.price)}</span>
                      {s.barcode && <span> | {s.barcode}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { 
                      setEditingService(s); 
                      setNewService({ ...DEFAULT_SERVICE, ...s }); 
                      setIsAddingService(true); 
                    }} className="p-2 text-zinc-400 hover:text-primary transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => deleteService(s.id!)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Categories</h3>
            <button onClick={() => setIsAddingCategory(true)} className="px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary-light"><Plus size={18} className="inline mr-1" /> Add Category</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="font-bold">{cat.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingCategoryId(cat.id!); setEditCategoryName(cat.name); }} className="p-2 text-zinc-400 hover:text-primary"><Edit2 size={16} /></button>
                  <button onClick={() => deleteCategory(cat.id!)} className="p-2 text-zinc-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {(isAddingCategory || editingCategoryId) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-200 dark:border-zinc-800">
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{editingCategoryId ? 'Edit Category' : 'Add Category'}</h3>
                    <button onClick={() => { setIsAddingCategory(false); setEditingCategoryId(null); }} className="p-2 text-zinc-500"><CloseIcon size={20} /></button>
                  </div>
                  <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Category Name</label>
                      <input 
                        required 
                        placeholder="e.g. Haircut, Spa, etc." 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-primary/20" 
                        value={editingCategoryId ? editCategoryName : newCategoryName} 
                        onChange={e => editingCategoryId ? setEditCategoryName(e.target.value) : setNewCategoryName(e.target.value)} 
                        autoFocus
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light">
                      {editingCategoryId ? 'Update Category' : 'Save Category'}
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {isAddingService && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold">{editingService ? 'Edit Service' : 'Add Service'}</h3>
                <button onClick={() => { setIsAddingService(false); setEditingService(null); }} className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                  <CloseIcon size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveService} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Service Image</label>
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {newService.image ? (
                        <img src={newService.image} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <Briefcase className="text-zinc-300" size={24} />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input 
                          placeholder="Image URL" 
                          className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none text-xs" 
                          value={newService.image || ''} 
                          onChange={e => setNewService({...newService, image: e.target.value})} 
                        />
                        <label className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer">
                          <Plus size={20} />
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <input required placeholder="Service Name" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                <input required placeholder="SKU" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newService.sku} onChange={e => setNewService({...newService, sku: e.target.value})} />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Barcode (Optional)</label>
                  <div className="flex gap-2">
                    <input 
                      placeholder="Scan or type barcode" 
                      className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newService.barcode || ''} 
                      onChange={e => setNewService({...newService, barcode: e.target.value})} 
                    />
                    <button 
                      type="button"
                      onClick={() => setIsScanningBarcode(true)}
                      className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      title="Scan Barcode"
                    >
                      <Barcode size={20} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Price</label>
                    <input required type="number" placeholder="Price" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newService.price} onChange={e => setNewService({...newService, price: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Time (min)</label>
                    <input required type="number" placeholder="Time" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newService.duration} onChange={e => setNewService({...newService, duration: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Category</label>
                  <input 
                    list="service-categories"
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                    value={newService.category} 
                    onChange={e => setNewService({...newService, category: e.target.value})}
                    placeholder="Select or type category"
                  />
                  <datalist id="service-categories">
                    {categories.map(cat => <option key={cat.id} value={cat.name} />)}
                  </datalist>
                </div>
                <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <input 
                    type="checkbox" 
                    id="isFlexibleServicePrice"
                    className="w-4 h-4 accent-primary" 
                    checked={newService.isFlexiblePrice} 
                    onChange={e => setNewService({...newService, isFlexiblePrice: e.target.checked})} 
                  />
                  <label htmlFor="isFlexibleServicePrice" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    Flexible Pricing (Allow price override at Sales)
                  </label>
                </div>
                <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light">Save Service</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isScanningBarcode && (
        <QRScanner 
          onScan={(code) => {
            setNewService(prev => ({ ...prev, barcode: code }));
            setIsScanningBarcode(false);
          }}
          onClose={() => setIsScanningBarcode(false)}
        />
      )}
    </div>
  );
}
