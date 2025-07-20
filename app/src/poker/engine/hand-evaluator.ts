import * as pokersolver from 'pokersolver';
import { Card } from './poker-engine';

const Hand = pokersolver.Hand;

// Convert our card format to pokersolver format
function convertCardForSolver(card: Card): string {
  const rank = card[0];
  const suit = card[1];
  
  // Convert 10 to T for pokersolver
  const rankMap: { [key: string]: string } = {
    'T': 'T',
    'J': 'J', 
    'Q': 'Q',
    'K': 'K',
    'A': 'A'
  };
  
  const suitMap: { [key: string]: string } = {
    '♠': 's',
    '♥': 'h', 
    '♦': 'd',
    '♣': 'c'
  };
  
  return (rankMap[rank] || rank) + suitMap[suit];
}

export interface HandEvaluation {
  handType: string;        // e.g., "Straight", "Two Pair", "Flush"
  handRank: number;        // Numeric rank for comparison
  handDescription: string; // e.g., "Straight, Nine High"
  cards: string[];        // The specific cards that make up the hand
}

export function evaluatePokerHand(holeCards: Card[], communityCards: Card[]): HandEvaluation {
  // Convert all cards to pokersolver format
  const allCards = [...holeCards, ...communityCards];
  const solverCards = allCards.map(card => convertCardForSolver(card));
  
  // Evaluate the hand
  const hand = Hand.solve(solverCards);
  
  // Extract hand information
  const handType = hand.name;
  const handRank = hand.rank;
  const handDescription = hand.descr;
  
  return {
    handType,
    handRank,
    handDescription,
    cards: hand.cards.map((c: any) => c.toString())
  };
}

// Get a simple hand strength description for AI prompts
export function getSimpleHandDescription(evaluation: HandEvaluation): string {
  // Remove card details, just keep the hand type and high card
  // e.g., "Two Pair, Aces and Kings" -> "Two Pair (Aces and Kings)"
  // e.g., "Straight, Nine High" -> "Straight (9 high)"
  
  const { handType, handDescription } = evaluation;
  
  // Extract the relevant part after the comma
  const parts = handDescription.split(', ');
  if (parts.length > 1) {
    const detail = parts[1];
    // Convert "Nine High" to "9 high" for consistency
    const simplifiedDetail = detail
      .replace('Ace', 'A')
      .replace('King', 'K')
      .replace('Queen', 'Q')
      .replace('Jack', 'J')
      .replace('Ten', '10')
      .replace('Nine', '9')
      .replace('Eight', '8')
      .replace('Seven', '7')
      .replace('Six', '6')
      .replace('Five', '5')
      .replace('Four', '4')
      .replace('Three', '3')
      .replace('Two', '2')
      .replace('High', 'high');
    
    return `${handType} (${simplifiedDetail})`;
  }
  
  return handType;
}

// Compare two hands to see if AI correctly identified the hand
export function isHandMisread(
  aiDescription: string,
  actualEvaluation: HandEvaluation
): boolean {
  const actualType = actualEvaluation.handType.toLowerCase();
  const aiDescLower = aiDescription.toLowerCase();
  
  // Check if AI mentioned the correct hand type
  if (actualType === 'straight' && !aiDescLower.includes('straight')) {
    // Special case: AI might say "straight draw" when they have a made straight
    if (aiDescLower.includes('straight draw')) {
      return true; // This is a misread
    }
    return true;
  }
  
  if (actualType === 'flush' && !aiDescLower.includes('flush')) {
    if (aiDescLower.includes('flush draw')) {
      return true; // This is a misread
    }
    return true;
  }
  
  if (actualType === 'full house' && !aiDescLower.includes('full house')) {
    return true;
  }
  
  if (actualType === 'four of a kind' && !aiDescLower.includes('four of a kind') && !aiDescLower.includes('quads')) {
    return true;
  }
  
  if (actualType === 'three of a kind' && !aiDescLower.includes('three of a kind') && !aiDescLower.includes('trips') && !aiDescLower.includes('set')) {
    return true;
  }
  
  if (actualType === 'two pair' && !aiDescLower.includes('two pair')) {
    return true;
  }
  
  if (actualType === 'pair' && actualType === 'pair' && !aiDescLower.includes('pair')) {
    // Make sure it's not talking about a better hand
    if (!aiDescLower.includes('two pair') && !aiDescLower.includes('trips') && !aiDescLower.includes('set')) {
      return true;
    }
  }
  
  return false;
}