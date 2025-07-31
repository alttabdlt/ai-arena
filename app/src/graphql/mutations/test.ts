import { gql } from '@apollo/client';

export const SET_TEST_GAME_TYPE = gql`
  mutation SetTestGameType($gameType: String) {
    setTestGameType(gameType: $gameType)
  }
`;