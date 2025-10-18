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
import { Loader2, Landmark } from "lucide-react";

interface AddPensionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const FUND_TYPES = [
  { value: "pension_comprehensive", label: "פנסיה מקיפה" },
  { value: "pension_general", label: "פנסיה כללית" },
  { value: "provident_fund", label: "קופת גמל להשקעה" },
  { value: "severance_fund", label: "קופת גמל לפיצויים" },
  { value: "advanced_study_fund", label: "קרן השתלמות" },
  { value: "managers_insurance", label: "ביטוח מנהלים" },
  { value: "other", label: "אחר" },
];

const EMPLOYEE_TYPES = [
  { value: "employee", label: "שכיר" },
  { value: "self_employed", label: "עצמאי" },
  { value: "freelance", label: "פרילנסר" },
];

export function AddPensionModal({ open, onOpenChange, onSuccess }: AddPensionModalProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    fund_name: "",
    fund_type: "",
    provider: "",
    employee_type: "",
    policy_number: "",
    current_balance: "",
    monthly_deposit: "",
    employee_contribution: "",
    employer_contribution: "",
    management_fee_percentage: "",
    deposit_fee_percentage: "",
    annual_return: "",
    seniority_date: "",
    start_date: "",
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

    if (!formData.fund_name.trim()) {
      newErrors.fund_name = "שם הקרן הוא שדה חובה";
    }

    if (!formData.fund_type) {
      newErrors.fund_type = "סוג הקרן הוא שדה חובה";
    }

    if (!formData.provider.trim()) {
      newErrors.provider = "שם החברה המנהלת הוא שדה חובה";
    }

    if (formData.current_balance && Number(formData.current_balance) < 0) {
      newErrors.current_balance = "היתרה הנוכחית לא יכולה להיות שלילית";
    }

    if (formData.monthly_deposit && Number(formData.monthly_deposit) < 0) {
      newErrors.monthly_deposit = "ההפקדה החודשית לא יכולה להיות שלילית";
    }

    if (formData.management_fee_percentage && Number(formData.management_fee_percentage) < 0) {
      newErrors.management_fee_percentage = "דמי הניהול לא יכולים להיות שליליים";
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
        fund_name: formData.fund_name.trim(),
        fund_type: formData.fund_type,
        provider: formData.provider.trim(),
        employee_type: formData.employee_type || null,
        policy_number: formData.policy_number.trim() || null,
        current_balance: formData.current_balance ? Number(formData.current_balance) : null,
        monthly_deposit: formData.monthly_deposit ? Number(formData.monthly_deposit) : null,
        employee_contribution: formData.employee_contribution ? Number(formData.employee_contribution) : null,
        employer_contribution: formData.employer_contribution ? Number(formData.employer_contribution) : null,
        management_fee_percentage: formData.management_fee_percentage
          ? Number(formData.management_fee_percentage)
          : null,
        deposit_fee_percentage: formData.deposit_fee_percentage ? Number(formData.deposit_fee_percentage) : null,
        annual_return: formData.annual_return ? Number(formData.annual_return) : null,
        seniority_date: formData.seniority_date || null,
        start_date: formData.start_date || null,
        notes: formData.notes.trim() || null,
        active: true,
      };

      const res = await fetch("/api/pensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add pension");
      }

      // Reset form
      setFormData({
        fund_name: "",
        fund_type: "",
        provider: "",
        employee_type: "",
        policy_number: "",
        current_balance: "",
        monthly_deposit: "",
        employee_contribution: "",
        employer_contribution: "",
        management_fee_percentage: "",
        deposit_fee_percentage: "",
        annual_return: "",
        seniority_date: "",
        start_date: "",
        notes: "",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding pension:", error);
      setErrors({ submit: error.message || "שגיאה בשמירת קרן הפנסיה" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <Landmark className="w-6 h-6 text-[#3A7BD5]" />
            הוסף קרן פנסיה / גמל
          </SheetTitle>
          <SheetDescription>מלא את הפרטים כדי לעקוב אחרי החיסכון הפנסיוני שלך</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              {errors.submit}
            </div>
          )}

          {/* Fund Name */}
          <div>
            <Label htmlFor="fund_name" className="flex items-center gap-2">
              שם הקרן
              <InfoTooltip content="שם קרן הפנסיה או קופת הגמל" />
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fund_name"
              placeholder="לדוגמה: מנורה מבטחים פנסיה"
              value={formData.fund_name}
              onChange={(e) => handleChange("fund_name", e.target.value)}
              className={errors.fund_name ? "border-red-500" : ""}
            />
            {errors.fund_name && <p className="text-sm text-red-500 mt-1">{errors.fund_name}</p>}
          </div>

          {/* Grid: Fund Type + Provider */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fund_type" className="flex items-center gap-2">
                סוג הקרן
                <InfoTooltip content="בחר את סוג קרן הפנסיה או קופת הגמל" />
                <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.fund_type} onValueChange={(val) => handleChange("fund_type", val)}>
                <SelectTrigger className={errors.fund_type ? "border-red-500" : ""}>
                  <SelectValue placeholder="בחר סוג קרן" />
                </SelectTrigger>
                <SelectContent>
                  {FUND_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fund_type && <p className="text-sm text-red-500 mt-1">{errors.fund_type}</p>}
            </div>

            <div>
              <Label htmlFor="provider" className="flex items-center gap-2">
                חברה מנהלת
                <InfoTooltip content="שם החברה המנהלת את הקרן" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="provider"
                placeholder="לדוגמה: מנורה מבטחים"
                value={formData.provider}
                onChange={(e) => handleChange("provider", e.target.value)}
                className={errors.provider ? "border-red-500" : ""}
              />
              {errors.provider && <p className="text-sm text-red-500 mt-1">{errors.provider}</p>}
            </div>
          </div>

          {/* Grid: Employee Type + Policy Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="employee_type" className="flex items-center gap-2">
                סוג עובד
                <InfoTooltip content="האם אתה שכיר או עצמאי" />
              </Label>
              <Select value={formData.employee_type} onValueChange={(val) => handleChange("employee_type", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג עובד" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="policy_number" className="flex items-center gap-2">
                מספר פוליסה
                <InfoTooltip content="מספר זיהוי הפוליסה" />
              </Label>
              <Input
                id="policy_number"
                placeholder="לדוגמה: 123456789"
                value={formData.policy_number}
                onChange={(e) => handleChange("policy_number", e.target.value)}
              />
            </div>
          </div>

          {/* Grid: Current Balance + Monthly Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="current_balance" className="flex items-center gap-2">
                יתרה נוכחית (₪)
                <InfoTooltip content="כמה צברת עד היום" />
              </Label>
              <Input
                id="current_balance"
                type="number"
                placeholder="50000"
                value={formData.current_balance}
                onChange={(e) => handleChange("current_balance", e.target.value)}
                className={errors.current_balance ? "border-red-500" : ""}
              />
              {errors.current_balance && <p className="text-sm text-red-500 mt-1">{errors.current_balance}</p>}
            </div>

            <div>
              <Label htmlFor="monthly_deposit" className="flex items-center gap-2">
                הפקדה חודשית (₪)
                <InfoTooltip content="סה&quot;כ ההפקדה החודשית (עובד + מעסיק)" />
              </Label>
              <Input
                id="monthly_deposit"
                type="number"
                placeholder="1500"
                value={formData.monthly_deposit}
                onChange={(e) => handleChange("monthly_deposit", e.target.value)}
                className={errors.monthly_deposit ? "border-red-500" : ""}
              />
              {errors.monthly_deposit && <p className="text-sm text-red-500 mt-1">{errors.monthly_deposit}</p>}
            </div>
          </div>

          {/* Optional Fields */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">פרטים נוספים (אופציונלי)</h3>

            <div className="space-y-4">
              {/* Grid: Employee Contribution + Employer Contribution */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee_contribution" className="flex items-center gap-2">
                    הפקדת עובד (%)
                    <InfoTooltip content="אחוז ההפקדה שלך מהשכר" />
                  </Label>
                  <Input
                    id="employee_contribution"
                    type="number"
                    step="0.1"
                    placeholder="6.0"
                    value={formData.employee_contribution}
                    onChange={(e) => handleChange("employee_contribution", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="employer_contribution" className="flex items-center gap-2">
                    הפקדת מעסיק (%)
                    <InfoTooltip content="אחוז ההפקדה של המעסיק" />
                  </Label>
                  <Input
                    id="employer_contribution"
                    type="number"
                    step="0.1"
                    placeholder="6.5"
                    value={formData.employer_contribution}
                    onChange={(e) => handleChange("employer_contribution", e.target.value)}
                  />
                </div>
              </div>

              {/* Grid: Management Fee + Deposit Fee */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="management_fee_percentage" className="flex items-center gap-2">
                    דמי ניהול (%)
                    <InfoTooltip content="אחוז דמי הניהול השנתיים" />
                  </Label>
                  <Input
                    id="management_fee_percentage"
                    type="number"
                    step="0.01"
                    placeholder="0.5"
                    value={formData.management_fee_percentage}
                    onChange={(e) => handleChange("management_fee_percentage", e.target.value)}
                    className={errors.management_fee_percentage ? "border-red-500" : ""}
                  />
                  {errors.management_fee_percentage && (
                    <p className="text-sm text-red-500 mt-1">{errors.management_fee_percentage}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="deposit_fee_percentage" className="flex items-center gap-2">
                    דמי הפקדה (%)
                    <InfoTooltip content="אחוז העמלה על הפקדה" />
                  </Label>
                  <Input
                    id="deposit_fee_percentage"
                    type="number"
                    step="0.01"
                    placeholder="0.0"
                    value={formData.deposit_fee_percentage}
                    onChange={(e) => handleChange("deposit_fee_percentage", e.target.value)}
                  />
                </div>
              </div>

              {/* Grid: Annual Return + Seniority Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="annual_return" className="flex items-center gap-2">
                    תשואה שנתית (%)
                    <InfoTooltip content="התשואה השנתית הממוצעת" />
                  </Label>
                  <Input
                    id="annual_return"
                    type="number"
                    step="0.1"
                    placeholder="5.2"
                    value={formData.annual_return}
                    onChange={(e) => handleChange("annual_return", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="seniority_date" className="flex items-center gap-2">
                    תאריך ותק
                    <InfoTooltip content="התאריך שממנו מחושב הוותק בפנסיה" />
                  </Label>
                  <Input
                    id="seniority_date"
                    type="date"
                    value={formData.seniority_date}
                    onChange={(e) => handleChange("seniority_date", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="start_date" className="flex items-center gap-2">
                  תאריך התחלה
                  <InfoTooltip content="מתי התחלת את הקרן" />
                </Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange("start_date", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="notes" className="flex items-center gap-2">
                  הערות
                  <InfoTooltip content="כל מידע נוסף שתרצה לזכור" />
                </Label>
                <Input
                  id="notes"
                  placeholder="לדוגמה: קרן פנסיה מעבודה קודמת"
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
              className="flex-1 bg-[#3A7BD5] hover:bg-[#2A5BA5] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : (
                "שמור קרן"
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

