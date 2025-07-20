import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertCircle, Brain, CheckCircle2, XCircle } from 'lucide-react';

interface HandMisread {
  handNumber: number;
  actual: string;
  aiThought: string;
  holeCards: string[];
  boardCards: string[];
  phase: string;
}

interface IllogicalDecision {
  handNumber: number;
  decision: string;
  reason: string;
  gameState: {
    pot: number;
    toCall: number;
    canCheck: boolean;
  };
}

interface ModelEvaluation {
  modelName: string;
  handsPlayed: number;
  handMisreads: HandMisread[];
  illogicalDecisions: IllogicalDecision[];
  misreadRate: number;
  illogicalRate: number;
}

interface AIEvaluationPanelProps {
  evaluations: ModelEvaluation[];
  currentHandNumber?: number;
}

export const AIEvaluationPanel: React.FC<AIEvaluationPanelProps> = ({ evaluations, currentHandNumber }) => {
  const getModelBadgeVariant = (misreadRate: number, illogicalRate: number) => {
    const errorRate = misreadRate + illogicalRate;
    if (errorRate < 0.05) return 'default'; // Excellent
    if (errorRate < 0.15) return 'secondary'; // Good
    if (errorRate < 0.25) return 'outline'; // Average
    return 'destructive'; // Poor
  };

  const formatPercentage = (rate: number) => `${(rate * 100).toFixed(1)}%`;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Model Evaluation
        </CardTitle>
        <CardDescription>
          Tracking hand reading accuracy and decision logic across AI models
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={evaluations[0]?.modelName || 'overview'}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {evaluations.slice(0, 4).map(evaluation => (
              <TabsTrigger key={evaluation.modelName} value={evaluation.modelName}>
                {evaluation.modelName.split('-')[0].toUpperCase()}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4">
              {evaluations.map(evaluation => (
                <div key={evaluation.modelName} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{evaluation.modelName}</h3>
                    <Badge variant={getModelBadgeVariant(evaluation.misreadRate, evaluation.illogicalRate)}>
                      {evaluation.handsPlayed} hands
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>Misreads: {formatPercentage(evaluation.misreadRate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      <span>Illogical: {formatPercentage(evaluation.illogicalRate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>Accuracy: {formatPercentage(1 - evaluation.misreadRate - evaluation.illogicalRate)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {evaluations.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No evaluation data yet</AlertTitle>
                <AlertDescription>
                  AI model evaluations will appear here as games are played
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {evaluations.map(evaluation => (
            <TabsContent key={evaluation.modelName} value={evaluation.modelName} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Hands Played</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{evaluation.handsPlayed}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Hand Misreads</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {evaluation.handMisreads.length} ({formatPercentage(evaluation.misreadRate)})
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Illogical Plays</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {evaluation.illogicalDecisions.length} ({formatPercentage(evaluation.illogicalRate)})
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {evaluation.handMisreads.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recent Hand Misreads</h4>
                    <ScrollArea className="h-48 w-full rounded-md border p-4">
                      {evaluation.handMisreads.slice(-5).reverse().map((misread, idx) => (
                        <div key={idx} className="mb-4 last:mb-0">
                          <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertTitle>Hand #{misread.handNumber} - {misread.phase}</AlertTitle>
                            <AlertDescription className="space-y-1">
                              <div>Cards: {misread.holeCards.join(' ')} | Board: {misread.boardCards.join(' ')}</div>
                              <div className="font-semibold">Actual: {misread.actual}</div>
                              <div className="text-red-600">AI thought: {misread.aiThought}</div>
                            </AlertDescription>
                          </Alert>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {evaluation.illogicalDecisions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recent Illogical Decisions</h4>
                    <ScrollArea className="h-48 w-full rounded-md border p-4">
                      {evaluation.illogicalDecisions.slice(-5).reverse().map((decision, idx) => (
                        <div key={idx} className="mb-4 last:mb-0">
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Hand #{decision.handNumber}</AlertTitle>
                            <AlertDescription>
                              <div>{decision.reason}</div>
                              <div className="text-sm mt-1">
                                Pot: ${decision.gameState.pot} | To call: ${decision.gameState.toCall} | 
                                Can check: {decision.gameState.canCheck ? 'Yes' : 'No'}
                              </div>
                            </AlertDescription>
                          </Alert>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {evaluation.handMisreads.length === 0 && evaluation.illogicalDecisions.length === 0 && (
                  <Alert variant="default">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Perfect play so far!</AlertTitle>
                    <AlertDescription>
                      No hand misreads or illogical decisions detected
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};