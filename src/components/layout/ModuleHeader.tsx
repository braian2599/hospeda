'use client';

import { type LucideIcon } from 'lucide-react';

interface ModuleHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  iconBg?: string;
  iconColor?: string;
  children?: React.ReactNode;
}

export default function ModuleHeader({ icon: Icon, title, subtitle, iconBg, iconColor, children }: ModuleHeaderProps) {
  const textColor = iconColor || 'text-primary';
  const bgColor = iconBg || 'bg-primary/20';

  return (
    <div className="flex items-start justify-between gap-4 mb-6 px-4 py-3 -mx-4 -mt-1 rounded-xl">
      <div className="flex items-center gap-3.5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bgColor} shadow-sm`}>
          <Icon className={`w-5 h-5 shrink-0 ${textColor}`} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-slate-300 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
