import React, { useState, useEffect } from 'react';
import { InputState } from '../game/types.ts';
import { isTouchEnvironment } from '../game/settings.ts';
import { Hand, ArrowUp, ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { t, useLanguage } from '../game/i18n.ts';

interface TouchControlsProps {
  input: InputState;
  onSlap: () => void;
  onJump?: () => void;
  onLaneLeft?: () => void;
  onLaneRight?: () => void;
  isPaused?: boolean;
  isIntroActive?: boolean;
  showLaneButtonsSetting?: 'auto' | 'always' | 'hidden';
  onScreenControlsSetting?: 'auto' | 'always' | 'hidden';
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onSlap,
  onJump,
  onLaneLeft,
  onLaneRight,
  isIntroActive,
  onScreenControlsSetting = 'auto',
}) => {
  useLanguage();
  const [isSlapPressed, setIsSlapPressed] = useState<boolean>(false);
  const [isJumpPressed, setIsJumpPressed] = useState<boolean>(false);
  const [isLeftPressed, setIsLeftPressed] = useState<boolean>(false);
  const [isRightPressed, setIsRightPressed] = useState<boolean>(false);

  const [isTouch, setIsTouch] = useState<boolean>(() => isTouchEnvironment());

  useEffect(() => {
    const handleCheck = () => {
      setIsTouch(isTouchEnvironment());
    };
    handleCheck();
    window.addEventListener('resize', handleCheck);
    return () => window.removeEventListener('resize', handleCheck);
  }, []);

  if (onScreenControlsSetting === 'hidden') {
    return null;
  }

  const triggerHaptic = (ms: number = 14) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {}
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 sm:px-6 pointer-events-none z-30 flex items-end justify-between select-none">
      {/* Left hub: two big, unambiguous dodge buttons. Diagonal jump variants
          were removed: they duplicated LEFT/RIGHT + JUMP and stole thumb space. */}
      {isTouch && (
        <div className="flex items-end gap-2 pointer-events-auto">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsLeftPressed(true);
              triggerHaptic(12);
              if (onLaneLeft) onLaneLeft();
            }}
            onPointerUp={() => setIsLeftPressed(false)}
            onPointerCancel={() => setIsLeftPressed(false)}
            aria-label={t('Dodge left lane')}
            className={`w-20 h-15 sm:w-24 sm:h-16 rounded-2xl font-ui font-bold flex items-center justify-center gap-1.5 border-2 border-black/80 transition-all cursor-pointer touch-none select-none ${
              isLeftPressed
                ? 'bg-[#2563EB] text-white translate-y-0.5 shadow-none'
                : 'bg-gradient-to-b from-[#38BDF8] to-[#0284C7] text-slate-950 shadow-[0_4px_0_#0369A1]'
            }`}
          >
            <ArrowLeft className="w-5 h-5 stroke-[3]" />
            <span className="font-pixel text-[10px] font-bold">{t('LEFT')}</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsRightPressed(true);
              triggerHaptic(12);
              if (onLaneRight) onLaneRight();
            }}
            onPointerUp={() => setIsRightPressed(false)}
            onPointerCancel={() => setIsRightPressed(false)}
            aria-label={t('Dodge right lane')}
            className={`w-20 h-15 sm:w-24 sm:h-16 rounded-2xl font-ui font-bold flex items-center justify-center gap-1.5 border-2 border-black/80 transition-all cursor-pointer touch-none select-none ${
              isRightPressed
                ? 'bg-[#2563EB] text-white translate-y-0.5 shadow-none'
                : 'bg-gradient-to-b from-[#38BDF8] to-[#0284C7] text-slate-950 shadow-[0_4px_0_#0369A1]'
            }`}
          >
            <span className="font-pixel text-[10px] font-bold">{t('RIGHT')}</span>
            <ArrowRight className="w-5 h-5 stroke-[3]" />
          </button>
        </div>
      )}

      {/* Desktop hint stays out of the way on phones. */}
      {!isTouch && (
        <div className="hidden sm:flex items-center gap-2 bg-[#0B0D17]/85 backdrop-blur-md border border-white/15 px-3.5 py-2 text-white shadow-[0_8px_20px_rgba(0,0,0,0.5)] rounded-xl font-ui text-[11px] font-bold pointer-events-none">
          <div className="flex items-center gap-1.5">
            <kbd className="bg-slate-800 px-1.5 py-0.5 border border-slate-600 rounded text-[9px] text-[#38BDF8] font-mono">A / D</kbd>
            <span className="text-[#94A3B8]">or</span>
            <kbd className="bg-slate-800 px-1.5 py-0.5 border border-slate-600 rounded text-[9px] text-[#38BDF8] font-mono">◀ / ▶</kbd>
            <span className="text-white ml-0.5">Dodge</span>
          </div>
          <div className="w-[1px] h-3.5 bg-white/20 mx-1" />
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 border border-slate-600 rounded text-[9px] text-[#10B981] font-mono">W / ↑</kbd>
            <span className="text-[#10B981]">{t('Vault')}</span>
          </div>
          <div className="w-[1px] h-3.5 bg-white/20 mx-1" />
          <div className="flex items-center gap-1">
            <kbd className="bg-slate-800 px-1.5 py-0.5 border border-slate-600 rounded text-[9px] text-[#F43F5E] font-mono">SPACE</kbd>
            <span className="text-[#F43F5E]">{t('WHIP!')}</span>
          </div>
        </div>
      )}

      {/* Right hub: jump and the one big whip target. No captions, no duplicates. */}
      <div className="flex items-end gap-2 sm:gap-3 pointer-events-auto">
        {isTouch && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsJumpPressed(true);
              triggerHaptic(16);
              if (onJump) onJump();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsJumpPressed(false);
            }}
            onPointerCancel={() => setIsJumpPressed(false)}
            aria-label={t('Vault jump')}
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex flex-col items-center justify-center gap-0.5 border-2 border-[#A7F3D0] transition-all cursor-pointer touch-none select-none ${
              isJumpPressed
                ? 'bg-[#047857] translate-y-1 shadow-none'
                : 'bg-gradient-to-b from-[#10B981] to-[#047857] shadow-[0_4px_0_#064e3b]'
            }`}
          >
            <ArrowUp className="w-6 h-6 text-white stroke-[3]" />
            <span className="font-['Lilita_One'] text-[10px] text-white tracking-wider">
              {t('JUMP')}
            </span>
          </button>
        )}

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsSlapPressed(true);
            triggerHaptic(22);
            onSlap();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsSlapPressed(false);
          }}
          onPointerCancel={() => setIsSlapPressed(false)}
          aria-label={t('Tail-whip slap button')}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl border-3 border-[#FFE082] flex flex-col items-center justify-center gap-0.5 cursor-pointer touch-none select-none transition-all ${
            isIntroActive
              ? 'bg-gradient-to-b from-[#FFA726] to-[#D97706] animate-pulse shadow-[0_0_28px_#F59E0B]'
              : 'bg-gradient-to-b from-[#FFA726] via-[#FB8C00] to-[#E65100]'
          } ${
            isSlapPressed
              ? 'translate-y-1 shadow-none from-[#F97316] to-[#C2410C]'
              : 'shadow-[0_5px_0_#9A3412]'
          }`}
        >
          <Hand className="w-7 h-7 sm:w-8 sm:h-8 text-white stroke-[2.5] -rotate-12 filter drop-shadow" />
          <span className="font-['Lilita_One'] text-sm sm:text-base font-bold text-white tracking-wider drop-shadow flex items-center gap-1">
            {isIntroActive && <Zap className="w-3.5 h-3.5 fill-white text-white" />}
            <span>{t('WHIP!')}</span>
          </span>
        </button>
      </div>
    </div>
  );
};
