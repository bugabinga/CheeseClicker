(() => {
  "use strict";

  // ---------- config ----------
  const W = 160, H = 176;           // logical pixel size of the scene
  const GROUND_Y = 132;
  const SAVE_KEY = "cheeseClicker.v1";
  const MAX_VISIBLE_WORMS = 60;
  const MAX_VISIBLE_PER_TYPE = 14;
  const COST_GROWTH = 1.15;

  const WORMS = [
    { id: "baby",   name: "Baby Worm",   desc: "tiny wiggly friend. nibbles slowly.", cost: 15,      cps: 0.1,  color: "#ffb8cc", dark: "#e889a6", segs: 4, hat: null },
    { id: "busy",   name: "Busy Worm",   desc: "wears a headband. works hard!",       cost: 100,     cps: 1,    color: "#ff8fab", dark: "#d9607f", segs: 5, hat: "band" },
    { id: "digger", name: "Digger Worm", desc: "digs up buried cheese.",              cost: 1100,    cps: 8,    color: "#f0a77c", dark: "#c47650", segs: 5, hat: "helmet" },
    { id: "family", name: "Worm Family", desc: "the whole family helps out.",         cost: 12000,   cps: 47,   color: "#c9a0ff", dark: "#9a6fd6", segs: 5, hat: "bow" },
    { id: "king",   name: "King Worm",   desc: "rules the cheese kingdom.",           cost: 130000,  cps: 260,  color: "#ff6b8b", dark: "#c43d5d", segs: 6, hat: "crown" },
    { id: "space",  name: "Space Worm",  desc: "brings cheese from the moon.",        cost: 1400000, cps: 1400, color: "#8fd3ff", dark: "#4f9bd1", segs: 6, hat: "astro" },
  ];

  const OUTLINE = "#3a1d2b";

  // ---------- state ----------
  const state = { coins: 0, total: 0, owned: {} };
  WORMS.forEach(w => (state.owned[w.id] = 0));

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Number.isFinite(s.coins) && s.coins >= 0) state.coins = s.coins;
      if (Number.isFinite(s.total) && s.total >= 0) state.total = s.total;
      if (s.owned) WORMS.forEach(w => {
        const n = s.owned[w.id];
        if (Number.isInteger(n) && n >= 0) state.owned[w.id] = n;
      });
    } catch (_) { /* no storage — play without saving */ }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  const costOf = w => Math.ceil(w.cost * Math.pow(COST_GROWTH, state.owned[w.id]));
  const cps = () => WORMS.reduce((s, w) => s + w.cps * state.owned[w.id], 0);

  function fmt(n, decimals = false) {
    if (n < 1000) {
      if (decimals && n < 100 && n % 1 !== 0) return n.toFixed(1);
      return String(Math.floor(n));
    }
    const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
    let i = -1;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + units[i];
  }

  // ---------- pixel helpers ----------
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return [c, ctx];
  }

  function spriteFromStrings(rows, palette, scale = 1) {
    const h = rows.length, w = rows[0].length;
    const [c, ctx] = makeCanvas(w * scale, h * scale);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = palette[rows[y][x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    return c;
  }

  // ---------- cheese (procedural pixel wedge) ----------
  const CHEESE_W = 88, CHEESE_H = 76;
  const cheese = (() => {
    const [c, ctx] = makeCanvas(CHEESE_W, CHEESE_H);
    const img = ctx.createImageData(CHEESE_W, CHEESE_H);
    const A = [6, 34], B = [81, 34], C = [64, 5];
    const sign = (p, a, b) => (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    const inTop = (x, y) => {
      const p = [x + 0.5, y + 0.5];
      const d1 = sign(p, A, B), d2 = sign(p, B, C), d3 = sign(p, C, A);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
    const inFront = (x, y) => x >= 6 && x <= 81 && y >= 34 && y <= 71;
    const frontHoles = [[20, 48, 5.5], [44, 60, 4.5], [63, 46, 6.5], [31, 66, 3], [74, 62, 3.5], [14, 63, 2.5], [52, 40, 2.5]];
    const topHoles = [[40, 25, 5, 2.2], [57, 15, 3, 1.6], [26, 31, 3.5, 1.4], [66, 29, 3, 1.3]];
    const bite = [81, 50, 6]; // a little rat bite out of the side
    const inShape = (x, y) => {
      if (!(inTop(x, y) || inFront(x, y))) return false;
      const dx = x - bite[0], dy = y - bite[1];
      return dx * dx + dy * dy > bite[2] * bite[2];
    };
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const put = (x, y, col) => {
      const [r, g, b] = hex(col), i = (y * CHEESE_W + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    };
    for (let y = 0; y < CHEESE_H; y++) for (let x = 0; x < CHEESE_W; x++) {
      if (!inShape(x, y)) continue;
      const edge = !inShape(x - 1, y) || !inShape(x + 1, y) || !inShape(x, y - 1) || !inShape(x, y + 1);
      if (edge) { put(x, y, "#7a4a0a"); continue; }
      let col;
      if (inFront(x, y) && y > 34) {
        col = y > 66 ? "#e8a417" : x > 76 ? "#f2b526" : "#ffc93c";
        if (y === 35) col = "#ffd75e";
        for (const [hx, hy, r] of frontHoles) {
          const dx = x - hx, dy = y - hy;
          if (dx * dx + dy * dy <= r * r) {
            col = (dx + dy < -r * 0.3) ? "#b8790c" : (dx + dy > r * 0.9) ? "#ffd75e" : "#e09a12";
          }
        }
      } else if (y === 34) {
        col = "#e8a417"; // crease between faces
      } else {
        col = (y > 30) ? "#fff0b0" : "#ffe27a";
        for (const [hx, hy, rx, ry] of topHoles) {
          const dx = (x - hx) / rx, dy = (y - hy) / ry;
          if (dx * dx + dy * dy <= 1) col = dy < 0 ? "#d99a1a" : "#f2b526";
        }
      }
      put(x, y, col);
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, data: img.data };
  })();
  const cheeseAlphaAt = (x, y) => {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= CHEESE_W || y >= CHEESE_H) return 0;
    return cheese.data[(y * CHEESE_W + x) * 4 + 3];
  };

  // ---------- rat cursor (desktop only) ----------
  const RAT_PAL = { o: "#2a1a22", g: "#9a8fa8", l: "#c9c0d4", p: "#ff9fb8", k: "#000000", w: "#ffffff", t: "#e6889f" };
  const RAT_BODY = [
    "......oo............",
    ".....oppo...........",
    ".....oppoooooo......",
    "....oggggggggggoo...",
    "...oggkwgggggggggo..",
    "..ogggkkggggggggggo.",
    ".oggggggggggggggggo.",
  ];
  const RAT = RAT_BODY.concat([
    "pgggglllllllllllggot",
    ".ooolllllllllllggo.t",
    "....oooooooooooooott",
    "....pp..pp....pp.pp.",
  ]);
  const RAT_BITE = RAT_BODY.concat([
    "poogllllllllllllggot",
    ".wwolllllllllllggo.t",
    "....oooooooooooooott",
    "....pp..pp....pp.pp.",
  ]);
  const RAT_HOT_Y = 7; // nose row

  function setupRatCursor() {
    const fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return; // touch devices: no cursor at all
    const scale = 2;
    const url = rows => spriteFromStrings(rows, RAT_PAL, scale).toDataURL("image/png");
    const root = document.documentElement;
    // hotspot = the rat's nose
    root.style.setProperty("--rat-cursor", `url(${url(RAT)}) 0 ${RAT_HOT_Y * scale}`);
    root.style.setProperty("--rat-bite", `url(${url(RAT_BITE)}) 0 ${RAT_HOT_Y * scale}`);
    root.classList.add("rat");
    window.addEventListener("pointerdown", e => { if (e.pointerType === "mouse") root.classList.add("bite"); });
    window.addEventListener("pointerup", () => root.classList.remove("bite"));
    window.addEventListener("blur", () => root.classList.remove("bite"));
  }

  // ---------- worm drawing ----------
  function disc(ctx, cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + r * 0.8) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }

  function drawWorm(ctx, type, hx, hy, dir, arch, blink) {
    const n = type.segs;
    const sp = 4 - arch;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const x = Math.round(hx - dir * (n - 1 - i) * sp);
      const lift = Math.sin(Math.PI * i / (n - 1)) * arch * 5;
      pts.push([x, Math.round(hy - lift)]);
    }
    for (const [x, y] of pts) disc(ctx, x, y, 4, OUTLINE);
    pts.forEach(([x, y], i) => {
      disc(ctx, x, y, 3, i % 2 ? type.color : type.dark);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(x - 1, y - 3, 2, 1);
    });
    const [x, y] = pts[n - 1];
    disc(ctx, x, y, 3, type.color);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(x - 1, y - 3, 2, 1);
    // face
    ctx.fillStyle = "#1a0d14";
    if (blink) ctx.fillRect(dir > 0 ? x + 1 : x - 2, y, 2, 1);
    else ctx.fillRect(x + dir, y - 1, 1, 2);
    ctx.fillStyle = "#ff4f7a";
    ctx.fillRect(x + dir * 2, y + 1, 1, 1);
    ctx.fillRect(x - dir, y + 2, 1, 1); // smile
    drawHat(ctx, type.hat, x, y, dir);
  }

  function drawHat(ctx, hat, x, y, dir) {
    const R = (col, ax, ay, w, h) => { ctx.fillStyle = col; ctx.fillRect(ax, ay, w, h); };
    switch (hat) {
      case "band":
        R("#3b5bdb", x - 2, y - 3, 5, 1);
        R("#3b5bdb", x - dir * 3, y - 3, 1, 2);
        break;
      case "helmet":
        R(OUTLINE, x - 3, y - 6, 7, 3);
        R("#ffd43b", x - 2, y - 6, 5, 2);
        R("#ffd43b", x - 3, y - 4, 7, 1);
        R("#fff3a0", x - 1, y - 6, 1, 1);
        break;
      case "bow":
        R("#ff4f9a", x - 3, y - 6, 2, 2);
        R("#ff4f9a", x, y - 6, 2, 2);
        R("#c2185b", x - 1, y - 5, 1, 1);
        break;
      case "crown":
        R("#ffd43b", x - 2, y - 5, 5, 2);
        R("#ffd43b", x - 2, y - 6, 1, 1);
        R("#ffd43b", x, y - 7, 1, 2);
        R("#ffd43b", x + 2, y - 6, 1, 1);
        R("#e03131", x, y - 5, 1, 1);
        break;
      case "astro":
        disc(ctx, x, y, 5, "rgba(200,235,255,0.35)");
        R("#ffffff", x - 2, y - 4, 1, 1);
        R("#adb5bd", x, y - 7, 1, 2);
        R("#ff6b6b", x, y - 8, 1, 1);
        break;
    }
  }

  // ---------- scene ----------
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const wrap = document.getElementById("sceneWrap");

  // deterministic pseudo-random for static textures
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const background = (() => {
    const [c, g] = makeCanvas(W, H);
    // wall tiles
    for (let y = 0; y < GROUND_Y; y += 8) for (let x = 0; x < W; x += 8) {
      g.fillStyle = ((x + y) / 8) % 2 ? "#2e2350" : "#33285a";
      g.fillRect(x, y, 8, 8);
    }
    // ground
    for (let y = GROUND_Y; y < H; y++) for (let x = 0; x < W; x++) {
      const r = rnd();
      g.fillStyle = r < 0.08 ? "#4a2f22" : r < 0.14 ? "#7a5236" : "#5e3d2a";
      g.fillRect(x, y, 1, 1);
    }
    // pebbles
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(rnd() * W), y = GROUND_Y + 6 + Math.floor(rnd() * (H - GROUND_Y - 8));
      g.fillStyle = "#8a6a52"; g.fillRect(x, y, 2, 1);
      g.fillStyle = "#3d271b"; g.fillRect(x, y + 1, 2, 1);
    }
    // grass edge
    for (let x = 0; x < W; x++) {
      g.fillStyle = "#3f9c35"; g.fillRect(x, GROUND_Y, 1, 3);
      g.fillStyle = "#2b7a2b"; g.fillRect(x, GROUND_Y + 3, 1, 1);
      if (rnd() < 0.35) { g.fillStyle = "#5fcf4a"; g.fillRect(x, GROUND_Y - 1 - Math.floor(rnd() * 2), 1, 2); }
    }
    // plate under the cheese
    g.fillStyle = "#1b1430"; g.fillRect(28, 120, 104, 6);
    g.fillStyle = "#dfe6f0"; g.fillRect(30, 116, 100, 5);
    g.fillStyle = "#ffffff"; g.fillRect(34, 116, 92, 2);
    g.fillStyle = "#9aa6b8"; g.fillRect(36, 121, 88, 2);
    return c;
  })();

  const CHEESE_X = Math.floor((W - CHEESE_W) / 2);
  const CHEESE_BASE_Y = 42;
  let cheeseY = CHEESE_BASE_Y;
  let squash = 0;

  const worms = [];
  const particles = [];

  function addWormSprite(type) {
    if (worms.length >= MAX_VISIBLE_WORMS) return;
    if (worms.filter(w => w.type === type).length >= MAX_VISIBLE_PER_TYPE) return;
    worms.push({
      type,
      x: 10 + Math.random() * (W - 20),
      y: GROUND_Y + 12 + Math.floor(Math.random() * (H - GROUND_Y - 16)),
      dir: Math.random() < 0.5 ? -1 : 1,
      phase: Math.random() * Math.PI * 2,
      speed: 2.5 + Math.random() * 2,
      hop: 0,
      work: 1 + Math.random() * 4,
      blink: Math.random() * 4,
    });
    worms.sort((a, b) => a.y - b.y);
  }

  function spawnCrumbs(x, y, count) {
    const cols = ["#ffc93c", "#ffe27a", "#e8a417"];
    for (let i = 0; i < count; i++) {
      particles.push({
        kind: "crumb", x, y,
        vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 50,
        life: 0.8 + Math.random() * 0.4, col: cols[i % cols.length],
      });
    }
  }

  function spawnCoin(x, y) {
    particles.push({ kind: "coin", x, y, vx: 0, vy: -18, life: 1.0 });
  }

  function floatText(clientX, clientY, text) {
    const r = wrap.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "float";
    el.textContent = text;
    el.style.left = (clientX - r.left) + "px";
    el.style.top = (clientY - r.top) + "px";
    el.addEventListener("animationend", () => el.remove());
    wrap.appendChild(el);
  }

  // ---------- input ----------
  function toScene(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  }

  canvas.addEventListener("pointerdown", e => {
    const [sx, sy] = toScene(e);
    if (cheeseAlphaAt(sx - CHEESE_X, sy - cheeseY) === 0) return;
    e.preventDefault();
    state.coins += 1;
    state.total += 1;
    squash = 1;
    spawnCrumbs(sx, sy, 5);
    floatText(e.clientX, e.clientY, "+1");
    updateUI();
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  // ---------- shop ----------
  const shopEl = document.getElementById("shop");
  const coinsEl = document.getElementById("coins");
  const cpsEl = document.getElementById("cps");
  const totalEl = document.getElementById("total");
  const items = [];

  WORMS.forEach((w, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item";
    const [icon, ictx] = makeCanvas(32, 24);
    drawWorm(ictx, w, w.segs > 5 ? 27 : 25, 16, 1, 0.5, false);
    const info = document.createElement("div");
    const name = document.createElement("div"); name.className = "name";
    const desc = document.createElement("div"); desc.className = "desc";
    const cost = document.createElement("div"); cost.className = "cost";
    info.append(name, desc, cost);
    const owned = document.createElement("div"); owned.className = "owned";
    btn.append(icon, info, owned);
    btn.addEventListener("click", () => buy(w));
    shopEl.appendChild(btn);
    items.push({ w, i, btn, name, desc, cost, owned });
  });

  function buy(w) {
    const c = costOf(w);
    if (state.coins < c) return;
    state.coins -= c;
    state.owned[w.id]++;
    addWormSprite(w);
    updateUI();
    save();
  }

  function updateUI() {
    coinsEl.textContent = fmt(state.coins);
    cpsEl.textContent = fmt(cps(), true);
    totalEl.textContent = fmt(state.total);
    document.title = fmt(state.coins) + " cheese coins - Cheese Clicker";
    let prevUnlocked = true;
    for (const it of items) {
      const { w, btn } = it;
      const unlocked = it.i === 0 || state.owned[w.id] > 0 || state.total >= w.cost * 0.4;
      const visible = unlocked || prevUnlocked;
      btn.hidden = !visible;
      btn.classList.toggle("locked", !unlocked);
      const c = costOf(w);
      const afford = state.coins >= c;
      btn.disabled = !unlocked || !afford;
      btn.classList.toggle("affordable", unlocked && afford);
      it.name.textContent = unlocked ? w.name : "???";
      it.desc.textContent = unlocked ? `${w.desc} +${fmt(w.cps, true)}/s each` : "keep clicking...";
      it.cost.textContent = "🧀 " + fmt(c);
      it.owned.textContent = state.owned[w.id] || "";
      prevUnlocked = unlocked;
    }
  }

  document.getElementById("reset").addEventListener("click", () => {
    if (!confirm("Reset ALL progress? Your worms will go home.")) return;
    state.coins = 0; state.total = 0;
    WORMS.forEach(w => (state.owned[w.id] = 0));
    worms.length = 0;
    save();
    updateUI();
  });

  // ---------- loop ----------
  let last = performance.now();
  let t = 0;
  let uiTimer = 0, saveTimer = 0;

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;

    // income from worms
    const gain = cps() * dt;
    state.coins += gain;
    state.total += gain;

    // cheese bob + squash
    cheeseY = CHEESE_BASE_Y + Math.round(Math.sin(t * 1.6) * 2);
    squash = Math.max(0, squash - dt * 8);

    // worms
    for (const w of worms) {
      w.phase += dt * w.speed;
      const arch = Math.max(0, Math.sin(w.phase));
      w.x += w.dir * dt * (arch > 0 ? 4 : 0.5) * (w.type.segs > 5 ? 1.2 : 1);
      if (w.x < 12) { w.x = 12; w.dir = 1; }
      if (w.x > W - 12) { w.x = W - 12; w.dir = -1; }
      w.work -= dt;
      if (w.work <= 0) {
        w.work = 2 + Math.random() * 4;
        w.hop = 1;
        spawnCoin(w.x, w.y - 6);
      }
      w.hop = Math.max(0, w.hop - dt * 3);
      w.blink -= dt;
      if (w.blink < -0.15) w.blink = 2 + Math.random() * 4;
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === "crumb") p.vy += 160 * dt;
    }

    draw();

    uiTimer += dt; saveTimer += dt;
    if (uiTimer > 0.1) { uiTimer = 0; updateUI(); }
    if (saveTimer > 5) { saveTimer = 0; save(); }
    requestAnimationFrame(frame);
  }

  function draw() {
    ctx.drawImage(background, 0, 0);

    // glow behind cheese
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.fillStyle = `rgba(255, 220, 120, ${0.06 + pulse * 0.05})`;
    disc(ctx, 80, cheeseY + 40, 48, ctx.fillStyle);
    ctx.fillStyle = `rgba(255, 220, 120, ${0.06 + pulse * 0.04})`;
    disc(ctx, 80, cheeseY + 40, 38, ctx.fillStyle);

    // cheese (with squash on click)
    if (squash > 0) {
      const s = 1 - squash * 0.06;
      const w = Math.round(CHEESE_W * (1 + squash * 0.04)), h = Math.round(CHEESE_H * s);
      ctx.drawImage(cheese.canvas, Math.round(80 - w / 2), cheeseY + (CHEESE_H - h), w, h);
    } else {
      ctx.drawImage(cheese.canvas, CHEESE_X, cheeseY);
    }

    // worms
    for (const w of worms) {
      const arch = Math.max(0, Math.sin(w.phase));
      const hopY = Math.round(Math.sin(w.hop * Math.PI) * 4);
      drawWorm(ctx, w.type, Math.round(w.x), w.y - hopY, w.dir, arch, w.blink < 0);
    }

    // particles
    for (const p of particles) {
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.kind === "crumb") {
        ctx.fillStyle = p.col; ctx.fillRect(x, y, 2, 2);
      } else {
        ctx.globalAlpha = Math.min(1, p.life * 1.5);
        ctx.fillStyle = "#7a4a0a"; ctx.fillRect(x - 1, y - 2, 3, 5); ctx.fillRect(x - 2, y - 1, 5, 3);
        ctx.fillStyle = "#ffd43b"; ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.fillStyle = "#fff3a0"; ctx.fillRect(x - 1, y - 1, 1, 1);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- boot ----------
  load();
  WORMS.forEach(w => { for (let i = 0; i < state.owned[w.id]; i++) addWormSprite(w); });
  setupRatCursor();
  updateUI();
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  requestAnimationFrame(frame);
})();
