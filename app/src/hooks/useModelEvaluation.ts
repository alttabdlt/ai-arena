import { useQuery } from '@apollo/client';
import { GET_MODEL_EVALUATIONS, GET_MODEL_EVALUATION } from '../graphql/queries';

export interface HandMisread {
  handNumber: number;
  actual: string;
  aiThought: string;
  holeCards: string[];
  boardCards: string[];
  phase: string;
}

export interface IllogicalDecision {
  handNumber: number;
  decision: string;
  reason: string;
  gameState: {
    pot: number;
    toCall: number;
    canCheck: boolean;
  };
}

export interface ModelEvaluation {
  modelName: string;
  handsPlayed: number;
  handMisreads: HandMisread[];
  illogicalDecisions: IllogicalDecision[];
  misreadRate: number;
  illogicalRate: number;
}

export const useModelEvaluations = () => {
  const { data, loading, error, refetch } = useQuery<{
    getModelEvaluations: ModelEvaluation[];
  }>(GET_MODEL_EVALUATIONS, {
    pollInterval: 5000, // Poll every 5 seconds for updates during games
  });

  return {
    evaluations: data?.getModelEvaluations || [],
    loading,
    error,
    refetch,
  };
};

export const useModelEvaluation = (model: string) => {
  const { data, loading, error, refetch } = useQuery<{
    getModelEvaluation: ModelEvaluation | null;
  }>(GET_MODEL_EVALUATION, {
    variables: { model },
    skip: !model,
    pollInterval: 5000,
  });

  return {
    evaluation: data?.getModelEvaluation || null,
    loading,
    error,
    refetch,
  };
};