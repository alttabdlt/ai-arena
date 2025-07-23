import { gql } from '@apollo/client';

export const REQUEST_NONCE = gql`
  mutation RequestNonce($address: String!) {
    requestNonce(address: $address) {
      nonce
      message
    }
  }
`;

export const CONNECT_WALLET = gql`
  mutation ConnectWallet($input: ConnectWalletInput!) {
    connectWallet(input: $input) {
      user {
        id
        address
        username
        role
        kycTier
      }
      accessToken
      refreshToken
    }
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      user {
        id
        address
        username
        role
        kycTier
      }
      accessToken
      refreshToken
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;