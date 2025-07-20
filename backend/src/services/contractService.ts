import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import BondingCurveFactoryABI from '../../../contracts/out/BondingCurveFactory.sol/BondingCurveFactory.json';
import BondingCurveABI from '../../../contracts/out/BondingCurve.sol/BondingCurve.json';
import GraduationControllerABI from '../../../contracts/out/GraduationController.sol/GraduationController.json';

export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private graduationContract: ethers.Contract;
  private prisma: PrismaClient;
  private redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
    
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(process.env.HYPEREVM_RPC_URL);
    
    // Initialize contracts
    this.factoryContract = new ethers.Contract(
      process.env.BONDING_CURVE_FACTORY_ADDRESS!,
      BondingCurveFactoryABI.abi,
      this.provider
    );
    
    this.graduationContract = new ethers.Contract(
      process.env.GRADUATION_CONTROLLER_ADDRESS!,
      GraduationControllerABI.abi,
      this.provider
    );
  }

  // Create a new bonding curve
  async createBondingCurve(
    name: string,
    symbol: string,
    botAddress: string,
    creatorPrivateKey: string
  ) {
    try {
      const signer = new ethers.Wallet(creatorPrivateKey, this.provider);
      const contractWithSigner = this.factoryContract.connect(signer);
      
      // Estimate gas
      const gasEstimate = await contractWithSigner.createBondingCurve.estimateGas(
        name,
        symbol,
        botAddress
      );
      
      // Send transaction
      const tx = await contractWithSigner.createBondingCurve(
        name,
        symbol,
        botAddress,
        {
          gasLimit: gasEstimate * 120n / 100n, // Add 20% buffer
        }
      );
      
      console.log(`Creating bonding curve, tx hash: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      // Parse the CurveCreated event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.factoryContract.interface.parseLog(log);
          return parsed?.name === 'CurveCreated';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsedEvent = this.factoryContract.interface.parseLog(event);
        const curveAddress = parsedEvent?.args.curve;
        
        // Save to database
        await this.prisma.bondingCurve.create({
          data: {
            botId: botAddress,
            currentSupply: '0',
            currentPrice: '0.00001',
            marketCap: '0',
            volume24h: '0',
            holders: 0,
            graduated: false,
          },
        });
        
        return {
          success: true,
          curveAddress,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        };
      }
      
      throw new Error('CurveCreated event not found');
    } catch (error) {
      console.error('Error creating bonding curve:', error);
      throw error;
    }
  }

  // Get bonding curve contract instance
  getBondingCurveContract(address: string): ethers.Contract {
    return new ethers.Contract(address, BondingCurveABI.abi, this.provider);
  }

  // Buy tokens from bonding curve
  async buyTokens(
    curveAddress: string,
    buyerPrivateKey: string,
    ethAmount: string,
    minTokens: string
  ) {
    try {
      const signer = new ethers.Wallet(buyerPrivateKey, this.provider);
      const curveContract = this.getBondingCurveContract(curveAddress).connect(signer);
      
      const value = ethers.parseEther(ethAmount);
      const minTokensParsed = ethers.parseEther(minTokens);
      
      // Estimate gas
      const gasEstimate = await curveContract.buy.estimateGas(minTokensParsed, { value });
      
      // Send transaction
      const tx = await curveContract.buy(minTokensParsed, {
        value,
        gasLimit: gasEstimate * 120n / 100n,
      });
      
      console.log(`Buying tokens, tx hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      // Parse Buy event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = curveContract.interface.parseLog(log);
          return parsed?.name === 'Buy';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsedEvent = curveContract.interface.parseLog(event);
        return {
          success: true,
          tokensReceived: parsedEvent?.args.tokensOut.toString(),
          newPrice: parsedEvent?.args.newPrice.toString(),
          txHash: receipt.hash,
        };
      }
      
      throw new Error('Buy event not found');
    } catch (error) {
      console.error('Error buying tokens:', error);
      throw error;
    }
  }

  // Sell tokens to bonding curve
  async sellTokens(
    curveAddress: string,
    sellerPrivateKey: string,
    tokenAmount: string,
    minEth: string
  ) {
    try {
      const signer = new ethers.Wallet(sellerPrivateKey, this.provider);
      const curveContract = this.getBondingCurveContract(curveAddress).connect(signer);
      
      const tokensParsed = ethers.parseEther(tokenAmount);
      const minEthParsed = ethers.parseEther(minEth);
      
      // Estimate gas
      const gasEstimate = await curveContract.sell.estimateGas(tokensParsed, minEthParsed);
      
      // Send transaction
      const tx = await curveContract.sell(tokensParsed, minEthParsed, {
        gasLimit: gasEstimate * 120n / 100n,
      });
      
      console.log(`Selling tokens, tx hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      // Parse Sell event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = curveContract.interface.parseLog(log);
          return parsed?.name === 'Sell';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsedEvent = curveContract.interface.parseLog(event);
        return {
          success: true,
          ethReceived: parsedEvent?.args.ethOut.toString(),
          newPrice: parsedEvent?.args.newPrice.toString(),
          txHash: receipt.hash,
        };
      }
      
      throw new Error('Sell event not found');
    } catch (error) {
      console.error('Error selling tokens:', error);
      throw error;
    }
  }

  // Get current state of bonding curve
  async getCurveState(curveAddress: string) {
    try {
      const curveContract = this.getBondingCurveContract(curveAddress);
      
      const [
        totalSupply,
        currentPrice,
        marketCap,
        graduated,
        totalRaised,
      ] = await Promise.all([
        curveContract.totalSupply(),
        curveContract.getCurrentPrice(),
        curveContract.getMarketCap(),
        curveContract.graduated(),
        curveContract.totalRaised(),
      ]);
      
      return {
        totalSupply: ethers.formatEther(totalSupply),
        currentPrice: ethers.formatEther(currentPrice),
        marketCap: ethers.formatEther(marketCap),
        graduated,
        totalRaised: ethers.formatEther(totalRaised),
      };
    } catch (error) {
      console.error('Error getting curve state:', error);
      throw error;
    }
  }

  // Calculate buy return
  async calculateBuyReturn(curveAddress: string, ethAmount: string): Promise<string> {
    try {
      const curveContract = this.getBondingCurveContract(curveAddress);
      const value = ethers.parseEther(ethAmount);
      const tokensOut = await curveContract.calculateBuyReturn(value);
      return ethers.formatEther(tokensOut);
    } catch (error) {
      console.error('Error calculating buy return:', error);
      throw error;
    }
  }

  // Calculate sell return
  async calculateSellReturn(curveAddress: string, tokenAmount: string): Promise<string> {
    try {
      const curveContract = this.getBondingCurveContract(curveAddress);
      const tokens = ethers.parseEther(tokenAmount);
      const ethOut = await curveContract.calculateSellReturn(tokens);
      return ethers.formatEther(ethOut);
    } catch (error) {
      console.error('Error calculating sell return:', error);
      throw error;
    }
  }

  // Get all curves created by a specific creator
  async getCurvesByCreator(creatorAddress: string): Promise<string[]> {
    try {
      const curves = await this.factoryContract.getCurvesByCreator(creatorAddress);
      return curves;
    } catch (error) {
      console.error('Error getting curves by creator:', error);
      throw error;
    }
  }

  // Get total number of curves
  async getTotalCurves(): Promise<number> {
    try {
      const total = await this.factoryContract.totalCurves();
      return Number(total);
    } catch (error) {
      console.error('Error getting total curves:', error);
      throw error;
    }
  }

  // Check if graduated
  async checkGraduation(curveAddress: string): Promise<boolean> {
    try {
      const curveContract = this.getBondingCurveContract(curveAddress);
      return await curveContract.graduated();
    } catch (error) {
      console.error('Error checking graduation:', error);
      throw error;
    }
  }
}