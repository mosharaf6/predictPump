import { Loader } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Loading PredictionPump
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we load the application...
        </p>
      </div>
    </div>
  );
}