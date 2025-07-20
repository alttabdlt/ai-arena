import { Decimal } from '@prisma/client/runtime/library';

export class PriceService {
  // Bonding curve parameters
  private readonly CURVE_CONSTANT = 0.003; // 0.003 ETH base price
  private readonly CURVE_EXPONENT_NUM = 3; // Numerator for 1.5 exponent
  private readonly CURVE_EXPONENT_DEN = 2; // Denominator for 1.5 exponent
  private readonly PLATFORM_FEE_BPS = 100; // 1%
  private readonly CREATOR_FEE_BPS = 200; // 2%
  private readonly MAX_SUPPLY = 1_000_000_000; // 1B tokens
  private readonly DECIMALS = 18;

  // Calculate price at a given supply using the bonding curve formula
  // price = 0.003 * (supply ^ 1.5)
  calculatePriceAtSupply(supply: number): number {
    if (supply === 0) return this.CURVE_CONSTANT;
    
    // Calculate supply^1.5 = supply^(3/2) = sqrt(supply^3)
    const supplyPow3 = Math.pow(supply, 3);
    const supplyPow1_5 = Math.sqrt(supplyPow3);
    
    return this.CURVE_CONSTANT * supplyPow1_5;
  }

  // Calculate the integral of the bonding curve from 0 to supply
  // This gives us the total ETH needed to reach that supply
  calculateIntegralAtSupply(supply: number): number {
    if (supply === 0) return 0;
    
    // Integral of 0.003 * x^1.5 = 0.003 * (2/5) * x^2.5
    // = 0.003 * 0.4 * x^2.5 = 0.0012 * x^2.5
    const exponent = 2.5; // (1.5 + 1)
    const coefficient = this.CURVE_CONSTANT * (2 / 5);
    
    return coefficient * Math.pow(supply, exponent);
  }

  // Calculate how many tokens you get for a given ETH amount
  calculateBuyReturn(currentSupply: number, ethAmount: number): {
    tokensOut: number;
    averagePrice: number;
    priceImpact: number;
    newSupply: number;
    newPrice: number;
  } {
    // Apply fees
    const ethAfterFees = this.applyFeesOnBuy(ethAmount);
    
    // Current cost basis (total ETH to reach current supply)
    const currentIntegral = this.calculateIntegralAtSupply(currentSupply);
    
    // New cost basis after adding ETH
    const newIntegral = currentIntegral + ethAfterFees;
    
    // Solve for new supply: find x where integral(x) = newIntegral
    // Using Newton's method for better precision
    const newSupply = this.solveForSupply(newIntegral);
    
    // Tokens received
    const tokensOut = newSupply - currentSupply;
    
    // Price calculations
    const oldPrice = this.calculatePriceAtSupply(currentSupply);
    const newPrice = this.calculatePriceAtSupply(newSupply);
    const averagePrice = ethAmount / tokensOut;
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;
    
    return {
      tokensOut,
      averagePrice,
      priceImpact,
      newSupply,
      newPrice,
    };
  }

  // Calculate how much ETH you get for selling tokens
  calculateSellReturn(currentSupply: number, tokenAmount: number): {
    ethOut: number;
    averagePrice: number;
    priceImpact: number;
    newSupply: number;
    newPrice: number;
  } {
    if (tokenAmount >= currentSupply) {
      throw new Error('Cannot sell more tokens than current supply');
    }
    
    // New supply after selling
    const newSupply = currentSupply - tokenAmount;
    
    // Calculate ETH difference between integrals
    const currentIntegral = this.calculateIntegralAtSupply(currentSupply);
    const newIntegral = this.calculateIntegralAtSupply(newSupply);
    const ethBeforeFees = currentIntegral - newIntegral;
    
    // Apply fees
    const ethOut = this.applyFeesOnSell(ethBeforeFees);
    
    // Price calculations
    const oldPrice = this.calculatePriceAtSupply(currentSupply);
    const newPrice = this.calculatePriceAtSupply(newSupply);
    const averagePrice = ethOut / tokenAmount;
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100;
    
    return {
      ethOut,
      averagePrice,
      priceImpact: Math.abs(priceImpact), // Make positive for UI
      newSupply,
      newPrice,
    };
  }

  // Calculate market cap at current supply
  calculateMarketCap(supply: number): number {
    const price = this.calculatePriceAtSupply(supply);
    return supply * price;
  }

  // Calculate supply needed to reach a target market cap
  calculateSupplyForMarketCap(targetMarketCap: number): number {
    // marketCap = supply * price = supply * 0.003 * supply^1.5
    // marketCap = 0.003 * supply^2.5
    // supply^2.5 = marketCap / 0.003
    // supply = (marketCap / 0.003)^(2/5)
    
    const ratio = targetMarketCap / this.CURVE_CONSTANT;
    return Math.pow(ratio, 2 / 5);
  }

  // Check if market cap has reached graduation threshold
  isGraduationThreshold(supply: number): boolean {
    const marketCap = this.calculateMarketCap(supply);
    return marketCap >= 69_000; // $69k graduation threshold
  }

  // Apply fees on buy (platform + creator fees)
  private applyFeesOnBuy(ethAmount: number): number {
    const totalFeeBps = this.PLATFORM_FEE_BPS + this.CREATOR_FEE_BPS;
    const feeMultiplier = (10_000 - totalFeeBps) / 10_000;
    return ethAmount * feeMultiplier;
  }

  // Apply fees on sell
  private applyFeesOnSell(ethAmount: number): number {
    const totalFeeBps = this.PLATFORM_FEE_BPS + this.CREATOR_FEE_BPS;
    const feeMultiplier = (10_000 - totalFeeBps) / 10_000;
    return ethAmount * feeMultiplier;
  }

  // Solve for supply given an integral value using Newton's method
  private solveForSupply(targetIntegral: number): number {
    if (targetIntegral === 0) return 0;
    
    // Initial guess using simplified calculation
    let x = Math.pow(targetIntegral / (this.CURVE_CONSTANT * 0.4), 0.4);
    
    // Newton's method iterations
    for (let i = 0; i < 10; i++) {
      const f = this.calculateIntegralAtSupply(x) - targetIntegral;
      const fPrime = this.calculatePriceAtSupply(x);
      
      if (Math.abs(f) < 0.000001) break; // Convergence threshold
      
      x = x - f / fPrime;
    }
    
    return x;
  }

  // Format token amount with decimals
  formatTokenAmount(amount: number): string {
    return (amount / Math.pow(10, this.DECIMALS)).toFixed(6);
  }

  // Parse token amount from string
  parseTokenAmount(amount: string): number {
    return parseFloat(amount) * Math.pow(10, this.DECIMALS);
  }

  // Calculate fees breakdown
  calculateFees(ethAmount: number): {
    platformFee: number;
    creatorFee: number;
    totalFees: number;
    netAmount: number;
  } {
    const platformFee = (ethAmount * this.PLATFORM_FEE_BPS) / 10_000;
    const creatorFee = (ethAmount * this.CREATOR_FEE_BPS) / 10_000;
    const totalFees = platformFee + creatorFee;
    const netAmount = ethAmount - totalFees;
    
    return {
      platformFee,
      creatorFee,
      totalFees,
      netAmount,
    };
  }

  // Generate bonding curve data points for visualization
  generateCurveData(maxSupply: number = 1_000_000, points: number = 100): Array<{
    supply: number;
    price: number;
    marketCap: number;
  }> {
    const data = [];
    const step = maxSupply / points;
    
    for (let i = 0; i <= points; i++) {
      const supply = i * step;
      const price = this.calculatePriceAtSupply(supply);
      const marketCap = this.calculateMarketCap(supply);
      
      data.push({
        supply,
        price,
        marketCap,
      });
    }
    
    return data;
  }

  // Calculate price impact for a given trade
  estimatePriceImpact(
    currentSupply: number,
    tradeAmount: number,
    isBuy: boolean
  ): number {
    const currentPrice = this.calculatePriceAtSupply(currentSupply);
    
    if (isBuy) {
      const result = this.calculateBuyReturn(currentSupply, tradeAmount);
      return result.priceImpact;
    } else {
      const result = this.calculateSellReturn(currentSupply, tradeAmount);
      return result.priceImpact;
    }
  }

  // Get key metrics at graduation
  getGraduationMetrics(): {
    supply: number;
    price: number;
    totalEthRaised: number;
    marketCap: number;
  } {
    const targetMarketCap = 69_000;
    const supply = this.calculateSupplyForMarketCap(targetMarketCap);
    const price = this.calculatePriceAtSupply(supply);
    const totalEthRaised = this.calculateIntegralAtSupply(supply);
    
    return {
      supply,
      price,
      totalEthRaised,
      marketCap: targetMarketCap,
    };
  }
}