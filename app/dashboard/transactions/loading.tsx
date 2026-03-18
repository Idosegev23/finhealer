export default function TransactionsLoading() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl animate-pulse">
        <div className="mb-4">
          <div className="h-7 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>

        {/* Stats cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="h-3 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-6 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 mb-6">
          <div className="grid md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Table rows */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-50">
              <div className="h-8 w-8 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-40" />
                <div className="h-3 bg-gray-200 rounded w-24" />
              </div>
              <div className="h-5 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
