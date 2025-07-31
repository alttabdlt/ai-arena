import React from 'react';
import type { IGameDecision as AIDecision } from '@/game-engine/core/interfaces';
import type { PokerAction } from '@/game-engine/games/poker';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, Shuffle } from 'lucide-react';

interface PokerDecisionDisplayProps {
  playerName: string;
  decision: AIDecision;
  isVisible: boolean;
}

export const PokerDecisionDisplay: React.FC<PokerDecisionDisplayProps> = ({
  playerName,
  decision,
  isVisible
}) => {
  const getActionDisplay = () => {
    const action = decision.action;
    switch (action.type) {
      case 'check':
        return 'CHECK';
      case 'call':
        return 'CALL';
      case 'raise':
        return `RAISE $${(action as PokerAction).amount || 0}`;
      case 'bet':
        return `BET $${(action as PokerAction).amount || 0}`;
      case 'all-in':
        return 'ALL-IN!';
      case 'fold':
        return 'FOLD';
      default:
        return action.type.toUpperCase();
    }
  };

  const getActionColor = () => {
    switch (decision.action.type) {
      case 'fold':
        return 'text-red-400';
      case 'all-in':
        return 'text-yellow-400';
      case 'raise':
      case 'bet':
        return 'text-green-400';
      case 'check':
      case 'call':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    if (confidence >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.3 }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        >
          <div className="bg-background/95 backdrop-blur-sm border-2 border-primary/20 rounded-lg shadow-2xl p-6 max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">{playerName}'s Decision</h3>
              </div>
              <div className={`font-bold text-xl ${getActionColor()}`}>
                {getActionDisplay()}
              </div>
            </div>

            {/* Reasoning */}
            {decision.reasoning && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {decision.reasoning}
                </p>
              </div>
            )}

            {/* Confidence Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <span className="text-xs font-medium">{(decision.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${decision.confidence * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`h-full ${getConfidenceColor(decision.confidence)}`}
                />
              </div>
            </div>

            {/* Metadata */}
            {decision.metadata && (
              <div className="space-y-2 text-xs">
                {decision.metadata.isBluffing !== undefined && (
                  <div className="flex items-center gap-2">
                    <Shuffle className={`w-4 h-4 ${decision.metadata.isBluffing ? 'text-orange-500' : 'text-green-500'}`} />
                    <span className="text-muted-foreground">
                      {decision.metadata.isBluffing ? 'Bluffing' : 'Playing Honestly'}
                    </span>
                  </div>
                )}
                
                {decision.metadata.expectedValue !== undefined && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <span className="text-muted-foreground">
                      EV: {decision.metadata.expectedValue > 0 ? '+' : ''}{decision.metadata.expectedValue.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};