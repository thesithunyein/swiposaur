import React, { useState } from 'react';
import { X, Trophy, Coins, Check, Lock } from 'lucide-react';
import { GameStats } from '../game/types.ts';
import { ACHIEVEMENTS_LIST, Achievement, loadAchievementStorage } from '../game/achievements.ts';
import { sounds } from '../game/SoundEngine.ts';
import { t, useLanguage } from '../game/i18n.ts';
import { AchievementVectorIcon } from './GameIcons.tsx';

interface AchievementsModalProps {
  stats: GameStats;
  totalCoins: number;
  unlockedLevel: number;
  totalStars: number;
  unlockedSkinsCount: number;
  onCoinsClaimed: (coins: number) => void;
  onClose: () => void;
}

const CLAIMED_KEY = 'slap_run_claimed_achievements';

function loadClaimedAchievements(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CLAIMED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveClaimedAchievement(id: string): void {
  const current = loadClaimedAchievements();
  current[id] = true;
  try {
    localStorage.setItem(CLAIMED_KEY, JSON.stringify(current));
  } catch {}
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  stats,
  totalCoins,
  unlockedLevel,
  totalStars,
  unlockedSkinsCount,
  onCoinsClaimed,
  onClose,
}) => {
  // Subscribing re-renders the screen when the language changes.
  useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [unlockedMap, setUnlockedMap] = useState<Record<string, boolean>>(() => loadAchievementStorage());
  const [claimedMap, setClaimedMap] = useState<Record<string, boolean>>(() => loadClaimedAchievements());

  const categories = [
    { id: 'all', label: 'All Trophies' },
    { id: 'slap', label: 'Tail Slaps' },
    { id: 'survival', label: 'Survival' },
    { id: 'speed', label: 'Speed & Combo' },
    { id: 'milestone', label: 'Milestones' },
  ];

  const handleClaim = (ach: Achievement) => {
    sounds.playCoin();
    sounds.playAchievement();
    saveClaimedAchievement(ach.id);
    setClaimedMap((prev) => ({ ...prev, [ach.id]: true }));
    onCoinsClaimed(ach.rewardCoins);
  };

  const filteredAchievements = ACHIEVEMENTS_LIST.filter((a) => {
    if (activeCategory === 'all') return true;
    return a.category === activeCategory;
  });

  const unlockedCount = ACHIEVEMENTS_LIST.filter((a) => unlockedMap[a.id]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none animate-fadeIn font-['Fredoka']">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-gradient-to-b from-[#2A1E14] via-[#1E1712] to-[#140F0C] border-3 border-[#F97316] shadow-[0_12px_36px_rgba(0,0,0,0.85)] rounded-3xl text-[#FFF8E7] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-[#19110B] border-b-2 border-[#F97316]/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white flex items-center justify-center border-2 border-[#FEF08A] rounded-2xl shadow-md">
              <Trophy className="w-6 h-6 fill-[#FEF08A] text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-['Lilita_One'] text-xl sm:text-2xl font-bold text-[#FEF08A] tracking-wider">
                  {t('DINO TROPHIES & BADGES')}
                </h2>
                <span className="text-xs font-['Lilita_One'] bg-[#10B981] text-white px-2 py-0.5 rounded-full border border-white/40">
                  {unlockedCount} / {ACHIEVEMENTS_LIST.length}
                </span>
              </div>
              <span className="text-xs text-[#FED7AA] font-medium block">
                {t('Unlock achievements to earn bonus Dino Gold Coins')}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center bg-[#EF4444] hover:bg-[#F87171] text-white border-2 border-white/40 shadow-md active:scale-95 rounded-2xl cursor-pointer transition-all"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center gap-1.5 p-2.5 bg-[#120A05] border-b border-white/10 overflow-x-auto scrollbar-none">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                sounds.playClick();
                setActiveCategory(c.id);
              }}
              className={`px-3 py-1.5 rounded-xl font-['Lilita_One'] text-xs shrink-0 transition-all border ${
                activeCategory === c.id
                  ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white border-[#FEF08A] shadow-md'
                  : 'bg-[#24170E] text-[#FED7AA] hover:bg-[#322013] border-white/10'
              }`}
            >
              {t(c.label)}
            </button>
          ))}
        </div>

        {/* Achievement List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {filteredAchievements.map((ach) => {
            const isUnlocked = Boolean(unlockedMap[ach.id]);
            const isClaimed = Boolean(claimedMap[ach.id]);

            return (
              <div
                key={ach.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-r from-[#2F1F13] to-[#1F140C] border-[#F97316]/70 shadow-sm'
                    : 'bg-[#180E07]/60 border-white/10 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 shadow-xs shrink-0 ${
                      isUnlocked
                        ? 'bg-[#3E2514] border-[#FBBF24]'
                        : 'bg-black/40 border-white/15 grayscale'
                    }`}
                  >
                    {isUnlocked ? (
                      <AchievementVectorIcon iconKey={ach.icon} className="w-6 h-6" />
                    ) : (
                      <Lock className="w-5 h-5 text-white/40" />
                    )}
                  </div>

                  <div>
                    <h3 className="font-['Lilita_One'] text-base text-white flex items-center gap-2">
                      <span>{t(ach.title)}</span>
                      {isUnlocked && (
                        <span className="text-[10px] bg-[#10B981] text-white px-1.5 py-0.2 rounded-md font-sans font-bold">
                          {t('DONE')}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#FED7AA]/80 leading-snug">
                      {t(ach.description)}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <div className="flex items-center gap-1 font-['Lilita_One'] text-xs font-bold text-[#FACC15] bg-[#2D1B0F] border border-[#F59E0B]/60 px-2 py-1 rounded-xl">
                    <Coins className="w-3.5 h-3.5 fill-[#FACC15]" />
                    <span>+{ach.rewardCoins}</span>
                  </div>

                  {isUnlocked && !isClaimed && (
                    <button
                      onClick={() => handleClaim(ach)}
                      className="px-3 py-1.5 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#34D399] hover:to-[#10B981] text-white font-['Lilita_One'] text-xs rounded-xl flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer border border-white/20 animate-pulse"
                    >
                      <Trophy className="w-3.5 h-3.5 text-[#FEF08A] fill-[#FEF08A]" />
                      <span>{t('CLAIM')}</span>
                    </button>
                  )}

                  {isUnlocked && isClaimed && (
                    <div className="flex items-center gap-1 font-['Lilita_One'] text-xs text-[#10B981] bg-[#10B981]/15 px-2.5 py-1 rounded-xl border border-[#10B981]/40">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{t('CLAIMED')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#160E08] border-t border-white/10 flex items-center justify-between text-xs text-[#FED7AA]">
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[#FBBF24] fill-[#FBBF24] shrink-0" />
            <span>{t('Complete trophies during runs to claim Dino Gold')}</span>
          </span>
          <span className="font-['Lilita_One'] text-[#FBBF24]">
            {t('Total Gold Bank: {coins}', { coins: totalCoins })}
          </span>
        </div>
      </div>
    </div>
  );
};
