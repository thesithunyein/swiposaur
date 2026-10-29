/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine.ts';
import { GameState, GameStats, CharacterSkin, LeaderboardEntry } from './game/types.ts';
import { CHARACTER_SKINS } from './game/constants.ts';
import { sounds } from './game/SoundEngine.ts';
import { HUD } from './components/HUD.tsx';
import { TouchControls } from './components/TouchControls.tsx';
import { StartScreen, PACE_MODES, PaceMode } from './components/StartScreen.tsx';
import { GameOverModal } from './components/GameOverModal.tsx';
import { LeaderboardModal } from './components/LeaderboardModal.tsx';
import { GuideModal } from './components/GuideModal.tsx';
import { LevelSelectModal } from './components/LevelSelectModal.tsx';
import { MapSelectModal } from './components/MapSelectModal.tsx';
import { AchievementsModal } from './components/AchievementsModal.tsx';
import { AchievementToast } from './components/AchievementToast.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { SkinsModal } from './components/SkinsModal.tsx';
import { DailyRewardsModal } from './components/DailyRewardsModal.tsx';
import { DailyMissionsModal } from './components/DailyMissionsModal.tsx';
import { BootScreen } from './components/BootScreen.tsx';
import { useBootSequence } from './game/useBootSequence.ts';
import { isDailyRewardAvailable } from './game/dailyRewards.ts';
import {
  getMissionSummaries,
  getUnclaimedMissionsCount,
  pickClosestMission,
  updateMissionsOnRun,
  type MissionSummary,
} from './game/dailyMissions.ts';
import {
  consumeStaminaBoost,
  grantStaminaBoost,
  retryBoostRemainingMs,
  useRetryBoost as claimRetryBoost,
} from './game/runBoosts.ts';
import { formatCountdown } from './game/clock.ts';
import { loadLevelProgress, LevelProgress, getMapForLevel } from './game/levels.ts';
import { GAME_MAPS, MapDefinition, getMapById } from './game/maps.ts';
import { Achievement, loadAchievementStorage, ACHIEVEMENTS_LIST } from './game/achievements.ts';
import { loadSettings, saveSettings, GameSettings } from './game/settings.ts';
import { setLanguage, t, useLanguage } from './game/i18n.ts';
import { trackGameEvent } from './game/analytics.ts';
import type { ValidRun } from './game/leaderboardCore.ts';
import {
  clearLocalLeaderboard,
  createRunId,
  fetchOnlineBoard,
  getPlayerId,
  isLeaderboardApiConfigured,
  loadLocalBoard,
  loadPlayerName,
  markPlayerEntry,
  saveLocalRun,
  submitOnlineRun,
  type LeaderboardMode,
} from './game/leaderboard.ts';
import { Play, Settings as SettingsIcon, ArrowRight } from 'lucide-react';

/**
 * Leaderboard modes:
 * - local: on-device Hall of Fame, always available, labelled as such.
 * - online: only when the build opts in AND /api/leaderboard reports durable
 *   storage. A configured-but-broken endpoint degrades to local, never to a
 *   fake "live" global board.
 */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const boot = useBootSequence();

  const [gameState, setGameState] = useState<GameState>('MENU');
  const [selectedSkin, setSelectedSkin] = useState<CharacterSkin>(() => {
    try {
      const savedSkinId = localStorage.getItem('slap_run_selected_skin');
      if (savedSkinId) {
        const found = CHARACTER_SKINS.find((s) => s.id === savedSkinId);
        if (found) return found;
      }
    } catch {}
    return CHARACTER_SKINS[0];
  });
  const [selectedPace, setSelectedPace] = useState<PaceMode>(PACE_MODES[0]); // Default: NORMAL (1.0X)
  const [isMuted, setIsMuted] = useState<boolean>(sounds.getMuted());
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [hurtFlash, setHurtFlash] = useState<boolean>(false);
  // Daily Rewards & Missions
  const [isDailyRewardsOpen, setIsDailyRewardsOpen] = useState<boolean>(false);
  const [isDailyMissionsOpen, setIsDailyMissionsOpen] = useState<boolean>(false);
  const [isDailyAvailable, setIsDailyAvailable] = useState<boolean>(() => isDailyRewardAvailable());
  const [unclaimedMissions, setUnclaimedMissions] = useState<number>(() => getUnclaimedMissionsCount());
  const [dailyMissions, setDailyMissions] = useState<MissionSummary[]>(() => getMissionSummaries());
  const [retryBoostMs, setRetryBoostMs] = useState<number>(() => retryBoostRemainingMs());

  // The menu can sit open across midnight, so refresh the daily state while it
  // is visible instead of trusting whatever was loaded at mount.
  useEffect(() => {
    if (gameState !== 'MENU') return;
    const refresh = () => {
      setDailyMissions(getMissionSummaries());
      setUnclaimedMissions(getUnclaimedMissionsCount());
      setIsDailyAvailable(isDailyRewardAvailable());
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [gameState]);

  // Keep the retry-boost cooldown label honest while the results card is open.
  useEffect(() => {
    if (gameState !== 'GAMEOVER') return;
    setRetryBoostMs(retryBoostRemainingMs());
    const timer = window.setInterval(() => setRetryBoostMs(retryBoostRemainingMs()), 30_000);
    return () => window.clearInterval(timer);
  }, [gameState]);

  // Levels, Maps, and Achievements State
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState<boolean>(false);
  const [isMapSelectOpen, setIsMapSelectOpen] = useState<boolean>(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isSkinsOpen, setIsSkinsOpen] = useState<boolean>(false);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  // Subscribing re-renders the shell (pause overlay, tutorial, intro prompt) on switch.
  useLanguage();

  useEffect(() => {
    setLanguage(settings.language);
  }, [settings.language]);
  const [activeToastAchievement, setActiveToastAchievement] = useState<Achievement | null>(null);

  const [levelProgress, setLevelProgress] = useState<LevelProgress>(() => loadLevelProgress());
  const [currentLevel, setCurrentLevel] = useState<number>(() => levelProgress.unlockedLevel || 1);
  const [isLevelMode, setIsLevelMode] = useState<boolean>(true);
  const [currentMap, setCurrentMap] = useState<MapDefinition>(() => getMapById(getMapForLevel(levelProgress.unlockedLevel || 1)));

  // Persistent Unlocked Skins
  const [unlockedSkinIds, setUnlockedSkinIds] = useState<string[]>(() => {
    const levelUnlocked = CHARACTER_SKINS
      .filter((skin) => skin.unlockLevel !== undefined && skin.unlockLevel <= levelProgress.unlockedLevel)
      .map((skin) => skin.id);
    try {
      const saved = localStorage.getItem('slap_run_unlocked_skins');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return [...new Set(['rex_red', ...parsed, ...levelUnlocked])];
        }
      }
    } catch {}
    return [...new Set(['rex_red', 'spino_blue', ...levelUnlocked])];
  });

  useEffect(() => {
    const levelUnlocked = CHARACTER_SKINS
      .filter((skin) => skin.unlockLevel !== undefined && skin.unlockLevel <= levelProgress.unlockedLevel)
      .map((skin) => skin.id);
    setUnlockedSkinIds((current) => {
      const merged = [...new Set([...current, ...levelUnlocked])];
      if (merged.length !== current.length) {
        try {
          localStorage.setItem('slap_run_unlocked_skins', JSON.stringify(merged));
        } catch {}
      }
      return merged;
    });
  }, [levelProgress.unlockedLevel]);

  // On-device Hall of Fame plus the optional online board. Real runs only: no
  // seeded demo competitors and no fake participant totals.
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>(() => loadLocalBoard());
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('local');

  // Refs keep the Run callbacks stable so the GameEngine is never rebuilt when
  // leaderboard rows or score-submission callbacks change.
  const leaderboardModeRef = useRef<LeaderboardMode>('local');
  const selectedSkinRef = useRef<CharacterSkin>(selectedSkin);
  const currentRunIdRef = useRef<string | null>(null);
  const lastRunRef = useRef<ValidRun | null>(null);

  useEffect(() => {
    leaderboardModeRef.current = leaderboardMode;
  }, [leaderboardMode]);

  useEffect(() => {
    selectedSkinRef.current = selectedSkin;
  }, [selectedSkin]);

  const [stats, setStats] = useState<GameStats>(() => {
    let savedHigh = 0;
    let savedCoins = 0;
    try {
      const h = localStorage.getItem('slap_run_highscore');
      if (h) savedHigh = parseInt(h, 10) || 0;
      const c = localStorage.getItem('slap_run_total_coins');
      if (c) savedCoins = parseInt(c, 10) || 0;
    } catch {}
    return {
      score: 0,
      highScore: savedHigh,
      coins: 0,
      totalCoinsCollected: savedCoins,
      slapsCount: 0,
      chaosLevel: 0,
      chaosMultiplier: 1,
      feverActive: false,
      distanceRun: 0,
      comboStreak: 0,
      maxCombo: 0,
      longestChaseEscape: 0,
      stamina: 100,
      maxStamina: 100,
      chaserOnScreen: false,
      chaserAlertTimer: 0,
      mobDistance: 180,
      currentLevel: levelProgress.unlockedLevel || 1,
      isLevelMode: true,
      currentMapId: 'market',
      boostJumpsCount: 0,
      nearMissesCount: 0,
      escapedCount: 0,
    };
  });

  // Calculate total stars earned
  let totalStars = 0;
  Object.values(levelProgress.levelStars).forEach((s) => {
    totalStars += s;
  });

  // Calculate claimable achievements count for UI notification
  const achievementStore = loadAchievementStorage();
  let claimableAchievementsCount = 0;
  ACHIEVEMENTS_LIST.forEach((a) => {
    if (achievementStore[a.id]) {
      claimableAchievementsCount++;
    }
  });

  // Every device gets a stable id and a board name on the first visit, so the
  // global board can show a real player without asking them to sign up.
  useEffect(() => {
    getPlayerId();
    loadPlayerName();
  }, []);

  // Boot stage 1: hold the loading screen until the display faces are usable, so
  // the menu never flashes a fallback face first.
  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) boot.complete('typeface');
    };
    const guard = window.setTimeout(finish, 3000);

    (async () => {
      try {
        if (typeof document !== 'undefined' && document.fonts) {
          await Promise.all([
            document.fonts.load('400 16px "Lilita One"'),
            document.fonts.load('400 16px "Fredoka"'),
          ]);
          await document.fonts.ready;
        }
      } catch {}
      finish();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(guard);
    };
  }, [boot.complete]);

  // Probe the optional endpoint once. Only a durable, healthy response turns the
  // board into an online board; anything else stays a local Hall of Fame.
  useEffect(() => {
    if (!isLeaderboardApiConfigured()) {
      boot.complete('progress');
      return;
    }
    let cancelled = false;
    fetchOnlineBoard()
      .then((result) => {
        if (cancelled || !result.online) return;
        leaderboardModeRef.current = 'online';
        setLeaderboardMode('online');
        setLeaderboardEntries(markPlayerEntry(result.entries, getPlayerId()));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) boot.complete('progress');
      });
    return () => {
      cancelled = true;
    };
  }, [boot.complete]);

  /** Reloads the global board after a rename, so the name shows immediately. */
  const refreshOnlineBoard = useCallback(() => {
    if (leaderboardModeRef.current !== 'online') return;
    void fetchOnlineBoard().then((result) => {
      if (!result.online) return;
      setLeaderboardEntries(markPlayerEntry(result.entries, getPlayerId()));
    });
  }, []);

  /**
   * Saves the run locally first, then — only in online mode — submits it.
   * Stable by design: it reads refs instead of state, so leaderboard updates
   * never change this function's identity and never rebuild the engine.
   */
  const submitScoreToLeaderboard = useCallback((run: ValidRun) => {
    lastRunRef.current = run;
    const mode = leaderboardModeRef.current;
    const local = saveLocalRun(run);

    if (mode === 'local') {
      setLeaderboardEntries(local.entries);
      setStats((curr) => ({
        ...curr,
        leaderboardMode: 'local',
        leaderboardStatus: 'local',
        localRank: local.rank > 0 ? local.rank : undefined,
        globalRank: undefined,
        globalRankConfirmed: false,
        globalRankPending: false,
        nextPlayerAbove: null,
        leaderboardError: false,
      }));
      return;
    }

    setStats((curr) => ({
      ...curr,
      leaderboardMode: 'online',
      leaderboardStatus: 'pending',
      localRank: local.rank > 0 ? local.rank : undefined,
      globalRank: undefined,
      globalRankConfirmed: false,
      globalRankPending: true,
      nextPlayerAbove: null,
      leaderboardError: false,
    }));

    void submitOnlineRun(run).then((result) => {
      const stillCurrentRun = currentRunIdRef.current === run.runId;
      if (!result.ok) {
        if (!stillCurrentRun) return;
        setStats((curr) => ({
          ...curr,
          leaderboardStatus: 'failed',
          globalRank: undefined,
          globalRankConfirmed: false,
          globalRankPending: false,
          leaderboardError: true,
        }));
        return;
      }

      // A late response for a run the player already restarted must not update
      // the current card or overwrite which row is marked as YOU.
      if (!stillCurrentRun) return;
      setLeaderboardEntries(markPlayerEntry(result.entries, run.playerId));
      setStats((curr) => ({
        ...curr,
        leaderboardStatus: 'submitted',
        globalRank: result.rank,
        globalRankConfirmed: true,
        globalRankPending: false,
        leaderboardError: false,
      }));
    });
  }, []);

  // Handle stats updates from GameEngine. Stable: no leaderboard state in its
  // closure, so React never tears the engine down mid-session.
  const handleStatsUpdate = useCallback(
    (newStats: GameStats, newState: GameState) => {
      setStats((curr) => {
        if (newState === 'GAMEOVER') {
          // A finished run starts with no rank of any kind until its submission resolves.
          return {
            ...newStats,
            leaderboardMode: curr.leaderboardMode,
            leaderboardStatus: undefined,
            localRank: undefined,
            globalRank: undefined,
            globalRankConfirmed: false,
            globalRankPending: false,
            nextPlayerAbove: null,
            leaderboardError: false,
          };
        }
        return {
          ...newStats,
          leaderboardMode: curr.leaderboardMode,
          leaderboardStatus: curr.leaderboardStatus,
          localRank: curr.localRank,
          globalRank: curr.globalRank,
          globalRankPending: curr.globalRankPending,
          globalRankConfirmed: curr.globalRankConfirmed,
          nextPlayerAbove: curr.nextPlayerAbove,
          leaderboardError: curr.leaderboardError,
        };
      });
      setGameState(newState);

      // If transitioned to GAMEOVER
      if (newState === 'GAMEOVER') {
        trackGameEvent('game_over', {
          reason: newStats.gameOverReason,
          score: newStats.score,
          slaps: newStats.slapsCount,
          combo: newStats.maxCombo,
        });

        const { completed: completedMissions } = updateMissionsOnRun(newStats);
        setDailyMissions(getMissionSummaries());
        if (completedMissions.length > 0) {
          const first = completedMissions[0];
          setUnclaimedMissions(getUnclaimedMissionsCount());
          sounds.playAchievement();
          setActiveToastAchievement({
            id: first.id,
            title: t('Mission: {title}', { title: t(first.title) }),
            description:
              completedMissions.length > 1
                ? t('{count} missions ready — claim +{coins} Coins and more!', {
                    count: completedMissions.length,
                    coins: first.rewardCoins,
                  })
                : t('Claim +{coins} Coins and +{stamina} stamina!', {
                    coins: first.rewardCoins,
                    stamina: first.bonusStamina,
                  }),
            icon: 'target',
            category: 'slap',
            unlocked: true,
            rewardCoins: first.rewardCoins,
          });
        }

        if (newStats.score > 0) {
          // One runId per run, created when the run ends. Retries reuse it, so a
          // failed submission can never add a second row.
          const runId = currentRunIdRef.current ?? createRunId();
          currentRunIdRef.current = runId;
          submitScoreToLeaderboard({
            playerId: getPlayerId(),
            runId,
            name: loadPlayerName(),
            score: newStats.score,
            maxCombo: Math.max(0, Math.round(newStats.maxCombo)),
            skinId: selectedSkinRef.current.id,
            durationMs: Math.max(0, Math.round(newStats.durationMs ?? 0)),
          });
        }
      }
    },
    [submitScoreToLeaderboard]
  );

  const handleRetryLeaderboard = useCallback(() => {
    const run = lastRunRef.current;
    if (run && run.score > 0) {
      submitScoreToLeaderboard(run);
    }
  }, [submitScoreToLeaderboard]);

  const handleHurtFlash = useCallback(() => {
    setHurtFlash(true);
    setTimeout(() => setHurtFlash(false), 240);
  }, []);

  // Initialize GameEngine
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const engine = new GameEngine(canvasRef.current, handleStatsUpdate, handleHurtFlash);
    engineRef.current = engine;
    engine.paceMultiplier = selectedPace.multiplier;
    engine.setSkin(selectedSkin);
    const initialMap = isLevelMode ? getMapById(getMapForLevel(currentLevel)) : currentMap;
    engine.setMap(initialMap);

    // Connect Achievement Toast Hook
    engine.onAchievementUnlocked = (ach: Achievement) => {
      setActiveToastAchievement(ach);
      setTimeout(() => {
        setActiveToastAchievement((curr) => (curr?.id === ach.id ? null : curr));
      }, 4500);
    };

    // Connect Level Completed Hook
    engine.onLevelCompleted = (_lvl, _stars, _score, _coins) => {
      trackGameEvent('stage_clear');
      const refreshed = loadLevelProgress();
      setLevelProgress(refreshed);
    };

    const handleResize = () => {
      if (!containerRef.current || !engineRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      engineRef.current.resize(width, height, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Boot stage 2: the arena is genuinely up once it has painted a frame.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => boot.complete('arena'));
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      engine.destroy();
    };
  }, [handleStatsUpdate, handleHurtFlash, boot.complete]);

  // Keep engine settings in sync with user preferences
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.applySettings(settings);
    }
  }, [settings]);

  // Fullscreen toggle helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;

      // Global Shortcuts
      if (e.code === 'KeyM') {
        handleToggleMute();
        return;
      }
      if (e.code === 'KeyH' || e.key === '?') {
        setShowGuide((prev) => !prev);
        return;
      }
      if (e.code === 'KeyF') {
        toggleFullscreen();
        return;
      }
      if (e.code === 'KeyL') {
        setIsLevelSelectOpen((prev) => !prev);
        return;
      }

      // Title Screen Shortcuts
      if (gameState === 'MENU') {
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          sounds.playClick();
          setSelectedPace(PACE_MODES[0]);
          if (engine) engine.paceMultiplier = PACE_MODES[0].multiplier;
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          sounds.playClick();
          setSelectedPace(PACE_MODES[1]);
          if (engine) engine.paceMultiplier = PACE_MODES[1].multiplier;
          return;
        }
        if (e.code === 'Digit3' || e.code === 'Numpad3') {
          sounds.playClick();
          setSelectedPace(PACE_MODES[2]);
          if (engine) engine.paceMultiplier = PACE_MODES[2].multiplier;
          return;
        }
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleStartGame();
          return;
        }
      }

      // Game Over Shortcuts: R to restart
      if (gameState === 'GAMEOVER') {
        if (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleRestart();
          return;
        }
      }

      if (!engine) return;

      // In-game 3-lane steering, jumping & slapping
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        engine.input.keys.left = true;
        engine.changeLane(-1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        engine.input.keys.right = true;
        engine.changeLane(1);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        engine.requestJump();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (engine.introState.active) {
          engine.triggerIntroSlapNow();
        } else {
          engine.requestSlap();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (engine.state === 'PLAYING') {
          engine.pauseGame();
        } else if (engine.state === 'PAUSED') {
          engine.resumeGame();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        engine.input.keys.left = false;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        engine.input.keys.right = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, selectedPace]);

  const handleStartGame = () => {
    currentRunIdRef.current = null;
    lastRunRef.current = null;
    if (engineRef.current) {
      engineRef.current.paceMultiplier = selectedPace.multiplier;
      engineRef.current.setSkin(selectedSkin);
      if (isLevelMode) {
        engineRef.current.setLevel(currentLevel, true);
      } else {
        engineRef.current.isLevelMode = false;
        engineRef.current.setMap(currentMap);
      }
      engineRef.current.staminaBonus = consumeStaminaBoost();
      engineRef.current.startGame();
    }
  };

  const handleToggleMode = useCallback((levelMode: boolean) => {
    setIsLevelMode(levelMode);
    if (levelMode) {
      const stageMap = getMapById(getMapForLevel(currentLevel));
      setCurrentMap(stageMap);
      if (engineRef.current) {
        engineRef.current.isLevelMode = true;
        engineRef.current.setLevel(currentLevel, true);
      }
    } else {
      if (engineRef.current) {
        engineRef.current.isLevelMode = false;
        engineRef.current.setMap(currentMap);
      }
    }
  }, [currentLevel, currentMap]);

  const handleSelectLevel = (levelNumber: number) => {
    currentRunIdRef.current = null;
    lastRunRef.current = null;
    setCurrentLevel(levelNumber);
    setIsLevelMode(true);
    const targetMap = getMapById(getMapForLevel(levelNumber));
    setCurrentMap(targetMap);
    setIsLevelSelectOpen(false);
    if (engineRef.current) {
      engineRef.current.paceMultiplier = selectedPace.multiplier;
      engineRef.current.setSkin(selectedSkin);
      engineRef.current.setLevel(levelNumber, true);
      engineRef.current.staminaBonus = consumeStaminaBoost();
      engineRef.current.startGame();
    }
  };

  const handleSelectMap = (map: MapDefinition) => {
    setCurrentMap(map);
    setIsMapSelectOpen(false);
    setIsLevelMode(false);
    if (engineRef.current) {
      engineRef.current.isLevelMode = false;
      engineRef.current.setMap(map);
    }
  };

  const handleRestart = () => {
    currentRunIdRef.current = null;
    lastRunRef.current = null;
    if (engineRef.current) {
      engineRef.current.paceMultiplier = selectedPace.multiplier;
      if (isLevelMode) {
        // If current level was cleared, advance to next stage!
        const nextLvl = stats.levelComplete ? currentLevel + 1 : currentLevel;
        setCurrentLevel(nextLvl);
        engineRef.current.setLevel(nextLvl, true);
      } else {
        engineRef.current.isLevelMode = false;
        engineRef.current.setMap(currentMap);
      }
      engineRef.current.staminaBonus = consumeStaminaBoost();
      engineRef.current.restartGame();
    }
  };

  /**
   * One-shot comeback boost. Claiming starts the cooldown before the run begins,
   * so a double tap cannot hand out two free runs.
   */
  const handleRetryWithBoost = () => {
    const result = claimRetryBoost();
    setRetryBoostMs(result.remainingMs);
    if (!result.granted) return;
    sounds.playStart();
    handleRestart();
  };

  const handleHome = () => {
    if (engineRef.current) {
      engineRef.current.resetToMenu();
      const activeMap = isLevelMode ? getMapById(getMapForLevel(currentLevel)) : currentMap;
      engineRef.current.setMap(activeMap);
      setGameState('MENU');
      setLevelProgress(loadLevelProgress());
      setDailyMissions(getMissionSummaries());
      setUnclaimedMissions(getUnclaimedMissionsCount());
    }
  };

  const handleToggleMute = () => {
    const newMuted = sounds.toggleMute();
    setIsMuted(newMuted);
    setSettings((prev) => {
      const up = { ...prev, isMuted: newMuted };
      saveSettings(up);
      return up;
    });
  };

  const handleResetProgress = () => {
    try {
      localStorage.removeItem('slap_run_level_progress');
      localStorage.removeItem('slap_run_highscore');
      localStorage.removeItem('slap_run_total_coins');
      localStorage.removeItem('slap_run_unlocked_skins');
      localStorage.removeItem('slap_run_achievements');
    } catch {}
    clearLocalLeaderboard();
    setLeaderboardEntries([]);

    setLevelProgress({ unlockedLevel: 1, levelStars: {}, levelScores: {} });
    setUnlockedSkinIds(['rex_red', 'spino_blue']);
    setSelectedSkin(CHARACTER_SKINS[0]);
    if (engineRef.current) {
      engineRef.current.setSkin(CHARACTER_SKINS[0]);
      engineRef.current.setLevel(1);
    }
    setStats((prev) => ({
      ...prev,
      score: 0,
      highScore: 0,
      coins: 0,
      totalCoinsCollected: 0,
      currentLevel: 1,
      chaosLevel: 0,
      distanceRun: 0,
      comboStreak: 0,
    }));
  };

  const handleTogglePause = () => {
    if (engineRef.current) {
      if (gameState === 'PLAYING') {
        engineRef.current.pauseGame();
      } else if (gameState === 'PAUSED') {
        engineRef.current.resumeGame();
      }
    }
  };

  const handleSlap = () => {
    if (engineRef.current) {
      if (engineRef.current.introState.active) {
        engineRef.current.triggerIntroSlapNow();
      } else {
        engineRef.current.requestSlap();
      }
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(22);
        } catch {}
      }
    }
  };

  const handleSelectSkin = (skin: CharacterSkin) => {
    setSelectedSkin(skin);
    try {
      localStorage.setItem('slap_run_selected_skin', skin.id);
    } catch {}
    if (engineRef.current) engineRef.current.setSkin(skin);
  };

  const handleUnlockSkin = (skin: CharacterSkin) => {
    if (stats.totalCoinsCollected >= skin.cost) {
      const remainingCoins = stats.totalCoinsCollected - skin.cost;
      const updatedSkins = [...unlockedSkinIds, skin.id];
      setUnlockedSkinIds(updatedSkins);
      setSelectedSkin(skin);
      if (engineRef.current) engineRef.current.setSkin(skin);

      setStats((prev) => ({
        ...prev,
        totalCoinsCollected: remainingCoins,
      }));

      try {
        localStorage.setItem('slap_run_unlocked_skins', JSON.stringify(updatedSkins));
        localStorage.setItem('slap_run_selected_skin', skin.id);
        localStorage.setItem('slap_run_total_coins', String(remainingCoins));
      } catch {}
      sounds.playPowerup();
    }
  };

  const handleCoinsClaimed = (coins: number) => {
    const newTotal = stats.totalCoinsCollected + coins;
    setStats((prev) => ({
      ...prev,
      totalCoinsCollected: newTotal,
      coins: prev.coins + coins,
    }));
    try {
      localStorage.setItem('slap_run_total_coins', String(newTotal));
    } catch {}
    sounds.playPowerup();
  };

  const handleDailyRewardClaimed = (coinsAdded: number) => {
    handleCoinsClaimed(coinsAdded);
    setIsDailyAvailable(isDailyRewardAvailable());
  };

  const handleBountyClaimed = (coinsAdded: number, staminaAdded: number) => {
    handleCoinsClaimed(coinsAdded);
    if (staminaAdded > 0) grantStaminaBoost(staminaAdded);
    setUnclaimedMissions(getUnclaimedMissionsCount());
    setDailyMissions(getMissionSummaries());
  };

  // Smooth, responsive mobile runner touch & swipe gestures
  const isPointerDownRef = useRef<boolean>(false);
  const pointerStartXRef = useRef<number>(0);
  const pointerStartYRef = useRef<number>(0);
  const pointerStartTimeRef = useRef<number>(0);
  const totalSwipesInGestureRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (gameState !== 'PLAYING') return;
    isPointerDownRef.current = true;
    pointerStartXRef.current = e.clientX;
    pointerStartYRef.current = e.clientY;
    pointerStartTimeRef.current = performance.now();
    totalSwipesInGestureRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isPointerDownRef.current || !engineRef.current || gameState !== 'PLAYING') return;

    const deltaX = e.clientX - pointerStartXRef.current;
    const deltaY = e.clientY - pointerStartYRef.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Short thresholds and a forgiving axis ratio: a fast thumb flick has to
    // register as a whip before the target leaves the strike window.
    const SWIPE_THRESHOLD = 22;

    // 1. Horizontal Swipe (Left / Right) - Switches smoothly between Left (0), Middle (1), and Right (2)
    if (absX >= SWIPE_THRESHOLD && absX > absY * 0.62) {
      if (deltaX < 0) {
        // Swiping Left: Moves right lane -> middle, or middle -> left
        engineRef.current.changeLane(-1);
      } else {
        // Swiping Right: Moves left lane -> middle, or middle -> right
        engineRef.current.changeLane(1);
      }
      totalSwipesInGestureRef.current++;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(12); } catch {}
      }
      // Re-anchor start coordinates so continuous multi-swipes in one finger drag change lanes cleanly
      pointerStartXRef.current = e.clientX;
      pointerStartYRef.current = e.clientY;
      return;
    }

    // 2. Vertical Swipe UP -> Vault Jump!
    if (deltaY <= -26 && absY > absX * 0.65) {
      engineRef.current.requestJump();
      totalSwipesInGestureRef.current++;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(15); } catch {}
      }
      pointerStartXRef.current = e.clientX;
      pointerStartYRef.current = e.clientY;
      return;
    }

    // 3. Vertical Swipe DOWN -> Tail-Whip Slap!
    if (deltaY >= 28 && absY > absX * 0.65) {
      handleSlap();
      totalSwipesInGestureRef.current++;
      pointerStartXRef.current = e.clientX;
      pointerStartYRef.current = e.clientY;
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (engineRef.current) {
      engineRef.current.input.joystick.active = false;
      engineRef.current.input.joystick.x = 0;
    }

    const elapsed = performance.now() - pointerStartTimeRef.current;
    const deltaX = e.clientX - pointerStartXRef.current;
    const deltaY = e.clientY - pointerStartYRef.current;

    // Tap detection when user tapped without swiping
    if (totalSwipesInGestureRef.current === 0 && elapsed < 280 && Math.abs(deltaX) < 18 && Math.abs(deltaY) < 18) {
      const screenW = window.innerWidth;
      const clientX = e.clientX;

      // Intuitive 3-zone tap controls on mobile:
      // Tap Left 30% -> Dodge Left
      // Tap Right 30% -> Dodge Right
      // Tap Center 40% -> Tail-Whip Slap!
      if (clientX < screenW * 0.30) {
        engineRef.current?.changeLane(-1);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(10); } catch {}
        }
      } else if (clientX > screenW * 0.70) {
        engineRef.current?.changeLane(1);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(10); } catch {}
        }
      } else {
        handleSlap();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={() => sounds.unlock()}
      className="relative w-screen h-[100dvh] overflow-hidden select-none bg-transparent font-['Fredoka'] touch-none overscroll-none"
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none cursor-pointer pixel-canvas"
      />

      {/* Gesture catcher above the canvas and below the HUD: swiping works on
          the road, the HUD chrome and the empty space around the touch pad,
          not just on the canvas. Buttons sit above it and keep their taps. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-10 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Achievement Unlocked Toast Notification */}
      <AchievementToast
        achievement={activeToastAchievement}
        onDismiss={() => setActiveToastAchievement(null)}
      />

      {/* Start / Menu Screen */}
      {gameState === 'MENU' && (
        <StartScreen
          highScore={stats.highScore}
          totalCoins={stats.totalCoinsCollected}
          selectedSkin={selectedSkin}
          unlockedSkinIds={unlockedSkinIds}
          selectedPace={selectedPace}
          unlockedLevel={levelProgress.unlockedLevel}
          totalStars={totalStars}
          currentMap={currentMap}
          claimableAchievementsCount={claimableAchievementsCount}
          isDailyAvailable={isDailyAvailable}
          unclaimedMissionsCount={unclaimedMissions}
          isLevelMode={isLevelMode}
          onToggleMode={handleToggleMode}
          onSelectPace={(pace) => {
            setSelectedPace(pace);
            if (engineRef.current) engineRef.current.paceMultiplier = pace.multiplier;
          }}
          onSelectSkin={handleSelectSkin}
          onUnlockSkin={handleUnlockSkin}
          onStartGame={handleStartGame}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onOpenLevelSelect={() => setIsLevelSelectOpen(true)}
          onOpenMapSelect={() => setIsMapSelectOpen(true)}
          onOpenAchievements={() => setIsAchievementsOpen(true)}
          onOpenDailyRewards={() => setIsDailyRewardsOpen(true)}
          onOpenDailyMissions={() => setIsDailyMissionsOpen(true)}
          onOpenGuide={() => setShowGuide(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenSkins={() => setIsSkinsOpen(true)}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {/* In-Game HUD */}
      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <HUD
          stats={stats}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isPaused={gameState === 'PAUSED'}
          onTogglePause={handleTogglePause}
          hurtFlash={hurtFlash}
        />
      )}

      {/* Opening Boss Encounter Prompt */}
      {gameState === 'PLAYING' && stats.introActive && stats.introPhase === 'WINDUP' && (
        <div className="absolute top-[24%] inset-x-0 z-30 flex flex-col items-center pointer-events-none px-4 animate-bounce">
          <div className="bg-[#19110B]/95 border-2 border-[#F97316] shadow-[0_8px_24px_rgba(0,0,0,0.6)] px-4 py-2.5 rounded-2xl flex flex-col items-center gap-1 backdrop-blur-sm text-center max-w-sm">
            <span className="font-['Lilita_One'] text-xs sm:text-sm text-[#FACC15] tracking-wider uppercase">
              {t('WHIP {name}!', { name: engineRef.current?.introState.victim?.name || 'THE BOSS' })}
            </span>
            <span className="font-['Fredoka'] text-xs text-[#38BDF8] font-bold">
              {t('TAP WHIP OR PRESS SPACE FOR MEGA TAIL-WHIP!')}
            </span>
          </div>
        </div>
      )}

      {/* First-run mobile lesson: one cued direction, every other input locked */}
      {gameState === 'PLAYING' && stats.tutorialActive && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-5 bg-black/45 backdrop-blur-[2px] select-none">
          <div className="w-full max-w-xs bg-gradient-to-b from-[#1B2333] via-[#141A26] to-[#0F131C] border-2 border-[#38BDF8] rounded-3xl p-5 text-center shadow-[0_18px_48px_rgba(0,0,0,0.75)] animate-fadeIn">
            <span className="inline-block bg-[#38BDF8] text-black font-['Lilita_One'] text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full mb-3">
              {t('First Run')}
            </span>
            <h3 className="font-['Lilita_One'] text-2xl text-white tracking-wide uppercase">
              {t('Dodge Right')}
            </h3>
            <p className="text-[#CBD5E1] text-xs mt-1 mb-4">
              {t('Tap the arrow to whip into the open lane.')}
            </p>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                sounds.playWhoosh();
                engineRef.current?.changeLane(1);
              }}
              aria-label={t('Dodge right')}
              className="mx-auto w-28 h-28 rounded-3xl bg-gradient-to-b from-[#38BDF8] to-[#0284C7] border-4 border-[#BAE6FD] text-white flex flex-col items-center justify-center gap-1 shadow-[0_8px_0_#075985] active:translate-y-1 active:shadow-[0_3px_0_#075985] animate-pulse"
            >
              <ArrowRight className="w-12 h-12 stroke-[3]" />
              <span className="font-['Lilita_One'] text-sm tracking-wider">{t('RIGHT')}</span>
            </button>
            <p className="text-[#64748B] text-[10px] mt-4 uppercase tracking-wider">
              {t('Other controls are paused for this lesson')}
            </p>
          </div>
        </div>
      )}

      {/* Touch Controls - On PC, left/right buttons are automatically hidden */}
      {gameState === 'PLAYING' && engineRef.current && !stats.tutorialActive && (
        <TouchControls
          input={engineRef.current.input}
          onSlap={handleSlap}
          onJump={() => engineRef.current?.requestJump()}
          onLaneLeft={() => engineRef.current?.changeLane(-1)}
          onLaneRight={() => engineRef.current?.changeLane(1)}
          isPaused={false}
          isIntroActive={stats.introActive}
          showLaneButtonsSetting={settings.showLaneButtons}
          onScreenControlsSetting={settings.onScreenControls}
        />
      )}

      {/* Pause Overlay */}
      {gameState === 'PAUSED' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-[#0F121C]/80 backdrop-blur-md select-none animate-fadeIn">
          <div className="bg-[#1B1D2A] border-3 border-black rounded-2xl p-6 text-center max-w-xs w-full shadow-[6px_6px_0px_#000000]">
            <span className="font-ui text-[9px] uppercase font-bold tracking-wider text-[#FACC15] block mb-1">
              {t('Sprint Paused')}
            </span>
            <h3 className="font-pixel text-lg font-bold text-white mb-5 tracking-wide">
              {t('PAUSED')}
            </h3>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleTogglePause}
                className="w-full py-3 px-4 bg-[#10B981] hover:bg-[#34D399] text-black font-ui text-xs font-bold uppercase tracking-wider rounded-xl border-2 border-black shadow-[3px_3px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer transition-transform"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>{t('RESUME SPRINT')}</span>
              </button>

              <button
                onClick={() => {
                  sounds.playStart();
                  handleRestart();
                }}
                className="w-full py-2.5 px-4 bg-[#FACC15] hover:bg-[#FDE047] text-black font-ui text-xs font-bold uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer transition-transform"
              >
                <span>{t('RESTART')}</span>
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  setIsSettingsOpen(true);
                }}
                className="w-full py-2.5 px-4 bg-[#25283B] hover:bg-[#31354D] text-white font-ui text-xs font-bold uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer transition-transform"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>{t('Settings')}</span>
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  setIsDailyMissionsOpen(true);
                }}
                className={`w-full py-2.5 px-4 font-ui text-xs font-bold uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer flex items-center justify-center gap-1.5 ${
                  unclaimedMissions > 0
                    ? 'bg-[#10B981] hover:bg-[#34D399] text-black'
                    : 'bg-[#25283B] hover:bg-[#31354D] text-white'
                }`}
              >
                <span>
                  {unclaimedMissions > 0
                    ? `${t('DAILY MISSIONS')} · ${unclaimedMissions} ${t('CLAIM')}`
                    : t('DAILY MISSIONS')}
                </span>
              </button>

              <button
                onClick={() => {
                  sounds.playClick();
                  handleHome();
                }}
                className="w-full py-2.5 px-4 bg-[#12131C] hover:bg-[#1B1D2A] text-[#94A3B8] hover:text-white font-ui text-xs font-bold uppercase tracking-wider rounded-xl border-2 border-black cursor-pointer transition-colors"
              >
                <span>{t('MAIN MENU')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAMEOVER' && (
        <GameOverModal
          stats={stats}
          paceName={selectedPace.name}
          onRestart={handleRestart}
          onHome={handleHome}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onRetryLeaderboard={handleRetryLeaderboard}
          dailyMission={pickClosestMission(dailyMissions)}
          retryBoostAvailable={retryBoostMs <= 0}
          retryBoostLabel={formatCountdown(retryBoostMs)}
          onRetryWithBoost={handleRetryWithBoost}
        />
      )}

      {/* Level Select Modal (1 to 100+) */}
      {isLevelSelectOpen && (
        <LevelSelectModal
          progress={levelProgress}
          onSelectLevel={handleSelectLevel}
          onClose={() => setIsLevelSelectOpen(false)}
        />
      )}

      {/* Map Select Modal (6 Biomes) */}
      {isMapSelectOpen && (
        <MapSelectModal
          currentMapId={currentMap.id}
          highestLevel={levelProgress.unlockedLevel}
          onSelectMap={handleSelectMap}
          onClose={() => setIsMapSelectOpen(false)}
        />
      )}

      {/* Achievements Modal (28 Trophies) */}
      {isAchievementsOpen && (
        <AchievementsModal
          stats={stats}
          totalCoins={stats.totalCoinsCollected}
          unlockedLevel={levelProgress.unlockedLevel}
          totalStars={totalStars}
          unlockedSkinsCount={unlockedSkinIds.length}
          onCoinsClaimed={handleCoinsClaimed}
          onClose={() => setIsAchievementsOpen(false)}
        />
      )}

      {/* Global Leaderboard Modal */}
      {isLeaderboardOpen && (
        <LeaderboardModal
          entries={leaderboardEntries}
          playerScore={stats.highScore}
          mode={leaderboardMode}
          playerRank={leaderboardMode === 'online' ? stats.globalRank : stats.localRank}
          onClose={() => setIsLeaderboardOpen(false)}
        />
      )}

      {/* Game Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={(newSettings) => {
            if (newSettings.language) setLanguage(newSettings.language);
            setSettings(newSettings);
            saveSettings(newSettings);
            setIsMuted(newSettings.isMuted);
            engineRef.current?.setCharacterFocus(newSettings.characterFocus !== 'classic');
            sounds.setSfxVolume(newSettings.soundEnabled ? 0.8 : 0);
            sounds.setMusicVolume(newSettings.musicEnabled ? 0.55 : 0);
            // Runs play no background music at all, so the only thing the
            // music switch can do is stop whatever might still be scheduled.
            if (!newSettings.musicEnabled || newSettings.isMuted) {
              sounds.stopArcadeBeat();
            }
          }}
          onResetProgress={handleResetProgress}
          onPlayerNameSaved={refreshOnlineBoard}
        />
      )}

      {/* Runner Wardrobe / Skins Modal */}
      {isSkinsOpen && (
        <SkinsModal
          isOpen={isSkinsOpen}
          onClose={() => setIsSkinsOpen(false)}
          selectedSkin={selectedSkin}
          unlockedSkinIds={unlockedSkinIds}
          highestLevel={levelProgress.unlockedLevel}
          totalCoins={stats.totalCoinsCollected}
          onSelectSkin={handleSelectSkin}
          onUnlockSkin={handleUnlockSkin}
        />
      )}

      {/* How To Play Guide Modal */}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* Daily Login Rewards Modal */}
      {isDailyRewardsOpen && (
        <DailyRewardsModal
          isOpen={isDailyRewardsOpen}
          onClose={() => setIsDailyRewardsOpen(false)}
          onRewardClaimed={handleDailyRewardClaimed}
        />
      )}

      {/* Daily Bounties / Missions Modal */}
      {isDailyMissionsOpen && (
        <DailyMissionsModal
          isOpen={isDailyMissionsOpen}
          onClose={() => setIsDailyMissionsOpen(false)}
          onRewardClaimed={handleBountyClaimed}
        />
      )}

      {/* Boot / loading gate: sits over the menu until the game is ready */}
      {boot.visible && (
        <BootScreen progress={boot.progress} label={boot.label} leaving={boot.leaving} />
      )}

    </div>
  );
}
