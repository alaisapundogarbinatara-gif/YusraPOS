import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  User,
  X as CloseIcon,
  Check,
  Briefcase
} from 'lucide-react';
import { db, type Staff } from '../db';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function StaffManagement() {
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  const services = useLiveQuery(() => db.services.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  
  const [newStaff, setNewStaff] = useState<Partial<Staff>>({
    name: '',
    role: '',
    phone: '',
    email: '',
    commissionRate: 0,
    assignedServiceIds: []
  });

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const staffData = { ...newStaff as Staff };
      if (editingStaff) {
        await db.staff.update(editingStaff.id!, staffData);
        toast.success('Staff updated');
      } else {
        await db.staff.add({ ...staffData, createdAt: Date.now() });
        toast.success('Staff added');
      }
      setIsAddingStaff(false);
      setEditingStaff(null);
      setNewStaff({ name: '', role: '', phone: '', email: '', commissionRate: 0, assignedServiceIds: [] });
    } catch (error) {
      toast.error('Failed to save staff');
    }
  };

  const handleEditStaff = (s: Staff) => {
    setEditingStaff(s);
    setNewStaff({
      ...s,
      assignedServiceIds: s.assignedServiceIds || []
    });
    setIsAddingStaff(true);
  };

  const deleteStaff = async (id: number | string) => {
    if (confirm('Are you sure you want to delete this staff member?')) {
      try {
        if (typeof id === 'number') await db.staff.delete(id);
        toast.success('Staff deleted');
      } catch (error) {
        toast.error('Failed to delete staff');
      }
    }
  };

  const toggleServiceAssignment = (serviceId: number) => {
    const current = newStaff.assignedServiceIds || [];
    if (current.includes(serviceId)) {
      setNewStaff({ ...newStaff, assignedServiceIds: current.filter(id => id !== serviceId) });
    } else {
      setNewStaff({ ...newStaff, assignedServiceIds: [...current, serviceId] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Staff Management</h2>
          <p className="text-sm text-zinc-500">Manage your service providers and their commission rates.</p>
        </div>
        <button 
          onClick={() => setIsAddingStaff(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:brightness-110 transition-all shadow-lg shadow-primary-light"
        >
          <Plus size={18} />
          Add Staff
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
        <input 
          type="text" 
          placeholder="Search staff..." 
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary transition-all text-zinc-900 dark:text-zinc-100"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((s) => (
          <div key={s.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <User size={24} />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEditStaff(s)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => deleteStaff(s.id!)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-zinc-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{s.name}</h3>
            <p className="text-sm text-zinc-500 mb-2">{s.role}</p>
            
            <div className="mb-4">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Assigned Services</div>
              <div className="flex flex-wrap gap-1">
                {s.assignedServiceIds && s.assignedServiceIds.length > 0 ? (
                  s.assignedServiceIds.map(id => {
                    const service = services.find(srv => srv.id === id);
                    return (
                      <span key={id} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-bold">
                        {service?.name || 'Unknown'}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[9px] text-zinc-400 italic">No services assigned</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Commission</div>
              <div className="text-lg font-black text-primary">{s.commissionRate}%</div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAddingStaff && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-zinc-900 rounded-t-[2.5rem] md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-t md:border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col"
            >
              <div className="p-4 md:p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold">{editingStaff ? 'Edit Staff' : 'Add Staff'}</h3>
                <button onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                  <CloseIcon size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveStaff} className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    value={newStaff.name}
                    onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Role / Position</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    value={newStaff.role}
                    onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Commission Rate (%)</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    value={newStaff.commissionRate}
                    onChange={e => setNewStaff({...newStaff, commissionRate: parseFloat(e.target.value) || 0})}
                  />
                </div>

                {settings?.showServices !== false && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Assign Services</label>
                    <div className="grid grid-cols-2 gap-2">
                      {services.map(srv => (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => toggleServiceAssignment(srv.id as number)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                            newStaff.assignedServiceIds?.includes(srv.id!)
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            newStaff.assignedServiceIds?.includes(srv.id!)
                              ? 'bg-primary border-primary text-white'
                              : 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600'
                          }`}>
                            {newStaff.assignedServiceIds?.includes(srv.id!) && <Check size={10} strokeWidth={4} />}
                          </div>
                          <span className="text-[10px] font-bold truncate">{srv.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="px-4 py-2 text-zinc-500 font-semibold text-sm">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary-light text-sm">Save Staff</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
