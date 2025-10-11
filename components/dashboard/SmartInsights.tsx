'use client';

import { Lightbulb, Users, Target, AlertTriangle } from 'lucide-react';

interface SmartInsightsProps {
  profile: any;
  monthlyExpenses: number;
}

export default function SmartInsights({ profile, monthlyExpenses }: SmartInsightsProps) {
  const insights = generateInsights(profile, monthlyExpenses);

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-[#1E2A3B] mb-4 flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-[#F6A623]" />
        תובנות חכמות
      </h3>

      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div 
            key={index}
            className={`p-4 rounded-lg border-r-4 ${
              insight.type === 'warning' 
                ? 'bg-[#FFF3E0] border-[#F6A623]' 
                : insight.type === 'success'
                ? 'bg-[#E8F5E9] border-[#7ED957]'
                : 'bg-[#E3F2FD] border-[#3A7BD5]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {insight.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1E2A3B] mb-1">{insight.title}</p>
                <p className="text-xs text-[#555555]">{insight.description}</p>
                {insight.action && (
                  <button className="text-xs text-[#3A7BD5] font-medium mt-2 hover:underline">
                    {insight.action} →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateInsights(profile: any, monthlyExpenses: number) {
  const insights: any[] = [];

  if (!profile) return insights;

  const totalIncome = profile.total_monthly_income || 0;
  const totalFixed = profile.total_fixed_expenses || 0;
  const utilizationRate = totalIncome > 0 ? ((totalFixed + monthlyExpenses) / totalIncome) * 100 : 0;

  // תובנה על ילדים
  if (profile.children_count > 0) {
    insights.push({
      type: 'info',
      icon: <Users className="w-5 h-5 text-[#3A7BD5]" />,
      title: `יש לך ${profile.children_count} ילדים`,
      description: `מומלץ לפתוח יעד חיסכון לכל ילד. זה יעזור לך להתכונן לעתיד שלהם.`,
      action: 'הגדר יעדי חיסכון'
    });
  }

  // תובנה על ניצול גבוה
  if (utilizationRate > 85) {
    insights.push({
      type: 'warning',
      icon: <AlertTriangle className="w-5 h-5 text-[#F6A623]" />,
      title: 'ניצול גבוה של ההכנסה',
      description: `${utilizationRate.toFixed(0)}% מההכנסה שלך הולכת להוצאות. מומלץ להפחית הוצאות או להגדיל הכנסות.`,
      action: 'בדוק הוצאות'
    });
  }

  // תובנה על חובות
  const totalDebt = profile.total_debt || 0;
  if (totalDebt > totalIncome * 3) {
    insights.push({
      type: 'warning',
      icon: <AlertTriangle className="w-5 h-5 text-[#D64541]" />,
      title: 'חובות גבוהים',
      description: `החובות שלך (${totalDebt.toLocaleString('he-IL')} ₪) גבוהים מ-3 משכורות. כדאי לשקול מיחזור חובות.`,
      action: 'בדוק אפשרויות מיחזור'
    });
  }

  // תובנה על חיסכון
  const savings = profile.current_savings || 0;
  if (savings < totalIncome) {
    insights.push({
      type: 'warning',
      icon: <Target className="w-5 h-5 text-[#F6A623]" />,
      title: 'כרית ביטחון נמוכה',
      description: `מומלץ לחסוך לפחות 3-6 משכורות ככרית ביטחון. יש לך ${(savings / totalIncome).toFixed(1)} משכורות.`,
      action: 'התחל לחסוך'
    });
  }

  // תובנה על מטרות
  if (profile.short_term_goal) {
    insights.push({
      type: 'success',
      icon: <Target className="w-5 h-5 text-[#7ED957]" />,
      title: 'המטרה שלך: ' + profile.short_term_goal,
      description: `נעבוד ביחד כדי להגשים את זה! בואו נבנה תוכנית חיסכון מותאמת.`,
      action: 'צור יעד'
    });
  }

  // מקסימום 4 תובנות
  return insights.slice(0, 4);
}


