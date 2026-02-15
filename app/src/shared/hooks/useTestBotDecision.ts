import { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { TestScenario } from '@/data/poker-scenarios';
import { transformScenarioToGraphQL } from '@shared/utils/poker-scenario-transformer';

const TEST_BOT_DECISION = gql`
  mutation GetAIPokerDecision(
    $botId: String!
    $model: String!
    $gameState: PokerGameStateInput!
    $playerState: PlayerStateInput!
    $opponents: Int!
  ) {
    getAIPokerDecision(
      botId: $botId
      model: $model
      gameState: $gameState
      playerState: $playerState
      opponents: $opponents
    ) {
      action
      amount
      reasoning
      confidence
      details {
        handEvaluation
        potOdds
        expectedValue
        bluffProbability
        modelUsed
      }
      handMisread
      illogicalPlay
    }
  }
`;

interface TestBotDecisionParams {
  prompt: string;
  modelType: string;
  scenario: TestScenario;
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

export function useTestBotDecision() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testDecision] = useMutation(TEST_BOT_DECISION);

  const testBotDecision = async ({ prompt, modelType, scenario }: TestBotDecisionParams): Promise<TestResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate a temporary botId that includes the prompt for context
      const tempBotId = `test-bot-${Date.now()}`;
      
      // Pass model type as-is (backend expects lowercase with hyphens)
      const formattedModel = modelType;

      // Transform scenario to match GraphQL schema
      const { gameState, playerState, opponents } = transformScenarioToGraphQL(scenario);

      const { data } = await testDecision({
        variables: {
          botId: tempBotId,
          model: formattedModel,
          gameState,
          playerState,
          opponents,
        },
        context: {
          headers: {
            'X-Bot-Prompt': prompt, // Pass prompt via header for test bots
          },
        },
      });

      return data.getAIPokerDecision;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test bot decision';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    testBotDecision,
    isLoading,
    error,
  };
}
