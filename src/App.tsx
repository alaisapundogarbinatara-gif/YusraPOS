import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Calculator, 
  Settings, 
  Menu, 
  X,
  Moon,
  Sun,
  LogOut,
  Lock,
  Building2,
  History,
  Wallet,
  AlertCircle,
  Calendar,
  ClipboardCheck,
  Receipt,
  Wrench,
  Contact2,
  BarChart3,
  GraduationCap,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, User as UserType, type Attendance as AttendanceType } from './db';
import { hashPin } from './lib/security';
import { authenticateBiometrics, isWebAuthnSupported } from './lib/webauthn';
import { Logo, LogoFull } from './components/Logo';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

// Views
import Dashboard from './components/Dashboard';
import Services from './components/Services';
import Products from './components/Products';
import Staff from './components/Staff';
import Schedules from './components/Schedules';
import Sales from './components/Sales';
import Zakat from './components/Zakat';
import Reports from './components/Reports';
import SettingsView from './components/Settings';
import Login from './components/Login';
import Accounts from './components/Accounts';
import Transactions from './components/Transactions';
import Expenses from './components/Expenses';
import Attendance from './components/Attendance';
import Learn from './components/Learn';
import EmaanPopup from './components/EmaanPopup';
import DonationPopup from './components/DonationPopup';
import BusinessCalendar from './components/BusinessCalendar';

function AppContent() {
  const { t } = useLanguage();
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [isKioskUnlocked, setIsKioskUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const dragConstraintsRef = React.useRef(null);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isWebAuthnSupported();
      setIsBiometricsSupported(supported);
    };
    checkSupport();
  }, []);

  useEffect(() => {
    (window as any).setActiveView = setActiveView;
  }, []);

  useEffect(() => {
    if (currentUser) {
      const checkClockIn = async () => {
        try {
          const today = new Date().toDateString();
          const logs = await db.attendance
            .where('staffId')
            .equals(currentUser.id!)
            .toArray();
          
          const hasClockedInToday = logs.some(log => 
            new Date(log.timestamp).toDateString() === today && log.type === 'clock-in'
          );

          if (!hasClockedInToday) {
            const attendanceData = {
              staffId: currentUser.id!,
              type: 'clock-in' as const,
              timestamp: Date.now()
            };
            await db.attendance.add(attendanceData as any);
            toast.success(`Auto Clock-In: Welcome, ${currentUser.name}!`);
          }
        } catch (error) {
          console.error('Auto clock-in failed:', error);
        }
      };
      checkClockIn();
    }
  }, [currentUser]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true; // Default to dark as requested
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Clear Zakat history on app startup as requested
    db.zakat.clear();
  }, []);

  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
      // Generate a lighter version for shadows/hover if needed, or just use the same
      document.documentElement.style.setProperty('--primary-color-light', `${settings.primaryColor}33`); // 20% opacity
    }
  }, [settings?.primaryColor]);

  const navRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (navRef.current) {
      const activeElement = navRef.current.querySelector(`[data-active="true"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeView]);

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: ['admin', 'cashier', 'staff'] },
    { id: 'business-calendar', label: 'Calendar', icon: Calendar, roles: ['admin', 'cashier', 'staff'] },
    { id: 'schedules', label: t.appointments, icon: ClipboardCheck, roles: ['admin', 'cashier', 'staff'] },
    { id: 'attendance', label: t.attendance, icon: History, roles: ['admin', 'cashier', 'staff'] },
    { id: 'sales', label: t.pos, icon: ShoppingCart, roles: ['admin', 'cashier', 'staff'] },
    { id: 'transactions', label: 'Transactions', icon: Receipt, roles: ['admin', 'cashier', 'staff'] },
    { id: 'services', label: t.services, icon: Wrench, roles: ['admin'] },
    { id: 'products', label: t.inventory, icon: Package, roles: ['admin'] },
    { id: 'staff', label: t.staff, icon: Users, roles: ['admin'] },
    { id: 'expenses', label: t.expenses, icon: Wallet, roles: ['admin', 'cashier', 'staff'] },
    { id: 'accounts', label: t.customers, icon: Contact2, roles: ['admin', 'cashier', 'staff'] },
    { id: 'learn', label: t.learn, icon: GraduationCap, roles: ['admin', 'cashier', 'staff'] },
    { id: 'zakat', label: t.zakat, icon: Calculator, roles: ['admin'] },
    { id: 'reports', label: t.reports, icon: BarChart3, roles: ['admin'] },
    { id: 'settings', label: t.settings, icon: Settings, roles: ['admin'] },
  ];

  useEffect(() => {
    if (settings?.isKioskMode && !isKioskUnlocked) {
      setActiveView('sales');
    }
  }, [settings?.isKioskMode, isKioskUnlocked]);

  const handleUnlockKiosk = async () => {
    const admin = await db.users.where('role').equals('admin').first();
    if (!admin) {
      toast.error('No admin found');
      return;
    }

    const { hashPin } = await import('./lib/security');
    const hashedInput = await hashPin(pinInput);
    
    if (hashedInput === admin.pin) {
      setIsKioskUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      toast.success('Admin access granted');
    } else {
      toast.error('Incorrect PIN');
    }
  };

  const handleBiometricUnlock = async () => {
    const supported = await isBiometricsSupported;
    if (!supported) return;

    try {
      const users = await db.users.toArray();
      const adminsWithBiometrics = users.filter(u => u.role === 'admin' && u.biometricCredentials?.length);
      
      if (adminsWithBiometrics.length === 0) {
        toast.error('No admin biometrics registered');
        return;
      }

      const allCredentialIds = adminsWithBiometrics.flatMap(u => u.biometricCredentials!.map(c => c.id));
      const credentialId = await authenticateBiometrics(allCredentialIds);
      const user = adminsWithBiometrics.find(u => u.biometricCredentials!.some(c => c.id === credentialId));
      
      if (user) {
        setIsKioskUnlocked(true);
        setShowPinModal(false);
        toast.success(`Unlocked by ${user.name}`);
      }
    } catch (error: any) {
      if (error.name !== 'NotAllowedError') {
        toast.error('Biometric authentication failed');
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const isKioskActive = settings?.isKioskMode && !isKioskUnlocked;

  const filteredNavItems = navItems.filter(item => {
    if (!currentUser) return false;
    if (!item.roles.includes(currentUser.role)) return false;
    if (isKioskActive && item.id !== 'sales') return false;
    
    if (item.id === 'products' && settings?.showProducts === false) return false;
    if (item.id === 'services' && settings?.showServices === false) return false;
    
    return true;
  });

  const handleSwipe = (direction: 'left' | 'right') => {
    const currentIndex = filteredNavItems.findIndex(item => item.id === activeView);
    if (currentIndex === -1) return;

    if (direction === 'left') {
      const nextIndex = (currentIndex + 1) % filteredNavItems.length;
      setActiveView(filteredNavItems[nextIndex].id);
    } else {
      const prevIndex = (currentIndex - 1 + filteredNavItems.length) % filteredNavItems.length;
      setActiveView(filteredNavItems[prevIndex].id);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard currentUser={currentUser!} onViewAllTransactions={() => setActiveView('transactions')} />;
      case 'services': return <Services />;
      case 'products': return <Products />;
      case 'staff': return <Staff />;
      case 'schedules': return <Schedules currentUser={currentUser!} />;
      case 'attendance': return <Attendance currentUser={currentUser!} />;
      case 'expenses': return <Expenses />;
      case 'accounts': return <Accounts />;
      case 'business-calendar': return <BusinessCalendar />;
      case 'sales': return <Sales currentUser={currentUser!} />;
      case 'transactions': return <Transactions />;
      case 'learn': return <Learn />;
      case 'zakat': return <Zakat />;
      case 'reports': return <Reports />;
      case 'settings': return <SettingsView currentUser={currentUser!} />;
      default: return <Dashboard currentUser={currentUser!} />;
    }
  };

  const handleLogout = async () => {
    try {
      setCurrentUser(null);
      setActiveView('dashboard');
      toast.info('Signed out');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const handleLock = () => {
    setCurrentUser(null);
    toast.info('Sales Locked');
  };

  if (!currentUser) {
    return (
      <div className="transition-colors duration-300">
        <Toaster position="bottom-right" theme={isDarkMode ? 'dark' : 'light'} />
        <Login onLogin={setCurrentUser} />
      </div>
    );
  }

  return (
    <div ref={dragConstraintsRef} className={`flex h-screen ${isDarkMode ? 'dark' : ''} bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors duration-300`}>
      <Toaster position="bottom-right" theme={isDarkMode ? 'dark' : 'light'} />
      
      {/* Mobile Action Drawer (Swipe down to reveal) */}
      <AnimatePresence>
        {showMobileActions && (
          <motion.div
            initial={{ y: -300 }}
            animate={{ y: 0 }}
            exit={{ y: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="lg:hidden fixed top-0 left-0 right-0 bg-white dark:bg-zinc-900 z-[60] p-6 border-b border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-b-[2.5rem]"
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Quick Actions</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">System Controls</p>
                </div>
                <button 
                  onClick={() => setShowMobileActions(false)}
                  className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    handleLock();
                    setShowMobileActions(false);
                  }}
                  className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl gap-3 border border-zinc-100 dark:border-zinc-800 active:scale-95 transition-all group"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Lock size={28} />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Lock Screen</span>
                </button>
                
                <button 
                  onClick={() => {
                    handleLogout();
                    setShowMobileActions(false);
                  }}
                  className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl gap-3 border border-zinc-100 dark:border-zinc-800 active:scale-95 transition-all group"
                >
                  <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                    <LogOut size={28} />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Sign Out</span>
                </button>
              </div>

              <div className="flex items-center justify-center pt-2">
                <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      {!isKioskActive && (
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 280 : 80 }}
          className="hidden lg:flex bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col z-20 transition-colors duration-300"
        >
          <div className="p-6 flex items-center justify-between">
            <AnimatePresence mode="wait">
              {isSidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="truncate"
                >
                  <LogoFull color="var(--primary-color)" name={settings?.storeName} />
                </motion.div>
              )}
            </AnimatePresence>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar py-4">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 ${
                  activeView === item.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary-light' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <item.icon size={22} className={isSidebarOpen ? 'mr-3' : 'mx-auto'} />
                {isSidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <button 
              onClick={handleLock}
              className="w-full flex items-center p-3 text-zinc-500 dark:text-zinc-400 hover:text-primary transition-colors"
            >
              <Lock size={22} className={isSidebarOpen ? 'mr-3' : 'mx-auto'} />
              {isSidebarOpen && <span className="font-medium">Lock Screen</span>}
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center p-3 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={22} className={isSidebarOpen ? 'mr-3' : 'mx-auto'} />
              {isSidebarOpen && <span className="font-medium">Sign Out</span>}
            </button>
          </div>
        </motion.aside>
      )}

      {/* Mobile Bottom Nav */}
      {!isKioskActive && (
        <nav 
          ref={navRef}
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-2 py-1 flex overflow-x-auto no-scrollbar items-center z-50 pb-safe transition-colors duration-300 scroll-smooth"
        >
          <div className="flex min-w-full justify-around items-center gap-1 px-2">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                data-active={activeView === item.id}
                className={`flex flex-col items-center p-2 rounded-xl transition-all min-w-[64px] flex-shrink-0 ${
                  activeView === item.id ? 'text-primary bg-primary/5' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <item.icon size={20} className={activeView === item.id ? 'scale-110' : ''} />
                <span className={`text-[9px] font-bold mt-1 uppercase tracking-tighter ${activeView === item.id ? 'opacity-100' : 'opacity-70'}`}>
                  {item.label.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0 relative">
        <motion.header 
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_e, info) => {
            if (info.offset.y > 80) {
              setShowMobileActions(true);
            }
          }}
          className="h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 transition-colors duration-300 touch-none"
        >
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo className="w-8 h-8" color="var(--primary-color)" />
            </div>
            <h2 className="text-base lg:text-lg font-bold text-zinc-800 dark:text-zinc-100 capitalize">
              {activeView.replace('-', ' ')}
            </h2>
          </div>
          <div className="flex flex-col items-center lg:hidden absolute left-1/2 -translate-x-1/2 top-1.5">
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
            <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-600 uppercase mt-1 tracking-widest">Pull for Actions</span>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            {isKioskActive ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleFullscreen}
                  className="p-2 text-zinc-500 hover:text-primary transition-colors"
                  title="Toggle Fullscreen"
                >
                  <LayoutDashboard size={20} />
                </button>
                <button 
                  onClick={() => setShowPinModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-xs hover:bg-primary hover:text-white transition-all"
                >
                  <Lock size={14} />
                  Unlock Admin
                </button>
              </div>
            ) : (
              <button 
                onClick={toggleFullscreen}
                className="p-2 text-zinc-500 hover:text-primary transition-colors"
                title="Toggle Fullscreen"
              >
                <LayoutDashboard size={20} />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold border border-primary/20 text-primary">
              {currentUser.name?.split(' ').map(n => n[0]).join('') || '??'}
            </div>
          </div>
        </motion.header>
        
        <div className={`${isKioskActive ? 'p-0 lg:p-0 max-w-none' : 'p-4 lg:p-8 max-w-7xl'} mx-auto`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (window.innerWidth >= 1024) return;
                const threshold = 100;
                const velocity = 500;
                if (info.offset.x < -threshold || info.velocity.x < -velocity) {
                  handleSwipe('left');
                } else if (info.offset.x > threshold || info.velocity.x > velocity) {
                  handleSwipe('right');
                }
              }}
              className="min-h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pin Modal for Kiosk Unlock */}
        {showPinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xs text-center space-y-6"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto">
                <Lock size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Admin Access</h3>
                <p className="text-xs text-zinc-500">Enter Admin PIN to unlock navigation</p>
              </div>
              <input 
                type="password"
                autoFocus
                className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUnlockKiosk()}
              />
              <div className="flex gap-3">
                <button 
                  onClick={handleUnlockKiosk}
                  className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl hover:brightness-110 transition-all"
                >
                  Unlock
                </button>
                {isBiometricsSupported && (
                  <button 
                    onClick={handleBiometricUnlock}
                    className="p-4 bg-zinc-100 dark:bg-zinc-800 text-primary rounded-2xl hover:bg-primary hover:text-white transition-all"
                    title="Unlock with Biometrics"
                  >
                    <Fingerprint size={24} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput('');
                  }}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold rounded-2xl"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Floating Sales Button */}
        <AnimatePresence>
          {activeView !== 'sales' && (
            <motion.button
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0, y: 20 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              drag
              dragConstraints={dragConstraintsRef}
              dragElastic={0.1}
              dragMomentum={false}
              onClick={() => setActiveView('sales')}
              className="fixed bottom-24 lg:bottom-8 right-6 lg:right-8 w-14 h-14 lg:w-16 lg:h-16 bg-primary text-white rounded-full shadow-2xl shadow-primary-light flex items-center justify-center z-40 group transition-all touch-none"
              title="Open Point of Sale"
            >
              <ShoppingCart size={24} className="lg:w-7 lg:h-7" />
              <span className="absolute right-full mr-3 px-3 py-1.5 bg-zinc-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                Open Sales
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        {!isKioskActive && <EmaanPopup />}
        {!isKioskActive && <DonationPopup />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
