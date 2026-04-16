import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, Search, Edit2, Trash2, Package, X as CloseIcon, LayoutGrid, Barcode, QrCode, Calendar, Truck
} from 'lucide-react';
import { db, type Product, type Category, type Supplier } from '../db';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import QRScanner from './QRScanner';

export default function Products() {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'suppliers'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockAmount, setStockAmount] = useState<string>('');

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ name: '', contactPerson: '', phone: '', email: '', address: '' });

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await db.suppliers.update(editingSupplier.id!, newSupplier);
        toast.success('Supplier updated');
      } else {
        await db.suppliers.add({ ...newSupplier, createdAt: Date.now() } as any);
        toast.success('Supplier added');
      }
      setIsAddingSupplier(false);
      setEditingSupplier(null);
      setNewSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    } catch (error) {
      toast.error('Failed to save supplier');
    }
  };

  const deleteSupplier = async (id: number | string) => {
    if (confirm('Delete this supplier?')) {
      try {
        await db.suppliers.delete(id as any);
        toast.success('Supplier deleted');
      } catch (error) {
        toast.error('Failed to delete supplier');
      }
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategoryId) {
        await db.categories.update(editingCategoryId as any, { name: editCategoryName });
        toast.success('Category updated');
        setEditingCategoryId(null);
      } else {
        await db.categories.add({ name: newCategoryName, createdAt: Date.now() } as any);
        toast.success('Category added');
        setNewCategoryName('');
        setIsAddingCategory(false);
      }
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  const deleteCategory = async (id: number | string) => {
    if (confirm('Delete this category? Products in this category will remain but their category label might be orphaned.')) {
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
  
  const DEFAULT_PRODUCT: Partial<Product> = {
    name: '', sku: '', price: 0, cost: 0, stock: 0, category: 'General', image: '', isFlexiblePrice: false, expiryDate: undefined, supplierId: undefined
  };

  const getExpiryStatus = (expiryDate?: number) => {
    if (!expiryDate) return null;
    const now = Date.now();
    const diff = expiryDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { label: 'Expired', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' };
    if (days <= 30) return { label: `Expires in ${days}d`, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' };
    return null;
  };

  const [newProduct, setNewProduct] = useState<Partial<Product>>(DEFAULT_PRODUCT);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 512 * 1024) { // 512KB limit for product thumbnails
        toast.error('Image is too large. Please select an image under 512KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
        toast.success('Image uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = { ...newProduct as Product, updatedAt: Date.now() };
      
      if (editingProduct) {
        await db.products.update(editingProduct.id!, productData);
        toast.success('Product updated');
      } else {
        await db.products.add({ ...productData, createdAt: Date.now() } as any);
        toast.success('Product added');
      }
      setIsAddingProduct(false);
      setEditingProduct(null);
      setNewProduct(DEFAULT_PRODUCT);
    } catch (error) {
      toast.error('Failed to save product');
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct || !stockAmount) return;
    
    const amount = parseInt(stockAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      const newStock = Math.max(0, stockProduct.stock + amount);
      await db.products.update(stockProduct.id!, { 
        stock: newStock,
        updatedAt: Date.now()
      });
      toast.success(`Stock updated for ${stockProduct.name}`);
      setIsAddingStock(false);
      setStockProduct(null);
      setStockAmount('');
    } catch (error) {
      toast.error('Failed to update stock');
    }
  };

  const deleteProduct = async (id: string | number) => {
    if (confirm('Delete this product?')) {
      try {
        if (typeof id === 'number') await db.products.delete(id);
        toast.success('Product deleted');
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('products')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'products' ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm' : 'text-zinc-500'}`}>Products</button>
        <button onClick={() => setActiveTab('categories')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'categories' ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm' : 'text-zinc-500'}`}>Categories</button>
        <button onClick={() => setActiveTab('suppliers')} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'suppliers' ? 'bg-white dark:bg-zinc-900 text-primary shadow-sm' : 'text-zinc-500'}`}>Suppliers</button>
      </div>

      {activeTab === 'products' ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input type="text" placeholder="Search products..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => setIsAddingProduct(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold shadow-lg shadow-primary-light"><Plus size={18} /> Add Product</button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-x-auto">
            <table className="w-full text-left hidden lg:table">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Barcode</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Supplier</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package size={20} className="text-zinc-400" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2">
                          {p.name}
                          {getExpiryStatus(p.expiryDate) && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${getExpiryStatus(p.expiryDate)?.color}`}>
                              {getExpiryStatus(p.expiryDate)?.label}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">{p.sku}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                      {p.barcode || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      <span className={p.stock < 10 ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-400'}>{p.stock}</span>
                    </td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-bold uppercase">{p.category}</span></td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {suppliers.find(s => s.id === p.supplierId)?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">{formatCurrency(p.price)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setStockProduct(p);
                            setStockAmount('');
                            setIsAddingStock(true);
                          }}
                          className="p-2 hover:bg-primary/10 text-primary rounded-lg"
                          title="Add Stock"
                        >
                          <Plus size={16} />
                        </button>
                        <button onClick={() => { 
                          setEditingProduct(p); 
                          setNewProduct({ ...DEFAULT_PRODUCT, ...p }); 
                          setIsAddingProduct(true); 
                        }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => deleteProduct(p.id!)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredProducts.map(p => (
                <div key={p.id} className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden">
                    {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package size={20} className="text-zinc-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate flex items-center gap-2">
                      {p.name}
                      {getExpiryStatus(p.expiryDate) && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${getExpiryStatus(p.expiryDate)?.color}`}>
                          {getExpiryStatus(p.expiryDate)?.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                      <span className={p.stock < 10 ? 'text-red-500 font-bold' : ''}>Stock: {p.stock}</span> | <span className="text-primary font-bold">{formatCurrency(p.price)}</span>
                      {p.barcode && <span> | {p.barcode}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setStockProduct(p);
                        setStockAmount('');
                        setIsAddingStock(true);
                      }}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                    <button onClick={() => { 
                      setEditingProduct(p); 
                      setNewProduct({ ...DEFAULT_PRODUCT, ...p }); 
                      setIsAddingProduct(true); 
                    }} className="p-2 text-zinc-400 hover:text-primary transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => deleteProduct(p.id!)} className="p-2 text-zinc-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : activeTab === 'categories' ? (
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
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold">{editingCategoryId ? 'Edit Category' : 'Add Category'}</h3>
                <button onClick={() => { setIsAddingCategory(false); setEditingCategoryId(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <CloseIcon size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveCategory} className="p-6 space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Category Name</label>
                  <input 
                    required 
                    placeholder="e.g. Drinks, Snacks, etc." 
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
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Suppliers</h3>
            <button onClick={() => setIsAddingSupplier(true)} className="px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary-light"><Plus size={18} className="inline mr-1" /> Add Supplier</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(sup => (
              <div key={sup.id} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-xl">
                      <Truck size={20} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingSupplier(sup); setNewSupplier(sup); setIsAddingSupplier(true); }} className="p-2 text-zinc-400 hover:text-primary"><Edit2 size={16} /></button>
                      <button onClick={() => deleteSupplier(sup.id!)} className="p-2 text-zinc-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{sup.name}</h4>
                  <div className="mt-2 space-y-1">
                    {sup.contactPerson && <div className="text-xs text-zinc-500 flex items-center gap-2"><span className="font-bold uppercase text-[8px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Contact</span> {sup.contactPerson}</div>}
                    {sup.phone && <div className="text-xs text-zinc-500 flex items-center gap-2"><span className="font-bold uppercase text-[8px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Phone</span> {sup.phone}</div>}
                    {sup.email && <div className="text-xs text-zinc-500 flex items-center gap-2"><span className="font-bold uppercase text-[8px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">Email</span> {sup.email}</div>}
                  </div>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && (
              <div className="col-span-full py-20 text-center space-y-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                <Truck size={48} className="mx-auto text-zinc-300" />
                <p className="text-zinc-500 font-medium">No suppliers added yet. Track where you buy your products.</p>
              </div>
            )}
          </div>

          <AnimatePresence>
            {isAddingSupplier && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
                <button onClick={() => { setIsAddingSupplier(false); setEditingSupplier(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <CloseIcon size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveSupplier} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Supplier Name</label>
                  <input required className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Contact Person</label>
                  <input className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newSupplier.contactPerson} onChange={e => setNewSupplier({...newSupplier, contactPerson: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Phone</label>
                    <input className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Email</label>
                    <input type="email" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Address</label>
                  <textarea className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none min-h-[80px]" value={newSupplier.address} onChange={e => setNewSupplier({...newSupplier, address: e.target.value})} />
                </div>
                <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light">Save Supplier</button>
              </form>
            </motion.div>
          </div>
            )}
          </AnimatePresence>
        </div>
      )
}

      <AnimatePresence>
        {isAddingProduct && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
                <button onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <CloseIcon size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveProduct} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Product Image</label>
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {newProduct.image ? (
                        <img src={newProduct.image} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <Package className="text-zinc-300" size={24} />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input 
                          placeholder="Image URL" 
                          className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none text-xs" 
                          value={newProduct.image || ''} 
                          onChange={e => setNewProduct({...newProduct, image: e.target.value})} 
                        />
                        <label className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer">
                          <Plus size={20} />
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Product Name</label>
                  <input required placeholder="Product Name" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">SKU</label>
                  <input required placeholder="SKU" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Barcode (Optional)</label>
                  <div className="flex gap-2">
                    <input 
                      placeholder="Scan or type barcode" 
                      className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newProduct.barcode || ''} 
                      onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} 
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Price</label>
                    <input required type="number" placeholder="Price" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Stock</label>
                    <input required type="number" placeholder="Stock" className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Category</label>
                  <input 
                    list="product-categories"
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                    value={newProduct.category} 
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    placeholder="Select or type category"
                  />
                  <datalist id="product-categories">
                    {categories.map(cat => <option key={cat.id} value={cat.name} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Supplier</label>
                  <select 
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                    value={newProduct.supplierId || ''} 
                    onChange={e => setNewProduct({...newProduct, supplierId: e.target.value || undefined})}
                  >
                    <option value="">No Supplier</option>
                    {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Expiry Date (Optional)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input 
                      type="date" 
                      className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newProduct.expiryDate ? new Date(newProduct.expiryDate).toISOString().split('T')[0] : ''} 
                      onChange={e => setNewProduct({...newProduct, expiryDate: e.target.value ? new Date(e.target.value).getTime() : undefined})} 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <input 
                    type="checkbox" 
                    id="isFlexiblePrice"
                    className="w-4 h-4 accent-primary" 
                    checked={newProduct.isFlexiblePrice} 
                    onChange={e => setNewProduct({...newProduct, isFlexiblePrice: e.target.checked})} 
                  />
                  <label htmlFor="isFlexiblePrice" className="text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    Flexible Pricing (Allow price override at Sales)
                  </label>
                </div>
                <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light mt-4">Save Product</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isScanningBarcode && (
        <QRScanner 
          onScan={(code) => {
            setNewProduct(prev => ({ ...prev, barcode: code }));
            setIsScanningBarcode(false);
          }}
          onClose={() => setIsScanningBarcode(false)}
        />
      )}

      <AnimatePresence>
        {isAddingStock && stockProduct && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold">Update Stock</h3>
                  <p className="text-xs text-zinc-500 truncate max-w-[200px]">{stockProduct.name}</p>
                </div>
                <button onClick={() => { setIsAddingStock(false); setStockProduct(null); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500">
                  <CloseIcon size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateStock} className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
                <div className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="text-center flex-1">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">Current</div>
                    <div className="text-xl font-black">{stockProduct.stock}</div>
                  </div>
                  <div className="px-4 text-zinc-300">
                    <Plus size={20} />
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">New Total</div>
                    <div className="text-xl font-black text-primary">
                      {stockProduct.stock + (parseInt(stockAmount) || 0)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Amount to Add/Subtract</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="e.g. 10 or -5" 
                    className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-center text-2xl font-black outline-none focus:ring-2 focus:ring-primary" 
                    value={stockAmount} 
                    onChange={e => setStockAmount(e.target.value)} 
                    autoFocus
                  />
                  <p className="text-[10px] text-center text-zinc-500">Use negative numbers to reduce stock</p>
                </div>

                <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary-light hover:brightness-110 transition-all">
                  Update Stock Level
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
