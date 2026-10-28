import React, { useState } from 'react';
import { CharacterSkin } from '../game/types.ts';
import { CHARACTER_SKINS } from '../game/constants.ts';
import { sounds } from '../game/SoundEngine.ts';
import { t } from '../game/i18n.ts';
import { Check, Lock, Coins, X, Zap, Sparkles } from 'lucide-react';
import { Dino3DPreview } from './Dino3DPreview.tsx';
import { Paddock3DIcon, DinoAvatar3DIcon } from './GameIcons.tsx';

interface SkinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSkin: CharacterSkin;
  unlockedSkinIds: string[];
  totalCoins: number;
  onSelectSkin: (skin: CharacterSkin) => void;
  onUnlockSkin: (skin: CharacterSkin) => void;
}

export const SkinsModal: React.FC<SkinsModalProps> = ({
  isOpen,
  onClose,
  selectedSkin,
  unlockedSkinIds,
  totalCoins,
  onSelectSkin,
  onUnlockSkin,
}) => {
  // Only display the 6 authentic prehistoric dinosaurs
  const primaryDinos = CHARACTER_SKINS.filter(
    (s) => !['speedy_dash', 'market_ninja', 'golden_champ'].includes(s.id)
  );

  const [previewSkin, setPreviewSkin] = useState<CharacterSkin>(selectedSkin);

  if (!isOpen) return null;

  const isPreviewUnlocked = unlockedSkinIds.includes(previewSkin.id);
  const isPreviewSelected = selectedSkin.id === previewSkin.id;
  const canAffordPreview = totalCoins >= previewSkin.cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-fadeIn font-['Fredoka']">
      <div className="relative w-full max-w-3xl bg-gradient-to-b from-[#251A12] via-[#1A120D] to-[#120B07] border-3 border-[#F97316] shadow-[0_16px_48px_rgba(0,0,0,0.85)] rounded-3xl flex flex-col max-h-[94vh] overflow-hidden text-[#FFF8E7]">
        {/* Header */}
        <div className="bg-[#140D08] border-b-2 border-[#F97316]/40 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-[#FFA726] to-[#E65100] border-2 border-[#FFE082] rounded-2xl flex items-center justify-center shadow-md shrink-0">
              <Paddock3DIcon className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h2 className="font-['Lilita_One'] text-lg sm:text-2xl text-[#FEF08A] tracking-wider uppercase drop-shadow">
                {t('3D DINO PADDOCK')}
              </h2>
              <span className="text-[11px] sm:text-xs text-[#FED7AA] font-medium block">
                {t('Select your 3D dinosaur runner for live gameplay')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Coins badge */}
            <div className="bg-[#2D1B0F] text-[#FACC15] px-3 py-1 sm:px-3.5 sm:py-1.5 border-2 border-[#F59E0B] rounded-2xl shadow-sm flex items-center gap-1.5 font-['Lilita_One'] text-xs sm:text-sm">
              <Coins className="w-4 h-4 fill-[#FACC15]" />
              <span>{totalCoins.toLocaleString()}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              aria-label={t('Close')}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-[#EF4444] hover:bg-[#F87171] text-white border-2 border-white/40 shadow-md active:scale-95 rounded-2xl cursor-pointer flex items-center justify-center transition-all"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Content: 3D Dinosaur Stage + Selector Grid */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
          {/* Left/Top: Live Interactive 3D Dinosaur Stage */}
          <div className="w-full md:w-5/12 flex flex-col items-center justify-between p-4 bg-gradient-to-b from-[#1E140D] to-[#120B07] shrink-0">
            {/* Active Species Badge & Stats */}
            <div className="w-full flex items-center justify-between mb-1">
              <span className="font-['Lilita_One'] text-base sm:text-lg text-white">
                {t(previewSkin.name)}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#FACC15] bg-[#2D1B0F] border border-[#F59E0B]/50 px-2 py-0.5 rounded-lg">
                <Zap className="w-3 h-3 fill-[#FACC15]" />
                {previewSkin.speedBonus > 0
                  ? t('+{pct}% Speed', { pct: Math.round(previewSkin.speedBonus * 100) })
                  : t('Base Speed')}
              </span>
            </div>

            <p className="text-[11px] text-[#FED7AA]/80 text-left w-full line-clamp-2 mb-2">
              {t(previewSkin.tagline)}
            </p>

            {/* 3D WebGL Canvas */}
            <div className="w-full h-44 sm:h-52 rounded-2xl bg-black/40 border-2 border-[#F97316]/30 overflow-hidden relative shadow-inner">
              <Dino3DPreview skin={previewSkin} />
            </div>

            {/* Primary Action Button for Previewed Dino */}
            <div className="w-full mt-3">
              {isPreviewSelected ? (
                <div className="w-full py-2.5 bg-[#10B981]/20 border-2 border-[#10B981] text-[#10B981] font-['Lilita_One'] text-xs sm:text-sm tracking-wider uppercase rounded-2xl flex items-center justify-center gap-2 shadow-sm">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t('PLAYING AS THIS DINO')}</span>
                </div>
              ) : isPreviewUnlocked ? (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onSelectSkin(previewSkin);
                  }}
                  className="w-full py-2.5 bg-gradient-to-b from-[#FFA726] to-[#E65100] hover:from-[#FFB74D] hover:to-[#EF6C00] text-white font-['Lilita_One'] text-xs sm:text-sm tracking-wider uppercase rounded-2xl border-2 border-[#FFE082] shadow-[0_4px_12px_rgba(230,81,0,0.5)] active:scale-95 cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t('SELECT {name}', { name: t(previewSkin.name) })}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canAffordPreview}
                  onClick={() => {
                    if (canAffordPreview) {
                      sounds.playCoin();
                      onUnlockSkin(previewSkin);
                    }
                  }}
                  className={`w-full py-2.5 font-['Lilita_One'] text-xs sm:text-sm tracking-wider uppercase rounded-2xl border-2 flex items-center justify-center gap-2 transition-all ${
                    canAffordPreview
                      ? 'bg-gradient-to-b from-[#10B981] to-[#047857] hover:from-[#34D399] hover:to-[#059669] text-white border-[#A7F3D0] shadow-[0_4px_12px_rgba(16,185,129,0.5)] active:scale-95 cursor-pointer'
                      : 'bg-black/50 border-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-4 h-4 fill-current" />
                  <span>{t('UNLOCK · {cost} COINS', { cost: previewSkin.cost.toLocaleString() })}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right/Bottom: Dinosaur Grid Cards */}
          <div className="w-full md:w-7/12 p-3 sm:p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {primaryDinos.map((skin) => {
              const isUnlocked = unlockedSkinIds.includes(skin.id);
              const isSelected = selectedSkin.id === skin.id;
              const isInspecting = previewSkin.id === skin.id;

              return (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setPreviewSkin(skin);
                    if (isUnlocked) {
                      onSelectSkin(skin);
                    }
                  }}
                  className={`p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                    isInspecting
                      ? 'bg-gradient-to-b from-[#3D2613] to-[#25170B] border-[#FBBF24] ring-2 ring-[#FBBF24]/50 shadow-md'
                      : isUnlocked
                      ? 'bg-[#1D140D] border-white/10 hover:border-white/25 shadow-xs'
                      : 'bg-[#150E09]/75 border-dashed border-white/10 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-2.5 w-full">
                    {/* 3D Dino Thumbnail */}
                    <div className="w-11 h-11 rounded-xl border border-white/20 bg-black/40 shrink-0 flex items-center justify-center relative shadow-sm overflow-hidden p-1">
                      <DinoAvatar3DIcon
                        className="w-8 h-8"
                        bodyColor={skin.bodyColor}
                        bellyColor={skin.shirtColor}
                        hasSpinoSail={skin.id.includes('spino')}
                        hasCrown={skin.hat === 'crown'}
                      />
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-[#CBD5E1]" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#10B981]/80 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-['Lilita_One'] text-sm text-white truncate">
                          {t(skin.name)}
                        </h4>
                        {isSelected && (
                          <span className="text-[9px] font-['Lilita_One'] bg-[#10B981] text-black px-1.5 py-0.2 rounded-full">
                            {t('ACTIVE')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#FED7AA]/70 block truncate mt-0.5">
                        {skin.speedBonus > 0
                          ? t('+{pct}% Speed', { pct: Math.round(skin.speedBonus * 100) })
                          : t('Base Speed')}
                      </span>
                      {!isUnlocked && (
                        <div className="flex items-center gap-1 text-[11px] font-['Lilita_One'] text-[#FACC15] mt-1">
                          <Coins className="w-3 h-3 fill-[#FACC15]" />
                          <span>{skin.cost.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
