import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, Coffee, Sparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export default function DonationPopup() {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkDonationPrompt = () => {
      const lastShown = localStorage.getItem('donation_prompt_last_shown');
      const now = Date.now();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

      if (!lastShown || now - parseInt(lastShown) > ONE_WEEK_MS) {
        // Show after a short delay to not overwhelm the user immediately on login
        const timer = setTimeout(() => {
          setIsVisible(true);
          localStorage.setItem('donation_prompt_last_shown', now.toString());
        }, 10000); // 10 seconds after app load
        return () => clearTimeout(timer);
      }
    };

    checkDonationPrompt();
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-zinc-200 dark:border-zinc-800 p-8 lg:p-10 pointer-events-auto relative overflow-hidden"
          >
            {/* Decorative Accents */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />

            <button
              onClick={() => setIsVisible(false)}
              className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Heart size={32} fill="currentColor" className="opacity-20" />
                <Heart size={32} className="absolute" />
              </div>

              <div className="space-y-3">
                <h2 className="text-2xl lg:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Support {settings?.storeName || 'Yusra Sales'}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                  If you find {settings?.storeName || 'Yusra Sales'} valuable for your business, consider supporting its continued development. Your contributions help us maintain and improve the platform for everyone.
                </p>
              </div>

              <div className="w-full max-w-[240px] aspect-square bg-zinc-50 dark:bg-zinc-800 rounded-3xl p-4 border border-zinc-100 dark:border-zinc-700 shadow-inner flex items-center justify-center relative group">
                <img 
                  src="/input_file_1.png" 
                  alt="Donation QR Code" 
                  className="w-full h-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-white/60 dark:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl backdrop-blur-[2px]">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-widest">Scan to Donate</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                  <Sparkles size={12} />
                  Every contribution matters
                  <Sparkles size={12} />
                </p>
                <p className="text-xs text-zinc-400 italic">
                  Jazaakumullahu khairal jazaa
                </p>
              </div>

              <button
                onClick={() => setIsVisible(false)}
                className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-zinc-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                <Coffee size={18} />
                Maybe Later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
