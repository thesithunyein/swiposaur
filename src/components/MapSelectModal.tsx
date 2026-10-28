import React from 'react';
import { X, Check, Lock, Compass } from 'lucide-react';
import { GAME_MAPS, MapDefinition } from '../game/maps.ts';
import { t } from '../game/i18n.ts';
import { sounds } from '../game/SoundEngine.ts';
import { BiomeGraphicPreview } from './BiomeGraphicPreview.tsx';
import { PalmVectorIcon, IslandBiomes3DIcon } from './GameIcons.tsx';

interface MapSelectModalProps {
  currentMapId: string;
  highestLevel: number;
  onSelectMap: (map: MapDefinition) => void;
  onClose: () => void;
}

export const MapSelectModal: React.FC<MapSelectModalProps> = ({
  currentMapId,
  highestLevel,
  onSelectMap,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md select-none animate-fadeIn font-['Fredoka']">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-gradient-to-b from-[#2A1E14] via-[#1E1712] to-[#140F0C] border-3 border-[#F97316] shadow-[0_12px_36px_rgba(0,0,0,0.8)] rounded-3xl text-[#FFF8E7] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-[#19110B] border-b-2 border-[#F97316]/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#38BDF8] to-[#0284C7] text-white flex items-center justify-center border-2 border-[#BAE6FD] rounded-2xl shadow-md shrink-0">
              <IslandBiomes3DIcon className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] text-[#38BDF8] uppercase font-bold tracking-wider block">
                {t('Prehistoric Dino Havens')}
              </span>
              <h2 className="font-['Lilita_One'] text-xl sm:text-2xl font-bold text-[#FEF08A] tracking-wider">
                {t('EXPLORE ISLAND BIOMES')}
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            aria-label={t('Close')}
            className="w-9 h-9 flex items-center justify-center bg-[#EF4444] hover:bg-[#F87171] text-white border-2 border-white/40 shadow-md active:scale-95 rounded-2xl cursor-pointer transition-all"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Subheader */}
        <div className="px-5 py-2.5 bg-[#140D08] border-b border-white/10 text-xs flex items-center justify-between text-[#FED7AA] font-medium">
          <span>{t('Run through 6 tropical prehistoric habitats with dynamic weather & obstacles')}</span>
          <span className="text-[#FBBF24] font-['Lilita_One'] text-sm">
            {t('Lv. {level} Explorer', { level: highestLevel })}
          </span>
        </div>

        {/* Maps Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {GAME_MAPS.map((map) => {
            const isUnlocked = highestLevel >= map.unlockLevel;
            const isSelected = map.id === currentMapId;

            return (
              <div
                key={map.id}
                className={`relative flex flex-col justify-between p-4 rounded-2xl border-2 transition-all ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#432A15] to-[#2B1B0E] border-[#FBBF24] ring-2 ring-[#FBBF24]/50 shadow-[0_6px_18px_rgba(251,191,36,0.25)]'
                    : isUnlocked
                    ? 'bg-[#1D140D] border-white/15 hover:border-white/30 shadow-sm'
                    : 'bg-[#140D08]/60 opacity-60 border-dashed border-white/10'
                }`}
              >
                {/* Map Graphic Preview */}
                <div className="relative w-full mb-3 overflow-hidden border-2 border-white/20 rounded-xl group">
                  <BiomeGraphicPreview
                    mapId={map.id}
                    className={`h-28 sm:h-32 transition-transform duration-300 ${
                      !isUnlocked ? 'grayscale contrast-125 opacity-40' : 'group-hover:scale-[1.02]'
                    }`}
                  />
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-2 text-center backdrop-blur-xs">
                      <Lock className="w-6 h-6 text-[#EF4444] mb-1" />
                      <span className="text-xs text-white font-['Lilita_One'] bg-[#EF4444] px-2.5 py-1 rounded-lg border border-white/40">
                        {t('Unlock at Level {level}', { level: map.unlockLevel })}
                      </span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-[#10B981] text-white text-[11px] font-['Lilita_One'] px-2.5 py-1 rounded-xl border border-white/40 shadow-md flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{t('CURRENT BIOME')}</span>
                    </div>
                  )}
                </div>

                {/* Map Info */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-['Lilita_One'] text-base sm:text-lg text-white">
                      {t(map.name)}
                    </h3>
                    <span className="text-[11px] font-['Lilita_One'] text-[#FED7AA]/75">
                      {t(map.theme)}
                    </span>
                  </div>
                  <p className="text-xs text-[#E2E8F0]/80 line-clamp-2 leading-relaxed">
                    {t(map.tagline)}
                  </p>
                </div>

                {/* Select Button */}
                {isSelected ? (
                  <button
                    disabled
                    className="w-full py-2 bg-[#10B981]/20 border border-[#10B981] text-[#10B981] font-['Lilita_One'] text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{t('ACTIVE HABITAT')}</span>
                  </button>
                ) : isUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onSelectMap(map);
                      onClose();
                    }}
                    className="w-full py-2 bg-gradient-to-b from-[#FFA726] to-[#E65100] hover:from-[#FFB74D] hover:to-[#EF6C00] text-white font-['Lilita_One'] text-xs tracking-wider uppercase rounded-xl border border-[#FFE082] shadow-sm active:scale-95 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <Compass className="w-4 h-4" />
                    <span>{t('TRAVEL HERE')}</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2 bg-black/40 border border-white/10 text-white/30 font-['Lilita_One'] text-xs uppercase rounded-xl cursor-not-allowed"
                  >
                    {t('LOCKED BIOME')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
