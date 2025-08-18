import React, { useState, useEffect } from 'react';

interface Bot {
  id: string;
  name: string;
  personality?: string;
  experience?: {
    level: number;
    currentXP: number;
    totalXP: number;
    xpToNextLevel: number;
  };
}

interface Activity {
  emoji: string;
  activity: string;
  xpGained?: number;
}

interface StatsPanelProps {
  bot?: Bot;
  level: number;
  xp: number;
  maxXp: number;
  currentActivity: Activity | null;
  xpPerSecond?: number;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ 
  bot, 
  level, 
  xp, 
  maxXp, 
  currentActivity,
  xpPerSecond = 0
}) => {
  const [activities, setActivities] = useState<Array<Activity & { timestamp: Date }>>([]);

  // Add new activities to the feed - Fixed dependency array
  useEffect(() => {
    if (currentActivity) {
      setActivities(prev => {
        const activityKey = `${currentActivity.emoji}${currentActivity.activity}`;
        const lastActivityKey = prev[0] ? `${prev[0].emoji}${prev[0].activity}` : '';
        
        if (activityKey !== lastActivityKey) {
          return [
            { ...currentActivity, timestamp: new Date() },
            ...prev.slice(0, 9)
          ]; // Keep last 10
        }
        return prev;
      });
    }
  }, [currentActivity]);

  const xpPercentage = maxXp > 0 ? (xp / maxXp) * 100 : 0;
  
  // Calculate earnings based on personality
  const getIdleMultiplier = (personality?: string) => {
    switch (personality?.toUpperCase()) {
      case 'CRIMINAL': return 1.2;
      case 'GAMBLER': return 1.0;
      case 'WORKER': return 1.5;
      default: return 1.0;
    }
  };
  
  const idleMultiplier = getIdleMultiplier(bot?.personality);
  const idlePerHour = Math.floor(10 * idleMultiplier); // Base 10 $IDLE/hour
  const xpPerHour = Math.floor(xpPerSecond * 3600);

  const personalityColors = {
    CRIMINAL: 'from-red-500/20 to-red-600/10 border-red-500/30',
    GAMBLER: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    WORKER: 'from-green-500/20 to-green-600/10 border-green-500/30'
  };

  return (
    <div className="stats-panel-redesigned">
      {/* Top Grid - Key Stats */}
      <div className="stats-grid-top">

        {/* XP Progress Card */}
        <div className="stat-card xp-card">
          <div className="card-header">
            <span className="card-icon">📊</span>
            <h4 className="card-title">Experience</h4>
          </div>
          <div className="card-content">
            <div className="xp-info">
              <span className="xp-current">{Math.floor(xp)}</span>
              <span className="xp-separator">/</span>
              <span className="xp-max">{Math.floor(maxXp)}</span>
            </div>
            <div className="xp-bar-compact">
              <div className="xp-fill-compact" style={{ width: `${xpPercentage}%` }} />
            </div>
            <div className="xp-meta">
              <span>Level {level}</span>
              <span>{xpPercentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Earnings Card */}
        <div className="stat-card earnings-card">
          <div className="card-header">
            <span className="card-icon">💰</span>
            <h4 className="card-title">Earnings</h4>
          </div>
          <div className="card-content">
            <div className="earnings-row">
              <div className="earning-item">
                <span className="earning-label">XP/hr</span>
                <span className="earning-value xp-value">+{xpPerHour}</span>
              </div>
              <div className="earning-item">
                <span className="earning-label">$IDLE/hr</span>
                <span className="earning-value idle-value">+{idlePerHour}</span>
              </div>
            </div>
            {idleMultiplier !== 1.0 && (
              <div className={`bonus-indicator bg-gradient-to-r ${personalityColors[bot?.personality as keyof typeof personalityColors] || personalityColors.WORKER}`}>
                <span className="bonus-text">
                  {bot?.personality} +{((idleMultiplier - 1) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current Activity Bar */}
      {currentActivity && (
        <div className="current-activity-bar">
          <div className="activity-indicator">
            <span className="activity-dot" />
            <span className="activity-label">Now:</span>
          </div>
          <span className="activity-emoji-inline">{currentActivity.emoji}</span>
          <span className="activity-text-inline">{currentActivity.activity}</span>
          {currentActivity.xpGained && (
            <span className="activity-xp">+{currentActivity.xpGained} XP</span>
          )}
        </div>
      )}

      {/* Activity Timeline */}
      <div className="activity-timeline">
        <h4 className="timeline-title">Recent Activities</h4>
        <div className="timeline-container">
          {activities.length === 0 ? (
            <div className="timeline-empty">
              <span>No activities yet...</span>
            </div>
          ) : (
            <div className="timeline-items">
              {activities.slice(0, 5).map((activity, index) => (
                <div 
                  key={`${activity.timestamp.getTime()}-${index}`} 
                  className="timeline-item"
                >
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-emoji">{activity.emoji}</span>
                      <span className="timeline-activity">{activity.activity}</span>
                    </div>
                    <div className="timeline-meta">
                      <span className="timeline-time">{formatTimeAgo(activity.timestamp)}</span>
                      {activity.xpGained && (
                        <span className="timeline-xp">+{activity.xpGained}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 120) return '1 minute ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 7200) return '1 hour ago';
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export default StatsPanel;