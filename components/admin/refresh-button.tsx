"use client";

export default function RefreshButton() {
  return (
    <button
      className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left w-full"
      onClick={() => window.location.reload()}
    >
      <svg
        className="h-8 w-8 text-gray-400 mr-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-gray-900">Refresh Data</p>
        <p className="text-xs text-gray-500">Reload dashboard</p>
      </div>
    </button>
  );
}

