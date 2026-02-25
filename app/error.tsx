'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-bold text-[#074259]">משהו השתבש</h1>
        <p className="text-gray-600 max-w-md">
          קרתה שגיאה לא צפויה. אנחנו עובדים על זה. נסה שוב או חזור לדשבורד.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-[#074259] text-white rounded-xl font-medium hover:bg-[#074259]/90 transition"
          >
            נסה שוב
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-[#074259] text-[#074259] rounded-xl font-medium hover:bg-gray-100 transition"
          >
            חזרה לדשבורד
          </a>
        </div>
      </div>
    </div>
  )
}
