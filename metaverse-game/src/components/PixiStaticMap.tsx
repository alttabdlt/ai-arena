import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { AnimatedSprite, WorldMap } from '../../convex/aiTown/worldMap';
import * as campfire from '../../data/animations/campfire.json';
import * as gentlesparkle from '../../data/animations/gentlesparkle.json';
import * as gentlewaterfall from '../../data/animations/gentlewaterfall.json';
import * as gentlesplash from '../../data/animations/gentlesplash.json';
import * as windmill from '../../data/animations/windmill.json';

const animations = {
  'campfire.json': { spritesheet: campfire, url: '/assets/spritesheets/campfire.png' },
  'gentlesparkle.json': {
    spritesheet: gentlesparkle,
    url: '/assets/spritesheets/gentlesparkle32.png',
  },
  'gentlewaterfall.json': {
    spritesheet: gentlewaterfall,
    url: '/assets/spritesheets/gentlewaterfall32.png',
  },
  'windmill.json': { spritesheet: windmill, url: '/assets/spritesheets/windmill.png' },
  'gentlesplash.json': { spritesheet: gentlesplash,
    url: '/assets/spritesheets/gentlewaterfall32.png',},
};

export const PixiStaticMap = PixiComponent('StaticMap', {
  create: (props: { map: WorldMap; [k: string]: any }) => {
    const map = props.map;
    const numxtiles = Math.floor(map.tileSetDimX / map.tileDim);
    const numytiles = Math.floor(map.tileSetDimY / map.tileDim);
    const bt = PIXI.BaseTexture.from(map.tileSetUrl, {
      scaleMode: PIXI.SCALE_MODES.NEAREST,
    });

    const tiles = [];
    for (let x = 0; x < numxtiles; x++) {
      for (let y = 0; y < numytiles; y++) {
        tiles[x + y * numxtiles] = new PIXI.Texture(
          bt,
          new PIXI.Rectangle(x * map.tileDim, y * map.tileDim, map.tileDim, map.tileDim),
        );
      }
    }
    // Use the actual map dimensions from the WorldMap object
    const screenxtiles = map.width;      // Width in tiles
    const screenytiles = map.height;     // Height in tiles

    console.log('Map debugging:', {
      tileSetUrl: map.tileSetUrl,
      tileSetDimX: map.tileSetDimX, 
      tileSetDimY: map.tileSetDimY,
      tileDim: map.tileDim,
      numxtiles,
      numytiles,
      totalTiles: tiles.length,
      screenxtiles,
      screenytiles,
      bgLayersCount: map.bgTiles.length,
      objectLayersCount: map.objectTiles.length
    });

    const container = new PIXI.Container();
    const allLayers = [...map.bgTiles, ...map.objectTiles];

    // blit bg & object layers of map onto canvas
    for (let i = 0; i < screenxtiles * screenytiles; i++) {
      const x = i % screenxtiles;
      const y = Math.floor(i / screenxtiles);
      const xPx = x * map.tileDim;
      const yPx = y * map.tileDim;

      // Add all layers of backgrounds.
      for (const layer of allLayers) {
        const tileIndex = layer[y][x]; // Map is stored as [y][x] (row-major order)
        // Some layers may not have tiles at this location.
        if (tileIndex === -1) continue;
        
        if (x < 5 && y < 5) { // Debug first few tiles
          console.log(`Tile at (${x},${y}): index ${tileIndex}, total tiles: ${tiles.length}`);
        }
        
        if (tileIndex >= tiles.length) {
          console.warn(`Tile index ${tileIndex} out of range! Max: ${tiles.length - 1} at (${x},${y})`);
          continue;
        }
        const ctile = new PIXI.Sprite(tiles[tileIndex]);
        ctile.x = xPx;
        ctile.y = yPx;
        container.addChild(ctile);
      }
    }
    
    // Debug grid overlay removed - crime-tiles.png has built-in borders

    // TODO: Add layers.
    const spritesBySheet = new Map<string, AnimatedSprite[]>();
    for (const sprite of map.animatedSprites) {
      const sheet = sprite.sheet;
      if (!spritesBySheet.has(sheet)) {
        spritesBySheet.set(sheet, []);
      }
      spritesBySheet.get(sheet)!.push(sprite);
    }
    for (const [sheet, sprites] of spritesBySheet.entries()) {
      const animation = (animations as any)[sheet];
      if (!animation) {
        console.error('Could not find animation', sheet);
        continue;
      }
      const { spritesheet, url } = animation;
      const texture = PIXI.BaseTexture.from(url, {
        scaleMode: PIXI.SCALE_MODES.NEAREST,
      });
      const spriteSheet = new PIXI.Spritesheet(texture, spritesheet);
      spriteSheet.parse().then(() => {
        for (const sprite of sprites) {
          const pixiAnimation = spriteSheet.animations[sprite.animation];
          if (!pixiAnimation) {
            console.error('Failed to load animation', sprite);
            continue;
          }
          const pixiSprite = new PIXI.AnimatedSprite(pixiAnimation);
          pixiSprite.animationSpeed = 0.1;
          pixiSprite.autoUpdate = true;
          pixiSprite.x = sprite.x;
          pixiSprite.y = sprite.y;
          pixiSprite.width = sprite.w;
          pixiSprite.height = sprite.h;
          container.addChild(pixiSprite);
          pixiSprite.play();
        }
      });
    }

    container.x = 0;
    container.y = 0;

    // Set the hit area manually to ensure `pointerdown` events are delivered to this container.
    container.interactive = true;
    container.hitArea = new PIXI.Rectangle(
      0,
      0,
      screenxtiles * map.tileDim,
      screenytiles * map.tileDim,
    );

    return container;
  },

  applyProps: (instance, oldProps, newProps) => {
    applyDefaultProps(instance, oldProps, newProps);
  },
});
