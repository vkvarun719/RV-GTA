import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finishTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createGateBoardTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 256);

  // Cream/stone frame
  ctx.fillStyle = '#efe5cf';
  ctx.fillRect(0, 0, 1024, 256);

  // RV Institutional Maroon-Terracotta panel
  ctx.fillStyle = '#6f1620';
  ctx.fillRect(14, 14, 996, 228);

  // Gold accent trim
  ctx.strokeStyle = '#e5b84b';
  ctx.lineWidth = 5;
  ctx.strokeRect(22, 22, 980, 212);

  // Stylized RSST / RV emblem circle on left
  ctx.fillStyle = '#f8ecd4';
  ctx.beginPath();
  ctx.arc(105, 128, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d49d2a';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = '#6f1620';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RV', 105, 122);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('RSST', 105, 158);

  // Title text
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd97d';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('ಆರ್.ವಿ. ತಾಂತ್ರಿಕ ಮತ್ತು ವ್ಯವಸ್ಥಾಪನಾ ಸಂಸ್ಥೆ', 195, 68);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 35px system-ui, sans-serif';
  ctx.fillText('RV INSTITUTE OF TECHNOLOGY', 195, 118);
  ctx.font = '900 33px system-ui, sans-serif';
  ctx.fillText('AND MANAGEMENT', 195, 158);

  ctx.fillStyle = '#f1dec0';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('Chaithanya Layout, 8th Phase, J.P. Nagar, Bengaluru - 560076', 195, 202);

  return finishTexture(c);
}

export function createSignboardTexture(
  title: string,
  subtitle: string,
  bgColor: string,
  fgColor: string,
  accentColor: string
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 160);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 160);

  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 142, 512, 18);

  ctx.fillStyle = fgColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillText(title, 256, 66);

  ctx.font = '600 20px system-ui, sans-serif';
  ctx.globalAlpha = 0.92;
  ctx.fillText(subtitle, 256, 110);

  return finishTexture(c);
}

export function createDeptBoardTexture(code: string, subtitle: string, accent = '#d97706'): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(384, 128);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 384, 128);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 18, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 376, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, 34, 48);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText(subtitle, 34, 90);

  return finishTexture(c);
}

export function createAsphaltTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#31353d';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle aggregate speckles
  for (let i = 0; i < 1200; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Center dashed white lane marking
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(123, 18, 10, 76);
  ctx.fillRect(123, 146, 10, 76);

  // Yellow shoulder curbs
  ctx.fillStyle = '#d4a11e';
  ctx.fillRect(4, 0, 6, 256);
  ctx.fillRect(246, 0, 6, 256);

  return finishTexture(c, 1, 1);
}

export function createCourtyardPaverTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#cfc5b4';
  ctx.fillRect(0, 0, 256, 256);

  const step = 32;
  for (let y = 0; y < 256; y += step) {
    for (let x = 0; x < 256; x += step) {
      const shade = ((x / step + y / step) % 2 === 0) ? '#dfd5c5' : '#c6baa7';
      ctx.fillStyle = shade;
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
    }
  }
  return finishTexture(c, 10, 14);
}

export function createBasketballCourtTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 280);
  ctx.fillStyle = '#1e4d7b';
  ctx.fillRect(0, 0, 512, 280);

  // Inner court terracotta
  ctx.fillStyle = '#b4532a';
  ctx.fillRect(24, 20, 464, 240);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 20, 464, 240);

  // Center line & circle
  ctx.beginPath();
  ctx.moveTo(256, 20);
  ctx.lineTo(256, 260);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(256, 140, 38, 0, Math.PI * 2);
  ctx.stroke();

  // Keys & 3-pt arcs
  ctx.strokeRect(24, 92, 82, 96);
  ctx.strokeRect(406, 92, 82, 96);

  ctx.beginPath();
  ctx.arc(54, 140, 88, -Math.PI * 0.45, Math.PI * 0.45);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(458, 140, 88, Math.PI * 0.55, Math.PI * 1.45);
  ctx.stroke();

  return finishTexture(c);
}

export function createCricketTurfTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 512);
  ctx.fillStyle = '#1e783c';
  ctx.fillRect(0, 0, 256, 512);

  // Mowed stripes
  ctx.fillStyle = '#258a47';
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(0, y, 256, 32);
  }

  // Central pitch mat
  ctx.fillStyle = '#c8aa76';
  ctx.fillRect(102, 76, 52, 360);

  // White boundary & creases
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 236, 492);
  ctx.beginPath();
  ctx.moveTo(86, 118);
  ctx.lineTo(170, 118);
  ctx.moveTo(86, 394);
  ctx.lineTo(170, 394);
  ctx.stroke();

  return finishTexture(c);
}

export function createSpeedBreakerTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 64);
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = (x / 32) % 2 === 0 ? '#facc15' : '#1f2937';
    ctx.fillRect(x, 0, 32, 64);
  }
  return finishTexture(c);
}

export function createBuildingWindowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  // Warm cream concrete background
  ctx.fillStyle = '#ece6dc';
  ctx.fillRect(0, 0, 256, 256);

  // Floor slab horizontal band
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, 256, 36);
  ctx.fillStyle = '#b74832'; // subtle terracotta architectural band
  ctx.fillRect(0, 36, 256, 8);

  // Deep tinted glass window grid
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 60;
    ctx.fillStyle = '#1e3a4c';
    ctx.fillRect(x, 62, 46, 152);
    // Subtle reflection & mullion
    ctx.fillStyle = '#3b6a84';
    ctx.fillRect(x + 4, 66, 18, 144);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 21, 62, 3, 152);
    ctx.fillRect(x, 134, 46, 4);
  }

  return finishTexture(c, 6, 7);
}
