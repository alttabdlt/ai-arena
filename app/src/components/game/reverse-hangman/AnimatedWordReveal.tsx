import * as React from 'react';
import { useState, useEffect } from 'react';

interface AnimatedWordRevealProps {
  text: string;
  isRevealing: boolean;
  onRevealComplete?: () => void;
  revealSpeed?: number;
}

export function AnimatedWordReveal({ 
  text, 
  isRevealing, 
  onRevealComplete,
  revealSpeed = 150 
}: AnimatedWordRevealProps) {
  const words = text.split(' ');
  const [revealedWords, setRevealedWords] = useState<number>(isRevealing ? 0 : words.length);

  useEffect(() => {
    if (!isRevealing) {
      setRevealedWords(words.length);
      return;
    }

    // Reset to 0 when starting a new reveal
    setRevealedWords(0);

    const timer = setInterval(() => {
      setRevealedWords(prev => {
        if (prev >= words.length) {
          clearInterval(timer);
          onRevealComplete?.();
          return prev;
        }
        return prev + 1;
      });
    }, revealSpeed);

    return () => clearInterval(timer);
  }, [isRevealing, words.length, revealSpeed, onRevealComplete]);

  return (
    <div className="flex flex-wrap gap-1">
      {words.map((word, index) => (
        <span
          key={index}
          className={`inline-block transition-all duration-300 ${
            index < revealedWords
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          }`}
        >
          <span className={`px-1 py-0.5 rounded text-gray-900 font-medium ${
            index < revealedWords ? 'bg-primary/10' : ''
          }`}>
            {word}
          </span>
        </span>
      ))}
    </div>
  );
}