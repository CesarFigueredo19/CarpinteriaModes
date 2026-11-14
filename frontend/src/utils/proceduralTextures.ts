import * as THREE from 'three';
import donTeofiloImg from '../assets/images/don_teofilo_oruro_1794532701317.jpg';
import mariaAsesoraImg from '../assets/images/maria_asesora_modes_1794532701827.jpg';

const woodTextureCache = new Map<string, THREE.CanvasTexture>();
const bumpTextureCache = new Map<string, THREE.CanvasTexture>();

interface WoodPalette {
  base: string;
  mid: string;
  grain: string;
  pore: string;
}

const WOOD_PALETTES: Record<string, WoodPalette> = {
  mara: {
    base: '#5e321b',
    mid: '#4b2512',
    grain: '#38190b',
    pore: '#7a4528',
  },
  cedro: {
    base: '#a85a2a',
    mid: '#924a20',
    grain: '#6e3211',
    pore: '#c4743f',
  },
  roble: {
    base: '#c99655',
    mid: '#b68242',
    grain: '#8f5f28',
    pore: '#dbb074',
  },
  tajibo: {
    base: '#492b1a',
    mid: '#391f12',
    grain: '#1f0e06',
    pore: '#6b442b',
  },
  pino: {
    base: '#dec9a4',
    mid: '#cfb891',
    grain: '#b39567',
    pore: '#ead9ba',
  },
  grafito: {
    base: '#334155',
    mid: '#293548',
    grain: '#1e293b',
    pore: '#475569',
  },
};

export function createWoodTexture(
  woodType: string = 'mara',
  maxAnisotropy: number = 4,
  repeatX: number = 1,
  repeatY: number = 1
): THREE.CanvasTexture {
  const key = `${woodType}_${repeatX}_${repeatY}`;
  const cached = woodTextureCache.get(key);
  if (cached) return cached;

  const palette = WOOD_PALETTES[woodType] || WOOD_PALETTES.mara;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle board plank variation
  const bands = 4;
  const bandW = 512 / bands;
  for (let b = 0; b < bands; b++) {
    ctx.fillStyle = b % 2 === 0 ? palette.base : palette.mid;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(b * bandW, 0, bandW, 512);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.grain;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(b * bandW, 0, 2, 512);
    ctx.globalAlpha = 1;
  }

  // Organic wood grain lines
  for (let i = 0; i < 190; i++) {
    const xBase = (i / 190) * 512 + Math.sin(i * 1.7) * 4;
    const isLight = i % 5 === 0;
    ctx.strokeStyle = isLight ? palette.pore : palette.grain;
    ctx.globalAlpha = isLight ? 0.14 : 0.24;
    ctx.lineWidth = 0.8 + (i % 3) * 0.7;

    ctx.beginPath();
    for (let y = 0; y <= 512; y += 16) {
      const wave =
        Math.sin((y / 512) * Math.PI * 2 + i * 0.31) * 4.5 +
        Math.cos((y / 256) * Math.PI + i * 0.7) * 2.0;
      const x = xBase + wave;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Subtle cathedral arches on wood
  if (woodType !== 'grafito') {
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = palette.grain;
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      const cx = 80 + k * 170;
      const cy = 180 + (k % 2) * 140;
      for (let r = 12; r < 68; r += 8) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.48, r * 1.8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = maxAnisotropy;

  woodTextureCache.set(key, texture);
  return texture;
}

export function createWoodBumpTexture(maxAnisotropy: number = 4): THREE.CanvasTexture {
  const cached = bumpTextureCache.get('wood_bump');
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 140; i++) {
    const x = (i / 140) * 256;
    ctx.strokeStyle = i % 2 === 0 ? '#686868' : '#969696';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 0; y <= 256; y += 16) {
      const wave = Math.sin((y / 256) * Math.PI * 2 + i * 0.4) * 3;
      if (y === 0) ctx.moveTo(x + wave, y);
      else ctx.lineTo(x + wave, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  bumpTextureCache.set('wood_bump', texture);
  return texture;
}

export function createWorkshopFloorTexture(maxAnisotropy: number = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Architectural warm micro-cement / pale oak gallery floor
  ctx.fillStyle = '#dfd8cc';
  ctx.fillRect(0, 0, 1024, 1024);

  const plankRows = 8;
  const plankCols = 4;
  const pw = 1024 / plankCols;
  const ph = 1024 / plankRows;

  const tones = ['#d9d0c1', '#dfd7c9', '#d4cab9', '#e3dbce'];

  for (let r = 0; r < plankRows; r++) {
    const rowOffset = (r % 2) * (pw * 0.5);
    for (let c = -1; c <= plankCols; c++) {
      const x = c * pw + rowOffset;
      const y = r * ph;
      ctx.fillStyle = tones[(r * 3 + c + 4) % tones.length];
      ctx.fillRect(x, y, pw, ph);

      // Subtle wood grain inside each wide plank
      ctx.strokeStyle = 'rgba(130, 108, 84, 0.10)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 14; g++) {
        const gy = y + (g / 14) * ph + 4;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.bezierCurveTo(
          x + pw * 0.33,
          gy + Math.sin(g + r) * 3,
          x + pw * 0.66,
          gy - Math.cos(g + c) * 3,
          x + pw,
          gy
        );
        ctx.stroke();
      }

      // Plank bevel seam
      ctx.strokeStyle = 'rgba(92, 76, 60, 0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, pw, ph);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createAndeanRugTexture(
  variant: 'warm' | 'slate' | 'terracotta',
  maxAnisotropy: number = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const palettes = {
    warm: { bg: '#ede6da', border: '#8c5332', accent: '#c9a372', weave: '#dfd5c3' },
    slate: { bg: '#e3e5e6', border: '#334155', accent: '#94a3b8', weave: '#d1d5db' },
    terracotta: { bg: '#eadfd3', border: '#78350f', accent: '#b45309', weave: '#ddcdbb' },
  };
  const pal = palettes[variant];

  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, 512, 512);

  // Woven textile fibers
  for (let y = 0; y < 512; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? pal.weave : 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, y, 512, 2);
  }
  for (let x = 0; x < 512; x += 6) {
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    ctx.fillRect(x, 0, 2, 512);
  }

  // Outer architectural geometric frame
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 18;
  ctx.strokeRect(26, 26, 460, 460);

  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, 416, 416);

  // Subtle geometric diamond motif in center
  ctx.strokeStyle = pal.border;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 3;
  for (let step = 0; step < 3; step++) {
    const r = 70 + step * 40;
    ctx.beginPath();
    ctx.moveTo(256, 256 - r);
    ctx.lineTo(256 + r, 256);
    ctx.lineTo(256, 256 + r);
    ctx.lineTo(256 - r, 256);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createGalleryArtTexture(artIndex: number, maxAnisotropy: number = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  // Matboard cream
  ctx.fillStyle = '#faf7f0';
  ctx.fillRect(0, 0, 512, 384);

  // Inner passepartout border
  ctx.strokeStyle = '#d6cfc2';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, 456, 328);

  if (artIndex === 0) {
    // Muestrario de Maderas Bolivianas
    ctx.fillStyle = '#292524';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('MUESTRARIO DE MADERAS NOBLES', 256, 72);
    ctx.fillStyle = '#78716c';
    ctx.font = '14px sans-serif';
    ctx.fillText('Selección Artesanal · Oruro, Bolivia', 256, 98);

    const swatches = [
      { name: 'MARA', color: '#5e321b' },
      { name: 'CEDRO', color: '#a85a2a' },
      { name: 'ROBLE', color: '#c99655' },
      { name: 'TAJIBO', color: '#492b1a' },
    ];
    swatches.forEach((sw, idx) => {
      const x = 66 + idx * 98;
      ctx.fillStyle = sw.color;
      ctx.fillRect(x, 130, 82, 150);
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, 130, 82, 150);
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(sw.name, x + 41, 304);
    });
  } else if (artIndex === 1) {
    // Geometric Abstract Wood Marquetry
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(46, 46, 420, 292);
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(190, 192, 85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(230, 275);
    ctx.lineTo(340, 110);
    ctx.lineTo(425, 275);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(90, 110, 18, 175);
  } else if (artIndex === 2) {
    // Blueprint / Plano de Ensamble
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(42, 42, 428, 300);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 62; x < 460; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 42);
      ctx.lineTo(x, 342);
      ctx.stroke();
    }
    for (let y = 62; y < 340; y += 24) {
      ctx.beginPath();
      ctx.moveTo(42, y);
      ctx.lineTo(470, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(110, 96, 170, 195);
    ctx.strokeRect(124, 110, 70, 130);
    ctx.strokeRect(200, 110, 66, 130);
    ctx.strokeRect(124, 246, 142, 32);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('ESCALA 1:10 · ENSAMBLE ESPIGA', 110, 78);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px monospace';
    ctx.fillText('210 cm', 302, 195);
    ctx.fillText('180 cm', 165, 314);
  } else {
    // Garantía & Tradición Modes
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('MUEBLERÍA MODES', 256, 130);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 152);
    ctx.lineTo(372, 152);
    ctx.stroke();
    ctx.fillStyle = '#57534e';
    ctx.font = '17px Georgia, serif';
    ctx.fillText('Carpintería de Autor · Oruro', 256, 190);
    ctx.font = '14px sans-serif';
    ctx.fillText('Secado natural · Laqueado poliuretánico', 256, 224);
    ctx.fillText('Fabricación a medida con garantía real', 256, 250);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createAdvisorStandeeTexture(
  characterType: 'carpintero' | 'asesora',
  maxAnisotropy: number = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d')!;

  const isCarpintero = characterType === 'carpintero';
  const primary = isCarpintero ? '#b45309' : '#0f172a';
  const accentGold = '#d97706';
  const softBg = isCarpintero ? '#fef3c7' : '#e0e7ff';

  const drawFrameBase = () => {
    ctx.clearRect(0, 0, 512, 680);

    // Warm ivory card backing with deep navy & gold rim
    ctx.fillStyle = '#fbf8f3';
    ctx.beginPath();
    ctx.roundRect(18, 18, 476, 644, 34);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = accentGold;
    ctx.beginPath();
    ctx.roundRect(28, 28, 456, 624, 26);
    ctx.stroke();

    // Header band
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(42, 42, 428, 44, 14);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isCarpintero ? 'TALLER ARTESANAL · ORURO' : 'ASESORÍA SHOWROOM · ORURO',
      256,
      70
    );

    // Name & Role
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 38px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(isCarpintero ? 'Don Teófilo' : 'María Paredes', 256, 488);

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(isCarpintero ? 'Maestro Artesano' : 'Asesora Comercial', 256, 524);

    // Action button inside standee
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.roundRect(96, 558, 320, 58, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(isCarpintero ? 'Cotizar a Medida' : 'Consultar Stock / WA', 256, 594);
  };

  drawFrameBase();

  // Immediate fallback portrait before photorealistic image finishes decoding
  ctx.fillStyle = softBg;
  ctx.beginPath();
  ctx.arc(256, 262, 148, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accentGold;
  ctx.lineWidth = 5;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  // Load real photorealistic portrait and draw inside circular gold-rimmed frame
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    drawFrameBase();

    const cx = 256;
    const cy = 262;
    const radius = 152;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Cover-fit portrait centered near upper-center so face is cleanly framed
    const aspect = img.width / Math.max(1, img.height);
    const diameter = radius * 2;
    let drawW = diameter;
    let drawH = diameter;
    if (aspect > 1) {
      drawH = diameter;
      drawW = diameter * aspect;
    } else {
      drawW = diameter;
      drawH = diameter / aspect;
    }
    const dx = cx - drawW / 2;
    const dy = cy - drawH * 0.42;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();

    // Gold and navy portrait ring
    ctx.strokeStyle = accentGold;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
    ctx.stroke();

    texture.needsUpdate = true;
  };
  img.src = isCarpintero ? donTeofiloImg : mariaAsesoraImg;

  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  grad.addColorStop(0, 'rgba(20, 15, 10, 0.55)');
  grad.addColorStop(0.55, 'rgba(20, 15, 10, 0.22)');
  grad.addColorStop(1, 'rgba(20, 15, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createPlaqueTexture(title: string, priceBs: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#faf7f2';
  ctx.fillRect(0, 0, 320, 140);
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 312, 132);

  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 160, 56);

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`Bs. ${priceBs.toLocaleString('es-BO')}`, 160, 104);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCustomSignTexture(
  displayName: string,
  subtitle: string,
  maxAnisotropy: number = 4
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  // Deep architectural navy-ebony backing with warm subtle radial glow
  const bg = ctx.createRadialGradient(512, 160, 40, 512, 160, 560);
  bg.addColorStop(0, '#1e293b');
  bg.addColorStop(1, '#090f1d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 320);

  // Double gold/brass architectural borders
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 996, 292);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 972, 268);

  // Corner brass flourishes
  const corners: [number, number][] = [
    [34, 34],
    [990, 34],
    [34, 286],
    [990, 286],
  ];
  ctx.fillStyle = '#fbbf24';
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Top header caption
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CARPINTERÍA & SHOWROOM · ORURO, BOLIVIA', 512, 72);

  // Auto-fitted hero display name
  const cleanName = (displayName || '').trim() || 'CARPINTERÍA MUEBLERÍA MODES';
  const upperName = cleanName.toUpperCase();
  let fontSize = 68;
  while (fontSize > 28) {
    ctx.font = `bold ${fontSize}px Georgia, serif`;
    if (ctx.measureText(upperName).width <= 880) break;
    fontSize -= 4;
  }

  ctx.shadowColor = 'rgba(245, 158, 11, 0.35)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#fef3c7';
  ctx.fillText(upperName, 512, 166);
  ctx.shadowBlur = 0;

  // Decorative divider hairline
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(260, 214);
  ctx.lineTo(764, 214);
  ctx.stroke();

  // Bottom subtitle
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '22px Georgia, serif';
  ctx.fillText(
    (subtitle || '').trim() || 'Carpintería de Autor · Mara, Cedro, Tajibo & Roble',
    512,
    248
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

