'use client';

import { LucideIcon } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  valueColor?: string;
  badge?: {
    text: string;
    color: string;
  };
  tooltip?: string;
  button?: {
    text: string;
    href: string;
    icon?: LucideIcon;
  };
  subtitle?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor,
  valueColor = 'text-gray-900 dark:text-white',
  badge,
  tooltip,
  button,
  subtitle,
}: KPICardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-4 border-phi-gold/40 rounded-2xl p-8 shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-6">
        {/* אייקון גדול יותר */}
        <div className={`w-16 h-16 rounded-2xl ${iconBgColor} flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
          <Icon className={`w-9 h-9 ${iconColor}`} strokeWidth={2.5} />
        </div>
        {badge && (
          <div className={`${badge.color} rounded-full h-8 px-4 flex items-center text-white font-bold text-base shadow-md`}>
            <span>{badge.text}</span>
          </div>
        )}
      </div>
      
      {/* כותרת גדולה וברורה */}
      <div className="flex items-center gap-3 mb-3">
        <p className="text-gray-900 dark:text-white text-xl font-bold">{title}</p>
        {tooltip && (
          <InfoTooltip content={tooltip} type="info" />
        )}
      </div>
      
      {/* סאב-כותרת גדולה יותר */}
      {subtitle && (
        <p className="text-base text-gray-700 dark:text-gray-300 mb-4 font-medium leading-relaxed">{subtitle}</p>
      )}
      
      {/* ערך ענק! */}
      <p className={`text-5xl font-black mb-6 ${valueColor} tracking-tight`}>
        {value}
      </p>
      
      {/* כפתור גדול */}
      {button && (
        <Link href={button.href} className="block">
          <Button 
            size="lg" 
            className="w-full text-lg font-bold bg-phi-gold hover:bg-phi-gold/90 text-white border-2 border-phi-gold shadow-lg hover:shadow-xl transition-all h-14"
          >
            {button.icon && <button.icon className="w-6 h-6 ml-2" strokeWidth={2.5} />}
            {button.text}
          </Button>
        </Link>
      )}
    </div>
  );
}

