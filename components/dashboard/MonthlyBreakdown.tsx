'use client';

import { motion } from 'framer-motion';
import { 
  Home, Shield, Phone, Car, Baby, Heart, Wallet, 
  Tv, Zap, TrendingUp, MoreHorizontal 
} from 'lucide-react';

interface MonthlyBreakdownProps {
  profile: any;
}

export default function MonthlyBreakdown({ profile }: MonthlyBreakdownProps) {
  // חישוב קטגוריות הוצאות
  const categories = [
    {
      name: 'דיור',
      icon: Home,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      items: [
        { label: 'שכ״ד / משכנתא', value: profile?.rent_mortgage || 0 },
        { label: 'ועד בית', value: profile?.building_maintenance || 0 },
        { label: 'ארנונה', value: profile?.property_tax || 0 },
      ]
    },
    {
      name: 'ביטוחים',
      icon: Shield,
      color: 'from-emerald-500 to-green-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      items: [
        { label: 'ביטוח חיים', value: profile?.life_insurance || 0 },
        { label: 'בריאות', value: profile?.health_insurance || 0 },
        { label: 'רכב', value: profile?.car_insurance || 0 },
        { label: 'דירה', value: profile?.home_insurance || 0 },
      ]
    },
    {
      name: 'תקשורת',
      icon: Phone,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      items: [
        { label: 'סלולרי', value: profile?.cellular || 0 },
        { label: 'אינטרנט', value: profile?.internet || 0 },
        { label: 'טלוויזיה', value: profile?.tv_cable || 0 },
      ]
    },
    {
      name: 'רכב ותחבורה',
      icon: Car,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      items: [
        { label: 'ליסינג', value: profile?.leasing || 0 },
        { label: 'דלק', value: profile?.fuel || 0 },
        { label: 'חניה', value: profile?.parking || 0 },
        { label: 'תחבורה ציבורית', value: profile?.public_transport || 0 },
      ]
    },
    {
      name: 'ילדים וחינוך',
      icon: Baby,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-700',
      items: [
        { label: 'מעון/גן', value: profile?.daycare || 0 },
        { label: 'צהרון', value: profile?.afterschool || 0 },
        { label: 'שכר לימוד', value: profile?.tuition || 0 },
        { label: 'חוגים', value: profile?.extracurricular || 0 },
        { label: 'בייביסיטר', value: profile?.babysitter || 0 },
      ]
    },
    {
      name: 'בריאות ורווחה',
      icon: Heart,
      color: 'from-red-500 to-rose-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      items: [
        { label: 'חדר כושר', value: profile?.gym || 0 },
        { label: 'טיפולים', value: profile?.therapy || 0 },
        { label: 'תרופות', value: profile?.medication || 0 },
      ]
    },
    {
      name: 'חיסכון',
      icon: Wallet,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      items: [
        { label: 'קרנות פנסיה', value: profile?.pension_funds || 0 },
      ]
    },
    {
      name: 'מנויים',
      icon: Tv,
      color: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-700',
      items: [
        { label: 'סטרימינג', value: profile?.streaming || 0 },
        { label: 'שירותים דיגיטליים', value: profile?.digital_services || 0 },
      ]
    },
    {
      name: 'חובה',
      icon: Zap,
      color: 'from-yellow-500 to-amber-600',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      items: [
        { label: 'חשמל', value: profile?.electricity || 0 },
        { label: 'מים', value: profile?.water || 0 },
        { label: 'גז', value: profile?.gas || 0 },
      ]
    },
  ];

  // סינון קטגוריות עם ערכים
  const categoriesWithValues = categories.map(cat => ({
    ...cat,
    total: cat.items.reduce((sum, item) => sum + item.value, 0),
    items: cat.items.filter(item => item.value > 0)
  })).filter(cat => cat.total > 0);

  const totalExpenses = categoriesWithValues.reduce((sum, cat) => sum + cat.total, 0);

  if (categoriesWithValues.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-[#1E2A3B]">פירוט הוצאות קבועות</h3>
          <p className="text-sm text-gray-500 mt-1">חלוקה לפי קטגוריות</p>
        </div>
        <div className="text-left">
          <p className="text-sm text-gray-500">סה״כ</p>
          <p className="text-2xl font-bold text-[#1E2A3B]">
            ₪{totalExpenses.toLocaleString('he-IL')}
          </p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoriesWithValues.map((category, idx) => {
          const Icon = category.icon;
          const percentage = totalExpenses > 0 ? (category.total / totalExpenses * 100).toFixed(0) : 0;

          return (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`${category.bgColor} rounded-xl p-4 hover:shadow-md transition-all group cursor-pointer border border-gray-100`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className={`font-bold ${category.textColor} text-sm`}>{category.name}</h4>
                  <p className="text-xs text-gray-500">{percentage}% מהסה״כ</p>
                </div>
              </div>

              {/* Total */}
              <div className="mb-3">
                <p className="text-2xl font-bold text-gray-900">
                  ₪{category.total.toLocaleString('he-IL')}
                </p>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {category.items.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium text-gray-900">
                      ₪{item.value.toLocaleString('he-IL')}
                    </span>
                  </div>
                ))}
                {category.items.length > 3 && (
                  <p className="text-xs text-gray-400 pt-1">
                    +{category.items.length - 3} נוספים
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary Bar */}
      <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#3A7BD5]" />
            <span className="text-sm font-medium text-gray-700">התחייבויות חודשיות</span>
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-[#1E2A3B]">
              ₪{totalExpenses.toLocaleString('he-IL')}
            </p>
            <p className="text-xs text-gray-500">
              {categoriesWithValues.length} קטגוריות
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

