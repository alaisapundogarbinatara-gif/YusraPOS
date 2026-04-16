import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  X as CloseIcon, 
  Check, 
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  UserPlus,
  Edit2,
  Package,
  Printer,
  Download,
  Share2
} from 'lucide-react';
import { db, type Appointment, type Service, type Staff, type User as UserType, type Sale } from '../db';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function Schedules({ currentUser }: { currentUser: UserType }) {
  const appointments = useLiveQuery(() => db.appointments.toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  
  const currency = settings?.currency || 'PHP';
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const [isAddingAppointment, setIsAddingAppointment] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);
  const [isAddingNewService, setIsAddingNewService] = useState(false);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '' });
  const [newServiceData, setNewServiceData] = useState({ name: '', price: 0, duration: 30, category: 'Other' });
  const [newProductData, setNewProductData] = useState({ name: '', price: 0, stock: 0, category: 'General' });
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const DEFAULT_APPOINTMENT: Partial<Appointment> = {
    customerId: undefined,
    customerName: '',
    customerPhone: '',
    items: [],
    staffIds: [],
    startTime: Date.now(),
    dueDate: Date.now() + (24 * 60 * 60 * 1000),
    status: 'pending',
    serviceStatus: 'no-progress',
    paymentStatus: 'unpaid',
    paymentMethod: 'cash',
    downPayment: 0,
    paidAmount: 0,
    subtotal: 0,
    discountAmount: 0,
    discountPercentage: 0,
    totalAmount: 0,
    notes: '',
    description: ''
  };

  const [newAppointment, setNewAppointment] = useState<Partial<Appointment>>(DEFAULT_APPOINTMENT);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<Appointment | null>(null);

  const calculateAppointmentTotals = (items: any[], discountPercent: number = 0, discountAmt: number = 0) => {
    const subtotal = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    let total = subtotal;
    
    if (discountPercent > 0) {
      total = subtotal * (1 - discountPercent / 100);
    } else if (discountAmt > 0) {
      total = Math.max(0, subtotal - discountAmt);
    }
    
    return { subtotal, totalAmount: total };
  };

  const addItemToAppointment = (item: any, type: 'service' | 'product') => {
    const currentItems = [...(newAppointment.items || [])];
    const existingItemIndex = currentItems.findIndex(i => 
      (type === 'service' && i.serviceId === item.id) || 
      (type === 'product' && i.productId === item.id)
    );

    if (existingItemIndex > -1) {
      currentItems[existingItemIndex].quantity += 1;
    } else {
      currentItems.push({
        serviceId: type === 'service' ? item.id : undefined,
        productId: type === 'product' ? item.id : undefined,
        name: item.name,
        price: item.price,
        quantity: 1,
        duration: type === 'service' ? item.duration : 0,
        type,
        staffIds: [],
        isFlexiblePrice: item.isFlexiblePrice
      });
    }

    const { subtotal, totalAmount } = calculateAppointmentTotals(
      currentItems, 
      newAppointment.discountPercentage, 
      newAppointment.discountAmount
    );
    setNewAppointment({ ...newAppointment, items: currentItems, subtotal, totalAmount });
  };

  const removeItemFromAppointment = (index: number) => {
    const currentItems = [...(newAppointment.items || [])];
    currentItems.splice(index, 1);
    const { subtotal, totalAmount } = calculateAppointmentTotals(
      currentItems, 
      newAppointment.discountPercentage, 
      newAppointment.discountAmount
    );
    setNewAppointment({ ...newAppointment, items: currentItems, subtotal, totalAmount });
  };

  const updateItemQuantity = (index: number, delta: number) => {
    const currentItems = [...(newAppointment.items || [])];
    const newQty = Math.max(1, currentItems[index].quantity + delta);
    currentItems[index].quantity = newQty;
    const { subtotal, totalAmount } = calculateAppointmentTotals(
      currentItems, 
      newAppointment.discountPercentage, 
      newAppointment.discountAmount
    );
    setNewAppointment({ ...newAppointment, items: currentItems, subtotal, totalAmount });
  };

  const handleManualItemQuantity = (index: number, value: string) => {
    const qty = parseInt(value);
    if (isNaN(qty) || qty < 1) return;
    
    const currentItems = [...(newAppointment.items || [])];
    currentItems[index].quantity = qty;
    const { subtotal, totalAmount } = calculateAppointmentTotals(
      currentItems, 
      newAppointment.discountPercentage, 
      newAppointment.discountAmount
    );
    setNewAppointment({ ...newAppointment, items: currentItems, subtotal, totalAmount });
  };

  const handleManualItemPrice = (index: number, value: string) => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) return;
    
    const currentItems = [...(newAppointment.items || [])];
    currentItems[index].price = price;
    const { subtotal, totalAmount } = calculateAppointmentTotals(
      currentItems, 
      newAppointment.discountPercentage, 
      newAppointment.discountAmount
    );
    setNewAppointment({ ...newAppointment, items: currentItems, subtotal, totalAmount });
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerData.name) return;
    try {
      const customerData = {
        name: newCustomerData.name,
        phone: newCustomerData.phone,
        loyaltyPoints: 0,
        creditBalance: 0,
        createdAt: Date.now()
      };
      const id = await db.customers.add(customerData as any);
      
      setNewAppointment(prev => ({
        ...prev,
        customerId: id,
        customerName: customerData.name,
        customerPhone: customerData.phone || ''
      }));
      setIsAddingNewCustomer(false);
      setNewCustomerData({ name: '', phone: '' });
      toast.success('Customer added and selected');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add customer');
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceData.name || !newServiceData.price) return;
    try {
      const serviceData: Service = {
        name: newServiceData.name,
        sku: `SVC-${Date.now()}`,
        price: newServiceData.price,
        cost: 0,
        duration: newServiceData.duration,
        category: newServiceData.category,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const id = await db.services.add(serviceData);
      
      setNewAppointment({
        ...newAppointment,
        serviceId: id as any
      });
      setIsAddingNewService(false);
      setNewServiceData({ name: '', price: 0, duration: 30, category: 'Other' });
      toast.success('Service added and selected');
    } catch (error) {
      toast.error('Failed to add service');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductData.name || !newProductData.price) return;
    try {
      const productData: any = {
        name: newProductData.name,
        sku: `PRD-${Date.now()}`,
        price: newProductData.price,
        cost: 0,
        stock: newProductData.stock,
        category: newProductData.category,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const id = await db.products.add(productData);
      
      addItemToAppointment({ ...productData, id }, 'product');
      setIsAddingNewProduct(false);
      setNewProductData({ name: '', price: 0, stock: 0, category: 'General' });
      toast.success('Product added and selected');
    } catch (error) {
      toast.error('Failed to add product');
    }
  };

  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = app.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? (app.status !== 'cancelled' && app.status !== 'claimed') : app.status === statusFilter;
    
    // Filter out completed and fully paid services if in 'all' view
    const isCompletedAndPaid = app.status === 'completed' && app.paymentStatus === 'paid';
    if (isCompletedAndPaid && statusFilter === 'all') return false;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => a.startTime - b.startTime);

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppointment.items?.length || !newAppointment.staffIds?.length) {
      toast.error('Please select at least one item and one staff member');
      return;
    }

    const totalDuration = newAppointment.items.reduce((acc, i) => acc + ((i.duration || 0) * i.quantity), 0);
    const endTime = newAppointment.startTime! + (totalDuration * 60000);
    const totalAmount = newAppointment.totalAmount || 0;

    try {
      const appointmentData: any = {
        ...newAppointment,
        endTime,
        totalAmount,
        updatedAt: Date.now()
      };

      if (!editingAppointment) {
        appointmentData.createdAt = Date.now();
        const appointmentId = await db.appointments.add(appointmentData);

        const finalAppointment = { ...appointmentData, id: appointmentId };
        setReceiptData(finalAppointment);
        setShowReceipt(true);

        // Record initial payment as a transaction
        if (newAppointment.paidAmount && newAppointment.paidAmount > 0) {
          const sale: Sale = {
            items: newAppointment.items.map(i => ({
              ...i,
              serviceId: typeof i.serviceId === 'number' ? i.serviceId : undefined,
              productId: typeof i.productId === 'number' ? i.productId : undefined,
            })) as any,
            subtotal: newAppointment.subtotal || newAppointment.paidAmount,
            discountAmount: newAppointment.discountAmount || 0,
            discountPercentage: newAppointment.discountPercentage || 0,
            total: newAppointment.paidAmount,
            paymentMethod: newAppointment.paymentMethod || 'cash',
            type: 'sale',
            customerId: newAppointment.customerId,
            appointmentId: appointmentId,
            timestamp: Date.now(),
            processedBy: currentUser.name,
            notes: newAppointment.notes,
            paidAmount: newAppointment.paidAmount,
            remainingBalance: 0
          };
          await db.sales.add(sale);
        }
        toast.success('Appointment scheduled');
      } else {
        const appointmentId = editingAppointment.id!;
        await db.appointments.update(appointmentId, appointmentData);

        // If paidAmount increased, record the difference as a new transaction
        const oldPaidAmount = editingAppointment.paidAmount || 0;
        const newPaidAmount = newAppointment.paidAmount || 0;
        if (newPaidAmount > oldPaidAmount) {
          const difference = newPaidAmount - oldPaidAmount;
          const sale: Sale = {
            items: [{
              name: `Payment for Appointment #${appointmentId}`,
              price: difference,
              quantity: 1,
              type: 'service'
            }],
            subtotal: difference,
            discountAmount: 0,
            discountPercentage: 0,
            total: difference,
            paymentMethod: newAppointment.paymentMethod || 'cash',
            type: 'sale',
            customerId: newAppointment.customerId,
            appointmentId: appointmentId,
            timestamp: Date.now(),
            processedBy: currentUser.name,
            notes: `Additional payment for appointment. ${newAppointment.notes || ''}`,
            paidAmount: difference,
            remainingBalance: 0
          };
          await db.sales.add(sale);
        }
        toast.success('Appointment updated');
      }

      setIsAddingAppointment(false);
      setEditingAppointment(null);
      setNewAppointment(DEFAULT_APPOINTMENT);
    } catch (error) {
      console.error(error);
      toast.error('Failed to schedule appointment');
    }
  };

  const updateStatus = async (id: number | string, status: Appointment['status']) => {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) return;

    // Don't do anything if status is the same
    if (appointment.status === status) return;

    const updateData: Partial<Appointment> = { status };
    if (status === 'in-progress') {
      updateData.serviceStatus = 'in-progress';
    } else if (status === 'completed') {
      updateData.serviceStatus = 'completed';
    }

    try {
      // Handle Inventory Deduction
      if ((status === 'completed' || status === 'claimed') && !appointment.inventoryDeducted) {
        if (appointment.items && appointment.items.length > 0) {
          for (const item of appointment.items) {
            if (item.type === 'product' && item.productId) {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                const newStock = Math.max(0, (product.stock || 0) - item.quantity);
                await db.products.update(product.id, { stock: newStock });
              }
            }
          }
          updateData.inventoryDeducted = true;
        }
      } else if (status !== 'completed' && status !== 'claimed' && appointment.inventoryDeducted) {
        // Revert inventory if moved back from completed/claimed
        if (appointment.items && appointment.items.length > 0) {
          for (const item of appointment.items) {
            if (item.type === 'product' && item.productId) {
              const product = products.find(p => p.id === item.productId);
              if (product) {
                const newStock = (product.stock || 0) + item.quantity;
                await db.products.update(product.id, { stock: newStock });
              }
            }
          }
          updateData.inventoryDeducted = false;
        }
      }

      await db.appointments.update(id, updateData);
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status');
    }
  };

  const cancelAppointment = async (id: number | string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancel Appointment',
      message: 'Are you sure you want to cancel this appointment?',
      onConfirm: () => {
        updateStatus(id, 'cancelled');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-600';
      case 'in-progress': return 'bg-orange-100 text-orange-600';
      case 'completed': return 'bg-blue-100 text-blue-600';
      case 'claimed': return 'bg-purple-100 text-purple-600';
      case 'cancelled': return 'bg-red-100 text-red-600';
      default: return 'bg-zinc-100 text-zinc-600';
    }
  };

  const isNearlyDue = (app: Appointment) => {
    if (!app.dueDate) return false;
    const now = Date.now();
    const diff = app.dueDate - now;
    return diff > 0 && diff < (4 * 60 * 60 * 1000) && app.serviceStatus === 'no-progress'; // 4 hours
  };

  React.useEffect(() => {
    const nearlyDueApps = appointments.filter(isNearlyDue);
    if (nearlyDueApps.length > 0) {
      nearlyDueApps.forEach(app => {
        toast.warning(`Service for ${app.customerName} is nearly due with no progress!`, {
          duration: 10000,
          id: `nearly-due-${app.id}`
        });
      });
    }
  }, [appointments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Service Schedules</h2>
          <p className="text-sm text-zinc-500">Manage appointments and staff assignments.</p>
        </div>
        <button 
          onClick={() => {
            const now = new Date();
            // Round to nearest 30 mins for convenience
            now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30);
            now.setSeconds(0);
            now.setMilliseconds(0);
            
            const startTime = now.getTime();
            const dueDate = startTime + (24 * 60 * 60 * 1000);

            setNewAppointment(prev => ({
              ...prev,
              startTime,
              dueDate
            }));
            setIsAddingAppointment(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold shadow-lg shadow-primary-light"
        >
          <Plus size={18} />
          New Appointment
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search customer..." 
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'pending', 'confirmed', 'in-progress', 'completed', 'claimed', 'cancelled'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                statusFilter === status 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {filteredAppointments.map((app) => {
          const nearlyDue = isNearlyDue(app);
          return (
            <div key={app.id} className={`bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all group relative ${nearlyDue ? 'border-red-500 ring-2 ring-red-500/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
              {nearlyDue && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] sm:text-[10px] font-black px-2 sm:px-3 py-1 rounded-full shadow-lg animate-bounce">
                  NEARLY DUE
                </div>
              )}
              <div className="flex justify-between items-start mb-3 sm:mb-4">
                <div className="flex flex-col gap-1">
                  <div className={`px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase w-fit ${getStatusColor(app.status)}`}>
                    {app.status}
                  </div>
                  <div className={`px-1.5 py-0.5 rounded-lg text-[7px] sm:text-[8px] font-bold uppercase w-fit ${
                    app.paymentStatus === 'paid' ? 'bg-green-100 text-green-600' : 
                    app.paymentStatus === 'partial' ? 'bg-orange-100 text-orange-600' : 
                    'bg-red-100 text-red-600'
                  }`}>
                    {app.paymentStatus}
                  </div>
                </div>
                <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  {app.status === 'pending' && (
                    <button onClick={() => updateStatus(app.id!, 'confirmed')} className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded-lg">
                      <Check size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {app.status === 'confirmed' && (
                    <button onClick={() => updateStatus(app.id!, 'in-progress')} className="p-1.5 sm:p-2 text-orange-600 hover:bg-orange-50 rounded-lg">
                      <Clock size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {app.status === 'in-progress' && (
                    <button onClick={() => updateStatus(app.id!, 'completed')} className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Mark as Completed">
                      <Check size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  )}
                  {app.status === 'completed' && (
                    <button 
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Mark as Claimed',
                          message: 'Mark this as claimed? It will be removed from the active list.',
                          onConfirm: () => {
                            updateStatus(app.id!, 'claimed');
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }} 
                      className="p-1.5 sm:p-2 text-purple-600 hover:bg-purple-50 rounded-lg" 
                      title="Mark as Claimed"
                    >
                      <Package size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  )}
                  <button onClick={() => {
                    setEditingAppointment(app);
                    setNewAppointment({
                      ...DEFAULT_APPOINTMENT,
                      ...app
                    });
                    setIsAddingAppointment(true);
                  }} className="p-1.5 sm:p-2 text-zinc-400 hover:text-primary rounded-lg" title="Edit Appointment">
                    <Edit2 size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <button onClick={() => cancelAppointment(app.id!)} className="p-1.5 sm:p-2 text-zinc-400 hover:text-red-600 rounded-lg" title="Cancel Appointment">
                    <Trash2 size={14} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">{app.customerName}</h3>
                  <p className="text-[10px] sm:text-xs text-zinc-500">{app.customerPhone}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-[10px] sm:text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CalendarIcon size={12} className="text-red-500 sm:w-3.5 sm:h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold">Due:</div>
                      <div className="text-[8px] sm:text-[10px] truncate">{app.dueDate ? new Date(app.dueDate).toLocaleDateString() : 'Not set'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] sm:text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CalendarIcon size={12} className="sm:w-3.5 sm:h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold">{new Date(app.startTime).toLocaleDateString()}</div>
                      <div className="text-[8px] sm:text-[10px]">{new Date(app.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[10px] sm:text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">Items:</div>
                    <div className="text-[8px] sm:text-[10px] space-y-0.5">
                      {app.items?.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="flex justify-between gap-2">
                          <span className="truncate">{item.quantity}x {item.name}</span>
                          <span className="text-zinc-400 flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                      {app.items && app.items.length > 2 && (
                        <div className="text-primary font-bold">+{app.items.length - 2} more items</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 sm:pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase">Paid</div>
                    <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(app.paidAmount || 0)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase">Balance</div>
                    <div className="text-xs sm:text-sm font-bold text-primary">{formatCurrency(app.totalAmount - (app.paidAmount || 0))}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isAddingAppointment && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold">
                  {isAddingNewCustomer ? 'New Customer' : isAddingNewService ? 'New Service' : isAddingNewProduct ? 'New Product' : editingAppointment ? 'Edit Appointment' : 'New Appointment'}
                </h3>
                <button 
                  onClick={() => {
                    setIsAddingAppointment(false);
                    setIsAddingNewCustomer(false);
                    setIsAddingNewService(false);
                  }} 
                  className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                >
                  <CloseIcon size={20} />
                </button>
              </div>
              {isAddingNewCustomer ? (
                <form onSubmit={handleAddCustomer} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Full Name</label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newCustomerData.name} 
                      onChange={e => setNewCustomerData({...newCustomerData, name: e.target.value})}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Phone Number</label>
                    <input 
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newCustomerData.phone} 
                      onChange={e => setNewCustomerData({...newCustomerData, phone: e.target.value})}
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
              ) : isAddingNewService ? (
                <form onSubmit={handleAddService} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Service Name</label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newServiceData.name} 
                      onChange={e => setNewServiceData({...newServiceData, name: e.target.value})}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Price</label>
                      <input 
                        required
                        type="number"
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newServiceData.price} 
                        onChange={e => setNewServiceData({...newServiceData, price: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Duration (min)</label>
                      <input 
                        required
                        type="number"
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newServiceData.duration} 
                        onChange={e => setNewServiceData({...newServiceData, duration: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light"
                    >
                      Add Service
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsAddingNewService(false)}
                      className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-xl"
                    >
                      Back
                    </button>
                  </div>
                </form>
              ) : isAddingNewProduct ? (
                <form onSubmit={handleAddProduct} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Product Name</label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                      value={newProductData.name} 
                      onChange={e => setNewProductData({...newProductData, name: e.target.value})}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Price</label>
                      <input 
                        required
                        type="number"
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newProductData.price} 
                        onChange={e => setNewProductData({...newProductData, price: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Initial Stock</label>
                      <input 
                        required
                        type="number"
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newProductData.stock} 
                        onChange={e => setNewProductData({...newProductData, stock: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light"
                    >
                      Add Product
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsAddingNewProduct(false)}
                      className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-xl"
                    >
                      Back
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSaveAppointment} className="p-4 md:p-6 space-y-3 md:space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Search Customer</label>
                        <button 
                          type="button"
                          onClick={() => setIsAddingNewCustomer(true)}
                          className="text-[10px] font-bold text-primary flex items-center gap-1"
                        >
                          <UserPlus size={12} />
                          New Customer
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input 
                          type="text"
                          placeholder="Search customer name or phone..."
                          className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none text-sm"
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        />
                      </div>
                      {customerSearchTerm && (
                        <div className="mt-2 max-h-32 overflow-y-auto border border-zinc-100 dark:border-zinc-800 rounded-xl divide-y divide-zinc-50 dark:divide-zinc-800">
                          {customers
                            .filter(c => 
                              c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
                              (c.phone && c.phone.includes(customerSearchTerm))
                            )
                            .map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setNewAppointment({
                                    ...newAppointment, 
                                    customerId: c.id,
                                    customerName: c.name,
                                    customerPhone: c.phone || ''
                                  });
                                  setCustomerSearchTerm('');
                                }}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-primary/5 transition-colors flex justify-between items-center"
                              >
                                <span className="font-bold">{c.name}</span>
                                <span className="text-zinc-400">{c.phone || 'No phone'}</span>
                              </button>
                            ))
                          }
                          {customers.filter(c => 
                            c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
                            (c.phone && c.phone.includes(customerSearchTerm))
                          ).length === 0 && (
                            <div className="px-4 py-2 text-xs text-zinc-400 italic">No customers found</div>
                          )}
                        </div>
                      )}
                    </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Customer Name</label>
                    <input required className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newAppointment.customerName} onChange={e => setNewAppointment({...newAppointment, customerName: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Phone Number</label>
                    <input className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newAppointment.customerPhone} onChange={e => setNewAppointment({...newAppointment, customerPhone: e.target.value})} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Order Items</label>
                      <div className="flex gap-2">
                        {settings?.showServices !== false && (
                          <button 
                            type="button"
                            onClick={() => setIsAddingNewService(true)}
                            className="text-[10px] font-bold text-primary flex items-center gap-1"
                          >
                            <Plus size={12} /> New Service
                          </button>
                        )}
                        {settings?.showProducts !== false && (
                          <button 
                            type="button"
                            onClick={() => setIsAddingNewProduct(true)}
                            className="text-[10px] font-bold text-primary flex items-center gap-1"
                          >
                            <Plus size={12} /> New Product
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`grid ${settings?.showServices !== false && settings?.showProducts !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                      {settings?.showServices !== false && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Add Service</label>
                          <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" size={12} />
                            <input 
                              type="text" 
                              placeholder="Search service..." 
                              className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none"
                              value={serviceSearchTerm}
                              onChange={(e) => setServiceSearchTerm(e.target.value)}
                            />
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                            {services
                              .filter(s => s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()))
                              .map(s => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => addItemToAppointment(s, 'service')}
                                className="w-full text-left p-2 text-[10px] bg-zinc-50 dark:bg-zinc-800 hover:bg-primary/10 rounded-lg border border-zinc-100 dark:border-zinc-800 transition-colors flex justify-between items-center"
                              >
                                <span className="font-bold truncate">{s.name}</span>
                                <span className="text-primary">{formatCurrency(s.price)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {settings?.showProducts !== false && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Add Product</label>
                          <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" size={12} />
                            <input 
                              type="text" 
                              placeholder="Search product..." 
                              className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none"
                              value={productSearchTerm}
                              onChange={(e) => setProductSearchTerm(e.target.value)}
                            />
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                            {products
                              .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                              .map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addItemToAppointment(p, 'product')}
                                className="w-full text-left p-2 text-[10px] bg-zinc-50 dark:bg-zinc-800 hover:bg-primary/10 rounded-lg border border-zinc-100 dark:border-zinc-800 transition-colors flex justify-between items-center"
                              >
                                <span className="font-bold truncate">{p.name}</span>
                                <span className="text-primary">{formatCurrency(p.price)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cart Items */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Selected Items</label>
                      <div className="space-y-2">
                        {newAppointment.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{item.name}</div>
                              {item.isFlexiblePrice ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[8px] font-bold text-zinc-400 uppercase">Price:</span>
                                  <input 
                                    type="number"
                                    className="w-16 px-1 py-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[10px] font-bold text-primary outline-none focus:ring-1 focus:ring-primary"
                                    value={item.price}
                                    onChange={(e) => handleManualItemPrice(idx, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                  />
                                </div>
                              ) : (
                                <div className="text-[10px] text-zinc-500">{formatCurrency(item.price)}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
                                <button 
                                  type="button"
                                  onClick={() => updateItemQuantity(idx, -1)}
                                  className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-primary"
                                >-</button>
                                <input 
                                  type="number"
                                  className="text-xs font-bold w-8 text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={item.quantity}
                                  onChange={(e) => handleManualItemQuantity(idx, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  min="1"
                                />
                                <button 
                                  type="button"
                                  onClick={() => updateItemQuantity(idx, 1)}
                                  className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-primary"
                                >+</button>
                              </div>
                              <button 
                                type="button"
                                onClick={() => removeItemFromAppointment(idx)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {(!newAppointment.items || newAppointment.items.length === 0) && (
                          <div className="text-center py-4 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl text-zinc-400 text-[10px] font-bold uppercase">
                            No items selected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Staff (Multi-select)</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl min-h-[42px]">
                      {staff.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const current = newAppointment.staffIds || [];
                            if (current.includes(s.id!)) {
                              setNewAppointment({...newAppointment, staffIds: current.filter(id => id !== s.id)});
                            } else {
                              setNewAppointment({...newAppointment, staffIds: [...current, s.id!]});
                            }
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            newAppointment.staffIds?.includes(s.id!)
                              ? 'bg-primary text-white'
                              : 'bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Date & Time</label>
                      <input 
                        required 
                        type="datetime-local" 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={new Date(newAppointment.startTime! - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}
                        onChange={e => setNewAppointment({...newAppointment, startTime: new Date(e.target.value).getTime()})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Due Date</label>
                      <input 
                        required 
                        type="datetime-local" 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={new Date(newAppointment.dueDate! - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}
                        onChange={e => setNewAppointment({...newAppointment, dueDate: new Date(e.target.value).getTime()})} 
                      />
                    </div>
                  </div>

                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Discount (%)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newAppointment.discountPercentage} 
                        onChange={e => {
                          const percent = parseFloat(e.target.value) || 0;
                          const { totalAmount } = calculateAppointmentTotals(newAppointment.items || [], percent, 0);
                          setNewAppointment({...newAppointment, discountPercentage: percent, discountAmount: 0, totalAmount});
                        }} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Discount Amount</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newAppointment.discountAmount} 
                        onChange={e => {
                          const amt = parseFloat(e.target.value) || 0;
                          const { totalAmount } = calculateAppointmentTotals(newAppointment.items || [], 0, amt);
                          setNewAppointment({...newAppointment, discountAmount: amt, discountPercentage: 0, totalAmount});
                        }} 
                      />
                    </div>
                  </div>

                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Total Amount (Should Pay)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none font-bold" 
                        value={newAppointment.totalAmount} 
                        onChange={e => setNewAppointment({...newAppointment, totalAmount: parseFloat(e.target.value) || 0})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Down Payment (Paid Now)</label>
                      <input 
                        type="number" 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none font-bold text-primary" 
                        value={newAppointment.paidAmount} 
                        onChange={e => {
                          const amt = parseFloat(e.target.value) || 0;
                          const total = newAppointment.totalAmount || 0;
                          let status = newAppointment.paymentStatus;
                          if (amt >= total && total > 0) {
                            status = 'paid';
                          } else if (amt > 0) {
                            status = 'partial';
                          } else {
                            status = 'unpaid';
                          }
                          setNewAppointment({...newAppointment, paidAmount: amt, paymentStatus: status as any});
                        }} 
                      />
                    </div>
                  </div>

                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Payment Status</label>
                      <select 
                        className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" 
                        value={newAppointment.paymentStatus} 
                        onChange={e => {
                          const status = e.target.value as any;
                          let paidAmount = newAppointment.paidAmount || 0;
                          if (status === 'paid') {
                            paidAmount = newAppointment.totalAmount || 0;
                          } else if (status === 'unpaid') {
                            paidAmount = 0;
                          }
                          setNewAppointment({...newAppointment, paymentStatus: status, paidAmount});
                        }}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partial</option>
                        <option value="paid">Fully Paid</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Payment Method</label>
                      <select className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" value={newAppointment.paymentMethod} onChange={e => setNewAppointment({...newAppointment, paymentMethod: e.target.value as any})}>
                        <option value="cash">Cash</option>
                        <option value="e-wallet">E-Wallet</option>
                        <option value="bank-transfer">Bank Transfer</option>
                        <option value="credit">Credit</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Description</label>
                    <textarea 
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none resize-none h-20" 
                      placeholder="Enter appointment details..."
                      value={newAppointment.description} 
                      onChange={e => setNewAppointment({...newAppointment, description: e.target.value})} 
                    />
                  </div>

                  {((newAppointment.totalAmount || 0) > 0 || (newAppointment.paidAmount || 0) > 0) && (
                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex justify-between items-center">
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase">Total Amount</div>
                        <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(newAppointment.totalAmount || 0)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase">Total Amount Due</div>
                        <div className="text-lg font-black text-primary">
                          {formatCurrency((newAppointment.totalAmount || 0) - (newAppointment.paidAmount || 0))}
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light mt-4">
                    {editingAppointment ? 'Update Appointment' : 'Schedule Appointment'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200 dark:border-zinc-800 p-4 md:p-6"
            >
              <h3 className="text-xl font-bold mb-2">{confirmModal.title}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mb-4 md:mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReceipt && receiptData && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md p-0 md:p-4 overflow-y-auto">
            <motion.div 
              id="receipt-content"
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white text-zinc-900 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20"
            >
              {/* Receipt Header */}
              <div className="bg-primary p-6 md:p-8 text-white text-center relative">
                <button 
                  onClick={() => setShowReceipt(false)}
                  className="absolute top-4 right-4 md:top-6 md:right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors print:hidden"
                >
                  <CloseIcon size={20} />
                </button>
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                  <Check size={24} className="text-white md:w-8 md:h-8" />
                </div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-widest">Appointment Confirmed</h3>
                <p className="text-white/80 text-xs md:text-sm mt-1 font-bold">Partial Receipt</p>
              </div>

              {/* Receipt Content */}
              <div className="p-6 md:p-8 space-y-4 md:space-y-6 bg-white">
                <div className="flex justify-between items-start border-b border-zinc-100 pb-4 md:pb-6">
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Customer</p>
                    <h4 className="text-lg font-black text-zinc-900">{receiptData.customerName}</h4>
                    <p className="text-sm text-zinc-500 font-medium">{receiptData.customerPhone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Date</p>
                    <p className="text-sm font-bold text-zinc-900">{new Date(receiptData.startTime).toLocaleDateString()}</p>
                    <p className="text-xs text-zinc-500 font-medium">{new Date(receiptData.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Order Summary</p>
                  <div className="space-y-3">
                    {receiptData.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-zinc-800">{item.name}</p>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase">{item.quantity}x @ {formatCurrency(item.price)}</p>
                        </div>
                        <p className="text-sm font-black text-zinc-900">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t-2 border-dashed border-zinc-100 space-y-3">
                  <div className="flex justify-between text-sm font-bold text-zinc-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(receiptData.subtotal || 0)}</span>
                  </div>
                  {receiptData.discountAmount > 0 && (
                    <div className="flex justify-between text-sm font-bold text-red-500">
                      <span>Discount</span>
                      <span>-{formatCurrency(receiptData.discountAmount)}</span>
                    </div>
                  )}
                  {receiptData.discountPercentage > 0 && (
                    <div className="flex justify-between text-sm font-bold text-red-500">
                      <span>Discount ({receiptData.discountPercentage}%)</span>
                      <span>-{formatCurrency((receiptData.subtotal || 0) * (receiptData.discountPercentage / 100))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-black text-zinc-900 pt-2">
                    <span>Total Amount</span>
                    <span>{formatCurrency(receiptData.totalAmount)}</span>
                  </div>
                </div>

                <div className="bg-zinc-50 rounded-3xl p-6 space-y-4 border border-zinc-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">Down Payment</span>
                    </div>
                    <span className="text-lg font-black text-green-600">{formatCurrency(receiptData.paidAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">Balance Due</span>
                    </div>
                    <span className="text-xl font-black text-primary">{formatCurrency(receiptData.totalAmount - (receiptData.paidAmount || 0))}</span>
                  </div>
                </div>

                <div className="text-center pt-4 print:hidden">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Please take a photo for your reference</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => window.print()}
                      className="flex-1 py-4 bg-zinc-100 text-zinc-900 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
                    >
                      <Printer size={18} />
                      Print
                    </button>
                    <button 
                      onClick={() => setShowReceipt(false)}
                      className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>

              {/* Receipt Footer Decor */}
              <div className="h-4 bg-zinc-100 flex gap-1 px-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="flex-1 h-full bg-white rounded-t-full"></div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
