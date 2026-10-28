import React, { useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import { Achievement } from '../game/achievements.ts';
import { t, useLanguage } from '../game/i18n.ts';
import { AchievementVectorIcon } from './GameIcons.tsx';

interface AchievementToastProps {
  achievement: { id: string; title: string; description?: string; icon?: string } | Achievement | null;
  onDismiss: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  achievement,
  onDismiss,
}) => {
  // Re-renders the popup when the player flips the language mid-session.
  useLanguage();

  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-[90%] sm:w-auto animate-slideDown font-['Fredoka'] pointer-events-auto">
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#2B1B0E] to-[#1E120A] border-2 border-[#FBBF24] shadow-[0_8px_24px_rgba(251,191,36,0.4)] rounded-2xl p-3.5 text-white">
        <div className="w-11 h-11 bg-gradient-to-br from-[#F59E0B] to-[#D97706] rounded-xl flex items-center justify-center border-2 border-[#FEF08A] shrink-0 shadow-sm animate-bounce">
          <AchievementVectorIcon iconKey={achievement.icon || 'trophy'} className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 pr-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-['Lilita_One'] tracking-wider text-[#FBBF24]">
            <Trophy className="w-3 h-3 fill-[#FBBF24]" />
            <span>{t('ACHIEVEMENT UNLOCKED!')}</span>
          </div>
          <h4 className="font-['Lilita_One'] text-sm sm:text-base text-white tracking-wide leading-tight">
            {t(achievement.title)}
          </h4>
          {achievement.description && (
            <p className="text-[11px] text-[#FED7AA] line-clamp-1 leading-tight">
              {t(achievement.description)}
            </p>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white cursor-pointer transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
