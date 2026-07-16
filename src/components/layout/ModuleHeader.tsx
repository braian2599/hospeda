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
  iconBg,
  iconColor,
  children,
}: ModuleHeaderProps) {
  // Convert bg-blue-600 → text-blue-600 for inline icon coloring
  const derivedColor = iconBg ? iconBg.replace('bg-', 'text-') : undefined;
  const textColor = iconColor || derivedColor || 'text-slate-500 dark:text-slate-400';

  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <Icon className={`w-6 h-6 shrink-0 ${textColor}`} />
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}