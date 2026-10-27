export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY';

export type BystanderType =
  | 'rubber_duck'
  | 'sleepy_dev'
  | 'bug_gremlin'
  | 'reviewer_bot'
  | 'senior_wizard'
  | 'fishmonger'
  | 'influencer'
  | 'bouncer'
  | 'fruitseller'
  | 'salaryman';

export interface CharacterSkin {
  id: string;
  name: string;
  tagline: string;
  bodyColor: string;
  shirtColor: string;
  pantsColor: string;
  hat: 'none' | 'crown' | string;
  speedBonus: number;
  cost: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  maxCombo: number;
  date: string;
  skinId: string;
  /** Identifies the player row on the global board (one row per player). */
  playerId?: string;
  isPlayer?: boolean;
}

export interface Player {
  x: number;
  y: number;
  z: number;
  prevX?: number;
  prevY?: number;
  vx: number;
  vz: number;
  speed: number;
  baseSpeed: number;
  slapCooldown: number;
  isSlapping: boolean;
  slapHand: 'left' | 'right';
  slapProgress: number;
  slipTimer: number;
  invulnerableTimer?: number;
  feverTime: number;
  skin: CharacterSkin;
  runCycle: number;
  stamina: number;
}

export interface Bystander {
  id: number;
  x: number;
  y: number;
  type: BystanderType;
  name: string;
  points: number;
  bodyColor: string;
  shirtColor: string;
  accessory: 'hat' | 'glasses' | 'phone' | 'fish' | 'fruit';
  slapped: boolean;
  wobble: number;
  /** Idle pedestrians stand; walkers travel along the sidewalk. */
  walking: boolean;
  /** Signed units per frame along the sidewalk (+away from camera, -toward). */
  walkSpeed: number;
  /** Per-person offset so a crowd never marches in lockstep. */
  walkPhase: number;
  knockbackVx?: number;
  inStrikeRange?: boolean;
  flyingAccessory?: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
  };
}

export interface Chaser {
  id: number;
  x: number;
  y: number;
  speed: number;
  bodyColor: string;
  shirtColor: string;
  angrySteamTimer: number;
  runCycle: number;
  animOffset: number;
}

export type ObstacleType =
  // Universal / Jump Ramps & Hazards
  | 'ramp'
  | 'terminal_ramp'
  | 'barrier'
  | 'shifting_block'
  | 'spikes'
  | 'barrel'
  | 'loop_boulder'
  | 'bug'
  // Market Boulevard (Levels 1-4)
  | 'crate'
  | 'cart'
  | 'cafe_table'
  | 'watermelon'
  | 'planter'
  | 'hydrant'
  // Sunny Palm Bay (Levels 5-9)
  | 'surf_rack'
  | 'tiki_totem'
  | 'coconut_crate'
  | 'beach_lounger'
  // Mirage Canyon (Levels 10-17)
  | 'canyon_mesa'
  | 'dino_skull'
  | 'cactus_cluster'
  | 'firewall'
  // Cyber Shibuya (Levels 18-24)
  | 'holo_barrier'
  | 'cyber_server'
  | 'drone_hazard'
  // Frosty Alps (Levels 25-34)
  | 'ice_spikes'
  | 'snow_bale'
  | 'timber_sled'
  // Sacred Lantern Way (Levels 35+)
  | 'torii_gate'
  | 'stone_lantern'
  | 'cherry_wagon'
  | 'zen_barrier';

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  z?: number;
  type: ObstacleType;
  width: number;
  height: number;
  hit: boolean;
  rollSpeed: number;
  vx: number;
  isShifting: boolean;
  shiftMinX: number;
  shiftMaxX: number;
  rotation?: number;
  rotationY?: number;
  rotationZ?: number;
  nearMissChecked?: boolean;
  vaulted?: boolean;
  clearanceHeight?: number;
  hitVx?: number;
  hitVy?: number;
  hitVz?: number;
  rotVx?: number;
  rotVy?: number;
  rotVz?: number;
}

export interface Coin {
  id: number;
  x: number;
  y: number;
  collected: boolean;
  bobPhase: number;
}

export interface Powerup {
  id: number;
  x: number;
  y: number;
  type: 'soda' | 'soap';
  collected: boolean;
  bobPhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  shape: 'star' | 'circle' | 'cloud' | 'sparkle' | 'confetti';
  rotation?: number;
  vRot?: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  scale: number;
  vy: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  lineWidth: number;
  life: number;
  maxLife: number;
}

export interface IntroVictim {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  slapped: boolean;
  glassesFlew: boolean;
  hatFlew: boolean;
  name: string;
  title: string;
}

export type IntroPhase = 'WINDUP' | 'SLAP_IMPACT' | 'DONE' | 'BLAST_OFF';

export interface IntroState {
  active: boolean;
  phase: IntroPhase;
  timer: number;
  victim: IntroVictim | null;
}

export interface InputState {
  joystick: { active: boolean; x: number; y: number };
  keys: { left: boolean; right: boolean; up: boolean; down: boolean; slap: boolean };
  slapRequested: boolean;
}

export interface GameStats {
  score: number;
  highScore: number;
  coins: number;
  totalCoinsCollected: number;
  slapsCount: number;
  chaosLevel: number;
  chaosMultiplier: number;
  feverActive: boolean;
  distanceRun: number;
  comboStreak: number;
  maxCombo: number;
  longestChaseEscape: number;
  stamina: number;
  maxStamina: number;
  chaserOnScreen: boolean;
  chaserAlertTimer: number;
  mobDistance: number;
  currentLevel: number;
  isLevelMode: boolean;
  currentMapId: string;
  boostJumpsCount: number;
  nearMissesCount: number;
  escapedCount: number;
  gameOverReason?: 'BUSTED' | 'EXHAUSTED' | 'COLLISION';
  introActive?: boolean;
  introPhase?: IntroPhase;
  levelComplete?: boolean;
  levelStars?: number;
  levelTargetDistance?: number;
  levelTargetSlaps?: number;
  levelTargetCoins?: number;
  levelTitle?: string;
  globalRank?: number;
  globalRankPending?: boolean;
  globalRankConfirmed?: boolean;
  nextPlayerAbove?: { name: string; score: number; scoreToSurpass: number } | null;
  leaderboardError?: boolean;
  /** Rank inside the on-device Hall of Fame; never presented as a global rank. */
  localRank?: number;
  /** Where this run's score lives: local-only board or a persisted online board. */
  leaderboardMode?: 'local' | 'online';
  leaderboardStatus?: 'local' | 'pending' | 'submitted' | 'failed';
  /** Strictly greater than the best before the run; a tie is not a personal best. */
  isNewPersonalBest?: boolean;
  currentLane?: number;
}
