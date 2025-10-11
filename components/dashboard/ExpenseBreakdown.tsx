'use client';

import { Home, Shield, Phone, Car, Baby, HeartPulse, PiggyBank, Tv, Zap } from 'lucide-react';

interface ExpenseBreakdownProps {
  profile: any;
}

const categories = [
  {
    name: 'דיור',
    icon: Home,
    color: '#3A7BD5',
    fields: ['rent_mortgage', 'building_maintenance', 'property_tax'],
    labels: {
      rent_mortgage: 'שכר דירה/משכנתא',
      building_maintenance: 'דמי ניהול',
      property_tax: 'ארנונה'
    }
  },
  {
    name: 'ביטוחים',
    icon: Shield,
    color: '#7ED957',
    fields: ['life_insurance', 'health_insurance', 'car_insurance', 'home_insurance'],
    labels: {
      life_insurance: 'ביטוח חיים',
      health_insurance: 'ביטוח בריאות',
      car_insurance: 'ביטוח רכב',
      home_insurance: 'ביטוח דירה'
    }
  },
  {
    name: 'תקשורת',
    icon: Phone,
    color: '#F6A623',
    fields: ['cellular', 'internet', 'tv_cable'],
    labels: {
      cellular: 'סלולר',
      internet: 'אינטרנט',
      tv_cable: 'טלוויזיה'
    }
  },
  {
    name: 'רכב ותחבורה',
    icon: Car,
    color: '#D64541',
    fields: ['leasing', 'fuel', 'parking', 'public_transport'],
    labels: {
      leasing: 'ליסינג',
      fuel: 'דלק',
      parking: 'חניה',
      public_transport: 'תחבורה ציבורית'
    }
  },
  {
    name: 'ילדים וחינוך',
    icon: Baby,
    color: '#FF6B9D',
    fields: ['daycare', 'afterschool', 'tuition', 'extracurricular', 'babysitter'],
    labels: {
      daycare: 'גן/מעון',
      afterschool: 'צהרון',
      tuition: 'שכר לימוד',
      extracurricular: 'חוגים',
      babysitter: 'בייביסיטר'
    }
  },
  {
    name: 'בריאות ורווחה',
    icon: HeartPulse,
    color: '#9C27B0',
    fields: ['gym', 'therapy', 'medication'],
    labels: {
      gym: 'חדר כושר',
      therapy: 'טיפולים',
      medication: 'תרופות'
    }
  },
  {
    name: 'חיסכון',
    icon: PiggyBank,
    color: '#00897B',
    fields: ['pension_funds'],
    labels: {
      pension_funds: 'פנסיה/קופות גמל'
    }
  },
  {
    name: 'מנויים',
    icon: Tv,
    color: '#E91E63',
    fields: ['streaming', 'digital_services'],
    labels: {
      streaming: 'סטרימינג',
      digital_services: 'שירותים דיגיטליים'
    }
  },
  {
    name: 'חובה',
    icon: Zap,
    color: '#FF9800',
    fields: ['electricity', 'water', 'gas'],
    labels: {
      electricity: 'חשמל',
      water: 'מים',
      gas: 'גז'
    }
  }
];

export default function ExpenseBreakdown({ profile }: ExpenseBreakdownProps) {
  if (!profile) return null;

  const totalFixed = profile.total_fixed_expenses || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-[#1E2A3B] mb-6">פירוט הוצאות קבועות</h3>

      <div className="space-y-4">
        {categories.map((category) => {
          const categoryTotal = category.fields.reduce(
            (sum, field) => sum + (Number(profile[field]) || 0),
            0
          );

          if (categoryTotal === 0) return null;

          const percentage = totalFixed > 0 ? (categoryTotal / totalFixed) * 100 : 0;
          const Icon = category.icon;

          return (
            <div key={category.name} className="border border-gray-100 rounded-lg p-4 hover:shadow-sm transition-shadow">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: category.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#1E2A3B]">{category.name}</p>
                    <p className="text-xs text-[#888888]">{percentage.toFixed(0)}% מהסך</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-[#1E2A3B]">
                    {categoryTotal.toLocaleString('he-IL')} ₪
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: category.color
                  }}
                />
              </div>

              {/* Breakdown */}
              <div className="space-y-1">
                {category.fields.map((field) => {
                  const amount = Number(profile[field]) || 0;
                  if (amount === 0) return null;

                  return (
                    <div key={field} className="flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-50">
                      <span className="text-[#555555]">{category.labels[field as keyof typeof category.labels]}</span>
                      <span className="font-medium text-[#1E2A3B]">
                        {amount.toLocaleString('he-IL')} ₪
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Other */}
        {(profile.other_fixed || 0) > 0 && (
          <div className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-[#555555]">אחר</span>
              <span className="font-semibold text-[#1E2A3B]">
                {(profile.other_fixed || 0).toLocaleString('he-IL')} ₪
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
