import { gql } from '@apollo/client';

export const GET_AI_POKER_DECISION = gql`
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

export const GET_AI_REVERSE_HANGMAN_DECISION = gql`
  mutation GetAIReverseHangmanDecision(
    $botId: String!
    $model: String!
    $gameState: ReverseHangmanGameStateInput!
    $playerState: ReverseHangmanPlayerStateInput!
  ) {
    getAIReverseHangmanDecision(
      botId: $botId
      model: $model
      gameState: $gameState
      playerState: $playerState
    ) {
      action
      prompt_guess
      reasoning
      confidence
      analysis {
        output_type
        key_indicators
        word_count_estimate
        difficulty_assessment
        pattern_observations
      }
    }
  }
`;