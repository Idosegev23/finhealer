"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Target, Wallet } from "lucide-react";

interface AddSavingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface GoalOption {
  id: string;
  goal_name: string;
  target_amount: number;
  current_amount: number;
}

// Must match the DB CHECK on savings_accounts.account_type:
// savings | deposit | investment | emergency_fund | goal_based | other.
// Pension/provident/study funds belong in pension_insurance, not here.
const ACCOUNT_TYPES = [
  { value: "savings", label: "חיסכון רגיל" },
  { value: "deposit", label: "פיקדון" },
  { value: "investment", label: "השקעה / מניות" },
  { value: "emergency_fund", label: "קרן חירום" },
  { value: "goal_based", label: "חיסכון מיועד ליעד" },
  { value: "other", label: "אחר" },
];

export function AddSavingsModal({ open, onOpenChange, onSuccess }: AddSavingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [formData, setFormData] = useState({
    account_name: "",
    account_type: "",
    bank_name: "",
    current_balance: "",
    monthly_deposit: "",
    annual_return: "",
    target_date: "",
    target_amount: "",
    goal_id: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => setGoals(Array.isArray(d?.goals) ? d.goals : Array.isArray(d) ? d : []))
      .catch(() => setGoals([]));
  }, [open]);

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

    if (!formData.bank_name.trim()) {
      newErrors.bank_name = "שם המוסד הוא שדה חובה";
    }

    if (!formData.current_balance || Number(formData.current_balance) < 0) {
      newErrors.current_balance = "היתרה הנוכחית לא יכולה להיות שלילית";
    }

    if (formData.monthly_deposit && Number(formData.monthly_deposit) < 0) {
      newErrors.monthly_deposit = "ההפקדה החודשית לא יכולה להיות שלילית";
    }

    if (formData.annual_return && Number(formData.annual_return) < 0) {
      newErrors.annual_return = "התשואה לא יכולה להיות שלילית";
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
        bank_name: formData.bank_name.trim(),
        current_balance: Number(formData.current_balance),
        monthly_deposit: formData.monthly_deposit ? Number(formData.monthly_deposit) : 0,
        annual_return: formData.annual_return ? Number(formData.annual_return) : null,
        target_amount: formData.target_amount ? Number(formData.target_amount) : null,
        target_date: formData.target_date || null,
        goal_id: formData.goal_id || null,
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
        bank_name: "",
        current_balance: "",
        monthly_deposit: "",
        annual_return: "",
        target_date: "",
        target_amount: "",
        goal_id: "",
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
            <Wallet className="w-6 h-6 text-phi-mint" />
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
              <Label htmlFor="bank_name" className="flex items-center gap-2">
                מוסד / בנק
                <InfoTooltip content="שם הבנק או החברה שבה החשבון" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bank_name"
                placeholder="לדוגמה: בנק הפועלים"
                value={formData.bank_name}
                onChange={(e) => handleChange("bank_name", e.target.value)}
                className={errors.bank_name ? "border-red-500" : ""}
              />
              {errors.bank_name && <p className="text-sm text-red-500 mt-1">{errors.bank_name}</p>}
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
                  <Label htmlFor="annual_return" className="flex items-center gap-2">
                    תשואה / ריבית שנתית (%)
                    <InfoTooltip content="אחוז התשואה / ריבית השנתית" />
                  </Label>
                  <Input
                    id="annual_return"
                    type="number"
                    step="0.01"
                    placeholder="3.5"
                    value={formData.annual_return}
                    onChange={(e) => handleChange("annual_return", e.target.value)}
                    className={errors.annual_return ? "border-red-500" : ""}
                  />
                  {errors.annual_return && <p className="text-sm text-red-500 mt-1">{errors.annual_return}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_amount" className="flex items-center gap-2">
                    סכום יעד (₪)
                    <InfoTooltip content="לאיזה סכום אתה שואף להגיע" />
                  </Label>
                  <Input
                    id="target_amount"
                    type="number"
                    placeholder="100000"
                    value={formData.target_amount}
                    onChange={(e) => handleChange("target_amount", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="target_date" className="flex items-center gap-2">
                    תאריך יעד
                    <InfoTooltip content="מתי אתה רוצה להגיע לסכום היעד / מתי הפדיון" />
                  </Label>
                  <Input
                    id="target_date"
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => handleChange("target_date", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="goal_id" className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-phi-mint" />
                  קישור ליעד פיננסי
                  <InfoTooltip content="קשר את החיסכון ליעד שהגדרת — הצבירה תספר אוטומטית להתקדמות היעד" />
                </Label>
                <Select
                  value={formData.goal_id || "_none"}
                  onValueChange={(val) => handleChange("goal_id", val === "_none" ? "" : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={goals.length ? "בחר יעד (אופציונלי)" : "אין יעדים פעילים"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">ללא קישור ליעד</SelectItem>
                    {goals.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.goal_name} · ₪{Number(g.target_amount || 0).toLocaleString("he-IL")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              className="flex-1 bg-phi-mint hover:bg-phi-mint/90 text-white"
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

