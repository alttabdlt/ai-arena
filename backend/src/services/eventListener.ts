import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { PubSub } from 'graphql-subscriptions';
import BondingCurveFactoryABI from '../../../contracts/out/BondingCurveFactory.sol/BondingCurveFactory.json';
import BondingCurveABI from '../../../contracts/out/BondingCurve.sol/BondingCurve.json';
import GraduationControllerABI from '../../../contracts/out/GraduationController.sol/GraduationController.json';

export class EventListener {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private graduationContract: ethers.Contract;
  private prisma: PrismaClient;
  private redis: Redis;
  private pubsub: PubSub;
  private watchedCurves: Map<string, ethers.Contract> = new Map();

  constructor(prisma: PrismaClient, redis: Redis, pubsub: PubSub) {
    this.prisma = prisma;
    this.redis = redis;
    this.pubsub = pubsub;
    
    this.provider = new ethers.JsonRpcProvider(process.env.HYPEREVM_RPC_URL);
    
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

  async startListening() {
    console.log('Starting event listeners...');
    
    // Listen for new bonding curves
    this.listenToFactory();
    
    // Listen for graduation events
    this.listenToGraduation();
    
    // Load and watch existing curves
    await this.loadExistingCurves();
    
    console.log('Event listeners started successfully');
  }

  private listenToFactory() {
    // Listen for CurveCreated events
    this.factoryContract.on('CurveCreated', async (curve, bot, creator, name, symbol, event) => {
      console.log(`New curve created: ${curve} for bot ${bot}`);
      
      try {
        // Save to database
        const botData = await this.prisma.bot.create({
          data: {
            address: bot,
            name,
            description: `Bonding curve for ${name}`,
            tags: [],
            creatorAddress: creator.toLowerCase(),
            creator: {
              connectOrCreate: {
                where: { address: creator.toLowerCase() },
                create: { address: creator.toLowerCase(), kycTier: 0 },
              },
            },
            bondingCurve: {
              create: {
                currentSupply: '0',
                currentPrice: '0.00001',
                marketCap: '0',
                volume24h: '0',
                holders: 0,
                graduated: false,
              },
            },
          },
          include: {
            bondingCurve: true,
            creator: true,
          },
        });
        
        // Start watching this curve
        this.watchBondingCurve(curve, bot);
        
        // Publish to GraphQL subscriptions
        this.pubsub.publish('BOT_CREATED', { botCreated: botData });
        
        // Broadcast via WebSocket
        await this.redis.publish('curve:created', JSON.stringify({
          curve,
          bot,
          creator,
          name,
          symbol,
          timestamp: new Date().toISOString(),
        }));
        
      } catch (error) {
        console.error('Error handling CurveCreated event:', error);
      }
    });
  }

  private listenToGraduation() {
    // Listen for BotGraduated events
    this.graduationContract.on('BotGraduated', async (bondingCurve, bot, vault, totalSupply, ethRaised, event) => {
      console.log(`Bot graduated: ${bot} with ${ethers.formatEther(ethRaised)} ETH raised`);
      
      try {
        // Update database
        await this.prisma.bondingCurve.update({
          where: { botId: bot },
          data: {
            graduated: true,
            graduatedAt: new Date(),
          },
        });
        
        // Publish graduation event
        const graduationData = {
          botId: bot,
          botName: await this.getBotName(bot),
          finalPrice: ethers.formatEther(totalSupply),
          totalRaised: ethers.formatEther(ethRaised),
          holders: await this.getHolderCount(bondingCurve),
          timestamp: new Date().toISOString(),
        };
        
        this.pubsub.publish('GRADUATION_EVENT', { graduationEvent: graduationData });
        
        // Broadcast via WebSocket
        await this.redis.publish('graduation:event', JSON.stringify(graduationData));
        
      } catch (error) {
        console.error('Error handling BotGraduated event:', error);
      }
    });
  }

  private watchBondingCurve(curveAddress: string, botId: string) {
    const curveContract = new ethers.Contract(
      curveAddress,
      BondingCurveABI.abi,
      this.provider
    );
    
    // Store for later reference
    this.watchedCurves.set(curveAddress, curveContract);
    
    // Listen for Buy events
    curveContract.on('Buy', async (buyer, ethIn, tokensOut, newPrice, event) => {
      console.log(`Buy on ${curveAddress}: ${ethers.formatEther(ethIn)} ETH for ${ethers.formatEther(tokensOut)} tokens`);
      
      try {
        // Save transaction
        const tx = await this.prisma.transaction.create({
          data: {
            type: 'BUY',
            userAddress: buyer.toLowerCase(),
            user: {
              connectOrCreate: {
                where: { address: buyer.toLowerCase() },
                create: { address: buyer.toLowerCase(), kycTier: 0 },
              },
            },
            bondingCurveId: botId,
            amount: tokensOut.toString(),
            price: newPrice.toString(),
            totalCost: ethIn.toString(),
            txHash: event.log.transactionHash,
          },
        });
        
        // Update curve state
        await this.updateCurveState(curveAddress, botId);
        
        // Publish price update
        const priceUpdate = {
          botId,
          price: ethers.formatEther(newPrice),
          marketCap: await this.getMarketCap(curveAddress),
          volume24h: await this.getVolume24h(botId),
          holders: await this.getHolderCount(curveAddress),
          timestamp: new Date().toISOString(),
        };
        
        this.pubsub.publish(`PRICE_UPDATE_${botId}`, { priceUpdate });
        this.pubsub.publish('ALL_PRICE_UPDATES', { priceUpdate });
        
        // Broadcast via WebSocket
        await this.redis.publish(`price:${botId}`, JSON.stringify(priceUpdate));
        
      } catch (error) {
        console.error('Error handling Buy event:', error);
      }
    });
    
    // Listen for Sell events
    curveContract.on('Sell', async (seller, tokensIn, ethOut, newPrice, event) => {
      console.log(`Sell on ${curveAddress}: ${ethers.formatEther(tokensIn)} tokens for ${ethers.formatEther(ethOut)} ETH`);
      
      try {
        // Save transaction
        const tx = await this.prisma.transaction.create({
          data: {
            type: 'SELL',
            userAddress: seller.toLowerCase(),
            user: {
              connectOrCreate: {
                where: { address: seller.toLowerCase() },
                create: { address: seller.toLowerCase(), kycTier: 0 },
              },
            },
            bondingCurveId: botId,
            amount: tokensIn.toString(),
            price: newPrice.toString(),
            totalCost: ethOut.toString(),
            txHash: event.log.transactionHash,
          },
        });
        
        // Update curve state
        await this.updateCurveState(curveAddress, botId);
        
        // Publish price update
        const priceUpdate = {
          botId,
          price: ethers.formatEther(newPrice),
          marketCap: await this.getMarketCap(curveAddress),
          volume24h: await this.getVolume24h(botId),
          holders: await this.getHolderCount(curveAddress),
          timestamp: new Date().toISOString(),
        };
        
        this.pubsub.publish(`PRICE_UPDATE_${botId}`, { priceUpdate });
        this.pubsub.publish('ALL_PRICE_UPDATES', { priceUpdate });
        
        // Broadcast via WebSocket
        await this.redis.publish(`price:${botId}`, JSON.stringify(priceUpdate));
        
      } catch (error) {
        console.error('Error handling Sell event:', error);
      }
    });
  }

  private async loadExistingCurves() {
    try {
      // Get all curves from factory
      const totalCurves = await this.factoryContract.totalCurves();
      const allCurves = await this.factoryContract.getAllCurves();
      
      console.log(`Loading ${totalCurves} existing curves...`);
      
      for (const curveAddress of allCurves) {
        // Get bot address from curve
        const curveContract = new ethers.Contract(
          curveAddress,
          BondingCurveABI.abi,
          this.provider
        );
        
        const botAddress = await curveContract.bot();
        
        // Start watching
        this.watchBondingCurve(curveAddress, botAddress);
      }
      
    } catch (error) {
      console.error('Error loading existing curves:', error);
    }
  }

  private async updateCurveState(curveAddress: string, botId: string) {
    try {
      const curveContract = this.watchedCurves.get(curveAddress);
      if (!curveContract) return;
      
      const [totalSupply, currentPrice, marketCap] = await Promise.all([
        curveContract.totalSupply(),
        curveContract.getCurrentPrice(),
        curveContract.getMarketCap(),
      ]);
      
      await this.prisma.bondingCurve.update({
        where: { botId },
        data: {
          currentSupply: totalSupply.toString(),
          currentPrice: currentPrice.toString(),
          marketCap: marketCap.toString(),
        },
      });
      
    } catch (error) {
      console.error('Error updating curve state:', error);
    }
  }

  private async getBotName(botId: string): Promise<string> {
    const bot = await this.prisma.bot.findUnique({
      where: { address: botId },
      select: { name: true },
    });
    return bot?.name || 'Unknown Bot';
  }

  private async getMarketCap(curveAddress: string): Promise<string> {
    const curveContract = this.watchedCurves.get(curveAddress);
    if (!curveContract) return '0';
    
    const marketCap = await curveContract.getMarketCap();
    return ethers.formatEther(marketCap);
  }

  private async getHolderCount(curveAddress: string): Promise<number> {
    // This would need to be tracked by analyzing Transfer events
    // For now, return a placeholder
    return 0;
  }

  private async getVolume24h(botId: string): Promise<string> {
    // Calculate 24h volume from database
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await this.prisma.transaction.aggregate({
      where: {
        bondingCurveId: botId,
        createdAt: { gte: since },
      },
      _sum: {
        totalCost: true,
      },
    });
    
    return result._sum.totalCost?.toString() || '0';
  }

  stopListening() {
    // Remove all listeners
    this.factoryContract.removeAllListeners();
    this.graduationContract.removeAllListeners();
    
    this.watchedCurves.forEach((contract) => {
      contract.removeAllListeners();
    });
    
    this.watchedCurves.clear();
    
    console.log('Event listeners stopped');
  }
}