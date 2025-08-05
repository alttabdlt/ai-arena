import { Router } from 'express';
import { prisma } from '../config/database';
import { metaverseEventsService } from '../services/metaverseEventsService';

const router = Router();

// Webhook for agent deletion from metaverse
router.post('/agent-deleted', async (req, res) => {
  try {
    const { aiArenaBotId, agentId } = req.body;

    if (!aiArenaBotId) {
      return res.status(400).json({ error: 'Missing aiArenaBotId' });
    }

    // TODO: Verify webhook signature for security
    // const signature = req.headers['x-webhook-signature'];
    // if (!verifyWebhookSignature(signature, req.body)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    console.log(`Received agent deletion webhook for AI Arena Bot: ${aiArenaBotId}`);

    // Find the bot by AI Arena bot ID
    const bot = await prisma.bot.findFirst({
      where: {
        OR: [
          { id: aiArenaBotId },
          { metaverseAgentId: agentId },
        ],
      },
      include: {
        queueEntries: {
          where: { status: 'WAITING' },
        },
      },
    });

    if (!bot) {
      console.log(`Bot ${aiArenaBotId} not found in AI Arena database`);
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Check if bot is in active queue
    if (bot.queueEntries.length > 0) {
      console.log(`Bot ${aiArenaBotId} is in active queue, cannot delete`);
      return res.status(400).json({ 
        error: 'Cannot delete bot while in queue', 
        message: 'Bot must leave queue before deletion',
      });
    }

    // Delete the bot (cascade will handle related records)
    await prisma.bot.delete({
      where: { id: bot.id },
    });

    // Publish deletion event
    try {
      await metaverseEventsService.publishBotActivity('bot_deleted_from_metaverse', {
        botId: bot.id,
        aiArenaBotId,
        metaverseAgentId: agentId,
        source: 'metaverse_webhook',
        timestamp: new Date().toISOString(),
      });
    } catch (eventError) {
      console.error('Failed to publish bot deletion event:', eventError);
    }

    console.log(`✅ Bot ${bot.id} deleted from AI Arena following metaverse deletion`);

    return res.status(200).json({
      success: true,
      message: 'Bot deleted successfully',
      deletedBotId: bot.id,
    });
  } catch (error: any) {
    console.error('Webhook error - agent deletion:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Webhook for other metaverse events (future use)
router.post('/metaverse-event', async (req, res) => {
  try {
    const { event, data } = req.body;

    // Log the event
    console.log(`Received metaverse event: ${event}`, data);

    // Handle different event types
    switch (event) {
      case 'agent_created':
        // Handle agent creation if needed
        break;
      case 'agent_updated':
        // Handle agent updates
        break;
      case 'zone_transition':
        // Handle zone transitions
        break;
      default:
        console.log(`Unknown event type: ${event}`);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error - metaverse event:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;