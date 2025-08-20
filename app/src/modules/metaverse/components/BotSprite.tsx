import React, { useEffect, useState } from 'react';
import { SPRITE_DATA, getRandomWalkDirection } from '@/modules/metaverse/data/spriteData';

interface Bot {
  id: string;
  name: string;
  avatar?: string;  // The randomly selected character from deployment
  personality?: string;
  character?: string;  // Legacy field, keeping for backward compatibility
}

interface Activity {
  emoji: string;
  activity: string;
  xpGained?: number;
}

interface BotSpriteProps {
  bot: Bot;
  currentActivity: Activity | null;
}

const BotSprite: React.FC<BotSpriteProps> = ({ bot, currentActivity }) => {
  const [currentDirection, setCurrentDirection] = useState<string>('walkDown');
  const [frame, setFrame] = useState(0);

  // Change walking direction periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDirection(getRandomWalkDirection());
    }, 3000 + Math.random() * 3000); // Every 3-6 seconds

    return () => clearInterval(interval);
  }, []);

  // Animate frames
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % 3); // Cycle through 3 frames
    }, 200); // Change frame every 200ms

    return () => clearInterval(interval);
  }, []);

  // Get character sprite data based on personality
  const getCharacterByPersonality = (personality?: string) => {
    switch (personality?.toUpperCase()) {
      case 'CRIMINAL': return 'f1';
      case 'GAMBLER': return 'f5';
      case 'WORKER': 
      default: return 'f7';
    }
  };
  
  // Use avatar field which contains the randomly selected character from deployment
  const characterKey = bot.avatar || bot.character || getCharacterByPersonality(bot.personality);
  const spriteData = SPRITE_DATA[characterKey] || SPRITE_DATA.f7;
  const directionFrames = spriteData[currentDirection as keyof typeof spriteData] || spriteData.walkDown;
  const currentFrame = directionFrames[frame] || directionFrames[0];

  return (
    <div className="sprite-compact-container">
      {/* Personality-based background pattern */}
      <div className={`sprite-bg-pattern personality-${(bot.personality || 'WORKER').toLowerCase()}`}>
        <div className="pattern-grid" />
      </div>
      
      {/* Centered sprite display */}
      <div className="sprite-display">
        <div
          className="sprite-character-compact"
          style={{
            width: '128px',
            height: '128px',
            backgroundImage: 'url(/assets/sprites/32x32folk.png)',
            backgroundPosition: `-${currentFrame.x * 4}px -${currentFrame.y * 4}px`,
            backgroundSize: '1536px 1024px',
            imageRendering: 'pixelated',
          }}
        />
      </div>
      
      {/* Bot name */}
      <h3 className="sprite-bot-name">{bot.name}</h3>
      
      {/* Floating activity bubble */}
      {currentActivity && (
        <div className="activity-bubble">
          <span className="bubble-emoji">{currentActivity.emoji}</span>
          <span className="bubble-text">{currentActivity.activity}</span>
        </div>
      )}
    </div>
  );
};

export default BotSprite;