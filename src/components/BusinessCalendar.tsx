import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Package, 
  Truck, 
  FileText, 
  AlertTriangle, 
  Clock,
  MoreVertical,
  Trash2,
  Check,
  X,
  Filter,
  Info
} from 'lucide-react';
import { db, type BusinessEvent, type Appointment, type Product } from '../db';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function BusinessCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  
  const businessEvents = useLiveQuery(() => db.businessEvents.toArray()) || [];
  const appointments = useLiveQuery(() => db.appointments.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const [newEvent, setNewEvent] = useState<Partial<BusinessEvent>>({
    title: '',
    type: 'other',
    description: '',
    recurrence: 'none',
    status: 'pending'
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  const allCalendarEvents = useMemo(() => {
    const events: any[] = [];

    // Add Business Events
    businessEvents.forEach(be => {
      // If it's a one-time event
      if (be.recurrence === 'none') {
        events.push({ ...be, category: 'business' });
      } else {
        // Simple recurrence expansion (for display in current month)
        // In a real app, this should be handled more robustly
        let date = new Date(be.date);
        const monthEnd = endOfMonth(currentDate);
        while (date <= monthEnd) {
          if (isSameMonth(date, currentDate)) {
            events.push({ ...be, date: date.getTime(), category: 'business' });
          }
          if (be.recurrence === 'bi-weekly') date.setDate(date.getDate() + 14);
          else if (be.recurrence === 'monthly') date.setMonth(date.getMonth() + 1);
          else if (be.recurrence === 'annually') date.setFullYear(date.getFullYear() + 1);
          else break;
        }
      }
    });

    // Add Appointments
    appointments.forEach(app => {
      events.push({
        id: `app-${app.id}`,
        title: `Appointment: ${app.customerName}`,
        date: app.startTime,
        type: 'essential',
        category: 'appointment',
        status: app.status,
        original: app
      });
    });

    // Add Expiring Products
    products.forEach(p => {
      if (p.expiryDate) {
        events.push({
          id: `expiry-${p.id}`,
          title: `Expiry: ${p.name}`,
          date: p.expiryDate,
          type: 'expiry',
          category: 'product',
          status: 'pending',
          original: p
        });
      }
    });

    return events;
  }, [businessEvents, appointments, products, currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const getEventsForDay = (day: Date) => {
    return allCalendarEvents.filter(e => isSameDay(new Date(e.date), day))
      .filter(e => filterType === 'all' || e.type === filterType);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) return;

    try {
      await db.businessEvents.add({
        ...newEvent as BusinessEvent,
        createdAt: Date.now()
      });
      setIsAddingEvent(false);
      setNewEvent({ title: '', type: 'other', description: '', recurrence: 'none', status: 'pending' });
      toast.success('Event added to calendar');
    } catch (error) {
      toast.error('Failed to add event');
    }
  };

  const deleteEvent = async (id: string | number) => {
    if (typeof id === 'string' && id.startsWith('app-')) {
      toast.error('Appointments must be deleted from the Schedules view');
      return;
    }
    if (typeof id === 'string' && id.startsWith('expiry-')) {
      toast.error('Product expiries must be managed in Inventory');
      return;
    }
    try {
      await db.businessEvents.delete(id);
      toast.success('Event removed');
    } catch (error) {
      toast.error('Failed to remove event');
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'lease': return <FileText size={14} className="text-blue-500" />;
      case 'delivery': return <Truck size={14} className="text-purple-500" />;
      case 'expiry': return <AlertTriangle size={14} className="text-red-500" />;
      case 'essential': return <Info size={14} className="text-primary" />;
      default: return <CalendarIcon size={14} className="text-zinc-400" />;
    }
  };

  const getEventBg = (type: string) => {
    switch (type) {
      case 'lease': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300';
      case 'delivery': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300';
      case 'expiry': return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
      case 'essential': return 'bg-primary/10 text-primary';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Business Calendar</h2>
          <p className="text-sm text-zinc-500">Track leases, deliveries, expiries, and essential events.</p>
        </div>
        <button 
          onClick={() => {
            setNewEvent({
              ...newEvent,
              date: Date.now()
            });
            setIsAddingEvent(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold shadow-lg shadow-primary-light"
        >
          <Plus size={18} />
          New Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Main View */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
              <CalendarIcon size={24} className="text-primary" />
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
              >
                Today
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-2 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest border-r border-zinc-50 dark:border-zinc-800/50 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-[120px]">
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                
                return (
                  <div 
                    key={idx}
                    onClick={() => setSelectedDay(day)}
                    className={`p-2 border-r border-b border-zinc-50 dark:border-zinc-800/50 flex flex-col gap-1 transition-colors cursor-pointer group ${
                      !isCurrentMonth ? 'bg-zinc-50/30 dark:bg-zinc-950/30 opacity-40' : 'bg-white dark:bg-zinc-900'
                    } ${isSelected ? 'ring-2 ring-primary ring-inset z-10' : ''} ${isToday(day) ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-xs font-bold ${isToday(day) ? 'w-6 h-6 flex items-center justify-center bg-primary text-white rounded-full' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {format(day, 'd')}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-black text-primary">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                      {dayEvents.slice(0, 3).map((event, eidx) => (
                        <div 
                          key={eidx}
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold truncate flex items-center gap-1 ${getEventBg(event.type)}`}
                        >
                          <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[8px] font-bold text-zinc-400 pl-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar: Selected Day Details & Filters */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 overflow-hidden flex flex-col h-full">
            <div className="mb-6">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Filter size={14} />
                Filter View
              </h3>
              <div className="flex flex-wrap gap-2">
                {['all', 'lease', 'delivery', 'expiry', 'essential'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold capitalize transition-all border ${
                      filterType === type 
                        ? 'bg-primary text-white border-primary shadow-md' 
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-100 dark:border-zinc-800 hover:border-primary/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                  {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Events for the Month'}
                </h4>
                {selectedDay && (
                  <button 
                    onClick={() => setSelectedDay(null)}
                    className="text-[10px] font-bold text-primary"
                  >
                    Monthly View
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {(selectedDay ? getEventsForDay(selectedDay) : allCalendarEvents.filter(e => isSameMonth(new Date(e.date), currentDate)))
                  .sort((a, b) => a.date - b.date)
                  .map((event, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={`${event.id}-${idx}`}
                    className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className={`p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm`}>
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex items-center gap-1">
                        {event.category === 'business' && (
                          <button 
                            onClick={() => deleteEvent(event.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${getEventBg(event.type)}`}>
                          {event.type}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{event.title}</h5>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{event.description || 'No description provided.'}</p>
                      
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Clock size={12} />
                          <span className="text-[10px] font-bold">{format(event.date, 'h:mm a')}</span>
                        </div>
                        {event.recurrence && event.recurrence !== 'none' && (
                          <div className="flex items-center gap-1.5 text-blue-500">
                            <CalendarIcon size={12} />
                            <span className="text-[10px] font-bold capitalize">{event.recurrence}</span>
                          </div>
                        )}
                        {!selectedDay && (
                          <div className="text-[10px] font-bold text-zinc-400">
                            {format(event.date, 'MMM d')}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {(selectedDay ? getEventsForDay(selectedDay) : allCalendarEvents.filter(e => isSameMonth(new Date(e.date), currentDate))).length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                    <CalendarIcon size={32} className="opacity-20 mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">No events scheduled</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {isAddingEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Add New Event</h3>
                <button onClick={() => setIsAddingEvent(false)} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleAddEvent} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Event Title</label>
                  <input 
                    required
                    placeholder="e.g. Monthly Rent Payment"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary"
                    value={newEvent.title}
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Event Type</label>
                    <select 
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none"
                      value={newEvent.type}
                      onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
                    >
                      <option value="lease">Lease Contract</option>
                      <option value="delivery">Delivery</option>
                      <option value="essential">Business Essential</option>
                      <option value="expiry">Expiry Tracking</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Recurrence</label>
                    <select 
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none"
                      value={newEvent.recurrence}
                      onChange={e => setNewEvent({...newEvent, recurrence: e.target.value as any})}
                    >
                      <option value="none">None</option>
                      <option value="bi-weekly">Bi-Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Date & Time</label>
                  <input 
                    type="datetime-local"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none"
                    value={newEvent.date ? format(new Date(newEvent.date), "yyyy-MM-dd'T'HH:mm") : ''}
                    onChange={e => setNewEvent({...newEvent, date: new Date(e.target.value).getTime()})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    rows={3}
                    placeholder="Details about the event..."
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary resize-none"
                    value={newEvent.description}
                    onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary-light hover:brightness-110 mb-2"
                  >
                    Save Event
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsAddingEvent(false)}
                    className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-2xl"
                  >
                    Cancel
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
