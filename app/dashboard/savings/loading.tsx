export default function SavingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-28 mb-2" />
        <div className="bg-white rounded-xl p-6 border border-gray-100 h-48">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="h-28 bg-gray-100 rounded-lg" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex justify-between mb-2">
              <div className="h-5 bg-gray-200 rounded w-36" />
              <div className="h-5 bg-gray-200 rounded w-24" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
