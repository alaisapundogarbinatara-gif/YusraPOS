import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { translations, Language } from '../lib/translations';

interface LanguageContextType {
  language: Language;
  t: any;
  setLanguage: (lang: Language) => Promise<void>;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');

  useEffect(() => {
    if (settings?.language) {
      setCurrentLanguage(settings.language);
    }
  }, [settings?.language]);

  useEffect(() => {
    const isRTL = currentLanguage === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLanguage;
  }, [currentLanguage]);

  const setLanguage = async (lang: Language) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { language: lang });
    } else {
      await db.settings.add({ language: lang } as any);
    }
    setCurrentLanguage(lang);
  };

  const value = {
    language: currentLanguage,
    t: translations[currentLanguage],
    setLanguage,
    isRTL: currentLanguage === 'ar'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
