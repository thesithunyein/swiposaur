import React from 'react';
import { GameStats } from '../game/types.ts';
import { sounds } from '../game/SoundEngine.ts';
import { getMapById } from '../game/maps.ts';
import { Volume2, VolumeX, Pause, Play, Coins, Flame, Zap, AlertTriangle, Heart } from 'lucide-react';
import { DinoVectorIcon } from './GameIcons.tsx';

interface HUDProps {
  stats: GameStats;
  isMuted: boolean;
  onToggleMute: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  hurtFlash?: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  isMuted,
  onToggleMute,
  isPaused,
  onTogglePause,
  hurtFlash = false,
}) => {
  const chaosPercent = Math.min(100, Math.max(0, stats.chaosLevel));
  // A boosted run starts above the usual 100, so the bar reads against the
  // run's own maximum instead of overflowing.
  const maxStamina = Math.max(1, stats.maxStamina ?? 100);
  const staminaRaw = Math.max(0, stats.stamina ?? 100);
  const stamina = Math.min(100, Math.round((staminaRaw / maxStamina) * 100));
  const staminaBonus = Math.max(0, maxStamina - 100);
  const isLowStamina = stamina <= 25;

  return (
    <>
      {/* 1. Subtle Damage Vignette */}
      {hurtFlash && (
        <div className="absolute inset-0 z-20 pointer-events-none bg-[#EF4444]/30 animate-pulse" />
      )}

      {/* 2. Soft Ambient Primal Roar Fever Vignette */}
      {stats.feverActive && (
        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-t from-[#F97316]/30 via-transparent to-[#FBBF24]/20 animate-pulse" />
      )}

      {/* 3. Dinosaur Stampede Alert Banner */}
      {stats.chaserOnScreen && !stats.feverActive && (
        <div className="absolute top-[max(4.2rem,env(safe-area-inset-top)+3.2rem)] inset-x-0 z-20 flex justify-center pointer-events-none px-4 animate-bounce">
          <div className="bg-gradient-to-r from-[#DC2626] via-[#EF4444] to-[#B91C1C] text-white border-2 border-[#FECACA] shadow-[0_6px_24px_rgba(239,68,68,0.7)] px-4 py-1.5 sm:px-6 sm:py-2 rounded-full flex items-center gap-2.5 font-['Lilita_One'] text-xs sm:text-sm uppercase tracking-wide">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
            </span>
            <AlertTriangle className="w-4 h-4 text-white fill-white shrink-0" />
            <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
              STAMPEDE ON YOUR TAIL! RUN CLEAN TO SHAKE THEM OFF!
            </span>
          </div>
        </div>
      )}

      {/* 4. Swiposaur Claymorphic HUD Header */}
      <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] inset-x-0 px-3 sm:px-5 pointer-events-none z-30 flex flex-col gap-2 max-w-4xl mx-auto font-['Fredoka']">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-2.5 w-full">
          {/* Top Left: Score & Combo Badge */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="bg-[#19110B]/90 backdrop-blur-md border-2 border-white/20 shadow-[0_6px_16px_rgba(0,0,0,0.5)] rounded-2xl px-3.5 py-1.5 flex flex-col">
              <span className="text-[9px] font-bold text-[#E2E8F0] uppercase tracking-wider">
                Score
              </span>
              <span className="font-['Lilita_One'] text-base sm:text-lg text-white leading-tight drop-shadow">
                {stats.score.toLocaleString()}
              </span>
            </div>

            {stats.comboStreak > 1 && (
              <div className="bg-[#2A1E14]/95 text-white border-2 border-[#F97316]/50 shadow-[0_6px_16px_rgba(0,0,0,0.5)] rounded-2xl px-3 py-1.5 font-['Lilita_One'] text-xs sm:text-sm flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[#F97316] fill-[#F97316]" />
                <span>{stats.comboStreak}x ROAR!</span>
              </div>
            )}
          </div>

          {/* Center: Dinosaur Stamina & Primal Mayhem Gauges */}
          <div className="hidden sm:flex items-center gap-3.5 bg-[#19110B]/90 backdrop-blur-md border-2 border-white/20 shadow-[0_6px_20px_rgba(0,0,0,0.5)] rounded-2xl px-4 py-2 pointer-events-auto">
            {/* Stamina Meter */}
            <div className="flex items-center gap-2">
              <Heart
                className={`w-4 h-4 shrink-0 ${
                  isLowStamina ? 'text-[#EF4444] animate-pulse' : 'text-[#34D399]'
                }`}
                fill="currentColor"
                strokeWidth={1.5}
                aria-hidden
              />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[9px] font-bold text-[#E2E8F0]">
                  <span>DINO ENERGY</span>
                  <span className="text-white">
                    {stamina}%
                    {staminaBonus > 0 && (
                      <span className="text-[#34D399] font-bold"> +{staminaBonus}</span>
                    )}
                  </span>
                </div>
                <div className="w-24 bg-black/60 h-3 rounded-full overflow-hidden border border-white/15 p-0.5 shadow-inner">
                  <div
                    className={`h-full transition-all duration-150 rounded-full ${
                      isLowStamina
                        ? 'bg-[#EF4444] animate-pulse'
                        : stamina > 50
                        ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                        : 'bg-gradient-to-r from-[#F97316] to-[#FB923C]'
                    }`}
                    style={{ width: `${Math.max(4, stamina)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="w-[1.5px] h-6 bg-white/20" />

            {/* Primal Roar / Chaos Gauge */}
            <div className="flex items-center gap-2">
              <Zap className={`w-4 h-4 text-[#F97316] fill-[#F97316] shrink-0 ${stats.feverActive ? 'animate-bounce' : ''}`} />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[9px] font-bold text-[#E2E8F0]">
                  <span>PRIMAL MAYHEM</span>
                  <span className="text-white font-['Lilita_One']">
                    {stats.feverActive ? 'PRIMAL ROAR 16x' : `${stats.chaosMultiplier}x`}
                  </span>
                </div>
                <div className="w-24 bg-black/60 h-3 rounded-full overflow-hidden border border-white/15 p-0.5 shadow-inner">
                  <div
                    className={`h-full transition-all duration-150 rounded-full ${
                      stats.feverActive
                        ? 'bg-gradient-to-r from-[#FFFFFF] via-[#F97316] to-[#EF4444] animate-pulse'
                        : 'bg-gradient-to-r from-[#FFA726] to-[#E65100]'
                    }`}
                    style={{ width: `${chaosPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Top Right: Dino Coins, Distance & Utility Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Coins */}
            <div className="bg-[#19110B]/90 backdrop-blur-md text-white border-2 border-white/30 shadow-[0_6px_16px_rgba(0,0,0,0.5)] rounded-2xl px-3.5 py-1.5 flex items-center gap-1.5 font-['Lilita_One'] text-sm">
              <Coins className="w-4 h-4 text-white fill-white/80" />
              <span>{stats.coins}</span>
            </div>

            {/* Distance Odometer */}
            <div className="bg-[#19110B]/90 backdrop-blur-md text-[#38BDF8] border-2 border-[#38BDF8]/60 shadow-[0_6px_16px_rgba(0,0,0,0.5)] rounded-2xl px-3 py-1.5 font-['Lilita_One'] text-sm">
              {Math.round(stats.distanceRun)}m
            </div>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onToggleMute();
              }}
              title="Toggle Audio"
              aria-label="Toggle Sound"
              className="w-9 h-9 bg-[#19110B]/90 hover:bg-[#2A1E14] text-white border-2 border-white/20 shadow-md active:scale-95 rounded-2xl flex items-center justify-center cursor-pointer transition-all"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-[#EF4444]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#34D399]" />
              )}
            </button>

            {/* Pause Button */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onTogglePause();
              }}
              title="Pause"
              aria-label="Pause"
              className="w-9 h-9 bg-[#19110B]/90 hover:bg-[#2A1E14] text-white border-2 border-white/20 shadow-md active:scale-95 rounded-2xl flex items-center justify-center cursor-pointer transition-all"
            >
              {isPaused ? (
                <Play className="w-4 h-4 fill-current text-[#10B981]" />
              ) : (
                <Pause className="w-4 h-4 fill-current text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dual Gauge Bar */}
        <div className="sm:hidden flex items-center gap-2 bg-[#19110B]/90 backdrop-blur-md border-2 border-white/20 shadow-md rounded-2xl px-3 py-2 pointer-events-auto">
          {/* Energy */}
          <div className="flex-1 flex items-center gap-1.5">
            <Heart
              className={`w-4 h-4 shrink-0 ${
                isLowStamina ? 'text-[#EF4444] animate-pulse' : 'text-[#34D399]'
              }`}
              fill="currentColor"
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="w-full bg-black/60 h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  isLowStamina ? 'bg-[#EF4444] animate-pulse' : 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                }`}
                style={{ width: `${Math.max(4, stamina)}%` }}
              />
            </div>
          </div>

          {/* Primal Roar / Chaos */}
          <div className="flex-1 flex items-center gap-1.5">
            <Zap className={`w-3.5 h-3.5 ${stats.feverActive ? 'text-white animate-bounce' : 'text-[#F97316]'}`} />
            <div className="w-full bg-black/60 h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  stats.feverActive
                    ? 'bg-gradient-to-r from-white to-[#EF4444] animate-pulse'
                    : 'bg-gradient-to-r from-[#FFA726] to-[#E65100]'
                }`}
                style={{ width: `${chaosPercent}%` }}
              />
            </div>
            <span className="font-['Lilita_One'] text-[10px] text-white shrink-0">
              {stats.feverActive ? '16x' : `${stats.chaosMultiplier}x`}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
