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
  const [revealedWords, setRevealedWords] = useState<number>(0);
  const words = text.split(' ');

  useEffect(() => {
    if (!isRevealing) {
      setRevealedWords(0);
      return;
    }

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
          <span className={`px-1 py-0.5 rounded ${
            index < revealedWords ? 'bg-primary/10' : ''
          }`}>
            {word}
          </span>
        </span>
      ))}
    </div>
  );
}