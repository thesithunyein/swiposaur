import { GameStats, ObstacleType } from './types.ts';
import { GAME_MAPS } from './maps.ts';

export interface LevelDefinition {
  level: number;
  title: string;
  mapId: string;
  targetDistance: number;
  targetSlaps: number;
  targetCoins: number;
  coinReward: number;
  description: string;
  featuredObstacles: ObstacleType[];
  obstacleThemeName: string;
}

export interface LevelProgress {
  unlockedLevel: number;
  levelStars: Record<number, number>;
  levelScores: Record<number, number>;
}

const STORAGE_KEY = 'slap_run_level_progress';

export function loadLevelProgress(): LevelProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        unlockedLevel: Math.max(1, parsed.unlockedLevel || 1),
        levelStars: parsed.levelStars || {},
        levelScores: parsed.levelScores || {},
      };
    }
  } catch {}
  return {
    unlockedLevel: 1,
    levelStars: {},
    levelScores: {},
  };
}

export function saveLevelResult(level: number, stars: number, score: number): void {
  const current = loadLevelProgress();
  const prevStars = current.levelStars[level] || 0;
  const prevScore = current.levelScores[level] || 0;

  current.levelStars[level] = Math.max(prevStars, stars);
  current.levelScores[level] = Math.max(prevScore, score);

  if (stars > 0 && level >= current.unlockedLevel) {
    current.unlockedLevel = level + 1;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

export function getMapForLevel(level: number): string {
  if (level >= 95) return 'moonlit_bazaar';
  if (level >= 85) return 'monsoon_coast';
  if (level >= 75) return 'starlight_shibuya';
  if (level >= 65) return 'aurora_ridge';
  if (level >= 55) return 'ember_canyon';
  if (level >= 45) return 'sakura_heights';
  if (level >= 35) return 'golden_temple';
  if (level >= 25) return 'winter_peak';
  if (level >= 18) return 'neon_night';
  if (level >= 10) return 'sunset_desert';
  if (level >= 5) return 'tropical_coast';
  return 'market';
}

function legacyObstaclesForLevel(levelNumber: number, mapIdOverride?: string): {
  obstacles: ObstacleType[];
  themeName: string;
} {
  const lvl = Math.max(1, levelNumber);
  const mapId = mapIdOverride || getMapForLevel(lvl);

  if (mapId === 'market') {
    if (lvl === 1) {
      return {
        obstacles: ['crate', 'barrier', 'ramp'],
        themeName: 'Market Fruit Crates & Barriers',
      };
    } else if (lvl === 2) {
      return {
        obstacles: ['crate', 'watermelon', 'barrier', 'ramp'],
        themeName: 'Melon Displays & Fruit Stacks',
      };
    } else if (lvl === 3) {
      return {
        obstacles: ['cart', 'cafe_table', 'watermelon', 'ramp', 'terminal_ramp'],
        themeName: 'Street Pushcarts & Café Tables',
      };
    } else {
      return {
        obstacles: ['cart', 'cafe_table', 'crate', 'watermelon', 'shifting_block', 'terminal_ramp'],
        themeName: 'Bazaar Grand Prix & Moving Stalls',
      };
    }
  }

  if (mapId === 'tropical_coast') {
    if (lvl <= 6) {
      return {
        obstacles: ['coconut_crate', 'beach_lounger', 'ramp'],
        themeName: 'Tiki Coconut Crates & Sun Loungers',
      };
    } else if (lvl <= 7) {
      return {
        obstacles: ['surf_rack', 'coconut_crate', 'beach_lounger', 'ramp'],
        themeName: 'Upright Surfboard Racks & Beach Stands',
      };
    } else if (lvl <= 8) {
      return {
        obstacles: ['tiki_totem', 'surf_rack', 'beach_lounger', 'terminal_ramp'],
        themeName: 'Carved Tiki Totems & Super Launchers',
      };
    } else {
      return {
        obstacles: ['tiki_totem', 'surf_rack', 'coconut_crate', 'shifting_block', 'terminal_ramp'],
        themeName: 'Totem Sanctuaries & Shifting Cabanas',
      };
    }
  }

  if (mapId === 'sunset_desert') {
    if (lvl <= 11) {
      return {
        obstacles: ['cactus_cluster', 'canyon_mesa', 'ramp'],
        themeName: 'Saguaro Cacti & Sandstone Mesas',
      };
    } else if (lvl <= 13) {
      return {
        obstacles: ['dino_skull', 'cactus_cluster', 'canyon_mesa', 'ramp'],
        themeName: 'Prehistoric Triceratops Skulls',
      };
    } else if (lvl <= 15) {
      return {
        obstacles: ['firewall', 'dino_skull', 'canyon_mesa', 'terminal_ramp'],
        themeName: 'Desert Fire Braziers & Flaming Altars',
      };
    } else {
      return {
        obstacles: ['dino_skull', 'firewall', 'canyon_mesa', 'shifting_block', 'terminal_ramp'],
        themeName: 'Canyon Inferno & Shifting Monoliths',
      };
    }
  }

  if (mapId === 'neon_night') {
    if (lvl <= 20) {
      return {
        obstacles: ['holo_barrier', 'cyber_server', 'ramp'],
        themeName: 'Cyan Laser Forcefields & Server Towers',
      };
    } else if (lvl <= 22) {
      return {
        obstacles: ['drone_hazard', 'holo_barrier', 'cyber_server', 'terminal_ramp'],
        themeName: 'Hovering Surveillance Drones & Cyber Lasers',
      };
    } else {
      return {
        obstacles: ['drone_hazard', 'holo_barrier', 'cyber_server', 'shifting_block', 'terminal_ramp'],
        themeName: 'Maglev Laser Grids & Mainframes',
      };
    }
  }

  if (mapId === 'winter_peak') {
    if (lvl <= 27) {
      return {
        obstacles: ['ice_spikes', 'snow_bale', 'ramp'],
        themeName: 'Crystalline Ice Spikes & Snow Forts',
      };
    } else if (lvl <= 30) {
      return {
        obstacles: ['timber_sled', 'ice_spikes', 'snow_bale', 'terminal_ramp'],
        themeName: 'Alpine Timber Sleds & Glacier Spikes',
      };
    } else {
      return {
        obstacles: ['ice_spikes', 'timber_sled', 'snow_bale', 'shifting_block', 'terminal_ramp'],
        themeName: 'Sub-Zero Glacial Boulders & Husky Sleds',
      };
    }
  }

  // Golden Temple (Levels 35+)
  if (lvl <= 37) {
    return {
      obstacles: ['stone_lantern', 'zen_barrier', 'ramp'],
      themeName: 'Sacred Stone Pagodas & Bamboo Lattices',
    };
  } else if (lvl <= 39) {
    return {
      obstacles: ['torii_gate', 'stone_lantern', 'zen_barrier', 'terminal_ramp'],
      themeName: 'Vermilion Torii Arches & Temple Lanterns',
    };
  } else {
    return {
      obstacles: ['cherry_wagon', 'torii_gate', 'stone_lantern', 'zen_barrier', 'shifting_block', 'terminal_ramp'],
      themeName: 'Imperial Blossom Floats & Sacred Torii Arches',
    };
  }
}

/**
 * Obstacle pools per map, ordered gentle -> frightening. Every level draws its
 * own combination out of the pool it belongs to, so no two levels of a map play
 * the same way, and the moving or frightening props only enter the draw once a
 * level has climbed far enough into the map.
 */
const MAP_PROP_POOLS: Record<string, ObstacleType[]> = {
  market: ['crate', 'watermelon', 'planter', 'cafe_table', 'hydrant', 'barrier', 'barrel', 'cart', 'shifting_block'],
  tropical_coast: ['coconut_crate', 'beach_lounger', 'watermelon', 'barrier', 'surf_rack', 'barrel', 'tiki_totem', 'shifting_block'],
  sunset_desert: ['dino_skull', 'barrier', 'barrel', 'firewall', 'loop_boulder', 'cactus_cluster', 'canyon_mesa', 'shifting_block'],
  neon_night: ['spikes', 'barrier', 'cyber_server', 'barrel', 'holo_barrier', 'drone_hazard', 'shifting_block'],
  winter_peak: ['snow_bale', 'barrier', 'ice_spikes', 'barrel', 'timber_sled', 'loop_boulder', 'shifting_block'],
  golden_temple: ['stone_lantern', 'planter', 'zen_barrier', 'barrier', 'torii_gate', 'cherry_wagon', 'shifting_block'],
};

/** First level of each map, matching getMapForLevel. */
const MAP_START_LEVEL: Record<string, number> = {
  market: 1,
  tropical_coast: 5,
  sunset_desert: 10,
  neon_night: 18,
  winter_peak: 25,
  golden_temple: 35,
};

const PROP_LABELS: Record<string, string> = {
  crate: 'Crates',
  watermelon: 'Melon Stalls',
  planter: 'Planters',
  cafe_table: 'Café Tables',
  hydrant: 'Hydrants',
  barrier: 'Barriers',
  barrel: 'Rolling Barrels',
  cart: 'Pushcarts',
  shifting_block: 'Shifting Blocks',
  coconut_crate: 'Coconut Crates',
  beach_lounger: 'Sun Loungers',
  surf_rack: 'Surf Racks',
  tiki_totem: 'Tiki Totems',
  dino_skull: 'Dino Skulls',
  firewall: 'Fire Braziers',
  loop_boulder: 'Boulders',
  cactus_cluster: 'Cacti',
  canyon_mesa: 'Mesas',
  spikes: 'Spikes',
  cyber_server: 'Server Towers',
  holo_barrier: 'Laser Barriers',
  drone_hazard: 'Hover Drones',
  snow_bale: 'Snow Forts',
  ice_spikes: 'Ice Spikes',
  timber_sled: 'Timber Sleds',
  stone_lantern: 'Stone Lanterns',
  zen_barrier: 'Bamboo Lattices',
  torii_gate: 'Torii Gates',
  cherry_wagon: 'Blossom Wagons',
};

const comboCache = new Map<string, ObstacleType[][]>();

/** Every combination of `size` props from `pool`, in lexicographic order. */
function combinationsOf(pool: ObstacleType[], size: number): ObstacleType[][] {
  const key = `${pool.join(',')}|${size}`;
  const cached = comboCache.get(key);
  if (cached) return cached;

  const out: ObstacleType[][] = [];
  const pick: ObstacleType[] = [];
  const walk = (start: number) => {
    if (pick.length === size) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i < pool.length; i++) {
      pick.push(pool[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  comboCache.set(key, out);
  return out;
}

/**
 * The level-by-level draw for a map: every 3-, 4- and 5-prop combination, gentle
 * sets first, so early levels stay readable and later ones get the movers and
 * the frightening props.
 */
function levelComboList(pool: ObstacleType[]): ObstacleType[][] {
  return [3, 4, 5]
    .filter((size) => size <= pool.length)
    .flatMap((size) => combinationsOf(pool, size));
}

function describeProps(props: ObstacleType[]): string {
  const names = props.map((prop) => PROP_LABELS[prop] ?? prop);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/**
 * Unique obstacle set per level: each level of a map draws a different
 * combination from that map's pool, plus a launch pad. The old per-band tables
 * remain as the fallback for maps and level numbers outside that range.
 */
export function getObstaclesForLevel(levelNumber: number, mapIdOverride?: string): {
  obstacles: ObstacleType[];
  themeName: string;
} {
  const lvl = Math.max(1, levelNumber);
  const mapId = mapIdOverride || getMapForLevel(lvl);
  const mapStyleId = GAME_MAPS.find((map) => map.id === mapId)?.renderStyle ?? mapId;
  const pool = MAP_PROP_POOLS[mapStyleId];
  const startLevel = MAP_START_LEVEL[mapStyleId];
  if (!pool || startLevel === undefined) return legacyObstaclesForLevel(lvl, mapStyleId);

  const index = lvl - startLevel;
  const combos = levelComboList(pool);
  if (index < 0 || index >= combos.length) return legacyObstaclesForLevel(lvl, mapId);

  const props = combos[index];
  const obstacles: ObstacleType[] = [...props, index % 2 === 0 ? 'ramp' : 'terminal_ramp'];
  return { obstacles, themeName: `${describeProps(props)} — Level ${lvl}` };
}

export function getLevel(levelNumber: number): LevelDefinition {
  const lvl = Math.max(1, levelNumber);
  const mapId = getMapForLevel(lvl);

  const baseDist = 180 + (lvl - 1) * 65;
  const baseSlaps = 4 + Math.floor((lvl - 1) * 2.2);
  const baseCoins = 8 + Math.floor((lvl - 1) * 3);
  const baseReward = 50 + lvl * 25;

  const titles = [
    'Sandy Shores Debut',
    'Boardwalk Breeze',
    'Tiki Cabana Hustle',
    'Coconut Sprint',
    'Lagoon Splashdown',
    'Coral Reef Run',
    'Surfboard Skim',
    'Riptide Rumble',
    'Seashell Stash',
    'Magma Valley Entrance',
    'Volcanic Steamway',
    'Sulfur Springs Blitz',
    'Amber Canyon Rush',
    'Basalt Boulder Slalom',
    'Molten Peak Escape',
    'Crater Edge Leap',
    'Obsidian Trailway',
    'Neon Metropolis Gateway',
    'Cyber Fern Highway',
    'Holo-Dino Square',
    'Synthwave Speedway',
    'Matrix Canopy Glide',
    'Arcade Rooftop Rampage',
    'Electric Jungle Dash',
    'Glacier Pass Arrival',
    'Frostbite Tundra Sprint',
    'Mammoth Ridge Slide',
    'Frozen Waterfall Jump',
    'Blizzard Boulevard',
    'Ancient Ice Sanctum',
    'Crystal Caverns Drift',
    'Sub-Zero Speedrun',
    'Permafrost Pinnacle',
    'Glacial Summit Sprint',
    'Blossom Sanctum Entrance',
    'Zen Garden Pathway',
    'Floating Lantern Trail',
    'Pagoda Peak Dash',
    'Master Dino Grand Prix',
  ];

  const titleIndex = (lvl - 1) % titles.length;
  const loopCycle = Math.floor((lvl - 1) / titles.length);
  const title = loopCycle > 0 ? `${titles[titleIndex]} (Rank ${loopCycle + 1})` : titles[titleIndex];
  const { obstacles, themeName } = getObstaclesForLevel(lvl, mapId);

  return {
    level: lvl,
    title,
    mapId,
    targetDistance: baseDist,
    targetSlaps: baseSlaps,
    targetCoins: baseCoins,
    coinReward: baseReward,
    description: `Run ${baseDist}m, dodge ${themeName}, deliver ${baseSlaps} tail slaps, and snag ${baseCoins} coins!`,
    featuredObstacles: obstacles,
    obstacleThemeName: themeName,
  };
}

export function calculateLevelStars(
  def: LevelDefinition,
  stats: GameStats,
  _extra?: { boostJumps?: number }
): { cleared: boolean; stars: number } {
  const distOk = stats.distanceRun >= def.targetDistance;
  const slapsOk = stats.slapsCount >= def.targetSlaps;
  const coinsOk = stats.coins >= def.targetCoins;

  if (!distOk) {
    return { cleared: false, stars: 0 };
  }

  let stars = 1; // 1 star for clearing distance
  if (slapsOk) stars++;
  if (coinsOk) stars++;

  return { cleared: true, stars: Math.min(3, stars) };
}
