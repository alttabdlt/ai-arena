// Test map using crime-city-sprites.png to see ALL available tiles
// This tileset should have both floors and objects

export const tilesetpath = "/assets/crime-city-sprites.png"
export const tiledim = 32
export const screenxtiles = 32
export const screenytiles = 32
export const tilesetpxw = 1024
export const tilesetpxh = 1024

// Show first 1024 tiles in a 32x32 grid
const createTestMap = () => {
  const map = [];
  for (let x = 0; x < 32; x++) {
    map.push(new Array(32));
  }
  
  let tileIndex = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      map[x][y] = tileIndex++;
    }
  }
  
  return map;
};

export const bgtiles = [createTestMap()];
export const objmap = [(() => {
  const objects = [];
  for (let x = 0; x < 32; x++) {
    objects.push(new Array(32).fill(-1));
  }
  return objects;
})()];

export const animatedsprites = [];
export const mapwidth = 32;
export const mapheight = 32;