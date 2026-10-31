import {
  GameState,
  Player,
  Bystander,
  Chaser,
  Obstacle,
  Coin,
  Powerup,
  Particle,
  FloatingText,
  InputState,
  GameStats,
  CharacterSkin,
  Shockwave,
  IntroState,
  IntroVictim,
  ObstacleType,
} from './types.ts';
import {
  CHARACTER_SKINS,
  BYSTANDER_TEMPLATES,
  COMIC_WORDS,
  ROAD_WIDTH,
  ROAD_LANES,
  TOUCH_ROAD_WIDTH,
  TOUCH_ROAD_LANES,
  TOUCH_SLAP_REACH,
  SIDEWALK_EDGES,
  SLAP_REACH,
  MOB_SAFE_DISTANCE,
} from './constants.ts';
import { sounds } from './SoundEngine.ts';
import { ThreeGameRenderer } from './ThreeGameRenderer.ts';
import { LevelDefinition, getLevel, calculateLevelStars, saveLevelResult, loadLevelProgress, getObstaclesForLevel } from './levels.ts';
import { MapDefinition, GAME_MAPS, getMapById } from './maps.ts';
import { Achievement, evaluateAchievements, loadAchievementStorage } from './achievements.ts';
import { GameSettings, isTouchEnvironment, loadSettings } from './settings.ts';
import { getRowGapUnits, getSpawnLookaheadUnits, resolveCorridorSpawn, resolveObstacleSpawn } from './obstacleDensity.ts';
import {
  JUMP_VELOCITY,
  RAMP_VELOCITY,
  TERMINAL_RAMP_VELOCITY,
  canClearObstacle,
  canLaunchFromRamp,
  isRampType,
} from './obstacleRules.ts';

/**
 * Flame pickup cadence: the first one only after 45 s of running, then one every
 * 60 s, and each collection burns for 5 s.
 */
const FIRE_SPAWN_INTERVAL_SECONDS = 60;
const FIRE_FIRST_SPAWN_SECONDS = 45;
const FIRE_DURATION_MS = 5_000;
/** How far ahead of the runner the fire breath catches an obstacle. */
const FIRE_BREATH_LEAD = 72;
/** How long the visible jet streams from the mouth to the prop. */
const FIRE_BREATH_MS = 560;
/** How long a prop keeps burning before it is nothing but ash. */
const BURN_MS = 620;
/**
 * Stamina economy.
 *
 * A whip used to restore 35 points with a 7-frame cooldown and nothing drained
 * stamina while running, so a player who landed most whips could never lose:
 * headless runs reached 11+ km without dying. The bar is now a budget — it
 * bleeds while you run (faster the longer you go) and a whip only buys back
 * part of it — so every run has a ceiling no matter how clean the dodging is.
 */
const STAMINA_PER_WHIP = 22;
/**
 * Touch runs refund a little more per whip: a phone has one thumb juggling
 * dodge, jump and whip, so +26 keeps the fatigue ramp survivable without ever
 * letting a whip outrun the drain (at +35 it used to). Desktop stays at 22.
 */
const STAMINA_PER_WHIP_TOUCH = 26;
/** Frames between whips, so a crowd cannot be farmed frame by frame. */
const SLAP_COOLDOWN_FRAMES = 18;
/**
 * A whip pressed while the previous swing is still on cooldown is remembered
 * for this long. Without it a fast tap on a walker entering the strike window
 * was silently swallowed, which read as "this bystander can't be whipped".
 */
const SLAP_BUFFER_FRAMES = 20;
/**
 * Forward/backward extent of the whip. The old 90-unit front edge was only
 * ~0.19 s of travel late in a run, shorter than human reaction time, and a
 * sidewalk walker could drift out of it between the cue and the tap.
 */
const SLAP_FRONT_WINDOW = 112;
// Where the cue lights up. The strike itself reaches a little further back so
// the final glowing frame, which is struck one frame later, still connects.
const SLAP_BACK_WINDOW = -80;
const SLAP_STRIKE_BACK_WINDOW = -104;
/** Stamina lost per second before the ramp, once fatigue starts. */
const STAMINA_DRAIN_BASE = 0.6;
/** Extra drain per second of running, per second past the fatigue start. */
const STAMINA_DRAIN_RAMP = 0.2;
/** No fatigue while the player is still reading the opening street. */
const STAMINA_FATIGUE_START_SECONDS = 6;
/** Loud, stupid lines for the moment the dino breathes fire at a prop. */
const FIRE_BREATH_LINES = [
  'TOASTY!',
  'HOT BREATH!',
  '*BURRRP*',
  'SMOKIN\'!',
  'SNEEZE OF DOOM!',
  'EXCUSE ME?!',
];
const MOBILE_TUTORIAL_KEY = 'slap_run_mobile_tutorial_done';

function hasSeenMobileTutorial(): boolean {
  try {
    return localStorage.getItem(MOBILE_TUTORIAL_KEY) === '1';
  } catch {
    return true;
  }
}

function markMobileTutorialSeen(): void {
  try {
    localStorage.setItem(MOBILE_TUTORIAL_KEY, '1');
  } catch {}
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: ThreeGameRenderer;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  // Game States
  public state: GameState = 'MENU';
  public selectedSkin: CharacterSkin = CHARACTER_SKINS[0];

  // Level & Map System
  public currentLevel: number = 1;
  public isLevelMode: boolean = false;
  public currentMap: MapDefinition = GAME_MAPS[0];
  public currentLevelDef?: LevelDefinition;
  public boostJumpsCount: number = 0;
  public nearMissesCount: number = 0;
  public escapedCount: number = 0;
  public onAchievementUnlocked?: (achievement: Achievement) => void;
  public onLevelCompleted?: (level: number, stars: number, score: number, coinsEarned: number) => void;

  // Entities
  public player!: Player;
  public bystanders: Bystander[] = [];
  public chasers: Chaser[] = [];
  public obstacles: Obstacle[] = [];
  public coins: Coin[] = [];
  public powerups: Powerup[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  /**
   * The visible jet of flame between the dino's mouth and the prop it is
   * burning. Rendered by the 3D renderer for the few hundred milliseconds it
   * streams, so the attack reads as breath instead of a body-check.
   */
  public fireBreath = {
    active: false,
    timeLeft: 0,
    targetX: 0,
    targetY: 0,
  };
  public shockwaves: Shockwave[] = [];

  // Procedural Spawning
  private nextSpawnY: number = 300;
  private entityIdCounter: number = 1;

  // 3-Lane Alignment (Left: index 0 = -90, Center: index 1 = 0, Right: index 2 = 90)
  public currentLaneIndex: number = 1; // Always lands squarely in center of lane!
  private joystickLaneChanged: boolean = false;

  // Opening Cinematic Mega Slap Sequence
  public introState: IntroState = {
    active: false,
    phase: 'DONE',
    timer: 0,
    victim: null,
  };

  // Input
  public input: InputState = {
    joystick: { active: false, x: 0, y: 0 },
    keys: { left: false, right: false, up: false, down: false, slap: false },
    slapRequested: false,
  };

  // Stats
  public stats: GameStats = {
    score: 0,
    highScore: 0,
    coins: 0,
    totalCoinsCollected: 0,
    slapsCount: 0,
    chaosLevel: 0,
    chaosMultiplier: 1,
    feverActive: false,
    distanceRun: 0,
    durationMs: 0,
    comboStreak: 0,
    maxCombo: 0,
    longestChaseEscape: 0,
    stamina: 100,
    maxStamina: 100,
    chaserOnScreen: false,
    chaserAlertTimer: 0,
    mobDistance: 180,
    currentLevel: 1,
    isLevelMode: false,
    currentMapId: 'market',
    boostJumpsCount: 0,
    nearMissesCount: 0,
    escapedCount: 0,
  };

  // Callback to sync stats with React UI
  /**
   * Frozen once at construction: a device does not switch between touch and
   * keyboard mid-run, and probing matchMedia every frame would be wasted work.
   * Only obstacle density reads this; damage, stamina and Fever behave the same
   * on both input modes.
   */
  public readonly touchInputMode: boolean;
  /**
   * Street geometry for this run, frozen with the input mode. Phones get the
   * wider road (about 12% more room between the same three lanes) and the
   * longer whip reach that follows from walkers standing farther out;
   * keyboard runs keep the original constants.
   */
  public readonly roadWidth: number;
  public readonly roadLanes: number[];
  public readonly slapReach: number;
  private onStatsUpdate?: (stats: GameStats, state: GameState) => void;
  public onHurtFlash?: () => void;
  /** High score as it stood when the current run began, captured before saving. */
  private previousHighScore: number = 0;
  public paceMultiplier: number = 1.0;

  /**
   * Extra stamina for the run that is about to start, banked by a daily mission
   * reward or the "retry with +20 stamina" button. The engine consumes it on
   * start, so one boost can never leak into a second run.
   */
  public staminaBonus: number = 0;
  private hitFreezeMs: number = 0;
  private passiveRunTimer: number = 0;
  /** Frames a whip pressed during cooldown stays queued. */
  private slapBufferFrames: number = 0;
  /** Lane kept open by the previous obstacle segment, for a reachable corridor. */
  private lastFreeLaneIndex: number | null = null;
  // Opening grace window (seconds) after the intro cinematic. While it runs the
  // street is clear, the mob is off-camera and a mistake cannot end the run.
  private graceTimer: number = 0;
  /** Seconds of actual running time, frozen during the intro and tutorial. */
  private runTimeSeconds: number = 0;
  private nextFireAt: number = FIRE_FIRST_SPAWN_SECONDS;
  /**
   * Touch-only first-run dodge lesson. While active the street is frozen and
   * only the indicated direction is accepted, so the player must use the cue
   * before the run starts properly.
   */
  public tutorialState: { active: boolean; pending: boolean; direction: -1 | 1 } = {
    active: false,
    pending: false,
    direction: 1,
  };

  constructor(
    canvas: HTMLCanvasElement,
    onStatsUpdate?: (stats: GameStats, state: GameState) => void,
    onHurtFlash?: () => void
  ) {
    this.canvas = canvas;
    this.onHurtFlash = onHurtFlash;
    this.touchInputMode = isTouchEnvironment();
    this.roadWidth = this.touchInputMode ? TOUCH_ROAD_WIDTH : ROAD_WIDTH;
    this.roadLanes = this.touchInputMode ? TOUCH_ROAD_LANES : ROAD_LANES;
    this.slapReach = this.touchInputMode ? TOUCH_SLAP_REACH : SLAP_REACH;
    this.renderer = new ThreeGameRenderer(this.canvas);
    this.renderer.setTouchLayout(this.touchInputMode);
    this.onStatsUpdate = onStatsUpdate;

    const currentSettings = loadSettings();
    this.renderer.setCharacterFocus(currentSettings.characterFocus !== 'classic');

    this.loadHighScore();
    this.initPlayer();

    // Populate initial market boulevard for Menu attract showcase
    for (let i = 0; i < 6; i++) {
      this.spawnMarketSegment(250 + i * 160);
    }

    // Start render loop immediately so Menu shows living 3D world
    this.lastTime = performance.now();
    this.loop();
  }

  private loadHighScore(): void {
    try {
      const savedHigh = localStorage.getItem('slap_run_highscore');
      if (savedHigh) this.stats.highScore = parseInt(savedHigh, 10) || 0;
      const savedCoins = localStorage.getItem('slap_run_total_coins');
      if (savedCoins) this.stats.totalCoinsCollected = parseInt(savedCoins, 10) || 0;
    } catch {
      // ignore
    }
  }

  private saveHighScore(): void {
    try {
      if (this.stats.score > this.stats.highScore) {
        this.stats.highScore = this.stats.score;
        localStorage.setItem('slap_run_highscore', String(this.stats.highScore));
      }
      localStorage.setItem('slap_run_total_coins', String(this.stats.totalCoinsCollected));
    } catch {
      // ignore
    }
  }

  public setSkin(skin: CharacterSkin): void {
    this.selectedSkin = skin;
    if (this.player) {
      this.player.skin = skin;
    }
    this.renderer.setSkin(skin);
  }

  public setLevel(levelNumber: number, isLevelMode: boolean = true): void {
    this.currentLevel = Math.max(1, levelNumber);
    this.isLevelMode = isLevelMode;
    this.currentLevelDef = getLevel(this.currentLevel);
    const targetMap = getMapById(this.currentLevelDef.mapId);
    this.setMap(targetMap);
    this.stats.currentLevel = this.currentLevel;
    this.stats.isLevelMode = isLevelMode;
    this.stats.levelTargetDistance = this.currentLevelDef.targetDistance;
    this.stats.levelTargetSlaps = this.currentLevelDef.targetSlaps;
    this.stats.levelTargetCoins = this.currentLevelDef.targetCoins;
    this.stats.levelTitle = this.currentLevelDef.title;
    this.stats.levelComplete = false;
    this.stats.levelStars = 0;
  }

  public setMap(map: MapDefinition): void {
    this.currentMap = map;
    this.stats.currentMapId = map.id;
    this.renderer.setMap(map);
  }

  public triggerAchievementCheck(extra: { rampHit?: boolean; nearMissHit?: boolean; escapedHit?: boolean } = {}): void {
    const progress = loadLevelProgress();
    let totalStars = 0;
    Object.values(progress.levelStars).forEach((s) => {
      totalStars += s;
    });
    let skinsCount = 1;
    try {
      const s = localStorage.getItem('slap_run_unlocked_skins');
      if (s) skinsCount = JSON.parse(s).length;
    } catch {}

    const unlocked = evaluateAchievements(this.stats, {
      unlockedLevel: progress.unlockedLevel,
      totalStars,
      unlockedSkinsCount: skinsCount,
      currentMapId: this.currentMap.id,
      ...extra,
    });

    for (const ach of unlocked) {
      sounds.playAchievement();
      this.addFloatingText(this.player.x, this.player.y + 55, `★ ${ach.title.toUpperCase()}!`, '#FDE047', 24);
      this.onAchievementUnlocked?.(ach);
    }
  }

  public resize(width: number, height: number, dpr: number = 1): void {
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.renderer.resize(width, height, dpr);
  }

  public setCharacterFocus(enabled: boolean): void {
    if (this.renderer) {
      this.renderer.setCharacterFocus(enabled);
    }
  }

  public startGame(): void {
    // Capture the old best before this run can raise it, so a score that merely
    // ties the record is not announced as a new personal best.
    this.previousHighScore = this.stats.highScore;
    this.stats.isNewPersonalBest = false;
    this.initPlayer();
    this.currentLaneIndex = 1; // Squarely in center lane (0)
    this.stats.currentLane = 1;
    this.player.x = 0;
    this.player.y = 0;
    this.player.z = 0;

    this.bystanders = [];
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
    this.nextSpawnY = 280;

    // Lead Officer / Inspector Chaser following behind
    this.chasers = [
      {
        id: 9001,
        x: 0,
        y: this.player.y - 180, // far behind off-screen initially
        speed: this.player.baseSpeed,
        bodyColor: '#F4C29E',
        shirtColor: '#1E3A8A', // Police Navy
        angrySteamTimer: 100,
        runCycle: 0,
        animOffset: 0,
      },
    ];

    this.stats.score = 0;
    this.stats.slapsCount = 0;
    this.stats.coins = 0;
    this.stats.chaosLevel = 0;
    this.stats.chaosMultiplier = 1;
    this.stats.feverActive = false;
    this.stats.distanceRun = 0;
    this.stats.comboStreak = 0;
    this.stats.maxCombo = 0;
    this.applyStaminaBonus();
    this.stats.chaserOnScreen = false;
    this.stats.chaserAlertTimer = 0;
    this.stats.mobDistance = 180;
    this.stats.gameOverReason = undefined;
    this.passiveRunTimer = 0;
    this.slapBufferFrames = 0;
    this.graceTimer = 0;
    this.boostJumpsCount = 0;
    this.nearMissesCount = 0;
    this.escapedCount = 0;
    this.stats.boostJumpsCount = 0;
    this.stats.nearMissesCount = 0;
    this.stats.escapedCount = 0;
    this.stats.levelComplete = false;
    this.stats.levelStars = 0;
    this.stats.currentLevel = this.currentLevel;
    this.stats.isLevelMode = this.isLevelMode;
    this.stats.currentMapId = this.currentMap.id;
    this.stats.fireActive = false;
    this.stats.fireTimeLeft = 0;
    this.stats.tutorialActive = false;
    this.stats.tutorialDirection = 1;
    this.runTimeSeconds = 0;
    this.stats.durationMs = 0;
    this.nextFireAt = FIRE_FIRST_SPAWN_SECONDS;
    this.tutorialState = {
      active: false,
      pending: this.touchInputMode && !hasSeenMobileTutorial(),
      direction: 1,
    };

    if (this.isLevelMode) {
      this.currentLevelDef = getLevel(this.currentLevel);
      this.stats.levelTargetDistance = this.currentLevelDef.targetDistance;
      this.stats.levelTargetSlaps = this.currentLevelDef.targetSlaps;
      this.stats.levelTargetCoins = this.currentLevelDef.targetCoins;
      this.stats.levelTitle = this.currentLevelDef.title;
      const targetMap = getMapById(this.currentLevelDef.mapId);
      this.setMap(targetMap);
    } else {
      this.setMap(this.currentMap);
    }

    // Biome-specific boss profiles for the opening slap sequence
    const bossProfiles: Record<string, { name: string; title: string }> = {
      market: { name: 'THE BAZAAR BARON', title: 'Grumpy Market Boss' },
      tropical_coast: { name: 'CAPTAIN COCONUT', title: 'Smug Resort Tycoon' },
      sunset_desert: { name: 'OUTLAW RATTLESNAKE', title: 'Desert Canyon Renegade' },
      neon_night: { name: 'CYBER EXECUTIVE', title: 'Megacorp Tech Lord' },
      winter_peak: { name: 'YETI TYCOON', title: 'Alpine Ski Mogul' },
      golden_temple: { name: 'SHOGUN SHADOW', title: 'Temple Master' },
    };
    const activeBoss = bossProfiles[this.currentMap.id] || bossProfiles.market;

    // Pre-populate initial street with active obstacles, coins, and fruit targets.
    // Same time-based cadence as the live spawner, seeded with the shortest gap so
    // the opening is identical on every run.
    const openingGap = getRowGapUnits(this.player.baseSpeed, () => 0);
    this.lastFreeLaneIndex = null;
    this.nextSpawnY = 240;
    for (let i = 0; i < 4; i++) {
      this.spawnMarketSegment(240 + i * openingGap);
      this.nextSpawnY = 240 + (i + 1) * openingGap;
    }

    if (this.tutorialState.pending) this.setupMobileTutorialRow();

    // Initialize Intro Cinematic Slap Sequence: target positioned squarely in the middle of the road!
    this.introState = {
      active: true,
      phase: 'WINDUP',
      timer: 0,
      victim: {
        x: 0, // Middle of the road
        y: 30, // Right in front of the player
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        slapped: false,
        glassesFlew: false,
        hatFlew: false,
        name: activeBoss.name,
        title: activeBoss.title,
      },
    };

    this.stats.introActive = true;
    this.stats.introPhase = 'WINDUP';
    sounds.playIntroWindup();

    this.state = 'PLAYING';

    if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
    this.lastTime = performance.now();
  }

  public restartGame(): void {
    this.startGame();
  }

  public resetToMenu(): void {
    this.state = 'MENU';
    this.introState = {
      active: false,
      phase: 'DONE',
      timer: 0,
      victim: null,
    };
    this.stats.introActive = false;
    this.stats.introPhase = 'DONE';
    this.stats.tutorialActive = false;
    this.stats.fireActive = false;
    this.stats.fireTimeLeft = 0;
    this.tutorialState = { active: false, pending: false, direction: 1 };
    sounds.stopArcadeBeat();
    this.initPlayer();
    this.bystanders = [];
    this.chasers = [];
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
    this.nextSpawnY = 250;
    for (let i = 0; i < 6; i++) {
      this.spawnMarketSegment(250 + i * 160);
    }
    if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
  }

  /**
   * Snappy 3-Lane Switcher: character always lands squarely in the center of a lane!
   * Regardless of which of the three lanes you move into, character aligns squarely with the lane center.
   */
  public changeLane(direction: -1 | 1): void {
    if (this.introState.active) return;

    // The first-run mobile lesson accepts only the cued direction. All other
    // steering is ignored until the player performs it.
    if (this.tutorialState.active) {
      if (direction !== this.tutorialState.direction) {
        sounds.playTutorialWrong();
        return;
      }
      this.currentLaneIndex = Math.max(
        0,
        Math.min(this.roadLanes.length - 1, this.currentLaneIndex + direction)
      );
      this.stats.currentLane = this.currentLaneIndex;
      this.tutorialState.active = false;
      this.stats.tutorialActive = false;
      markMobileTutorialSeen();
      sounds.playPowerup();
      this.addFloatingText(
        this.roadLanes[this.currentLaneIndex],
        this.player.y + 25,
        'NICE DODGE!',
        '#34D399',
        24
      );
      return;
    }

    const newIndex = Math.max(0, Math.min(this.roadLanes.length - 1, this.currentLaneIndex + direction));
    if (newIndex !== this.currentLaneIndex) {
      this.currentLaneIndex = newIndex;
      this.stats.currentLane = this.currentLaneIndex;
      sounds.playWhoosh();
    }
  }

  /**
   * Builds one unmistakable lesson row: a blocker dead ahead in the centre lane
   * and a coin trail in the right lane, where the cue points.
   */
  private setupMobileTutorialRow(): void {
    this.obstacles = this.obstacles.filter((o) => o.y > 620);
    this.coins = this.coins.filter((c) => c.y > 620);
    this.powerups = this.powerups.filter((p) => p.y > 620);

    this.obstacles.push({
      id: this.entityIdCounter++,
      x: 0,
      y: 430,
      type: 'barrier',
      width: 54,
      height: 36,
      hit: false,
      rollSpeed: 0,
      vx: 0,
      isShifting: false,
      shiftMinX: -100 * (this.roadWidth / ROAD_WIDTH),
      shiftMaxX: 100 * (this.roadWidth / ROAD_WIDTH),
    });

    for (let i = 0; i < 4; i++) {
      this.coins.push({
        id: this.entityIdCounter++,
        x: this.roadLanes[2],
        y: 355 + i * 30,
        collected: false,
        bobPhase: i * 0.4,
      });
    }
  }

  /**
   * Triggers the opening mega slap immediately if user taps or presses Space during windup
   */
  public triggerIntroSlapNow(): void {
    if (this.introState.active && this.introState.phase === 'WINDUP') {
      this.executeIntroSlap();
    }
  }

  /**
   * Execute the colossal introductory slap on the boss positioned in the middle of the road
   */
  public executeIntroSlap(): void {
    if (!this.introState.active || this.introState.phase !== 'WINDUP' || !this.introState.victim) return;

    this.introState.phase = 'SLAP_IMPACT';
    const v = this.introState.victim;
    v.slapped = true;
    // The opening strike is a full-body tail-whip, not a hand slap.
    this.player.isWhipping = true;
    this.player.whipProgress = 0;
    this.player.isSlapping = false;

    // Massive impact physics: victim flies backwards and launches into the sky
    v.vx = (Math.random() - 0.5) * 6;
    v.vy = 26; // flies forward down the road
    v.vz = 22; // launches high up
    v.rotationX = 8.5;
    v.rotationY = 4.2;
    v.rotationZ = 12.0;
    v.glassesFlew = true;
    v.hatFlew = true;

    // Tactical hit-stop frame freeze & massive screen shake!
    this.hitFreezeMs = 35;
    this.renderer.triggerShake(24);
    this.renderer.triggerHitFreeze(3);

    // Audio impact: a leather-crack whip, not a palm slap.
    sounds.playWhipCrack();

    // Mobile haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([60, 40, 80]);
      } catch {}
    }

    // Colossal comic popups & particles
    this.addFloatingText(0, 45, 'MEGA OPENING TAIL-WHIP!!', '#FFFDF0', 36);
    this.addFloatingText(0, 75, '+500 DINO MAYHEM BONUS!', '#10B981', 22);
    this.spawnParticleExplosion(0, 32, '#F59E0B', 24, 'star');
    this.spawnParticleExplosion(0, 32, '#EC4899', 16, 'sparkle');
    this.spawnConfettiShower(0, 35);

    this.shockwaves.push({
      x: 0,
      y: 32,
      radius: 12,
      maxRadius: 75,
      color: '#EC4899',
      lineWidth: 4.5,
      life: 20,
      maxLife: 20,
    });

    this.stats.score += 500;
    this.stats.slapsCount += 1;
    this.stats.comboStreak = 1;
    this.stats.stamina = this.stats.maxStamina;
    this.stats.introPhase = 'SLAP_IMPACT';
    if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
  }

  /** Applies any stamina banked for this run; the plain run starts at 100. */
  private applyStaminaBonus(): void {
    const bonus = Math.max(0, Math.min(40, Math.floor(this.staminaBonus) || 0));
    const max = 100 + bonus;
    this.stats.maxStamina = max;
    this.stats.stamina = max;
    this.player.stamina = max;
    this.staminaBonus = 0;
  }

  private initPlayer(): void {
    // Faster running speed as requested (base 5.2 + skin bonus)
    const calculatedBase = (5.2 + this.selectedSkin.speedBonus) * (this.paceMultiplier || 1.0);
    this.player = {
      x: 0,
      y: 0,
      z: 0,
      prevX: 0,
      prevY: 0,
      vx: 0,
      vz: 0,
      speed: calculatedBase,
      baseSpeed: calculatedBase,
      slapCooldown: 0,
      isSlapping: false,
      slapHand: 'right',
      slapProgress: 0,
      slipTimer: 0,
      invulnerableTimer: 0,
      feverTime: 0,
      fireTime: 0,
      isWhipping: false,
      whipProgress: 0,
      skin: this.selectedSkin,
      runCycle: 0,
      stamina: 100,
    };
    if (this.renderer) {
      this.renderer.resetTrack(0);
      this.renderer.resetCamera(0);
    }
  }

  public requestSlap(): void {
    if (this.tutorialState.active) return;
    this.input.slapRequested = true;
  }

  public requestJump(): void {
    if (this.introState.active || this.tutorialState.active || this.state !== 'PLAYING') return;
    const p = this.player;
    if (!p) return;
    if (p.z <= 0.6 && p.vz <= 0.2) {
      p.vz = JUMP_VELOCITY;
      sounds.playJump();
      this.spawnParticleExplosion(p.x, p.y, '#E2E8F0', 6, 'cloud');
    }
  }

  public applySettings(settings: any): void {
    if (!this.renderer) return;
    this.renderer.setShakeEnabled(settings.cameraShake);
    this.renderer.setReducedMotion(Boolean(settings.reducedMotion));
    this.renderer.setCharacterFocus(settings.characterFocus !== 'classic');
  }

  public pauseGame(): void {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      sounds.stopArcadeBeat();
      if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
    }
  }

  public resumeGame(): void {
    if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.lastTime = performance.now();
      if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
    }
  }

  private loop = (): void => {
    const now = performance.now();
    const dt = Math.min(32, now - this.lastTime); // Cap delta time
    this.lastTime = now;

    // Tactical arcade hit-stop freeze (50-70ms) to give slap impacts maximum weight!
    if (this.hitFreezeMs > 0) {
      this.hitFreezeMs -= dt;
      this.render();
      this.animFrameId = requestAnimationFrame(this.loop);
      return;
    }

    if (this.state === 'PLAYING') {
      this.update(dt / 16.666); // Normalized to ~60fps
    } else if (this.state === 'MENU') {
      this.updateMenu(dt / 16.666);
    }

    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private updateMenu(dtFactor: number): void {
    // Active runner jog in Menu mode (matches live gameplay!)
    this.player.speed = this.player.baseSpeed || 4.8;
    this.player.runCycle += 0.12 * dtFactor;
    this.player.y += this.player.speed * dtFactor;
    if (this.player.y + 750 > this.nextSpawnY) {
      this.spawnMarketSegment(this.nextSpawnY);
      this.nextSpawnY += 160;
    }
  };

  private update(dtFactor: number): void {
    const p = this.player;

    // 0. Introductory Cinematic Tail-Whip Sequence (Opening strike in the road)
    if (this.introState.active) {
      this.updateIntroSequence(dtFactor);
      this.updateParticlesAndTexts(dtFactor);
      if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
      return;
    }

    // 0b. First-run mobile lesson: hold the street still until the cued dodge.
    if (this.tutorialState.active) {
      p.runCycle += 0.04 * dtFactor;
      this.stats.stamina = Math.round(p.stamina);
      this.stats.tutorialActive = true;
      this.stats.tutorialDirection = this.tutorialState.direction;
      this.updateParticlesAndTexts(dtFactor);
      if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
      return;
    }

    this.runTimeSeconds += dtFactor / 60;
    // Published with the score so the leaderboard can check that a big number
    // was actually possible in the time the run took.
    this.stats.durationMs = Math.round(this.runTimeSeconds * 1000);

    // 1. Fever Run Timer
    if (p.feverTime > 0) {
      p.feverTime -= 16.66 * dtFactor;
      this.stats.feverActive = true;
      if (p.feverTime <= 0) {
        p.feverTime = 0;
        this.stats.feverActive = false;
        this.stats.chaosLevel = 25; // Drop chaos back to a manageable level
        this.updateChaosMultiplier();
      }
    } else {
      this.stats.feverActive = false;
      // Gentle decay of chaos meter if not in Fever mode
      if (this.stats.chaosLevel > 0) {
        this.stats.chaosLevel = Math.max(0, this.stats.chaosLevel - 0.04 * dtFactor);
        this.updateChaosMultiplier();
      }
    }

    // 1b. Flame Mode Timer
    if (this.fireBreath.active) {
      this.fireBreath.timeLeft = Math.max(0, this.fireBreath.timeLeft - 16.66 * dtFactor * 0.001);
      if (this.fireBreath.timeLeft <= 0) this.fireBreath.active = false;
    }
    if (p.fireTime > 0) {
      p.fireTime = Math.max(0, p.fireTime - 16.66 * dtFactor);
      this.stats.fireActive = p.fireTime > 0;
      this.stats.fireTimeLeft = Math.ceil(p.fireTime / 1000);
      if (p.fireTime <= 0) {
        this.stats.fireActive = false;
        this.stats.fireTimeLeft = 0;
      }
    } else {
      this.stats.fireActive = false;
      this.stats.fireTimeLeft = 0;
    }

    // 2. Health / Stamina
    // Stamina is the only life system: obstacles cost it, landed whips restore
    // part of it, and running itself burns it once the opening is over. The
    // fatigue drain is the run's ceiling — without it, a player who lands every
    // whip refills faster than anything can take it away and never loses.
    if (this.runTimeSeconds > STAMINA_FATIGUE_START_SECONDS) {
      const drainPerSecond =
        STAMINA_DRAIN_BASE +
        (this.runTimeSeconds - STAMINA_FATIGUE_START_SECONDS) * STAMINA_DRAIN_RAMP;
      p.stamina = Math.max(0, p.stamina - (drainPerSecond * dtFactor) / 60);
    }
    this.stats.stamina = Math.round(p.stamina);
    if (p.stamina <= 0) {
      this.triggerGameOver('EXHAUSTED');
      return;
    }

    // 2a. Stumble / Slip timer & Recovery Invulnerability
    if (p.slipTimer > 0) {
      p.slipTimer -= dtFactor;
    }
    if (p.invulnerableTimer && p.invulnerableTimer > 0) {
      p.invulnerableTimer -= 0.016 * dtFactor;
      if (p.invulnerableTimer < 0) p.invulnerableTimer = 0;
    }

    // 2b. Vertical Jump Elevation Physics
    if (p.z > 0 || p.vz !== 0) {
      p.z += p.vz * dtFactor;
      p.vz -= 0.42 * dtFactor;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = 0;
      }
    }

    // 3. Forward Speed calculation (faster base speed, gradually increases with distance)
    // Full speed now arrives at ~760 m / ~18 s instead of ~1,266 m / ~30 s,
    // so the acceleration is felt while obstacle density is still climbing.
    // The cap keeps climbing past the old 9.0 units/frame ceiling, so a long run
    // keeps gaining pace instead of flattening out after 760 m.
    const speedProgressBonus = Math.min(6.4, (p.y / 2400) * 1.8);
    let currentSpeed = (p.baseSpeed + speedProgressBonus);
    if (this.stats.feverActive) {
      currentSpeed *= 1.45; // Super turbo in Fever
    } else if (p.slipTimer > 0) {
      currentSpeed *= 0.65; // Stumble slowdown
    } else if (Math.abs(p.x) > this.roadWidth / 2 - 15) {
      // Rough sidewalk curb friction on outer edges
      currentSpeed *= 0.88;
    }
    p.prevY = p.y;
    p.prevX = p.x;
    p.speed = currentSpeed;
    p.y += p.speed * dtFactor;
    this.stats.distanceRun = Math.floor(p.y / 10);

    // Run cycle animation
    p.runCycle += 0.05 * p.speed * dtFactor;

    // 4. Snappy 3-Lane Alignment (Left: -90, Center: 0, Right: +90)
    // "when you move your character left or right, they should always land squarely in the center of a lane."
    if (this.input.joystick.active) {
      if (Math.abs(this.input.joystick.x) > 0.35) {
        if (!this.joystickLaneChanged) {
          this.changeLane(this.input.joystick.x > 0 ? 1 : -1);
          this.joystickLaneChanged = true;
        }
      } else if (Math.abs(this.input.joystick.x) < 0.15) {
        this.joystickLaneChanged = false;
      }
    } else {
      this.joystickLaneChanged = false;
    }

    // Smooth snappy glide ensuring character always lands squarely in the center of the lane
    const targetX = this.roadLanes[this.currentLaneIndex];
    const diff = targetX - p.x;
    if (Math.abs(diff) > 0.4) {
      p.vx = diff * 12.0;
      p.x += diff * Math.min(1.0, 0.28 * dtFactor);
    } else {
      p.x = targetX;
      p.vx = 0;
    }

    // Clamp inside 3-lane road limits (-125 to 125)
    const maxBound = this.roadWidth / 2 - 15;
    if (p.x < -maxBound) p.x = -maxBound;
    if (p.x > maxBound) p.x = maxBound;

    // 5. Slap Action Logic
    if (p.slapCooldown > 0) {
      p.slapCooldown -= dtFactor;
    }

    if (this.input.slapRequested || this.input.keys.slap) {
      this.input.slapRequested = false;
      if (p.slapCooldown > 0) {
        // Too early: queue the intent instead of dropping it on the floor.
        this.slapBufferFrames = SLAP_BUFFER_FRAMES;
      } else {
        this.slapBufferFrames = 0;
        this.executeSlap();
      }
    } else if (this.slapBufferFrames > 0) {
      if (p.slapCooldown <= 0) {
        // Only spend the queued swing on a real target; otherwise let it lapse.
        if (this.findWhipTarget()) {
          this.slapBufferFrames = 0;
          this.executeSlap();
        } else {
          this.slapBufferFrames = 0;
        }
      } else {
        this.slapBufferFrames -= dtFactor;
        if (this.slapBufferFrames < 0) this.slapBufferFrames = 0;
      }
    }

    // Progress active whip / slap animation
    if (p.isWhipping) {
      p.whipProgress += 0.09 * dtFactor;
      if (p.whipProgress >= 1) {
        p.isWhipping = false;
        p.whipProgress = 0;
      }
    }
    if (p.isSlapping) {
      p.slapProgress += 0.14 * dtFactor;
      if (p.slapProgress >= 1) {
        p.isSlapping = false;
        p.slapProgress = 0;
      }
    }

    // 6. Update Bystanders & Check for missed Slap window
    for (const b of this.bystanders) {
      // Directional Slap Knockback
      if (b.knockbackVx) {
        b.x += b.knockbackVx * 0.016 * dtFactor;
        b.knockbackVx *= 0.85;
        if (Math.abs(b.knockbackVx) < 0.8) b.knockbackVx = 0;
      }

      // A walker covers ground along the curb; an idler stays put. The strike
      // window therefore moves with them, so a whip has to be timed.
      if (!b.slapped && b.walking && b.walkSpeed !== 0) {
        b.y += b.walkSpeed * dtFactor;
      }

      if (!b.slapped) {
        // Same test the whip itself uses, so the glow never promises a hit the
        // strike cannot deliver.
        b.inStrikeRange = this.isWhipReachable(b);
      } else {
        b.inStrikeRange = false;
        if (b.wobble > 0) {
          b.wobble -= 0.05 * dtFactor;
        }
      }
      // Update flying accessory knocked into the air
      if (b.flyingAccessory) {
        const fa = b.flyingAccessory;
        fa.x += fa.vx * dtFactor;
        fa.y += fa.vy * dtFactor;
        fa.rotation += 0.15 * dtFactor;
        fa.vy -= 0.25 * dtFactor; // gravity
      }
    }

    // 6a. Touch auto-whip assist, airborne only. On a phone the same thumb has
    // to jump and whip, so a walker could glow and pass while the player was
    // mid-dodge. The engine covers that jump window itself, but ground whips
    // stay manual: otherwise every walker is hit for free, stamina never drops
    // and the run has no failure state. Same cooldown and reward as a tap.
    if (
      this.touchInputMode &&
      p.z > 0 &&
      p.slapCooldown <= 0 &&
      this.bystanders.some((b) => b.inStrikeRange)
    ) {
      this.executeSlap();
    }

    // 6b. Opening grace window: keep the mob off-camera so a new player can
    // learn the controls before anything can end the run.
    if (this.graceTimer > 0) {
      this.graceTimer = Math.max(0, this.graceTimer - dtFactor / 60);
      this.stats.chaserOnScreen = false;
      this.stats.chaserAlertTimer = 0;
    }

    // 7. Chaser pursuit (pressure, not a hidden life bar)
    // - The mob always trails the player, off-camera at ~220 units.
    // - A stumble brings them onto your heels (~72 units) for 6 seconds.
    // - Six clean seconds shakes them off for +150 and they fall back out of view.
    // - Stamina is the only way to lose; the mob is the visible consequence of a hit.
    if (this.chasers.length > 0) {
      const leadChaser = this.chasers[0];

      // If chaser is currently visible on-screen:
      if (this.stats.chaserOnScreen) {
        this.stats.chaserAlertTimer -= dtFactor / 60;
        if (this.stats.chaserAlertTimer <= 0) {
          // Navigated past obstacles cleanly!
          this.stats.chaserOnScreen = false;
          this.stats.chaserAlertTimer = 0;
          this.escapedCount++;
          this.stats.escapedCount = this.escapedCount;
          sounds.playEscaped();
          this.addFloatingText(p.x, p.y + 25, 'ESCAPED CHASER! +150', '#10B981', 22);
          this.stats.score += 150 * this.stats.chaosMultiplier;
          this.triggerAchievementCheck({ escapedHit: true });
        }
      }

      // Desired distance:
      // When on-screen: 72 units (visible behind player without blocking screen or player view!)
      // When off-screen: 220 units (completely behind camera)
      const targetDist = this.stats.chaserOnScreen ? 72 : 220;
      const currentDist = p.y - leadChaser.y;
      const distDiff = currentDist - targetDist;

      leadChaser.speed = p.speed + (distDiff * 0.12);
      leadChaser.y += leadChaser.speed * dtFactor;
      // Flank to the side so chaser doesn't run directly in the camera line of sight to player:
      const flankTargetX = p.x + (p.x >= 0 ? -38 : 38);
      leadChaser.x += (flankTargetX - leadChaser.x) * 0.12 * dtFactor;
      leadChaser.runCycle += 0.08 * dtFactor;
      leadChaser.angrySteamTimer += 0.08 * dtFactor;

      // Other mob members follow tightly in a cluster
      for (let i = 1; i < this.chasers.length; i++) {
        const c = this.chasers[i];
        c.runCycle += 0.07 * dtFactor;
        const targetY = leadChaser.y - (i * 16);
        c.y += (targetY - c.y) * 0.2 * dtFactor;
        const flankOffset = i % 2 === 1 ? -22 : 22;
        c.x += (leadChaser.x + flankOffset - c.x) * 0.14 * dtFactor;
      }

      this.stats.mobDistance = Math.round(p.y - leadChaser.y);
    }

    // 8. Obstacle Movements & Traps
    const playerHalfW = 20;
    const playerHalfD = 18;
    const pPrevY = p.prevY ?? p.y;
    const pPrevX = p.prevX ?? p.x;
    const pMinY = Math.min(pPrevY, p.y) - playerHalfD;
    const pMaxY = Math.max(pPrevY, p.y) + playerHalfD;
    const pMinX = Math.min(pPrevX, p.x) - playerHalfW;
    const pMaxX = Math.max(pPrevX, p.x) + playerHalfW;

    for (const obs of this.obstacles) {
      // Dynamic Shifting Hazard Blocks slide smoothly across lanes
      if (obs.type === 'shifting_block' || obs.isShifting) {
        if (!obs.vx) obs.vx = 1.8;
        obs.x += obs.vx * dtFactor;
        const minX = obs.shiftMinX ?? -95;
        const maxX = obs.shiftMaxX ?? 95;
        if (obs.x < minX) {
          obs.x = minX;
          obs.vx = Math.abs(obs.vx);
        } else if (obs.x > maxX) {
          obs.x = maxX;
          obs.vx = -Math.abs(obs.vx);
        }
      }

      // Hovering surveillance drones drift across the lanes and bob, so the
      // night map keeps the player reading the road instead of pattern-matching
      // a static prop.
      if (obs.type === 'drone_hazard') {
        if (!obs.vx) obs.vx = 1.15 + Math.random() * 0.4;
        obs.x += obs.vx * dtFactor;
        const minX = obs.shiftMinX ?? -95;
        const maxX = obs.shiftMaxX ?? 95;
        if (obs.x < minX) {
          obs.x = minX;
          obs.vx = Math.abs(obs.vx);
        } else if (obs.x > maxX) {
          obs.x = maxX;
          obs.vx = -Math.abs(obs.vx);
        }
        obs.z = 3 + Math.sin(p.y * 0.04 + obs.id) * 3;
      }

      // Rolling Barrels & Boulders with realistic road bounce
      if (obs.type === 'barrel' || obs.type === 'loop_boulder') {
        obs.y -= (obs.rollSpeed ?? 2.0) * dtFactor;
        obs.rotation = (obs.rotation ?? 0) + 0.16 * dtFactor;
        obs.z = Math.abs(Math.sin((obs.rotation ?? 0) * 2)) * 0.8;
        if (obs.vx) {
          obs.x += obs.vx * dtFactor;
          if (obs.x < -110) {
            obs.x = -110;
            obs.vx = Math.abs(obs.vx);
          } else if (obs.x > 110) {
            obs.x = 110;
            obs.vx = -Math.abs(obs.vx);
          }
        }
      }

      // Market Cart subtle street rattle
      if (obs.type === 'cart') {
        obs.rotationZ = Math.sin(p.y * 0.05 + obs.id) * 0.04;
      }

      // Tumbling physics for hit obstacles
      if (obs.hit) {
        // A prop on fire never gets kicked away: it burns down in place and is
        // removed by the cleanup pass once there is nothing left of it.
        if (obs.burning) {
          obs.burnTime = Math.max(0, (obs.burnTime ?? 0) - 16.66 * dtFactor);
          obs.burnProgress = 1 - (obs.burnTime ?? 0) / BURN_MS;
          continue;
        }
        if (obs.hitVx || obs.hitVy || obs.hitVz) {
          obs.x += (obs.hitVx || 0) * dtFactor;
          obs.y += (obs.hitVy || 0) * dtFactor;
          obs.z = Math.max(0, (obs.z || 0) + (obs.hitVz || 0) * dtFactor);
          obs.hitVz = (obs.hitVz || 0) - 0.55 * dtFactor; // gravity
          obs.rotation = (obs.rotation ?? 0) + (obs.rotVx ?? 0.25) * dtFactor;
          obs.rotationY = (obs.rotationY ?? 0) + (obs.rotVy ?? 0.18) * dtFactor;
          obs.rotationZ = (obs.rotationZ ?? 0) + (obs.rotVz ?? 0.12) * dtFactor;
        }
        continue;
      }

      // Continuous Swept Collision Bounds
      const obsHalfW = Math.max(20, (obs.width || 46) / 2);
      const obsHalfD = Math.max(16, (obs.height || 34) / 2);
      const obsMinY = obs.y - obsHalfD;
      const obsMaxY = obs.y + obsHalfD;
      const obsMinX = obs.x - obsHalfW;
      const obsMaxX = obs.x + obsHalfW;

      const overlapY = pMaxY >= obsMinY && pMinY <= obsMaxY;
      const overlapX = pMaxX >= obsMinX && pMinX <= obsMaxX;

      // Flame Mode breath: while burning, the dino exhales a jet the moment an
      // obstacle it did not jump comes within reach, so the burn reads as an
      // attack instead of a body-check. Fire mode is a shield for its full
      // duration — the contact branch inside the overlap below is the fallback.
      if (p.fireTime > 0 && !obs.hit && !isRampType(obs.type)) {
        const gap = obs.y - pMaxY;
        if (gap >= -6 && gap <= FIRE_BREATH_LEAD && Math.abs(obs.x - p.x) < 62) {
          const line = FIRE_BREATH_LINES[Math.floor(Math.random() * FIRE_BREATH_LINES.length)];
          this.igniteObstacle(obs, line);
          continue;
        }
      }

      if (overlapY && overlapX) {
        // Launch Ramp Trigger (Standard ramp or Terminal launch pad). Ramps only
        // launch a grounded runner: jumping over one must not re-launch you in
        // mid-air, which is what made the dino appear to float.
        if (isRampType(obs.type)) {
          if (!canLaunchFromRamp(p.z, p.vz)) continue;
          obs.hit = true;
          sounds.playJump();
          p.vz = obs.type === 'terminal_ramp' ? TERMINAL_RAMP_VELOCITY : RAMP_VELOCITY;
          this.renderer.triggerShake(4);
          this.boostJumpsCount++;
          this.stats.boostJumpsCount = this.boostJumpsCount;
          this.stats.score += 150 * this.stats.chaosMultiplier;
          this.addFloatingText(p.x, p.y + 20, obs.type === 'terminal_ramp' ? 'TURBO LAUNCH!' : 'BOOST JUMP!', '#10B981', 24);
          this.spawnParticleExplosion(obs.x, obs.y, '#34D399', 12, 'sparkle');
          this.triggerAchievementCheck({ rampHit: true });
          continue;
        }

        // Flame Mode: anything that still reaches the runner is incinerated on
        // contact, with no stamina cost and no stumble. Ramps stay friendly
        // (handled above).
        if (p.fireTime > 0) {
          this.igniteObstacle(obs, 'BURNED!');
          continue;
        }

        // One height rule for every prop: low market clutter clears when the
        // feet are above its top, solid props are taller than a jump and must be
        // dodged. This replaces the old shared `16` that made every wall jumpable.
        const clearsObstacle =
          obs.clearanceHeight !== undefined
            ? p.z >= obs.clearanceHeight
            : canClearObstacle(obs.type, p.z);

        if (clearsObstacle) {
          // Clean vault over low obstacle!
          if (!obs.vaulted) {
            obs.vaulted = true;
            this.stats.score += 80 * this.stats.chaosMultiplier;
            sounds.playJump();
            this.addFloatingText(p.x, p.y + 25, 'VAULT OVER! +80', '#10B981', 18);
            this.spawnParticleExplosion(p.x, p.y, '#34D399', 6, 'sparkle');
          }
          continue;
        }

        // If player is currently in post-hit recovery grace period, ignore collision
        if (p.invulnerableTimer && p.invulnerableTimer > 0) {
          continue;
        }

        // REAL COLLISION HIT!
        obs.hit = true;

        if (this.stats.feverActive) {
          // SMASH through obstacle with explosive stars in fever mode!
          obs.hitVx = (Math.random() - 0.5) * 8;
          obs.hitVy = 16 + Math.random() * 6;
          obs.hitVz = 12 + Math.random() * 4;
          obs.rotVx = 0.4;
          obs.rotVy = 0.3;
          obs.rotVz = 0.2;
          sounds.playWhack();
          this.renderer.triggerShake(7);
          this.spawnParticleExplosion(obs.x, obs.y, '#FDE047', 14);
          this.addFloatingText(obs.x, obs.y, 'SMASH!', '#FDE047', 22);
          this.stats.score += 200 * this.stats.chaosMultiplier;
        } else {
          // Obstacle knock-away on stumble: sideways and slightly up, not a pop
          // that reads as the prop launching itself at the dino.
          obs.hitVx = p.x < obs.x ? 6 : -6;
          obs.hitVy = 5;
          obs.hitVz = 2.5;
          obs.rotVx = 0.3;
          obs.rotVz = 0.25;

          // THREE-HIT STRUCTURE:
          // Every stumble costs stamina (3 clean hits from full health), the mob
          // only appears after the first mistake, and whip hits refill stamina.
          // Tall barriers = -45 HP (heavy impact), low obstacles = -35 HP (trip).
          const isHeavy =
            obs.type === 'barrier' ||
            obs.type === 'shifting_block' ||
            obs.type === 'cart' ||
            obs.type === 'firewall';
          const damage = isHeavy ? 45 : 35;
          const inGrace = this.graceTimer > 0;

          p.stamina = inGrace
            ? Math.max(1, p.stamina - damage)
            : Math.max(0, p.stamina - damage);
          this.stats.stamina = Math.round(p.stamina);
          this.onHurtFlash?.();
          sounds.playWhack();

          // If stamina depleted by obstacle damage: Dino collapses!
          if (p.stamina <= 0) {
            this.renderer.triggerShake(16);
            this.addFloatingText(p.x, p.y + 20, `OUT OF ENERGY! -${damage} HP`, '#EF4444', 26);
            this.triggerGameOver(this.stats.chaserOnScreen ? 'BUSTED' : 'EXHAUSTED');
            return;
          }

          // Stumble with energy left:
          // 1. 1.2s post-hit recovery so a single mistake never double-hits
          p.invulnerableTimer = 1.2;
          p.slipTimer = 30; // stumble slowdown
          this.stats.comboStreak = 0;

          // 2. Mob stampede surges onto your heels (never during the grace run)
          if (!inGrace) {
            this.stats.chaserOnScreen = true;
            this.stats.chaserAlertTimer = 6.0; // 6s clean run shakes them off
            if (this.chasers.length > 0) {
              this.chasers[0].y = p.y - 42;
              this.chasers[0].x = p.x;
            }
          }

          sounds.playPoliceWhistle();
          this.renderer.triggerShake(isHeavy ? 14 : 10);
          this.addFloatingText(p.x, p.y + 20, `HURT! -${damage} HP! MOB ALERT!`, '#EF4444', 22);
          this.spawnParticleExplosion(obs.x, obs.y, '#EF4444', 14, 'star');
        }
      } else if (!obs.hit && !obs.nearMissChecked && obs.type !== 'ramp' && obs.type !== 'terminal_ramp') {
        // High-Skill Near-Miss Dodge Bonus (+50 pts & crisp whoosh sound)
        const dy = Math.abs(p.y - obs.y);
        const dx = Math.abs(p.x - obs.x);
        if (dy < 24 && dx >= (obsHalfW + 6) && dx <= (obsHalfW + 36)) {
          obs.nearMissChecked = true;
          this.nearMissesCount++;
          this.stats.nearMissesCount = this.nearMissesCount;
          this.stats.score += 50 * this.stats.chaosMultiplier;
          this.addFloatingText(p.x, p.y + 35, 'CLOSE CALL! +50', '#38BDF8', 16);
          sounds.playNearMiss();
          this.triggerAchievementCheck({ nearMissHit: true });
        }
      }
    }

    // 9. Coin Pickups
    for (const c of this.coins) {
      if (c.collected) continue;
      c.bobPhase += 0.05 * dtFactor;
      const dy = Math.abs(p.y - c.y);
      const dx = Math.abs(p.x - c.x);
      if (dy < 24 && dx < 24) {
        c.collected = true;
        this.stats.coins++;
        this.stats.totalCoinsCollected++;
        this.stats.score += 50 * this.stats.chaosMultiplier;
        sounds.playCoin();
        this.spawnParticleExplosion(c.x, c.y, '#F59E0B', 8, 'sparkle');
        this.triggerAchievementCheck();
      }
    }

    // 10. Powerup Pickups
    for (const pu of this.powerups) {
      if (pu.collected) continue;
      pu.bobPhase += 0.05 * dtFactor;
      const dy = Math.abs(p.y - pu.y);
      const dx = Math.abs(p.x - pu.x);
      if (dy < 26 && dx < 26) {
        pu.collected = true;
        if (pu.type === 'fire') {
          // Flame Mode: five seconds of burning through anything ahead.
          p.fireTime = FIRE_DURATION_MS;
          this.stats.fireActive = true;
          this.stats.fireTimeLeft = Math.ceil(FIRE_DURATION_MS / 1000);
          sounds.playFirePickup();
          this.renderer.triggerShake(5);
          this.addFloatingText(p.x, p.y + 20, `FIRE MODE! ${FIRE_DURATION_MS / 1000}s`, '#F97316', 26);
          this.spawnParticleExplosion(pu.x, pu.y, '#F97316', 20, 'star');
          this.spawnParticleExplosion(pu.x, pu.y, '#FBBF24', 12, 'sparkle');
        } else if (pu.type === 'soda') {
          sounds.playPowerup();
          // Espresso Turbo Fuel
          this.addChaos(35);
          p.stamina = Math.min(this.stats.maxStamina, p.stamina + 45);
          this.stats.stamina = Math.round(p.stamina);
          this.addFloatingText(p.x, p.y + 20, 'POWER BOOST!', '#F59E0B', 22);
          this.spawnParticleExplosion(pu.x, pu.y, '#F59E0B', 14, 'star');
        } else {
          // Debug Shield Orb (invulnerability barrier)
          sounds.playPowerup();
          p.feverTime = Math.max(p.feverTime, 3500);
          this.addFloatingText(p.x, p.y + 20, 'ENERGY SHIELD!', '#00F0FF', 22);
          this.spawnParticleExplosion(pu.x, pu.y, '#00F0FF', 14, 'sparkle');
        }
      }
    }

    // 11-12. Update Particles, Popups, and Shockwaves
    this.updateParticlesAndTexts(dtFactor);

    // 13. Continuous street spawning at a constant cadence in time.
    // The gap and the lookahead are converted through the current speed, so a
    // faster run sees the same warning window and the same ~1 s between rows
    // instead of the 0.56 s the old flat 300-360 unit gap produced at the cap.
    if (p.y + getSpawnLookaheadUnits(p.speed) > this.nextSpawnY) {
      this.spawnMarketSegment(this.nextSpawnY);
      this.nextSpawnY += getRowGapUnits(p.speed);
    }

    // 14. Cleanup off-screen entities behind player (lead chaser is always preserved)
    const cleanupY = p.y - 350;
    this.bystanders = this.bystanders.filter((b) => b.y > cleanupY);
    this.obstacles = this.obstacles.filter(
      (o) => o.y > cleanupY && !(o.burning && (o.burnTime ?? 0) <= 0)
    );
    this.coins = this.coins.filter((c) => c.y > cleanupY);
    this.powerups = this.powerups.filter((pu) => pu.y > cleanupY);
    this.chasers = this.chasers.filter((c) => c.id === 9001 || c.y > cleanupY);

    // 15. Level Progression & Milestone Goals
    if (this.isLevelMode && !this.stats.levelComplete && this.currentLevelDef) {
      const evaluation = calculateLevelStars(this.currentLevelDef, this.stats, { boostJumps: this.boostJumpsCount });
      if (evaluation.cleared) {
        this.stats.levelComplete = true;
        this.stats.levelStars = evaluation.stars;
        this.stats.coins += this.currentLevelDef.coinReward;
        this.stats.totalCoinsCollected += this.currentLevelDef.coinReward;
        sounds.playStageClear();
        this.addFloatingText(p.x, p.y + 40, 'STAGE CLEARED! ' + '★ '.repeat(evaluation.stars), '#F59E0B', 30);
        this.addFloatingText(p.x, p.y + 65, `+${this.currentLevelDef.coinReward} LEVEL BONUS!`, '#10B981', 22);
        this.spawnConfettiShower(p.x, p.y + 35);
        saveLevelResult(this.currentLevel, evaluation.stars, this.stats.score);
        this.onLevelCompleted?.(this.currentLevel, evaluation.stars, this.stats.score, this.currentLevelDef.coinReward);
        this.triggerAchievementCheck();
      }
    } else if (!this.isLevelMode) {
      // Endless Mode Dynamic Level Scaling
      const endlessLevel = Math.max(1, Math.floor(1 + this.stats.distanceRun / 120 + this.stats.slapsCount / 5));
      if (endlessLevel > this.currentLevel) {
        this.currentLevel = endlessLevel;
        this.stats.currentLevel = endlessLevel;
        sounds.playLevelUp();
        this.addFloatingText(p.x, p.y + 40, `LEVEL UP! LV. ${endlessLevel}`, '#F59E0B', 28);
        this.spawnConfettiShower(p.x, p.y + 30);
        this.triggerAchievementCheck();
      }
    }

    // Sync stats with UI
    if (this.onStatsUpdate) {
      this.onStatsUpdate(this.stats, this.state);
    }
  }

  /**
   * Automatic animation of opening cinematic slap sequence
   */
  private updateIntroSequence(dtFactor: number): void {
    this.introState.timer += 16.66 * dtFactor;
    const v = this.introState.victim;

    if (this.introState.phase === 'WINDUP') {
      // Automatic animation: After 950ms, unleash the massive blow!
      // Or if the player hits Space or taps, execute immediately!
      if (this.introState.timer >= 950 || this.input.slapRequested || this.input.keys.slap) {
        this.input.slapRequested = false;
        this.input.keys.slap = false;
        this.executeIntroSlap();
      }
    } else if (this.introState.phase === 'SLAP_IMPACT' || this.introState.phase === 'BLAST_OFF') {
      if (v) {
        v.x += v.vx * dtFactor;
        v.y += v.vy * dtFactor;
        v.z += v.vz * dtFactor;
        v.vz -= 0.65 * dtFactor; // gravity pulls him down
        v.rotationX += 0.12 * dtFactor;
        v.rotationY += 0.08 * dtFactor;
        v.rotationZ += 0.15 * dtFactor;
      }

      // Progress the tail-whip swing through the victim.
      if (this.player.isWhipping) {
        this.player.whipProgress += 0.09 * dtFactor;
        if (this.player.whipProgress >= 1) {
          this.player.isWhipping = false;
          this.player.whipProgress = 0;
        }
      }

      // After 1700ms, the victim is blasted away, alarm sounds, and running begins!
      if (this.introState.timer >= 1700) {
        this.introState.active = false;
        this.introState.phase = 'DONE';
        this.stats.introActive = false;
        this.stats.introPhase = 'DONE';

        // No arcade beat during a run: the sequencer is silent so the sound
        // effects — whips, coins, blasts — carry the run on their own.
        sounds.updateBeatChaos(1);

        this.addFloatingText(0, 50, 'RUN FOR YOUR LIFE!', '#EF4444', 28);
        // Six seconds of clear road before the stampede starts hunting you.
        this.graceTimer = 6;
        this.stats.chaserOnScreen = false;
        this.stats.chaserAlertTimer = 0;
        this.addFloatingText(0, 95, 'SAFE START 6s', '#34D399', 18);

        // First touch run: hold the street for one guided dodge before the
        // player is expected to read a two-lane block on their own.
        if (this.tutorialState.pending) {
          this.tutorialState.pending = false;
          this.tutorialState.active = true;
          this.tutorialState.direction = 1;
          this.stats.tutorialActive = true;
          this.stats.tutorialDirection = 1;
          sounds.playTutorialCue();
        }

        if (this.onStatsUpdate) this.onStatsUpdate(this.stats, this.state);
      }
    }
  }

  /**
   * Shared particle, shockwave, and floating text physics update
   */
  private updateParticlesAndTexts(dtFactor: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dtFactor;
      pt.y += pt.vy * dtFactor;
      pt.life -= dtFactor;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += (ft.vy ?? 1.5) * dtFactor;
      ft.life -= dtFactor;
      ft.scale = Math.min(1.2, ft.scale + 0.02 * dtFactor);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.22 * dtFactor;
      sw.life -= dtFactor;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  /**
   * True when a bystander sits inside the whip's reach: alongside the tail or
   * a little ahead of the snout, within the arm-plus-tail radius.
   * `inStrikeRange` and the strike itself both call this, so the cue is exact.
   */
  private isWhipReachable(b: Bystander, backWindow = SLAP_BACK_WINDOW): boolean {
    if (b.slapped) return false;
    const dx = b.x - this.player.x;
    const dy = b.y - this.player.y;
    if (dy < backWindow || dy > SLAP_FRONT_WINDOW) return false;
    return Math.sqrt(dx * dx + dy * dy) <= this.slapReach;
  }

  /** Closest bystander the current whip would connect with, if any. */
  private findWhipTarget(): Bystander | null {
    let target: Bystander | null = null;
    let bestDistance = Infinity;
    for (const b of this.bystanders) {
      if (!this.isWhipReachable(b, SLAP_STRIKE_BACK_WINDOW)) continue;
      const dx = b.x - this.player.x;
      const dy = b.y - this.player.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        target = b;
      }
    }
    return target;
  }

  /**
   * Execute the signature SLAP mechanic
   */
  private executeSlap(): void {
    const p = this.player;
    if (p.slapCooldown > 0) return;

    p.slapCooldown = SLAP_COOLDOWN_FRAMES; // deliberate whip cadence, not a burst
    p.isSlapping = true;
    p.slapProgress = 0;
    this.passiveRunTimer = 0;
    sounds.playSwipe();

    // Detect closest bystander in slap reach
    const hitBystander = this.findWhipTarget();
    if (hitBystander) {
      p.slapHand = hitBystander.x < p.x ? 'left' : 'right';
    }

    if (hitBystander) {
      const b = hitBystander;
      b.slapped = true;
      b.wobble = 1.0;
      this.hitFreezeMs = 15; // Crisp, subtle 15ms impact without jarring stutter!

      // Directional Slap Knockback!
      const side = b.x >= p.x ? 1 : -1;
      b.knockbackVx = side * (160 + Math.random() * 80);

      // Knock off accessories into the air!
      b.flyingAccessory = {
        x: b.x,
        y: b.y + 10,
        vx: side * (3.5 + Math.random() * 4),
        vy: 5 + Math.random() * 3,
        rotation: 0,
      };

      // Play Sound
      sounds.playSlap(this.stats.comboStreak);
      this.renderer.triggerShake(5 + Math.min(8, this.stats.comboStreak));
      this.renderer.triggerHitFreeze(2);

      // Mobile Haptic Feedback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(this.stats.comboStreak >= 4 ? [25, 20, 25] : 18);
        } catch {
          // ignore
        }
      }

      // Add Expanding Cartoon Shockwave
      this.shockwaves.push({
        x: b.x,
        y: b.y,
        radius: 10,
        maxRadius: 55,
        color: this.stats.feverActive ? '#EC4899' : '#F59E0B',
        lineWidth: 3.5,
        life: 14,
        maxLife: 14,
      });

      // Comic popup word in crisp arcade bone-white with amber core
      const comicWord = COMIC_WORDS[Math.floor(Math.random() * COMIC_WORDS.length)];
      this.addFloatingText(b.x, b.y + 30, comicWord, '#FFFDF0', 28);

      // Warm star particles explosion
      this.spawnParticleExplosion(b.x, b.y + 20, '#F59E0B', 12, 'star');

      // Confetti burst on high combo
      if (this.stats.comboStreak >= 5) {
        this.spawnConfettiShower(b.x, b.y + 20);
      }

      // Update Slap Stats & Chaos
      this.stats.slapsCount++;
      this.stats.comboStreak++;
      if (this.stats.comboStreak > this.stats.maxCombo) {
        this.stats.maxCombo = this.stats.comboStreak;
      }

      // REPLENISH STAMINA / HEALTH: enough to keep the loop alive, never enough
      // to erase the fatigue clock on its own. Touch gets the slightly richer
      // +26 slice; keyboard keeps the tuned +22.
      const staminaGain = this.touchInputMode ? STAMINA_PER_WHIP_TOUCH : STAMINA_PER_WHIP;
      p.stamina = Math.min(this.stats.maxStamina, p.stamina + staminaGain);
      this.stats.stamina = Math.round(p.stamina);
      sounds.playStaminaRefill();
      this.addFloatingText(b.x, b.y + 70, `+${staminaGain} STAMINA!`, '#10B981', 20);

      // Slapping also helps you pull away from chasing officer
      if (this.stats.chaserOnScreen) {
        this.stats.chaserAlertTimer = Math.max(0, this.stats.chaserAlertTimer - 1.2);
      }

      this.addChaos(18); // Fills chaos meter
      const slapPoints = b.points * this.stats.chaosMultiplier;
      this.stats.score += slapPoints;
      this.triggerAchievementCheck();

      // Add points floating popup
      this.addFloatingText(b.x, b.y + 52, `+${slapPoints}`, '#F59E0B', 18);

      // Angry shout popup from slapped person!
      const shouts = ['GET BACK HERE!', 'YOU SLAPPED ME!', 'HEY!', 'MY SHIRT!'];
      const shout = shouts[Math.floor(Math.random() * shouts.length)];
      this.addFloatingText(b.x, b.y + 40, shout, '#EF4444', 20);

      // That EXACT slapped bystander turns furious and steps onto the road directly BEHIND the runner!
      const slappedId = b.id;
      const slappedBodyColor = b.bodyColor;
      const slappedShirtColor = b.shirtColor;

      setTimeout(() => {
        if (this.state === 'PLAYING' && this.chasers.length < 6) {
          // Remove the bystander from sidewalk so they don't remain standing there as a duplicate!
          this.bystanders = this.bystanders.filter((item) => item.id !== slappedId);

          // Spawn directly BEHIND the player on the road (not flanking on the side!)
          const chaserSpawnY = this.player.y - (95 + this.chasers.length * 15);
          const chaserSpawnX = this.player.x + (Math.random() * 20 - 10);

          // Add the same person with their exact shirt & skin color as a chaser!
          this.chasers.push({
            id: slappedId,
            x: chaserSpawnX,
            y: chaserSpawnY,
            speed: p.baseSpeed * 0.94,
            bodyColor: slappedBodyColor,
            shirtColor: slappedShirtColor,
            angrySteamTimer: 100,
            runCycle: 0,
            animOffset: Math.random() * 5,
          });
        }
      }, 240);
    } else {
      // Whiffed the whip: short recovery and clear feedback so the reach is learnable.
      this.addFloatingText(p.x, p.y + 45, 'WHIFF!', '#94A3B8', 16);
    }
  }

  /**
   * Increase Chaos Meter and update multiplier
   */
  private addChaos(amount: number): void {
    const prevMult = this.stats.chaosMultiplier;
    this.stats.chaosLevel = Math.min(100, this.stats.chaosLevel + amount);

    if (this.stats.chaosLevel >= 100 && !this.stats.feverActive) {
      // TRIGGER FEVER RUN!
      this.player.feverTime = 5500; // 5.5 seconds of pure invincibility and double points
      sounds.playFeverStart();
      this.renderer.triggerShake(8);
      this.addFloatingText(this.player.x, this.player.y + 35, 'FEVER RUN!', '#EC4899', 32);
      this.spawnParticleExplosion(this.player.x, this.player.y, '#F43F5E', 20, 'star');
    }

    this.updateChaosMultiplier();

    if (this.stats.chaosMultiplier > prevMult) {
      sounds.playChaosAlarm();
      sounds.updateBeatChaos(this.stats.chaosMultiplier);
      this.addFloatingText(
        this.player.x,
        this.player.y + 25,
        `${this.stats.chaosMultiplier}x MULTIPLIER!`,
        '#F59E0B',
        24
      );
    }
  }

  private updateChaosMultiplier(): void {
    const level = this.stats.chaosLevel;
    if (this.stats.feverActive) {
      this.stats.chaosMultiplier = 16;
    } else if (level >= 75) {
      this.stats.chaosMultiplier = 8;
    } else if (level >= 50) {
      this.stats.chaosMultiplier = 4;
    } else if (level >= 25) {
      this.stats.chaosMultiplier = 2;
    } else {
      this.stats.chaosMultiplier = 1;
    }
  }

  /**
   * Balanced 3-Lane Procedural Market Segment Generator
   * - 3 lanes: [-90, 0, 90] (Left: -90, Center: 0, Right: 90)
   * - Obstacles in 1 or 2 lanes, ALWAYS leaving at least 1 open escape route
   * - Left & right paths have more obstacles to balance proximity to slap targets
   * - Coins spawn squarely in open escape lanes
   * - Zero yellow obstacles (banana peel completely removed)
   */
  private spawnMarketSegment(targetY: number): void {
    const lanes = this.roadLanes; // [-90, 0, 90], wider on touch
    const dist = this.stats.distanceRun;

    // 1. Spawn Bystanders along left and right sidewalk platforms
    // (Desktop: ±155, just outside the ±140 curb. On touch the street is
    // ~12% wider, so the sidewalk — and these walkers — move out with it.)
    const numBystanders = Math.random() > 0.35 ? 2 : 1;
    for (let i = 0; i < numBystanders; i++) {
      const walking = Math.random() < 0.55;
      const template = BYSTANDER_TEMPLATES[Math.floor(Math.random() * BYSTANDER_TEMPLATES.length)];
      const side = (i === 0 ? (Math.random() > 0.5 ? 1 : -1) : (Math.random() > 0.5 ? -1 : 1));
      const bx = side * (this.roadWidth / 2 + 15 + Math.random() * 8);
      const by = targetY + (Math.random() * 50 - 25);

      this.bystanders.push({
        id: this.entityIdCounter++,
        x: bx,
        y: by,
        type: template.type,
        name: template.name,
        points: template.points,
        bodyColor: template.bodyColor,
        shirtColor: template.shirtColor,
        accessory: template.accessory,
        slapped: false,
        wobble: 0,
        // Roughly half the crowd actually walks the sidewalk: a human pace,
        // either with the traffic or toward the runner, with a per-person phase.
        walking: walking,
        walkSpeed: walking ? (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.45) : 0,
        walkPhase: Math.random() * Math.PI * 2,
      });
    }

    // 2. Balanced obstacle spawning with a clear opening.
    // - Desktop: 55% / 65% / 75% obstacle segments.
    // - Touch: 42% / 52% / 62%, mostly single-lane, because a swipe needs more
    //   reaction room between obstacle decisions than a keypress does.
    // See obstacleDensity.ts for the full table.
    // Either way a segment occupies at most 2 of 3 lanes. The open lane is
    // chosen next to the previous segment's open lane, so the escape route is
    // always reachable; a path that exists only on paper is not a path.
    const spawnDecision = resolveObstacleSpawn(dist, this.touchInputMode);
    const corridor = resolveCorridorSpawn(this.lastFreeLaneIndex, spawnDecision.laneCount);
    if (spawnDecision.isObstacleSegment) {
      this.lastFreeLaneIndex = corridor.freeLane;
    }

    const chosenLanes: number[] = corridor.occupiedLanes.map((index) => lanes[index]);
    const occupiedLanes = new Set<number>(chosenLanes);

    // Dynamic Level & Biome Specific Obstacles
    const levelObstacleInfo = getObstaclesForLevel(this.currentLevel, this.currentMap.id);
    // Ramps are boost pads, not blockers: they are spawned in the open lane
    // below instead of being picked as an obstacle you are forced into.
    const obstacleTypes: ObstacleType[] = levelObstacleInfo.obstacles.filter(
      (type) => !isRampType(type)
    );

    for (let i = 0; i < chosenLanes.length; i++) {
      const ox = chosenLanes[i];
      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)] ?? 'barrier';
      const oy = targetY + 40 + i * 28;

      let width = 46;
      let height = 34;
      if (
        type === 'shifting_block' ||
        type === 'barrier' ||
        type === 'firewall' ||
        type === 'canyon_mesa' ||
        type === 'holo_barrier' ||
        type === 'zen_barrier' ||
        type === 'torii_gate'
      ) {
        width = 54;
        height = 36;
      } else if (type === 'ramp' || type === 'terminal_ramp') {
        width = 46;
        height = 30;
      } else if (type === 'cart' || type === 'cherry_wagon' || type === 'timber_sled') {
        width = 52;
        height = 34;
      } else if (type === 'surf_rack' || type === 'beach_lounger' || type === 'cactus_cluster' || type === 'dino_skull') {
        width = 48;
        height = 36;
      } else if (type === 'tiki_totem' || type === 'stone_lantern' || type === 'cyber_server' || type === 'drone_hazard') {
        width = 44;
        height = 38;
      } else if (type === 'ice_spikes' || type === 'snow_bale') {
        width = 48;
        height = 34;
      } else if (type === 'cafe_table' || type === 'watermelon' || type === 'coconut_crate') {
        width = 46;
        height = 32;
      } else if (type === 'spikes') {
        width = 42;
        height = 28;
      }

      const isShifting = type === 'shifting_block';
      const initialVx = isShifting
        ? (Math.random() > 0.5 ? 1 : -1) * (1.6 + Math.random() * 0.6)
        : 0;

      const spawned: Obstacle = {
        id: this.entityIdCounter++,
        x: ox,
        y: oy,
        type,
        width,
        height,
        hit: false,
        rollSpeed: (type === 'barrel' || type === 'loop_boulder') ? 1.5 + Math.random() * 0.3 : 0,
        vx: initialVx,
        isShifting,
        // Sweeps the whole street: ±100 on the 280-wide road, ±112 on the
        // wider touch road so it still reaches the outer lanes at ±101.
        shiftMinX: -100 * (this.roadWidth / ROAD_WIDTH),
        shiftMaxX: 100 * (this.roadWidth / ROAD_WIDTH),
      };
      this.obstacles.push(spawned);
    }

    // 3. A ramp in the open lane is an optional boost, never a forced launch.
    if (spawnDecision.isObstacleSegment && obstacleTypes.length > 0 && Math.random() > 0.72) {
      this.obstacles.push({
        id: this.entityIdCounter++,
        x: lanes[corridor.freeLane],
        y: targetY + 130,
        type: Math.random() > 0.55 ? 'terminal_ramp' : 'ramp',
        width: 46,
        height: 30,
        hit: false,
        rollSpeed: 0,
        vx: 0,
        isShifting: false,
        shiftMinX: -100 * (this.roadWidth / ROAD_WIDTH),
        shiftMaxX: 100 * (this.roadWidth / ROAD_WIDTH),
      });
    }

    // 4. Coins live in exactly one lane of the three, so the other two lanes stay
    // purely about survival and a run cannot bank a full wallet by drifting.
    const openLanes = lanes.filter((l) => !occupiedLanes.has(l));
    const coinLane = openLanes.length > 0
      ? openLanes[Math.floor(Math.random() * openLanes.length)]
      : lanes[Math.floor(Math.random() * lanes.length)];
    // Far fewer coins than before: two on a blocked row, one on an open
    // stretch, so a skin still takes a few runs to afford.
    const coinCount = spawnDecision.isObstacleSegment ? 2 : 1;
    for (let c = 0; c < coinCount; c++) {
      this.coins.push({
        id: this.entityIdCounter++,
        x: coinLane,
        y: targetY - 10 + c * 34,
        collected: false,
        bobPhase: c * 0.4,
      });
    }

    // 5. Occasional Powerup (Soda / Soap)
    if (Math.random() > 0.82) {
      const puType = Math.random() > 0.5 ? 'soda' : 'soap';
      const puLane = openLanes.length > 0 ? openLanes[0] : lanes[1];
      this.powerups.push({
        id: this.entityIdCounter++,
        x: puLane,
        y: targetY + 110,
        type: puType,
        collected: false,
        bobPhase: 0,
      });
    }

    // 6. Flame pickup: first one after 45 seconds of running, then one every 60
    // seconds. It sits in an open lane, slightly past the row so it reads as a
    // prize, not a trap, and is collected the same way coins are: run into it.
    if (this.runTimeSeconds >= this.nextFireAt) {
      const fireLane =
        openLanes.length > 0 ? openLanes[Math.floor(Math.random() * openLanes.length)] : lanes[1];
      this.powerups.push({
        id: this.entityIdCounter++,
        x: fireLane,
        y: targetY + 120,
        type: 'fire',
        collected: false,
        bobPhase: 0,
      });
      this.nextFireAt += FIRE_SPAWN_INTERVAL_SECONDS;
    }
  }

  /**
   * Flame Mode's answer to a prop: the dino breathes it out and the prop burns
   * down where it stands. Deliberately no launch velocities — being kicked
   * away read as a hit, being set alight reads as fire.
   */
  private igniteObstacle(obs: Obstacle, line: string): void {
    obs.hit = true;
    obs.burning = true;
    obs.burnTime = BURN_MS;
    obs.burnProgress = 0;

    sounds.playFireBlast();
    this.renderer.triggerShake(6);
    this.stats.score += 120 * this.stats.chaosMultiplier;

    this.fireBreath = {
      active: true,
      timeLeft: FIRE_BREATH_MS / 1000,
      targetX: obs.x,
      targetY: obs.y,
    };

    // Embers at the mouth, so the rendered jet has a visible origin.
    this.spawnParticleExplosion(this.player.x, this.player.y + 14, '#F97316', 6, 'star');
    this.addFloatingText(obs.x, obs.y, line, '#F97316', 24);
  }

  private spawnParticleExplosion(
    x: number,
    y: number,
    color: string,
    count: number = 8,
    shape: 'star' | 'circle' | 'cloud' | 'sparkle' = 'star'
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 3 + Math.random() * 5,
        life: 20 + Math.random() * 15,
        maxLife: 35,
        shape,
      });
    }
  }

  private addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    size: number
  ): void {
    this.floatingTexts.push({
      id: this.entityIdCounter++,
      x,
      y,
      text,
      color,
      size,
      life: 30,
      maxLife: 30,
      scale: 0.6,
      vy: 1.5,
    });
  }

  private triggerGameOver(reason: 'BUSTED' | 'EXHAUSTED' | 'COLLISION' = 'BUSTED'): void {
    this.state = 'GAMEOVER';
    this.stats.gameOverReason = reason;
    this.stats.tutorialActive = false;
    this.stats.fireActive = false;
    if (this.player) this.player.fireTime = 0;
    sounds.stopArcadeBeat();
    sounds.playBusted();
    this.renderer.triggerShake(12);

    // Spawn massive dust cloud dogpile!
    this.spawnParticleExplosion(this.player.x, this.player.y, '#E2E8F0', 25, 'cloud');
    this.saveHighScore();
    this.stats.isNewPersonalBest = this.stats.score > this.previousHighScore;

    if (this.onStatsUpdate) {
      this.onStatsUpdate(this.stats, this.state);
    }
  }

  private spawnConfettiShower(x: number, y: number): void {
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#A855F7'];
    for (let i = 0; i < 20; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        shape: 'confetti',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2,
      });
    }
  }

  private render(): void {
    // Calculate distance to closest chaser
    let mobDistance = 999;
    if (this.chasers.length > 0) {
      for (const c of this.chasers) {
        const d = this.player.y - c.y;
        if (d < mobDistance) mobDistance = d;
      }
    }

    this.renderer.render(
      this.player,
      this.bystanders,
      this.chasers,
      this.obstacles,
      this.coins,
      this.powerups,
      this.particles,
      this.floatingTexts,
      this.shockwaves,
      this.stats.chaosMultiplier,
      this.stats.feverActive,
      mobDistance,
      this.introState.victim,
      this.introState.active,
      this.introState.phase,
      this.fireBreath
    );
  }

  public destroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    sounds.stopArcadeBeat();
    this.renderer.destroy();
  }
}
