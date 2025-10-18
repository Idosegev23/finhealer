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
import { Loader2, Shield } from "lucide-react";

interface AddInsuranceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const INSURANCE_TYPES = [
  { value: "health", label: "ביטוח בריאות" },
  { value: "life", label: "ביטוח חיים" },
  { value: "home", label: "ביטוח דירה" },
  { value: "car", label: "ביטוח רכב" },
  { value: "disability", label: "ביטוח אובדן כושר עבודה" },
  { value: "critical_illness", label: "ביטוח מחלות קשות" },
  { value: "travel", label: "ביטוח נסיעות" },
  { value: "pet", label: "ביטוח חיות מחמד" },
  { value: "other", label: "אחר" },
];

export function AddInsuranceModal({ open, onOpenChange, onSuccess }: AddInsuranceModalProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    insurance_type: "",
    provider: "",
    policy_number: "",
    monthly_premium: "",
    annual_premium: "",
    coverage_amount: "",
    start_date: "",
    end_date: "",
    status: "active",
    notes: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Auto-calculate annual from monthly
    if (field === "monthly_premium" && value) {
      const annual = (Number(value) * 12).toFixed(2);
      setFormData((prev) => ({ ...prev, annual_premium: annual }));
    }
    
    // Auto-calculate monthly from annual
    if (field === "annual_premium" && value) {
      const monthly = (Number(value) / 12).toFixed(2);
      setFormData((prev) => ({ ...prev, monthly_premium: monthly }));
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.insurance_type) {
      newErrors.insurance_type = "סוג הביטוח הוא שדה חובה";
    }

    if (!formData.provider.trim()) {
      newErrors.provider = "שם החברה הוא שדה חובה";
    }

    if (!formData.monthly_premium || Number(formData.monthly_premium) <= 0) {
      newErrors.monthly_premium = "הפרמיה החודשית חייבת להיות גדולה מ-0";
    }

    if (formData.coverage_amount && Number(formData.coverage_amount) < 0) {
      newErrors.coverage_amount = "גובה הכיסוי לא יכול להיות שלילי";
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
        insurance_type: formData.insurance_type,
        provider: formData.provider.trim(),
        policy_number: formData.policy_number.trim() || null,
        monthly_premium: Number(formData.monthly_premium),
        annual_premium: formData.annual_premium ? Number(formData.annual_premium) : null,
        coverage_amount: formData.coverage_amount ? Number(formData.coverage_amount) : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
        notes: formData.notes.trim() || null,
        active: formData.status === "active",
      };

      const res = await fetch("/api/insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add insurance");
      }

      // Reset form
      setFormData({
        insurance_type: "",
        provider: "",
        policy_number: "",
        monthly_premium: "",
        annual_premium: "",
        coverage_amount: "",
        start_date: "",
        end_date: "",
        status: "active",
        notes: "",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding insurance:", error);
      setErrors({ submit: error.message || "שגיאה בשמירת הביטוח" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <Shield className="w-6 h-6 text-[#3A7BD5]" />
            הוסף ביטוח חדש
          </SheetTitle>
          <SheetDescription>מלא את פרטי הביטוח כדי לנהל את כל הפוליסות במקום אחד</SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              {errors.submit}
            </div>
          )}

          {/* Insurance Type */}
          <div>
            <Label htmlFor="insurance_type" className="flex items-center gap-2">
              סוג הביטוח
              <InfoTooltip content="בחר את סוג הביטוח - בריאות, חיים, רכב, דירה, וכו'" />
              <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.insurance_type} onValueChange={(val) => handleChange("insurance_type", val)}>
              <SelectTrigger className={errors.insurance_type ? "border-red-500" : ""}>
                <SelectValue placeholder="בחר סוג ביטוח" />
              </SelectTrigger>
              <SelectContent>
                {INSURANCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.insurance_type && <p className="text-sm text-red-500 mt-1">{errors.insurance_type}</p>}
          </div>

          {/* Grid: Provider + Policy Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="provider" className="flex items-center gap-2">
                חברת ביטוח
                <InfoTooltip content="שם חברת הביטוח" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="provider"
                placeholder="לדוגמה: כלל ביטוח"
                value={formData.provider}
                onChange={(e) => handleChange("provider", e.target.value)}
                className={errors.provider ? "border-red-500" : ""}
              />
              {errors.provider && <p className="text-sm text-red-500 mt-1">{errors.provider}</p>}
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

          {/* Grid: Monthly Premium + Annual Premium */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthly_premium" className="flex items-center gap-2">
                פרמיה חודשית (₪)
                <InfoTooltip content="כמה אתה משלם כל חודש" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="monthly_premium"
                type="number"
                placeholder="150"
                value={formData.monthly_premium}
                onChange={(e) => handleChange("monthly_premium", e.target.value)}
                className={errors.monthly_premium ? "border-red-500" : ""}
              />
              {errors.monthly_premium && <p className="text-sm text-red-500 mt-1">{errors.monthly_premium}</p>}
            </div>

            <div>
              <Label htmlFor="annual_premium" className="flex items-center gap-2">
                פרמיה שנתית (₪)
                <InfoTooltip content="מחושב אוטומטית (חודשי × 12)" />
              </Label>
              <Input
                id="annual_premium"
                type="number"
                placeholder="1800"
                value={formData.annual_premium}
                onChange={(e) => handleChange("annual_premium", e.target.value)}
              />
            </div>
          </div>

          {/* Coverage Amount */}
          <div>
            <Label htmlFor="coverage_amount" className="flex items-center gap-2">
              גובה הכיסוי (₪)
              <InfoTooltip content="כמה כסף הביטוח ישלם במקרה של תביעה" />
            </Label>
            <Input
              id="coverage_amount"
              type="number"
              placeholder="1000000"
              value={formData.coverage_amount}
              onChange={(e) => handleChange("coverage_amount", e.target.value)}
              className={errors.coverage_amount ? "border-red-500" : ""}
            />
            {errors.coverage_amount && <p className="text-sm text-red-500 mt-1">{errors.coverage_amount}</p>}
          </div>

          {/* Optional Fields */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">פרטים נוספים (אופציונלי)</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date" className="flex items-center gap-2">
                    תאריך תחילה
                    <InfoTooltip content="מתי הביטוח התחיל" />
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleChange("start_date", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="end_date" className="flex items-center gap-2">
                    תאריך סיום
                    <InfoTooltip content="מתי הביטוח מסתיים (אם רלוונטי)" />
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleChange("end_date", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status" className="flex items-center gap-2">
                  סטטוס
                  <InfoTooltip content="האם הפוליסה פעילה או מבוטלת" />
                </Label>
                <Select value={formData.status} onValueChange={(val) => handleChange("status", val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">פעיל</SelectItem>
                    <SelectItem value="pending">ממתין לאישור</SelectItem>
                    <SelectItem value="expired">פג תוקף</SelectItem>
                    <SelectItem value="cancelled">מבוטל</SelectItem>
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
                  placeholder="לדוגמה: כיסוי מלא עם השתתפות עצמית של 1000 ₪"
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
                "שמור ביטוח"
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

