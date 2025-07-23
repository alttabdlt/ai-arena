import * as React from 'react';
import { useState } from 'react';
import { Mistake, MistakeDetector } from '../engine/mistake-detector';

interface MistakeDisplayProps {
  mistakes: Mistake[];
  agentName: string;
}

export function MistakeDisplay({ mistakes, agentName }: MistakeDisplayProps) {
  const [showHallOfShame, setShowHallOfShame] = useState(false);
  
  const mistakesByCategory = mistakes.reduce((acc, mistake) => {
    acc[mistake.category] = (acc[mistake.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const worstMistake = mistakes.find(m => m.severity === 'hilarious') || 
                       mistakes.find(m => m.severity === 'major');

  const getSeverityColor = (severity: Mistake['severity']) => {
    switch (severity) {
      case 'hilarious': return 'text-purple-600 bg-purple-50';
      case 'major': return 'text-orange-600 bg-orange-50';
      case 'minor': return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Mistake Counter */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">
            {agentName}'s Mistake Counter
          </h3>
          <span className="text-2xl font-bold text-red-500">
            {mistakes.length}
          </span>
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(mistakesByCategory).map(([category, count]) => (
            <div key={category} className="flex items-center gap-2 text-sm">
              <span className="text-xl">
                {MistakeDetector.getMistakeEmoji(category as any)}
              </span>
              <span className="text-gray-700">
                {category.replace('_', ' ')}: {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Worst Mistake Highlight */}
      {worstMistake && (
        <div className={`rounded-lg p-4 border ${
          worstMistake.severity === 'hilarious' 
            ? 'border-purple-300 bg-purple-50' 
            : 'border-orange-300 bg-orange-50'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-3xl animate-bounce">
              {MistakeDetector.getMistakeEmoji(worstMistake.category)}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  getSeverityColor(worstMistake.severity)
                }`}>
                  {worstMistake.severity.toUpperCase()}
                </span>
                <span className="text-sm text-gray-600">
                  Attempt #{worstMistake.attemptNumber}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                {worstMistake.description}
              </p>
              <p className="text-xs text-gray-600 italic">
                "{worstMistake.guess}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hall of Shame Toggle */}
      {mistakes.length > 2 && (
        <button
          onClick={() => setShowHallOfShame(!showHallOfShame)}
          className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200"
        >
          {showHallOfShame ? '🙈 Hide' : '🏆 Show'} Hall of Shame
        </button>
      )}

      {/* Hall of Shame */}
      {showHallOfShame && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h4 className="font-semibold text-gray-900 text-center mb-3">
            🏆 Hall of Shame 🏆
          </h4>
          {mistakes
            .filter(m => m.severity !== 'minor')
            .sort((a, b) => {
              const severityOrder = { hilarious: 0, major: 1, minor: 2 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            })
            .slice(0, 5)
            .map((mistake, index) => (
              <div 
                key={index}
                className="flex items-start gap-2 p-3 bg-white rounded-md shadow-sm"
              >
                <span className="text-lg font-bold text-gray-400">
                  #{index + 1}
                </span>
                <span className="text-xl">
                  {MistakeDetector.getMistakeEmoji(mistake.category)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {mistake.guess}
                  </p>
                  <p className="text-xs text-gray-500">
                    {mistake.description}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}