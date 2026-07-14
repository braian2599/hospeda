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

export default function ModuleHeader({
  icon: Icon,
  title,
  subtitle,
  iconBg = 'bg-slate-700 dark:bg-slate-600',
  iconColor = 'text-white',
  children,
}: ModuleHeaderProps) {
  return (
    <div className="rounded-2xl bg-slate-900 dark:bg-slate-950 px-6 py-8 mb-6">
      <div className="flex flex-col items-center gap-2">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shadow-lg`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      {children && (
        <div className="mt-4 flex justify-center">
          {children}
        </div>
      )}
    </div>
  );
}