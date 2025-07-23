import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronDown,
  Play,
  RotateCcw,
  Shield
} from 'lucide-react';
import { TEST_SCENARIOS, TestScenario } from '@/data/poker-scenarios';
import { useTestBotDecision } from '@/hooks/useTestBotDecision';

interface AllTestsRunnerProps {
  prompt: string;
  modelType: string;
  isDisabled?: boolean;
  onTestsComplete: (allPassed: boolean) => void;
}

interface TestResult {
  scenario: TestScenario;
  passed: boolean;
  result?: {
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
  };
  error?: string;
}

export function AllTestsRunner({ prompt, modelType, isDisabled = false, onTestsComplete }: AllTestsRunnerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTestIndex, setCurrentTestIndex] = useState(-1);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const { testBotDecision } = useTestBotDecision();

  // Determine if a test passes
  const isTestPassed = (result: TestResult['result'], scenario: TestScenario): boolean => {
    if (!result) return false;
    
    // Fail conditions
    if (result.handMisread) return false;
    if (result.illogicalPlay) return false;
    if (result.confidence < 0.6) return false; // Confidence is 0-1, not 0-100
    if (!result.action || result.action.toLowerCase() === 'error') return false;
    
    // Valid poker actions
    const validActions = ['fold', 'check', 'call', 'raise', 'bet', 'all-in'];
    const actionLower = result.action.toLowerCase();
    if (!validActions.some(action => actionLower.includes(action))) return false;
    
    // Basic validation: ensure raise/bet amounts don't exceed stack
    if ((actionLower.includes('raise') || actionLower.includes('bet')) && result.amount) {
      if (result.amount > scenario.playerState.stackSize) return false;
    }
    
    // Must have reasoning
    if (!result.reasoning || result.reasoning.trim().length < 10) return false;
    
    return true;
  };

  const runAllTests = useCallback(async () => {
    if (!prompt || !modelType) return;

    setIsRunning(true);
    setTestResults([]);
    setCurrentTestIndex(0);
    
    const results: TestResult[] = [];

    for (let i = 0; i < TEST_SCENARIOS.length; i++) {
      setCurrentTestIndex(i);
      const scenario = TEST_SCENARIOS[i];
      
      try {
        const result = await testBotDecision({
          prompt,
          modelType,
          scenario,
        });

        const testResult: TestResult = {
          scenario,
          result,
          passed: isTestPassed(result, scenario),
        };
        
        results.push(testResult);
        setTestResults([...results]);
      } catch (err: any) {
        const testResult: TestResult = {
          scenario,
          passed: false,
          error: err.message || 'Test failed',
        };
        
        results.push(testResult);
        setTestResults([...results]);
      }

      // Small delay between tests for better UX
      if (i < TEST_SCENARIOS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);
    setCurrentTestIndex(-1);

    // Check if all tests passed
    const allPassed = results.every(r => r.passed);
    onTestsComplete(allPassed);
  }, [prompt, modelType, testBotDecision, onTestsComplete]);

  const toggleResultExpansion = (scenarioId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(scenarioId)) {
      newExpanded.delete(scenarioId);
    } else {
      newExpanded.add(scenarioId);
    }
    setExpandedResults(newExpanded);
  };

  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = TEST_SCENARIOS.length;
  const allPassed = testResults.length === totalCount && passedCount === totalCount;
  const hasResults = testResults.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Strategy Validation
          <Badge variant="secondary">Required</Badge>
        </CardTitle>
        <CardDescription>
          Your bot must pass all {totalCount} test scenarios before deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Controls */}
        <div className="space-y-3">
          {!prompt && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please write a strategy prompt first</AlertDescription>
            </Alert>
          )}
          
          {!modelType && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Please select an AI model first</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={runAllTests}
            disabled={!prompt || !modelType || isRunning || isDisabled}
            className="w-full"
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Test {currentTestIndex + 1} of {totalCount}...
              </>
            ) : hasResults ? (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Re-run All Tests
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run All Tests
              </>
            )}
          </Button>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-2">
            <Progress value={(currentTestIndex + 1) / totalCount * 100} />
            <p className="text-sm text-muted-foreground text-center">
              Testing scenario: {TEST_SCENARIOS[currentTestIndex]?.name}
            </p>
          </div>
        )}

        {/* Results Summary */}
        {hasResults && !isRunning && (
          <Alert variant={allPassed ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              {allPassed ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  All Tests Passed!
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5" />
                  {passedCount}/{totalCount} Tests Passed
                </>
              )}
            </AlertTitle>
            <AlertDescription>
              {allPassed 
                ? "Your bot has demonstrated competency. You may now deploy."
                : "Fix the failing tests and try again. All tests must pass before deployment."}
            </AlertDescription>
          </Alert>
        )}

        {/* Individual Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Test Results</h4>
            <div className="space-y-2">
              {testResults.map((testResult, index) => (
                <Collapsible
                  key={testResult.scenario.id}
                  open={expandedResults.has(testResult.scenario.id)}
                  onOpenChange={() => toggleResultExpansion(testResult.scenario.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        {testResult.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        <div className="text-left">
                          <p className="font-medium text-sm">
                            Test {index + 1}: {testResult.scenario.name}
                          </p>
                          {testResult.error && (
                            <p className="text-xs text-destructive mt-1">{testResult.error}</p>
                          )}
                          {testResult.result && !testResult.passed && (
                            <p className="text-xs text-destructive mt-1">
                              {testResult.result.handMisread && "Hand misread • "}
                              {testResult.result.illogicalPlay && "Illogical play • "}
                              {testResult.result.confidence < 0.6 && `Low confidence (${(testResult.result.confidence * 100).toFixed(1)}%) • `}
                              {!testResult.result.action && "No action"}
                              {!testResult.result.reasoning && "No reasoning • "}
                              {testResult.result.action && testResult.result.amount && testResult.result.amount > testResult.scenario.playerState.stackSize && "Bet exceeds stack • "}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    {testResult.result && (
                      <div className="p-4 mt-2 rounded-lg bg-background border space-y-3">
                        {/* Scenario Details */}
                        <div className="space-y-1 text-xs">
                          <p><strong>Stage:</strong> {testResult.scenario.gameState.stage}</p>
                          <p><strong>Hand:</strong> {testResult.scenario.playerState.holeCards.join(' ')}</p>
                          <p><strong>Board:</strong> {testResult.scenario.gameState.communityCards.join(' ') || 'No cards'}</p>
                          <p><strong>Pot:</strong> {testResult.scenario.gameState.potSize} chips</p>
                          <p><strong>To Call:</strong> {testResult.scenario.playerState.amountToCall} chips</p>
                        </div>

                        {/* Bot Decision */}
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span>Action:</span>
                            <span className="font-medium">
                              {testResult.result.action.toUpperCase()}
                              {testResult.result.amount && ` ${testResult.result.amount}`}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Confidence:</span>
                            <span className="font-medium">{(testResult.result.confidence * 100).toFixed(1)}%</span>
                          </div>
                          {testResult.result.reasoning && (
                            <div className="text-xs">
                              <p className="font-medium mb-1">Reasoning:</p>
                              <p className="text-muted-foreground">{testResult.result.reasoning}</p>
                            </div>
                          )}
                        </div>

                        {/* Expected Play */}
                        {testResult.scenario.expectedPlay && (
                          <Alert>
                            <AlertDescription className="text-xs">
                              <strong>Expected:</strong> {testResult.scenario.expectedPlay}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}