import * as React from 'react';
import { useState, useEffect } from 'react';

interface EnhancedAIThinkingProps {
  isThinking: boolean;
  agentName?: string;
  personality?: 'detective' | 'analyst' | 'creative' | 'speedster' | 'conservative';
}

const THINKING_PHRASES = {
  detective: [
    "Analyzing clues...",
    "Following the evidence...",
    "Elementary, my dear Watson...",
    "The plot thickens...",
    "Deducing patterns..."
  ],
  analyst: [
    "Computing probabilities...",
    "Running statistical analysis...",
    "Calculating word frequencies...",
    "Processing data matrices...",
    "Optimizing solution space..."
  ],
  creative: [
    "Channeling inspiration...",
    "Exploring metaphors...",
    "Thinking outside the box...",
    "Connecting abstract concepts...",
    "Imagining possibilities..."
  ],
  speedster: [
    "Quick! Quick! Quick!",
    "No time to waste!",
    "Rapid fire mode!",
    "Speed thinking activated!",
    "Gotta go fast!"
  ],
  conservative: [
    "Carefully considering...",
    "Building on certainties...",
    "Double-checking logic...",
    "Methodical analysis...",
    "Step by step..."
  ]
};

export function EnhancedAIThinking({ 
  isThinking, 
  agentName = "AI", 
  personality = 'detective' 
}: EnhancedAIThinkingProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [showThought, setShowThought] = useState(false);
  
  const phrases = THINKING_PHRASES[personality];

  useEffect(() => {
    if (!isThinking) {
      setPhraseIndex(0);
      setShowThought(false);
      return;
    }

    const interval = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % phrases.length);
      setShowThought(true);
    }, 2000);

    return () => clearInterval(interval);
  }, [isThinking, phrases.length]);

  if (!isThinking) return null;

  const getPersonalityIcon = () => {
    switch (personality) {
      case 'detective': return '🔍';
      case 'analyst': return '📊';
      case 'creative': return '🎨';
      case 'speedster': return '⚡';
      case 'conservative': return '🐢';
      default: return '🤔';
    }
  };

  const getPersonalityColor = () => {
    switch (personality) {
      case 'detective': return 'from-purple-500 to-indigo-600';
      case 'analyst': return 'from-blue-500 to-cyan-600';
      case 'creative': return 'from-pink-500 to-rose-600';
      case 'speedster': return 'from-yellow-500 to-orange-600';
      case 'conservative': return 'from-green-500 to-emerald-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="relative">
          <div className={`text-4xl animate-pulse`}>
            {getPersonalityIcon()}
          </div>
          
          {/* Thinking bubbles */}
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-white rounded-full animate-bounce shadow-sm" style={{ animationDelay: '0ms' }} />
          <div className="absolute -top-4 -right-4 w-2 h-2 bg-white rounded-full animate-bounce shadow-sm" style={{ animationDelay: '200ms' }} />
          <div className="absolute -top-5 -right-6 w-1.5 h-1.5 bg-white rounded-full animate-bounce shadow-sm" style={{ animationDelay: '400ms' }} />
        </div>

        <div className="flex-1">
          <div className="font-medium text-gray-900">{agentName} is thinking...</div>
          <div className={`text-sm mt-1 bg-gradient-to-r ${getPersonalityColor()} bg-clip-text text-transparent font-medium transition-opacity duration-500 ${
            showThought ? 'opacity-100' : 'opacity-0'
          }`}>
            {phrases[phraseIndex]}
          </div>
        </div>

        {/* Brain activity indicator */}
        <div className="relative w-16 h-16">
          <svg className="w-full h-full" viewBox="0 0 64 64">
            <g className="animate-pulse">
              {/* Neural network visualization */}
              {[0, 1, 2, 3, 4].map((i) => (
                <circle
                  key={i}
                  cx={32 + Math.cos(i * 72 * Math.PI / 180) * 20}
                  cy={32 + Math.sin(i * 72 * Math.PI / 180) * 20}
                  r="3"
                  fill="currentColor"
                  className={`text-${personality === 'speedster' ? 'yellow' : 'purple'}-500`}
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
              
              {/* Connecting lines */}
              <path
                d="M32,32 L52,32 M32,32 L12,32 M32,32 L32,12 M32,32 L32,52"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
                className={`text-${personality === 'speedster' ? 'yellow' : 'purple'}-300`}
              />
            </g>
            
            {/* Rotating outer ring */}
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="4 2"
              className={`text-${personality === 'speedster' ? 'yellow' : 'purple'}-400 ${
                personality === 'speedster' ? 'animate-spin' : 'animate-spin-slow'
              }`}
              style={{ transformOrigin: 'center' }}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}