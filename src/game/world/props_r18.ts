// ============================================================
// R18 · objetos de las secciones nuevas (dibujo procedural, pantalla)
//  molino       molino de aspas: en el ayer gira cargado de trigo; hoy
//               aspas rotas y nidos (y, vencida la Reina, crujen al viento)
//  arbolviejo   el Árbol Viejo: hoy desnudo y llorando ceniza; en el ayer
//               (o tras verter la savia) verde y vivo
//  botella      botella con mensaje medio enterrada, con destello
//  vela         vela en estaca: apagada / encendida (llama + halo)
//  cristalhielo racimo de cristal cantor / añicos tras romperlo
//  cuaderno     atril con el cuaderno del molinero (solo en el ayer)
//  altarsavia   cuenco de piedra con raíces; brilla verde con savia
// + proyectiles enemigos nuevos: telaraña, pluma, burbuja, velo, esquirla.
// Todo determinista (sin Math.random): t = globalT.
// ============================================================

export interface PropR18State { past: boolean; on: boolean; done: boolean }

function R(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, C: string) {
  x.fillStyle = C; x.fillRect(Math.round(X), Math.round(Y), Math.round(W), Math.round(H));
}

export function drawPropR18(ctx: CanvasRenderingContext2D, kind: string, X: number, Y: number, Z: number, t: number, st: PropR18State): void {
  const z = Z;
  switch (kind) {
    case 'molino': {
      // torre de piedra encalada sobre la base (el bloque de tiles ya es la casa)
      const bx = X, by = Y - 6 * z;
      R(ctx, bx - 9 * z, by - 30 * z, 18 * z, 30 * z, st.past ? '#e8e0cc' : '#a8a090');
      R(ctx, bx - 9 * z, by - 30 * z, 3 * z, 30 * z, st.past ? '#f8f2e0' : '#bab2a2');
      R(ctx, bx + 6 * z, by - 30 * z, 3 * z, 30 * z, st.past ? '#c8bea8' : '#8a8274');
      R(ctx, bx - 11 * z, by - 34 * z, 22 * z, 5 * z, st.past ? '#9a4a2a' : '#5a3a2a');
      R(ctx, bx - 3 * z, by - 12 * z, 6 * z, 12 * z, '#3a2a1a');                    // puerta
      R(ctx, bx - 2 * z, by - 24 * z, 4 * z, 4 * z, st.past ? '#ffd27a' : '#2a2a2a'); // ventana
      // aspas
      const turning = st.past || st.done;
      const ang = turning ? t * (st.past ? 1.2 : 0.35) : 0.35;
      const hx = bx, hy = by - 30 * z;
      for (let i = 0; i < 4; i++) {
        const a = ang + (i * Math.PI) / 2;
        const broken = !st.past && !st.done && i % 2 === 1;
        const L = (broken ? 9 : 22) * z;
        ctx.save();
        ctx.translate(hx, hy); ctx.rotate(a);
        R(ctx, -1 * z, 0, 2 * z, L, '#5a3e24');
        if (!broken) {
          R(ctx, 1 * z, 4 * z, 6 * z, L - 5 * z, st.past ? 'rgba(240,232,210,0.92)' : 'rgba(160,150,130,0.55)');
          for (let k = 6; k < 22; k += 4) R(ctx, 1 * z, k * z, 6 * z, 1 * z, '#7a5a3a');
        }
        ctx.restore();
      }
      R(ctx, hx - 2 * z, hy - 2 * z, 4 * z, 4 * z, '#3a2a1a');
      if (!st.past && !st.done) { // nido con brillo dorado (la Reina)
        R(ctx, hx + 4 * z, hy + 2 * z, 7 * z, 3 * z, '#4a3a22');
        R(ctx, hx + 6 * z, hy + 1 * z, 2 * z, 1 * z, (Math.floor(t * 2) % 2) ? '#ffe08a' : '#c8a040');
      }
      break;
    }
    case 'arbolviejo': {
      const alive = st.past || st.on;
      const bx = X, by = Y + 8 * z;
      // raíces y tronco
      R(ctx, bx - 14 * z, by - 4 * z, 28 * z, 5 * z, alive ? '#5a4030' : '#4a4440');
      R(ctx, bx - 5 * z, by - 34 * z, 10 * z, 32 * z, alive ? '#6a4a32' : '#5e5854');
      R(ctx, bx - 5 * z, by - 34 * z, 3 * z, 32 * z, alive ? '#8a6448' : '#78726c');
      R(ctx, bx + 3 * z, by - 34 * z, 2 * z, 32 * z, alive ? '#4a3220' : '#46403c');
      // ramas
      const br = alive ? '#6a4a32' : '#5e5854';
      R(ctx, bx - 18 * z, by - 40 * z, 14 * z, 3 * z, br); R(ctx, bx + 4 * z, by - 44 * z, 16 * z, 3 * z, br);
      R(ctx, bx - 20 * z, by - 48 * z, 3 * z, 10 * z, br); R(ctx, bx + 18 * z, by - 52 * z, 3 * z, 10 * z, br);
      if (alive) {
        // copa frondosa con luz
        const blob = (cx: number, cy: number, r: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
        blob(bx - 14 * z, by - 50 * z, 12 * z, '#3e7a3a'); blob(bx + 14 * z, by - 54 * z, 13 * z, '#3e7a3a');
        blob(bx, by - 62 * z, 15 * z, '#4a8a42'); blob(bx - 4 * z, by - 66 * z, 8 * z, '#6ab05a');
        for (let i = 0; i < 6; i++) R(ctx, bx + Math.sin(i * 2.3) * 16 * z, by - (48 + (i * 7) % 20) * z, 2 * z, 2 * z, '#ffe08a');
      } else {
        // ceniza que cae de las grietas
        for (let i = 0; i < 8; i++) {
          const fy = ((t * 9 + i * 13) % 40) * z;
          ctx.globalAlpha = 0.6 - fy / (40 * z) * 0.5;
          R(ctx, bx + (Math.sin(i * 1.7) * 14) * z, by - 46 * z + fy, 2 * z, 2 * z, '#c8c0b8');
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'botella': {
      if (st.done) break;
      const by = Y + 2 * z;
      R(ctx, X - 2 * z, by - 7 * z, 4 * z, 7 * z, 'rgba(120,200,190,0.85)');
      R(ctx, X - 1 * z, by - 9 * z, 2 * z, 2 * z, '#8a6a4a');
      R(ctx, X - 1 * z, by - 6 * z, 1 * z, 4 * z, '#f0f8f0');             // el papel dentro
      R(ctx, X - 4 * z, by - 1 * z, 8 * z, 2 * z, 'rgba(200,180,130,0.6)'); // arena encima
      const tw = (Math.sin(t * 4 + X) + 1) / 2;
      ctx.globalAlpha = 0.4 + 0.6 * tw;
      R(ctx, X + 2 * z, by - 9 * z, 1 * z, 3 * z, '#ffffff'); R(ctx, X + 1 * z, by - 8 * z, 3 * z, 1 * z, '#ffffff');
      ctx.globalAlpha = 1;
      break;
    }
    case 'vela': {
      R(ctx, X - 1 * z, Y - 6 * z, 2 * z, 12 * z, '#5a4430');                // estaca
      R(ctx, X - 3 * z, Y - 7 * z, 6 * z, 2 * z, '#3a2c20');                 // platillo
      R(ctx, X - 2 * z, Y - 14 * z, 4 * z, 7 * z, '#ece4d0');                // cera
      R(ctx, X - 2 * z, Y - 14 * z, 1 * z, 7 * z, '#fffaf0');
      if (st.on) {
        const fl = Math.sin(t * 9 + X) * z;
        const g = ctx.createRadialGradient(X, Y - 18 * z, 1, X, Y - 18 * z, 22 * z);
        g.addColorStop(0, 'rgba(255,214,120,0.45)'); g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g; ctx.fillRect(X - 22 * z, Y - 40 * z, 44 * z, 44 * z);
        R(ctx, X - 1.5 * z + fl * 0.3, Y - 20 * z, 3 * z, 5 * z, '#ffb840');
        R(ctx, X - 0.5 * z + fl * 0.3, Y - 19 * z, 1 * z, 3 * z, '#fff6c8');
      } else {
        R(ctx, X, Y - 16 * z, 1 * z, 2 * z, '#2a2420');
      }
      break;
    }
    case 'cristalhielo': {
      if (st.done) {
        for (let i = 0; i < 5; i++) R(ctx, X + (i - 2) * 4 * z, Y + ((i * 3) % 4) * z, 3 * z, 2 * z, '#b8e8ff');
        break;
      }
      const glow = 0.25 + 0.15 * Math.sin(t * 2 + X);
      const g = ctx.createRadialGradient(X, Y - 10 * z, 1, X, Y - 10 * z, 20 * z);
      g.addColorStop(0, `rgba(170,230,255,${glow.toFixed(3)})`); g.addColorStop(1, 'rgba(170,230,255,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 20 * z, Y - 30 * z, 40 * z, 40 * z);
      const shard = (dx: number, h: number, w: number) => {
        ctx.fillStyle = '#a8dcf4';
        ctx.beginPath(); ctx.moveTo(X + dx * z, Y - h * z); ctx.lineTo(X + (dx + w) * z, Y); ctx.lineTo(X + (dx - w) * z, Y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8f8ff';
        ctx.beginPath(); ctx.moveTo(X + dx * z, Y - h * z); ctx.lineTo(X + (dx - w * 0.2) * z, Y); ctx.lineTo(X + (dx - w) * z, Y); ctx.closePath(); ctx.fill();
      };
      shard(-5, 12, 3); shard(5, 14, 3); shard(0, 20, 4);
      break;
    }
    case 'cuaderno': {
      R(ctx, X - 1 * z, Y - 8 * z, 2 * z, 10 * z, '#5a3e24');               // atril
      R(ctx, X - 7 * z, Y - 13 * z, 14 * z, 6 * z, '#7a5434');
      R(ctx, X - 6 * z, Y - 15 * z, 12 * z, 5 * z, '#f0e6cc');               // páginas
      R(ctx, X, Y - 15 * z, 1 * z, 5 * z, '#a89878');
      for (let i = 0; i < 3; i++) { R(ctx, X - 5 * z, Y - (14 - i * 1.5) * z, 4 * z, 0.6 * z, '#6a5a48'); R(ctx, X + 2 * z, Y - (14 - i * 1.5) * z, 3 * z, 0.6 * z, '#6a5a48'); }
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3);
      R(ctx, X - 8 * z, Y - 17 * z, 16 * z, 1 * z, '#ffe9a0');
      ctx.globalAlpha = 1;
      break;
    }
    case 'altarsavia': {
      R(ctx, X - 8 * z, Y - 4 * z, 16 * z, 8 * z, '#6a6660');
      R(ctx, X - 8 * z, Y - 4 * z, 16 * z, 2 * z, '#8a8680');
      R(ctx, X - 5 * z, Y - 6 * z, 10 * z, 3 * z, st.on ? '#6ad05a' : '#3a3632');
      for (let i = 0; i < 4; i++) R(ctx, X + (i * 5 - 9) * z, Y + 2 * z, 2 * z, 5 * z, '#5a4030');
      if (st.on) {
        const g = ctx.createRadialGradient(X, Y - 6 * z, 1, X, Y - 6 * z, 18 * z);
        g.addColorStop(0, 'rgba(150,240,130,0.4)'); g.addColorStop(1, 'rgba(150,240,130,0)');
        ctx.fillStyle = g; ctx.fillRect(X - 18 * z, Y - 24 * z, 36 * z, 36 * z);
      }
      break;
    }
    default: break;
  }
}

/** Proyectiles enemigos de R18 (true = dibujado). */
export function drawProjectileR18(ctx: CanvasRenderingContext2D, sprite: string, X: number, Y: number, vx: number, vy: number, t: number): boolean {
  switch (sprite) {
    case 'web': {
      ctx.strokeStyle = 'rgba(236,236,250,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * 2; ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(a) * 7, Y + Math.sin(a) * 7); }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(X, Y, 4, 0, Math.PI * 2); ctx.stroke();
      return true;
    }
    case 'pluma': {
      const a = Math.atan2(vy, vx);
      ctx.save(); ctx.translate(X, Y); ctx.rotate(a);
      ctx.fillStyle = '#3a3650'; ctx.fillRect(-7, -2, 12, 4);
      ctx.fillStyle = '#6a6488'; ctx.fillRect(-7, -1, 12, 1);
      ctx.fillStyle = '#e8c04a'; ctx.fillRect(4, -1, 3, 2);
      ctx.restore();
      return true;
    }
    case 'burbuja': {
      ctx.strokeStyle = 'rgba(180,230,255,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X, Y, 5 + Math.sin(t * 8) * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(X - 3, Y - 3, 2, 2);
      return true;
    }
    case 'velo': {
      const g = ctx.createRadialGradient(X, Y, 1, X, Y, 9);
      g.addColorStop(0, 'rgba(230,236,255,0.95)'); g.addColorStop(0.5, 'rgba(160,180,230,0.6)'); g.addColorStop(1, 'rgba(120,140,200,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 9, Y - 9, 18, 18);
      return true;
    }
    case 'esquirla': {
      const a = Math.atan2(vy, vx);
      ctx.save(); ctx.translate(X, Y); ctx.rotate(a);
      ctx.fillStyle = '#b8e8ff';
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -3); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-2, -1, 6, 1);
      ctx.restore();
      return true;
    }
    default: return false;
  }
}
