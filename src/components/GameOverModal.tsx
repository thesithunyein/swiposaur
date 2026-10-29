import React, { useState } from 'react';
import { GameStats } from '../game/types.ts';
import { sounds } from '../game/SoundEngine.ts';
import { RotateCcw, Home, Award, BatteryCharging, Share2, Check, Loader2 } from 'lucide-react';
import { buildShareCard } from '../game/shareCard.ts';
import { gradeFor } from '../game/grades.ts';
import { loadPlayerName } from '../game/leaderboard.ts';
import { LeaderboardAdvancedIcon } from './GameIcons.tsx';
import type { MissionSummary } from '../game/dailyMissions.ts';
import { t, useLanguage } from '../game/i18n.ts';

interface GameOverModalProps {
  stats: GameStats;
  paceName?: string;
  onRestart: () => void;
  onHome: () => void;
  onOpenLeaderboard: () => void;
  onRetryLeaderboard?: () => void;
  dailyMission?: MissionSummary | null;
  retryBoostAvailable?: boolean;
  retryBoostLabel?: string;
  onRetryWithBoost?: () => void;
}

/**
 * Authentic 3D Extruded Vector 'GAME OVER' Header matching the Swiposaur Logo Font & 3D Depth
 */
export const GameOverTitle3D: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 420 110"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full max-w-[310px] sm:max-w-[370px] h-auto overflow-visible select-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.65)] ${className}`}
    role="img"
    aria-label="GAME OVER"
  >
    <defs>
      <linearGradient id="goCrestRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FF4336" />
        <stop offset="50%" stopColor="#DC2626" />
        <stop offset="100%" stopColor="#7F1D1D" />
      </linearGradient>
      <linearGradient id="goCrestHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFA39E" />
        <stop offset="100%" stopColor="#EF4444" />
      </linearGradient>

      {/* Tropical Leaves */}
      <linearGradient id="goJungleLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="45%" stopColor="#16A34A" />
        <stop offset="100%" stopColor="#14532D" />
      </linearGradient>

      {/* Golden 3D Letter Fill Gradients matching Swiposaur Logo */}
      <linearGradient id="goGoldTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="15%" stopColor="#FEF08A" />
        <stop offset="45%" stopColor="#FACC15" />
        <stop offset="80%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="goGoldBevelLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="40%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>

    {/* Prehistoric Spikes on top (matching Swiposaur crest) */}
    <g>
      <polygon points="210,2 226,34 194,34" fill="url(#goCrestRedGrad)" stroke="#3F0708" strokeWidth="3.5" strokeLinejoin="round" />
      <polygon points="210,5 215,31 205,31" fill="url(#goCrestHighlight)" opacity="0.6" />

      <polygon points="168,10 186,38 150,38" fill="url(#goCrestRedGrad)" stroke="#3F0708" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="252,10 270,38 234,38" fill="url(#goCrestRedGrad)" stroke="#3F0708" strokeWidth="3" strokeLinejoin="round" />

      <polygon points="128,20 144,42 112,42" fill="url(#goCrestRedGrad)" stroke="#3F0708" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="292,20 308,42 276,42" fill="url(#goCrestRedGrad)" stroke="#3F0708" strokeWidth="2.5" strokeLinejoin="round" />
    </g>

    {/* Small Tropical Leaves at edges */}
    <g>
      <path d="M48 64C26 50 20 28 34 16C50 22 54 40 56 56Z" fill="url(#goJungleLeafGrad)" stroke="#064E3B" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="58" cy="56" r="6" fill="#F43F5E" stroke="#881337" strokeWidth="1.5" />
      <circle cx="58" cy="56" r="2" fill="#FBBF24" />

      <path d="M372 64C394 50 400 28 386 16C370 22 366 40 364 56Z" fill="url(#goJungleLeafGrad)" stroke="#064E3B" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="362" cy="56" r="6" fill="#F43F5E" stroke="#881337" strokeWidth="1.5" />
      <circle cx="362" cy="56" r="2" fill="#FBBF24" />
    </g>

    {/* Ground Glow Shadow */}
    <ellipse cx="210" cy="85" rx="160" ry="12" fill="#000000" opacity="0.4" />

    {/* 3D Extrusion Stack for "GAME OVER" */}
    <g transform="translate(210, 72)">
      {/* 3D Silhouette & Deep Ambient Shadow */}
      <text
        x="0"
        y="16"
        textAnchor="middle"
        fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
        fontSize="56"
        fontWeight="900"
        fill="#180A04"
        stroke="#180A04"
        strokeWidth="14"
        strokeLinejoin="round"
        letterSpacing="2.5"
      >
        GAME OVER
      </text>

      {/* Multi-layered 3D Extrusion Depth Layers */}
      {[12, 10, 8, 6, 4].map((offsetY, idx) => (
        <text
          key={offsetY}
          x="0"
          y={offsetY}
          textAnchor="middle"
          fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
          fontSize="56"
          fontWeight="900"
          fill={idx < 2 ? '#451A03' : idx < 3 ? '#78350F' : '#92400E'}
          stroke={idx < 2 ? '#451A03' : '#78350F'}
          strokeWidth={idx < 2 ? '10' : '6'}
          strokeLinejoin="round"
          letterSpacing="2.5"
        >
          GAME OVER
        </text>
      ))}

      {/* Front Extrusion Lip */}
      <text
        x="0"
        y="2"
        textAnchor="middle"
        fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
        fontSize="56"
        fontWeight="900"
        fill="#B45309"
        letterSpacing="2.5"
      >
        GAME OVER
      </text>

      {/* Front Letter Face with Rich Tropical Gold Gradient */}
      <text
        x="0"
        y="0"
        textAnchor="middle"
        fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
        fontSize="56"
        fontWeight="900"
        fill="url(#goGoldTopGrad)"
        stroke="#451A03"
        strokeWidth="3.5"
        letterSpacing="2.5"
        style={{ paintOrder: 'stroke fill' }}
      >
        GAME OVER
      </text>

      {/* Glossy Bevel Highlight */}
      <text
        x="0"
        y="-1"
        textAnchor="middle"
        fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
        fontSize="56"
        fontWeight="900"
        fill="none"
        stroke="url(#goGoldBevelLight)"
        strokeWidth="1.2"
        letterSpacing="2.5"
        opacity="0.85"
      >
        GAME OVER
      </text>
    </g>
  </svg>
);

/**
 * Rank stamp badge: the S / A / B / C grade is drawn with the same 3D extruded
 * gold lettering as the SWIPOSAUR logo, stamped into a grade-coloured tile.
 */
export const GradeStamp: React.FC<{ grade: string; badgeBg: string; className?: string }> = ({
  grade,
  badgeBg,
  className = '',
}) => (
  <div
    className={`relative w-16 h-16 sm:w-[74px] sm:h-[74px] shrink-0 rounded-[20px] bg-gradient-to-br ${badgeBg} border-2 border-white/45 shadow-[0_5px_0_rgba(0,0,0,0.45),0_10px_22px_rgba(0,0,0,0.55)] flex items-center justify-center overflow-hidden ${className}`}
  >
    {/* Glossy dome + inner rim */}
    <div className="absolute inset-0 rounded-[18px] bg-gradient-to-b from-white/40 via-white/5 to-black/25 pointer-events-none" />
    <div className="absolute inset-[3px] rounded-[16px] border border-white/25 pointer-events-none" />

    <svg
      viewBox="0 0 100 100"
      className="relative w-[88%] h-[88%] overflow-visible drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]"
      role="img"
      aria-label={`Grade ${grade}`}
    >
      <defs>
        <linearGradient id="gradeGoldFace" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="16%" stopColor="#FEF08A" />
          <stop offset="46%" stopColor="#FACC15" />
          <stop offset="80%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="gradeGoldBevel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#FEF08A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* 3D extrusion stack, deepest first */}
      {[
        { dy: 7, fill: '#451A03', stroke: '#451A03', sw: 9 },
        { dy: 4.5, fill: '#78350F', stroke: '#78350F', sw: 8 },
        { dy: 2, fill: '#B45309', stroke: '#B45309', sw: 7 },
      ].map((layer) => (
        <text
          key={layer.dy}
          x="50"
          y={52 + layer.dy}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
          fontWeight="900"
          fontSize="52"
          fill={layer.fill}
          stroke={layer.stroke}
          strokeWidth={layer.sw}
          strokeLinejoin="round"
        >
          {grade}
        </text>
      ))}

      {/* Gold letter face */}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
        fontWeight="900"
        fontSize="52"
        fill="url(#gradeGoldFace)"
        stroke="#451A03"
        strokeWidth="3.5"
        strokeLinejoin="round"
        style={{ paintOrder: 'stroke fill' }}
      >
        {grade}
      </text>

      {/* Glossy top bevel */}
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
        fontWeight="900"
        fontSize="52"
        fill="none"
        stroke="url(#gradeGoldBevel)"
        strokeWidth="1.1"
        opacity="0.85"
      >
        {grade}
      </text>
    </svg>
  </div>
);

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  paceName = '',
  onRestart,
  onHome,
  onRetryLeaderboard,
  dailyMission = null,
  retryBoostAvailable = false,
  retryBoostLabel = '',
  onRetryWithBoost,
}) => {
  useLanguage();
  const [shareState, setShareState] = useState<'idle' | 'working' | 'shared' | 'error'>('idle');
  // The engine compares against the best captured before this run, so a tie with
  // the old record is not a new personal best.
  const isNewBest = stats.score > 0 && stats.isNewPersonalBest === true;

  /**
   * Social half of the leaderboard: renders the finished run as a share card and
   * hands it to the platform share sheet. Desktop browsers without a share sheet
   * download the PNG instead, so the feature works everywhere rather than
   * failing silently on the machine a reviewer happens to open.
   */
  const handleShare = async () => {
    if (shareState === 'working') return;
    sounds.playClick();
    setShareState('working');
    try {
      const blob = await buildShareCard({
        score: stats.score,
        highScore: stats.highScore,
        slapsCount: stats.slapsCount,
        maxCombo: stats.maxCombo,
        coins: stats.coins,
        distanceRun: stats.distanceRun,
        grade: gradeFor(stats.distanceRun, stats.maxCombo).grade,
        isNewBest,
        playerName: loadPlayerName(),
        paceName: paceName || t('NORMAL'),
      });

      const fileName = `swiposaur-${stats.score}.png`;
      const shareNavigator = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean;
      };

      if (shareNavigator.share && shareNavigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (shareNavigator.canShare({ files: [file] })) {
          await shareNavigator.share({
            files: [file],
            title: 'Swiposaur',
            text: t('I scored {score} in Swiposaur!', { score: stats.score.toLocaleString('en-US') }),
          });
          setShareState('shared');
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setShareState('shared');
    } catch (error) {
      // Dismissing the share sheet is a choice, not a failure.
      const aborted = error instanceof Error && error.name === 'AbortError';
      setShareState(aborted ? 'idle' : 'error');
    }
  };

  const shareLabel =
    shareState === 'shared'
      ? t('SHARE CARD SAVED')
      : shareState === 'error'
        ? t('SHARE NOT AVAILABLE')
        : t('SHARE THIS RIDE');

  const getReasonBadge = () => {
    if (stats.gameOverReason === 'BUSTED') {
      return {
        label: t('STAMPEDE BUSTED!'),
        sub: t('Caught by the Enraged Stampede Mob!'),
        bg: 'from-[#EF4444] to-[#B91C1C]',
        border: 'border-[#FCA5A5]',
      };
    }
    if (stats.gameOverReason === 'EXHAUSTED') {
      return {
        label: t('OUT OF ENERGY!'),
        sub: t('Tail-whip critters along the run to recharge stamina!'),
        bg: 'from-[#F59E0B] to-[#D97706]',
        border: 'border-[#FDE68A]',
      };
    }
    return {
      label: t('RUN COMPLETED!'),
      sub: t('Dashed {meters} meters across the resort!', {
        meters: Math.round(stats.distanceRun),
      }),
      bg: 'from-[#10B981] to-[#047857]',
      border: 'border-[#A7F3D0]',
    };
  };

  const reasonInfo = getReasonBadge();

  return (
    <div className="absolute inset-0 bg-black/65 backdrop-blur-md flex flex-col items-center overflow-y-auto z-50 pointer-events-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] select-none animate-fadeIn font-['Fredoka']">
      <div className="w-full max-w-sm sm:max-w-md flex flex-col items-center my-auto">
        {/* Title Header: 3D Vector 'GAME OVER' matching SWIPOSAUR Logo */}
        <div className="text-center mb-1 flex flex-col items-center w-full">
          <GameOverTitle3D className="mb-0.5" />

          {/* Outcome Reason Pill Badge */}
          <div
            className={`mt-2 px-3.5 py-1 bg-gradient-to-r ${reasonInfo.bg} border-2 ${reasonInfo.border} rounded-full text-white font-['Lilita_One'] text-xs sm:text-sm tracking-wider uppercase shadow-[0_4px_12px_rgba(0,0,0,0.5)]`}
          >
            {reasonInfo.label}
          </div>

          <p className="text-xs sm:text-sm font-medium text-[#FED7AA] mt-1.5 drop-shadow">
            {reasonInfo.sub}
          </p>
        </div>

        {/* Results Card */}
        <div className="w-full bg-gradient-to-b from-[#2A1E14] via-[#1E1712] to-[#140F0C] border-3 border-[#F97316] rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.8)] flex flex-col items-center text-[#FFF8E7]">
          {/* Final Score */}
          <span className="text-[11px] text-[#FED7AA] uppercase font-bold tracking-widest mb-0.5">
            {t('Final Dinosaur Score')}
          </span>
          <span className="font-['Lilita_One'] text-4xl sm:text-5xl text-white tracking-tight mb-3 drop-shadow">
            {stats.score.toLocaleString()}
          </span>

          {/* New Record Banner */}
          {isNewBest && (
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-[#FBBF24] to-[#F59E0B] text-black rounded-full text-xs font-['Lilita_One'] shadow-md animate-pulse mb-3 border border-white/40">
              <LeaderboardAdvancedIcon className="w-4 h-4 shrink-0 drop-shadow-xs" />
              <span>{t('NEW PERSONAL BEST!')}</span>
            </div>
          )}

          {stats.leaderboardStatus === 'local' && stats.localRank && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F97316]/20 border border-[#F97316]/60 text-[#FED7AA] rounded-full text-xs font-['Lilita_One'] mb-3">
              <Award className="w-4 h-4" />
              <span>{t('LOCAL RANK #{rank}', { rank: stats.localRank })}</span>
            </div>
          )}

          {stats.leaderboardStatus === 'pending' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/25 text-[#FED7AA] rounded-full text-xs font-['Lilita_One'] mb-3">
              <span>{t('Submitting score…')}</span>
            </div>
          )}

          {stats.leaderboardStatus === 'submitted' && stats.globalRank && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#10B981]/25 border border-[#10B981]/60 text-[#34D399] rounded-full text-xs font-['Lilita_One'] mb-3">
              <Award className="w-4 h-4" />
              <span>{t('GLOBAL RANK #{rank}', { rank: stats.globalRank })}</span>
            </div>
          )}

          {stats.leaderboardStatus === 'failed' && (
            <div className="w-full bg-[#7F1D1D]/40 border-2 border-[#EF4444]/60 rounded-2xl px-3 py-2 mb-3 text-center">
              <p className="text-xs text-[#FECACA] font-medium">{t('Saved locally \u2014 not submitted online.')}</p>
              {onRetryLeaderboard && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onRetryLeaderboard();
                  }}
                  className="mt-1.5 text-[11px] font-['Lilita_One'] tracking-wider uppercase underline underline-offset-2 text-[#FEF08A] cursor-pointer"
                >
                  {t('Retry submission')}
                </button>
              )}
            </div>
          )}

          {/* 4 Stats Cards */}
          <div className="w-full bg-[#19110B] border-2 border-white/10 rounded-2xl p-3 grid grid-cols-4 gap-2 text-center mb-5">
            <div>
              <div className="text-[10px] text-[#FED7AA] font-bold uppercase">{t('Tail-Whips')}</div>
              <div className="text-lg text-white font-['Lilita_One'] mt-0.5">
                {stats.slapsCount}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-[#FED7AA] font-bold uppercase">{t('Max Roar')}</div>
              <div className="text-lg text-[#F43F5E] font-['Lilita_One'] mt-0.5">
                {stats.maxCombo}x
              </div>
            </div>

            <div>
              <div className="text-[10px] text-[#FED7AA] font-bold uppercase">{t('Dino Coins')}</div>
              <div className="text-lg text-white font-['Lilita_One'] mt-0.5">
                +{stats.coins}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-[#FED7AA] font-bold uppercase">{t('Distance')}</div>
              <div className="text-lg text-[#38BDF8] font-['Lilita_One'] mt-0.5">
                {Math.round(stats.distanceRun)}m
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                sounds.playStart();
                onRestart();
              }}
              className="w-full py-3.5 px-5 bg-gradient-to-b from-[#FFA726] via-[#FB8C00] to-[#E65100] hover:from-[#FFB74D] hover:to-[#EF6C00] text-white font-['Lilita_One'] text-base sm:text-lg tracking-wider uppercase rounded-2xl border-3 border-[#FFE082] shadow-[0_5px_0px_#BF360C] active:translate-y-1 active:shadow-[0_1px_0px_#BF360C] cursor-pointer transition-all flex items-center justify-center gap-2 drop-shadow"
            >
              <RotateCcw className="w-5 h-5 stroke-[2.5]" />
              <span>{t('RUN AGAIN')}</span>
            </button>

            {onRetryWithBoost && retryBoostAvailable && (
              <button
                type="button"
                onClick={() => {
                  sounds.playCoin();
                  onRetryWithBoost();
                }}
                className="w-full py-2.5 px-4 bg-gradient-to-b from-[#10B981] to-[#047857] hover:from-[#34D399] hover:to-[#059669] text-white font-['Lilita_One'] text-sm tracking-wider uppercase rounded-2xl border-2 border-[#A7F3D0] shadow-[0_3px_0px_#064E3B] active:translate-y-0.5 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <BatteryCharging className="w-4 h-4" />
                <span>{t('RETRY WITH +20 STAMINA')}</span>
              </button>
            )}

            {onRetryWithBoost && !retryBoostAvailable && retryBoostLabel && (
              <p className="text-center text-[10px] font-['Lilita_One'] tracking-wider uppercase text-[#FED7AA]/70">
                {t('Stamina boost back in {time}', { time: retryBoostLabel })}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={shareState === 'working'}
              className="w-full py-2.5 px-4 bg-gradient-to-b from-[#38BDF8] to-[#0369A1] hover:from-[#7DD3FC] hover:to-[#0284C7] disabled:opacity-60 disabled:cursor-wait text-white rounded-2xl font-['Lilita_One'] text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all border-2 border-[#BAE6FD] shadow-[0_3px_0_#075985] active:translate-y-0.5 active:shadow-[0_1px_0_#075985]"
            >
              {shareState === 'working' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : shareState === 'shared' ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>{shareLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onHome();
              }}
              className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-[#FFF8E7] rounded-2xl font-['Lilita_One'] text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/15 active:scale-95"
            >
              <Home className="w-4 h-4 text-[#FED7AA]" />
              <span>{t('MAIN MENU')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
