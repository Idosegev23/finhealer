export default function RecurringLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-36 mb-2" />
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 rounded-full" />
              <div>
                <div className="h-4 bg-gray-200 rounded w-28 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-20" />
              </div>
            </div>
            <div className="h-5 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
