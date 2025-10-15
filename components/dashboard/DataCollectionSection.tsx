'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataCollectionSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'not_started' | 'in_progress' | 'completed';
  onStart: () => void;
  onEdit?: () => void;
  children?: React.ReactNode;
  isExpanded?: boolean;
  completedAt?: string;
}

export default function DataCollectionSection({
  title,
  description,
  icon,
  status,
  onStart,
  onEdit,
  children,
  isExpanded: initialExpanded = false,
  completedAt
}: DataCollectionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded || status !== 'completed');

  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle className="w-5 h-5 text-[#7ED957]" />,
          text: 'הושלם',
          color: 'text-[#7ED957]',
          bgColor: 'bg-[#E8F5E9]',
          borderColor: 'border-[#7ED957]'
        };
      case 'in_progress':
        return {
          icon: <Clock className="w-5 h-5 text-[#F6A623]" />,
          text: 'בתהליך',
          color: 'text-[#F6A623]',
          bgColor: 'bg-[#FFF3E0]',
          borderColor: 'border-[#F6A623]'
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5 text-[#888888]" />,
          text: 'לא התחיל',
          color: 'text-[#888888]',
          bgColor: 'bg-[#F5F6F8]',
          borderColor: 'border-gray-300'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className={`bg-white rounded-xl border-2 ${statusConfig.borderColor} shadow-sm transition-all hover:shadow-md`}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Icon */}
            <div className={`w-12 h-12 rounded-full ${statusConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
              {icon}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-bold text-[#1E2A3B]">{title}</h3>
                <div className="flex items-center gap-1.5">
                  {statusConfig.icon}
                  <span className={`text-sm font-medium ${statusConfig.color}`}>
                    {statusConfig.text}
                  </span>
                </div>
              </div>
              <p className="text-sm text-[#555555]">{description}</p>
              {completedAt && status === 'completed' && (
                <p className="text-xs text-[#888888] mt-1">
                  הושלם ב-{new Date(completedAt).toLocaleDateString('he-IL')}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mr-4">
            {status === 'not_started' && (
              <Button
                onClick={onStart}
                className="bg-[#3A7BD5] hover:bg-[#2E5EA5] text-white"
              >
                התחל
              </Button>
            )}
            {status === 'in_progress' && (
              <Button
                onClick={onStart}
                variant="outline"
                className="border-[#F6A623] text-[#F6A623] hover:bg-[#FFF3E0]"
              >
                המשך
              </Button>
            )}
            {status === 'completed' && onEdit && (
              <Button
                onClick={onEdit}
                variant="outline"
                className="border-[#7ED957] text-[#7ED957] hover:bg-[#E8F5E9]"
              >
                ערוך
              </Button>
            )}
            
            {/* Expand/Collapse button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-[#888888]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#888888]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && children && (
        <div className="border-t border-gray-200 p-6">
          {children}
        </div>
      )}
    </div>
  );
}

