import React from 'react';
import { t } from '../game/i18n.ts';

interface BiomeGraphicPreviewProps {
  mapId: string;
  className?: string;
}

export const BiomeGraphicPreview: React.FC<BiomeGraphicPreviewProps> = ({ mapId, className = '' }) => {
  switch (mapId) {
    case 'tropical_coast':
      return (
        <div className={`w-full relative bg-gradient-to-b from-[#0284C7] via-[#38BDF8] to-[#FDE68A] flex items-center justify-center overflow-hidden ${className}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-200/40 via-transparent to-transparent" />
          <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
            {/* Sun */}
            <circle cx="160" cy="35" r="24" fill="#FBBF24" opacity="0.9" />
            <circle cx="160" cy="35" r="32" fill="#FEF08A" opacity="0.3" />
            {/* Ocean Waves */}
            <path d="M0 80 Q 40 70, 80 80 T 160 80 T 240 80 T 320 80 L 320 140 L 0 140 Z" fill="#0EA5E9" />
            <path d="M0 95 Q 40 88, 80 95 T 160 95 T 240 95 T 320 95 L 320 140 L 0 140 Z" fill="#38BDF8" opacity="0.6" />
            {/* Sandy Shore */}
            <path d="M0 110 Q 80 100, 160 110 T 320 110 L 320 140 L 0 140 Z" fill="#FDE047" />
            {/* Palms */}
            <rect x="35" y="60" width="8" height="60" rx="3" fill="#B45309" />
            <circle cx="39" cy="55" r="22" fill="#10B981" />
            <rect x="280" y="65" width="8" height="55" rx="3" fill="#B45309" />
            <circle cx="284" cy="60" r="20" fill="#059669" />
            {/* Surfboard */}
            <polygon points="150,118 170,118 160,85" fill="#EF4444" stroke="#FFF" strokeWidth="2" />
          </svg>
          <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] font-['Lilita_One'] text-white">
            {t('CORAL REEF & SURFBOARD')}
          </div>
        </div>
      );

    case 'sunset_desert':
      return (
        <div className={`w-full relative bg-gradient-to-b from-[#7C2D12] via-[#EA580C] to-[#292524] flex items-center justify-center overflow-hidden ${className}`}>
          <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
            {/* Blood Orange Sun */}
            <circle cx="220" cy="40" r="28" fill="#FDE047" opacity="0.8" />
            {/* Volcanic Mountains */}
            <polygon points="40,140 110,45 180,140" fill="#431407" />
            <polygon points="120,140 190,60 260,140" fill="#7C2D12" />
            <polygon points="220,140 270,75 320,140" fill="#431407" />
            {/* Magma Cracks */}
            <path d="M100 65 Q 110 90, 115 140" stroke="#F97316" strokeWidth="3" />
            <path d="M185 80 Q 190 105, 185 140" stroke="#EF4444" strokeWidth="3" />
            <rect x="0" y="125" width="320" height="15" fill="#1C1917" />
          </svg>
          <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] font-['Lilita_One'] text-[#F97316]">
            {t('VOLCANO & MAGMA CHASM')}
          </div>
        </div>
      );

    case 'neon_night':
      return (
        <div className={`w-full relative bg-gradient-to-b from-[#090D16] via-[#1E1B4B] to-[#4C1D95] flex items-center justify-center overflow-hidden ${className}`}>
          <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
            {/* Cyber Grid */}
            <line x1="0" y1="120" x2="320" y2="120" stroke="#06B6D4" strokeWidth="2" opacity="0.6" />
            <line x1="0" y1="130" x2="320" y2="130" stroke="#EC4899" strokeWidth="2" opacity="0.7" />
            {/* Neon Skyline */}
            <rect x="40" y="50" width="30" height="70" fill="#1E293B" stroke="#06B6D4" strokeWidth="1.5" />
            <rect x="85" y="30" width="35" height="90" fill="#312E81" stroke="#EC4899" strokeWidth="1.5" />
            <rect x="135" y="45" width="40" height="75" fill="#1E293B" stroke="#A855F7" strokeWidth="1.5" />
            <rect x="190" y="20" width="45" height="100" fill="#312E81" stroke="#06B6D4" strokeWidth="1.5" />
            <rect x="250" y="40" width="35" height="80" fill="#1E293B" stroke="#EC4899" strokeWidth="1.5" />
            {/* Cyber Palms */}
            <line x1="28" y1="120" x2="28" y2="70" stroke="#06B6D4" strokeWidth="3" />
            <circle cx="28" cy="65" r="14" fill="#06B6D4" opacity="0.8" />
          </svg>
          <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] font-['Lilita_One'] text-[#06B6D4]">
            {t('SYNTHWAVE NEON METROPOLIS')}
          </div>
        </div>
      );

    case 'winter_peak':
      return (
        <div className={`w-full relative bg-gradient-to-b from-[#0F766E] via-[#0369A1] to-[#E0F2FE] flex items-center justify-center overflow-hidden ${className}`}>
          <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
            {/* Glacier Peaks */}
            <polygon points="20,140 80,35 140,140" fill="#BAE6FD" />
            <polygon points="100,140 170,25 240,140" fill="#E0F2FE" />
            <polygon points="200,140 270,40 330,140" fill="#7DD3FC" />
            {/* Snow caps */}
            <polygon points="65,65 80,35 95,65" fill="#FFFFFF" />
            <polygon points="155,55 170,25 185,55" fill="#FFFFFF" />
            {/* Pine Trees */}
            <polygon points="45,130 52,105 59,130" fill="#0F766E" />
            <polygon points="275,130 282,100 289,130" fill="#0F766E" />
            {/* Frozen Ice Road */}
            <rect x="0" y="125" width="320" height="15" fill="#F8FAFC" />
          </svg>
          <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] font-['Lilita_One'] text-[#0284C7]">
            {t('FROSTBITE GLACIER PASS')}
          </div>
        </div>
      );

    case 'golden_temple':
      return (
        <div className={`w-full relative bg-gradient-to-b from-[#3B0764] via-[#881337] to-[#FDE047] flex items-center justify-center overflow-hidden ${className}`}>
          <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
            {/* Cherry Blossom Moon */}
            <circle cx="240" cy="45" r="26" fill="#FDE047" opacity="0.9" />
            {/* Pagoda silhouette */}
            <polygon points="80,75 120,55 160,75" fill="#4C0519" />
            <rect x="95" y="75" width="50" height="20" fill="#881337" />
            <polygon points="70,100 120,80 170,100" fill="#4C0519" />
            <rect x="85" y="100" width="70" height="25" fill="#881337" />
            {/* Falling Blossom Petals */}
            <ellipse cx="60" cy="35" rx="5" ry="3" fill="#F472B6" />
            <ellipse cx="190" cy="50" rx="6" ry="4" fill="#F472B6" />
            <ellipse cx="280" cy="80" rx="5" ry="3" fill="#FDA4AF" />
            <ellipse cx="140" cy="115" rx="5" ry="3" fill="#F472B6" />
            <rect x="0" y="125" width="320" height="15" fill="#292524" />
          </svg>
          <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] font-['Lilita_One'] text-[#F43F5E]">
            {t('ANCIENT BLOSSOM SANCTUM')}
          </div>
        </div>
      );

    case 'market':
    default:
      return (
        <div className={`w-full relative bg-gradient-to-b from-[#38BDF8] via-[#7DD3FC] to-[#FBBF24] flex items-center justify-center overflow-hidden ${className}`}>
          <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
            {/* Radiant Golden Sun & Puffy Voxel Clouds */}
            <circle cx="240" cy="30" r="18" fill="#F59E0B" />
            <circle cx="240" cy="30" r="26" fill="#FEF08A" opacity="0.4" />
            {/* Voxel Clouds */}
            <rect x="40" y="22" width="45" height="14" rx="4" fill="#FFFFFF" opacity="0.9" />
            <rect x="52" y="14" width="22" height="12" rx="3" fill="#FFFFFF" opacity="0.95" />
            <rect x="130" y="32" width="38" height="12" rx="4" fill="#FFFFFF" opacity="0.85" />
            {/* Full Mediterranean Townhouses */}
            <rect x="25" y="55" width="60" height="70" fill="#B45309" />
            <polygon points="20,55 55,40 90,55" fill="#7C2D12" />
            {/* Striped Market Awning */}
            <polygon points="20,85 85,85 80,95 25,95" fill="#EF4444" />
            <rect x="95" y="45" width="70" height="80" fill="#0284C7" />
            {/* Golden Dome */}
            <ellipse cx="130" cy="45" rx="20" ry="14" fill="#FACC15" />
            <rect x="175" y="60" width="55" height="65" fill="#991B1B" />
            <polygon points="170,60 202,48 235,60" fill="#7C2D12" />
            {/* Fresh Pavement Road */}
            <rect x="0" y="125" width="320" height="15" fill="#181A24" />
          </svg>
          <div className="absolute bottom-2 left-3 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] font-['Lilita_One'] text-[#FEF08A]">
            {t('BAZAAR BOULEVARD & TOWNHOUSES')}
          </div>
        </div>
      );
  }
};
