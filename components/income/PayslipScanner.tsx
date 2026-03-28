"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, CheckCircle, XCircle, Scan } from "lucide-react";
import Image from "next/image";

interface PayslipData {
  gross: number | null;
  net: number | null;
  pension: number | null;
  advancedStudy: number | null;
  tax: number | null;
  nationalInsurance: number | null;
  employerName: string;
  confidence: number;
}

interface PayslipScannerProps {
  onDataExtracted: (data: PayslipData) => void;
}

export default function PayslipScanner({ onDataExtracted }: PayslipScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsScanning(true);
    setScanSuccess(false);
    setScanError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ocr/payslip", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to scan payslip");
      }

      const result = await response.json();
      
      if (result.data && result.data.confidence > 0.5) {
        setScanSuccess(true);
        onDataExtracted(result.data);
        
        // Auto-close success message after 2 seconds
        setTimeout(() => {
          setScanSuccess(false);
        }, 2000);
      } else {
        throw new Error("Confidence too low");
      }
    } catch (error) {
      console.error("Error scanning payslip:", error);
      setScanError("לא הצלחנו לקרוא את התלוש. אנא מלא ידנית או נסה תמונה ברורה יותר.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div className="space-y-4 opacity-60 pointer-events-none relative">
      <div className="bg-orange-100 border border-orange-300 text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold text-center mb-4 pointer-events-auto">
        🚧 סריקת תלושים נמצאת בפיתוח - אנא מלאו ידנית
      </div>
      {/* Upload Buttons */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={true}
          className="flex-1 border-dashed border-2 border-[#3A7BD5] text-phi-dark hover:bg-blue-50"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              סורק תלוש...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 ml-2" />
              העלה תמונת תלוש שכר
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
          <Image
            src={preview}
            alt="Payslip preview"
            width={400}
            height={300}
            className="w-full h-auto"
          />
          {isScanning && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <div className="text-center text-white">
                <Scan className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                <p className="text-sm">קורא את התלוש...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {scanSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 animate-scale-in">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-900">התלוש נקרא בהצלחה! ✓</p>
            <p className="text-sm text-green-700">בדוק שהנתונים נכונים ותקן אם צריך</p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {scanError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">לא הצלחנו לקרוא את התלוש</p>
            <p className="text-sm text-red-700 mt-1">{scanError}</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 טיפ:</strong> לתוצאות הכי טובות, צלם את התלוש במאור טוב, ודאג שהטקסט ברור וקריא.
          התמיכה בעברית טובה, אבל לפעמים צריך לתקן ידנית.
        </p>
      </div>
    </div>
  );
}

