import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Quote, Heart, ShieldCheck, Scale } from 'lucide-react';

interface Narration {
  text: string;
  source: string;
  type: 'quran' | 'hadith';
}

const narrations: Narration[] = [
  {
    text: "The truthful, trustworthy merchant is with the Prophets, the truthful, and the martyrs.",
    source: "Jami` at-Tirmidhi 1209",
    type: 'hadith'
  },
  {
    text: "May Allah have mercy on a man who is lenient when he sells, lenient when he buys, and lenient when he demands his money back.",
    source: "Sahih al-Bukhari 2076",
    type: 'hadith'
  },
  {
    text: "And give full measure when you measure, and weigh with an even balance. That is the best [way] and best in result.",
    source: "Surah Al-Isra 17:35",
    type: 'quran'
  },
  {
    text: "Woe to those who give less [than due], Who, when they take a measure from people, take in full. But if they give by measure or by weight to them, they cause loss.",
    source: "Surah Al-Mutaffifin 83:1-3",
    type: 'quran'
  },
  {
    text: "The seller and the buyer have the right to keep or return goods as long as they have not parted... if both parties spoke the truth and were clear, they will be blessed in their transaction.",
    source: "Sahih al-Bukhari 2079",
    type: 'hadith'
  },
  {
    text: "O you who have believed, do not consume one another's wealth unjustly but only [in business by] mutual consent among you.",
    source: "Surah An-Nisa 4:29",
    type: 'quran'
  },
  {
    text: "He who cheats is not of me.",
    source: "Sahih Muslim 101",
    type: 'hadith'
  },
  {
    text: "Allah has revealed to me that you should be humble so that no one boasts over another and no one oppresses another.",
    source: "Sahih Muslim 2865",
    type: 'hadith'
  },
  {
    text: "No one humbles himself for the sake of Allah but that Allah raises his status.",
    source: "Sahih Muslim 2588",
    type: 'hadith'
  },
  {
    text: "And the servants of the Most Merciful are those who walk upon the earth easily, and when the ignorant address them [harshly], they say [words of] peace.",
    source: "Surah Al-Furqan 25:63",
    type: 'quran'
  },
  {
    text: "Has the time not come for those who have believed that their hearts should become humbly submissive at the remembrance of Allah and what has come down of the truth?",
    source: "Surah Al-Hadid 57:16",
    type: 'quran'
  },
  {
    text: "And there is no creature on earth but that upon Allah is its provision, and He knows its place of dwelling and its place of storage.",
    source: "Surah Hud 11:6",
    type: 'quran'
  },
  {
    text: "And whoever fears Allah - He will make for him a way out. And will provide for him from where he does not expect.",
    source: "Surah At-Talaq 65:2-3",
    type: 'quran'
  },
  {
    text: "If you were to rely upon Allah with the reliance He is due, He would provide for you just as He provides for the birds; they go out in the morning with empty stomachs and return full.",
    source: "Jami` at-Tirmidhi 2344",
    type: 'hadith'
  },
  {
    text: "Know that if the nation were to gather together to benefit you with anything, they would not benefit you except with what Allah had already prescribed for you.",
    source: "Jami` at-Tirmidhi 2516",
    type: 'hadith'
  },
  {
    text: "No soul will die until it has received its provision in full, so fear Allah and be moderate in seeking it.",
    source: "Sunan Ibn Majah 2144",
    type: 'hadith'
  }
];

export default function EmaanPopup() {
  const [currentNarration, setCurrentNarration] = useState<Narration | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showRandomNarration = () => {
    const randomIndex = Math.floor(Math.random() * narrations.length);
    setCurrentNarration(narrations[randomIndex]);
    setIsVisible(true);
  };

  useEffect(() => {
    // Show one shortly after app load (which happens after login)
    const timer = setTimeout(() => {
      showRandomNarration();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && currentNarration && (
        <div key="emaan-popup-overlay" className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-zinc-200 dark:border-zinc-800 p-8 lg:p-10 pointer-events-auto relative overflow-hidden"
          >
            {/* Decorative Background Elements */}
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
                {currentNarration.type === 'quran' ? <Scale size={32} /> : <ShieldCheck size={32} />}
              </div>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <Quote size={24} className="text-primary/20 rotate-180" />
                </div>
                
                <h3 className="text-lg lg:text-xl font-serif italic text-zinc-900 dark:text-zinc-100 leading-relaxed">
                  "{currentNarration.text}"
                </h3>

                <div className="flex items-center justify-center gap-2 pt-2">
                  <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    {currentNarration.source}
                  </span>
                  <div className="h-px w-8 bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>

              <button
                onClick={() => setIsVisible(false)}
                className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-zinc-200 dark:shadow-none"
              >
                May Allah Guide Us
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
