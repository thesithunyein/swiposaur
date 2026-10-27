import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeaderboardModal } from '../src/components/LeaderboardModal.tsx';
import { GameOverModal } from '../src/components/GameOverModal.tsx';
import type { GameStats, LeaderboardEntry } from '../src/game/types.ts';

const entries: LeaderboardEntry[] = [
  {
    id: 'run-aaaaaaaa',
    name: 'YOU',
    score: 1200,
    maxCombo: 8,
    date: 'Just now',
    skinId: 'rex_red',
    isPlayer: true,
  },
];

function baseStats(overrides: Partial<GameStats> = {}): GameStats {
  return {
    score: 1200,
    highScore: 1200,
    coins: 10,
    totalCoinsCollected: 40,
    slapsCount: 5,
    chaosLevel: 20,
    chaosMultiplier: 1,
    feverActive: false,
    distanceRun: 220,
    comboStreak: 0,
    maxCombo: 8,
    longestChaseEscape: 0,
    stamina: 50,
    maxStamina: 100,
    chaserOnScreen: false,
    chaserAlertTimer: 0,
    mobDistance: 180,
    currentLevel: 1,
    isLevelMode: true,
    currentMapId: 'market',
    boostJumpsCount: 0,
    nearMissesCount: 0,
    escapedCount: 0,
    ...overrides,
  };
}

function renderGameOver(overrides: Partial<GameStats>): string {
  return renderToStaticMarkup(
    <GameOverModal stats={baseStats(overrides)} onRestart={() => {}} onHome={() => {}} onOpenLeaderboard={() => {}} />
  );
}

describe('Hall of Fame copy', () => {
  it('does not dress local data up as a global live tournament', () => {
    const markup = renderToStaticMarkup(
      <LeaderboardModal entries={entries} playerScore={1200} mode="local" playerRank={1} onClose={() => {}} />
    );

    expect(markup).toContain('HALL OF FAME');
    expect(markup).toContain('Saved on this device');
    expect(markup).toContain('LOCAL RANK #1');
    expect(markup).toContain('Local Hall of Fame');
    expect(markup).not.toContain('GLOBAL LEADERBOARD');
    expect(markup).not.toContain('Official Tournament Standings');
    expect(markup).not.toContain('LIVE');
    expect(markup).not.toContain('Prize:');
  });

  it('labels the online mode honestly as a community board', () => {
    const markup = renderToStaticMarkup(
      <LeaderboardModal entries={entries} playerScore={1200} mode="online" playerRank={3} onClose={() => {}} />
    );

    expect(markup).toContain('GLOBAL LEADERBOARD');
    expect(markup).toContain('Best score per player, saved online');
    expect(markup).toContain('GLOBAL RANK #3');
    expect(markup).toContain('not cheat-proof');
    expect(markup).not.toContain('LIVE');
    expect(markup).not.toContain('Official Tournament Standings');
  });
});

describe('game-over status', () => {
  it('does not show the personal-best badge for a tied score', () => {
    const tied = renderGameOver({ score: 1200, highScore: 1200, isNewPersonalBest: false });
    expect(tied).not.toContain('NEW PERSONAL BEST');

    const better = renderGameOver({ score: 1300, highScore: 1300, isNewPersonalBest: true });
    expect(better).toContain('NEW PERSONAL BEST');
  });

  it('shows a local rank without calling it global', () => {
    const markup = renderGameOver({
      score: 900,
      highScore: 1200,
      leaderboardMode: 'local',
      leaderboardStatus: 'local',
      localRank: 2,
    });
    expect(markup).toContain('LOCAL RANK #2');
    expect(markup).not.toContain('GLOBAL RANK');
  });

  it('shows a global rank only after a persisted submission', () => {
    const pending = renderGameOver({
      leaderboardMode: 'online',
      leaderboardStatus: 'pending',
      globalRankPending: true,
    });
    expect(pending).toContain('Submitting score');
    expect(pending).not.toContain('GLOBAL RANK');

    const submitted = renderGameOver({
      leaderboardMode: 'online',
      leaderboardStatus: 'submitted',
      globalRank: 7,
      globalRankConfirmed: true,
    });
    expect(submitted).toContain('GLOBAL RANK #7');
  });

  it('explains a failed submission without claiming a rank', () => {
    const markup = renderGameOver({
      leaderboardMode: 'online',
      leaderboardStatus: 'failed',
      leaderboardError: true,
      globalRankConfirmed: false,
    });
    expect(markup).toContain('Saved locally — not submitted online.');
    expect(markup).not.toContain('GLOBAL RANK');
  });

  it('shows only the score, the run stats and the actions', () => {
    const markup = renderGameOver({
      score: 121080,
      highScore: 1000,
      coins: 682,
      slapsCount: 24,
      maxCombo: 12,
      distanceRun: 11485,
    });

    expect(markup).toContain('Final Dinosaur Score');
    expect(markup).toContain('RUN AGAIN');
    expect(markup).toContain('MAIN MENU');

    // Dropped as clutter: the rating card, its reflexes column and the
    // daily-mission strip that sat between the score and the stats.
    expect(markup).not.toContain('OVERALL RATING');
    expect(markup).not.toContain('MASTER DINO DRIFTER');
    expect(markup).not.toContain('Reflexes');
    expect(markup).not.toContain('mission is done');
  });
});
