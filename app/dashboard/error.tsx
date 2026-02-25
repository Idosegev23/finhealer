'use client'

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div dir="rtl" className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-6 p-8">
        <div className="text-6xl">📊</div>
        <h1 className="text-2xl font-bold text-[#074259]">שגיאה בטעינת הדשבורד</h1>
        <p className="text-gray-600 max-w-md">
          לא הצלחנו לטעון את הנתונים שלך. ייתכן שזו בעיה זמנית.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#F2C166] text-[#074259] rounded-xl font-bold hover:bg-[#F2C166]/80 transition"
          >
            טען מחדש
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition"
          >
            חזרה לדף הראשי
          </a>
        </div>
      </div>
    </div>
  )
}
