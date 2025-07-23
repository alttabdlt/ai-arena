import { BaseReverseHangmanAIAgent, AIAgentConfig, createReverseHangmanAIAgent } from './ai-agents';
import { ReverseHangmanState } from '../engine/reverse-hangman-engine';
import { ReverseHangmanAIDecision } from './ai-decision-structure';

export interface TournamentInfo {
  currentRound: number;
  totalRounds: number;
  currentScore: number;
}

export class ReverseHangmanAIAgentManager {
  private agents: Map<string, BaseReverseHangmanAIAgent> = new Map();
  private currentAgentIndex: number = 0;
  private agentOrder: string[] = [];
  private lockedAgentId: string | null = null;

  constructor(agentConfigs: AIAgentConfig[]) {
    this.initializeAgents(agentConfigs);
  }

  private initializeAgents(configs: AIAgentConfig[]): void {
    configs.forEach(config => {
      const agent = createReverseHangmanAIAgent(config);
      this.agents.set(config.id, agent);
      this.agentOrder.push(config.id);
    });
  }

  async getNextDecision(
    gameState: ReverseHangmanState,
    tournamentInfo?: TournamentInfo
  ): Promise<{
    agentId: string;
    agentName: string;
    decision: ReverseHangmanAIDecision;
  }> {
    if (this.agentOrder.length === 0) {
      throw new Error('No AI agents configured');
    }

    let agentId: string;
    
    // If an agent is locked for the round, use it
    if (this.lockedAgentId) {
      agentId = this.lockedAgentId;
    } else {
      // Otherwise use the current agent in rotation
      agentId = this.agentOrder[this.currentAgentIndex];
      // Move to next agent for next decision (only when not locked)
      this.currentAgentIndex = (this.currentAgentIndex + 1) % this.agentOrder.length;
    }
    
    const agent = this.agents.get(agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Get decision from agent
    const decision = await agent.makeDecision(gameState, tournamentInfo);

    return {
      agentId: agent.getId(),
      agentName: agent.getName(),
      decision
    };
  }

  setCurrentAgentForRound(agentId?: string): void {
    if (agentId) {
      // Lock specific agent
      this.lockedAgentId = agentId;
    } else {
      // Lock current agent in rotation
      this.lockedAgentId = this.agentOrder[this.currentAgentIndex];
    }
  }

  selectRandomAgentForRound(): string {
    const randomIndex = Math.floor(Math.random() * this.agentOrder.length);
    const agentId = this.agentOrder[randomIndex];
    this.lockedAgentId = agentId;
    return agentId;
  }

  releaseCurrentAgent(): void {
    this.lockedAgentId = null;
  }

  getCurrentAgent(): BaseReverseHangmanAIAgent | undefined {
    const agentId = this.agentOrder[this.currentAgentIndex];
    return this.agents.get(agentId);
  }

  getAgent(agentId: string): BaseReverseHangmanAIAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): BaseReverseHangmanAIAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentCount(): number {
    return this.agents.size;
  }

  resetCurrentAgentIndex(): void {
    this.currentAgentIndex = 0;
  }

  resetAllAgents(): void {
    this.agents.forEach(agent => agent.reset());
    this.currentAgentIndex = 0;
  }

  getAgentDecisionHistory(agentId: string): ReverseHangmanAIDecision[] {
    const agent = this.agents.get(agentId);
    return agent ? agent.getDecisionHistory() : [];
  }

  getTournamentStats(): {
    agentId: string;
    agentName: string;
    model: string;
    decisionsCount: number;
  }[] {
    return this.agentOrder.map(agentId => {
      const agent = this.agents.get(agentId)!;
      return {
        agentId: agent.getId(),
        agentName: agent.getName(),
        model: agent.getModel(),
        decisionsCount: agent.getDecisionHistory().length
      };
    });
  }
}