import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Bot, Brain, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { TEST_SCENARIOS, TestScenario } from '@/data/poker-scenarios';
import { useTestBotDecision } from '@/hooks/useTestBotDecision';

interface TestScenariosProps {
  prompt: string;
  modelType: string;
  isDisabled?: boolean;
}

interface TestResult {
  action: string;
  amount?: number;
  reasoning: string;
  confidence: number;
  details?: {
    handEvaluation?: string;
    potOdds?: number;
    expectedValue?: number;
    bluffProbability?: number;
    modelUsed?: string;
  };
  handMisread?: boolean;
  illogicalPlay?: boolean;
}

export function TestScenarios({ prompt, modelType, isDisabled = false }: TestScenariosProps) {
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const { testBotDecision, isLoading, error } = useTestBotDecision();

  const handleTest = async () => {
    if (!selectedScenario || !prompt || !modelType) return;

    const scenario = TEST_SCENARIOS.find(s => s.id === selectedScenario);
    if (!scenario) return;

    try {
      const result = await testBotDecision({
        prompt,
        modelType,
        scenario,
      });
      setTestResult(result);
    } catch (err) {
      console.error('Test failed:', err);
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'fold': return 'text-destructive';
      case 'check': return 'text-muted-foreground';
      case 'call': return 'text-primary';
      case 'raise':
      case 'bet': return 'text-success';
      case 'all-in': return 'text-accent';
      default: return '';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-success';
    if (confidence >= 60) return 'text-primary';
    if (confidence >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const selectedScenarioData = TEST_SCENARIOS.find(s => s.id === selectedScenario);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Your Bot - Poker</CardTitle>
        <CardDescription>
          See how your bot responds to different Texas Hold'em scenarios before deploying
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scenario Selection */}
        <div>
          <Select
            value={selectedScenario}
            onValueChange={setSelectedScenario}
            disabled={isDisabled || !prompt || !modelType}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a test scenario" />
            </SelectTrigger>
            <SelectContent>
              {TEST_SCENARIOS.map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {!prompt && (
            <p className="text-xs text-destructive mt-1">Please write a strategy prompt first</p>
          )}
          {!modelType && (
            <p className="text-xs text-destructive mt-1">Please select an AI model first</p>
          )}
        </div>

        {/* Scenario Details */}
        {selectedScenarioData && (
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{selectedScenarioData.description}</p>
                <div className="text-xs space-y-1">
                  <p><strong>Stage:</strong> {selectedScenarioData.gameState.stage}</p>
                  <p><strong>Your Hand:</strong> {selectedScenarioData.playerState.holeCards.join(' ')}</p>
                  <p><strong>Board:</strong> {selectedScenarioData.gameState.communityCards.join(' ') || 'No cards'}</p>
                  <p><strong>Pot:</strong> {selectedScenarioData.gameState.potSize} chips</p>
                  <p><strong>Stack:</strong> {selectedScenarioData.playerState.stackSize} chips</p>
                  <p><strong>To Call:</strong> {selectedScenarioData.playerState.amountToCall} chips</p>
                </div>
                <p className="text-xs italic mt-2">{selectedScenarioData.context}</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Test Button */}
        <Button
          onClick={handleTest}
          disabled={!selectedScenario || !prompt || !modelType || isLoading || isDisabled}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing Bot Response...
            </>
          ) : (
            <>
              <Bot className="mr-2 h-4 w-4" />
              Test Bot Response
            </>
          )}
        </Button>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Test Result */}
        {testResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Bot Decision</h4>
              <div className="flex gap-2">
                {testResult.handMisread && (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    Hand Misread
                  </Badge>
                )}
                {testResult.illogicalPlay && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Illogical Play
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Action:</span>
                <span className={`font-bold ${getActionColor(testResult.action)}`}>
                  {testResult.action.toUpperCase()}
                  {testResult.amount && ` ${testResult.amount}`}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Confidence:</span>
                <span className={`font-bold ${getConfidenceColor(testResult.confidence)}`}>
                  {testResult.confidence}%
                </span>
              </div>

              {testResult.reasoning && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium mb-1">Reasoning:</p>
                  <p className="text-xs text-muted-foreground">{testResult.reasoning}</p>
                </div>
              )}

              {testResult.details && (
                <div className="pt-2 border-t space-y-1">
                  {testResult.details.handEvaluation && (
                    <p className="text-xs">
                      <span className="font-medium">Hand Evaluation:</span> {testResult.details.handEvaluation}
                    </p>
                  )}
                  {testResult.details.potOdds !== undefined && (
                    <p className="text-xs">
                      <span className="font-medium">Pot Odds:</span> {testResult.details.potOdds}%
                    </p>
                  )}
                  {testResult.details.bluffProbability !== undefined && (
                    <p className="text-xs">
                      <span className="font-medium">Bluff Probability:</span> {testResult.details.bluffProbability}%
                    </p>
                  )}
                </div>
              )}
            </div>

            {selectedScenarioData?.expectedPlay && (
              <Alert>
                <Brain className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Analysis:</strong> {selectedScenarioData.expectedPlay}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}