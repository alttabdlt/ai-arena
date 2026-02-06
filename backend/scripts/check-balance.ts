import { createPublicClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY = process.env.MONAD_DEPLOYER_KEY;
if (!PRIVATE_KEY) {
  throw new Error('Set MONAD_DEPLOYER_KEY env var (do not hardcode private keys in repo)');
}
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
console.log('Wallet address:', account.address);

async function main() {
  // Check testnet balance
  const testnetClient = createPublicClient({
    transport: http('https://monad-testnet.drpc.org'),
  });

  const testBal = await testnetClient.getBalance({ address: account.address });
  console.log('Testnet balance:', formatEther(testBal), 'MON');

  // Check mainnet balance
  try {
    const mainnetClient = createPublicClient({
      transport: http('https://monad-mainnet.drpc.org'),
    });
    const mainBal = await mainnetClient.getBalance({ address: account.address });
    console.log('Mainnet balance:', formatEther(mainBal), 'MON');
  } catch (e: any) {
    console.log('Mainnet check failed:', e.message);
  }

  // Try testnet faucet if balance is low
  if (testBal < BigInt(1e18)) {
    console.log('\nTestnet balance low, requesting from faucet...');
    try {
      const res = await fetch('https://agents.devnads.com/v1/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account.address }),
      });
      const data = await res.json();
      console.log('Faucet response:', data);
    } catch (e: any) {
      console.log('Faucet failed:', e.message);
    }
  }
}

main().catch(console.error);
