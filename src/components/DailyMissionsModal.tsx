import React, { useState } from 'react';
import {
  DailyMission,
  claimDailyMission,
  formatMissionProgress,
  getNextResetLabel,
  loadDailyMissions,
  MISSIONS_PER_DAY,
} from '../game/dailyMissions.ts';
import { sounds } from '../game/SoundEngine.ts';
import { Target, Coins, Check, X, Footprints, Flame, Clock, Zap, BatteryCharging } from 'lucide-react';
import { DinoVectorIcon, Missions3DIcon } from './GameIcons.tsx';

interface DailyMissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRewardClaimed: (coinsAdded: number, staminaAdded: number) => void;
}

/**
 * Five rotating missions per day, reset at midnight Myanmar time.
 *
 * Every mission can be claimed on its own, so finishing the hard one does not
 * wait on the easy one, and the five objectives cover different play styles.
 */
export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  isOpen,
  onClose,
  onRewardClaimed,
}) => {
  const [missions, setMissions] = useState<DailyMission[]>(() => loadDailyMissions());
  const [resetCountdown, setResetCountdown] = useState<string>(() => getNextResetLabel());

  React.useEffect(() => {
    if (!isOpen) return;
    setMissions(loadDailyMissions());
    setResetCountdown(getNextResetLabel());
    const timer = window.setInterval(() => setResetCountdown(getNextResetLabel()), 30000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClaim = (missionId: string) => {
    sounds.playCoin();
    sounds.playAchievement();
    const result = claimDailyMission(missionId);
    if (result.success) {
      setMissions([...result.missions]);
      onRewardClaimed(result.rewardCoins, result.bonusStamina);
    }
  };

  const completedCount = missions.filter((mission) => mission.completed).length;
  const claimedCount = missions.filter((mission) => mission.claimed).length;

  const renderIcon = (type: DailyMission['iconType']) => {
    switch (type) {
      case 'slap':
        return <Zap className="w-5 h-5 text-[#FACC15] fill-[#FACC15]" />;
      case 'run':
        return <Footprints className="w-5 h-5 text-[#34D399]" />;
      case 'fever':
        return <Flame className="w-5 h-5 text-[#F97316] fill-[#F97316]" />;
      case 'coin':
        return <Coins className="w-5 h-5 text-[#FACC15] fill-[#FACC15]" />;
      case 'escape':
        return <DinoVectorIcon className="w-5 h-5 text-white" bodyColor="#10B981" bellyColor="#D1FAE5" />;
      default:
        return <Target className="w-5 h-5 text-[#EF4444]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-fadeIn font-['Fredoka']">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#241911] via-[#1A120D] to-[#120B07] border-3 border-[#F97316] shadow-[0_16px_48px_rgba(0,0,0,0.85)] rounded-3xl flex flex-col max-h-[90vh] overflow-hidden text-[#FFF8E7]">
        {/* Header */}
        <div className="bg-[#140D08] border-b-2 border-[#F97316]/40 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#FFA726] to-[#E65100] border-2 border-[#FFE082] rounded-2xl flex items-center justify-center shadow-md shrink-0">
              <Missions3DIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Lilita_One'] text-xl text-[#FEF08A] tracking-wider uppercase">
                  DAILY MISSIONS
                </h2>
                <span className="text-xs font-['Lilita_One'] text-[#FED7AA]">
                  ({completedCount}/{MISSIONS_PER_DAY})
                </span>
              </div>
              <span className="text-xs text-[#FED7AA] font-medium block">
                Five bounties a day, resetting at midnight
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            aria-label="Close"
            className="w-8 h-8 sm:w-9 sm:h-9 bg-[#EF4444] hover:bg-[#F87171] text-white border-2 border-white/40 shadow-md active:scale-95 rounded-2xl cursor-pointer flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Mission list */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5">
          {missions.map((mission) => {
            const percent = Math.min(100, Math.round((mission.current / mission.target) * 100));

            return (
              <div
                key={mission.id}
                className={`p-3.5 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all ${
                  mission.completed && !mission.claimed
                    ? 'bg-gradient-to-r from-[#1E2B1E] to-[#142015] border-[#10B981] ring-1 ring-[#10B981]/50 shadow-sm'
                    : mission.claimed
                    ? 'bg-[#150E09]/70 border-white/10 opacity-70'
                    : 'bg-[#1D140D] border-white/15'
                }`}
              >
                <div className="w-10 h-10 bg-[#2D1B0F] border border-white/20 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                  {renderIcon(mission.iconType)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-['Lilita_One'] text-sm sm:text-base text-white tracking-wide truncate">
                      {mission.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-0.5 font-['Lilita_One'] text-[11px] text-[#FACC15]">
                        <Coins className="w-3 h-3 fill-[#FACC15]" />+{mission.rewardCoins}
                      </span>
                      <span className="flex items-center gap-0.5 font-['Lilita_One'] text-[11px] text-[#34D399]">
                        <BatteryCharging className="w-3 h-3" />+{mission.bonusStamina}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] sm:text-xs text-[#FED7AA]/90 font-medium leading-snug mb-1.5">
                    {mission.description}
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          mission.completed
                            ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                            : 'bg-gradient-to-r from-[#FFA726] to-[#FB8C00]'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="font-['Lilita_One'] text-[11px] text-white shrink-0 tabular-nums">
                      {formatMissionProgress(mission)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 pl-1">
                  {mission.claimed ? (
                    <div className="flex items-center gap-1 font-['Lilita_One'] text-[11px] text-[#10B981] bg-[#10B981]/15 px-2.5 py-1 rounded-xl border border-[#10B981]/40">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>DONE</span>
                    </div>
                  ) : mission.completed ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(mission.id)}
                      className="px-3.5 py-1.5 bg-gradient-to-b from-[#10B981] to-[#047857] hover:from-[#34D399] hover:to-[#059669] text-white border border-[#A7F3D0] shadow-sm active:scale-95 rounded-xl font-['Lilita_One'] text-xs flex items-center gap-1 cursor-pointer transition-all animate-pulse"
                    >
                      <span>CLAIM</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-['Lilita_One'] text-[#94A3B8] px-2 py-1 bg-black/30 rounded-lg">
                      {percent}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="bg-[#140D08] border-t-2 border-[#F97316]/40 px-5 py-3 flex items-center justify-between text-xs text-[#FED7AA] font-medium shrink-0">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
            Resets at midnight (Myanmar)
          </span>
          <span className="text-[#38BDF8] font-['Lilita_One'] text-xs tracking-wider">
            {claimedCount}/{MISSIONS_PER_DAY} claimed · {resetCountdown} left
          </span>
        </div>
      </div>
    </div>
  );
};
