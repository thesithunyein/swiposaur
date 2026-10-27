import React, { useEffect, useState } from 'react';
import {
  DAILY_REWARD_TIERS,
  DailyRewardTier,
  loadDailyRewardState,
  isDailyRewardAvailable,
  claimDailyReward,
  DailyRewardState,
} from '../game/dailyRewards.ts';
import { sounds } from '../game/SoundEngine.ts';
import { Gift, Coins, Flame, Crown, Trophy, Check, X } from 'lucide-react';
import { DinoEggIcon } from './GameIcons.tsx';
import { t, useLanguage } from '../game/i18n.ts';

interface DailyRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed: (coinsAdded: number) => void;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
  isOpen,
  onClose,
  onRewardClaimed,
}) => {
  useLanguage();
  const [state, setState] = useState<DailyRewardState>(() => loadDailyRewardState());
  const [claimedTier, setClaimedTier] = useState<DailyRewardTier | null>(null);
  const [hatching, setHatching] = useState<DailyRewardTier | null>(null);
  const [hatchPhase, setHatchPhase] = useState<'shake' | 'crack' | 'reveal'>('shake');
  const [revealedCoins, setRevealedCoins] = useState(0);
  const isAvailable = isDailyRewardAvailable();

  // The egg ceremony owns its own timers so closing the modal cannot leave a
  // queued crack sound firing into an empty screen.
  useEffect(() => {
    if (!hatching) return;
    setHatchPhase('shake');
    setRevealedCoins(0);
    sounds.playTutorialCue();

    const crackTimer = window.setTimeout(() => {
      setHatchPhase('crack');
      sounds.playEggCrack();
    }, 720);
    const revealTimer = window.setTimeout(() => {
      setHatchPhase('reveal');
      sounds.playEggHatch();
      sounds.playCoinShower(Math.min(8, Math.max(4, Math.round(hatching.coins / 20))));
    }, 1150);

    return () => {
      window.clearTimeout(crackTimer);
      window.clearTimeout(revealTimer);
    };
  }, [hatching]);

  // Count the reward up instead of snapping to the final number.
  useEffect(() => {
    if (!hatching || hatchPhase !== 'reveal') return;
    let frame = 0;
    const steps = 24;
    const target = hatching.coins;
    const timer = window.setInterval(() => {
      frame++;
      const eased = 1 - Math.pow(1 - frame / steps, 3);
      setRevealedCoins(Math.round(target * eased));
      if (frame >= steps) window.clearInterval(timer);
    }, 28);
    return () => window.clearInterval(timer);
  }, [hatching, hatchPhase]);

  if (!isOpen) return null;

  const handleClaim = () => {
    if (!isAvailable) return;
    const result = claimDailyReward();
    setState(result.updatedState);
    setClaimedTier(result.reward);
    setHatching(result.reward);
    onRewardClaimed(result.bonusCoins);
  };

  const renderEggIcon = (day: number) => {
    return <DinoEggIcon className="w-7 h-7 sm:w-8 sm:h-8" day={day} isGolden={day === 7} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md select-none animate-fadeIn font-['Fredoka']">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#2A1E14] via-[#1E1712] to-[#140F0C] border-3 border-[#F97316] shadow-[0_12px_36px_rgba(0,0,0,0.8)] rounded-3xl flex flex-col max-h-[92vh] overflow-hidden text-[#FFF8E7]">
        {/* Header */}
        <div className="bg-[#19110B] border-b-2 border-[#F97316]/40 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#FBBF24] to-[#F59E0B] border-2 border-[#FEF08A] rounded-2xl flex items-center justify-center shadow-md">
              <DinoEggIcon className="w-7 h-7" isGolden={true} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Lilita_One'] text-xl text-[#FEF08A] tracking-wider uppercase">
                  {t('DINO EGG HATCHERY')}
                </h2>
                <span className="text-[10px] font-['Lilita_One'] bg-[#10B981] text-white px-2 py-0.5 rounded-full border border-white/40">
                  {t('7-DAY STREAK')}
                </span>
              </div>
              <span className="text-xs text-[#FED7AA] font-medium block">
                {t('Log in daily to hatch dinosaur fossils & bonus coins!')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            aria-label={t('Close')}
            className="w-9 h-9 bg-[#EF4444] hover:bg-[#F87171] text-white border-2 border-white/40 shadow-md active:scale-95 rounded-2xl cursor-pointer flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Claim Alert Banner */}
        {claimedTier && (
          <div className="m-4 p-3 bg-gradient-to-r from-[#10B981]/25 to-[#059669]/25 border-2 border-[#10B981] rounded-2xl flex items-center gap-3 animate-bounce">
            <Crown className="w-6 h-6 text-[#FEF08A] shrink-0 fill-[#FEF08A]" />
            <div>
              <span className="font-['Lilita_One'] text-sm text-[#34D399] uppercase block">
                {t('EGG HATCHED!')}
              </span>
              <span className="text-xs text-white">
                {t('You collected')}{' '}
                <strong className="text-[#FEF08A]">
                  +{claimedTier.coins} {t('Coins')}
                </strong>{' '}
                {t('and maintained your streak!')}
              </span>
            </div>
          </div>
        )}

        {/* 7 Days Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto">
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5 mb-4">
            {DAILY_REWARD_TIERS.map((tier) => {
              const isPast = tier.day < state.currentDay;
              const isToday = tier.day === state.currentDay;
              const isClaimedToday = isToday && !isAvailable;
              const isUnlockable = isToday && isAvailable;

              return (
                <div
                  key={tier.day}
                  className={`relative p-2.5 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all ${
                    tier.day === 7 ? 'col-span-4 sm:col-span-1 bg-gradient-to-b from-[#F59E0B]/30 to-[#B45309]/30 border-[#FBBF24]' : ''
                  } ${
                    isUnlockable
                      ? 'bg-gradient-to-b from-[#FFA726]/30 to-[#E65100]/30 border-[#FFE082] ring-2 ring-[#FFE082]/60 scale-105 shadow-md'
                      : isPast || isClaimedToday
                      ? 'bg-[#19110B] border-[#10B981]/60'
                      : 'bg-[#1D140D] border-white/10 opacity-70'
                  }`}
                >
                  <span className="text-[10px] font-['Lilita_One'] text-[#FED7AA] uppercase">
                    {t('Day {day}', { day: tier.day })}
                  </span>

                  <div className="my-1.5 flex items-center justify-center">
                    {isPast || isClaimedToday ? (
                      <div className="w-7 h-7 rounded-full bg-[#10B981] flex items-center justify-center text-white">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : (
                      renderEggIcon(tier.day)
                    )}
                  </div>

                  <span className="font-['Lilita_One'] text-xs text-[#FEF08A]">
                    +{tier.coins}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action Button */}
          {isAvailable ? (
            <button
              type="button"
              onClick={handleClaim}
              className="w-full py-3.5 px-6 bg-gradient-to-b from-[#FFA726] via-[#FB8C00] to-[#E65100] hover:from-[#FFB74D] hover:to-[#EF6C00] text-white font-['Lilita_One'] text-lg tracking-wider uppercase rounded-2xl border-3 border-[#FFE082] shadow-[0_5px_0px_#BF360C] active:translate-y-1 active:shadow-[0_1px_0px_#BF360C] cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5 text-[#FEF08A] fill-[#FEF08A]" />
              <span>{t('HATCH TODAY\u2019S DINO EGG')}</span>
            </button>
          ) : (
            <div className="w-full py-3 px-4 bg-[#19110B] border-2 border-white/10 rounded-2xl text-center text-xs text-[#FED7AA] font-medium flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span>
                {t('Today\u2019s Dino Egg is already hatched! Come back tomorrow for Day {day}!', {
                  day: Math.min(7, state.currentDay + 1),
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Egg hatch ceremony: the reward is already banked, this is the reveal. */}
      {hatching && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('Egg hatching reward')}
          className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#0B0704]/95 backdrop-blur-md select-none animate-fadeIn"
        >
          <div className="relative w-full max-w-sm text-center">
            <span className="inline-block bg-[#F59E0B] text-[#2A1508] font-['Lilita_One'] text-[10px] tracking-[0.2em] uppercase px-3 py-1 rounded-full mb-2">
              {t('Dino Egg Hatchery')}
            </span>
            <h3 className="font-['Lilita_One'] text-xl text-[#FEF08A] tracking-wider uppercase">
              {t(hatchPhase === 'reveal' ? 'Egg Hatched!' : 'Hatching...')}
            </h3>

            <div
              className="relative mx-auto mt-1 h-64 w-60"
              style={
                hatchPhase === 'shake'
                  ? { animation: 'egg-wobble 0.55s ease-in-out infinite' }
                  : undefined
              }
            >
              <div
                className={`absolute inset-6 rounded-full blur-2xl transition-all duration-700 ${
                  hatchPhase === 'reveal' ? 'bg-[#F59E0B]/60 scale-110' : 'bg-[#F59E0B]/20'
                }`}
              />

              <svg viewBox="0 0 200 240" className="relative w-full h-full overflow-visible" aria-hidden="true">
                <defs>
                  <linearGradient id="hatchEggTop" x1="0%" y1="0%" x2="35%" y2="100%">
                    <stop offset="0%" stopColor="#FFF7D6" />
                    <stop offset="55%" stopColor="#FDE68A" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                  <linearGradient id="hatchEggBottom" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FDE68A" />
                    <stop offset="60%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#B45309" />
                  </linearGradient>
                  <radialGradient id="hatchGlow" cx="50%" cy="55%" r="55%">
                    <stop offset="0%" stopColor="#FEF9C3" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <ellipse cx="100" cy="226" rx="58" ry="9" fill="#000000" opacity="0.4" />
                {hatchPhase === 'reveal' && <circle cx="100" cy="130" r="74" fill="url(#hatchGlow)" />}

                {/* Bottom shell half with a jagged crack line. */}
                <g
                  style={{
                    transform:
                      hatchPhase === 'crack'
                        ? 'translate(0px, 5px)'
                        : hatchPhase === 'reveal'
                          ? 'translate(0px, 22px)'
                          : 'translate(0px, 0px)',
                    transition: 'transform 480ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                    transformBox: 'fill-box',
                    transformOrigin: '50% 100%',
                  }}
                >
                  <path
                    d="M26 122 L52 114 L76 128 L100 112 L124 128 L148 114 L174 122 C174 186 140 222 100 222 C60 222 26 186 26 122 Z"
                    fill="url(#hatchEggBottom)"
                    stroke="#7C2D12"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                  <circle cx="62" cy="160" r="10" fill="#10B981" opacity="0.75" />
                  <circle cx="128" cy="176" r="7" fill="#10B981" opacity="0.6" />
                  <path d="M88 150 l12 -8 l12 8 l-6 12 h-12 z" fill="#FEF3C7" opacity="0.85" />
                </g>

                {/* Top shell half. */}
                <g
                  style={{
                    transform:
                      hatchPhase === 'crack'
                        ? 'translate(-8px, -14px) rotate(-7deg)'
                        : hatchPhase === 'reveal'
                          ? 'translate(-28px, -52px) rotate(-24deg)'
                          : 'translate(0px, 0px)',
                    transition: 'transform 480ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                    transformBox: 'fill-box',
                    transformOrigin: '50% 100%',
                  }}
                >
                  <path
                    d="M100 18 C58 18 26 62 26 122 L52 114 L76 128 L100 112 L124 128 L148 114 L174 122 C174 62 142 18 100 18 Z"
                    fill="url(#hatchEggTop)"
                    stroke="#7C2D12"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                  <circle cx="76" cy="68" r="9" fill="#10B981" opacity="0.7" />
                  <circle cx="124" cy="86" r="6" fill="#10B981" opacity="0.55" />
                  <path d="M104 48 l9 -6 l9 6 l-4 10 h-10 z" fill="#FEF3C7" opacity="0.8" />
                </g>
              </svg>

              {/* Coins that burst out of the opened shell. */}
              {hatchPhase === 'reveal' &&
                Array.from({ length: 9 }).map((_, index) => {
                  const angle = (-Math.PI / 2) + (index - 4) * 0.33;
                  const distance = 84 + (index % 3) * 22;
                  return (
                    <span
                      key={index}
                      className="absolute left-1/2 top-[58%] w-6 h-6 rounded-full border-2 border-[#FEF3C7] shadow-[0_0_12px_rgba(251,191,36,0.8)] pointer-events-none"
                      style={
                        {
                          background:
                            'radial-gradient(circle at 35% 30%, #FEF9C3, #FBBF24 45%, #B45309 100%)',
                          '--coin-x': `${Math.cos(angle) * distance}px`,
                          '--coin-y': `${Math.sin(angle) * distance}px`,
                          animation: `coin-pop 900ms cubic-bezier(0.15, 0.75, 0.3, 1) ${index * 45}ms forwards`,
                        } as React.CSSProperties
                      }
                    />
                  );
                })}
            </div>

            <div className="h-16 flex flex-col items-center justify-center">
              {hatchPhase === 'reveal' ? (
                <>
                  <div className="font-['Lilita_One'] text-3xl text-[#FEF08A] drop-shadow">
                    +{revealedCoins} {t('COINS')}
                  </div>
                  <div className="text-[11px] text-[#FED7AA] font-medium">
                    {t('Added to your dino bank')}
                  </div>
                </>
              ) : (
                <div className="font-['Lilita_One'] text-sm text-[#FED7AA] tracking-widest uppercase animate-pulse">
                  {t(hatchPhase === 'shake' ? 'The egg is wobbling...' : 'CRACK!')}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={hatchPhase !== 'reveal'}
              onClick={() => {
                sounds.playClick();
                setHatching(null);
              }}
              className="w-full py-3 px-6 bg-gradient-to-b from-[#FFA726] via-[#FB8C00] to-[#E65100] disabled:opacity-40 disabled:cursor-not-allowed text-white font-['Lilita_One'] text-base tracking-wider uppercase rounded-2xl border-3 border-[#FFE082] shadow-[0_5px_0_#BF360C] disabled:shadow-none active:translate-y-1 active:shadow-[0_1px_0_#BF360C] transition-all"
            >
              {t('Collect Reward')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
