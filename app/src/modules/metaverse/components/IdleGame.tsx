import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import BotSelector from '@/modules/metaverse/components/BotSelector';
import BotSprite from '@/modules/metaverse/components/BotSprite';
import StatsPanel from '@/modules/metaverse/components/StatsPanel';
import ClaimXPModal from '@/modules/metaverse/components/ClaimXPModal';
import { useBots } from '@/modules/metaverse/hooks/useBots';
import { useIdleLoop } from '@/modules/metaverse/hooks/useIdleLoop';
import { useOfflineProgress } from '@/modules/metaverse/hooks/useOfflineProgress';
import WelcomeBackModal from '@/modules/metaverse/components/WelcomeBackModal';
import { GET_UNCLAIMED_WINNINGS } from '@/graphql/queries/betting';
// import { JackpotDisplay, WinnerModal } from '@/modules/idle-revolution/components/jackpot';

const IdleGame: React.FC = () => {
  const navigate = useNavigate();
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [jackpotWinner, setJackpotWinner] = useState<any | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [unclaimedWinnings, setUnclaimedWinnings] = useState<any[]>([]);
  const { bots, loading, refetch: refetchBots } = useBots();
  
  // Add console logging for debugging
  useEffect(() => {
    console.log('IdleGame mounted');
    console.log('Bots:', bots);
    console.log('Loading:', loading);
  }, [bots, loading]);
  
  const selectedBot = bots.find(b => b.id === selectedBotId);
  
  // Use offline progress hook
  const {
    offlineProgress,
    hasClaimed,
    handleClaimRewards,
    formatTimeAway,
    claiming
  } = useOfflineProgress(selectedBotId);
  
  // Query for unclaimed winnings
  const { data: winningsData, refetch: refetchWinnings } = useQuery(GET_UNCLAIMED_WINNINGS, {
    variables: { botId: selectedBotId || '' },
    skip: !selectedBotId,
    pollInterval: 30000, // Check every 30 seconds
    onCompleted: (data) => {
      if (data?.myBets && data.myBets.length > 0) {
        setUnclaimedWinnings(data.myBets);
        setShowClaimModal(true);
      }
    }
  });
  
  // Pass bot's actual experience data to idle loop
  const { currentActivity, level, xp, maxXp, xpPerSecond, totalXp } = useIdleLoop({
    botId: selectedBotId,
    personality: selectedBot?.personality || 'WORKER',
    initialLevel: selectedBot?.experience?.level || 1,
    initialCurrentXP: selectedBot?.experience?.currentXP || 0,
    initialTotalXP: selectedBot?.experience?.totalXP || 0,
    initialXPToNextLevel: selectedBot?.experience?.xpToNextLevel || 100
  });

  // Auto-select first bot when loaded
  useEffect(() => {
    if (bots.length > 0 && !selectedBotId) {
      setSelectedBotId(bots[0].id);
    }
  }, [bots, selectedBotId]);
  
  // Handle claim complete
  const handleClaimComplete = () => {
    setUnclaimedWinnings([]);
    setShowClaimModal(false);
    refetchBots(); // Refresh bot data to show new XP
    refetchWinnings(); // Check for any more winnings
  };

  // Calculate total earnings
  const totalXPEarned = totalXp || selectedBot?.experience?.totalXP || 0;
  const totalIdleEarned = Math.floor((totalXPEarned / 100) * 10); // Rough estimate

  return (
    <>
      {/* Welcome back modal for offline progress */}
      {offlineProgress && !hasClaimed && (
        <WelcomeBackModal
          offlineProgress={offlineProgress}
          formatTimeAway={formatTimeAway}
          onClaim={handleClaimRewards}
          claiming={claiming}
        />
      )}
      
      {/* Winner modal for jackpot - temporarily disabled */}
      {/* jackpotWinner && (
        <WinnerModal
          winner={jackpotWinner}
          onClose={() => setJackpotWinner(null)}
        />
      ) */}
      
      {/* XP Claim Modal for tournament winnings */}
      <ClaimXPModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        winnings={unclaimedWinnings}
        selectedBotId={selectedBotId}
        onClaimComplete={handleClaimComplete}
      />
      
      <div className="idle-game-redesigned">
      {/* Compact header with inline elements */}
      <header className="game-header-compact">
        <div className="header-left">
          <h1 className="header-title">
            <span className="gradient-text">AI Arena</span>
            <span className="header-divider">•</span>
            <span className="header-subtitle">Idle</span>
          </h1>
        </div>
        
        <div className="header-center">
          {selectedBot && (
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="stat-label">Total XP</span>
                <span className="stat-value">{totalXPEarned.toLocaleString()}</span>
              </div>
              <div className="quick-stat">
                <span className="stat-label">$IDLE</span>
                <span className="stat-value">{totalIdleEarned.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="header-right">
          <div className="flex items-center gap-2">
            <BotSelector
              bots={bots}
              selectedBotId={selectedBotId}
              onSelectBot={setSelectedBotId}
              loading={loading}
            />
            <button
              className="deploy-btn"
              onClick={() => navigate('/deploy')}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '20px' }}>+</span>
              Deploy New Bot
            </button>
          </div>
        </div>
      </header>

      {/* Jackpot Display - temporarily disabled */}
      {/* <div className="jackpot-section mb-4">
        <JackpotDisplay 
          onWin={(winner) => setJackpotWinner(winner)}
          className="mx-auto max-w-md"
        />
      </div> */}

      {/* Main content with optimized grid */}
      <main className="game-main-content">
        {/* Left Panel - Compact Sprite Area */}
        <section className="sprite-section">
          {selectedBot ? (
            <>
              <div className="sprite-card">
                <BotSprite
                  bot={selectedBot}
                  currentActivity={currentActivity}
                />
              </div>
              
              {/* Quick info cards */}
              <div className="info-cards-row">
                <div className="info-card personality-card">
                  <span className="card-icon">{
                    selectedBot.personality === 'CRIMINAL' ? '🔫' :
                    selectedBot.personality === 'GAMBLER' ? '🎲' : '⚒️'
                  }</span>
                  <span className="card-value">{selectedBot.personality}</span>
                </div>
                <div className="info-card level-card">
                  <span className="card-icon">⭐</span>
                  <span className="card-value">Lv {level}</span>
                </div>
                <div className="info-card xp-rate-card">
                  <span className="card-icon">⚡</span>
                  <span className="card-value">+{Math.floor(xpPerSecond * 3600)}/h</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🎮</div>
              <p className="empty-text">
                {loading ? 'Loading bots...' : 'Select a bot to start'}
              </p>
            </div>
          )}
        </section>

        {/* Right Panel - Reorganized Stats */}
        <section className="stats-section">
          {selectedBot ? (
            <StatsPanel
              bot={selectedBot}
              level={level}
              xp={xp}
              maxXp={maxXp}
              currentActivity={currentActivity}
              xpPerSecond={xpPerSecond}
            />
          ) : (
            <div className="stats-placeholder">
              <p>Select a bot to view stats</p>
            </div>
          )}
        </section>
      </main>
    </div>
    </>
  );
};

export default IdleGame;