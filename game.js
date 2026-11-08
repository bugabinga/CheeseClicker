(() => {
  "use strict";

  // ---------- config ----------
  const W = 160, H = 176;           // logical pixel size of the scene
  const GROUND_Y = 92;      // horizon: wall above, dirt floor below
  const FLOOR_TOP = 104, FLOOR_BOTTOM = 172;
  const SAVE_KEY = "cheeseClicker.v1";
  const MAX_VISIBLE = 60;
  const MAX_VISIBLE_PER_TYPE = 10;
  const COST_GROWTH = 1.15;
  const OUTLINE = "#3a1d2b";

  // Helpers (worms + friends). kind = how it is drawn & moves.
  const HELPERS = [
    { id: "baby",    kind: "worm",    name: "Baby Worm",    desc: "tiny wiggly friend.",          cost: 15,      cps: 0.1,  color: "#ffb8cc", dark: "#e889a6", segs: 4, hat: null },
    { id: "busy",    kind: "worm",    name: "Busy Worm",    desc: "wears a headband. works hard!", cost: 100,     cps: 1,    color: "#ff8fab", dark: "#d9607f", segs: 5, hat: "band" },
    { id: "snail",   kind: "snail",   name: "Snail",        desc: "slow, but never gives up.",    cost: 500,     cps: 4 },
    { id: "digger",  kind: "worm",    name: "Digger Worm",  desc: "digs up buried cheese.",       cost: 1100,    cps: 8,    color: "#f0a77c", dark: "#c47650", segs: 5, hat: "helmet" },
    { id: "mouse",   kind: "mouse",   name: "Field Mouse",  desc: "the rat's little cousin.",     cost: 5000,    cps: 20 },
    { id: "family",  kind: "worm",    name: "Worm Family",  desc: "the whole family helps out.",  cost: 12000,   cps: 47,   color: "#c9a0ff", dark: "#9a6fd6", segs: 5, hat: "bow" },
    { id: "hamster", kind: "hamster", name: "Hamster",      desc: "stuffs cheese in its cheeks.", cost: 50000,   cps: 110 },
    { id: "king",    kind: "worm",    name: "King Worm",    desc: "rules the cheese kingdom.",    cost: 130000,  cps: 260,  color: "#ff6b8b", dark: "#c43d5d", segs: 6, hat: "crown" },
    { id: "bunny",   kind: "bunny",   name: "Cheese Bunny", desc: "hops in with cheese.",         cost: 600000,  cps: 700 },
    { id: "space",   kind: "worm",    name: "Space Worm",   desc: "brings cheese from the moon.", cost: 1400000, cps: 1400, color: "#8fd3ff", dark: "#4f9bd1", segs: 6, hat: "astro" },
  ];

  // One-time click upgrades.
  const UPGRADES = [
    { id: "teeth",   name: "Sharp Teeth",  desc: "+1 per click",                 cost: 50,      add: 1,  badge: "#ffffff" },
    { id: "bites",   name: "Bigger Bites", desc: "+2 per click",                 cost: 500,     add: 2,  badge: "#ffd43b" },
    { id: "muscles", name: "Rat Muscles",  desc: "clicks x2",                    cost: 5000,    mult: 2, badge: "#ff6b6b" },
    { id: "golden",  name: "Golden Teeth", desc: "clicks x2",                    cost: 50000,   mult: 2, badge: "#fab005" },
    { id: "fever",   name: "Cheese Fever", desc: "clicks also give 2% of coins/sec", cost: 300000, pct: 0.02, badge: "#ff8fab" },
    { id: "super",   name: "Super Rat",    desc: "clicks x3",                    cost: 4000000, mult: 3, badge: "#74c0fc" },
  ];

  // ---------- state ----------
  const state = { coins: 0, total: 0, owned: {}, upgrades: [] };
  HELPERS.forEach(h => (state.owned[h.id] = 0));

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Number.isFinite(s.coins) && s.coins >= 0) state.coins = s.coins;
      if (Number.isFinite(s.total) && s.total >= 0) state.total = s.total;
      if (s.owned) HELPERS.forEach(h => {
        const n = s.owned[h.id];
        if (Number.isInteger(n) && n >= 0) state.owned[h.id] = n;
      });
      if (Array.isArray(s.upgrades)) {
        state.upgrades = s.upgrades.filter(id => UPGRADES.some(u => u.id === id));
      }
    } catch (_) { /* no storage: play without saving */ }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  const has = id => state.upgrades.includes(id);
  const costOf = h => Math.ceil(h.cost * Math.pow(COST_GROWTH, state.owned[h.id]));
  const cps = () => HELPERS.reduce((s, h) => s + h.cps * state.owned[h.id], 0);
  function clickPower() {
    let add = 1, mult = 1, pct = 0;
    for (const u of UPGRADES) if (has(u.id)) {
      if (u.add) add += u.add;
      if (u.mult) mult *= u.mult;
      if (u.pct) pct += u.pct;
    }
    return add * mult + cps() * pct;
  }

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

  function disc(ctx, cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + r * 0.8) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }

  // Local drawing frame: (x, y) = front of the critter at ground level,
  // lx grows forward (in facing direction), ly grows down.
  function frame(ctx, x, y, dir) {
    return {
      px(lx, ly, w, h, col) {
        ctx.fillStyle = col;
        ctx.fillRect(dir > 0 ? x + lx : x - lx - w + 1, y + ly, w, h);
      },
      d(lx, ly, r, col) { disc(ctx, dir > 0 ? x + lx : x - lx, y + ly, r, col); },
    };
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

  // ---------- critter drawing ----------
  // All draw functions: (x, y) = front of critter at ground level.

  function drawWorm(ctx, h, x, y, dir, c) {
    const n = h.segs;
    const arch = c.arch;
    const sp = 4 - arch;
    const cy = y - 4;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const px = Math.round(x - dir * (n - 1 - i) * sp);
      const lift = Math.sin(Math.PI * i / (n - 1)) * arch * 5;
      pts.push([px, Math.round(cy - lift)]);
    }
    for (const [px, py] of pts) disc(ctx, px, py, 4, OUTLINE);
    pts.forEach(([px, py], i) => {
      disc(ctx, px, py, 3, i % 2 ? h.color : h.dark);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(px - 1, py - 3, 2, 1);
    });
    const [hx, hy] = pts[n - 1];
    disc(ctx, hx, hy, 3, h.color);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(hx - 1, hy - 3, 2, 1);
    ctx.fillStyle = "#1a0d14";
    if (c.blink) ctx.fillRect(dir > 0 ? hx + 1 : hx - 2, hy, 2, 1);
    else ctx.fillRect(hx + dir, hy - 1, 1, 2);
    ctx.fillStyle = "#ff4f7a";
    ctx.fillRect(hx + dir * 2, hy + 1, 1, 1);
    drawHat(ctx, h.hat, hx, hy, dir);
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

  function drawSnail(ctx, h, x, y, dir, c) {
    const f = frame(ctx, x, y, dir);
    const s = c.step ? 1 : 0; // foot stretch
    const body = "#c8e6a0", bodyDark = "#9cc46e";
    // outline pass
    f.px(-14, -4, 16 + s, 5, OUTLINE);
    f.px(-3 + s, -8, 5, 5, OUTLINE);
    f.d(-8, -8, 6, OUTLINE);
    // foot + head
    f.px(-13, -3, 14 + s, 3, body);
    f.px(-13, -1, 14 + s, 1, bodyDark);
    f.px(-2 + s, -7, 3, 5, body);
    // eye stalks
    f.px(0 + s, -11, 1, 4, bodyDark);
    f.px(-2 + s, -10, 1, 3, bodyDark);
    f.px(0 + s, -12, 1, 1, c.blink ? OUTLINE : "#000000");
    f.px(1 + s, -12, 1, 1, "#ffffff");
    f.px(1 + s, -5, 1, 1, "#ff7aa0"); // cheek
    // shell with spiral
    f.d(-8, -8, 5, "#d4823f");
    f.d(-8, -8, 3, "#9c5426");
    f.d(-8, -8, 2, "#e8a05a");
    f.px(-8, -8, 1, 1, "#9c5426");
    f.px(-10, -12, 2, 1, "#f5c08a");
  }

  function drawMouse(ctx, h, x, y, dir, c) {
    const f = frame(ctx, x, y, dir);
    const fur = "#b08a6e", belly = "#e6cbb3";
    // outline
    f.d(-8, -4, 4, OUTLINE);
    f.d(-4, -4, 4, OUTLINE);
    f.d(-1, -5, 4, OUTLINE);
    f.d(-3, -9, 3, OUTLINE);
    // tail
    f.px(-13, -3, 2, 1, "#e6889f");
    f.px(-15, -4, 2, 1, "#e6889f");
    f.px(-16, -6, 1, 2, "#e6889f");
    // body
    f.d(-8, -4, 3, fur);
    f.d(-4, -4, 3, fur);
    f.px(-9, -3, 8, 2, belly);
    f.d(-1, -5, 3, fur);
    f.px(2, -5, 2, 1, fur);
    f.px(3, -6, 1, 1, OUTLINE);
    f.px(4, -5, 1, 1, "#ff9fb8"); // nose
    // ear
    f.d(-3, -9, 2, "#ff9fb8");
    // eye
    f.px(0, -7, 1, c.blink ? 1 : 2, "#000000");
    // feet (2 frames)
    const a = c.step ? 1 : 0;
    f.px(-9 + a, 0, 2, 1, "#ff9fb8");
    f.px(-3 - a, 0, 2, 1, "#ff9fb8");
  }

  function drawHamster(ctx, h, x, y, dir, c) {
    const f = frame(ctx, x, y, dir);
    const fur = "#f4a259", cream = "#fff1d6";
    f.d(-6, -6, 6, OUTLINE);
    f.d(-7, -12, 2, OUTLINE);
    f.d(-7, -12, 1, "#ff9fb8");
    f.d(-6, -6, 5, fur);
    f.d(-3, -4, 3, cream);
    f.d(-1, -6, 2, cream);
    f.px(-9, -10, 3, 1, "#f9c58d"); // shine
    f.px(-2, -8, 1, c.blink ? 1 : 2, "#000000");
    f.px(1, -6, 1, 1, "#ff6b8b"); // nose
    f.px(-1, -4, 2, 1, "#ffb3c1"); // cheek pouch
    const a = c.step ? 1 : 0;
    f.px(-3 - a, 0, 2, 1, "#ff9fb8");
    f.px(-9 + a, 0, 2, 1, "#ff9fb8");
  }

  function drawBunny(ctx, h, x, y, dir, c) {
    const f = frame(ctx, x, y, dir);
    const fur = "#f1f3f5", shade = "#c9ced6";
    // outline
    f.d(-6, -5, 5, OUTLINE);
    f.d(-1, -9, 4, OUTLINE);
    f.px(-4, -18, 4, 7, OUTLINE);
    f.px(-1, -17, 3, 6, OUTLINE);
    f.d(-11, -6, 2, OUTLINE);
    // ears
    f.px(-3, -17, 2, 6, fur);
    f.px(0, -16, 1, 5, fur);
    f.px(-2, -16, 1, 4, "#ffb3c1");
    // body + head
    f.d(-6, -5, 4, fur);
    f.px(-9, -2, 6, 1, shade);
    f.d(-1, -9, 3, fur);
    f.d(-11, -6, 1, "#ffffff");
    f.px(0, -10, 1, c.blink ? 1 : 2, "#000000");
    f.px(3, -9, 1, 1, "#ff6b8b");
    f.px(1, -8, 1, 1, "#ffb3c1");
    // feet
    f.px(-8, 0, 3, 1, shade);
    f.px(-2, -1, 2, 1, shade);
  }

  const DRAW = { worm: drawWorm, snail: drawSnail, mouse: drawMouse, hamster: drawHamster, bunny: drawBunny };

  // movement style per kind: speed (px/s) + how the body animates
  const MOVE = {
    worm:    { speed: 3,  pause: 0 },
    snail:   { speed: 1.5, pause: 0 },
    mouse:   { speed: 14, pause: 0.5 },
    hamster: { speed: 9,  pause: 0.4 },
    bunny:   { speed: 16, pause: 0.3 },
  };

  // ---------- scene ----------
  // the cheese sits on the dirt; its bottom edge is at CHEESE_BASE
  const CHEESE_X = Math.floor((W - CHEESE_W) / 2);
  const CHEESE_BASE = 142;
  const cheeseY = CHEESE_BASE - 72;
  // where critters stand to nibble (head pokes 2px into the cheese)
  const EAT_LEFT_X = CHEESE_X + 8, EAT_RIGHT_X = CHEESE_X + 80;
  const EAT_Y_MIN = 128, EAT_Y_MAX = 152;
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const wrap = document.getElementById("sceneWrap");

  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const background = (() => {
    const [c, g] = makeCanvas(W, H);
    // sky: pixel bands with dithered edges
    const bands = ["#4aa3f0", "#5cb2f5", "#72c0f8", "#8bcefa", "#a6dbfc", "#c3e8fd"];
    const bh = GROUND_Y / bands.length;
    for (let y = 0; y < GROUND_Y; y++) {
      const i = Math.min(bands.length - 1, Math.floor(y / bh));
      const edge = y - i * bh >= bh - 2 && i < bands.length - 1;
      for (let x = 0; x < W; x++) {
        g.fillStyle = edge && (x + y) % 2 === 0 ? bands[i + 1] : bands[i];
        g.fillRect(x, y, 1, 1);
      }
    }
    // sun
    disc(g, 132, 20, 9, "#ffe066");
    disc(g, 132, 20, 7, "#fff3a0");
    g.fillStyle = "#ffffff"; g.fillRect(128, 15, 3, 2);
    // far hills
    for (let x = 0; x < W; x++) {
      const h1 = Math.round(10 + Math.sin(x / 17) * 5 + Math.sin(x / 7) * 2);
      g.fillStyle = "#7cc47a"; g.fillRect(x, GROUND_Y - h1, 1, h1);
      const h2 = Math.round(5 + Math.sin(x / 11 + 2) * 3);
      g.fillStyle = "#5aae55"; g.fillRect(x, GROUND_Y - h2, 1, h2);
    }
    for (let y = GROUND_Y; y < H; y++) for (let x = 0; x < W; x++) {
      const r = rnd();
      g.fillStyle = r < 0.08 ? "#4a2f22" : r < 0.14 ? "#7a5236" : "#5e3d2a";
      g.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(rnd() * W), y = GROUND_Y + 6 + Math.floor(rnd() * (H - GROUND_Y - 8));
      g.fillStyle = "#8a6a52"; g.fillRect(x, y, 2, 1);
      g.fillStyle = "#3d271b"; g.fillRect(x, y + 1, 2, 1);
    }
    for (let x = 0; x < W; x++) {
      g.fillStyle = "#3f9c35"; g.fillRect(x, GROUND_Y, 1, 3);
      g.fillStyle = "#2b7a2b"; g.fillRect(x, GROUND_Y + 3, 1, 1);
      if (rnd() < 0.35) { g.fillStyle = "#5fcf4a"; g.fillRect(x, GROUND_Y - 1 - Math.floor(rnd() * 2), 1, 2); }
    }
    // shadow where the cheese sits in the dirt
    for (let y = -5; y <= 5; y++) for (let x = -46; x <= 46; x++) {
      if ((x * x) / (46 * 46) + (y * y) / 25 <= 1) { g.fillStyle = "#3d271b"; g.fillRect(80 + x, CHEESE_BASE + y - 1, 1, 1); }
    }
    return c;
  })();

  let squash = 0;
  const clouds = [
    { x: 10, y: 14, s: 1.0, v: 2.0 },
    { x: 80, y: 34, s: 0.8, v: 1.4 },
    { x: 140, y: 52, s: 0.6, v: 1.0 },
  ];
  function drawCloud(cx, cy, k) {
    const r = Math.round(5 * k);
    const parts = [[0, 0, r], [r + 1, -Math.round(r * 0.6), r + 1], [2 * r + 2, 0, r], [r + 1, 1, r]];
    for (const [dx, dy, rr] of parts) disc(ctx, cx + dx, cy + dy, rr, "#dbeefa");
    for (const [dx, dy, rr] of parts) disc(ctx, cx + dx, cy + dy - 1, rr, "#ffffff");
  }

  const critters = [];
  const particles = [];

  function addCritter(h) {
    if (critters.length >= MAX_VISIBLE) return;
    if (critters.filter(c => c.h === h).length >= MAX_VISIBLE_PER_TYPE) return;
    critters.push({
      h,
      x: 16 + Math.random() * (W - 32),
      y: FLOOR_TOP + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP),
      mode: "go", tx: 0, ty: 0, eatT: 0, nib: 0,
      dir: Math.random() < 0.5 ? -1 : 1,
      phase: Math.random() * Math.PI * 2,
      rate: 0.8 + Math.random() * 0.5,
      rest: 0,
      hop: 0,
      work: 1 + Math.random() * 4,
      blinkT: Math.random() * 4,
      // render state
      arch: 0, step: false, blink: false, lift: 0,
    });
    pickTarget(critters[critters.length - 1]);
  }

  // decide where to go next: usually the cheese, sometimes a stroll
  function pickTarget(c) {
    c.mode = "go";
    const r = Math.random();
    if (r < 0.45) {
      // nibble the bottom of the front face
      c.tx = CHEESE_X + 14 + Math.random() * (CHEESE_W - 28);
      c.ty = CHEESE_BASE + 1 + Math.random() * 8;
      c.eatDir = Math.random() < 0.5 ? 1 : -1;
    } else if (r < 0.75) {
      const left = c.x < 80;
      c.tx = left ? EAT_LEFT_X : EAT_RIGHT_X;
      c.ty = EAT_Y_MIN + Math.random() * (EAT_Y_MAX - EAT_Y_MIN);
      c.eatDir = left ? 1 : -1;
    } else {
      c.tx = 16 + Math.random() * (W - 32);
      c.ty = FLOOR_TOP + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP);
      // don't stop inside the cheese
      if (c.tx > CHEESE_X && c.tx < CHEESE_X + CHEESE_W && c.ty > 118 && c.ty < 150) c.ty = 156 + Math.random() * 14;
      c.eatDir = 0;
    }
  }

  function spawnCrumbs(x, y, count, power = 1) {
    const cols = ["#ffc93c", "#ffe27a", "#e8a417"];
    for (let i = 0; i < count; i++) {
      particles.push({
        kind: "crumb", x, y,
        vx: (Math.random() - 0.5) * 60 * power, vy: (-30 - Math.random() * 50) * power,
        life: 0.8 + Math.random() * 0.4, col: cols[i % cols.length],
      });
    }
  }
  const spawnCoin = (x, y) => particles.push({ kind: "coin", x, y, vx: 0, vy: -18, life: 1.0 });

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
    const gain = clickPower();
    state.coins += gain;
    state.total += gain;
    squash = 1;
    spawnCrumbs(sx, sy, 5);
    floatText(e.clientX, e.clientY, "+" + fmt(gain, true));
    updateUI();
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  // ---------- shop UI ----------
  const shopEl = document.getElementById("shop");
  const upEl = document.getElementById("upgrades");
  const upSection = document.getElementById("upgradeSection");
  const coinsEl = document.getElementById("coins");
  const cpsEl = document.getElementById("cps");
  const perClickEl = document.getElementById("perClick");
  const totalEl = document.getElementById("total");
  const items = [];
  const upItems = [];

  function makeItem(icon, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item";
    const info = document.createElement("div");
    const name = document.createElement("div"); name.className = "name";
    const desc = document.createElement("div"); desc.className = "desc";
    const cost = document.createElement("div"); cost.className = "cost";
    info.append(name, desc, cost);
    const owned = document.createElement("div"); owned.className = "owned";
    btn.append(icon, info, owned);
    btn.addEventListener("click", onClick);
    return { btn, name, desc, cost, owned };
  }

  const iconState = { arch: 0.5, step: false, blink: false };
  HELPERS.forEach((h, i) => {
    const [icon, ictx] = makeCanvas(32, 24);
    const x = h.kind === "worm" ? 25 : h.kind === "bunny" ? 21 : 22;
    DRAW[h.kind](ictx, h, x, 21, 1, iconState);
    const it = makeItem(icon, () => buyHelper(h));
    shopEl.appendChild(it.btn);
    items.push({ h, i, ...it });
  });

  UPGRADES.forEach(u => {
    const [icon, ictx] = makeCanvas(32, 24);
    ictx.drawImage(spriteFromStrings(RAT, RAT_PAL), 6, 8);
    disc(ictx, 26, 5, 4, OUTLINE);
    disc(ictx, 26, 5, 3, u.badge);
    ictx.fillStyle = OUTLINE;
    ictx.fillRect(26, 3, 1, 5); ictx.fillRect(24, 5, 5, 1); // "+" badge
    const it = makeItem(icon, () => buyUpgrade(u));
    it.btn.classList.add("upgrade");
    upEl.appendChild(it.btn);
    upItems.push({ u, ...it });
  });

  function buyHelper(h) {
    const c = costOf(h);
    if (state.coins < c) return;
    state.coins -= c;
    state.owned[h.id]++;
    addCritter(h);
    updateUI();
    save();
  }

  function buyUpgrade(u) {
    if (has(u.id) || state.coins < u.cost) return;
    state.coins -= u.cost;
    state.upgrades.push(u.id);
    updateUI();
    save();
  }

  function updateUI() {
    coinsEl.textContent = fmt(state.coins);
    cpsEl.textContent = fmt(cps(), true);
    perClickEl.textContent = fmt(clickPower(), true);
    totalEl.textContent = fmt(state.total);
    document.title = fmt(state.coins) + " cheese coins - Cheese Clicker";

    let prevUnlocked = true;
    for (const it of items) {
      const { h, btn } = it;
      const unlocked = it.i === 0 || state.owned[h.id] > 0 || state.total >= h.cost * 0.4;
      btn.hidden = !(unlocked || prevUnlocked);
      btn.classList.toggle("locked", !unlocked);
      const c = costOf(h);
      const afford = state.coins >= c;
      btn.disabled = !unlocked || !afford;
      btn.classList.toggle("affordable", unlocked && afford);
      it.name.textContent = unlocked ? h.name : "???";
      it.desc.textContent = unlocked ? `${h.desc} +${fmt(h.cps, true)}/s each` : "keep clicking...";
      it.cost.textContent = "🧀 " + fmt(c);
      it.owned.textContent = state.owned[h.id] || "";
      prevUnlocked = unlocked;
    }

    let anyUp = false;
    for (const it of upItems) {
      const { u, btn } = it;
      const show = !has(u.id) && state.total >= u.cost * 0.3;
      btn.hidden = !show;
      if (!show) continue;
      anyUp = true;
      const afford = state.coins >= u.cost;
      btn.disabled = !afford;
      btn.classList.toggle("affordable", afford);
      it.name.textContent = u.name;
      it.desc.textContent = u.desc;
      it.cost.textContent = "🧀 " + fmt(u.cost);
    }
    upSection.hidden = !anyUp;
  }

  document.getElementById("reset").addEventListener("click", () => {
    if (!confirm("Reset ALL progress? Your helpers will go home.")) return;
    state.coins = 0; state.total = 0; state.upgrades = [];
    HELPERS.forEach(h => (state.owned[h.id] = 0));
    critters.length = 0;
    save();
    updateUI();
  });

  // ---------- loop ----------
  let last = performance.now();
  let t = 0;
  let uiTimer = 0, saveTimer = 0;

  function updateCritter(c, dt) {
    const kind = c.h.kind, m = MOVE[kind];
    c.lift = 0;
    if (c.mode === "eat") {
      // nibble nibble
      c.nib = Math.sin(t * 14 * c.rate) > 0 ? 1 : 0;
      c.arch = kind === "worm" ? 0.25 + 0.25 * Math.sin(t * 10) : 0;
      c.step = false;
      c.eatT -= dt;
      if (Math.random() < dt * 2) spawnCrumbs(c.x + c.dir * 2, c.y - 6, 1, 0.4);
      c.work -= dt;
      if (c.work <= 0) {
        c.work = 1.5 + Math.random() * 2.5;
        c.hop = 1;
        spawnCoin(c.x - c.dir * 4, c.y - 16);
      }
      if (c.eatT <= 0) pickTarget(c);
    } else if (c.rest > 0) {
      c.rest -= dt;
      c.nib = 0;
    } else {
      c.nib = 0;
      c.phase += dt * 6 * c.rate;
      let v = m.speed * c.rate;
      if (kind === "worm") {
        c.arch = Math.max(0, Math.sin(c.phase * 0.6));
        v *= c.arch > 0 ? 1.4 : 0.15;
        v *= 2; // worms hurry a bit so they reach the cheese
      } else if (kind === "bunny") {
        c.lift = Math.max(0, Math.sin(c.phase * 0.7)) * 7;
        v *= c.lift > 0 ? 1 : 0;
      } else if (kind === "hamster") {
        c.lift = Math.abs(Math.sin(c.phase * 1.2)) * 1.5;
      } else if (kind === "snail") {
        v *= 2;
      }
      c.step = Math.sin(c.phase * 1.5) > 0;
      const dx = c.tx - c.x, dy = c.ty - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1.5) {
        if (c.eatDir) {
          c.mode = "eat";
          c.dir = c.eatDir;
          c.eatT = 3 + Math.random() * 5;
          c.x = c.tx; c.y = c.ty;
        } else {
          c.rest = 0.3 + Math.random();
          pickTarget(c);
        }
      } else {
        if (Math.abs(dx) > 1) c.dir = dx > 0 ? 1 : -1;
        const stepLen = Math.min(dist, v * dt);
        c.x += dx / dist * stepLen;
        c.y += dy / dist * stepLen;
        if (m.pause && Math.random() < dt * m.pause * 0.5) c.rest = 0.3 + Math.random() * 0.8;
      }
    }
    c.x = Math.max(16, Math.min(W - 16, c.x));
    c.y = Math.max(FLOOR_TOP, Math.min(FLOOR_BOTTOM, c.y));
    c.hop = Math.max(0, c.hop - dt * 3);
    c.blinkT -= dt;
    if (c.blinkT < -0.15) c.blinkT = 2 + Math.random() * 4;
    c.blink = c.blinkT < 0 || c.mode === "eat" && c.nib === 1;
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;

    const gain = cps() * dt;
    state.coins += gain;
    state.total += gain;

    squash = Math.max(0, squash - dt * 8);

    for (const c of critters) updateCritter(c, dt);

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
    requestAnimationFrame(tick);
  }

  function draw() {
    ctx.drawImage(background, 0, 0);


    for (const c of clouds) {
      const x = ((c.x + t * c.v) % (W + 40)) - 30;
      drawCloud(Math.round(x), c.y, c.s);
    }

    critters.sort((a, b) => a.y - b.y);
    const drawCritter = c => {
      const hopY = Math.round(Math.sin(c.hop * Math.PI) * 4 + c.lift);
      DRAW[c.h.kind](ctx, c.h, Math.round(c.x) + c.dir * c.nib, Math.round(c.y) - hopY, c.dir, c);
    };
    for (const c of critters) if (c.y < CHEESE_BASE) drawCritter(c);

    if (squash > 0) {
      const w = Math.round(CHEESE_W * (1 + squash * 0.04)), h = Math.round(CHEESE_H * (1 - squash * 0.06));
      ctx.drawImage(cheese.canvas, Math.round(80 - w / 2), cheeseY + (CHEESE_H - h), w, h);
    } else {
      ctx.drawImage(cheese.canvas, CHEESE_X, cheeseY);
    }

    for (const c of critters) if (c.y >= CHEESE_BASE) drawCritter(c);

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
  HELPERS.forEach(h => { for (let i = 0; i < state.owned[h.id]; i++) addCritter(h); });
  setupRatCursor();
  updateUI();
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
  requestAnimationFrame(tick);
})();
