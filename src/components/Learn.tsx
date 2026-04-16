import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertCircle,
  Info,
  Scale,
  ArrowLeft,
  PlayCircle,
  CheckCircle,
  Lock,
  BookMarked,
  GraduationCap,
  Quote
} from 'lucide-react';
import { db } from '../db';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../lib/translations';

export default function Learn() {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const lang: Language = settings?.language || 'en';
  const t = translations[lang];
  const sections = (t as any).learn_sections || [];

  // State to toggle between the course list and the active lesson
  const [view, setView] = useState<'list' | 'lesson'>('list');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Sync current lesson with saved progress on load
  useEffect(() => {
    if (settings?.learnProgress !== undefined) {
      const index = sections.findIndex((s: any) => s.id === settings.learnProgress);
      if (index !== -1) {
        setCurrentSectionIndex(index);
      }
    }
  }, [settings?.learnProgress, sections]);

  const handleNext = async () => {
    if (currentSectionIndex < sections.length - 1) {
      const nextIndex = currentSectionIndex + 1;
      setCurrentSectionIndex(nextIndex);
      // Save progress to database
      if (settings?.id) {
        await db.settings.update(settings.id, { learnProgress: sections[nextIndex].id });
      }
    } else {
      setView('list'); // Return to list if course is finished
    }
  };

  const handlePrev = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    }
  };

  const currentSection = sections[currentSectionIndex];
  const progressId = settings?.learnProgress || (sections[0]?.id || 0);
  const progressIndex = sections.findIndex((s: any) => s.id === progressId);

  const isRTL = lang === 'ar';

  if (view === 'lesson' && currentSection) {
    return (
      <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
        {/* Lesson Header */}
        <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <button 
            onClick={() => setView('list')}
            className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} className={isRTL ? 'rotate-180' : ''} />
            <span className="font-medium">{isRTL ? 'العودة للقائمة' : 'Back to List'}</span>
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-primary uppercase tracking-widest mb-0.5">
              {currentSection.category}
            </span>
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
              {currentSection.title}
            </h2>
          </div>

          <div className="text-sm font-mono text-zinc-400">
            {currentSectionIndex + 1} / {sections.length}
          </div>
        </div>

        {/* Lesson Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-10"
              >
                {/* Summary Card */}
                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                      <Info size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Summary</h3>
                      <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        {currentSection.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <p className="text-xl leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {currentSection.content}
                  </p>
                </div>

                {/* Practical Example */}
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-3xl p-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-2xl text-amber-600 dark:text-amber-400">
                      <Scale size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Practical Example</h3>
                      <p className="text-lg text-zinc-800 dark:text-zinc-200 leading-relaxed italic">
                        "{currentSection.example}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Evidence Section */}
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <BookMarked size={16} />
                    Authentic Evidence
                  </h3>
                  
                  <div className="grid gap-6">
                    {currentSection.quranRef && (
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Quote size={80} />
                        </div>
                        <div className="relative z-10">
                          <span className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-widest mb-4">
                            Quranic Verse
                          </span>
                          <p className={`text-2xl leading-loose text-zinc-900 dark:text-zinc-100 mb-4 ${isRTL ? 'font-amiri text-right' : 'font-serif italic'}`}>
                            {currentSection.quranRef}
                          </p>
                        </div>
                      </div>
                    )}

                    {currentSection.hadithRef && (
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Quote size={80} />
                        </div>
                        <div className="relative z-10">
                          <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded-full uppercase tracking-widest mb-4">
                            Sahih Hadith
                          </span>
                          <p className={`text-xl leading-relaxed text-zinc-800 dark:text-zinc-200 ${isRTL ? 'text-right' : 'italic'}`}>
                            {currentSection.hadithRef}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-6">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={handlePrev}
              disabled={currentSectionIndex === 0}
              className="flex-1 py-4 px-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold flex items-center justify-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={20} className={isRTL ? 'rotate-180' : ''} />
              <span>{isRTL ? 'السابق' : 'Previous'}</span>
            </button>
            
            <button
              onClick={handleNext}
              className="flex-[2] py-4 px-6 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-primary/20 transition-all"
            >
              <span>{currentSectionIndex === sections.length - 1 ? (isRTL ? 'إكمال الدورة' : 'Finish Course') : (isRTL ? 'الدرس التالي' : 'Next Lesson')}</span>
              <ChevronRight size={20} className={isRTL ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-primary">
              <div className="p-2 bg-primary/10 rounded-xl">
                <GraduationCap size={28} />
              </div>
              <span className="text-sm font-black uppercase tracking-[0.3em]">Curriculum</span>
            </div>
            <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
              {isRTL ? 'أخلاقيات العمل الإسلامي' : 'Islamic Business Ethics'}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-xl">
              {isRTL 
                ? 'تعلم المبادئ الأساسية للتمويل الإسلامي وأخلاقيات التجارة من خلال منهج شامل.'
                : 'Master the core principles of Islamic finance and trade ethics through a comprehensive curriculum.'}
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex items-center gap-6 shadow-sm">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-zinc-100 dark:text-zinc-800"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={175.9}
                  strokeDashoffset={175.9 * (1 - (progressIndex + 1) / sections.length)}
                  strokeLinecap="round"
                  className="text-primary transition-all duration-1000"
                />
              </svg>
              <span className="absolute text-xs font-black text-zinc-900 dark:text-zinc-100">
                {Math.round(((progressIndex + 1) / sections.length) * 100)}%
              </span>
            </div>
            <div>
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Overall Progress</div>
              <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                {progressIndex + 1} / {sections.length} Lessons
              </div>
            </div>
          </div>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section: any, index: number) => {
            const isCompleted = index < progressIndex;
            const isCurrent = index === progressIndex;
            const isLocked = index > progressIndex;

            return (
              <motion.button
                key={section.id}
                whileHover={!isLocked ? { y: -5 } : {}}
                onClick={() => {
                  if (!isLocked) {
                    setCurrentSectionIndex(index);
                    setView('lesson');
                  }
                }}
                disabled={isLocked}
                className={`
                  relative text-left p-8 rounded-[2.5rem] border transition-all duration-300 group
                  ${isCurrent 
                    ? 'bg-white dark:bg-zinc-900 border-primary shadow-xl shadow-primary/10 ring-4 ring-primary/5' 
                    : isCompleted
                    ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-80'
                    : 'bg-zinc-100/50 dark:bg-zinc-900/30 border-zinc-200/50 dark:border-zinc-800/50 opacity-60 grayscale cursor-not-allowed'}
                `}
              >
                {/* Status Badge */}
                <div className="absolute top-6 right-6">
                  {isCompleted ? (
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <CheckCircle size={20} />
                    </div>
                  ) : isCurrent ? (
                    <div className="p-2 bg-primary/10 text-primary rounded-xl animate-pulse">
                      <PlayCircle size={20} />
                    </div>
                  ) : (
                    <div className="p-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 rounded-xl">
                      <Lock size={20} />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                      isCurrent ? 'bg-primary/10 text-primary' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}>
                      {section.category}
                    </span>
                  </div>

                  <div>
                    <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${
                      isCurrent ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                    }`}>
                      {section.title}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {section.summary}
                    </p>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-400">Lesson {index + 1}</span>
                    {!isLocked && (
                      <div className={`p-2 rounded-full transition-transform group-hover:translate-x-1 ${
                        isCurrent ? 'bg-primary text-white' : 'text-zinc-400'
                      }`}>
                        <ChevronRight size={16} className={isRTL ? 'rotate-180' : ''} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
