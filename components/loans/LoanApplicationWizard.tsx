"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Loader2, FileText, Upload, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { getRequiredDocuments, calculateCompletionPercentage, getMissingDocuments, DocumentRequirement } from "@/lib/loanDocuments";
import type { Database } from "@/types/database.types";

type LoanApplication = Database["public"]["Tables"]["loan_applications"]["Row"];

interface LoanApplicationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingLoans?: any[];
}

const EMPLOYMENT_TYPES = [
  { value: "employee", label: "שכיר" },
  { value: "self_employed", label: "עצמאי" },
  { value: "business_owner", label: "בעל עסק / שכיר בעל שליטה" },
  { value: "spouse_employee", label: "שכיר + בן/בת זוג שכיר" },
];

const APPLICATION_TYPES = [
  { value: "regular", label: "הלוואה רגילה (לא לצרכי דיור)" },
  { value: "mortgage", label: "הלוואה לצרכי דיור / משכנתא" },
];

export function LoanApplicationWizard({ open, onOpenChange, onSuccess, existingLoans = [] }: LoanApplicationWizardProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    application_type: "regular" as "regular" | "mortgage",
    employment_type: "employee" as "employee" | "self_employed" | "business_owner" | "spouse_employee",
    applicant_name: "",
    applicant_id_number: "",
    applicant_phone: "",
    applicant_email: "",
    spouse_name: "",
    spouse_id_number: "",
    business_name: "",
    business_number: "",
    requested_amount: "",
    requested_term_months: "",
    purpose: "",
    property_address: "",
    property_value: "",
  });

  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get required documents based on selection
  const requiredDocs = getRequiredDocuments(formData.application_type, formData.employment_type);
  const completionPercentage = calculateCompletionPercentage(requiredDocs, uploadedDocuments);
  const missingDocs = getMissingDocuments(requiredDocs, uploadedDocuments);

  // Load draft application on mount
  useEffect(() => {
    if (open) {
      loadDraftApplication();
    }
  }, [open]);

  const loadDraftApplication = async () => {
    try {
      const res = await fetch("/api/loan-applications");
      if (res.ok) {
        const { data } = await res.json();
        const draft = data?.find((app: LoanApplication) => app.status === "draft");
        
        if (draft) {
          setApplicationId(draft.id);
          setFormData({
            application_type: draft.application_type as any,
            employment_type: draft.employment_type as any,
            applicant_name: draft.applicant_name || "",
            applicant_id_number: draft.applicant_id_number || "",
            applicant_phone: draft.applicant_phone || "",
            applicant_email: draft.applicant_email || "",
            spouse_name: draft.spouse_name || "",
            spouse_id_number: draft.spouse_id_number || "",
            business_name: draft.business_name || "",
            business_number: draft.business_number || "",
            requested_amount: draft.requested_amount?.toString() || "",
            requested_term_months: draft.requested_term_months?.toString() || "",
            purpose: draft.purpose || "",
            property_address: draft.property_address || "",
            property_value: draft.property_value?.toString() || "",
          });
          
          // Load uploaded documents
          fetchDocuments(draft.id);
        }
      }
    } catch (error) {
      console.error("Error loading draft:", error);
    }
  };

  const fetchDocuments = async (appId: string) => {
    try {
      const res = await fetch(`/api/loan-applications/documents?applicationId=${appId}`);
      if (res.ok) {
        const { data } = await res.json();
        const docTypes = data.map((doc: any) => doc.document_type);
        setUploadedDocuments(docTypes);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const saveProgress = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        requested_amount: formData.requested_amount ? parseFloat(formData.requested_amount) : null,
        requested_term_months: formData.requested_term_months ? parseInt(formData.requested_term_months) : null,
        property_value: formData.property_value ? parseFloat(formData.property_value) : null,
        status: "draft",
      };

      const method = applicationId ? "PATCH" : "POST";
      const url = applicationId ? `/api/loan-applications?id=${applicationId}` : "/api/loan-applications";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }

      const { data } = await res.json();
      setApplicationId(data.id);
      
      return data.id;
    } catch (error: any) {
      console.error("Error saving progress:", error);
      setErrors({ submit: error.message || "שגיאה בשמירת הנתונים" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (docType: string, file: File) => {
    if (!applicationId) {
      const newAppId = await saveProgress();
      if (!newAppId) return;
    }

    setUploading(true);
    try {
      // TODO: Upload to Supabase Storage
      // For now, just simulate upload
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Mark document as uploaded
      setUploadedDocuments((prev) => [...prev, docType]);
      
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert("שגיאה בהעלאת הקובץ");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (missingDocs.length > 0) {
      alert(`חסרים ${missingDocs.length} מסמכים נדרשים`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/loan-applications?id=${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "submitted", submitted_at: new Date().toISOString() }),
      });

      if (!res.ok) throw new Error("Failed to submit application");

      alert("✓ הבקשה נשלחה בהצלחה! גדי יחזור אליך בקרוב");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error submitting:", error);
      alert("שגיאה בשליחת הבקשה");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1) {
      const saved = await saveProgress();
      if (saved) setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto" dir="rtl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <FileText className="w-6 h-6 text-[#3A7BD5]" />
            בקשה לאיחוד הלוואות
          </SheetTitle>
          <SheetDescription>
            מלא את הפרטים והעלה את המסמכים הנדרשים. כל ההתקדמות נשמרת אוטומטית.
          </SheetDescription>
        </SheetHeader>

        {/* Progress Bar */}
        <div className="my-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">שלב {currentStep} מתוך 3</span>
            <span className="text-sm text-gray-500">
              {currentStep === 3 && `${completionPercentage}% מסמכים הועלו`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#3A7BD5] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold">פרטים בסיסיים</h3>
            
            <div>
              <Label>סוג הבקשה</Label>
              <Select value={formData.application_type} onValueChange={(val) => handleChange("application_type", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>סטטוס תעסוקה</Label>
              <Select value={formData.employment_type} onValueChange={(val) => handleChange("employment_type", val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>שם מלא</Label>
                <Input value={formData.applicant_name} onChange={(e) => handleChange("applicant_name", e.target.value)} />
              </div>
              <div>
                <Label>תעודת זהות</Label>
                <Input value={formData.applicant_id_number} onChange={(e) => handleChange("applicant_id_number", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>טלפון</Label>
                <Input value={formData.applicant_phone} onChange={(e) => handleChange("applicant_phone", e.target.value)} />
              </div>
              <div>
                <Label>אימייל</Label>
                <Input type="email" value={formData.applicant_email} onChange={(e) => handleChange("applicant_email", e.target.value)} />
              </div>
            </div>

            {formData.employment_type === "spouse_employee" && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                <div>
                  <Label>שם בן/בת הזוג</Label>
                  <Input value={formData.spouse_name} onChange={(e) => handleChange("spouse_name", e.target.value)} />
                </div>
                <div>
                  <Label>ת.ז. בן/בת הזוג</Label>
                  <Input value={formData.spouse_id_number} onChange={(e) => handleChange("spouse_id_number", e.target.value)} />
                </div>
              </div>
            )}

            {formData.employment_type === "business_owner" && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg">
                <div>
                  <Label>שם העסק</Label>
                  <Input value={formData.business_name} onChange={(e) => handleChange("business_name", e.target.value)} />
                </div>
                <div>
                  <Label>מספר עוסק / ח.פ.</Label>
                  <Input value={formData.business_number} onChange={(e) => handleChange("business_number", e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Loan Details */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold">פרטי ההלוואה המבוקשת</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>סכום מבוקש (₪)</Label>
                <Input
                  type="number"
                  value={formData.requested_amount}
                  onChange={(e) => handleChange("requested_amount", e.target.value)}
                />
              </div>
              <div>
                <Label>תקופה (חודשים)</Label>
                <Input
                  type="number"
                  value={formData.requested_term_months}
                  onChange={(e) => handleChange("requested_term_months", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>מטרת ההלוואה</Label>
              <Input value={formData.purpose} onChange={(e) => handleChange("purpose", e.target.value)} />
            </div>

            {formData.application_type === "mortgage" && (
              <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold">פרטי הנכס</h4>
                <div>
                  <Label>כתובת הנכס</Label>
                  <Input value={formData.property_address} onChange={(e) => handleChange("property_address", e.target.value)} />
                </div>
                <div>
                  <Label>שווי הנכס (₪)</Label>
                  <Input
                    type="number"
                    value={formData.property_value}
                    onChange={(e) => handleChange("property_value", e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Show existing loans summary */}
            {existingLoans.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">ההלוואות הקיימות שלך:</h4>
                {existingLoans.map((loan, idx) => (
                  <div key={idx} className="text-sm text-gray-700">
                    • {loan.lender_name}: ₪{loan.current_balance.toLocaleString('he-IL')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Documents Checklist */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold">העלאת מסמכים ({completionPercentage}% הושלם)</h3>

            <div className="space-y-3">
              {requiredDocs.map((doc) => {
                const isUploaded = uploadedDocuments.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    className={`border-2 rounded-lg p-4 transition-all ${
                      isUploaded
                        ? "border-green-500 bg-green-50"
                        : doc.required
                        ? "border-orange-300 bg-orange-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{doc.label}</h4>
                          {doc.required && !isUploaded && (
                            <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded">
                              חובה
                            </span>
                          )}
                          {isUploaded && <CheckCircle className="w-5 h-5 text-green-600" />}
                          <InfoTooltip content={doc.description} type="info" />
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                        
                        {doc.externalLink && (
                          <a
                            href={doc.externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            לחץ כאן להפקת המסמך
                          </a>
                        )}
                      </div>
                      
                      <div>
                        {!isUploaded ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={uploading}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = doc.accepts || "*/*";
                              input.onchange = (e: any) => {
                                const file = e.target.files[0];
                                if (file) handleFileUpload(doc.id, file);
                              };
                              input.click();
                            }}
                          >
                            <Upload className="w-4 h-4 ml-2" />
                            העלה
                          </Button>
                        ) : (
                          <span className="text-sm text-green-600 font-medium">✓ הועלה</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {missingDocs.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-900">חסרים {missingDocs.length} מסמכים חובה</h4>
                    <p className="text-sm text-yellow-800 mt-1">
                      לא תוכל להגיש את הבקשה עד שכל המסמכים הנדרשים יועלו
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-8">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={loading}
            >
              חזור
            </Button>
          )}
          
          {currentStep < 3 ? (
            <Button
              onClick={nextStep}
              disabled={loading}
              className="flex-1 bg-[#3A7BD5] hover:bg-[#2E5EA5] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שומר...
                </>
              ) : (
                "המשך"
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || missingDocs.length > 0}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שולח...
                </>
              ) : (
                "הגש בקשה לגדי"
              )}
            </Button>
          )}
        </div>

        {errors.submit && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {errors.submit}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

