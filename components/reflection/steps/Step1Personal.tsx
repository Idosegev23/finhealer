'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FieldTooltip } from '@/components/ui/info-tooltip';
import { Plus, Trash2, Scan, Upload, Loader2, CheckCircle, XCircle, Camera } from 'lucide-react';

interface Dependent {
  id: string;
  name: string;
  birthDate: string;
  gender: 'male' | 'female' | 'other';
  relationshipType: 'child' | 'grandchild';
  isFinanciallySupported: boolean;
}

interface Step1Props {
  data: any;
  onChange: (field: string, value: any) => void;
}

export default function Step1Personal({ data, onChange }: Step1Props) {
  const [dependents, setDependents] = useState<Dependent[]>(data.dependents || []);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [appendixPreview, setAppendixPreview] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  
  const userAge = data.age || 0;
  const isYoung = userAge > 0 && userAge <= 35;
  const isMiddleAge = userAge > 35 && userAge <= 50;
  const isMature = userAge > 50;
  const showGrandchildren = isMature; // הצג נכדים רק למבוגרים מעל 50

  const addDependent = (type: 'child' | 'grandchild') => {
    const newDependent: Dependent = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      birthDate: '',
      gender: 'male',
      relationshipType: type,
      isFinanciallySupported: false
    };
    const updated = [...dependents, newDependent];
    setDependents(updated);
    onChange('dependents', updated);
  };

  const updateDependent = (id: string, field: keyof Dependent, value: any) => {
    const updated = dependents.map(d => 
      d.id === id ? { ...d, [field]: value } : d
    );
    setDependents(updated);
    onChange('dependents', updated);
  };

  const removeDependent = (id: string) => {
    const updated = dependents.filter(d => d.id !== id);
    setDependents(updated);
    onChange('dependents', updated);
  };

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleScanIdCard = async (idCardFile: File | null, appendixFile: File | null) => {
    if (!idCardFile) return;

    setIsScanning(true);
    setScanError(null);
    setScanSuccess(false);

    try {
      const formData = new FormData();
      formData.append('idCard', idCardFile);
      if (appendixFile) {
        formData.append('appendix', appendixFile);
      }

      const response = await fetch('/api/ocr/id-card', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to scan ID card');
      }

      const result = await response.json();
      const { idCard, children: scannedChildren } = result.data;

      // Auto-fill personal data
      if (idCard.fullName) {
        onChange('full_name', idCard.fullName);
      }
      if (idCard.birthDate) {
        const age = calculateAge(idCard.birthDate);
        onChange('age', age);
      }
      if (idCard.address) {
        onChange('city', idCard.address);
      }

      // Auto-fill children from appendix
      if (scannedChildren && scannedChildren.length > 0) {
        const newDependents = scannedChildren.map((child: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: child.name || '',
          birthDate: child.birthDate || '',
          gender: child.gender || 'other',
          relationshipType: 'child',
          isFinanciallySupported: false
        }));

        const updatedDependents = [...dependents, ...newDependents];
        setDependents(updatedDependents);
        onChange('dependents', updatedDependents);
      }

      setScanSuccess(true);
      setTimeout(() => {
        setShowScanner(false);
      }, 2000);

    } catch (error: any) {
      console.error('Scan error:', error);
      setScanError(error.message || 'שגיאה בסריקה');
    } finally {
      setIsScanning(false);
    }
  };

  const children = dependents.filter(d => d.relationshipType === 'child');
  const grandchildren = dependents.filter(d => d.relationshipType === 'grandchild');
  const childrenUnder18 = children.filter(d => calculateAge(d.birthDate) < 18);
  const childrenOver18 = children.filter(d => calculateAge(d.birthDate) >= 18);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#1E2A3B] mb-2">ספר/י לנו קצת על עצמך 👋</h2>
        <p className="text-[#555555] mb-2">נכיר אותך טוב יותר כדי להתאים לך את החוויה המושלמת</p>
        <div className="inline-block bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-3 rounded-full mt-2 border border-blue-200">
          <p className="text-sm text-[#3A7BD5] font-medium">
            💡 הפרטים שלך בטוחים איתנו ומאובטחים לחלוטין
          </p>
        </div>
      </div>

      {/* ID Card Scanner */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowScanner(!showScanner)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-l from-[#3A7BD5] to-[#7ED957] text-white rounded-lg hover:shadow-lg transition-all font-semibold"
        >
          <Camera className="w-5 h-5" />
          {showScanner ? 'סגור סורק ת.ז' : 'סרוק ת.ז + ספח (מילוי אוטומטי מהיר!)'}
        </button>

        {showScanner && (
          <div className="mt-4 p-6 bg-gradient-to-br from-[#E8F4FD] to-[#E8F5E9] border-2 border-[#3A7BD5] rounded-xl">
            <div className="space-y-4">
              <div className="text-center">
                <Scan className="w-12 h-12 text-[#3A7BD5] mx-auto mb-3" />
                <h3 className="font-semibold text-[#1E2A3B] mb-2">העלאת תעודת זהות + ספח</h3>
                <p className="text-sm text-[#555555]">
                  המערכת תמלא אוטומטית את כל הפרטים מהתמונות
                </p>
              </div>

              {!isScanning && !scanSuccess && (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* ID Card Upload */}
                  <div>
                    <Label className="text-sm font-medium text-[#1E2A3B] mb-2 block">תעודת זהות</Label>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setIdCardPreview(event.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-[#3A7BD5] rounded-lg p-4 cursor-pointer hover:bg-white transition-colors text-center">
                        {idCardPreview ? (
                          <div className="relative w-full max-h-32 h-32">
                            <Image src={idCardPreview} alt="ID Card" fill className="object-contain rounded" />
                          </div>
                        ) : (
                          <div className="py-4">
                            <Upload className="w-8 h-8 text-[#3A7BD5] mx-auto mb-2" />
                            <p className="text-sm text-[#555555]">לחץ להעלאה</p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>

                  {/* Appendix Upload */}
                  <div>
                    <Label className="text-sm font-medium text-[#1E2A3B] mb-2 block">ספח (אופציונלי)</Label>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setAppendixPreview(event.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-[#7ED957] rounded-lg p-4 cursor-pointer hover:bg-white transition-colors text-center">
                        {appendixPreview ? (
                          <div className="relative w-full max-h-32 h-32">
                            <Image src={appendixPreview} alt="Appendix" fill className="object-contain rounded" />
                          </div>
                        ) : (
                          <div className="py-4">
                            <Upload className="w-8 h-8 text-[#7ED957] mx-auto mb-2" />
                            <p className="text-sm text-[#555555]">לחץ להעלאה</p>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {isScanning && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-[#3A7BD5] mx-auto mb-3 animate-spin" />
                  <p className="text-[#1E2A3B] font-semibold">סורק ומנתח...</p>
                  <p className="text-sm text-[#555555] mt-1">זה יכול לקחת כמה שניות</p>
                </div>
              )}

              {scanSuccess && (
                <div className="text-center py-8 bg-[#E8F5E9] rounded-lg">
                  <CheckCircle className="w-12 h-12 text-[#7ED957] mx-auto mb-3" />
                  <p className="text-[#1E2A3B] font-semibold">סריקה הושלמה בהצלחה!</p>
                  <p className="text-sm text-[#555555] mt-1">הפרטים מולאו אוטומטית</p>
                </div>
              )}

              {scanError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">{scanError}</p>
                    <p className="text-xs text-red-700 mt-1">נסה שוב או מלא ידנית</p>
                  </div>
                </div>
              )}

              {idCardPreview && !isScanning && !scanSuccess && (
                <Button
                  type="button"
                  onClick={() => {
                    // Get files from the inputs
                    const idInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                    const appendixInput = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
                    handleScanIdCard(idInput?.files?.[0] || null, appendixInput?.files?.[0] || null);
                  }}
                  className="w-full bg-[#3A7BD5] hover:bg-[#2E5EA5]"
                >
                  <Scan className="w-4 h-4 mr-2" />
                  התחל סריקה
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {/* שם מלא */}
        <FieldTooltip
          label="👤 איך קוראים לך?"
          tooltip="השם שלך עוזר לנו להתאים את החוויה ולפנות אליך בצורה אישית"
        >
          <Input
            id="full_name"
            type="text"
            value={data.full_name || ''}
            onChange={(e) => onChange('full_name', e.target.value)}
            placeholder="לדוגמה: דני כהן"
            className="mt-1 text-lg font-medium"
          />
        </FieldTooltip>

        {/* גיל */}
        <FieldTooltip
          label="🎂 בן/בת כמה את/ה?"
          tooltip="הגיל עוזר לנו להבין באיזה שלב חיים את/ה נמצא/ת ולתת עצות מתאימות. למשל, צעירים יכולים להרשות לעצמם יותר סיכון בהשקעות"
        >
          <Input
            id="age"
            type="number"
            value={data.age || ''}
            onChange={(e) => onChange('age', parseInt(e.target.value) || null)}
            placeholder="לדוגמה: 32"
            className="mt-1"
          />
        </FieldTooltip>

        {/* מצב משפחתי */}
        <FieldTooltip
          label="💍 מה המצב המשפחתי שלך?"
          tooltip="המצב המשפחתי משפיע על הוצאות, הכנסות והתכנון הפיננסי שלך"
        >
          <Select value={data.marital_status || ''} onValueChange={(val) => onChange('marital_status', val)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="בחר/י..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">רווק/ה</SelectItem>
              <SelectItem value="married">נשוי/אה</SelectItem>
              <SelectItem value="divorced">גרוש/ה</SelectItem>
              <SelectItem value="widowed">אלמן/ה</SelectItem>
            </SelectContent>
          </Select>
        </FieldTooltip>

        {/* כתובת מגורים */}
        <FieldTooltip
          label="🏠 איפה את/ה גר/ה?"
          tooltip="המיקום עוזר לנו להבין את רמת הוצאות המחיה באזור שלך ולתת המלצות מותאמות"
        >
          <Input
            id="city"
            value={data.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="לדוגמה: תל אביב, רחוב הרצל 10"
            className="mt-1"
          />
        </FieldTooltip>

        {/* מעמד תעסוקתי */}
        <FieldTooltip
          label="💼 מה מעמד התעסוקה שלך?"
          tooltip="המעמד התעסוקתי משפיע על סוגי ההוצאות שלך - לעצמאים יש הוצאות אחרות משכירים"
        >
          <Select value={data.employment_status || ''} onValueChange={(val) => onChange('employment_status', val)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="בחר/י..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">שכיר</SelectItem>
              <SelectItem value="self_employed">עצמאי</SelectItem>
              <SelectItem value="both">שכיר + עצמאי</SelectItem>
            </SelectContent>
          </Select>
        </FieldTooltip>

        {/* ילדים */}
        <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label className="text-[#1E2A3B] font-semibold flex items-center gap-2">
                👨‍👩‍👧‍👦 יש לך ילדים? ספר/י לנו עליהם
              </Label>
              <p className="text-xs text-[#555555] mt-1">
                ילדים משפיעים על התקציב והתכנון הפיננסי
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addDependent('child')}
              className="gap-2 bg-white hover:bg-blue-50"
            >
              <Plus className="w-4 h-4" />
              הוסף ילד/ה
            </Button>
          </div>

          {children.length === 0 && (
            <p className="text-sm text-[#666666] text-center py-4 bg-white rounded-lg border border-blue-100">
              אין ילדים רשומים. לחץ על &quot;הוסף ילד/ה&quot; אם יש לך ילדים 😊
            </p>
          )}

          <div className="space-y-3">
            {children.map((child) => {
              const age = calculateAge(child.birthDate);
              const isUnder18 = age < 18 || !child.birthDate;
              
              return (
                <div key={child.id} className="p-4 bg-[#F5F6F8] rounded-lg border-2 border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1E2A3B]">
                        {child.name || 'ילד/ה חדש/ה'} 
                        {child.birthDate && ` (גיל ${age})`}
                      </p>
                      {!isUnder18 && age >= 18 && (
                        <p className="text-xs text-[#F6A623] mt-1">
                          ⚠️ מעל גיל 18 - האם אתה תומך כלכלית?
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDependent(child.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    {/* שם */}
                    <div>
                      <Label className="text-xs text-[#555555]">שם מלא</Label>
                      <Input
                        value={child.name}
                        onChange={(e) => updateDependent(child.id, 'name', e.target.value)}
                        placeholder="לדוגמה: יוסי כהן"
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* תאריך לידה */}
                      <div>
                        <Label className="text-xs text-[#555555]">תאריך לידה</Label>
                        <Input
                          type="date"
                          value={child.birthDate}
                          onChange={(e) => updateDependent(child.id, 'birthDate', e.target.value)}
                          className="mt-1"
                        />
                      </div>

                      {/* מין */}
                      <div>
                        <Label className="text-xs text-[#555555]">מין</Label>
                        <Select 
                          value={child.gender} 
                          onValueChange={(val) => updateDependent(child.id, 'gender', val)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">זכר</SelectItem>
                            <SelectItem value="female">נקבה</SelectItem>
                            <SelectItem value="other">אחר</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                      {/* אם מעל 18 - שאלה על תמיכה */}
                    {!isUnder18 && age >= 18 && (
                      <div className="mt-2 p-3 bg-white rounded border-2 border-orange-300">
                        <Label className="text-sm text-[#1E2A3B] font-medium mb-2 block flex items-center gap-2">
                          💰 האם את/ה תומך/ת כלכלית ב{child.name || 'ילד/ה זה/זו'}?
                        </Label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={child.isFinanciallySupported === true}
                              onChange={() => updateDependent(child.id, 'isFinanciallySupported', true)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">כן</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={child.isFinanciallySupported === false}
                              onChange={() => updateDependent(child.id, 'isFinanciallySupported', false)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">לא</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* נכדים - רק אם מעל גיל 50 */}
        {showGrandchildren && (
          <div className="mt-6 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-300">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label className="text-[#1E2A3B] font-semibold flex items-center gap-2">
                  👴👵 יש לך נכדים?
                </Label>
                <p className="text-xs text-[#555555] mt-1">
                  האם יש נכדים שאת/ה תומך/ת בהם כלכלית?
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addDependent('grandchild')}
                className="gap-2 bg-white hover:bg-yellow-50"
              >
                <Plus className="w-4 h-4" />
                הוסף נכד/ה
              </Button>
            </div>

            {grandchildren.length === 0 && (
              <p className="text-sm text-[#666666] text-center py-4 bg-white rounded-lg border border-yellow-200">
                אין נכדים רשומים. לחץ על &quot;הוסף נכד/ה&quot; אם יש נכדים שאת/ה תומך/ת בהם 💛
              </p>
            )}

            <div className="space-y-3">
              {grandchildren.map((grandchild) => {
                const age = calculateAge(grandchild.birthDate);
                
                return (
                  <div key={grandchild.id} className="p-4 bg-[#FFF9E6] rounded-lg border-2 border-[#FFD700]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1E2A3B]">
                          {grandchild.name || 'נכד/ה חדש/ה'} 
                          {grandchild.birthDate && ` (גיל ${age})`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDependent(grandchild.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {/* שם */}
                      <div>
                        <Label className="text-xs text-[#555555]">שם מלא</Label>
                        <Input
                          value={grandchild.name}
                          onChange={(e) => updateDependent(grandchild.id, 'name', e.target.value)}
                          placeholder="לדוגמה: שרה לוי"
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* תאריך לידה */}
                        <div>
                          <Label className="text-xs text-[#555555]">תאריך לידה</Label>
                          <Input
                            type="date"
                            value={grandchild.birthDate}
                            onChange={(e) => updateDependent(grandchild.id, 'birthDate', e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        {/* מין */}
                        <div>
                          <Label className="text-xs text-[#555555]">מין</Label>
                          <Select 
                            value={grandchild.gender} 
                            onValueChange={(val) => updateDependent(grandchild.id, 'gender', val)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">זכר</SelectItem>
                              <SelectItem value="female">נקבה</SelectItem>
                              <SelectItem value="other">אחר</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* תמיכה כלכלית */}
                      <div className="mt-2 p-3 bg-white rounded border-2 border-yellow-400">
                        <Label className="text-sm text-[#1E2A3B] font-medium mb-2 block flex items-center gap-2">
                          💰 האם את/ה תומך/ת כלכלית ב{grandchild.name || 'נכד/ה זה/זו'}?
                        </Label>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={grandchild.isFinanciallySupported === true}
                              onChange={() => updateDependent(grandchild.id, 'isFinanciallySupported', true)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">כן</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              checked={grandchild.isFinanciallySupported === false}
                              onChange={() => updateDependent(grandchild.id, 'isFinanciallySupported', false)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">לא</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* סיכום */}
      {(children.length > 0 || grandchildren.length > 0) && (
        <div className="bg-[#E8F4FD] border-r-4 border-[#3A7BD5] rounded-lg p-4 mt-4">
          <p className="text-sm font-medium text-[#1E2A3B] mb-2">📋 סיכום משפחה:</p>
          <div className="space-y-1 text-sm text-[#555555]">
            {childrenUnder18.length > 0 && (
              <p>• {childrenUnder18.length} ילדים מתחת לגיל 18</p>
            )}
            {childrenOver18.filter(c => c.isFinanciallySupported).length > 0 && (
              <p>• {childrenOver18.filter(c => c.isFinanciallySupported).length} ילדים מעל 18 שאתה תומך בהם</p>
            )}
            {grandchildren.filter(g => g.isFinanciallySupported).length > 0 && (
              <p>• {grandchildren.filter(g => g.isFinanciallySupported).length} נכדים שאתה תומך בהם</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
