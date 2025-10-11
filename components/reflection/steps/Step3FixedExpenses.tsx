'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Home, Shield, PiggyBank, Car, GraduationCap, Tv, Upload, FileText, Loader2, Phone, Wifi, Baby, Users, Utensils, Zap, Droplet, Fuel, HeartPulse, Briefcase } from 'lucide-react';
import ImportResults from '../ImportResults';

interface Step3Props {
  data: any;
  onChange: (field: string, value: any) => void;
}

const expenseFields = [
  // 🏠 דיור
  {
    key: 'rent_mortgage',
    label: 'שכר דירה / משכנתא',
    icon: Home,
    help: 'תשלום חודשי לשכר דירה או החזר משכנתא לבנק',
    category: 'דיור'
  },
  {
    key: 'building_maintenance',
    label: 'דמי ניהול / ועד בית',
    icon: Home,
    help: 'דמי ניהול חודשיים, ועד בית, תחזוקת בניין',
    category: 'דיור'
  },
  {
    key: 'property_tax',
    label: 'ארנונה',
    icon: Home,
    help: 'ארנונה חודשית (אם משלם חודשי ולא דו-חודשי)',
    category: 'דיור'
  },

  // 🛡️ ביטוחים
  {
    key: 'life_insurance',
    label: 'ביטוח חיים',
    icon: Shield,
    help: 'ביטוח חיים, ביטוח משכנתא, ביטוח מנהלים',
    category: 'ביטוחים'
  },
  {
    key: 'health_insurance',
    label: 'ביטוח בריאות',
    icon: HeartPulse,
    help: 'ביטוח בריאות פרטי, השלמה לקופת חולים',
    category: 'ביטוחים'
  },
  {
    key: 'car_insurance',
    label: 'ביטוח רכב',
    icon: Car,
    help: 'ביטוח חובה + מקיף לרכב',
    category: 'ביטוחים'
  },
  {
    key: 'home_insurance',
    label: 'ביטוח דירה',
    icon: Home,
    help: 'ביטוח תכולה ומבנה',
    category: 'ביטוחים'
  },

  // 📞 תקשורת
  {
    key: 'cellular',
    label: 'טלפון נייד',
    icon: Phone,
    help: 'פלאפון, סלקום, פרטנר, גולן, הוט מובייל, רמי לוי, 019 מובייל',
    category: 'תקשורת'
  },
  {
    key: 'internet',
    label: 'אינטרנט ביתי',
    icon: Wifi,
    help: 'בזק בינלאומי, הוט, סלקום, פרטנר, 019, Unlimited, סיבים אופטיים',
    category: 'תקשורת'
  },
  {
    key: 'tv_cable',
    label: 'טלוויזיה / לוויין',
    icon: Tv,
    help: 'yes, הוט, סלקום TV',
    category: 'תקשורת'
  },

  // 🚗 רכב
  {
    key: 'leasing',
    label: 'ליסינג רכב',
    icon: Car,
    help: 'תשלום חודשי על ליסינג',
    category: 'רכב'
  },
  {
    key: 'fuel',
    label: 'דלק',
    icon: Fuel,
    help: 'הוצאה חודשית ממוצעת',
    category: 'רכב'
  },
  {
    key: 'parking',
    label: 'חניה',
    icon: Car,
    help: 'מנוי חניה חודשי',
    category: 'רכב'
  },
  {
    key: 'public_transport',
    label: 'תחבורה ציבורית',
    icon: Car,
    help: 'רב-קו, חופשי חודשי',
    category: 'רכב'
  },

  // 👶 ילדים וחינוך
  {
    key: 'daycare',
    label: 'מעון / גן',
    icon: Baby,
    help: 'מעון יום, גן חובה, גן פרטי',
    category: 'ילדים'
  },
  {
    key: 'afterschool',
    label: 'צהרון',
    icon: GraduationCap,
    help: 'צהרון בית ספר, שמירה',
    category: 'ילדים'
  },
  {
    key: 'tuition',
    label: 'שכר לימוד',
    icon: GraduationCap,
    help: 'בית ספר פרטי, אוניברסיטה',
    category: 'ילדים'
  },
  {
    key: 'extracurricular',
    label: 'חוגים',
    icon: Users,
    help: 'חוגים קבועים - ספורט, מוזיקה',
    category: 'ילדים'
  },
  {
    key: 'babysitter',
    label: 'בייביסיטר / שמרטפית',
    icon: Baby,
    help: 'שמרטף, בייביסיטר קבוע',
    category: 'ילדים'
  },

  // 🏋️ בריאות
  {
    key: 'gym',
    label: 'חדר כושר',
    icon: Briefcase,
    help: 'מנוי לחדר כושר, יוגה, פילאטיס',
    category: 'בריאות'
  },
  {
    key: 'therapy',
    label: 'טיפולים',
    icon: HeartPulse,
    help: 'פיזיותרפיה, פסיכולוג, טיפולים',
    category: 'בריאות'
  },
  {
    key: 'medication',
    label: 'תרופות',
    icon: HeartPulse,
    help: 'תרופות קבועות חודשיות',
    category: 'בריאות'
  },

  // 💰 חיסכון
  {
    key: 'pension_funds',
    label: 'פנסיה / קופות גמל',
    icon: PiggyBank,
    help: 'מעבר לניכויים מהמשכורת',
    category: 'חיסכון'
  },

  // 📺 מנויים
  {
    key: 'streaming',
    label: 'סטרימינג',
    icon: Tv,
    help: 'Netflix, Disney+, Spotify',
    category: 'מנויים'
  },
  {
    key: 'digital_services',
    label: 'שירותים דיגיטליים',
    icon: Briefcase,
    help: 'iCloud, Google, אפליקציות',
    category: 'מנויים'
  },

  // ⚡ חובה
  {
    key: 'electricity',
    label: 'חשמל',
    icon: Zap,
    help: 'חשבון חשמל חודשי ממוצע',
    category: 'חובה'
  },
  {
    key: 'water',
    label: 'מים',
    icon: Droplet,
    help: 'חשבון מים חודשי',
    category: 'חובה'
  },
  {
    key: 'gas',
    label: 'גז',
    icon: Utensils,
    help: 'גז בישול',
    category: 'חובה'
  },
];

export default function Step3FixedExpenses({ data, onChange }: Step3Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const total = expenseFields.reduce((sum, field) => sum + (data[field.key] || 0), 0) + (data.other_fixed || 0);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">הוצאות קבועות 💰</h2>
        <p className="text-[#555555] mb-2">כמה אתה משלם <strong>כל חודש</strong> באופן קבוע?</p>
        <p className="text-xs text-[#F6A623] bg-[#FFF3E0] inline-block px-4 py-2 rounded-lg">
          💡 לא כולל קניות וחשבונות משתנים - רק תשלומים קבועים שחוזרים כל חודש
        </p>
        
        {/* אופציה להעלות דוח */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className="text-sm text-[#3A7BD5] hover:text-[#2E5EA5] underline flex items-center gap-2 mx-auto"
          >
            <FileText className="w-4 h-4" />
            {showUpload ? 'הזן ידנית' : 'לא יודע בדיוק? העלה דוח בנק/אשראי'}
          </button>
        </div>
      </div>

      {/* העלאת דוח */}
      {showUpload && (
        <div className="mb-6 p-6 bg-[#E8F4FD] border-2 border-dashed border-[#3A7BD5] rounded-xl">
          <div className="text-center">
            <Upload className="w-12 h-12 text-[#3A7BD5] mx-auto mb-3" />
            <h3 className="font-semibold text-[#1E2A3B] mb-2">ייבוא חכם מדוח בנק</h3>
                    <p className="text-sm text-[#555555] mb-3">
                      המערכת תנתח את הדוח ותזהה אוטומטית הוצאות קבועות<br />
                      <span className="text-xs text-[#7ED957]">✓ תומך ב: PDF, Excel/CSV, תמונות (JPG/PNG)</span><br />
                      <span className="text-xs text-[#3A7BD5]">🤖 מופעל על ידי GPT-4o</span>
                    </p>
            <div className="text-xs text-[#888888] mb-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[#7ED957]">✓</span>
                <span>OCR מתקדם - זיהוי טקסט בעברית ואנגלית</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#7ED957]">✓</span>
                <span>AI - זיהוי אוטומטי של חיובים חוזרים</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#7ED957]">✓</span>
                <span>דיוק 90%+ לדוחות ישראליים</span>
              </div>
            </div>
            <label className="inline-block">
                      <input
                        type="file"
                        accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,image/jpeg,image/png"
                        className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  setUploading(true);
                  
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('importType', 'expenses');
                    
                            const response = await fetch('/api/upload', {
                              method: 'POST',
                              body: formData,
                            });
                    
                    if (!response.ok) {
                      let errorMessage = 'שגיאה בניתוח הקובץ';
                      try {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                          const error = await response.json();
                          errorMessage = error.error || errorMessage;
                        } else {
                          const text = await response.text();
                          errorMessage = `שגיאת שרת (${response.status})`;
                        }
                      } catch (e) {
                        errorMessage = `שגיאת שרת (${response.status})`;
                      }
                      throw new Error(errorMessage);
                    }

                    const result = await response.json();
                    setImportResults(result);
                  } catch (error: any) {
                    console.error('Upload error:', error);
                    alert(`❌ שגיאה: ${error.message}`);
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-[#3A7BD5] text-white rounded-lg hover:bg-[#2E5EA5] cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed">
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    מנתח...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    בחר קובץ
                  </>
                )}
              </span>
            </label>
            <p className="text-xs text-[#888888] mt-3">
              הקובץ יישאר פרטי ומאובטח. נשתמש בו רק לזיהוי הוצאות קבועות.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Group fields by category */}
        {['דיור', 'ביטוחים', 'תקשורת', 'רכב', 'ילדים', 'בריאות', 'חיסכון', 'מנויים', 'חובה'].map(category => {
          const categoryFields = expenseFields.filter(f => f.category === category);
          if (categoryFields.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-lg font-semibold text-[#1E2A3B] mb-3 flex items-center gap-2">
                <span className="text-2xl">{
                  category === 'דיור' ? '🏠' :
                  category === 'ביטוחים' ? '🛡️' :
                  category === 'תקשורת' ? '📞' :
                  category === 'רכב' ? '🚗' :
                  category === 'ילדים' ? '👶' :
                  category === 'בריאות' ? '🏋️' :
                  category === 'חיסכון' ? '💰' :
                  category === 'מנויים' ? '📺' :
                  '⚡'
                }</span>
                {category}
              </h3>
              <div className="grid gap-2">
                {categoryFields.map(({ key, label, icon: Icon, help }) => (
                  <div key={key} className="p-3 bg-[#F5F6F8] rounded-lg hover:bg-[#E8F4FD] transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-[#3A7BD5] flex-shrink-0" />
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-[#1E2A3B] block">{label}</Label>
                        <p className="text-xs text-[#888888] mt-0.5">{help}</p>
                      </div>
                      <div className="relative w-24 flex-shrink-0">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={data[key] || ''}
                          onChange={(e) => onChange(key, parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
                          placeholder="0"
                          className="text-left pr-7 text-sm h-9"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* אחר */}
        <div className="flex items-center gap-3 p-3 bg-[#F5F6F8] rounded-lg">
          <div className="w-5 h-5 text-[#3A7BD5] text-center">•••</div>
          <div className="flex-1">
            <Label className="text-sm font-medium text-[#1E2A3B]">אחר (ציין)</Label>
          </div>
          <div className="relative w-28">
            <Input
              type="text"
              inputMode="numeric"
              value={data.other_fixed || ''}
              onChange={(e) => onChange('other_fixed', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
              placeholder="0"
              className="text-left pr-8 text-sm"
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
          </div>
        </div>
      </div>

      {/* סיכום */}
      <div className="bg-[#FFF3E0] border-r-4 border-[#F6A623] rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[#1E2A3B]">סה״כ הוצאות קבועות:</span>
          <span className="text-2xl font-bold text-[#F6A623]">
            {total.toLocaleString('he-IL')} ₪
          </span>
        </div>
        <p className="text-xs text-[#555555] mt-2">
          💡 הוצאות אלו יופחתו אוטומטית מהתקציב החופשי שלך
        </p>
      </div>

      {/* Import Results Modal */}
      {importResults && (
        <ImportResults
          detected={importResults.detected}
          fieldLabels={Object.fromEntries(
            expenseFields.map(f => [f.key, f.label])
          )}
          onConfirm={(data) => {
            // מלא את הנתונים
            Object.entries(data).forEach(([key, value]) => {
              onChange(key, value);
            });
            setImportResults(null);
            setShowUpload(false);
          }}
          onCancel={() => {
            setImportResults(null);
          }}
        />
      )}
    </div>
  );
}


