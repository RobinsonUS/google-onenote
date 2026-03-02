// Simple noise function for terrain generation
function hash(x: number, z: number): number {
  let h = (x * 374761393 + z * 668265263) ^ ((x * 668265263) + (z * 374761393));
  h = (h ^ (h >>> 13)) * 1274126177;
  // Keep it in 32-bit range
  h = h | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  // Smooth interpolation
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (d - b - c + a) * ux * uz;
}

function octaveNoise(x: number, z: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / max;
}

export const BLOCK_TYPES = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  SAND: 5,
  WATER: 6,
  LEAVES: 7,
  PLANKS: 9,
  CRAFTING_TABLE: 10,
  COBBLESTONE: 11,
  BEDROCK: 12,
  COAL_ORE: 13,
} as const;

// Non-block items (IDs >= 100, cannot be placed in the world)
export const ITEM_TYPES = {
  STICK: 100,
  WOODEN_AXE: 101,
  WOODEN_PICKAXE: 102,
  COAL: 103,
} as const;

export type ItemType = typeof ITEM_TYPES[keyof typeof ITEM_TYPES];

export function isTool(id: number): boolean {
  return id === ITEM_TYPES.WOODEN_AXE || id === ITEM_TYPES.WOODEN_PICKAXE;
}

export const TOOL_MAX_DURABILITY: Record<number, number> = {
  [ITEM_TYPES.WOODEN_AXE]: 30,
  [ITEM_TYPES.WOODEN_PICKAXE]: 60,
};

export function isItem(id: number): boolean {
  return id >= 100;
}

export const ITEM_NAMES: Record<number, string> = {
  [ITEM_TYPES.STICK]: 'Bâton',
  [ITEM_TYPES.WOODEN_AXE]: 'Hache en bois',
  [ITEM_TYPES.WOODEN_PICKAXE]: 'Pioche en bois',
  [ITEM_TYPES.COAL]: 'Charbon',
};

// What a block drops when mined (if different from itself)
export const BLOCK_DROP: Partial<Record<number, number>> = {
  [BLOCK_TYPES.STONE]: BLOCK_TYPES.COBBLESTONE,
  [BLOCK_TYPES.COAL_ORE]: ITEM_TYPES.COAL,
};

export type BlockType = typeof BLOCK_TYPES[keyof typeof BLOCK_TYPES];

export const BLOCK_COLORS: Record<number, string> = {
  [BLOCK_TYPES.AIR]: 'transparent',
  [BLOCK_TYPES.GRASS]: '#4CAF50',
  [BLOCK_TYPES.DIRT]: '#8B5E3C',
  [BLOCK_TYPES.STONE]: '#9E9E9E',
  [BLOCK_TYPES.WOOD]: '#795548',
  [BLOCK_TYPES.SAND]: '#F4E04D',
  [BLOCK_TYPES.WATER]: '#2196F3',
  [BLOCK_TYPES.LEAVES]: '#2E7D32',
  [BLOCK_TYPES.PLANKS]: '#B8945A',
  [BLOCK_TYPES.CRAFTING_TABLE]: '#8B6914',
  [BLOCK_TYPES.COBBLESTONE]: '#8A8A8A',
  [BLOCK_TYPES.BEDROCK]: '#3A3A3A',
  [BLOCK_TYPES.COAL_ORE]: '#4A4A4A',
};

export const BLOCK_THREE_COLORS: Record<number, number> = {
  [BLOCK_TYPES.GRASS]: 0x5a9134,
  [BLOCK_TYPES.DIRT]: 0x866043,
  [BLOCK_TYPES.STONE]: 0x7a7a7a,
  [BLOCK_TYPES.WOOD]: 0x684E28,
  [BLOCK_TYPES.SAND]: 0xdbc883,
  [BLOCK_TYPES.WATER]: 0x2662c8,
  [BLOCK_TYPES.LEAVES]: 0x2a6b1e,
  [BLOCK_TYPES.PLANKS]: 0xb8945a,
  [BLOCK_TYPES.CRAFTING_TABLE]: 0x8b6914,
  [BLOCK_TYPES.COBBLESTONE]: 0x8a8a8a,
  [BLOCK_TYPES.BEDROCK]: 0x3a3a3a,
  [BLOCK_TYPES.COAL_ORE]: 0x4a4a4a,
};

export const BLOCK_NAMES: Record<number, string> = {
  [BLOCK_TYPES.GRASS]: 'Herbe',
  [BLOCK_TYPES.DIRT]: 'Terre',
  [BLOCK_TYPES.STONE]: 'Pierre',
  [BLOCK_TYPES.WOOD]: 'Bois',
  [BLOCK_TYPES.SAND]: 'Sable',
  [BLOCK_TYPES.LEAVES]: 'Feuilles',
  [BLOCK_TYPES.PLANKS]: 'Planches',
  [BLOCK_TYPES.CRAFTING_TABLE]: 'Établi',
  [BLOCK_TYPES.COBBLESTONE]: 'Pierres',
  [BLOCK_TYPES.BEDROCK]: 'Bedrock',
  [BLOCK_TYPES.COAL_ORE]: 'Minerai de charbon',
};

// Break time in seconds per block type
export const BLOCK_BREAK_TIME: Record<number, number> = {
  [BLOCK_TYPES.GRASS]: 0.7,
  [BLOCK_TYPES.DIRT]: 0.7,
  [BLOCK_TYPES.STONE]: 11,
  [BLOCK_TYPES.WOOD]: 4,
  [BLOCK_TYPES.SAND]: 0.7,
  [BLOCK_TYPES.LEAVES]: 0.3,
  [BLOCK_TYPES.PLANKS]: 4,
  [BLOCK_TYPES.CRAFTING_TABLE]: 4,
  [BLOCK_TYPES.COBBLESTONE]: 11,
  [BLOCK_TYPES.COAL_ORE]: 11,
};

// Wood-type blocks that the axe speeds up
const WOOD_BLOCKS = new Set<number>([BLOCK_TYPES.WOOD, BLOCK_TYPES.PLANKS, BLOCK_TYPES.CRAFTING_TABLE]);

// Blocks that require a pickaxe to drop items
const PICKAXE_REQUIRED = new Set<number>([BLOCK_TYPES.STONE, BLOCK_TYPES.COBBLESTONE, BLOCK_TYPES.COAL_ORE]);

export function getBlockBreakTime(blockType: number, heldItem?: number | null): number {
  const base = BLOCK_BREAK_TIME[blockType] ?? 1;
  if (heldItem === ITEM_TYPES.WOODEN_AXE && WOOD_BLOCKS.has(blockType)) {
    return 2;
  }
  if (heldItem === ITEM_TYPES.WOODEN_PICKAXE && (blockType === BLOCK_TYPES.STONE || blockType === BLOCK_TYPES.COBBLESTONE || blockType === BLOCK_TYPES.COAL_ORE)) {
    return 2.5;
  }
  return base;
}

export function canHarvestBlock(blockType: number, heldItem?: number | null): boolean {
  if (PICKAXE_REQUIRED.has(blockType)) {
    return heldItem === ITEM_TYPES.WOODEN_PICKAXE;
  }
  return true;
}

export function getItemOrBlockName(id: number): string {
  if (isItem(id)) return ITEM_NAMES[id] || '';
  return BLOCK_NAMES[id] || '';
}

export type WorldData = Map<string, BlockType>;

export function posKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function generateTerrain(size: number = 100, seed: number = 42): WorldData {
  const world: WorldData = new Map();
  const SEA_LEVEL = 2;
  const MAX_HEIGHT = 8;

  for (let x = -size / 2; x < size / 2; x++) {
    for (let z = -size / 2; z < size / 2; z++) {
      const nx = (x + seed) * 0.05;
      const nz = (z + seed) * 0.05;
      const heightNoise = octaveNoise(nx, nz, 4);
      const height = Math.floor(SEA_LEVEL + heightNoise * MAX_HEIGHT);

      // Use a separate noise to decide sand patches
      const sandNoise = smoothNoise((x + seed * 3) * 0.08, (z + seed * 3) * 0.08);
      const isSandPatch = sandNoise > 0.65;

      // Bedrock at y=0
      world.set(posKey(x, 0, z), BLOCK_TYPES.BEDROCK);
      for (let y = 1; y <= height; y++) {
        let blockType: BlockType;
        if (y === height) {
          blockType = isSandPatch ? BLOCK_TYPES.SAND : BLOCK_TYPES.GRASS;
        } else if (y > height - 3) {
          blockType = isSandPatch ? BLOCK_TYPES.SAND : BLOCK_TYPES.DIRT;
        } else {
          // Stone layer — chance of coal ore
          const coalNoise = hash(x * 13 + seed * 7, z * 13 + y * 31 + seed * 11);
          blockType = coalNoise > 0.88 ? BLOCK_TYPES.COAL_ORE : BLOCK_TYPES.STONE;
        }
        world.set(posKey(x, y, z), blockType);
      }

      // Add trees occasionally
      if (height >= SEA_LEVEL + 2 && height <= SEA_LEVEL + MAX_HEIGHT) {
        const treeNoise = hash(x * 7 + seed, z * 7 + seed);
        if (treeNoise > 0.92) {
          // Tree trunk
          for (let ty = height + 1; ty <= height + 4; ty++) {
            world.set(posKey(x, ty, z), BLOCK_TYPES.WOOD);
          }
          // Leaves
          for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
              for (let ly = height + 3; ly <= height + 6; ly++) {
                if (Math.abs(lx) + Math.abs(lz) + Math.abs(ly - (height + 5)) < 4) {
                  const lkey = posKey(x + lx, ly, z + lz);
                  if (!world.has(lkey)) {
                    world.set(lkey, BLOCK_TYPES.LEAVES);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Add a hill with a natural stone cave near spawn
  const hillCX = 8;
  const hillCZ = 8;
  const hillRadius = 8;
  const hillHeight = 8;
  const caveRand = seededRand(seed * 17 + 3);

  // Build the hill
  for (let hx = -hillRadius; hx <= hillRadius; hx++) {
    for (let hz = -hillRadius; hz <= hillRadius; hz++) {
      const dist = Math.sqrt(hx * hx + hz * hz);
      if (dist > hillRadius) continue;
      const wx = hillCX + hx;
      const wz = hillCZ + hz;
      // Irregular shape: add noise to the radius
      const noiseOffset = smoothNoise((wx + seed * 5) * 0.3, (wz + seed * 5) * 0.3) * 2 - 1;
      const effectiveRadius = hillRadius + noiseOffset * 1.5;
      if (dist > effectiveRadius) continue;
      let baseY = 0;
      for (let sy = MAX_HEIGHT + hillHeight; sy >= 0; sy--) {
        if (world.has(posKey(wx, sy, wz))) { baseY = sy + 1; break; }
      }
      const heightNoise2 = smoothNoise((wx + seed * 7) * 0.2, (wz + seed * 7) * 0.2);
      const localHeight = Math.round((hillHeight + heightNoise2 * 3) * (1 - (dist / effectiveRadius) ** 1.8));
      if (localHeight <= 0) continue;
      for (let dy = 0; dy < localHeight; dy++) {
        world.set(posKey(wx, baseY + dy, wz), BLOCK_TYPES.STONE);
      }
      // Grass/dirt cap
      if (localHeight > 0) {
        world.set(posKey(wx, baseY + localHeight - 1, wz), BLOCK_TYPES.GRASS);
        if (localHeight > 1) {
          world.set(posKey(wx, baseY + localHeight - 2, wz), BLOCK_TYPES.DIRT);
        }
      }
    }
  }

  // Carve a natural cave that goes underground
  // Cave entrance facing south (negative Z), then curves down
  const entranceBaseY = (() => {
    for (let sy = MAX_HEIGHT + hillHeight; sy >= 0; sy--) {
      if (world.has(posKey(hillCX, sy, hillCZ - hillRadius + 2))) return sy;
    }
    return SEA_LEVEL + 2;
  })();

  // Cave path: a series of points the cave follows
  const cavePath: { x: number; y: number; z: number; r: number }[] = [];
  let cx = hillCX, cy = entranceBaseY, cz = hillCZ - hillRadius + 1;
  
  // Entrance section - going into the hill
  for (let i = 0; i < 6; i++) {
    cavePath.push({ x: cx, y: cy, z: cz, r: 2.2 + caveRand() * 0.5 });
    cz += 1;
    cx += Math.round(caveRand() * 0.8 - 0.4);
  }
  // Descending section - going underground
  for (let i = 0; i < 6; i++) {
    cavePath.push({ x: cx, y: cy, z: cz, r: 2.0 + caveRand() * 0.6 });
    cz += 1;
    cy -= 1;
    cx += Math.round(caveRand() * 1.2 - 0.6);
  }
  // Deep chamber
  for (let i = 0; i < 4; i++) {
    cavePath.push({ x: cx, y: cy, z: cz, r: 2.8 + caveRand() * 0.8 });
    cz += Math.round(caveRand() * 2 - 0.5);
    cx += Math.round(caveRand() * 2 - 1);
  }

  // Carve the cave using spherical carving along the path
  for (const pt of cavePath) {
    const r = pt.r;
    const ri = Math.ceil(r);
    for (let dx = -ri; dx <= ri; dx++) {
      for (let dy = -ri; dy <= ri; dy++) {
        for (let dz = -ri; dz <= ri; dz++) {
          const dist = Math.sqrt(dx * dx + dy * dy * 1.2 + dz * dz);
          // Add noise to make walls irregular
          const wallNoise = smoothNoise((pt.x + dx) * 0.5 + seed * 11, (pt.z + dz) * 0.5 + seed * 11) * 0.6;
          if (dist < r + wallNoise - 0.3) {
            const wx = pt.x + dx;
            const wy = pt.y + dy;
            const wz = pt.z + dz;
            if (wy >= 1) {
              world.delete(posKey(wx, wy, wz));
            }
          }
        }
      }
    }
  }

  return world;
}

function seededRand(seed: number) {
  let s = seed | 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
