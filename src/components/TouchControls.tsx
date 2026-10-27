import React, { useRef, useState, useEffect } from 'react';
import { InputState } from '../game/types.ts';
import { isTouchEnvironment } from '../game/settings.ts';
import { Hand, ArrowUp, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, Crosshair, Zap } from 'lucide-react';
import { t, useLanguage } from '../game/i18n.ts';

interface TouchControlsProps {
  input: InputState;
  onSlap: () => void;
  onJump?: () => void;
  onLaneLeft?: () => void;
  onLaneRight?: () => void;
  onJumpLeft?: () => void;
  onJumpRight?: () => void;
  isPaused?: boolean;
  isIntroActive?: boolean;
  showLaneButtonsSetting?: 'auto' | 'always' | 'hidden';
  onScreenControlsSetting?: 'auto' | 'always' | 'hidden';
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  input,
  onSlap,
  onJump,
  onLaneLeft,
  onLaneRight,
  onJumpLeft,
  onJumpRight,
  isPaused,
  isIntroActive,
  showLaneButtonsSetting = 'auto',
  onScreenControlsSetting = 'auto',
}) => {
  useLanguage();
  const [isSlapPressed, setIsSlapPressed] = useState<boolean>(false);
  const [isJumpPressed, setIsJumpPressed] = useState<boolean>(false);
  const [isLeftPressed, setIsLeftPressed] = useState<boolean>(false);
  const [isRightPressed, setIsRightPressed] = useState<boolean>(false);
  const [isJumpLeftPressed, setIsJumpLeftPressed] = useState<boolean>(false);
  const [isJumpRightPressed, setIsJumpRightPressed] = useState<boolean>(false);

  const [isTouch, setIsTouch] = useState<boolean>(() => isTouchEnvironment());
  const [controlMode, setControlMode] = useState<'dpad' | 'joystick'>('dpad');

  // Joystick state
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);

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

  // Joystick handling
  const resetJoystick = () => {
    activePointerIdRef.current = null;
    setIsJoystickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    input.keys.left = false;
    input.keys.right = false;
    input.joystick.active = false;
    input.joystick.x = 0;
  };

  const processJoystickMovement = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxRadius = rect.width * 0.42;

    const clampedDist = Math.min(distance, maxRadius);
    const angle = Math.atan2(deltaY, deltaX);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    setKnobOffset({ x: knobX, y: knobY });

    const normalizedX = knobX / maxRadius;
    const deadzone = 0.22;

    if (Math.abs(normalizedX) > deadzone) {
      input.joystick.active = true;
      input.joystick.x = normalizedX;
      if (normalizedX < 0) {
        input.keys.left = true;
        input.keys.right = false;
      } else {
        input.keys.left = false;
        input.keys.right = true;
      }
    } else {
      input.joystick.active = false;
      input.joystick.x = 0;
      input.keys.left = false;
      input.keys.right = false;
    }

    // Upward joystick pull -> Jump trigger
    if (deltaY < -maxRadius * 0.6) {
      if (onJump) onJump();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPaused || activePointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    activePointerIdRef.current = e.pointerId;
    setIsJoystickActive(true);
    processJoystickMovement(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJoystickActive || isPaused || e.pointerId !== activePointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    processJoystickMovement(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === activePointerIdRef.current) {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      resetJoystick();
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 sm:px-6 pointer-events-none z-30 flex items-end justify-between select-none">
      {/* Left Navigation Hub: Intuitive D-Pad & Jump-Steer Cluster */}
      <div className="flex flex-col items-start gap-1.5 pointer-events-auto">
        {/* Mobile Intuitive 5-Way Arcade Movement Hub */}
        {isTouch && controlMode === 'dpad' && (
          <div className="bg-[#0B0D17]/85 backdrop-blur-md border-2 border-white/10 rounded-2xl p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-col gap-1.5 animate-fadeIn">
            {/* Top Row: Diagonal Jump Left, Vault Jump, Diagonal Jump Right */}
            <div className="flex items-center gap-1.5 justify-center">
              {/* Jump Left Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsJumpLeftPressed(true);
                  triggerHaptic(18);
                  if (onJumpLeft) onJumpLeft();
                  else {
                    if (onLaneLeft) onLaneLeft();
                    if (onJump) onJump();
                  }
                }}
                onPointerUp={() => setIsJumpLeftPressed(false)}
                onPointerCancel={() => setIsJumpLeftPressed(false)}
                aria-label={t('Jump left into left lane')}
                className={`w-11 h-10 sm:w-12 sm:h-11 rounded-xl font-ui font-bold text-xs flex flex-col items-center justify-center border-2 border-black/80 transition-all cursor-pointer ${
                  isJumpLeftPressed
                    ? 'bg-[#059669] text-white translate-y-0.5 shadow-none'
                    : 'bg-gradient-to-b from-[#10B981] to-[#047857] text-white shadow-[0_3px_0_#022c22]'
                }`}
              >
                <ArrowUpLeft className="w-4 h-4 stroke-[3]" />
                <span className="text-[7px] leading-none uppercase font-bold mt-0.5">{t('Jump L')}</span>
              </button>

              {/* Straight Vault Jump Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsJumpPressed(true);
                  triggerHaptic(16);
                  if (onJump) onJump();
                }}
                onPointerUp={() => setIsJumpPressed(false)}
                onPointerCancel={() => setIsJumpPressed(false)}
                aria-label={t('Vault jump')}
                className={`w-12 h-10 sm:w-14 sm:h-11 rounded-xl font-ui font-bold text-xs flex flex-col items-center justify-center border-2 border-black/80 transition-all cursor-pointer ${
                  isJumpPressed
                    ? 'bg-[#059669] text-white translate-y-0.5 shadow-none'
                    : 'bg-gradient-to-b from-[#34D399] to-[#059669] text-black shadow-[0_3px_0_#022c22]'
                }`}
              >
                <ArrowUp className="w-4 h-4 stroke-[3]" />
                <span className="text-[7px] leading-none uppercase font-bold mt-0.5">{t('Vault')}</span>
              </button>

              {/* Jump Right Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsJumpRightPressed(true);
                  triggerHaptic(18);
                  if (onJumpRight) onJumpRight();
                  else {
                    if (onLaneRight) onLaneRight();
                    if (onJump) onJump();
                  }
                }}
                onPointerUp={() => setIsJumpRightPressed(false)}
                onPointerCancel={() => setIsJumpRightPressed(false)}
                aria-label={t('Jump right into right lane')}
                className={`w-11 h-10 sm:w-12 sm:h-11 rounded-xl font-ui font-bold text-xs flex flex-col items-center justify-center border-2 border-black/80 transition-all cursor-pointer ${
                  isJumpRightPressed
                    ? 'bg-[#059669] text-white translate-y-0.5 shadow-none'
                    : 'bg-gradient-to-b from-[#10B981] to-[#047857] text-white shadow-[0_3px_0_#022c22]'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 stroke-[3]" />
                <span className="text-[7px] leading-none uppercase font-bold mt-0.5">Jmp R</span>
              </button>
            </div>

            {/* Bottom Row: Large Tactile Dodge Left & Dodge Right Buttons */}
            <div className="flex items-center gap-1.5 justify-center">
              {/* Dodge Left */}
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
                className={`w-18 h-12 sm:w-20 sm:h-13 rounded-xl font-ui font-bold text-xs flex items-center justify-center gap-1 border-2 border-black/80 transition-all cursor-pointer ${
                  isLeftPressed
                    ? 'bg-[#2563EB] text-white translate-y-0.5 shadow-none'
                    : 'bg-gradient-to-b from-[#38BDF8] to-[#0284C7] text-slate-950 shadow-[0_3px_0_#0369A1]'
                }`}
              >
                <ArrowLeft className="w-4 h-4 stroke-[3]" />
                <span className="font-pixel text-[9px] font-bold">{t('LEFT')}</span>
              </button>

              {/* Dodge Right */}
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
                className={`w-18 h-12 sm:w-20 sm:h-13 rounded-xl font-ui font-bold text-xs flex items-center justify-center gap-1 border-2 border-black/80 transition-all cursor-pointer ${
                  isRightPressed
                    ? 'bg-[#2563EB] text-white translate-y-0.5 shadow-none'
                    : 'bg-gradient-to-b from-[#38BDF8] to-[#0284C7] text-slate-950 shadow-[0_3px_0_#0369A1]'
                }`}
              >
                <span className="font-pixel text-[9px] font-bold">{t('RIGHT')}</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        )}

        {/* Joystick Mode Alternate */}
        {isTouch && controlMode === 'joystick' && (
          <div className="bg-[#0B0D17]/85 backdrop-blur-md border-2 border-white/10 rounded-2xl p-2 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex flex-col items-center gap-1.5 animate-fadeIn">
            <div
              ref={joystickBaseRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label="Steer joystick"
              className="w-24 h-24 bg-[#151928] border-2 border-black rounded-2xl relative flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none shadow-inner"
            >
              <div className="absolute left-1.5 text-[8px] font-pixel text-[#38BDF8] pointer-events-none">◀</div>
              <div className="absolute right-1.5 text-[8px] font-pixel text-[#38BDF8] pointer-events-none">▶</div>
              <div className="absolute top-1.5 text-[8px] font-pixel text-[#10B981] pointer-events-none">▲</div>
              <div className="absolute inset-x-4 h-[1px] bg-white/10 pointer-events-none" />

              <div
                className={`w-11 h-11 bg-gradient-to-b from-[#818CF8] to-[#4F46E5] border-2 border-black rounded-xl flex items-center justify-center shadow-[0_3px_0_#312E81] transition-transform duration-75 ${
                  isJoystickActive ? 'scale-105 from-[#A5B4FC] to-[#6366F1]' : ''
                }`}
                style={{
                  transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
                }}
              >
                <Crosshair className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Quick Mode Toggle for Mobile Users (D-Pad vs Joystick) */}
        {isTouch && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setControlMode((prev) => (prev === 'dpad' ? 'joystick' : 'dpad'));
            }}
            className="text-[8px] font-ui font-bold text-white/60 hover:text-white bg-black/60 px-2 py-0.5 rounded-md border border-white/10 tracking-wider uppercase"
          >
            {controlMode === 'dpad' ? t('Switch to Joystick') : t('Switch to D-Pad')}
          </button>
        )}

        {/* PC Keyboard Guide */}
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
      </div>

      {/* Right Control Hub: Tactile Slap & Secondary Vault Button */}
      <div className="flex items-end gap-2 sm:gap-3 pointer-events-auto">
        {/* Right Vault Jump Button (for comfortable two-thumb play) */}
        {isTouch && (
          <div className="flex flex-col items-center gap-1">
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
              aria-label="Vault jump"
              className={`w-13 h-13 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border-2 border-[#A7F3D0] transition-all cursor-pointer touch-none select-none ${
                isJumpPressed
                  ? 'bg-[#047857] translate-y-1 shadow-none'
                  : 'bg-gradient-to-b from-[#10B981] to-[#047857] shadow-[0_4px_0_#064e3b]'
              }`}
            >
              <ArrowUp className="w-5 h-5 text-white stroke-[3] mb-0.5" />
              <span className="font-['Lilita_One'] text-[9px] sm:text-[10px] text-white tracking-wider">
                {t('JUMP')}
              </span>
            </button>
            <span className="text-[8px] font-['Fredoka'] font-bold text-[#10B981] uppercase tracking-wider">
              {t('Vault')}
            </span>
          </div>
        )}

        {/* Primary Radiant TAIL-WHIP Button */}
        <div className="flex flex-col items-center gap-1">
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
            className={`w-18 h-18 sm:w-22 sm:h-22 rounded-2xl sm:rounded-3xl border-3 border-[#FFE082] flex flex-col items-center justify-center cursor-pointer touch-none select-none transition-all ${
              isIntroActive
                ? 'bg-gradient-to-b from-[#FFA726] to-[#D97706] animate-pulse shadow-[0_0_28px_#F59E0B]'
                : 'bg-gradient-to-b from-[#FFA726] via-[#FB8C00] to-[#E65100]'
            } ${
              isSlapPressed
                ? 'translate-y-1 shadow-none from-[#F97316] to-[#C2410C]'
                : 'shadow-[0_5px_0_#9A3412]'
            }`}
          >
            <Hand className="w-6 h-6 sm:w-8 sm:h-8 text-white stroke-[2.5] -rotate-12 mb-0.5 filter drop-shadow" />
            <span className="font-['Lilita_One'] text-xs sm:text-sm font-bold text-white tracking-wider drop-shadow flex items-center gap-1">
              {isIntroActive && <Zap className="w-3.5 h-3.5 fill-white text-white" />}
              <span>{t('WHIP!')}</span>
            </span>
          </button>
          <span className="text-[8px] font-['Fredoka'] font-bold text-white/90 uppercase tracking-wider">
            {t(isIntroActive ? 'Hit Target' : 'Tail-Whip')}
          </span>
        </div>
      </div>
    </div>
  );
};
