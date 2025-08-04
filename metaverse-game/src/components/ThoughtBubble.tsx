import React from 'react';

interface ThoughtBubbleProps {
  playerId: string;
  thought: string;
  personality?: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  position: { x: number; y: number };
  visible: boolean;
}

export function ThoughtBubble({ playerId, thought, personality = 'WORKER', position, visible }: ThoughtBubbleProps) {
  if (!visible) return null;

  // Personality-based bubble styles
  const bubbleStyles = {
    CRIMINAL: 'bg-red-900 border-red-700',
    GAMBLER: 'bg-purple-900 border-purple-700',
    WORKER: 'bg-blue-900 border-blue-700',
  };

  return (
    <div
      className={`absolute z-50 pointer-events-none transition-all duration-300 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y - 60}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Thought bubble */}
      <div
        className={`relative px-3 py-2 rounded-lg border-2 ${
          bubbleStyles[personality]
        } text-white text-xs max-w-[200px] shadow-lg`}
      >
        <div className="font-semibold mb-1 text-[10px] opacity-70">
          {personality} thinking...
        </div>
        <div className="break-words">{thought}</div>
        
        {/* Bubble tail */}
        <div
          className={`absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 w-0 h-0 
            border-l-[6px] border-l-transparent 
            border-r-[6px] border-r-transparent 
            border-t-[8px] ${
              personality === 'CRIMINAL' ? 'border-t-red-700' :
              personality === 'GAMBLER' ? 'border-t-purple-700' :
              'border-t-blue-700'
            }`}
        />
      </div>
      
      {/* Small thought bubbles */}
      <div className="absolute bottom-[-16px] left-1/2 transform -translate-x-1/2 flex gap-1">
        <div className={`w-2 h-2 rounded-full ${bubbleStyles[personality].split(' ')[0]} opacity-60`} />
        <div className={`w-1.5 h-1.5 rounded-full ${bubbleStyles[personality].split(' ')[0]} opacity-40`} />
      </div>
    </div>
  );
}

// Hook to manage thought bubble visibility
export function useThoughtBubbles() {
  const [thoughts, setThoughts] = React.useState<Map<string, {
    thought: string;
    personality: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
    timestamp: number;
  }>>(new Map());

  const addThought = React.useCallback((playerId: string, thought: string, personality: 'CRIMINAL' | 'GAMBLER' | 'WORKER') => {
    setThoughts(prev => {
      const next = new Map(prev);
      next.set(playerId, { thought, personality, timestamp: Date.now() });
      return next;
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setThoughts(prev => {
        const next = new Map(prev);
        const current = next.get(playerId);
        if (current && current.timestamp + 5000 < Date.now()) {
          next.delete(playerId);
        }
        return next;
      });
    }, 5000);
  }, []);

  return { thoughts, addThought };
}