export default function OverviewLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-7 bg-gray-200 rounded w-36 mb-2" />
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-100 h-72">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-52 bg-gray-100 rounded-lg" />
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100 h-72">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-52 bg-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
