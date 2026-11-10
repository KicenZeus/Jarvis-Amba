const fs = require('fs');
const path = require('path');
const { Resvg } = require('../discord-bot/node_modules/@resvg/resvg-js');

const assetsDir = path.join(__dirname, '../mobile/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. App Icon (1024x1024)
const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#030712" />
    </radialGradient>
    <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="30" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" rx="220" fill="url(#bgGrad)" />

  <!-- Outer Ring -->
  <circle cx="512" cy="512" r="380" fill="none" stroke="#1e293b" stroke-width="12" />
  <circle cx="512" cy="512" r="380" fill="none" stroke="url(#coreGrad)" stroke-width="14" stroke-dasharray="280 120" filter="url(#glow)" />

  <!-- Secondary Ring -->
  <circle cx="512" cy="512" r="280" fill="none" stroke="#0ea5e9" stroke-width="8" stroke-dasharray="160 80" opacity="0.8" />
  <circle cx="512" cy="512" r="210" fill="none" stroke="#6366f1" stroke-width="6" opacity="0.6" />

  <!-- Center Core Pulsar -->
  <circle cx="512" cy="512" r="140" fill="url(#coreGrad)" filter="url(#glow)" />
  <circle cx="512" cy="512" r="110" fill="#030712" />

  <!-- Inner Jarvis J / Core Emblem -->
  <path d="M512 400 L512 550 C512 600 480 625 440 625 C410 625 390 605 385 580" fill="none" stroke="url(#coreGrad)" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="512" cy="400" r="20" fill="#38bdf8" />
  <circle cx="590" cy="512" r="14" fill="#a855f7" />
</svg>
`;

// 2. Notification Icon (96x96 White on Transparent)
const notificationIconSvg = `
<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <!-- Android Notification: Pure white shape, transparent background -->
  <circle cx="48" cy="48" r="40" fill="none" stroke="#ffffff" stroke-width="6" />
  <circle cx="48" cy="48" r="24" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="24 12" />
  <circle cx="48" cy="48" r="10" fill="#ffffff" />
</svg>
`;

// 3. Adaptive Icon Foreground (1024x1024 with transparent background)
const adaptiveIconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="adaptGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <filter id="adaptGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="25" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Centered Icon Core for Android Adaptive Mask -->
  <circle cx="512" cy="512" r="280" fill="none" stroke="url(#adaptGrad)" stroke-width="20" stroke-dasharray="220 80" filter="url(#adaptGlow)" />
  <circle cx="512" cy="512" r="200" fill="none" stroke="#0ea5e9" stroke-width="10" opacity="0.8" />
  <circle cx="512" cy="512" r="130" fill="url(#adaptGrad)" />
  <circle cx="512" cy="512" r="95" fill="#030712" />
  <path d="M512 430 L512 535 C512 575 488 595 455 595 C430 595 415 580 410 560" fill="none" stroke="url(#adaptGrad)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="512" cy="430" r="15" fill="#38bdf8" />
</svg>
`;

function renderSvg(svgString, outputPath, width, height) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: width },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`Generated: ${outputPath} (${width}x${height}, ${pngBuffer.length} bytes)`);
}

renderSvg(iconSvg, path.join(assetsDir, 'icon.png'), 1024, 1024);
renderSvg(notificationIconSvg, path.join(assetsDir, 'notification-icon.png'), 96, 96);
renderSvg(adaptiveIconSvg, path.join(assetsDir, 'adaptive-icon.png'), 1024, 1024);
renderSvg(iconSvg, path.join(assetsDir, 'splash.png'), 1024, 1024);
console.log('All mobile assets successfully created.');

