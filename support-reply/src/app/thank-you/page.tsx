'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ThankYouPage() {
  const [isActivating, setIsActivating] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivatePro = async () => {
    if (isActivating) return;
    
    setIsActivating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debug/set-pro', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to activate Pro');
      }
      
      setIsActivated(true);
    } catch (error: any) {
      console.error('Activation error:', error);
      setError(error.message || 'Failed to activate Pro');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Checkout Complete
            </h1>
            <p className="text-gray-600 text-sm">
              (test mode)
            </p>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              Activate Pro to finish.
            </p>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {isActivated ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-medium">Pro activated ✓</p>
              </div>
            ) : (
              <button
                onClick={handleActivatePro}
                disabled={isActivating}
                className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isActivating ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Activating...
                  </div>
                ) : (
                  'Activate Pro'
                )}
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Link
              href="/"
              className="text-orange-600 hover:text-orange-700 text-sm font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
