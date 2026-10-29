import { describe, expect, it } from 'vitest';
import { getLevel, getMapForLevel, getObstaclesForLevel } from '../src/game/levels.ts';
import { isRampType, OBSTACLE_TYPES } from '../src/game/obstacleRules.ts';
import { GAME_MAPS, getMapById } from '../src/game/maps.ts';
import { CHARACTER_SKINS } from '../src/game/constants.ts';

/** The obstacle pools a map is allowed to draw from, mirrored from levels.ts. */
const MAP_ALLOWED_PROPS: Record<string, string[]> = {
  market: ['crate', 'watermelon', 'planter', 'cafe_table', 'hydrant', 'barrier', 'barrel', 'cart', 'shifting_block'],
  tropical_coast: ['coconut_crate', 'beach_lounger', 'watermelon', 'barrier', 'surf_rack', 'barrel', 'tiki_totem', 'shifting_block'],
  sunset_desert: ['dino_skull', 'barrier', 'barrel', 'firewall', 'loop_boulder', 'cactus_cluster', 'canyon_mesa', 'shifting_block'],
  neon_night: ['spikes', 'barrier', 'cyber_server', 'barrel', 'holo_barrier', 'drone_hazard', 'shifting_block'],
  winter_peak: ['snow_bale', 'barrier', 'ice_spikes', 'barrel', 'timber_sled', 'loop_boulder', 'shifting_block'],
  golden_temple: ['stone_lantern', 'planter', 'zen_barrier', 'barrier', 'torii_gate', 'cherry_wagon', 'shifting_block'],
};

const blockersOf = (level: number) =>
  getObstaclesForLevel(level)
    .obstacles.filter((type) => !isRampType(type))
    .slice()
    .sort();

describe('late-game map and skin milestones', () => {
  const milestones = [45, 55, 65, 75, 85, 95];

  it('assigns each milestone level to its matching selectable biome', () => {
    const milestoneMaps = GAME_MAPS.filter((map) => milestones.includes(map.unlockLevel));
    expect(milestoneMaps.map((map) => map.unlockLevel)).toEqual(milestones);
    for (const map of milestoneMaps) {
      expect(getMapById(getMapForLevel(map.unlockLevel)).id).toBe(map.id);
      expect(getMapById(getMapForLevel(map.unlockLevel - 1)).id).not.toBe(map.id);
      expect(map.renderStyle).toBeDefined();
    }
  });

  it('gives each milestone a matching level-unlocked skin', () => {
    const milestoneSkins = CHARACTER_SKINS.filter((skin) => skin.unlockLevel !== undefined);
    expect(milestoneSkins.map((skin) => skin.unlockLevel)).toEqual(milestones);
  });
});

describe('unique obstacle set per level', () => {
  it('gives every level in the first 100 its own blocker combination', () => {
    const seen = new Map<string, number>();
    for (let level = 1; level <= 100; level++) {
      const key = blockersOf(level).join(',');
      const previous = seen.get(key);
      expect(previous, `level ${level} repeats the obstacle set of level ${previous}`).toBeUndefined();
      seen.set(key, level);
    }
  });

  it('always ships a launch pad alongside three or more blockers', () => {
    for (let level = 1; level <= 60; level++) {
      const { obstacles } = getObstaclesForLevel(level);
      expect(obstacles.some(isRampType), `level ${level} has no launch pad`).toBe(true);
      expect(obstacles.filter((type) => !isRampType(type)).length).toBeGreaterThanOrEqual(3);
      for (const type of obstacles) {
        expect(OBSTACLE_TYPES).toContain(type);
      }
    }
  });

  it('only draws props from its own map and names its own level', () => {
    for (let level = 1; level <= 100; level++) {
      const mapId = getMapForLevel(level);
      const mapStyleId = getMapById(mapId).renderStyle ?? mapId;
      const allowed = MAP_ALLOWED_PROPS[mapStyleId];
      const { themeName, obstacles } = getObstaclesForLevel(level);
      expect(themeName).toContain(`Level ${level}`);
      for (const type of obstacles) {
        if (isRampType(type)) continue;
        expect(allowed, `level ${level} drew ${type} outside the ${mapId} pool`).toContain(type);
      }
    }
  });

  it('keeps the level card describing its own obstacle mix', () => {
    const level = getLevel(12);
    expect(level.featuredObstacles.length).toBeGreaterThanOrEqual(4);
    expect(level.obstacleThemeName).toContain('Level 12');
    expect(level.description).toContain(level.obstacleThemeName);
  });
});