export default function GoalsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-7 bg-gray-200 rounded w-28" />
          <div className="h-10 bg-gray-200 rounded-lg w-32" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex justify-between mb-4">
                <div className="h-5 bg-gray-200 rounded w-32" />
                <div className="h-5 bg-gray-200 rounded w-16" />
              </div>
              <div className="h-3 bg-gray-100 rounded-full w-full mb-3" />
              <div className="flex justify-between">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
