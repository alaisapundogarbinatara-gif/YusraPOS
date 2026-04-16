import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Calendar,
  User as UserIcon,
  Search,
  Filter,
  FileText
} from 'lucide-react';
import { db, type User, type Attendance as AttendanceType } from '../db';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function Attendance({ currentUser }: { currentUser: User }) {
  const attendanceLogs = useLiveQuery(() => 
    db.attendance.orderBy('timestamp').reverse().toArray()
  ) || [];
  
  const staffMembers = useLiveQuery(() => db.staff.toArray()) || [];
  const users = useLiveQuery(() => db.users.toArray()) || [];

  const [filterStaffId, setFilterStaffId] = useState<number | string | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClockAction = async (type: 'clock-in' | 'clock-out' | 'lunch-start' | 'lunch-end' | 'break-start' | 'break-end') => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const attendanceData = {
        staffId: currentUser.id!,
        type,
        timestamp: Date.now()
      };
      await db.attendance.add(attendanceData as any);
      toast.success(`Successfully recorded ${type.replace('-', ' ')}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to record attendance');
    } finally {
      setTimeout(() => setIsProcessing(false), 1000);
    }
  };

  const calculateTotals = (logs: AttendanceType[]) => {
    let workMs = 0;
    let lunchMs = 0;
    let breakMs = 0;

    // Sort logs chronologically for calculation
    const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
    const now = Date.now();
    
    // Check if any log is from today to decide if we should use 'now' for open intervals
    const isToday = logs.some(l => new Date(l.timestamp).toDateString() === new Date().toDateString());

    let lastClockIn: number | null = null;
    let lastLunchStart: number | null = null;
    let lastBreakStart: number | null = null;

    sorted.forEach(log => {
      switch (log.type) {
        case 'clock-in': 
          if (!lastClockIn) lastClockIn = log.timestamp; 
          break;
        case 'clock-out': 
          if (lastClockIn) {
            workMs += (log.timestamp - lastClockIn);
            lastClockIn = null;
          }
          break;
        case 'lunch-start': 
          if (!lastLunchStart) lastLunchStart = log.timestamp; 
          break;
        case 'lunch-end':
          if (lastLunchStart) {
            lunchMs += (log.timestamp - lastLunchStart);
            lastLunchStart = null;
          }
          break;
        case 'break-start': 
          if (!lastBreakStart) lastBreakStart = log.timestamp; 
          break;
        case 'break-end':
          if (lastBreakStart) {
            breakMs += (log.timestamp - lastBreakStart);
            lastBreakStart = null;
          }
          break;
      }
    });

    // If it's today, close open intervals with 'now' for real-time summary
    if (isToday) {
      if (lastClockIn) workMs += (now - lastClockIn);
      if (lastLunchStart) lunchMs += (now - lastLunchStart);
      if (lastBreakStart) breakMs += (now - lastBreakStart);
    }

    // Net work time excludes lunch and breaks if they happened during work hours
    const netWorkMs = Math.max(0, workMs - lunchMs - breakMs);

    const formatDuration = (ms: number) => {
      const totalMinutes = Math.floor(ms / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h ${minutes}m`;
    };

    return {
      work: formatDuration(netWorkMs),
      lunch: formatDuration(lunchMs),
      breaks: formatDuration(breakMs),
      totalSpan: formatDuration(workMs)
    };
  };

  const filteredLogs = attendanceLogs.filter(log => {
    const user = users.find(u => String(u.id) === String(log.staffId));
    const matchesStaff = filterStaffId === 'all' || String(log.staffId) === String(filterStaffId);
    const matchesSearch = user?.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStaff && matchesSearch;
  });

  const lastLog = attendanceLogs.find(log => String(log.staffId) === String(currentUser.id));
  const currentStatus = lastLog?.type || 'clock-out';

  const getStatusColor = (status: string) => {
    if (status === 'clock-in' || status === 'lunch-end' || status === 'break-end') return 'bg-green-100 text-green-600';
    if (status === 'lunch-start') return 'bg-orange-100 text-orange-600';
    if (status === 'break-start') return 'bg-blue-100 text-blue-600';
    return 'bg-zinc-100 text-zinc-500';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'clock-in' || status === 'lunch-end' || status === 'break-end') return 'On Duty';
    if (status === 'lunch-start') return 'On Lunch';
    if (status === 'break-start') return 'On Break';
    return 'Off Duty';
  };

  return (
    <div className="space-y-6">
      {/* Clock In/Out Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="text-primary" size={24} />
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">DTS - Attendance System</h3>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Current Status</div>
            <div className={`text-xs font-black uppercase px-2 py-1 rounded-lg inline-block mt-1 ${getStatusColor(currentStatus)}`}>
              {getStatusLabel(currentStatus)}
            </div>
          </div>
        </div>
        
        <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Main Shift */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Shift Management</h4>
            <div className="flex flex-col gap-2">
              <button
                disabled={currentStatus !== 'clock-out' || isProcessing}
                onClick={() => handleClockAction('clock-in')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all ${
                  currentStatus === 'clock-out' && !isProcessing
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <LogIn size={20} className={isProcessing ? 'animate-spin' : ''} />
                <div className="text-left">
                  <div className="text-sm">{isProcessing ? 'Processing...' : 'Clock In'}</div>
                </div>
              </button>

              <button
                disabled={currentStatus === 'clock-out' || isProcessing}
                onClick={() => handleClockAction('clock-out')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all ${
                  currentStatus !== 'clock-out' && !isProcessing
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <LogOut size={20} className={isProcessing ? 'animate-spin' : ''} />
                <div className="text-left">
                  <div className="text-sm">{isProcessing ? 'Processing...' : 'Clock Out'}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Lunch Break */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Lunch Break</h4>
            <div className="flex flex-col gap-2">
              <button
                disabled={(currentStatus !== 'clock-in' && currentStatus !== 'break-end') || isProcessing}
                onClick={() => handleClockAction('lunch-start')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all ${
                  (currentStatus === 'clock-in' || currentStatus === 'break-end') && !isProcessing
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Clock size={20} className={isProcessing ? 'animate-spin' : ''} />
                <div className="text-left">
                  <div className="text-sm">{isProcessing ? 'Wait...' : 'Start Lunch'}</div>
                </div>
              </button>

              <button
                disabled={currentStatus !== 'lunch-start' || isProcessing}
                onClick={() => handleClockAction('lunch-end')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all ${
                  currentStatus === 'lunch-start' && !isProcessing
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Clock size={20} className={isProcessing ? 'animate-spin' : ''} />
                <div className="text-left">
                  <div className="text-sm">{isProcessing ? 'Wait...' : 'End Lunch'}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Short Breaks */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Short Breaks</h4>
            <div className="flex flex-col gap-2">
              <button
                disabled={(currentStatus !== 'clock-in' && currentStatus !== 'lunch-end') || isProcessing}
                onClick={() => handleClockAction('break-start')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all ${
                  (currentStatus === 'clock-in' || currentStatus === 'lunch-end') && !isProcessing
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Clock size={20} className={isProcessing ? 'animate-spin' : ''} />
                <div className="text-left">
                  <div className="text-sm">{isProcessing ? 'Wait...' : 'Start Break'}</div>
                </div>
              </button>

              <button
                disabled={currentStatus !== 'break-start' || isProcessing}
                onClick={() => handleClockAction('break-end')}
                className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all ${
                  currentStatus === 'break-start' && !isProcessing
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                }`}
              >
                <Clock size={20} className={isProcessing ? 'animate-spin' : ''} />
                <div className="text-left">
                  <div className="text-sm">{isProcessing ? 'Wait...' : 'End Break'}</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Personal Daily Summary */}
        <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {Object.entries(calculateTotals(attendanceLogs.filter(l => String(l.staffId) === String(currentUser.id) && new Date(l.timestamp).toDateString() === new Date().toDateString()))).map(([key, value]) => (
              <div key={key}>
                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{key === 'totalSpan' ? 'Total Span' : key}</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Summary for All Staff */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Daily Summary (Today)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4">Staff Member</th>
                <th className="px-6 py-4">Work Hours</th>
                <th className="px-6 py-4">Lunch</th>
                <th className="px-6 py-4">Breaks</th>
                <th className="px-6 py-4">Total Span</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map(user => {
                const userLogs = attendanceLogs.filter(l => String(l.staffId) === String(user.id) && new Date(l.timestamp).toDateString() === new Date().toDateString());
                if (userLogs.length === 0) return null;
                const totals = calculateTotals(userLogs);
                return (
                  <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">{user.name}</td>
                    <td className="px-6 py-4 text-green-600 font-bold">{totals.work}</td>
                    <td className="px-6 py-4 text-orange-600">{totals.lunch}</td>
                    <td className="px-6 py-4 text-blue-600">{totals.breaks}</td>
                    <td className="px-6 py-4 text-zinc-500">{totals.totalSpan}</td>
                  </tr>
                );
              })}
              {users.filter(u => attendanceLogs.some(l => String(l.staffId) === String(u.id) && new Date(l.timestamp).toDateString() === new Date().toDateString())).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500 italic">
                    No activity recorded today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Logs (Unified View) */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Attendance Logs</h3>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input 
                  type="text"
                  placeholder="Search staff..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={filterStaffId}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterStaffId(val === 'all' ? 'all' : val as any);
                }}
              >
                <option value="all">All Staff</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4">Staff Member</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredLogs.map((log) => {
                const user = users.find(u => String(u.id) === String(log.staffId));
                const date = new Date(log.timestamp);
                return (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {user?.name[0]}
                        </div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {user?.name || 'Unknown User'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                        log.type.includes('in') || log.type.includes('end') ? 'bg-green-100 text-green-600' : 
                        log.type.includes('lunch') ? 'bg-orange-100 text-orange-600' :
                        log.type.includes('break') ? 'bg-blue-100 text-blue-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {log.type.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {date.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-zinc-900 dark:text-zinc-100">
                      {date.toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 italic">
                    No attendance records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
