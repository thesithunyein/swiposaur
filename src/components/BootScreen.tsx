import React from 'react';
import { SwiposaurLogo } from './SwiposaurLogo.tsx';

interface BootScreenProps {
  progress: number;
  label: string;
  leaving: boolean;
}

const TIPS = [
  'Swipe down to tail-whip anything in your lane.',
  'Near-misses feed the Primal Roar faster than whips do.',
  'Daily bounties pay coins and bank stamina for your next run.',
  'Grab the golden egg before the stampede reaches you.',
];

/**
 * Parallax sky furniture. Positions are fixed rather than random so the scene
 * is stable across re-renders and cheap to paint (transform-only animation).
 */
const CLOUDS = [
  { id: 'high-wisp', top: '8%', width: 195, duration: 54, delay: 18, opacity: 0.5, bob: 7 },
  { id: 'mid-puff', top: '21%', width: 145, duration: 72, delay: 45, opacity: 0.38, bob: 9 },
  { id: 'low-bank', top: '34%', width: 250, duration: 88, delay: 69, opacity: 0.24, bob: 11 },
  { id: 'jungle-haze', top: '77%', width: 185, duration: 66, delay: 30, opacity: 0.16, bob: 8 },
];

/** Square pixel positions arranged into a soft, stepped cloud silhouette. */
const CLOUD_ROWS = [
  { y: 4, from: 84, to: 108 },
  { y: 16, from: 72, to: 156 },
  { y: 28, from: 48, to: 168 },
  { y: 40, from: 36, to: 168 },
  { y: 52, from: 36, to: 168 },
];
const CLOUD_BLOCKS = CLOUD_ROWS.flatMap(({ y, from, to }) =>
  Array.from({ length: Math.floor((to - from) / 12) + 1 }, (_, index) => ({ x: from + index * 12, y })),
);

const MOTES = [
  { left: 7, size: 4, duration: 13, delay: 0, drift: 22, color: '#FEF08A' },
  { left: 14, size: 3, duration: 10, delay: 4, drift: -16, color: '#FFFFFF' },
  { left: 21, size: 5, duration: 16, delay: 8, drift: 28, color: '#FDE047' },
  { left: 29, size: 3, duration: 11, delay: 2, drift: 12, color: '#A7F3D0' },
  { left: 37, size: 4, duration: 14, delay: 9, drift: -20, color: '#FEF3C7' },
  { left: 45, size: 3, duration: 9, delay: 5, drift: 18, color: '#FFFFFF' },
  { left: 53, size: 5, duration: 15, delay: 1, drift: -26, color: '#FDE047' },
  { left: 61, size: 3, duration: 12, delay: 7, drift: 16, color: '#A7F3D0' },
  { left: 68, size: 4, duration: 17, delay: 3, drift: 24, color: '#FEF08A' },
  { left: 76, size: 3, duration: 10, delay: 11, drift: -14, color: '#FFFFFF' },
  { left: 83, size: 5, duration: 14, delay: 6, drift: 20, color: '#FDE047' },
  { left: 90, size: 4, duration: 12, delay: 10, drift: -22, color: '#A7F3D0' },
  { left: 95, size: 3, duration: 15, delay: 13, drift: 14, color: '#FEF3C7' },
];

/**
 * Loading gate shown once per app launch, before the title menu.
 * Deliberately sparse: logo, one bar, one tip, plus the sky life that the
 * gameplay world has — drifting clouds and floating pollen.
 */
export const BootScreen: React.FC<BootScreenProps> = ({ progress, label, leaving }) => {
  const percent = Math.round(Math.min(100, Math.max(0, progress)));
  const tip = TIPS[Math.min(TIPS.length - 1, Math.floor(percent / 26))];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!leaving}
      aria-label="Loading Swiposaur"
      className={`boot-shell fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-[#38BDF8] px-5 ${
        leaving ? 'boot-fade-out' : ''
      }`}
    >
      {/* Flat bright-blue sky, with parallax pixel clouds and drifting square flecks. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {CLOUDS.map((cloud) => (
          <div
            key={cloud.id}
            className="boot-cloud absolute left-0"
            style={{
              top: cloud.top,
              width: cloud.width,
              opacity: cloud.opacity,
              animationDuration: `${cloud.duration}s`,
              animationDelay: `-${cloud.delay}s`,
            }}
          >
            <div
              className="boot-cloud-bob"
              style={{ animationDuration: `${cloud.bob}s`, animationDelay: `-${cloud.delay / 2}s` }}
            >
              <svg viewBox="0 0 200 64" className="boot-cloud-art block h-auto w-full" focusable="false">
                {CLOUD_BLOCKS.map(({ x, y }, index) => (
                  <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width="12"
                    height="12"
                    fill={index % 4 === 0 ? '#FFFFFF' : index % 3 === 0 ? '#D8F2FA' : '#C6EAF6'}
                  />
                ))}
              </svg>
            </div>
          </div>
        ))}

        {MOTES.map((mote) => (
          <span
            key={`${mote.left}-${mote.size}`}
            className="boot-mote absolute"
            style={
              {
                left: `${mote.left}%`,
                bottom: '-3%',
                width: mote.size + 4,
                height: mote.size + 4,
                animationDuration: `${mote.duration}s`,
                animationDelay: `-${mote.delay}s`,
                '--boot-drift': `${mote.drift}px`,
              } as React.CSSProperties
            }
          >
            <svg viewBox="0 0 8 8" className="boot-pixel" focusable="false">
              <rect width="8" height="8" fill={mote.color} />
            </svg>
          </span>
        ))}
      </div>

      <div className="boot-rise relative flex w-full max-w-[300px] flex-col items-center sm:max-w-[360px]">
        <div className="flex w-full justify-center drop-shadow-[0_10px_24px_rgba(8,47,73,0.35)]">
          <SwiposaurLogo size="hero" showSubtitle={false} interactive={false} />
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={label}
          className="mt-10 h-4 w-full overflow-hidden rounded-full border-2 border-[#FFE082] bg-[#082F49]/85 p-[2px] shadow-[0_4px_0_rgba(8,47,73,0.35),0_8px_18px_rgba(8,47,73,0.3)]"
        >
          <div
            className="h-full rounded-full bg-gradient-to-b from-[#FFA726] via-[#FB8C00] to-[#E65100] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(5, percent)}%` }}
          />
        </div>

        <p className="mt-6 min-h-[2.25rem] text-center text-[11px] leading-relaxed tracking-wide text-[#F0FDFF] drop-shadow-[0_1px_2px_rgba(8,47,73,0.55)]">
          <span className="font-bold text-[#FEF08A]">TIP · </span>
          {tip}
        </p>
      </div>
    </div>
  );
};
