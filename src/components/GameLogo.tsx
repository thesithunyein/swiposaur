import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * The wordmark is SVG <text> set in Lilita One (and, under Burmese, led by
 * Aka 08), and those faces only exist once their font files have arrived —
 * before that the letters paint in a fallback and visibly flip, which reads as
 * "the logo isn't there yet". Hold the banner until the logo faces are really
 * available, with a hard timeout so a blocked font CDN can never leave the
 * logo hidden.
 */
function useLogoFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') {
      setReady(true);
      return;
    }

    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setReady(true);
    };
    const failsafe = window.setTimeout(reveal, 1500);

    // Under Burmese, Aka 08 leads every font stack (including the SVG
    // wordmark), so its Latin glyphs are what the logo first paints with.
    const wanted: Array<Promise<unknown>> = [
      document.fonts.load("900 68px 'Lilita One'", 'SWIPOSAUR'),
      document.fonts.load("700 24px 'Fredoka'", 'TAIL FRENZY'),
    ];
    if (document.documentElement.lang === 'my') {
      wanted.push(document.fonts.load("400 48px 'Aka08'", 'SWIPOSAUR'));
    }

    Promise.all(wanted)
      .then(reveal)
      .catch(reveal);

    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
    };
  }, []);

  return ready;
}

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
  interactive?: boolean;
}

/**
 * Pure Vector 3D Dinosaur Emblem Mark (Head with Party Shades & Tropical Leaves)
 * 100% Code-rendered SVG - Zero <img> tags, zero raster assets, crisp on all screens.
 */
export const SwiposaurVectorMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none ${className}`}
    role="img"
    aria-label="Swiposaur 3D Dino Emblem"
  >
    <defs>
      <linearGradient id="markCrest" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FF5722" />
        <stop offset="45%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#991B1B" />
      </linearGradient>
      <linearGradient id="markSkin" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#F87171" />
        <stop offset="40%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#B91C1C" />
      </linearGradient>
      <linearGradient id="markBelly" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="markLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ADE80" />
        <stop offset="60%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="markShades" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#312E81" />
        <stop offset="50%" stopColor="#1E1B4B" />
        <stop offset="100%" stopColor="#0F172A" />
      </linearGradient>
      <linearGradient id="goldRim" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FDE047" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <filter id="markDropShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>

    {/* Ground Shadow */}
    <ellipse cx="60" cy="110" rx="46" ry="7" fill="#000000" opacity="0.35" />

    {/* Tropical Leaves behind head */}
    <g filter="url(#markDropShadow)">
      {/* Left Leaf Frond */}
      <path
        d="M26 86C10 76 6 58 14 44C24 46 30 58 34 72C42 62 52 64 56 70C44 80 34 88 26 86Z"
        fill="url(#markLeaf)"
        stroke="#064E3B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Right Leaf Frond */}
      <path
        d="M94 86C110 76 114 58 106 44C96 46 90 58 86 72C78 62 68 64 64 70C76 80 86 88 94 86Z"
        fill="url(#markLeaf)"
        stroke="#064E3B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>

    {/* Dinosaur Dorsal Spikes / Crown */}
    <g filter="url(#markDropShadow)">
      <polygon points="60,6 74,32 46,32" fill="url(#markCrest)" stroke="#450A0A" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="32,18 48,40 22,40" fill="url(#markCrest)" stroke="#450A0A" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="88,18 98,40 72,40" fill="url(#markCrest)" stroke="#450A0A" strokeWidth="3" strokeLinejoin="round" />
      <polygon points="12,38 26,54 6,54" fill="url(#markCrest)" stroke="#450A0A" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points="108,38 114,54 94,54" fill="url(#markCrest)" stroke="#450A0A" strokeWidth="2.5" strokeLinejoin="round" />
    </g>

    {/* Dinosaur Head Shape */}
    <g filter="url(#markDropShadow)">
      <path
        d="M60 26C34 26 22 46 22 68C22 88 38 104 60 104C82 104 98 88 98 68C98 46 86 26 60 26Z"
        fill="url(#markSkin)"
        stroke="#450A0A"
        strokeWidth="3.5"
      />
      {/* Golden Highlight Belly Arc */}
      <path
        d="M38 74C38 92 48 100 60 100C72 100 82 92 82 74C74 78 66 80 60 80C54 80 46 78 38 74Z"
        fill="url(#markBelly)"
        stroke="#78350F"
        strokeWidth="2"
      />
    </g>

    {/* Dino Party Sunglasses (Cool 3D Shades) */}
    <g filter="url(#markDropShadow)">
      {/* Shades Bridge */}
      <rect x="52" y="55" width="16" height="6" rx="2" fill="#FBBF24" stroke="#451A03" strokeWidth="2" />
      {/* Left Glass Frame & Lens */}
      <rect x="25" y="48" width="31" height="20" rx="6" fill="url(#markShades)" stroke="#FBBF24" strokeWidth="2.5" />
      {/* Right Glass Frame & Lens */}
      <rect x="64" y="48" width="31" height="20" rx="6" fill="url(#markShades)" stroke="#FBBF24" strokeWidth="2.5" />
      {/* Specular White Glare on Sunglasses */}
      <path d="M28 52L40 52L33 64L28 64Z" fill="#FFFFFF" opacity="0.45" />
      <path d="M67 52L79 52L72 64L67 64Z" fill="#FFFFFF" opacity="0.45" />
      <circle cx="51" cy="53" r="1.5" fill="#FFFFFF" opacity="0.8" />
      <circle cx="90" cy="53" r="1.5" fill="#FFFFFF" opacity="0.8" />
    </g>

    {/* Nostrils */}
    <ellipse cx="54" cy="74" rx="2" ry="3" fill="#450A0A" />
    <ellipse cx="66" cy="74" rx="2" ry="3" fill="#450A0A" />

    {/* Big Happy Dino Smile with Sharp Teeth */}
    <path
      d="M40 82C46 90 74 90 80 82"
      stroke="#450A0A"
      strokeWidth="3.5"
      strokeLinecap="round"
      fill="none"
    />
    {/* Cute Dino Fangs */}
    <polygon points="46,82 50,82 48,87" fill="#FFFFFF" stroke="#450A0A" strokeWidth="1" />
    <polygon points="74,82 70,82 72,87" fill="#FFFFFF" stroke="#450A0A" strokeWidth="1" />
  </svg>
);

/**
 * 3D Interactive Vector Logo Component: SWIPOSAUR: TAIL FRENZY
 * Built entirely with SVG vector paths and CSS 3D transformation depth.
 * Zero raster image tags, interactive tilt physics, glossy specular gleam, and tropical tiki details.
 */
export const Swiposaur3DLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  interactive = true,
}) => {
  const fontsReady = useLogoFontsReady();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number; isHover: boolean }>({
    x: 0,
    y: 0,
    isHover: false,
  });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      x: -y * 18, // Pitch
      y: x * 22,  // Yaw
      isHover: true,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0, isHover: false });
  }, []);

  const bannerSizes = {
    sm: 'max-w-[240px]',
    md: 'max-w-md sm:max-w-lg',
    lg: 'max-w-xl',
    hero: 'max-w-2xl',
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={interactive ? handleMouseMove : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
      className={`relative flex flex-col items-center select-none w-full ${bannerSizes[size]} ${className}`}
      style={{
        perspective: '1000px',
        // Hidden for the few hundred ms it takes the wordmark face to load, so
        // the full logo — letters included — appears in one piece.
        opacity: fontsReady ? 1 : 0,
        transition: 'opacity 320ms ease-out',
      }}
    >
      {/* 3D Extruded Transform Container */}
      <div
        className="w-full relative transition-transform duration-200 ease-out"
        style={{
          transform: interactive && tilt.isHover
            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.03, 1.03, 1.03)`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
          transformStyle: 'preserve-3d',
        }}
      >
        <svg
          viewBox="30 0 560 185"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label="SWIPOSAUR: TAIL FRENZY 3D Vector Logo"
        >
          <defs>
            <style>{`
              .swiposaur-3d-text {
                font-family: 'Lilita One', 'Fredoka', cursive, sans-serif !important;
              }
            `}</style>
            {/* Top Spikes Gradient */}
            <linearGradient id="crestRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF4336" />
              <stop offset="50%" stopColor="#DC2626" />
              <stop offset="100%" stopColor="#7F1D1D" />
            </linearGradient>
            <linearGradient id="crestHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFA39E" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>

            {/* Tropical Leaves Gradient */}
            <linearGradient id="jungleLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="45%" stopColor="#16A34A" />
              <stop offset="100%" stopColor="#14532D" />
            </linearGradient>
            <linearGradient id="leafVeinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#86EFAC" />
              <stop offset="100%" stopColor="#15803D" />
            </linearGradient>

            {/* Golden 3D Letter Fill Gradients */}
            <linearGradient id="goldTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="15%" stopColor="#FEF08A" />
              <stop offset="45%" stopColor="#FACC15" />
              <stop offset="80%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="goldBevelLight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="goldDeepExtrude" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#92400E" />
              <stop offset="100%" stopColor="#451A03" />
            </linearGradient>

            {/* Tiki Plank Wood Gradients */}
            <linearGradient id="tikiPlankGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="25%" stopColor="#EA580C" />
              <stop offset="75%" stopColor="#C2410C" />
              <stop offset="100%" stopColor="#7C2D12" />
            </linearGradient>
            <linearGradient id="tikiMaskWood" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#9A3412" />
            </linearGradient>
          </defs>

          {/* ======================================================== */}
          {/* LAYER 2: 5 Red Prehistoric Dinosaur Crest Spikes */}
          {/* ======================================================== */}
          <g>
            {/* Center Spike (Tallest) */}
            <polygon
              points="310,2 334,58 286,58"
              fill="url(#crestRedGrad)"
              stroke="#3F0708"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <polygon points="310,6 317,54 303,54" fill="url(#crestHighlight)" opacity="0.6" />

            {/* Left Mid Spike */}
            <polygon
              points="248,16 276,64 224,64"
              fill="url(#crestRedGrad)"
              stroke="#3F0708"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <polygon points="248,20 256,60 240,60" fill="url(#crestHighlight)" opacity="0.6" />

            {/* Right Mid Spike */}
            <polygon
              points="372,16 400,64 348,64"
              fill="url(#crestRedGrad)"
              stroke="#3F0708"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <polygon points="372,20 380,60 364,60" fill="url(#crestHighlight)" opacity="0.6" />

            {/* Outer Left Small Spike */}
            <polygon
              points="190,32 216,72 170,72"
              fill="url(#crestRedGrad)"
              stroke="#3F0708"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* Outer Right Small Spike */}
            <polygon
              points="430,32 450,72 404,72"
              fill="url(#crestRedGrad)"
              stroke="#3F0708"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </g>

          {/* ======================================================== */}
          {/* LAYER 3: Tropical Jungle Foliage (Palms & Hibiscus) */}
          {/* ======================================================== */}
          {/* Left Palm Leaves */}
          <g>
            <path
              d="M72 104C34 82 28 46 50 28C72 38 80 64 82 88C98 64 124 66 134 84C110 106 88 116 72 104Z"
              fill="url(#jungleLeafGrad)"
              stroke="#064E3B"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d="M50 28C68 52 74 76 82 88" stroke="url(#leafVeinGrad)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M82 88C100 80 114 78 134 84" stroke="url(#leafVeinGrad)" strokeWidth="2.5" strokeLinecap="round" />

            {/* Left Tropical Hibiscus Flower */}
            <circle cx="106" cy="106" r="14" fill="#F43F5E" stroke="#881337" strokeWidth="2.5" />
            <circle cx="106" cy="106" r="6" fill="#FBBF24" />
            <circle cx="106" cy="106" r="3" fill="#FFFBEB" />
          </g>

          {/* Right Palm Leaves */}
          <g>
            <path
              d="M548 104C586 82 592 46 570 28C548 38 540 64 538 88C522 64 496 66 486 84C510 106 532 116 548 104Z"
              fill="url(#jungleLeafGrad)"
              stroke="#064E3B"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d="M570 28C552 52 546 76 538 88" stroke="url(#leafVeinGrad)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M538 88C520 80 506 78 486 84" stroke="url(#leafVeinGrad)" strokeWidth="2.5" strokeLinecap="round" />

            {/* Right Tropical Hibiscus Flower */}
            <circle cx="514" cy="106" r="14" fill="#F43F5E" stroke="#881337" strokeWidth="2.5" />
            <circle cx="514" cy="106" r="6" fill="#FBBF24" />
            <circle cx="514" cy="106" r="3" fill="#FFFBEB" />
          </g>

          {/* ======================================================== */}
          {/* LAYER 4: 3D EXTRUDED LETTERING "SWIPOSAUR" */}
          {/* Multi-pass depth extrusion stack creating genuine 3D block letters */}
          {/* ======================================================== */}
          <g transform="translate(310, 96)">
            {/* 3D Black Outer Shadow & Silhouette */}
            <text
              x="0"
              y="16"
              textAnchor="middle"
              className="swiposaur-3d-text"
              fontSize="68"
              fontWeight="900"
              fill="#180A04"
              stroke="#180A04"
              strokeWidth="14"
              strokeLinejoin="round"
              letterSpacing="2.5"
            >
              SWIPOSAUR
            </text>

            {/* 3D Extrusion Stack Layers (from deepest to nearest) */}
            {[12, 10, 8, 6, 4].map((offsetY, idx) => (
              <text
                key={offsetY}
                x="0"
                y={offsetY}
                textAnchor="middle"
                className="swiposaur-3d-text"
                fontSize="68"
                fontWeight="900"
                fill={idx < 2 ? '#451A03' : idx < 3 ? '#78350F' : '#92400E'}
                stroke={idx < 2 ? '#451A03' : '#78350F'}
                strokeWidth={idx < 2 ? '10' : '6'}
                strokeLinejoin="round"
                letterSpacing="2.5"
              >
                SWIPOSAUR
              </text>
            ))}

            {/* Front Extrusion Lip (#B45309) */}
            <text
              x="0"
              y="2"
              textAnchor="middle"
              className="swiposaur-3d-text"
              fontSize="68"
              fontWeight="900"
              fill="#B45309"
              letterSpacing="2.5"
            >
              SWIPOSAUR
            </text>

            {/* Front Letter Face with Rich Tropical Gold Gradient */}
            <text
              x="0"
              y="0"
              textAnchor="middle"
              className="swiposaur-3d-text"
              fontSize="68"
              fontWeight="900"
              fill="url(#goldTopGrad)"
              stroke="#451A03"
              strokeWidth="3.5"
              letterSpacing="2.5"
              style={{ paintOrder: 'stroke fill' }}
            >
              SWIPOSAUR
            </text>

            {/* Top Glossy Bevel Accent */}
            <text
              x="0"
              y="-1"
              textAnchor="middle"
              className="swiposaur-3d-text"
              fontSize="68"
              fontWeight="900"
              fill="none"
              stroke="url(#goldBevelLight)"
              strokeWidth="1.2"
              letterSpacing="2.5"
              opacity="0.85"
            >
              SWIPOSAUR
            </text>
          </g>

          {/* ======================================================== */}
          {/* LAYER 5: Carved Tiki Wood Plank Banner for "DINO MAYHEM" */}
          {/* ======================================================== */}
          <g transform="translate(135, 126)">
            {/* Carved Wooden Plank Body with Rings */}
            <rect
              x="0"
              y="0"
              width="350"
              height="48"
              rx="18"
              fill="url(#tikiPlankGrad)"
              stroke="#FEF08A"
              strokeWidth="3.5"
            />

            {/* Wood Grain Carving Details */}
            <path d="M42 12C60 10 90 14 110 11" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M230 36C260 38 290 35 312 37" stroke="#7C2D12" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="85" cy="34" r="3.5" fill="#7C2D12" />
            <circle cx="280" cy="14" r="3" fill="#7C2D12" />

            {/* Left Tribal Tiki Mask Totem */}
            <g transform="translate(12, 5)">
              <rect x="0" y="0" width="28" height="38" rx="7" fill="url(#tikiMaskWood)" stroke="#FEF08A" strokeWidth="2" />
              {/* Tiki Forehead Leaf Headdress */}
              <polygon points="14,1 19,7 9,7" fill="#22C55E" />
              {/* Glowing Eyes */}
              <circle cx="9" cy="14" r="3.5" fill="#FEF08A" stroke="#7C2D12" strokeWidth="1" />
              <circle cx="19" cy="14" r="3.5" fill="#FEF08A" stroke="#7C2D12" strokeWidth="1" />
              <circle cx="9" cy="14" r="1.5" fill="#000000" />
              <circle cx="19" cy="14" r="1.5" fill="#000000" />
              {/* Toothy Tiki Grin */}
              <rect x="6" y="24" width="16" height="8" rx="2" fill="#FFFFFF" stroke="#7C2D12" strokeWidth="1.5" />
              <line x1="14" y1="24" x2="14" y2="32" stroke="#7C2D12" strokeWidth="1.5" />
              <line x1="10" y1="24" x2="10" y2="32" stroke="#7C2D12" strokeWidth="1.5" />
              <line x1="18" y1="24" x2="18" y2="32" stroke="#7C2D12" strokeWidth="1.5" />
            </g>

            {/* Right Tribal Tiki Mask Totem */}
            <g transform="translate(310, 5)">
              <rect x="0" y="0" width="28" height="38" rx="7" fill="url(#tikiMaskWood)" stroke="#FEF08A" strokeWidth="2" />
              {/* Tiki Forehead Leaf Headdress */}
              <polygon points="14,1 19,7 9,7" fill="#22C55E" />
              {/* Glowing Eyes */}
              <circle cx="9" cy="14" r="3.5" fill="#FEF08A" stroke="#7C2D12" strokeWidth="1" />
              <circle cx="19" cy="14" r="3.5" fill="#FEF08A" stroke="#7C2D12" strokeWidth="1" />
              <circle cx="9" cy="14" r="1.5" fill="#000000" />
              <circle cx="19" cy="14" r="1.5" fill="#000000" />
              {/* Toothy Tiki Grin */}
              <rect x="6" y="24" width="16" height="8" rx="2" fill="#FFFFFF" stroke="#7C2D12" strokeWidth="1.5" />
              <line x1="14" y1="24" x2="14" y2="32" stroke="#7C2D12" strokeWidth="1.5" />
              <line x1="10" y1="24" x2="10" y2="32" stroke="#7C2D12" strokeWidth="1.5" />
              <line x1="18" y1="24" x2="18" y2="32" stroke="#7C2D12" strokeWidth="1.5" />
            </g>

            {/* Subtitle Embossed Text: ★ TAIL FRENZY ★ */}
            <text
              x="175"
              y="33"
              textAnchor="middle"
              fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
              fontSize="24"
              fontWeight="900"
              fill="#FFFFFF"
              stroke="#541B07"
              strokeWidth="4"
              letterSpacing="3"
              style={{ paintOrder: 'stroke fill' }}
            >
              ★ TAIL FRENZY ★
            </text>
            {/* Golden Star Accents */}
            <text
              x="175"
              y="32"
              textAnchor="middle"
              fontFamily="'Lilita One', 'Fredoka', cursive, sans-serif"
              fontSize="24"
              fontWeight="900"
              fill="#FFFDF0"
              letterSpacing="3"
            >
              ★ TAIL FRENZY ★
            </text>
          </g>
        </svg>
      </div>

      {/* Optional Motivational Tagline */}
      {showSubtitle && (
        <div className="mt-2 text-center pointer-events-none">
          <span className="font-['Fredoka'] text-xs sm:text-sm font-bold text-[#FEF08A] tracking-wider uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
            Tail-Whip Prehistoric Critters · Escape The Stampede · Primal Roar
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Standard exported aliases - all using pure 2D/3D code rendering without any <img> tags!
 */
export const SwiposaurVectorBanner = Swiposaur3DLogo;
export const SwiposaurLogo = Swiposaur3DLogo;
export const SwiposaurMark = SwiposaurVectorMark;
export const GameLogoBanner = Swiposaur3DLogo;
export const GameLogoIcon = SwiposaurVectorMark;

export default Swiposaur3DLogo;
