'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center" dir="rtl">
      <h2 className="text-xl font-bold text-gray-800">שגיאה בטעינת הטבלה הפיננסית</h2>
      <p className="text-gray-500 text-sm max-w-md">אירעה שגיאה. נסו שוב.</p>
      <button onClick={reset} className="px-6 py-2 bg-[#074259] text-white rounded-lg hover:opacity-90">
        נסה שוב
      </button>
    </div>
  );
}
