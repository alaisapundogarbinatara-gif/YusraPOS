import React from 'react';

export const Logo = ({ className = "w-10 h-10" }: { className?: string, color?: string }) => (
  <img 
    src="/input_file_0.png" 
    alt="Yusra Sales Logo" 
    className={`${className} rounded-2xl object-cover`}
    referrerPolicy="no-referrer"
  />
);

export const LogoFull = ({ className = "h-10", color = "currentColor", name = "Yusra Sales" }: { className?: string, color?: string, name?: string }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <Logo className="w-10 h-10" />
    <span className="font-black text-2xl tracking-tighter" style={{ color }}>
      {name}
    </span>
  </div>
);
