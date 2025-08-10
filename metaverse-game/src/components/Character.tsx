import { BaseTexture, ISpritesheetData, Spritesheet } from 'pixi.js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatedSprite, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';

export const Character = ({
  textureUrl,
  spritesheetData,
  x,
  y,
  orientation,
  isMoving = false,
  isThinking = false,
  isSpeaking = false,
  emoji = '',
  isViewer = false,
  speed = 0.1,
  level,
  currentXP,
  maxXP,
  showXP = false,
  onClick,
}: {
  // Path to the texture packed image.
  textureUrl: string;
  // The data for the spritesheet.
  spritesheetData: ISpritesheetData;
  // The pose of the NPC.
  x: number;
  y: number;
  orientation: number;
  isMoving?: boolean;
  // Shows a thought bubble if true.
  isThinking?: boolean;
  // Shows a speech bubble if true.
  isSpeaking?: boolean;
  emoji?: string;
  // Highlights the player.
  isViewer?: boolean;
  // The speed of the animation. Can be tuned depending on the side and speed of the NPC.
  speed?: number;
  // XP and level display
  level?: number;
  currentXP?: number;
  maxXP?: number;
  showXP?: boolean;
  onClick: () => void;
}) => {
  const [spriteSheet, setSpriteSheet] = useState<Spritesheet>();
  useEffect(() => {
    const parseSheet = async () => {
      const sheet = new Spritesheet(
        BaseTexture.from(textureUrl, {
          scaleMode: PIXI.SCALE_MODES.NEAREST,
        }),
        spritesheetData,
      );
      await sheet.parse();
      setSpriteSheet(sheet);
    };
    void parseSheet();
  }, []);

  // The first "left" is "right" but reflected.
  const roundedOrientation = Math.floor(orientation / 90);
  const direction = ['right', 'down', 'left', 'up'][roundedOrientation];

  // Prevents the animation from stopping when the texture changes
  // (see https://github.com/pixijs/pixi-react/issues/359)
  const ref = useRef<PIXI.AnimatedSprite | null>(null);
  useEffect(() => {
    if (isMoving) {
      ref.current?.play();
    }
  }, [direction, isMoving]);

  if (!spriteSheet) return null;

  let blockOffset = { x: 0, y: 0 };
  switch (roundedOrientation) {
    case 2:
      blockOffset = { x: -20, y: 0 };
      break;
    case 0:
      blockOffset = { x: 20, y: 0 };
      break;
    case 3:
      blockOffset = { x: 0, y: -20 };
      break;
    case 1:
      blockOffset = { x: 0, y: 20 };
      break;
  }

  return (
    <Container x={x} y={y} interactive={true} pointerdown={onClick} cursor="pointer">
      {isThinking && (
        // TODO: We'll eventually have separate assets for thinking and speech animations.
        <Text x={-20} y={-10} scale={{ x: -0.8, y: 0.8 }} text={'💭'} anchor={{ x: 0.5, y: 0.5 }} />
      )}
      {isSpeaking && (
        // TODO: We'll eventually have separate assets for thinking and speech animations.
        <Text x={18} y={-10} scale={0.8} text={'💬'} anchor={{ x: 0.5, y: 0.5 }} />
      )}
      {isViewer && <ViewerIndicator />}
      <AnimatedSprite
        ref={ref}
        isPlaying={isMoving}
        textures={spriteSheet.animations[direction]}
        animationSpeed={speed}
        anchor={{ x: 0.5, y: 0.5 }}
      />
      {emoji && (
        <Text x={0} y={-24} scale={{ x: -0.8, y: 0.8 }} text={emoji} anchor={{ x: 0.5, y: 0.5 }} />
      )}
      {showXP && level && (
        <>
          {/* Level Badge */}
          <Container x={0} y={25}>
            <Graphics
              draw={(g) => {
                g.clear();
                // Background for level
                g.beginFill(0x1a1a1a, 0.9);
                g.drawRoundedRect(-20, -8, 40, 16, 8);
                g.endFill();
                // Level color based on tier
                const levelColor = level >= 50 ? 0x9333ea : // purple
                                  level >= 30 ? 0x3b82f6 : // blue
                                  level >= 15 ? 0x10b981 : // green
                                  level >= 5 ? 0xeab308 :  // yellow
                                  0x9ca3af; // gray
                g.beginFill(levelColor, 1);
                g.drawRoundedRect(-18, -6, 36, 12, 6);
                g.endFill();
              }}
            />
            <Text
              text={`Lv${level}`}
              style={new PIXI.TextStyle({
                fontSize: 10,
                fill: 0xffffff,
                fontWeight: 'bold',
              })}
              anchor={{ x: 0.5, y: 0.5 }}
            />
          </Container>
          {/* XP Bar */}
          {currentXP !== undefined && maxXP && (
            <Container x={0} y={35}>
              <Graphics
                draw={(g) => {
                  g.clear();
                  // Background bar
                  g.beginFill(0x1a1a1a, 0.8);
                  g.drawRoundedRect(-25, -2, 50, 4, 2);
                  g.endFill();
                  // XP progress
                  const progress = Math.min((currentXP / maxXP) * 50, 50);
                  if (progress > 0) {
                    const xpColor = level >= 30 ? 0x9333ea : 0x3b82f6;
                    g.beginFill(xpColor, 1);
                    g.drawRoundedRect(-25, -2, progress, 4, 2);
                    g.endFill();
                  }
                }}
              />
            </Container>
          )}
        </>
      )}
    </Container>
  );
};

function ViewerIndicator() {
  const draw = useCallback((g: PIXI.Graphics) => {
    g.clear();
    g.beginFill(0xffff0b, 0.5);
    g.drawRoundedRect(-10, 10, 20, 10, 100);
    g.endFill();
  }, []);

  return <Graphics draw={draw} />;
}
