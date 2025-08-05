import { internal } from '../_generated/api';
import { MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { GameId } from './ids';
import { Game } from './game';

// Activity logging hooks to be called from various game events
export class ActivityHooks {
  private ctx: MutationCtx;
  private worldId: Id<'worlds'>;

  constructor(ctx: MutationCtx, worldId: Id<'worlds'>) {
    this.ctx = ctx;
    this.worldId = worldId;
  }

  // Helper to get agent info for a player
  private async getAgentInfo(playerId: GameId<'players'>) {
    const world = await this.ctx.db.get(this.worldId);
    if (!world) return { agentId: undefined, aiArenaBotId: undefined };
    
    const agent = world.agents.find((a: any) => a.playerId === playerId);
    return {
      agentId: agent?.id,
      aiArenaBotId: agent?.aiArenaBotId,
    };
  }

  // Log conversation start
  async logConversationStart(
    playerId: GameId<'players'>,
    inviteeId: GameId<'players'>,
    playerName: string,
    inviteeName: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'conversation_start',
      description: `${playerName} started a conversation with ${inviteeName}`,
      emoji: '💬',
      details: {
        targetPlayer: inviteeId as string,
      },
    });
  }

  // Log conversation end
  async logConversationEnd(
    playerId: GameId<'players'>,
    playerName: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'conversation_end',
      description: `${playerName} ended the conversation`,
      emoji: '👋',
    });
  }

  // Log zone change
  async logZoneChange(
    playerId: GameId<'players'>,
    playerName: string,
    fromZone: string,
    toZone: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'zone_change',
      description: `${playerName} moved from ${fromZone} to ${toZone}`,
      emoji: '🚶',
      details: {
        zone: toZone,
      },
    });
  }

  // Log activity start
  async logActivityStart(
    playerId: GameId<'players'>,
    playerName: string,
    activity: string,
    zone: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'activity_start',
      description: `${playerName} started ${activity} in ${zone}`,
      emoji: '🎯',
      details: {
        zone,
        message: activity,
      },
    });
  }

  // Log activity end
  async logActivityEnd(
    playerId: GameId<'players'>,
    playerName: string,
    activity: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'activity_end',
      description: `${playerName} finished ${activity}`,
      emoji: '✅',
      details: {
        message: activity,
      },
    });
  }

  // Log message sent
  async logMessage(
    playerId: GameId<'players'>,
    playerName: string,
    message: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'message',
      description: `${playerName}: ${message}`,
      emoji: '💭',
      details: {
        message,
      },
    });
  }

  // Log player movement (for significant movements only)
  async logMovement(
    playerId: GameId<'players'>,
    playerName: string,
    destination: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'message',
      description: `${playerName} is heading to ${destination}`,
      emoji: '🚶',
      details: {
        message: `Moving to ${destination}`,
      },
    });
  }

  // Log knock out (already implemented in agentOperations)
  async logKnockOut(
    playerId: GameId<'players'>,
    playerName: string,
    attackerId: GameId<'players'>,
    attackerName: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'knocked_out',
      description: `${playerName} was knocked out by ${attackerName}`,
      emoji: '💀',
      details: {
        targetPlayer: attackerId as string,
      },
    });
  }

  // Log hospital recovery
  async logHospitalRecovery(
    playerId: GameId<'players'>,
    playerName: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'hospital_recovery',
      description: `${playerName} recovered and left the hospital`,
      emoji: '🏥',
    });
  }

  // Log trade
  async logTrade(
    playerId: GameId<'players'>,
    playerName: string,
    partnerId: GameId<'players'>,
    partnerName: string,
    item: string
  ) {
    const agentInfo = await this.getAgentInfo(playerId);
    
    await this.ctx.runMutation(internal.aiTown.activityLogger.logActivity, {
      worldId: this.worldId,
      playerId: playerId as string,
      agentId: agentInfo.agentId,
      aiArenaBotId: agentInfo.aiArenaBotId,
      type: 'trade',
      description: `${playerName} traded ${item} with ${partnerName}`,
      emoji: '🤝',
      details: {
        targetPlayer: partnerId as string,
        item,
      },
    });
  }
}