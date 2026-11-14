import React from 'react';

export type BrandAccentTone = 'salvia' | 'champan' | 'marino' | 'marfil' | 'grafito';

interface BrandLogoProps {
  collapsed?: boolean;
  darkText?: boolean;
  accentTone?: BrandAccentTone;
}

const EMBLEM_STYLES: Record<BrandAccentTone, { box: string; subtitleLight: string; subtitleDark: string }> = {
  salvia: {
    box: 'bg-gradient-to-br from-[#1E4D3B] via-[#173B2D] to-[#0F241C] border-emerald-300/40',
    subtitleLight: 'text-[#1E4D3B]',
    subtitleDark: 'text-emerald-300',
  },
  champan: {
    box: 'bg-gradient-to-br from-[#6D2434] via-[#511B27] to-[#2F1017] border-rose-200/40',
    subtitleLight: 'text-[#6D2434]',
    subtitleDark: 'text-rose-200',
  },
  marino: {
    box: 'bg-gradient-to-br from-[#1B3A5C] via-[#132942] to-[#0C1A2B] border-sky-200/40',
    subtitleLight: 'text-[#1B3A5C]',
    subtitleDark: 'text-sky-300',
  },
  marfil: {
    box: 'bg-gradient-to-br from-[#3A281E] via-[#281B14] to-[#170F0B] border-amber-300/45',
    subtitleLight: 'text-[#6D472A]',
    subtitleDark: 'text-amber-300',
  },
  grafito: {
    box: 'bg-gradient-to-br from-[#B45309] via-[#78350F] to-[#1F1712] border-amber-400/50',
    subtitleLight: 'text-amber-900',
    subtitleDark: 'text-amber-300',
  },
};

export function BrandLogo({
  collapsed = false,
  darkText = false,
  accentTone = 'salvia',
}: BrandLogoProps) {
  const emblem = EMBLEM_STYLES[accentTone] || EMBLEM_STYLES.salvia;
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Custom Stylized Carpentry & Furniture SVG Emblem */}
      <div
        className={`w-10 h-10 rounded-xl border shadow-md flex items-center justify-center shrink-0 ${emblem.box}`}
      >
        <svg
          viewBox="0 0 36 36"
          className="w-6 h-6"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Architectural cabinet / joinery silhouette in warm wood & gold */}
          <rect
            x="6"
            y="7"
            width="24"
            height="19"
            rx="2.5"
            stroke="#FDE68A"
            strokeWidth="2"
            fill="#1C1917"
            fillOpacity="0.35"
          />
          <line x1="18" y1="7" x2="18" y2="26" stroke="#FBBF24" strokeWidth="1.75" />
          <line x1="6" y1="20" x2="30" y2="20" stroke="#FBBF24" strokeWidth="1.5" />
          {/* Handles */}
          <circle cx="15" cy="14" r="1.2" fill="#FDE68A" />
          <circle cx="21" cy="14" r="1.2" fill="#FDE68A" />
          {/* Tapered solid-wood legs */}
          <path d="M9 26L7.5 31" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          <path d="M27 26L28.5 31" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div
            className={`font-serif-brand font-bold text-lg tracking-tight truncate ${
              darkText ? 'text-slate-900' : 'text-stone-50'
            }`}
          >
            Mueblería Modes
          </div>
          <div
            className={`text-[11px] font-semibold truncate ${
              darkText ? emblem.subtitleLight : emblem.subtitleDark
            }`}
          >
            Carpintería &amp; Showroom · Oruro
          </div>
        </div>
      )}
    </div>
  );
}
