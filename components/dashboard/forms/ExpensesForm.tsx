'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Home, Shield, Smartphone, Car, Baby, Heart, Tv, Zap, Save, ArrowRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';

interface ExpensesFormProps {
  initialData: any;
}

const expenseCategories = [
  {
    category: 'דיור',
    icon: <Home className="w-6 h-6" />,
    color: 'from-[#3A7BD5] to-[#2E5EA5]',
    essential: true,
    fields: [
      { key: 'rent_mortgage', label: 'שכר דירה / משכנתא', placeholder: '0', tooltip: 'התשלום החודשי למשכנתא או שכירות' },
      { key: 'building_maintenance', label: 'דמי ניהול / ועד בית', placeholder: '0', tooltip: 'דמי ניהול, ועד בית או דמי ביוב' },
      { key: 'property_tax', label: 'ארנונה', placeholder: '0', tooltip: 'ארנונה חודשית ממוצעת' },
    ]
  },
  {
    category: 'ביטוחים',
    icon: <Shield className="w-6 h-6" />,
    color: 'from-[#F6A623] to-[#F68B23]',
    essential: true,
    fields: [
      { key: 'life_insurance', label: 'ביטוח חיים', placeholder: '0', tooltip: 'ביטוח חיים למקרה מוות (חלילה)' },
      { key: 'health_insurance', label: 'ביטוח בריאות', placeholder: '0', tooltip: 'ביטוח בריאות משלים או פרטי' },
      { key: 'car_insurance', label: 'ביטוח רכב', placeholder: '0', tooltip: 'חובה + מקיף לרכב' },
      { key: 'home_insurance', label: 'ביטוח דירה', placeholder: '0', tooltip: 'ביטוח תכולה ומבנה' },
    ]
  },
  {
    category: 'תקשורת',
    icon: <Smartphone className="w-6 h-6" />,
    color: 'from-[#7ED957] to-[#6BBF4A]',
    essential: true,
    fields: [
      { key: 'cellular', label: 'סלולר', placeholder: '0', tooltip: 'חבילת סלולר חודשית' },
      { key: 'internet', label: 'אינטרנט', placeholder: '0', tooltip: 'אינטרנט ביתי' },
      { key: 'tv_cable', label: 'טלוויזיה / כבלים', placeholder: '0', tooltip: 'yes/hot או סטרימינג' },
    ]
  },
  {
    category: 'רכב ותחבורה',
    icon: <Car className="w-6 h-6" />,
    color: 'from-[#E91E63] to-[#C2185B]',
    fields: [
      { key: 'leasing', label: 'ליסינג / החזר הלוואה לרכב', placeholder: '0', tooltip: 'תשלום חודשי על ליסינג או הלוואה' },
      { key: 'fuel', label: 'דלק', placeholder: '0', tooltip: 'דלק חודשי ממוצע' },
      { key: 'parking', label: 'חניה', placeholder: '0', tooltip: 'חניה חודשית קבועה' },
      { key: 'public_transport', label: 'תחבורה ציבורית', placeholder: '0', tooltip: 'חופשי חודשי או נסיעות' },
    ]
  },
  {
    category: 'ילדים וחינוך',
    icon: <Baby className="w-6 h-6" />,
    color: 'from-[#9C27B0] to-[#7B1FA2]',
    fields: [
      { key: 'daycare', label: 'מעון / גן', placeholder: '0', tooltip: 'שכר לימוד חודשי למעון או גן' },
      { key: 'afterschool', label: 'צהרון', placeholder: '0', tooltip: 'צהרון חודשי' },
      { key: 'tuition', label: 'שכר לימוד', placeholder: '0', tooltip: 'שכר לימוד לבי"ס פרטי' },
      { key: 'extracurricular', label: 'חוגים', placeholder: '0', tooltip: 'חוגי העשרה לילדים' },
      { key: 'babysitter', label: 'בייביסיטר', placeholder: '0', tooltip: 'בייביסיטר חודשי קבוע' },
    ]
  },
  {
    category: 'בריאות ורווחה',
    icon: <Heart className="w-6 h-6" />,
    color: 'from-[#00BCD4] to-[#0097A7]',
    fields: [
      { key: 'gym', label: 'חדר כושר', placeholder: '0', tooltip: 'מנוי חודשי לחדר כושר' },
      { key: 'therapy', label: 'טיפולים', placeholder: '0', tooltip: 'טיפולים רפואיים או פארא-רפואיים' },
      { key: 'medication', label: 'תרופות', placeholder: '0', tooltip: 'תרופות חודשיות קבועות' },
    ]
  },
  {
    category: 'מנויים',
    icon: <Tv className="w-6 h-6" />,
    color: 'from-[#FF9800] to-[#F57C00]',
    fields: [
      { key: 'streaming', label: 'שירותי סטרימינג', placeholder: '0', tooltip: 'Netflix, Spotify, וכו' },
      { key: 'digital_services', label: 'שירותים דיגיטליים', placeholder: '0', tooltip: 'iCloud, Dropbox, וכו' },
    ]
  },
  {
    category: 'חובה (חשמל, מים וגז)',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-[#FFEB3B] to-[#FBC02D]',
    essential: true,
    fields: [
      { key: 'electricity', label: 'חשמל', placeholder: '0', tooltip: 'חשבון חשמל חודשי ממוצע' },
      { key: 'water', label: 'מים', placeholder: '0', tooltip: 'חשבון מים דו-חודשי חלקי 2' },
      { key: 'gas', label: 'גז', placeholder: '0', tooltip: 'גז בישול (אם יש)' },
    ]
  },
];

export default function ExpensesForm({ initialData }: ExpensesFormProps) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    expenseCategories.forEach(cat => {
      cat.fields.forEach(field => {
        initial[field.key] = initialData[field.key] || 0;
      });
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showOptional, setShowOptional] = useState(false);

  const updateExpense = (key: string, value: number) => {
    setExpenses(prev => ({ ...prev, [key]: value }));
  };

  const calculateTotal = () => {
    return Object.values(expenses).reduce((sum, val) => sum + (val || 0), 0);
  };

  const handleSave = async () => {
    setLoading(true);
    setSuccessMessage('');

    try {
      const totalFixed = calculateTotal();
      
      const response = await fetch('/api/reflection/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenses,
          total_fixed_expenses: totalFixed,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save expenses');
      }

      setSuccessMessage('הנתונים נשמרו בהצלחה! ✓');
      
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 2000);

    } catch (error) {
      console.error('Error saving expenses:', error);
      alert('אירעה שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Total Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-l from-[#3A7BD5] to-[#7ED957] text-white rounded-2xl p-6 shadow-xl"
      >
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">סך כל ההוצאות הקבועות החודשיות</h3>
          <p className="text-5xl font-bold">
            {calculateTotal().toLocaleString('he-IL')} ₪
          </p>
        </div>
      </motion.div>

      {/* Essential Categories */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          הוצאות הכרחיות
          <InfoTooltip content="אלו הן ההוצאות הבסיסיות שחייבות להיות בכל תקציב" type="warning" />
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {expenseCategories.filter(cat => cat.essential).map((category, index) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
            >
              {/* Category Header */}
              <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg bg-gradient-to-l ${category.color} text-white`}>
                {category.icon}
                <h3 className="text-lg font-bold">{category.category}</h3>
              </div>

              {/* Fields */}
              <div className="space-y-3">
                {category.fields.map(field => (
                  <div key={field.key}>
                    <Label htmlFor={field.key} className="text-sm text-[#555555] flex items-center gap-1">
                      {field.label}
                      {field.tooltip && <InfoTooltip content={field.tooltip} />}
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id={field.key}
                        type="number"
                        value={expenses[field.key] || ''}
                        onChange={(e) => updateExpense(field.key, parseFloat(e.target.value) || 0)}
                        placeholder={field.placeholder}
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Category Total */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-[#1E2A3B]">סה&quot;כ {category.category}:</span>
                  <span className="font-bold text-[#3A7BD5]">
                    {category.fields.reduce((sum, field) => sum + (expenses[field.key] || 0), 0).toLocaleString('he-IL')} ₪
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Toggle Optional Categories */}
      <div className="text-center mb-6">
        <Button
          variant="outline"
          onClick={() => setShowOptional(!showOptional)}
          className="border-2 border-[#3A7BD5] text-[#3A7BD5] hover:bg-[#3A7BD5] hover:text-white"
        >
          {showOptional ? (
            <>
              <ChevronUp className="w-4 h-4 ml-2" />
              הסתר קטגוריות נוספות
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 ml-2" />
              הוסף עוד קטגוריות (אופציונלי)
            </>
          )}
        </Button>
      </div>

      {/* Optional Categories */}
      {showOptional && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            הוצאות נוספות
            <InfoTooltip content="הוצאות שלא כולם צריכים - הוסף רק את הרלוונטיות אליך" type="help" />
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {expenseCategories.filter(cat => !cat.essential).map((category, index) => (
          <motion.div
            key={category.category}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
          >
            {/* Category Header */}
            <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg bg-gradient-to-l ${category.color} text-white`}>
              {category.icon}
              <h3 className="text-lg font-bold">{category.category}</h3>
            </div>

              {/* Fields */}
              <div className="space-y-3">
                {category.fields.map(field => (
                  <div key={field.key}>
                    <Label htmlFor={field.key} className="text-sm text-[#555555] flex items-center gap-1">
                      {field.label}
                      {field.tooltip && <InfoTooltip content={field.tooltip} />}
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id={field.key}
                        type="number"
                        value={expenses[field.key] || ''}
                        onChange={(e) => updateExpense(field.key, parseFloat(e.target.value) || 0)}
                        placeholder={field.placeholder}
                        className="text-left pr-10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]">₪</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Category Total */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-[#1E2A3B]">סה&quot;כ {category.category}:</span>
                  <span className="font-bold text-[#3A7BD5]">
                    {category.fields.reduce((sum, field) => sum + (expenses[field.key] || 0), 0).toLocaleString('he-IL')} ₪
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
          </div>
        </motion.div>
      )}

      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#E8F5E9] border border-[#7ED957] rounded-lg p-4 text-center"
        >
          <p className="text-[#1E2A3B] font-semibold">{successMessage}</p>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard')}
          disabled={loading}
        >
          ביטול
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="bg-[#3A7BD5] hover:bg-[#2E5EA5] text-white px-8"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              שמור והמשך
              <ArrowRight className="w-4 h-4 mr-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

