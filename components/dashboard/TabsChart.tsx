'use client';

import { useState } from 'react';
import { TrendingDown, TrendingUp, PieChart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExpensesDrilldownChart } from './ExpensesDrilldownChart';
import { IncomeDrilldownChart } from './IncomeDrilldownChart';
import { AssetsLiabilitiesDrilldownChart } from './AssetsLiabilitiesDrilldownChart';

export function TabsChart() {
  const [activeTab, setActiveTab] = useState('expenses');

  return (
    <div className="bg-white dark:bg-gray-800 border-4 border-phi-gold/40 rounded-3xl shadow-2xl">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tabs Header - גדול וצבעוני */}
        <div className="border-b-4 border-phi-gold/30 px-6 pt-8">
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 h-16 p-1.5 rounded-xl shadow-inner">
            <TabsTrigger 
              value="expenses" 
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-xl text-gray-700 dark:text-gray-300 flex items-center justify-center gap-3 text-lg font-bold rounded-lg transition-all"
            >
              <TrendingDown className="w-6 h-6" strokeWidth={3} />
              <span>הוצאות</span>
            </TabsTrigger>
            <TabsTrigger 
              value="income" 
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-xl text-gray-700 dark:text-gray-300 flex items-center justify-center gap-3 text-lg font-bold rounded-lg transition-all"
            >
              <TrendingUp className="w-6 h-6" strokeWidth={3} />
              <span>הכנסות</span>
            </TabsTrigger>
            <TabsTrigger 
              value="assets" 
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-xl text-gray-700 dark:text-gray-300 flex items-center justify-center gap-3 text-lg font-bold rounded-lg transition-all"
            >
              <PieChart className="w-6 h-6" strokeWidth={3} />
              <span>נכסים</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="expenses" className="p-0 m-0">
          <div className="p-8">
            <ExpensesDrilldownChart />
          </div>
        </TabsContent>

        <TabsContent value="income" className="p-0 m-0">
          <div className="p-8">
            <IncomeDrilldownChart />
          </div>
        </TabsContent>

        <TabsContent value="assets" className="p-0 m-0">
          <div className="p-8">
            <AssetsLiabilitiesDrilldownChart />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

