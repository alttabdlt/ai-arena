import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

export type AnimationPhase = 
  | 'idle'
  | 'selecting'
  | 'sending'
  | 'processing'
  | 'generating'
  | 'revealing'
  | 'complete';

interface PromptGenerationAnimationProps {
  phase: AnimationPhase;
  output: string;
  onComplete: () => void;
}

export function PromptGenerationAnimation({
  phase,
  output,
  onComplete
}: PromptGenerationAnimationProps) {
  const [displayedOutput, setDisplayedOutput] = useState('');
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    if (phase === 'selecting' || phase === 'processing') {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [phase]);

  // Typewriter effect for output
  useEffect(() => {
    if (phase === 'revealing' && output) {
      setDisplayedOutput('');
      let currentIndex = 0;
      
      const interval = setInterval(() => {
        if (currentIndex < output.length) {
          setDisplayedOutput(prev => prev + output[currentIndex]);
          currentIndex++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
          }, 1000);
        }
      }, 30); // Adjust speed as needed
      
      return () => clearInterval(interval);
    }
  }, [phase, output, onComplete]);

  const renderContent = () => {
    switch (phase) {
      case 'idle':
        return null;
        
      case 'selecting':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
                <div className="relative w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🎲</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Selecting Random Prompt{dots}</h3>
              <p className="text-gray-600">Choosing a mystery prompt from the database</p>
            </div>
          </div>
        );
        
      case 'sending':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse"></div>
                <div className="relative w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">📤</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Sending to AI Model</h3>
              <p className="text-gray-600">Transmitting the hidden prompt to the AI</p>
              <div className="mt-4 flex justify-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        );
        
      case 'processing':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 relative">
                <div className="absolute inset-0">
                  <div className="w-full h-full border-4 border-purple-200 rounded-full"></div>
                  <div className="absolute inset-0 w-full h-full border-4 border-purple-500 rounded-full animate-spin border-t-transparent"></div>
                </div>
                <div className="absolute inset-2 bg-purple-500/10 rounded-full flex items-center justify-center">
                  <span className="text-3xl">🤖</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI is Thinking{dots}</h3>
              <p className="text-gray-600">Processing the prompt and generating output</p>
              <div className="mt-4 max-w-xs mx-auto">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'generating':
        return (
          <div className="text-center py-12">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-pulse"></div>
                <div className="relative w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Generating Output</h3>
              <p className="text-gray-600">The AI is crafting its response</p>
            </div>
          </div>
        );
        
      case 'revealing':
        return (
          <div className="py-8">
            <div className="mb-4 text-center">
              <h3 className="text-xl font-semibold mb-2">AI Output Generated!</h3>
              <p className="text-gray-600">Can you guess the original prompt?</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 min-h-[200px]">
              <div className="bg-white p-4 rounded border border-gray-300">
                <p className="text-gray-900 font-medium whitespace-pre-wrap">
                  {displayedOutput}
                  {displayedOutput.length < output.length && (
                    <span className="inline-block w-2 h-5 bg-gray-600 animate-pulse ml-1"></span>
                  )}
                </p>
              </div>
            </div>
          </div>
        );
        
      case 'complete':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <h3 className="text-xl font-semibold">Ready to Play!</h3>
            <p className="text-gray-600 mt-2">The guessing game begins now</p>
          </div>
        );
        
      default:
        return null;
    }
  };

  if (phase === 'idle') {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative">
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
          <div 
            className="h-full bg-primary transition-all duration-1000"
            style={{
              width: phase === 'selecting' ? '20%' :
                     phase === 'sending' ? '40%' :
                     phase === 'processing' ? '60%' :
                     phase === 'generating' ? '80%' :
                     phase === 'revealing' ? '90%' :
                     phase === 'complete' ? '100%' : '0%'
            }}
          />
        </div>
        
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </Card>
  );
}