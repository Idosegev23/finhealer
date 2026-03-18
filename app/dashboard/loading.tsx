export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 bg-gray-200 rounded-lg w-48 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
          <div className="h-10 bg-gray-200 rounded-full w-10" />
        </div>

        {/* Score card skeleton */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 rounded w-40" />
              <div className="h-3 bg-gray-200 rounded w-60" />
            </div>
          </div>
        </div>

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-28 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-100 h-64">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-40 bg-gray-100 rounded-lg" />
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100 h-64">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
            <div className="h-40 bg-gray-100 rounded-lg" />
          </div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-36 mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-50">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded flex-1" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
