import React, { useState, useEffect } from 'react';
import { db, User } from '../db';
import { Lock, User as UserIcon, ArrowRight, Eye, EyeOff, AlertCircle, Fingerprint } from 'lucide-react';
import { Logo } from './Logo';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { hashPin, SECURITY_CONFIG } from '../lib/security';
import { authenticateBiometrics, isWebAuthnSupported } from '../lib/webauthn';
import { useLanguage } from '../contexts/LanguageContext';

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useLanguage();
  const users = useLiveQuery(() => db.users.toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(true); // Default to true as requested previously, but now with a toggle
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isWebAuthnSupported();
      setIsBiometricsSupported(supported);
    };
    checkSupport();
  }, []);

  useEffect(() => {
    const checkLockout = () => {
      const storedLockout = localStorage.getItem('login_lockout');
      if (storedLockout) {
        const until = parseInt(storedLockout);
        if (until > Date.now()) {
          setLockoutTime(until);
        } else {
          localStorage.removeItem('login_lockout');
          setLockoutTime(null);
        }
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || lockoutTime) return;

    setLoading(true);
    try {
      const hashedPin = await hashPin(pin);
      const user = users.find(u => u.pin === hashedPin);
      
      if (user) {
        // Check if user is individually locked out (if we implement per-user lockout)
        if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
          const remaining = Math.ceil((user.lockoutUntil - Date.now()) / 1000);
          toast.error(`Account locked. Try again in ${remaining}s`);
          setPin('');
          return;
        }

        // Success: Reset failed attempts
        if (user.id) {
          await db.users.update(user.id, { failedAttempts: 0, lockoutUntil: 0 });
        }
        onLogin(user);
        toast.success(`Welcome back, ${user.name}!`);
      } else {
        // Failure: Increment failed attempts for ALL users or just track globally for simplicity in this POS
        const attempts = parseInt(localStorage.getItem('failed_attempts') || '0') + 1;
        localStorage.setItem('failed_attempts', attempts.toString());

        if (attempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
          const until = Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MS;
          localStorage.setItem('login_lockout', until.toString());
          localStorage.setItem('failed_attempts', '0');
          setLockoutTime(until);
          toast.error('Too many failed attempts. System locked for 30s.');
        } else {
          toast.error(`Invalid PIN. ${SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - attempts} attempts remaining.`);
        }
        setPin('');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const addDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const removeDigit = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleBiometricLogin = async () => {
    if (!isBiometricsSupported) {
      toast.error('Biometric authentication is not supported on this device');
      return;
    }

    const usersWithBiometrics = users.filter(u => u.biometricCredentials && u.biometricCredentials.length > 0);
    if (usersWithBiometrics.length === 0) {
      toast.error('No biometrics registered. Login with PIN and register in Settings.');
      return;
    }

    const allCredentialIds = usersWithBiometrics.flatMap(u => u.biometricCredentials!.map(c => c.id));

    try {
      const credentialId = await authenticateBiometrics(allCredentialIds);
      const user = usersWithBiometrics.find(u => u.biometricCredentials!.some(c => c.id === credentialId));
      
      if (user) {
        onLogin(user);
        toast.success(`Welcome back, ${user.name}!`);
      } else {
        toast.error('Authentication failed');
      }
    } catch (error: any) {
      console.error('Biometric login failed:', error);
      if (error.name !== 'NotAllowedError') {
        toast.error('Biometric authentication failed');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <div className="p-8 lg:p-12">
          <div className="flex justify-center mb-8">
            <Logo className="w-20 h-20" color="var(--primary-color)" />
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 mb-2">{settings?.storeName || 'Yusra Sales'}</h1>
            <p className="text-zinc-500 dark:text-zinc-400">{t.loginSubtitle}</p>
            <p className="text-[10px] font-bold text-primary mt-2 uppercase tracking-widest">{t.defaultPin}: 1234</p>
          </div>

          <AnimatePresence>
            {lockoutTime && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400"
              >
                <AlertCircle size={20} />
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider">System Locked</p>
                  <p className="text-[10px] opacity-80">Try again in {Math.ceil((lockoutTime - Date.now()) / 1000)} seconds</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative mb-10">
            <div className="flex justify-center gap-3">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-12 h-16 rounded-2xl flex items-center justify-center text-2xl font-black transition-all border-2 ${
                    pin[i] 
                      ? 'bg-primary/5 border-primary text-primary shadow-lg shadow-primary-light' 
                      : 'bg-zinc-50 dark:bg-zinc-800 border-transparent text-zinc-300 dark:text-zinc-700'
                  }`}
                >
                  {pin[i] ? (showPin ? pin[i] : '•') : ''}
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowPin(!showPin)}
              className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
              <button
                key={digit}
                onClick={() => addDigit(digit)}
                className="h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-2xl font-black text-zinc-900 dark:text-zinc-100 hover:bg-primary hover:text-white transition-all active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={removeDigit}
              className="h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-lg font-bold text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all active:scale-95"
            >
              Clear
            </button>
            <button
              onClick={() => addDigit('0')}
              className="h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-2xl font-black text-zinc-900 dark:text-zinc-100 hover:bg-primary hover:text-white transition-all active:scale-95"
            >
              0
            </button>
            <button
              onClick={handleLogin}
              disabled={pin.length < 4 || loading || !!lockoutTime}
              className="h-16 rounded-2xl bg-primary text-white flex items-center justify-center hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              <ArrowRight size={28} />
            </button>
          </div>

          {isBiometricsSupported && users.some(u => u.biometricCredentials?.length) && (
            <div className="mt-4">
              <button
                onClick={handleBiometricLogin}
                className="w-full h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold flex items-center justify-center gap-3 hover:bg-primary hover:text-white transition-all active:scale-95"
              >
                <Fingerprint size={24} />
                Login with Biometrics
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
