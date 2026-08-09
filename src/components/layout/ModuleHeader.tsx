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
  const textColor = iconColor || 'text-[#0F2B28]';
  const bgColor = iconBg || 'bg-[#0F2B28]/10';

  return (
    <div className="flex items-start justify-between gap-3 mb-6">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
          <Icon className={`w-5 h-5 shrink-0 ${textColor}`} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
