import React, { useState, useEffect } from 'react';
import BotSelector from '@/modules/metaverse/components/BotSelector';
import BotSprite from '@/modules/metaverse/components/BotSprite';
import StatsPanel from '@/modules/metaverse/components/StatsPanel';
import { useBots } from '@/modules/metaverse/hooks/useBots';
import { useIdleLoop } from '@/modules/metaverse/hooks/useIdleLoop';

const IdleGame: React.FC = () => {
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const { bots, loading } = useBots();
  
  const selectedBot = bots.find(b => b.id === selectedBotId);
  const { currentActivity, level, xp, maxXp, xpPerSecond } = useIdleLoop(selectedBotId, selectedBot?.personality);

  // Auto-select first bot when loaded
  useEffect(() => {
    if (bots.length > 0 && !selectedBotId) {
      setSelectedBotId(bots[0].id);
    }
  }, [bots, selectedBotId]);

  // Calculate total earnings
  const totalXPEarned = selectedBot?.experience?.totalXP || 0;
  const totalIdleEarned = Math.floor((totalXPEarned / 100) * 10); // Rough estimate

  return (
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
          <BotSelector
            bots={bots}
            selectedBotId={selectedBotId}
            onSelectBot={setSelectedBotId}
            loading={loading}
          />
        </div>
      </header>

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
  );
};

export default IdleGame;