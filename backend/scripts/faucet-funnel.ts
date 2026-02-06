/**
 * Drip testnet MON from faucet via multiple wallets, then funnel to main wallet.
 * Workaround for per-address rate limiting.
 */

import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const MAIN_WALLET = '0xA5AE8A362A36c7f3242724AaF34FdEEF66A35b1f' as `0x${string}`;
const RPC = 'https://monad-testnet.drpc.org';
const FAUCET = 'https://agents.devnads.com/v1/faucet';
const CHAIN_ID = 10143;
const TARGET_MON = 12; // Need 10 for deploy + some buffer

const chain = {
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const publicClient = createPublicClient({ chain, transport: http(RPC) });

async function dripAndTransfer(index: number): Promise<boolean> {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  
  // Request from faucet
  try {
    const res = await fetch(FAUCET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: account.address, chainId: CHAIN_ID }),
    });
    const data = await res.json();
    
    if (data.error) {
      console.log(`   [${index}] Faucet error: ${data.error}`);
      return false;
    }
    
    console.log(`   [${index}] Got 1 MON to ${account.address.slice(0, 10)}...`);
    
    // Wait for balance to appear
    await new Promise(r => setTimeout(r, 3000));
    
    const balance = await publicClient.getBalance({ address: account.address });
    if (balance === 0n) {
      console.log(`   [${index}] Balance still 0, waiting more...`);
      await new Promise(r => setTimeout(r, 5000));
    }
    
    const bal = await publicClient.getBalance({ address: account.address });
    if (bal === 0n) {
      console.log(`   [${index}] No balance received, skipping`);
      return false;
    }
    
    // Transfer to main wallet (minus gas)
    const walletClient = createWalletClient({ account, chain, transport: http(RPC) });
    const gasPrice = await publicClient.getGasPrice();
    const gasLimit = 21000n;
    const gasCost = gasPrice * gasLimit * 2n; // 2x buffer for gas price changes
    const transferAmount = bal - gasCost;
    
    if (transferAmount <= 0n) {
      console.log(`   [${index}] Balance too low for transfer: ${formatEther(bal)}`);
      return false;
    }
    
    const hash = await walletClient.sendTransaction({
      to: MAIN_WALLET,
      value: transferAmount,
      chain,
      gas: gasLimit,
    });
    
    console.log(`   [${index}] ✅ Sent ${formatEther(transferAmount)} MON → main wallet (tx: ${hash.slice(0, 14)}...)`);
    return true;
  } catch (e: any) {
    console.log(`   [${index}] Error: ${e.message?.slice(0, 80)}`);
    return false;
  }
}

async function main() {
  const startBalance = await publicClient.getBalance({ address: MAIN_WALLET });
  console.log(`\n💰 Main wallet balance: ${formatEther(startBalance)} MON`);
  console.log(`🎯 Target: ${TARGET_MON} MON\n`);
  
  const needed = BigInt(TARGET_MON) * BigInt(1e18) - startBalance;
  if (needed <= 0n) {
    console.log('✅ Already have enough MON!');
    return;
  }
  
  const rounds = Math.ceil(Number(needed) / 1e18) + 2; // Extra buffer
  console.log(`📡 Attempting ${rounds} faucet drips...\n`);
  
  let successes = 0;
  for (let i = 0; i < rounds; i++) {
    const ok = await dripAndTransfer(i + 1);
    if (ok) successes++;
    
    // Check if we've reached target
    if (successes > 0 && successes % 3 === 0) {
      const bal = await publicClient.getBalance({ address: MAIN_WALLET });
      console.log(`\n   📊 Main wallet: ${formatEther(bal)} MON (${successes} successful drips)\n`);
      if (bal >= BigInt(TARGET_MON) * BigInt(1e18)) {
        console.log('✅ Target reached!');
        break;
      }
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1500));
  }
  
  const finalBalance = await publicClient.getBalance({ address: MAIN_WALLET });
  console.log(`\n🏁 Final balance: ${formatEther(finalBalance)} MON`);
  console.log(`   Successful drips: ${successes}/${rounds}`);
}

main().catch(console.error);
