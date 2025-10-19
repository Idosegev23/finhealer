"use client";

import { useState, useEffect } from "react";
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
import { Loader2, DollarSign } from "lucide-react";

interface Loan {
  id: string;
  lender_name: string;
  loan_type: string;
  original_amount: number;
  current_balance: number;
  monthly_payment: number;
  interest_rate: number;
  remaining_payments: number;
  start_date?: string;
  loan_number?: string;
  notes?: string;
}

interface AddLoanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingLoan?: Loan | null;
}

const LOAN_TYPES = [
  { value: "mortgage", label: "משכנתא" },
  { value: "personal", label: "הלוואה אישית" },
  { value: "car", label: "הלוואת רכב" },
  { value: "student", label: "הלוואת סטודנט" },
  { value: "credit", label: "אשראי" },
  { value: "business", label: "הלוואת עסק" },
  { value: "other", label: "אחר" },
];

export function AddLoanModal({ open, onOpenChange, onSuccess, editingLoan }: AddLoanModalProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    lender_name: "",
    loan_type: "",
    original_amount: "",
    current_balance: "",
    monthly_payment: "",
    interest_rate: "",
    remaining_payments: "",
    start_date: "",
    loan_number: "",
    notes: "",
  });

  // Load editing data when modal opens
  useEffect(() => {
    if (editingLoan) {
      setFormData({
        lender_name: editingLoan.lender_name || "",
        loan_type: editingLoan.loan_type || "",
        original_amount: String(editingLoan.original_amount || ""),
        current_balance: String(editingLoan.current_balance || ""),
        monthly_payment: String(editingLoan.monthly_payment || ""),
        interest_rate: String(editingLoan.interest_rate || ""),
        remaining_payments: String(editingLoan.remaining_payments || ""),
        start_date: editingLoan.start_date || "",
        loan_number: editingLoan.loan_number || "",
        notes: editingLoan.notes || "",
      });
    } else {
      // Reset form when adding new
      setFormData({
        lender_name: "",
        loan_type: "",
        original_amount: "",
        current_balance: "",
        monthly_payment: "",
        interest_rate: "",
        remaining_payments: "",
        start_date: "",
        loan_number: "",
        notes: "",
      });
    }
    setErrors({});
  }, [editingLoan, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.lender_name.trim()) {
      newErrors.lender_name = "שם המלווה הוא שדה חובה";
    }

    if (!formData.loan_type) {
      newErrors.loan_type = "סוג ההלוואה הוא שדה חובה";
    }

    if (!formData.original_amount || Number(formData.original_amount) <= 0) {
      newErrors.original_amount = "הסכום המקורי חייב להיות גדול מ-0";
    }

    if (!formData.current_balance || Number(formData.current_balance) < 0) {
      newErrors.current_balance = "היתרה הנוכחית לא יכולה להיות שלילית";
    }

    if (!formData.monthly_payment || Number(formData.monthly_payment) <= 0) {
      newErrors.monthly_payment = "התשלום החודשי חייב להיות גדול מ-0";
    }

    if (formData.interest_rate && Number(formData.interest_rate) < 0) {
      newErrors.interest_rate = "הריבית לא יכולה להיות שלילית";
    }

    if (
      formData.current_balance &&
      formData.original_amount &&
      Number(formData.current_balance) > Number(formData.original_amount)
    ) {
      newErrors.current_balance = "היתרה הנוכחית לא יכולה להיות גדולה מהסכום המקורי";
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
        lender_name: formData.lender_name.trim(),
        loan_type: formData.loan_type,
        original_amount: Number(formData.original_amount),
        current_balance: Number(formData.current_balance),
        monthly_payment: Number(formData.monthly_payment),
        interest_rate: formData.interest_rate ? Number(formData.interest_rate) : null,
        remaining_payments: formData.remaining_payments ? Number(formData.remaining_payments) : null,
        start_date: formData.start_date || null,
        loan_number: formData.loan_number.trim() || null,
        notes: formData.notes.trim() || null,
        active: true,
      };

      // Use PATCH for editing, POST for adding new
      const method = editingLoan ? "PATCH" : "POST";
      const url = editingLoan ? `/api/loans?id=${editingLoan.id}` : "/api/loans";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to ${editingLoan ? 'update' : 'add'} loan`);
      }

      // Reset form
      setFormData({
        lender_name: "",
        loan_type: "",
        original_amount: "",
        current_balance: "",
        monthly_payment: "",
        interest_rate: "",
        remaining_payments: "",
        start_date: "",
        loan_number: "",
        notes: "",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error(`Error ${editingLoan ? 'updating' : 'adding'} loan:`, error);
      setErrors({ submit: error.message || "שגיאה בשמירת ההלוואה" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <DollarSign className="w-6 h-6 text-[#3A7BD5]" />
            {editingLoan ? "ערוך הלוואה" : "הוסף הלוואה חדשה"}
          </SheetTitle>
          <SheetDescription>
            {editingLoan ? "עדכן את הפרטים של ההלוואה" : "מלא את הפרטים כדי להתחיל לעקוב אחרי ההלוואה שלך"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              {errors.submit}
            </div>
          )}

          {/* Lender Name */}
          <div>
            <Label htmlFor="lender_name" className="flex items-center gap-2">
              שם המלווה (בנק / חברה)
              <InfoTooltip content="שם הבנק או חברת האשראי שנתנה לך את ההלוואה" />
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lender_name"
              placeholder="לדוגמה: בנק הפועלים"
              value={formData.lender_name}
              onChange={(e) => handleChange("lender_name", e.target.value)}
              className={errors.lender_name ? "border-red-500" : ""}
            />
            {errors.lender_name && <p className="text-sm text-red-500 mt-1">{errors.lender_name}</p>}
          </div>

          {/* Loan Type */}
          <div>
            <Label htmlFor="loan_type" className="flex items-center gap-2">
              סוג ההלוואה
              <InfoTooltip content="בחר את סוג ההלוואה - זה יעזור לנו לתת לך ייעוץ מדויק" />
              <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.loan_type} onValueChange={(val) => handleChange("loan_type", val)}>
              <SelectTrigger className={errors.loan_type ? "border-red-500" : ""}>
                <SelectValue placeholder="בחר סוג הלוואה" />
              </SelectTrigger>
              <SelectContent>
                {LOAN_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.loan_type && <p className="text-sm text-red-500 mt-1">{errors.loan_type}</p>}
          </div>

          {/* Grid: Original Amount + Current Balance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="original_amount" className="flex items-center gap-2">
                סכום מקורי (₪)
                <InfoTooltip content="כמה לקחת בהתחלה" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="original_amount"
                type="number"
                placeholder="50000"
                value={formData.original_amount}
                onChange={(e) => handleChange("original_amount", e.target.value)}
                className={errors.original_amount ? "border-red-500" : ""}
              />
              {errors.original_amount && <p className="text-sm text-red-500 mt-1">{errors.original_amount}</p>}
            </div>

            <div>
              <Label htmlFor="current_balance" className="flex items-center gap-2">
                יתרה נוכחית (₪)
                <InfoTooltip content="כמה נשאר לשלם היום" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="current_balance"
                type="number"
                placeholder="30000"
                value={formData.current_balance}
                onChange={(e) => handleChange("current_balance", e.target.value)}
                className={errors.current_balance ? "border-red-500" : ""}
              />
              {errors.current_balance && <p className="text-sm text-red-500 mt-1">{errors.current_balance}</p>}
            </div>
          </div>

          {/* Grid: Monthly Payment + Interest Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthly_payment" className="flex items-center gap-2">
                תשלום חודשי (₪)
                <InfoTooltip content="כמה אתה משלם כל חודש" />
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="monthly_payment"
                type="number"
                placeholder="1500"
                value={formData.monthly_payment}
                onChange={(e) => handleChange("monthly_payment", e.target.value)}
                className={errors.monthly_payment ? "border-red-500" : ""}
              />
              {errors.monthly_payment && <p className="text-sm text-red-500 mt-1">{errors.monthly_payment}</p>}
            </div>

            <div>
              <Label htmlFor="interest_rate" className="flex items-center gap-2">
                ריבית (%)
                <InfoTooltip content="אחוז הריבית השנתית" />
              </Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                placeholder="5.5"
                value={formData.interest_rate}
                onChange={(e) => handleChange("interest_rate", e.target.value)}
                className={errors.interest_rate ? "border-red-500" : ""}
              />
              {errors.interest_rate && <p className="text-sm text-red-500 mt-1">{errors.interest_rate}</p>}
            </div>
          </div>

          {/* Optional Fields */}
          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">פרטים נוספים (אופציונלי)</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="remaining_payments" className="flex items-center gap-2">
                    תשלומים נותרים
                    <InfoTooltip content="כמה תשלומים עוד נשארו עד סוף ההלוואה" />
                  </Label>
                  <Input
                    id="remaining_payments"
                    type="number"
                    placeholder="24"
                    value={formData.remaining_payments}
                    onChange={(e) => handleChange("remaining_payments", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="start_date" className="flex items-center gap-2">
                    תאריך התחלה
                    <InfoTooltip content="מתי לקחת את ההלוואה" />
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleChange("start_date", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="loan_number" className="flex items-center gap-2">
                  מספר הלוואה
                  <InfoTooltip content="מספר זיהוי ההלוואה אצל המלווה" />
                </Label>
                <Input
                  id="loan_number"
                  placeholder="לדוגמה: 123456789"
                  value={formData.loan_number}
                  onChange={(e) => handleChange("loan_number", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="notes" className="flex items-center gap-2">
                  הערות
                  <InfoTooltip content="כל מידע נוסף שתרצה לזכור" />
                </Label>
                <Input
                  id="notes"
                  placeholder="לדוגמה: הלוואה לקניית רכב חדש"
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
                editingLoan ? "עדכן הלוואה" : "שמור הלוואה"
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

