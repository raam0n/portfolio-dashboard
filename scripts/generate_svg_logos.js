import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logosDir = path.join(__dirname, '..', 'public', 'logos');
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

// 1. Argentina Flag circular badge (ARS, AR$)
const arsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <clipPath id="circleClip"><circle cx="32" cy="32" r="30"/></clipPath>
  </defs>
  <circle cx="32" cy="32" r="30" fill="#74ACDF" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <g clip-path="url(#circleClip)">
    <rect x="0" y="21.33" width="64" height="21.33" fill="#FFFFFF"/>
    <!-- Sun of May (Sol de Mayo) -->
    <circle cx="32" cy="32" r="5.5" fill="#F6B40E" stroke="#85340A" stroke-width="0.5"/>
    <circle cx="32" cy="32" r="2" fill="#FDB813"/>
  </g>
</svg>`;

// 2. US Flag circular badge (USD)
const usdSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <clipPath id="circleClipUs"><circle cx="32" cy="32" r="30"/></clipPath>
  </defs>
  <g clip-path="url(#circleClipUs)">
    <rect width="64" height="64" fill="#B22234"/>
    <rect y="4.92" width="64" height="4.92" fill="#FFFFFF"/>
    <rect y="14.76" width="64" height="4.92" fill="#FFFFFF"/>
    <rect y="24.6" width="64" height="4.92" fill="#FFFFFF"/>
    <rect y="34.44" width="64" height="4.92" fill="#FFFFFF"/>
    <rect y="44.28" width="64" height="4.92" fill="#FFFFFF"/>
    <rect y="54.12" width="64" height="4.92" fill="#FFFFFF"/>
    <rect width="28" height="34.5" fill="#3C3B6E"/>
    <!-- Stars -->
    <circle cx="7" cy="8" r="1.5" fill="#FFFFFF"/>
    <circle cx="14" cy="8" r="1.5" fill="#FFFFFF"/>
    <circle cx="21" cy="8" r="1.5" fill="#FFFFFF"/>
    <circle cx="10.5" cy="17" r="1.5" fill="#FFFFFF"/>
    <circle cx="17.5" cy="17" r="1.5" fill="#FFFFFF"/>
    <circle cx="7" cy="26" r="1.5" fill="#FFFFFF"/>
    <circle cx="14" cy="26" r="1.5" fill="#FFFFFF"/>
    <circle cx="21" cy="26" r="1.5" fill="#FFFFFF"/>
  </g>
  <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
</svg>`;

// 3. Aluar (ALUA)
const aluaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="#0F2537" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <path d="M32 14 L46 48 L39 48 L35.5 39 L28.5 39 L25 48 L18 48 Z M30 33 L34 33 L32 24 Z" fill="#00A3E0"/>
  <circle cx="32" cy="20" r="2" fill="#E1F5FE"/>
</svg>`;

// 4. Sovereign Bond Generic Badge Generator
function createBondSvg(label, subLabel, bgColor = '#0A2540', accentColor = '#74ACDF') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="30" fill="${bgColor}" stroke="${accentColor}" stroke-width="2"/>
  <defs>
    <linearGradient id="grad_${label}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${bgColor}" stop-opacity="0.8"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="28" fill="url(#grad_${label})"/>
  <path d="M22 20 Q32 15 42 20" stroke="#F6B40E" stroke-width="2" fill="none" stroke-linecap="round"/>
  <text x="32" y="37" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${label}</text>
  <text x="32" y="47" font-family="Inter, system-ui, sans-serif" font-size="8.5" font-weight="600" fill="#F6B40E" text-anchor="middle" letter-spacing="0.5">${subLabel}</text>
</svg>`;
}

fs.writeFileSync(path.join(logosDir, 'ARS.svg'), arsSvg);
fs.writeFileSync(path.join(logosDir, 'USD.svg'), usdSvg);
fs.writeFileSync(path.join(logosDir, 'ALUA.svg'), aluaSvg);
fs.writeFileSync(path.join(logosDir, 'AL30.svg'), createBondSvg('AL30', 'USD AR'));
fs.writeFileSync(path.join(logosDir, 'GD30.svg'), createBondSvg('GD30', 'USD NY'));
fs.writeFileSync(path.join(logosDir, 'GD41.svg'), createBondSvg('GD41', 'USD NY'));
fs.writeFileSync(path.join(logosDir, 'T30J7.svg'), createBondSvg('T30', 'BONO $', '#1B2A4A', '#22C55E'));
fs.writeFileSync(path.join(logosDir, 'S31O4.svg'), createBondSvg('S31', 'LECAP', '#2A211B', '#F59E0B'));
fs.writeFileSync(path.join(logosDir, 'T2X5.svg'), createBondSvg('T2X5', 'CER', '#1E293B', '#38BDF8'));

console.log('SVGs created successfully in', logosDir);
