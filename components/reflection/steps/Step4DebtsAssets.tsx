'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CreditCard, Building2, AlertCircle, Wallet, TrendingUp, Home, Car, Upload, FileText, PiggyBank, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ImportResults from '../ImportResults';

interface Step4Props {
  data: any;
  onChange: (field: string, value: any) => void;
}

export default function Step4DebtsAssets({ data, onChange }: Step4Props) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const totalDebt = (data.credit_card_debt || 0) + (data.bank_loans || 0) + (data.other_debts || 0);
  const totalAssets = (data.current_account_balance || 0) + (data.current_savings || 0) + (data.investments || 0);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">חובות ונכסים 💼</h2>
        <p className="text-[#555555] mb-2">מה <strong>היתרה</strong> של החובות והנכסים שלך?</p>
        <p className="text-xs text-[#3A7BD5] bg-[#E8F4FD] inline-block px-4 py-2 rounded-lg">
          💡 כאן רושמים כמה חוב סה״כ יש לך, לא תשלום חודשי
        </p>
        
        {/* אופציה להעלות דוח */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowUpload(!showUpload)}
            className="text-sm text-[#3A7BD5] hover:text-[#2E5EA5] underline flex items-center gap-2 mx-auto"
          >
            <FileText className="w-4 h-4" />
            {showUpload ? 'הזן ידנית' : 'לא בטוח? העלה דוח אשראי מהבנק'}
          </button>
        </div>
      </div>

      {/* העלאת דוח */}
      {showUpload && (
        <div className="mb-6 p-6 bg-[#E8F4FD] border-2 border-dashed border-[#3A7BD5] rounded-xl">
          <div className="text-center">
            <Upload className="w-12 h-12 text-[#3A7BD5] mx-auto mb-3" />
            <h3 className="font-semibold text-[#1E2A3B] mb-2">ייבוא חכם מדוח אשראי/בנק</h3>
                    <p className="text-sm text-[#555555] mb-3">
                      המערכת תנתח את הדוח ותזהה אוטומטית חובות, יתרות ונכסים<br />
                      <span className="text-xs text-[#7ED957]">✓ תומך ב: PDF, Excel/CSV, תמונות (JPG/PNG)</span><br />
                      <span className="text-xs text-[#3A7BD5]">🤖 מופעל על ידי GPT-4o</span>
                    </p>
            <div className="text-xs text-[#888888] mb-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[#7ED957]">✓</span>
                <span>זיהוי יתרות חשבונות ומסגרות אשראי</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#7ED957]">✓</span>
                <span>חישוב אוטומטי של סך החובות</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#7ED957]">✓</span>
                <span>תמיכה בדוחות מכל הבנקים הגדולים</span>
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
                    formData.append('importType', 'debts');
                    
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
              <span className="inline-flex items-center gap-2 px-6 py-3 bg-[#3A7BD5] text-white rounded-lg hover:bg-[#2E5EA5] cursor-pointer transition">
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
              הקובץ יישאר פרטי ומאובטח 🔒
            </p>
          </div>
        </div>
      )}

      {/* חובות */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-[#D64541]" />
          <h3 className="font-semibold text-[#1E2A3B]">חובות קיימים (יתרה כוללת)</h3>
        </div>
        
        <div className="space-y-3">
          <div className="p-3 bg-[#FFF5F5] rounded-lg border border-[#FFD6D6]">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-[#D64541] flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#1E2A3B] block mb-1">מינוס/אשראי שוטף</Label>
                <p className="text-xs text-[#888888]">מסגרת אשראי שלילית בחשבון הבנק או יתרת חוב על כרטיסי אשראי</p>
              </div>
              <div className="relative w-32 flex-shrink-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={data.credit_card_debt || ''}
                  onChange={(e) => onChange('credit_card_debt', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
                  placeholder="0"
                  className="text-left pr-8"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#FFF5F5] rounded-lg border border-[#FFD6D6]">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[#D64541] flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#1E2A3B] block mb-1">הלוואות מהבנק</Label>
                <p className="text-xs text-[#888888]">הלוואות אישיות, משכנתא, או הלוואות אחרות - יתרת החוב</p>
              </div>
              <div className="relative w-32 flex-shrink-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={data.bank_loans || ''}
                  onChange={(e) => onChange('bank_loans', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
                  placeholder="0"
                  className="text-left pr-8"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#F5F6F8] rounded-lg">
            <div className="w-5 h-5 text-[#D64541] text-center">•••</div>
            <div className="flex-1">
              <Label className="text-sm font-medium">חובות אחרים</Label>
            </div>
            <div className="relative w-32">
              <Input
                type="text"
                inputMode="numeric"
                value={data.other_debts || ''}
                onChange={(e) => onChange('other_debts', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
                placeholder="0"
                className="text-left pr-8"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
            </div>
          </div>
        </div>

        {totalDebt > 0 && (
          <div className="bg-[#FFEBEE] border-r-4 border-[#D64541] rounded-lg p-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-[#1E2A3B]">סה״כ חובות:</span>
              <span className="text-lg font-bold text-[#D64541]">
                {totalDebt.toLocaleString('he-IL')} ₪
              </span>
            </div>
          </div>
        )}
      </div>

      {/* נכסים */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-5 h-5 text-[#7ED957]" />
          <h3 className="font-semibold text-[#1E2A3B]">נכסים וחיסכון (מה יש לך)</h3>
        </div>
        
        <div className="space-y-3">
          {/* יתרת עו"ש */}
          <div className="p-3 bg-[#F0FFF4] rounded-lg border border-[#C6F6D5]">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-[#7ED957] flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#1E2A3B] block mb-1">יתרת חשבון עו״ש</Label>
                <p className="text-xs text-[#888888]">כמה כסף יש לך עכשיו בחשבון הבנק? (אפשר להיות שלילי אם במינוס)</p>
              </div>
              <div className="relative w-32 flex-shrink-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={data.current_account_balance || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d-]/g, '');
                    onChange('current_account_balance', parseFloat(value) || 0);
                  }}
                  placeholder="0"
                  className="text-left pr-8"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
              </div>
            </div>
          </div>

          {/* חיסכון */}
          <div className="p-3 bg-[#F0FFF4] rounded-lg border border-[#C6F6D5]">
            <div className="flex items-center gap-3">
              <PiggyBank className="w-5 h-5 text-[#7ED957] flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#1E2A3B] block mb-1">חיסכון וקופות</Label>
                <p className="text-xs text-[#888888]">חיסכון בקרנות, תכניות חיסכון, כספים שלא בעו״ש</p>
              </div>
              <div className="relative w-32 flex-shrink-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={data.current_savings || ''}
                  onChange={(e) => onChange('current_savings', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
                  placeholder="0"
                  className="text-left pr-8"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
              </div>
            </div>
          </div>

          {/* השקעות */}
          <div className="p-3 bg-[#F0FFF4] rounded-lg border border-[#C6F6D5]">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#7ED957] flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#1E2A3B] block mb-1">השקעות</Label>
                <p className="text-xs text-[#888888]">מניות, קרנות נאמנות, קריפטו - ערך נוכחי משוער</p>
              </div>
              <div className="relative w-32 flex-shrink-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={data.investments || ''}
                  onChange={(e) => onChange('investments', parseFloat(e.target.value.replace(/[^\d]/g, '')) || 0)}
                  placeholder="0"
                  className="text-left pr-8"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#555555] text-xs">₪</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-[#F5F6F8] rounded-lg">
            <div className="flex items-center gap-2 flex-1">
              <Checkbox 
                id="owns_home" 
                checked={data.owns_home || false}
                onCheckedChange={(checked) => onChange('owns_home', checked)}
              />
              <Label htmlFor="owns_home" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Home className="w-4 h-4" />
                דירה בבעלות
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox 
                id="owns_car" 
                checked={data.owns_car || false}
                onCheckedChange={(checked) => onChange('owns_car', checked)}
              />
              <Label htmlFor="owns_car" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Car className="w-4 h-4" />
                רכב בבעלות
              </Label>
            </div>
          </div>
        </div>

        {totalAssets > 0 && (
          <div className="bg-[#E8F5E9] border-r-4 border-[#7ED957] rounded-lg p-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-[#1E2A3B]">סה״כ נכסים נזילים:</span>
              <span className="text-lg font-bold text-[#7ED957]">
                {totalAssets.toLocaleString('he-IL')} ₪
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Import Results Modal */}
      {importResults && (
        <ImportResults
          detected={importResults.detected}
          fieldLabels={{
            credit_card_debt: 'מינוס/אשראי שוטף',
            current_account_balance: 'יתרת חשבון עו״ש',
            bank_loans: 'הלוואות מהבנק',
            current_savings: 'חיסכון',
            investments: 'השקעות',
            owns_home: 'בעלות על דירה',
            owns_car: 'בעלות על רכב'
          }}
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


