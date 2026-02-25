import Link from 'next/link'

export default function NotFound() {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <div className="text-8xl font-bold text-[#074259]/20">404</div>
        <h1 className="text-2xl font-bold text-[#074259]">העמוד לא נמצא</h1>
        <p className="text-gray-600 max-w-md">
          לא הצלחנו למצוא את העמוד שחיפשת. ייתכן שהקישור שגוי או שהעמוד הוסר.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-[#074259] text-white rounded-xl font-medium hover:bg-[#074259]/90 transition"
          >
            חזרה לדשבורד
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-[#074259] text-[#074259] rounded-xl font-medium hover:bg-gray-100 transition"
          >
            התחברות
          </Link>
        </div>
      </div>
    </div>
  )
}
