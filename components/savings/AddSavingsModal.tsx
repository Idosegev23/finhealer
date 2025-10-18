"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Loader2, Wallet } from "lucide-react";

interface AddSavingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ACCOUNT_TYPES = [
  { value: "savings", label: "חיסכון רגיל" },
  { value: "deposit", label: "פיקדון" },
  { value: "investment", label: "קרן השתלמות" },
  { value: "pension_savings", label: "קרן פנסיה לתגמולים" },
  { value: "provident_fund", label: "קופת גמל" },
  { value: "education_fund", label: "קרן השתלמות לילדים" },
  { value: "stocks", label: "מניות / תיק השקעות" },
  { value: "crypto", label: "קריפטו" },
  { value: "other", label: "אחר" },
];

export function AddSavingsModal({ open, onOpenChange, onSuccess }: AddSavingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    account_name: "",
    account_type: "",
    institution_name: "",
    current_balance: "",
    monthly_deposit: "",
    interest_rate: "",
    maturity_date: "",
    notes: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.account_name.trim()) {
      newErrors.account_name = "שם החשבון הוא שדה חובה";
    }

    if (!formData.account_type) {
      newErrors.account_type = "סוג החשבון הוא שדה חובה";
    }

    if (!formData.institution_name.trim()) {
      newErrors.institution_name = "שם המוסד הוא שדה חובה";
    }

    if (!formData.current_balance || Number(formData.current_balance) < 0) {
      newErrors.current_balance = "היתרה הנוכחית לא יכולה להיות שלילית";
    }

    if (formData.monthly_deposit && Number(formData.monthly_deposit) < 0) {
      newErrors.monthly_deposit = "הפיקדון החודשי לא יכול להיות שלילי";
    }

    if (formData.interest_rate && Number(formData.interest_rate) < 0) {
      newErrors.interest_rate = "הריבית לא יכולה להיות שלילית";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        account_name: formData.account_name.trim(),
        account_type: formData.account_type,
        institution_name: formData.institution_name.trim(),
        current_balance: Number(formData.current_balance),
        monthly_deposit: formData.monthly_deposit ? Number(formData.monthly_deposit) : null,
        interest_rate: formData.interest_rate ? Number(formData.interest_rate) : null,
        maturity_date: formData.maturity_date || null,
        notes: formData.notes.trim() || null,
        active: true,
      };

      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add savings account");
      }

      // Reset form
      setFormData({
        account_name: "",
        account_type: "",
        institution_name: "",
        current_balance: "",
        monthly_deposit: "",
        interest_rate: "",
        maturity_date: "",
        notes: "",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding savings account:", error);
      setErrors({ submit: error.message || "שגיאה בשמירת חשבון החיסכון" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="w-6 h-6 text-[#7ED957]" />
            הוסף חשבון חיסכון
          </SheetTitle>
          <SheetDescription>מלא את הפרטים כדי להתחיל לעקוב אחרי החיסכונות שלך</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              {errors.submit}
            </div>
          )}

          {/* Account Name */}
          <div>
            <Label htmlFor="account_name" className="flex items-center gap-2">
              שם החשבון
              <InfoTooltip content="שם שיזכיר לך על מה החשבון הזה - לדוגמה: 'חיסכון לנופש', 'קרן השתלמות'" />
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="account_name"
              placeholder="לדוגמה: חיסכון לרכב"
              value={formData.account_name}
              onChange={(e) => handleChange("account_name", e.target.value)}
              className={errors.account_name ? "border-red-500" : ""}
            />
            {errors.account_name && <p className="text-sm text-red-500 mt-1">{errors.account_name}</p>}
          </div>

          {/* Grid: Account Type + Institution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account_type" className="flex items-center gap-2">
                סוג החשבון
                <InfoTooltip content="בחר את סוג חשבון החיסכון" />
                <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.account_type} onValueChange={(val) => handleChange("account_type", val)}>
                <SelectTrigger className={errors.account_type ? "border-red-500" : ""}>
                  <SelectValue placeholder="בחר סוג חשבון" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.account_type && <p className="text-sm text-red-500 mt-1">{errors.account_type}</p>}
            </div>

            <div>
              <Label htmlFor="institution_name" className="flex items-center gap-2">
                מוסד / בנק
                <InfoTooltip content="שם הבנק או החברה שבה החשבון" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="institution_name"
                placeholder="לדוגמה: בנק הפועלים"
                value={formData.institution_name}
                onChange={(e) => handleChange("institution_name", e.target.value)}
                className={errors.institution_name ? "border-red-500" : ""}
              />
              {errors.institution_name && <p className="text-sm text-red-500 mt-1">{errors.institution_name}</p>}
            </div>
          </div>

          {/* Current Balance */}
          <div>
            <Label htmlFor="current_balance" className="flex items-center gap-2">
              יתרה נוכחית (₪)
              <InfoTooltip content="כמה כסף יש בחשבון היום" />
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="current_balance"
              type="number"
              placeholder="15000"
              value={formData.current_balance}
              onChange={(e) => handleChange("current_balance", e.target.value)}
              className={errors.current_balance ? "border-red-500" : ""}
            />
            {errors.current_balance && <p className="text-sm text-red-500 mt-1">{errors.current_balance}</p>}
          </div>

          {/* Optional Fields */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">פרטים נוספים (אופציונלי)</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monthly_deposit" className="flex items-center gap-2">
                    הפקדה חודשית (₪)
                    <InfoTooltip content="כמה אתה מפקיד כל חודש (אם יש)" />
                  </Label>
                  <Input
                    id="monthly_deposit"
                    type="number"
                    placeholder="500"
                    value={formData.monthly_deposit}
                    onChange={(e) => handleChange("monthly_deposit", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="interest_rate" className="flex items-center gap-2">
                    ריבית שנתית (%)
                    <InfoTooltip content="אחוז התשואה / ריבית השנתית" />
                  </Label>
                  <Input
                    id="interest_rate"
                    type="number"
                    step="0.01"
                    placeholder="3.5"
                    value={formData.interest_rate}
                    onChange={(e) => handleChange("interest_rate", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="maturity_date" className="flex items-center gap-2">
                  תאריך פדיון
                  <InfoTooltip content="מתי אפשר למשוך את הכסף ללא קנס (אם רלוונטי)" />
                </Label>
                <Input
                  id="maturity_date"
                  type="date"
                  value={formData.maturity_date}
                  onChange={(e) => handleChange("maturity_date", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="notes" className="flex items-center gap-2">
                  הערות
                  <InfoTooltip content="כל מידע נוסף שתרצה לזכור" />
                </Label>
                <Input
                  id="notes"
                  placeholder="לדוגמה: לא לגעת עד 2026"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-[#7ED957] hover:bg-[#6BC949] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : (
                "שמור חשבון"
              )}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1" disabled={loading}>
              ביטול
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

