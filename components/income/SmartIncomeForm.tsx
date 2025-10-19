"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/info-tooltip";
import {
  Plus,
  Trash2,
  Briefcase,
  Save,
  ArrowRight,
  Loader2,
  ChevronDown,
  Sparkles,
  Zap,
} from "lucide-react";

interface IncomeSource {
  id?: string;
  source_name: string;
  employment_type: string;
  gross_amount: number | null;
  net_amount: number | null;
  actual_bank_amount: number | null;
  employer_name: string;
  pension_contribution: number | null;
  advanced_study_fund: number | null;
  other_deductions: number | null;
  is_primary: boolean;
}

interface SmartIncomeFormProps {
  initialIncomeSources: any[];
}

const employmentTypes = [
  { value: "employee", label: "שכיר" },
  { value: "self_employed", label: "עצמאי" },
  { value: "freelance", label: "פרילנסר" },
];

export default function SmartIncomeForm({ initialIncomeSources }: SmartIncomeFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"fast" | "detailed">("fast");
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>(
    initialIncomeSources.length > 0
      ? initialIncomeSources
      : []
  );
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const addIncomeSource = () => {
    const newSource: IncomeSource = {
      source_name: "משכורת",
      employment_type: "employee",
      gross_amount: null,
      net_amount: null,
      actual_bank_amount: null,
      employer_name: "",
      pension_contribution: null,
      advanced_study_fund: null,
      other_deductions: null,
      is_primary: incomeSources.length === 0,
    };
    setIncomeSources((prev) => [...prev, newSource]);
  };

  const updateIncomeSource = (index: number, field: keyof IncomeSource, value: any) => {
    setIncomeSources((prev) =>
      prev.map((source, i) => (i === index ? { ...source, [field]: value } : source))
    );
  };

  const removeIncomeSource = (index: number) => {
    setIncomeSources((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      for (const source of incomeSources) {
        const res = await fetch("/api/income", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_name: source.source_name,
            employment_type: source.employment_type,
            gross_amount: source.gross_amount || 0,
            net_amount: source.net_amount || 0,
            actual_bank_amount: source.actual_bank_amount || 0,
            employer_name: source.employer_name,
            pension_contribution: source.pension_contribution || 0,
            advanced_study_fund: source.advanced_study_fund || 0,
            other_deductions: source.other_deductions || 0,
            is_primary: source.is_primary,
          }),
        });

        if (!res.ok) throw new Error("Failed to save");
      }

      // Mark section as completed
      await fetch('/api/user/section/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subsection: 'income' })
      });

      alert("✓ נשמר בהצלחה!");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      alert("שגיאה בשמירה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex justify-center gap-2 bg-white rounded-xl p-2 shadow-sm">
        <button
          onClick={() => setMode("fast")}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
            mode === "fast"
              ? "bg-[#7ED957] text-white shadow-md"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Zap className="w-4 h-4 inline ml-2" />
          מהיר
        </button>
        <button
          onClick={() => setMode("detailed")}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
            mode === "detailed"
              ? "bg-[#3A7BD5] text-white shadow-md"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Sparkles className="w-4 h-4 inline ml-2" />
          מפורט
        </button>
      </div>

      <Button onClick={addIncomeSource} className="w-full bg-[#7ED957] hover:bg-[#6BC949]">
        <Plus className="w-4 h-4 ml-2" />
        הוסף מקור הכנסה
      </Button>

      {/* Income Sources */}
      {incomeSources.map((source, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm p-6 border-2 border-gray-200 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeIncomeSource(index)}
            className="absolute top-3 left-3 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-5 h-5" />
          </Button>

          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>שם מקור הכנסה</Label>
                <Input
                  value={source.source_name}
                  onChange={(e) => updateIncomeSource(index, "source_name", e.target.value)}
                  placeholder="משכורת"
                />
              </div>

              <div>
                <Label>סוג תעסוקה</Label>
                <Select
                  value={source.employment_type}
                  onValueChange={(value) => updateIncomeSource(index, "employment_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {employmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <FieldTooltip
              label="כמה כסף נכנס לך לבנק? 💰"
              tooltip="הסכום שבאמת רואים בחשבון הבנק - זה הכי חשוב!"
              required
            >
              <div className="relative">
                <Input
                  type="number"
                  value={source.actual_bank_amount || ""}
                  onChange={(e) =>
                    updateIncomeSource(index, "actual_bank_amount", parseFloat(e.target.value) || null)
                  }
                  placeholder="10,000"
                  className="text-left pr-10 bg-green-50 border-green-300 text-lg font-semibold"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7ED957] font-bold">
                  ₪
                </span>
              </div>
            </FieldTooltip>

            {mode === "detailed" && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>ברוטו (לפני ניכויים)</Label>
                    <Input
                      type="number"
                      value={source.gross_amount || ""}
                      onChange={(e) =>
                        updateIncomeSource(index, "gross_amount", parseFloat(e.target.value) || null)
                      }
                      placeholder="15,000"
                    />
                  </div>

                  <div>
                    <Label>נטו בתלוש</Label>
                    <Input
                      type="number"
                      value={source.net_amount || ""}
                      onChange={(e) =>
                        updateIncomeSource(index, "net_amount", parseFloat(e.target.value) || null)
                      }
                      placeholder="12,000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Save Button */}
      {incomeSources.length > 0 && (
        <div className="flex gap-4 justify-center pt-6">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-[#3A7BD5] hover:bg-[#2E5BA5] px-8">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                שומר...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 ml-2" />
                שמור
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
