'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataCollectionSectionProps {
  title: string;
  description: string;
  status: 'pending' | 'completed';
  onEdit: () => void;
  icon: React.ElementType;
}

export { DataCollectionSection };

function DataCollectionSection({ title, description, status, onEdit, icon: Icon }: DataCollectionSectionProps) {
  const isCompleted = status === 'completed';

  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 border-2 ${isCompleted ? 'border-phi-mint' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${isCompleted ? 'bg-green-50 text-phi-mint' : 'bg-gray-100 text-gray-500'}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#1E2A3B]">{title}</h3>
            <p className="text-sm text-[#555555] mt-1">{description}</p>
          </div>
        </div>
        {isCompleted && (
          <div className="flex items-center gap-2 text-phi-mint font-semibold">
            <CheckCircle className="w-5 h-5" />
            <span>הושלם</span>
          </div>
        )}
      </div>
      <div className="mt-6 text-left">
        <Button 
          onClick={onEdit} 
          variant="outline" 
          className={`flex items-center gap-2 ${isCompleted ? 'border-phi-mint text-phi-mint hover:bg-green-50' : 'border-[#3A7BD5] text-phi-dark hover:bg-[#E8F4FD]'}`}
        >
          {isCompleted ? 'ערוך פרטים' : 'השלם פרטים'}
        </Button>
      </div>
    </div>
  );
}


