import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, Clock, Target, Lightbulb } from 'lucide-react';
import { IGameDecision as AIDecision } from '@/game-engine/core/interfaces';
import { DecisionHistoryEntry } from '@/game-engine/games/poker/PokerGameManager';
import { formatChips } from '@/poker/engine/poker-helpers';

interface AIThinkingPanelProps {
  currentThinking: {
    playerId: string;
    playerName: string;
    decision: AIDecision | null;
  } | null;
  recentDecisions: DecisionHistoryEntry[];
  thinkingTimeLeft: number;
  maxThinkingTime?: number; // Maximum thinking time based on speed setting
}

export function AIThinkingPanel({ currentThinking, recentDecisions, thinkingTimeLeft, maxThinkingTime = 2 }: AIThinkingPanelProps) {
  if (!currentThinking) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5" />
            AI Decision Process
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Waiting for next AI turn...
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercent = (thinkingTimeLeft / maxThinkingTime) * 100;
  const decision = currentThinking.decision;

  return (
    <Card className="w-full border-2 border-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 animate-pulse text-primary" />
            {currentThinking.playerName} is Thinking...
          </CardTitle>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              {maxThinkingTime < 1 
                ? `${thinkingTimeLeft.toFixed(1)}s` 
                : `${Math.ceil(thinkingTimeLeft)}s`
              }
            </span>
          </div>
        </div>
        <Progress value={progressPercent} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {decision ? (
          <>
            {/* Action Decision */}
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Decision:</span>
                <Badge variant="default" className="text-lg px-3 py-1">
                  {decision.action.type.toUpperCase()}
                  {(decision.action as any).amount && ` $${(decision.action as any).amount}`}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Confidence: {(decision.confidence * 100).toFixed(0)}%
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4" />
                Thinking Process:
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm leading-relaxed">{decision.reasoning}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Brain className="h-10 w-10 mx-auto animate-pulse text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing position...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}