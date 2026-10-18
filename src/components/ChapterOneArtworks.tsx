import React from 'react';

/**
 * High-fidelity vector artworks matching the "CHAPTER / ONE" aesthetic
 * shown in the design mockup:
 * 1. The Quiet Sea (Navy ocean, terracotta shoreline, pale moon)
 * 2. A Brighter Day (Linen canvas, botanical branch, terracotta sun)
 * 3. The Last Horizon (Midnight indigo, crescent moon, starry sky)
 * 4. Small Departures (Warm terracotta & sienna desert dunes)
 * 5. Minimalist Mountain & Sun Landscape (Left poster illustration)
 */

interface CoverArtProps {
  className?: string;
  title?: string;
  subtitle?: string;
}

// 1. "THE QUIET SEA" Cover Artwork
export function QuietSeaCover({ className = '', title = 'THE QUIET SEA', subtitle = 'A NOVEL' }: CoverArtProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl select-none shadow-sm aspect-[3/4] bg-[#F3EDE2] ${className}`}>
      <svg viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover">
        <defs>
          <linearGradient id="qs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EFE8DC" />
            <stop offset="100%" stopColor="#F5EFEB" />
          </linearGradient>
          <linearGradient id="qs-sea" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E2F3D" />
            <stop offset="50%" stopColor="#172633" />
            <stop offset="100%" stopColor="#101C26" />
          </linearGradient>
          <linearGradient id="qs-terra" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#C45A3C" />
            <stop offset="100%" stopColor="#A84328" />
          </linearGradient>
          <linearGradient id="qs-hill-right" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CF6548" />
            <stop offset="100%" stopColor="#9C3A20" />
          </linearGradient>
        </defs>

        {/* Sky Background */}
        <rect width="300" height="400" fill="url(#qs-sky)" />

        {/* Glowing Pale Full Moon */}
        <circle cx="150" cy="110" r="32" fill="#FAF6EE" />
        <circle cx="150" cy="110" r="46" fill="#FAF6EE" fillOpacity="0.25" />

        {/* Distant Mountain Peak */}
        <path d="M70 200 L150 145 L230 200 Z" fill="#D8CFBF" fillOpacity="0.4" />

        {/* Right Terracotta Mountain Slope */}
        <path d="M160 170 C190 150 240 180 300 160 L300 240 L160 220 Z" fill="url(#qs-hill-right)" />

        {/* Left Terracotta Foreground Dune/Ridge */}
        <path
          d="M0 160 C40 180 90 190 120 220 C100 280 50 320 0 340 Z"
          fill="url(#qs-terra)"
        />

        {/* Deep Textured Ocean / The Quiet Sea */}
        <path
          d="M0 215 C60 210 120 230 180 220 C240 210 270 225 300 220 L300 400 L0 400 Z"
          fill="url(#qs-sea)"
        />

        {/* Painterly Ocean Ripples & Wave Highlights */}
        <path d="M40 250 C80 245 130 255 170 250" stroke="#3D5A73" strokeWidth="2" strokeLinecap="round" />
        <path d="M120 275 C160 270 220 280 260 275" stroke="#3D5A73" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M30 310 C90 305 160 315 220 310" stroke="#3D5A73" strokeWidth="2" strokeLinecap="round" />
        <path d="M90 345 C150 340 230 350 280 345" stroke="#2B4356" strokeWidth="2" strokeLinecap="round" />
        <path d="M140 235 C170 232 200 236 220 233" stroke="#FAF6EE" strokeWidth="1" strokeOpacity="0.4" strokeLinecap="round" />

        {/* Bottom Left Terracotta Foreground Beach */}
        <path
          d="M0 290 C30 280 70 300 90 330 C100 350 80 380 50 400 L0 400 Z"
          fill="#B84F33"
        />

        {/* Embedded Title Overlay in Serif */}
        <g className="select-none">
          <text
            x="150"
            y="265"
            textAnchor="middle"
            fill="#FAF6EE"
            fontSize="10"
            letterSpacing="3"
            fontFamily="Inter, sans-serif"
            fontWeight="600"
          >
            THE
          </text>
          <text
            x="150"
            y="290"
            textAnchor="middle"
            fill="#FAF6EE"
            fontSize="18"
            letterSpacing="2"
            fontFamily="'Newsreader', 'Playfair Display', Georgia, serif"
            fontWeight="bold"
          >
            {title.replace(/^THE\s+/i, '')}
          </text>
          <text
            x="150"
            y="312"
            textAnchor="middle"
            fill="#D3DFE8"
            fontSize="8"
            letterSpacing="2"
            fontFamily="Inter, sans-serif"
            fontWeight="500"
          >
            {subtitle}
          </text>
        </g>
      </svg>
    </div>
  );
}

// 2. "A BRIGHTER DAY" Cover Artwork (Linen canvas, botanical branch & terracotta sun)
export function BrighterDayCover({ className = '', title = 'A Brighter Day' }: CoverArtProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl select-none shadow-sm aspect-[3/4] bg-[#F5EFEB] ${className}`}>
      <svg viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover">
        {/* Soft Warm Canvas */}
        <rect width="300" height="400" fill="#F4EFE6" />

        {/* Terracotta Sun Circle */}
        <circle cx="210" cy="180" r="38" fill="#C25738" />

        {/* Elegant Botanical Branch in Deep Navy */}
        <g stroke="#1C2F3D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          {/* Main stem curve */}
          <path d="M80 340 C100 280 120 210 160 110" />

          {/* Leaves with filled silhouettes */}
          <path d="M125 240 C105 230 90 205 105 190 C125 200 135 220 125 240 Z" fill="#1C2F3D" />
          <path d="M138 210 C160 200 185 205 180 225 C160 230 145 220 138 210 Z" fill="#1C2F3D" />
          <path d="M145 170 C125 155 120 130 135 120 C150 135 155 155 145 170 Z" fill="#1C2F3D" />
          <path d="M152 140 C175 130 195 140 190 160 C170 165 155 150 152 140 Z" fill="#1C2F3D" />
          <path d="M160 110 C160 85 175 75 185 90 C185 110 170 115 160 110 Z" fill="#1C2F3D" />
          <path d="M105 285 C85 275 75 250 90 240 C110 250 115 270 105 285 Z" fill="#1C2F3D" />
        </g>
      </svg>
    </div>
  );
}

// 3. "THE LAST HORIZON" Cover Artwork (Deep midnight indigo, starry sky & crescent moon)
export function LastHorizonCover({ className = '', title = 'The Last Horizon' }: CoverArtProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl select-none shadow-sm aspect-[3/4] bg-[#111A24] ${className}`}>
      <svg viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover">
        <defs>
          <linearGradient id="lh-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F1823" />
            <stop offset="60%" stopColor="#162330" />
            <stop offset="100%" stopColor="#1E3142" />
          </linearGradient>
        </defs>

        <rect width="300" height="400" fill="url(#lh-sky)" />

        {/* Delicate Golden-Cream Crescent Moon */}
        <path
          d="M170 110 A 30 30 0 1 0 145 160 A 24 24 0 1 1 170 110 Z"
          fill="#FAF3E6"
        />

        {/* Scattered Starlight dots */}
        <circle cx="80" cy="70" r="1.5" fill="#FAF3E6" fillOpacity="0.8" />
        <circle cx="230" cy="85" r="2" fill="#FAF3E6" fillOpacity="0.9" />
        <circle cx="110" cy="140" r="1.5" fill="#FAF3E6" fillOpacity="0.6" />
        <circle cx="220" cy="160" r="1.2" fill="#FAF3E6" fillOpacity="0.7" />
        <circle cx="70" cy="180" r="1.5" fill="#FAF3E6" fillOpacity="0.8" />
        <circle cx="140" cy="60" r="1.2" fill="#FAF3E6" fillOpacity="0.5" />
        <circle cx="250" cy="120" r="1.5" fill="#FAF3E6" fillOpacity="0.6" />

        {/* Horizon Sea at Night */}
        <path
          d="M0 280 C60 275 140 285 200 280 C260 275 285 282 300 280 L300 400 L0 400 Z"
          fill="#0B131C"
        />
        <path d="M30 310 C90 305 180 315 250 310" stroke="#1D2E3D" strokeWidth="2" strokeLinecap="round" />
        <path d="M60 340 C120 335 200 345 280 340" stroke="#1D2E3D" strokeWidth="2" strokeLinecap="round" />
        <path d="M120 290 C150 288 175 292 195 289" stroke="#FAF3E6" strokeWidth="1" strokeOpacity="0.3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 4. "SMALL DEPARTURES" Cover Artwork (Layered terracotta & ochre desert dunes)
export function SmallDeparturesCover({ className = '', title = 'Small Departures' }: CoverArtProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl select-none shadow-sm aspect-[3/4] bg-[#F3EDE2] ${className}`}>
      <svg viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover">
        <defs>
          <linearGradient id="sd-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5EFE6" />
            <stop offset="100%" stopColor="#EDE3D4" />
          </linearGradient>
        </defs>

        <rect width="300" height="400" fill="url(#sd-sky)" />

        {/* Distant Dunes */}
        <path d="M0 200 C80 180 180 210 300 170 L300 400 L0 400 Z" fill="#E4C0A2" />

        {/* Mid-ground Sienna Dune */}
        <path d="M0 240 C100 220 200 260 300 230 L300 400 L0 400 Z" fill="#D38260" />

        {/* Rich Terracotta Dune */}
        <path d="M0 280 C90 260 170 300 300 270 L300 400 L0 400 Z" fill="#BA5536" />

        {/* Dark Terracotta Foreground Crest */}
        <path d="M0 340 C80 320 210 350 300 310 L300 400 L0 400 Z" fill="#8F361E" />
      </svg>
    </div>
  );
}

// 5. Large Poster Mountain & Lake Vector Illustration (Left of Mockup)
export function ChapterOneLandscapeIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Textured Terracotta Watercolor Sun */}
      <circle cx="380" cy="180" r="60" fill="#B85338" />

      {/* Mountain Silhouettes with fine line art & hatching */}
      <g stroke="#1F2A33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Ridge 1 */}
        <path d="M280 360 L320 300 L360 320 L400 270 L440 290 L500 230" />
        <path d="M320 300 L340 360" />
        <path d="M400 270 L415 360" />

        {/* Ridge 2 (Detailed mountain slopes) */}
        <path d="M300 370 C350 340 400 320 480 260" />
        <path d="M320 370 L360 340 L380 370" />
        <path d="M370 350 L410 330 L430 360" />

        {/* Fine crosshatch shading on mountain */}
        <path d="M420 300 L440 320" />
        <path d="M430 290 L450 310" />
        <path d="M440 280 L460 300" />
        <path d="M450 270 L470 290" />

        {/* Water Shoreline ripples */}
        <path d="M240 390 C290 385 340 392 390 388 C440 385 470 390 500 388" />
        <path d="M280 410 C330 405 380 412 430 408 C460 406 485 410 500 408" />
        <path d="M330 430 C380 426 430 432 480 428" />
      </g>
    </svg>
  );
}

// Dynamic Thumbnail Helper: picks appropriate cover based on note title/subject/index
export function NoteCoverArtwork({
  noteId,
  title,
  index = 0,
  className = '',
}: {
  noteId?: string;
  title: string;
  index?: number;
  className?: string;
}) {
  const t = title.toLowerCase();
  if (t.includes('sea') || t.includes('water') || t.includes('ocean') || t.includes('quiet') || index % 4 === 0) {
    return <QuietSeaCover className={className} title={title} subtitle="NOTES" />;
  }
  if (t.includes('bright') || t.includes('day') || t.includes('sun') || t.includes('botan') || index % 4 === 1) {
    return <BrighterDayCover className={className} title={title} />;
  }
  if (t.includes('horizon') || t.includes('night') || t.includes('star') || t.includes('moon') || index % 4 === 2) {
    return <LastHorizonCover className={className} title={title} />;
  }
  return <SmallDeparturesCover className={className} title={title} />;
}
