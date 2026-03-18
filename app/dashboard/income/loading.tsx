export default function IncomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-28 mb-2" />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-28" />
            </div>
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <div className="h-4 bg-gray-200 rounded w-36 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
              <div className="h-6 bg-gray-200 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
