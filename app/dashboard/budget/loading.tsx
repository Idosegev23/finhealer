export default function BudgetLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-28 mb-2" />
        <div className="flex gap-3 mb-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded-full w-24" />
          ))}
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-gray-50">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="flex items-center gap-4">
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-3 bg-gray-100 rounded-full w-24" />
                  <div className="h-3 bg-gray-200 rounded w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
