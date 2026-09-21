import React, { useState } from 'react';

// Preset of tickers known to use SVG format in /logos/
const SVG_TICKERS = new Set([
  'ARS', 'AR$', 'USD', 'ALUA', 'AL30', 'GD30', 'GD41', 'T30J7', 'S31O4', 'T2X5'
]);

// Deterministic color generator for fallback avatars
const FALLBACK_PALETTE = [
  '#4f46e5', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#db2777', '#7c3aed', '#e11d48', '#0284c7', '#16a34a'
];

function getAvatarColor(str) {
  if (!str) return '#4f46e5';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

// Clean ticker string: remove .BA, whitespace, uppercase
export function cleanLogoTicker(t) {
  if (!t) return '';
  const clean = String(t).trim().toUpperCase().replace(/\.BA$/i, '');
  if (clean === 'AR$') return 'ARS';
  return clean;
}

/**
 * TickerLogo Component
 * Renders static PNG/SVG logo from /logos/ with zero-layout-shift and graceful avatar fallback.
 */
export default function TickerLogo({
  ticker,
  nombre = '',
  tipo = '',
  size = 28,
  className = '',
  style = {}
}) {
  const [hasError, setHasError] = useState(false);
  const cleanT = cleanLogoTicker(ticker);

  if (!cleanT) return null;

  // Determine logo URL
  const isSvg = SVG_TICKERS.has(cleanT);
  const ext = isSvg ? 'svg' : 'png';
  const logoUrl = `/logos/${cleanT}.${ext}`;

  // Avatar initials fallback text
  const initials = cleanT.length <= 3 ? cleanT : cleanT.slice(0, 2);
  const bgColor = getAvatarColor(cleanT);

  const containerStyle = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: hasError ? bgColor : 'rgba(255, 255, 255, 0.05)',
    border: hasError ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    verticalAlign: 'middle',
    userSelect: 'none',
    ...style
  };

  if (hasError) {
    return (
      <div 
        className={`ticker-logo-avatar ${className}`}
        style={containerStyle}
        title={nombre || cleanT}
      >
        <span style={{
          fontSize: size <= 24 ? '10px' : (size <= 32 ? '11px' : '13px'),
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1,
          letterSpacing: '-0.5px'
        }}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`ticker-logo-wrap ${className}`}
      style={containerStyle}
      title={nombre ? `${nombre} (${cleanT})` : cleanT}
    >
      <img
        src={logoUrl}
        alt={cleanT}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          borderRadius: '50%',
          display: 'block'
        }}
      />
    </div>
  );
}
