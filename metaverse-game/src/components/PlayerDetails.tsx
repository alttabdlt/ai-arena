import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import closeImg from '../../assets/close.svg';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import ActivityLogs from './ActivityLogs';
import { toastOnError } from '../toasts';
import { useSendInput } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';
import { MessageSquare, Activity } from 'lucide-react';

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const [activeTab, setActiveTab] = useState<'chat' | 'logs'>('chat');
  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId });

  const players = [...game.world.players.values()];
  const humanPlayer = players.find((p) => p.human === humanTokenIdentifier);
  const humanConversation = humanPlayer ? game.world.playerConversation(humanPlayer) : undefined;
  // Always select the other player if we're in a conversation with them.
  if (humanPlayer && humanConversation) {
    const otherPlayerIds = [...humanConversation.participants.keys()].filter(
      (p) => p !== humanPlayer.id,
    );
    playerId = otherPlayerIds[0];
  }

  const player = playerId && game.world.players.get(playerId);
  const playerConversation = player && game.world.playerConversation(player);

  const previousConversation = useQuery(
    api.world.previousConversation,
    playerId ? { worldId, playerId } : 'skip',
  );

  const playerDescription = playerId && game.playerDescriptions.get(playerId);

  const startConversation = useSendInput(engineId, 'startConversation');
  const acceptInvite = useSendInput(engineId, 'acceptInvite');
  const rejectInvite = useSendInput(engineId, 'rejectInvite');
  const leaveConversation = useSendInput(engineId, 'leaveConversation');

  if (!playerId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p className="text-center">Click on an agent to see chat</p>
      </div>
    );
  }
  if (!player) {
    return null;
  }
  const isMe = humanPlayer && player.id === humanPlayer.id;
  const canInvite = !isMe && !playerConversation && humanPlayer && !humanConversation;
  const sameConversation =
    !isMe &&
    humanPlayer &&
    humanConversation &&
    playerConversation &&
    humanConversation.id === playerConversation.id;

  const humanStatus =
    humanPlayer && humanConversation && humanConversation.participants.get(humanPlayer.id)?.status;
  const playerStatus = playerConversation && playerConversation.participants.get(playerId)?.status;

  const haveInvite = sameConversation && humanStatus?.kind === 'invited';
  const waitingForAccept =
    sameConversation && playerConversation.participants.get(playerId)?.status.kind === 'invited';
  const waitingForNearby =
    sameConversation && playerStatus?.kind === 'walkingOver' && humanStatus?.kind === 'walkingOver';

  const inConversationWithMe =
    sameConversation &&
    playerStatus?.kind === 'participating' &&
    humanStatus?.kind === 'participating';

  const onStartConversation = async () => {
    if (!humanPlayer || !playerId) {
      return;
    }
    console.log(`Starting conversation`);
    await toastOnError(startConversation({ playerId: humanPlayer.id, invitee: playerId }));
  };
  const onAcceptInvite = async () => {
    if (!humanPlayer || !humanConversation || !playerId) {
      return;
    }
    await toastOnError(
      acceptInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onRejectInvite = async () => {
    if (!humanPlayer || !humanConversation) {
      return;
    }
    await toastOnError(
      rejectInvite({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  const onLeaveConversation = async () => {
    if (!humanPlayer || !inConversationWithMe || !humanConversation) {
      return;
    }
    await toastOnError(
      leaveConversation({
        playerId: humanPlayer.id,
        conversationId: humanConversation.id,
      }),
    );
  };
  // const pendingSuffix = (inputName: string) =>
  //   [...inflightInputs.values()].find((i) => i.name === inputName) ? ' opacity-50' : '';

  const pendingSuffix = (s: string) => '';
  
  // Get agent info for activity logs
  const agent = player && [...game.world.agents.values()].find(a => a.playerId === player.id);
  
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">
          {playerDescription?.name}
        </h2>
        <button
          className="text-gray-400 hover:text-gray-200 transition-colors p-1"
          onClick={() => setSelectedElement(undefined)}
        >
          <img className="w-5 h-5" src={closeImg} />
        </button>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-1 mb-4 bg-gray-800/50 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all ${
            activeTab === 'chat'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm font-medium">Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all ${
            activeTab === 'logs'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">Logs</span>
        </button>
      </div>
      {/* Tab Content */}
      {activeTab === 'chat' ? (
        <>
          {canInvite && (
        <button
          className={
            'mt-3 w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors' +
            pendingSuffix('startConversation')
          }
          onClick={onStartConversation}
        >
          Start conversation
        </button>
      )}
      {waitingForAccept && (
        <button className="mt-3 w-full py-2 px-4 bg-gray-600 text-white rounded opacity-50 cursor-not-allowed">
          Waiting for accept...
        </button>
      )}
      {waitingForNearby && (
        <button className="mt-3 w-full py-2 px-4 bg-gray-600 text-white rounded opacity-50 cursor-not-allowed">
          Walking over...
        </button>
      )}
      {inConversationWithMe && (
        <button
          className={
            'mt-3 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors' +
            pendingSuffix('leaveConversation')
          }
          onClick={onLeaveConversation}
        >
          Leave conversation
        </button>
      )}
      {haveInvite && (
        <>
          <button
            className={
              'mt-3 w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded transition-colors' +
              pendingSuffix('acceptInvite')
            }
            onClick={onAcceptInvite}
          >
            Accept
          </button>
          <button
            className={
              'mt-3 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors' +
              pendingSuffix('rejectInvite')
            }
            onClick={onRejectInvite}
          >
            Reject
          </button>
        </>
      )}
      {!playerConversation && player.activity && player.activity.until > Date.now() && (
        <div className="mt-3 p-2 bg-gray-800 rounded text-sm text-center">
          {player.activity.description}
        </div>
      )}
      <div className="my-3 p-3 bg-gray-800 rounded">
        <p className="text-sm text-gray-300">
          {!isMe && playerDescription?.description}
          {isMe && <i>This is you!</i>}
          {!isMe && inConversationWithMe && (
            <>
              <br />
              <br />(<i>Conversing with you!</i>)
            </>
          )}
        </p>
      </div>
      {!isMe && playerConversation && playerStatus?.kind === 'participating' && (
        <Messages
          worldId={worldId}
          engineId={engineId}
          inConversationWithMe={inConversationWithMe ?? false}
          conversation={{ kind: 'active', doc: playerConversation }}
          humanPlayer={humanPlayer}
          scrollViewRef={scrollViewRef}
        />
      )}
      {!playerConversation && previousConversation && (
        <>
          <h3 className="text-lg font-semibold mt-4 mb-2">Previous conversation</h3>
          <Messages
            worldId={worldId}
            engineId={engineId}
            inConversationWithMe={false}
            conversation={{ kind: 'archived', doc: previousConversation }}
            humanPlayer={humanPlayer}
            scrollViewRef={scrollViewRef}
          />
        </>
      )}
        </>
      ) : (
        <ActivityLogs
          worldId={worldId}
          playerId={playerId}
          agentId={agent?.id}
          aiArenaBotId={agent?.aiArenaBotId}
        />
      )}
    </>
  );
}
