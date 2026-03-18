export default function ExpensesLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-28 mb-2" />

        {/* Chart skeleton */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 h-72">
          <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
          <div className="h-52 bg-gray-100 rounded-lg" />
        </div>

        {/* Type cards */}
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-5 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>

        {/* Month cards */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-5 bg-gray-200 rounded w-24" />
            </div>
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex items-center gap-3 py-2 border-b border-gray-50">
                <div className="h-4 bg-gray-200 rounded flex-1" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
