import React from 'react';
import { X, Heart, ShieldAlert, Zap, Compass, Keyboard, Flame, Coins, Smartphone } from 'lucide-react';
import { sounds } from '../game/SoundEngine.ts';
import { DinoVectorIcon } from './GameIcons.tsx';
import { t, useLanguage } from '../game/i18n.ts';

interface GuideModalProps {
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ onClose }) => {
  useLanguage();
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sounds.playClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 md:p-6 select-none pointer-events-auto touch-auto animate-fadeIn font-['Fredoka']"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gradient-to-b from-[#2A1E14] via-[#1E1712] to-[#140F0C] border-3 border-[#F97316] shadow-[0_12px_36px_rgba(0,0,0,0.8)] rounded-3xl max-w-lg w-full p-5 max-h-[90dvh] flex flex-col overflow-hidden text-[#FFF8E7] relative pointer-events-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#F97316]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#FFA726] to-[#E65100] border-2 border-[#FFE082] rounded-2xl flex items-center justify-center shadow-md">
              <DinoVectorIcon className="w-7 h-7" bodyColor="#FEF08A" bellyColor="#FFF" />
            </div>
            <div>
              <h2 className="font-['Lilita_One'] text-xl text-[#FEF08A] tracking-wider leading-none">
                {t('DINO SURVIVAL GUIDE')}
              </h2>
              <p className="text-xs text-[#FED7AA] font-medium mt-1">
                {t('How to tail-whip, dodge stampedes & trigger Primal Roars')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sounds.playClick();
              onClose();
            }}
            aria-label={t('Close')}
            className="w-9 h-9 bg-[#EF4444] hover:bg-[#F87171] text-white border-2 border-white/40 shadow-md active:scale-95 rounded-2xl flex items-center justify-center cursor-pointer transition-all"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Rules */}
        <div className="overflow-y-auto pr-1 space-y-3 my-3">
          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-[#19110B] border-2 border-[#10B981]/50 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 font-['Lilita_One'] text-sm text-[#10B981] mb-1">
                <Zap className="w-4 h-4 fill-[#10B981]" />
                <span>{t('TAIL-WHIP CRITTERS')}</span>
              </div>
              <p className="text-xs text-[#FED7AA]/90 leading-relaxed">
                {t('Whack cheeky dodos, crabs & beach cavemen as you sprint past! Each hit boosts your Dino Energy and builds your Roar combo!')}
              </p>
            </div>

            <div className="p-3.5 bg-[#19110B] border-2 border-[#EF4444]/50 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 font-['Lilita_One'] text-sm text-[#EF4444] mb-1">
                <DinoVectorIcon className="w-4 h-4" bodyColor="#EF4444" bellyColor="#FECACA" />
                <span>{t('ESCAPE STAMPEDES')}</span>
              </div>
              <p className="text-xs text-[#FED7AA]/90 leading-relaxed">
                {t("Missing too many targets enrages the chasing stampede mob! Don't let them catch up to your tail or you'll get Busted!")}
              </p>
            </div>

            <div className="p-3.5 bg-[#19110B] border-2 border-[#FBBF24]/50 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 font-['Lilita_One'] text-sm text-[#FEF08A] mb-1">
                <Flame className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                <span>{t('PRIMAL ROAR FEVER')}</span>
              </div>
              <p className="text-xs text-[#FED7AA]/90 leading-relaxed">
                {t('Fill the Mayhem Meter to ignite 16x score multiplier and invincible sprint boost with party fireworks!')}
              </p>
            </div>

            <div className="p-3.5 bg-[#19110B] border-2 border-[#38BDF8]/50 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 font-['Lilita_One'] text-sm text-[#38BDF8] mb-1">
                <Coins className="w-4 h-4 fill-[#38BDF8] text-[#38BDF8]" />
                <span>{t('COLLECT DINO COINS')}</span>
              </div>
              <p className="text-xs text-[#FED7AA]/90 leading-relaxed">
                {t('Grab golden fossils and coins across the track to unlock new party dinosaurs in the paddock!')}
              </p>
            </div>
          </div>

          {/* Controls Box */}
          <div className="p-3.5 bg-[#19110B] border-2 border-white/10 rounded-2xl">
            <h3 className="font-['Lilita_One'] text-xs text-[#FEF08A] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-[#38BDF8]" />
              <span>{t('CONTROLS CHEAT SHEET')}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 rounded-lg bg-black/60 border border-white/20 text-[#FEF08A] font-['Lilita_One']">SPACE</kbd>
                <span>{t('Jump & Tail-Whip')}</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 rounded-lg bg-black/60 border border-white/20 text-[#38BDF8] font-['Lilita_One']">A / D</kbd>
                <span>{t('Swerve Lanes')}</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 rounded-lg bg-black/60 border border-white/20 text-[#34D399] font-['Lilita_One']">W / ↑</kbd>
                <span>{t('Sprint Jump')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#FED7AA] flex items-center gap-1"><Smartphone className="w-3.5 h-3.5 text-[#38BDF8]" /> {t('Mobile:')}</span>
                <span>{t('Swipe & Tap buttons')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={() => {
            sounds.playStart();
            onClose();
          }}
          className="w-full py-3 px-5 bg-gradient-to-b from-[#FFA726] to-[#E65100] hover:from-[#FFB74D] hover:to-[#EF6C00] text-white font-['Lilita_One'] text-base tracking-wider uppercase rounded-2xl border-2 border-[#FFE082] shadow-md cursor-pointer active:scale-95 transition-all text-center"
        >
          {t('READY FOR MAYHEM!')}
        </button>
      </div>
    </div>
  );
};
