import * as React from 'react';

interface AIProcessingIndicatorProps {
  isProcessing: boolean;
  message?: string;
}

export function AIProcessingIndicator({ isProcessing, message = "AI is processing..." }: AIProcessingIndicatorProps) {
  if (!isProcessing) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full mx-4">
        <div className="flex flex-col items-center">
          {/* Animated Brain/Circuit Icon */}
          <div className="relative w-24 h-24 mb-6">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Brain outline */}
              <path
                d="M50 20 C30 20 20 35 20 50 C20 65 30 80 50 80 C70 80 80 65 80 50 C80 35 70 20 50 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-purple-300"
              />
              
              {/* Animated neural pathways */}
              <g className="animate-pulse">
                <circle cx="35" cy="40" r="3" fill="currentColor" className="text-purple-500" />
                <circle cx="65" cy="40" r="3" fill="currentColor" className="text-purple-500" />
                <circle cx="50" cy="60" r="3" fill="currentColor" className="text-purple-500" />
                
                <line x1="35" y1="40" x2="50" y2="60" stroke="currentColor" strokeWidth="1" className="text-purple-400" />
                <line x1="65" y1="40" x2="50" y2="60" stroke="currentColor" strokeWidth="1" className="text-purple-400" />
                <line x1="35" y1="40" x2="65" y2="40" stroke="currentColor" strokeWidth="1" className="text-purple-400" />
              </g>
              
              {/* Spinning outer ring */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="10 5"
                className="text-purple-500 animate-spin"
                style={{ transformOrigin: 'center' }}
              />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{message}</h3>
          
          {/* Processing dots */}
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}