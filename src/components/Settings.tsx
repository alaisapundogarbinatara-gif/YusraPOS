import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Settings as SettingsIcon, 
  Store, 
  Palette, 
  Save,
  Package,
  RefreshCw,
  Users as UsersIcon,
  Plus,
  Trash2,
  Shield,
  Key,
  AlertTriangle,
  RotateCcw,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  Fingerprint,
  ScanFace,
  X
} from 'lucide-react';
import { db, User, Staff, clearAllTransactions, resetAllData, exportData, importData } from '../db';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { hashPin } from '../lib/security';
import { registerBiometrics, isWebAuthnSupported } from '../lib/webauthn';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../lib/translations';
import { downloadFile } from '../lib/download';

export default function Settings({ currentUser }: { currentUser: User }) {
  const { t, language: currentLang, setLanguage } = useLanguage();
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  
  const [storeName, setStoreName] = useState('');
  const [storeLogo, setStoreLogo] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#f97316');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [showProducts, setShowProducts] = useState(true);
  const [showServices, setShowServices] = useState(true);
  const [language, setLanguageState] = useState<Language>('en');

  // PIN Verification State
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinAction, setPinAction] = useState<'clear' | 'import' | 'reset' | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [importJson, setImportJson] = useState<string | null>(null);

  // New Staff State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'admin' | 'cashier' | 'staff'>('cashier');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // Edit Staff State
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editPinValue, setEditPinValue] = useState('');

  useEffect(() => {
    if (settings) {
      setStoreName(settings.storeName || '');
      setStoreLogo(settings.storeLogo || '');
      setStoreAddress(settings.storeAddress || '');
      setStorePhone(settings.storePhone || '');
      setPrimaryColor(settings.primaryColor || '#f97316');
      setIsKioskMode(settings.isKioskMode || false);
      setShowProducts(settings.showProducts !== false);
      setShowServices(settings.showServices !== false);
      setLanguageState(settings.language || 'en');
    }
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
        toast.error('Image is too large. Please select an image under 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setStoreLogo(reader.result as string);
        toast.success('Logo uploaded successfully');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const updateData = { 
        storeName, 
        storeLogo, 
        storeAddress, 
        storePhone, 
        primaryColor,
        isKioskMode,
        showProducts,
        showServices,
        language,
        currency: settings?.currency || 'PHP'
      };
      
      if (settings?.id) {
        await db.settings.update(settings.id, updateData);
      } else {
        await db.settings.add(updateData);
      }
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffName || newStaffPin.length < 4) {
      toast.error('Please provide a name and a 4-digit PIN');
      return;
    }

    try {
      const hashedPin = await hashPin(newStaffPin);
      const userData: any = {
        name: newStaffName,
        pin: hashedPin,
        role: newStaffRole,
        createdAt: Date.now()
      };
      
      if (newStaffRole === 'staff' && selectedStaffId) {
        userData.staffId = selectedStaffId;
      }
      
      await db.users.add(userData as any);
      
      setNewStaffName('');
      setNewStaffPin('');
      setSelectedStaffId(null);
      toast.success('Staff member added');
    } catch (error) {
      toast.error('Failed to add staff member');
    }
  };

  const handleDeleteStaff = async (id: number) => {
    if (users.length <= 1) {
      toast.error('Cannot delete the last user');
      return;
    }
    try {
      await db.users.delete(id);
      toast.success('Staff member removed');
    } catch (error) {
      toast.error('Failed to remove staff');
    }
  };

  const handleUpdatePin = async (id: number) => {
    if (editPinValue.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    try {
      const hashedPin = await hashPin(editPinValue);
      await db.users.update(id, { pin: hashedPin });
      setEditingUserId(null);
      setEditPinValue('');
      toast.success('PIN updated');
    } catch (error) {
      toast.error('Failed to update PIN');
    }
  };

  const handleRegisterBiometrics = async (user: User) => {
    const supported = await isWebAuthnSupported();
    if (!supported) {
      toast.error('Biometric authentication is not supported on this device or browser.');
      return;
    }

    try {
      const credential = await registerBiometrics(user.name);
      const existingCredentials = user.biometricCredentials || [];
      
      await db.users.update(user.id!, {
        biometricCredentials: [...existingCredentials, {
          ...credential,
          counter: 0,
          createdAt: Date.now()
        }]
      });
      
      toast.success('Biometrics registered successfully!');
    } catch (error: any) {
      console.error('Biometric registration failed:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Registration cancelled or timed out.');
      } else if (error.name === 'SecurityError') {
        toast.error('Security error: Biometrics might be blocked in this view. Try opening the app in a new tab.');
      } else {
        toast.error(`Failed to register biometrics: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleRemoveBiometrics = async (user: User) => {
    try {
      await db.users.update(user.id!, { biometricCredentials: [] });
      toast.success('Biometrics removed');
    } catch (error) {
      toast.error('Failed to remove biometrics');
    }
  };

  const handleClearData = () => {
    if (currentUser.role !== 'admin') {
      toast.error('Only admins can clear records');
      return;
    }
    setPinAction('clear');
    setIsVerifyingPin(true);
    setPinInput('');
  };

  const handleResetData = () => {
    if (currentUser.role !== 'admin') {
      toast.error('Only admins can reset the system');
      return;
    }
    setPinAction('reset');
    setIsVerifyingPin(true);
    setPinInput('');
  };

  const handleExport = async () => {
    try {
      const json = await exportData();
      const fileName = `sales-backup-${new Date().toISOString().split('T')[0]}.json`;
      await downloadFile(json, fileName, 'application/json');
      toast.success('Backup file downloaded');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const handleImportClick = () => {
    if (currentUser.role !== 'admin') {
      toast.error('Only admins can import data');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setImportJson(content);
          setPinAction('import');
          setIsVerifyingPin(true);
          setPinInput('');
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const verifyAndExecute = async () => {
    const hashedInput = await hashPin(pinInput);
    if (hashedInput !== currentUser.pin) {
      toast.error('Incorrect PIN');
      return;
    }

    try {
      if (pinAction === 'clear') {
        await clearAllTransactions();
        toast.success('All transaction and appointment records have been cleared');
      } else if (pinAction === 'reset') {
        await resetAllData();
        toast.success('All data has been reset. The app will refresh.');
        setTimeout(() => window.location.reload(), 1500);
      } else if (pinAction === 'import' && importJson) {
        await importData(importJson);
        toast.success('Data imported successfully. The app will refresh.');
        setTimeout(() => window.location.reload(), 1500);
      }
      setIsVerifyingPin(false);
      setPinAction(null);
      setPinInput('');
      setImportJson(null);
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const themes = [
    { name: 'Orange (Default)', color: '#f97316' },
    { name: 'Blue', color: '#2563eb' },
    { name: 'Green', color: '#16a34a' },
    { name: 'Purple', color: '#9333ea' },
    { name: 'Red', color: '#dc2626' },
    { name: 'Zinc', color: '#18181b' },
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
          <Store className="text-zinc-400 dark:text-zinc-500" size={24} />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">General Settings</h3>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">{t.storeName}</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all font-bold text-zinc-900 dark:text-zinc-100"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Enter store name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">{t.language}</label>
              <select 
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm font-bold"
                value={language}
                onChange={(e) => setLanguageState(e.target.value as Language)}
              >
                <option value="en">English (Primary)</option>
                <option value="ar">Arabic (Standard)</option>
                <option value="tl">Tagalog (Simple Filipino)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">{t.storePhone}</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                placeholder="+63 912 345 6789"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">{t.currency}</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm font-bold"
                value={settings?.currency || 'PHP'}
                disabled
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Store Logo</label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0">
                {storeLogo ? (
                  <img src={storeLogo} className="w-full h-full object-cover" alt="Store Logo" />
                ) : (
                  <Store className="text-zinc-300" size={32} />
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm"
                    value={storeLogo}
                    onChange={(e) => setStoreLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <label className="flex items-center justify-center px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-zinc-600 dark:text-zinc-400">
                    <Upload size={20} />
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-zinc-500 italic">Provide a URL or upload an image from your device (Max 1MB).</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Store Address</label>
            <textarea 
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm min-h-[100px]"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              placeholder="Enter full store address"
            />
          </div>

          <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Shield size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Kiosk Mode (Lock Navigation)</h4>
                  <p className="text-[10px] text-zinc-500">Restricts app to Sales only. Requires Admin PIN to unlock.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsKioskMode(!isKioskMode)}
                className={`w-12 h-6 rounded-full transition-all relative ${isKioskMode ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isKioskMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
          <SettingsIcon className="text-zinc-400 dark:text-zinc-500" size={24} />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Feature Management</h3>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Package size={20} />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Products Module</h4>
                <p className="text-[10px] text-zinc-500">Enable or disable product inventory and sales.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                if (showProducts && !showServices) {
                  toast.error('Cannot disable both Products and Services');
                  return;
                }
                setShowProducts(!showProducts);
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${showProducts ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showProducts ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Store size={20} />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Services Module</h4>
                <p className="text-[10px] text-zinc-500">Enable or disable service management and appointments.</p>
              </div>
            </div>
            <button 
              onClick={() => {
                if (showServices && !showProducts) {
                  toast.error('Cannot disable both Products and Services');
                  return;
                }
                setShowServices(!showServices);
              }}
              className={`w-12 h-6 rounded-full transition-all relative ${showServices ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${showServices ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
          <Palette className="text-zinc-400 dark:text-zinc-500" size={24} />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Appearance & Theme</h3>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Primary Color Theme</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {themes.map((theme) => (
                <button
                  key={theme.color}
                  onClick={() => setPrimaryColor(theme.color)}
                  className={`aspect-square rounded-2xl border-4 transition-all flex items-center justify-center ${
                    primaryColor === theme.color ? 'border-zinc-900 dark:border-zinc-100 scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: theme.color }}
                  title={theme.name}
                >
                  {primaryColor === theme.color && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Custom Hex Color</label>
            <div className="flex gap-4">
              <input 
                type="color" 
                className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
              <input 
                type="text" 
                className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all font-mono text-zinc-900 dark:text-zinc-100"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
          <UsersIcon className="text-zinc-400 dark:text-zinc-500" size={24} />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Staff Management</h3>
        </div>
        <div className="p-8 space-y-8">
          {/* Add Staff Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm font-bold"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Staff Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PIN (4-6 digits)</label>
              <input 
                type="password" 
                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm font-bold"
                value={newStaffPin}
                onChange={(e) => setNewStaffPin(e.target.value)}
                placeholder="Enter PIN"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Role</label>
              <select 
                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm font-bold"
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as 'admin' | 'cashier' | 'staff')}
              >
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff (Provider)</option>
              </select>
            </div>
            {newStaffRole === 'staff' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Link to Staff Record</label>
                <select 
                  className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-light focus:border-primary outline-none transition-all text-sm font-bold"
                  value={selectedStaffId || ''}
                  onChange={(e) => setSelectedStaffId(parseInt(e.target.value) || null)}
                >
                  <option value="">Select Staff Record</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button 
                onClick={handleAddStaff}
                className="w-full py-2 bg-primary text-white rounded-xl hover:brightness-110 transition-all font-bold flex items-center justify-center gap-2"
              >
                <Plus size={20} /> Add User
              </button>
            </div>
          </div>

          {/* Staff List */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Active Staff</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map((user) => (
                <div key={user.id} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{user.name}</div>
                        <div className="flex items-center gap-1">
                          <Shield size={10} className={user.role === 'admin' ? 'text-primary' : 'text-zinc-400'} />
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">{user.role}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => {
                          setEditingUserId(user.id || null);
                          setEditPinValue('');
                        }}
                        className="p-2 text-zinc-400 hover:text-primary transition-colors"
                        title="Change PIN"
                      >
                        <Key size={18} />
                      </button>
                      <button 
                        onClick={() => handleRegisterBiometrics(user)}
                        className={`p-2 transition-colors ${user.biometricCredentials?.length ? 'text-green-500 hover:text-green-600' : 'text-zinc-400 hover:text-primary'}`}
                        title={user.biometricCredentials?.length ? 'Biometrics Registered (Click to add more)' : 'Register Biometrics (Fingerprint/Face)'}
                      >
                        <Fingerprint size={18} />
                      </button>
                      {user.biometricCredentials?.length ? (
                        <button 
                          onClick={() => handleRemoveBiometrics(user)}
                          className="p-2 text-red-400 hover:text-red-600 transition-colors"
                          title="Remove Biometrics"
                        >
                          <X size={18} />
                        </button>
                      ) : null}
                      <button 
                        onClick={() => user.id && handleDeleteStaff(user.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                        title="Delete Staff"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {editingUserId === user.id && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2"
                    >
                      <input 
                        type="password" 
                        placeholder="New PIN"
                        className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary-light outline-none"
                        value={editPinValue}
                        onChange={(e) => setEditPinValue(e.target.value)}
                      />
                      <button 
                        onClick={() => handleUpdatePin(user.id!)}
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:brightness-110"
                      >
                        Update
                      </button>
                      <button 
                        onClick={() => setEditingUserId(null)}
                        className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold rounded-xl"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-3 p-6 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
            >
              <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform">
                <Download size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Export Backup</div>
                <div className="text-xs text-zinc-500">Download all data as JSON</div>
              </div>
            </button>

            <button 
              onClick={handleImportClick}
              className="flex items-center justify-center gap-3 p-6 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group"
            >
              <div className="p-3 bg-green-500/10 rounded-xl text-green-500 group-hover:scale-110 transition-transform">
                <Upload size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-zinc-900 dark:text-zinc-100">Import Data</div>
                <div className="text-xs text-zinc-500">Restore from backup file</div>
              </div>
            </button>
          </div>
          <p className="text-xs text-zinc-500 italic">
            * Use Export to save your data before switching devices. Use Import on the new device to restore it.
          </p>
        </div>
      </div>

      <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-red-100 dark:border-red-900/30 flex items-center gap-3">
          <AlertTriangle className="text-red-500" size={24} />
          <h3 className="text-xl font-bold text-red-900 dark:text-red-400">Danger Zone</h3>
        </div>
        <div className="p-8 space-y-4">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Resetting transaction records will permanently delete all sales history, expenses, zakat calculations, and appointments. Products and staff members will be kept.
            <br /><br />
            Factory Reset will delete EVERYTHING (Products, Services, Staff, Transactions) except your Admin account and Settings.
          </p>
          
          <AnimatePresence mode="wait">
            {isVerifyingPin ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/50 space-y-4"
              >
                <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold">
                  <Shield size={18} className="text-primary" />
                  Confirm Admin PIN to {pinAction === 'clear' ? 'Clear Transactions' : pinAction === 'reset' ? 'Factory Reset' : 'Import Data'}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="password"
                    autoFocus
                    placeholder="Enter your PIN"
                    className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && verifyAndExecute()}
                  />
                  <button 
                    onClick={verifyAndExecute}
                    className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition-all"
                  >
                    Confirm
                  </button>
                  <button 
                    onClick={() => {
                      setIsVerifyingPin(false);
                      setPinAction(null);
                      setImportJson(null);
                    }}
                    className="px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={handleClearData}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  <RotateCcw size={18} />
                  Clear Transactions
                </button>
                <button 
                  onClick={handleResetData}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                >
                  <Trash2 size={18} />
                  Factory Reset
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:brightness-110 shadow-xl shadow-primary-light transition-all active:scale-95"
        >
          <Save size={20} />
          Save All Changes
        </button>
      </div>
    </div>
  );
}
