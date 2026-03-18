export default function LoansLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-28 mb-2" />
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-28" />
            </div>
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between mb-3">
              <div className="h-5 bg-gray-200 rounded w-40" />
              <div className="h-5 bg-gray-200 rounded w-20" />
            </div>
            <div className="h-3 bg-gray-100 rounded-full w-full mb-2" />
            <div className="flex gap-6">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
