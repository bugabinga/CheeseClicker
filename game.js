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
    { id: "bird",    kind: "bird",    name: "Bluebird",     desc: "flies in to peck the cheese.", cost: 2500,    cps: 13 },
    { id: "mouse",   kind: "mouse",   name: "Field Mouse",  desc: "the rat's little cousin.",     cost: 5000,    cps: 20 },
    { id: "family",  kind: "worm",    name: "Worm Family",  desc: "the whole family helps out.",  cost: 12000,   cps: 47,   color: "#c9a0ff", dark: "#9a6fd6", segs: 5, hat: "bow" },
    { id: "hamster", kind: "hamster", name: "Hamster",      desc: "stuffs cheese in its cheeks.", cost: 50000,   cps: 110 },
    { id: "king",    kind: "worm",    name: "King Worm",    desc: "rules the cheese kingdom.",    cost: 130000,  cps: 260,  color: "#ff6b8b", dark: "#c43d5d", segs: 6, hat: "crown" },
    { id: "pig",     kind: "pig",     name: "Piggy",        desc: "oink! eats cheese super fast.", cost: 260000,  cps: 520 },
    { id: "bunny",   kind: "bunny",   name: "Cheese Bunny", desc: "hops in with cheese.",         cost: 600000,  cps: 700 },
    { id: "space",   kind: "worm",    name: "Space Worm",   desc: "brings cheese from the moon.", cost: 1400000, cps: 1400, color: "#8fd3ff", dark: "#4f9bd1", segs: 6, hat: "astro" },
    { id: "cow",     kind: "cow",     name: "Cheese Cow",   desc: "makes milk for more cheese.",  cost: 4000000, cps: 3600 },
  ];

  // One-time click upgrades.
  const UPGRADES = [
    { id: "teeth",   name: "Sharp Teeth",  desc: "+1 per click",                 cost: 50,      add: 1,  badge: "#ffffff" },
    { id: "bites",   name: "Bigger Bites", desc: "+2 per click",                 cost: 500,     add: 2,  badge: "#ffd43b" },
    { id: "muscles", name: "Rat Muscles",  desc: "clicks x2",                    cost: 5000,    mult: 2, badge: "#ff6b6b" },
    { id: "golden",  name: "Golden Teeth", desc: "clicks x2",                    cost: 50000,   mult: 2, badge: "#fab005" },
    { id: "fever",   name: "Cheese Fever", desc: "clicks also give 2% of coins/sec", cost: 300000, pct: 0.02, badge: "#ff8fab" },
    { id: "super",   name: "Super Rat",    desc: "clicks x3",                    cost: 4000000, mult: 3, badge: "#74c0fc" },
    { id: "eyes",    name: "Sharp Eyes",     desc: "crit spots show up 2x more often", cost: 1500,   badge: "#ff4d4d" },
    { id: "claws",   name: "Crit Claws",     desc: "crits x2 stronger",              cost: 25000,  badge: "#e03131" },
    { id: "whiskers",name: "Lucky Whiskers", desc: "golden cheese 2x more often",    cost: 7777,   badge: "#ffd43b" },
    { id: "tail",    name: "Combo Tail",     desc: "max combo bonus x3 -> x5",       cost: 60000,  badge: "#ff922b" },
  ];

  UPGRADES.sort((a, b) => a.cost - b.cost);

  // ---------- special clicks ----------
  const CRIT_SPOT_MULT = 10;     // hitting a crit spot
  const LUCKY_CRIT_CHANCE = 0.04, LUCKY_CRIT_MULT = 3;
  const COMBO_WINDOW = 1.0;      // seconds between clicks to keep a combo
  const GOLDEN_EFFECTS = [
    { id: "lucky",  name: "LUCKY!",        weight: 45 },
    { id: "frenzy", name: "FRENZY",        weight: 40, secs: 77, cpsMult: 7,   label: "helpers x7" },
    { id: "cfrenzy",name: "CLICK FRENZY",  weight: 15, secs: 13, clickMult: 77, label: "clicks x77" },
  ];
  const buffs = []; // { id, name, label, until, cpsMult, clickMult, secs }

  const EVENTS = [
    { id: "rain",      name: "RAIN",         label: "helpers x2",                 dur: 45, cpsMult: 2 },
    { id: "freeze",    name: "FREEZE",       label: "clicks x3, helpers x0.5",    dur: 40, clickMult: 3, cpsMult: 0.5 },
    { id: "flare",     name: "SUN ERUPTION", label: "clicks x2, more crits",      dur: 35, clickMult: 2, critRate: 3 },
    { id: "eclipse",   name: "ECLIPSE",      label: "golden cheese everywhere",   dur: 30, goldenRate: 8 },
    { id: "volcano",   name: "VOLCANO",      label: "catch the hot cheese",       dur: 30 },
    { id: "windy",     name: "WINDY",        label: "combos last longer, grow x2", dur: 40, comboWindow: 2, comboStep: 2 },
    { id: "bloodmoon", name: "BLOOD MOON",   label: "click the monsters",         dur: 45 },
  ];
  let activeEvent = null;   // { def, until }
  let nextEvent = 50 + Math.random() * 30;
  let lastEventId = "";
  const DOUBLE_SECS = 20;   // blood moon monster reward: x2 cheese for 20s

  // ---------- state ----------
  const state = { coins: 0, total: 0, owned: {}, upgrades: [], crowns: 0 };
  const PRESTIGE_BASE = 1e5;    // coins made this run for the first crown
  const CROWN_BONUS = 0.10;     // +10% coins per crown
  const crownsFor = total => Math.floor(Math.cbrt(total / PRESTIGE_BASE));
  const prestigeMult = () => 1 + state.crowns * CROWN_BONUS;
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
      if (Number.isInteger(s.crowns) && s.crowns >= 0) state.crowns = s.crowns;
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
  const baseCps = () => HELPERS.reduce((s, h) => s + h.cps * state.owned[h.id], 0);
  const buffMult = key => buffs.reduce((m, b) => m * (b[key] || 1), 1);
  const evt = () => (activeEvent && activeEvent.def) || {};
  const cps = () => baseCps() * buffMult("cpsMult") * (evt().cpsMult || 1) * prestigeMult();
  function clickPower() {
    let add = 1, mult = 1, pct = 0;
    for (const u of UPGRADES) if (has(u.id)) {
      if (u.add) add += u.add;
      if (u.mult) mult *= u.mult;
      if (u.pct) pct += u.pct;
    }
    return (add * mult * prestigeMult() + cps() * pct) * buffMult("clickMult") * (evt().clickMult || 1);
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
  const frozenCheese = (() => {
    const [c, g] = makeCanvas(CHEESE_W, CHEESE_H);
    g.drawImage(cheese.canvas, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(116, 192, 252, 0.55)";
    g.fillRect(0, 0, CHEESE_W, CHEESE_H);
    g.fillStyle = "#ffffff";
    for (let x = 10; x < 80; x += 7) g.fillRect(x, 36, 2, 3 + (x % 3));   // icicles
    g.fillRect(14, 40, 1, 6); g.fillRect(14, 40, 4, 1);                     // shine
    return c;
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

  function drawBird(ctx, h, x, y, dir, c) {
    const f = frame(ctx, x, y, dir);
    const blue = "#4dabf7", dark = "#1c7ed6";
    const flying = c.lift > 2;
    f.d(-3, -4, 4, OUTLINE);
    f.d(0, -7, 3, OUTLINE);
    f.px(-8, -6, 3, 2, OUTLINE);
    f.d(-3, -4, 3, blue);
    f.px(-4, -3, 4, 2, "#ffffff");      // belly
    f.d(0, -7, 2, blue);
    f.px(-8, -5, 3, 1, dark);           // tail
    f.px(2, -7, 2, 1, "#ffa94d");       // beak
    f.px(0, -8, 1, c.blink ? 1 : 1, c.blink ? dark : "#000000");
    f.px(1, -6, 1, 1, "#ff8fab");       // cheek
    if (flying && c.step) { f.px(-5, -10, 4, 3, OUTLINE); f.px(-4, -9, 3, 2, dark); }   // wing up
    else { f.px(-5, -5, 4, 2, dark); }                                                    // wing down
    if (!flying) { f.px(-3, -1, 1, 1, "#ffa94d"); f.px(-1, -1, 1, 1, "#ffa94d"); }
  }

  function drawPig(ctx, h, x, y, dir, c) {
    const f = frame(ctx, x, y, dir);
    const pink = "#ffb3c7", dark = "#f783ac";
    const a = c.step ? 1 : 0;
    // legs
    for (const [lx, o] of [[-11, a], [-8, -a], [-5, a], [-2, -a]]) { f.px(lx, -3 + o * 0, 2, 3, OUTLINE); f.px(lx, -3, 1, 2, dark); }
    f.d(-7, -7, 6, OUTLINE);
    f.d(-1, -8, 4, OUTLINE);
    f.px(-15, -10, 2, 1, OUTLINE); f.px(-16, -11, 1, 2, OUTLINE);  // curly tail
    f.d(-7, -7, 5, pink);
    f.px(-10, -11, 4, 1, "#ffd8e4");     // shine
    f.d(-1, -8, 3, pink);
    f.px(-3, -13, 2, 2, dark);            // ear
    f.px(2, -9, 3, 3, "#ff8fab");         // snout
    f.px(3, -8, 1, 1, "#c2255c"); f.px(4, -8, 1, 1, "#c2255c");
    f.px(0, -10, 1, c.blink ? 1 : 2, "#000000");
  }

  function drawCow(ctx, h, x, y, dir, c) {
    const f = frame(ctx, x, y, dir);
    const a = c.step ? 1 : 0;
    // legs
    for (const [lx, o] of [[-19, a], [-15, 0], [-9, a], [-5, 0]]) {
      f.px(lx + o, -6, 3, 6, OUTLINE); f.px(lx + o + 1, -6, 1, 4, "#ffffff"); f.px(lx + o, -1, 3, 1, "#495057");
    }
    // body
    f.px(-21, -17, 20, 12, OUTLINE);
    f.px(-20, -16, 18, 10, "#ffffff");
    f.px(-17, -15, 4, 3, "#343a40"); f.px(-10, -12, 5, 4, "#343a40"); f.px(-6, -16, 3, 2, "#343a40"); f.px(-19, -9, 3, 2, "#343a40");
    f.px(-12, -7, 4, 2, "#ffc9d6");        // udder
    // tail
    f.px(-22, -16, 1, 7, OUTLINE); f.px(-23, -10, 2, 2, "#343a40");
    // head
    f.px(-4, -21, 9, 10, OUTLINE);
    f.px(-3, -20, 7, 8, "#ffffff");
    f.px(-2, -20, 3, 2, "#343a40");
    f.px(0, -15, 5, 4, "#ffb3c1");          // muzzle
    f.px(1, -14, 1, 1, "#c2255c"); f.px(3, -14, 1, 1, "#c2255c");
    f.px(0, -18, 1, c.blink ? 1 : 2, "#000000");
    f.px(-3, -23, 1, 2, "#ffe8a3"); f.px(2, -23, 1, 2, "#ffe8a3");   // horns
    f.px(-6, -19, 2, 2, "#ffffff");                                  // ear
    f.px(-3, -11, 3, 2, "#ffd43b");                                  // bell
  }

  const DRAW = { worm: drawWorm, snail: drawSnail, mouse: drawMouse, hamster: drawHamster, bunny: drawBunny, bird: drawBird, pig: drawPig, cow: drawCow };

  // movement style per kind: speed (px/s) + how the body animates
  const MOVE = {
    worm:    { speed: 3,  pause: 0 },
    snail:   { speed: 1.5, pause: 0 },
    mouse:   { speed: 14, pause: 0.5 },
    hamster: { speed: 9,  pause: 0.4 },
    bunny:   { speed: 16, pause: 0.3 },
    bird:    { speed: 24, pause: 0 },
    pig:     { speed: 10, pause: 0.4 },
    cow:     { speed: 6,  pause: 0.5 },
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
    // a sleepy volcano on the left
    for (let y = 66; y < GROUND_Y; y++) {
      const hw = Math.round(4 + (y - 66) * 0.75);
      for (let x = 24 - hw; x <= 24 + hw; x++) {
        const edge = x === 24 - hw || x === 24 + hw || y === 66;
        g.fillStyle = edge ? "#3d2f45" : x < 24 ? "#8a7a90" : "#6b5b73";
        g.fillRect(x, y, 1, 1);
      }
    }
    g.fillStyle = "#3d2f45"; g.fillRect(21, 66, 7, 2);
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
    const id = activeEvent ? activeEvent.def.id : "";
    const dark = id === "rain" || id === "bloodmoon" || id === "eclipse";
    for (const [dx, dy, rr] of parts) disc(ctx, cx + dx, cy + dy, rr, dark ? "#6c7184" : "#dbeefa");
    for (const [dx, dy, rr] of parts) disc(ctx, cx + dx, cy + dy - 1, rr, dark ? "#8a90a6" : "#ffffff");
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

  function floatText(clientX, clientY, text, kind = "") {
    const r = wrap.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "float" + (kind ? " " + kind : "");
    el.textContent = text;
    el.style.left = (clientX - r.left) + "px";
    el.style.top = (clientY - r.top) + "px";
    el.addEventListener("animationend", () => el.remove());
    wrap.appendChild(el);
  }

  // ---------- crit spots & golden cheese ----------
  let critSpot = null;          // { x, y, life, max } in cheese-local pixels
  const critSpotDelay = () => ((has("eyes") ? 2 : 4) + Math.random() * (has("eyes") ? 3 : 6)) / (evt().critRate || 1);
  let nextCritSpot = 3;

  function spawnCritSpot() {
    for (let tries = 0; tries < 50; tries++) {
      const x = 12 + Math.floor(Math.random() * (CHEESE_W - 24));
      const y = 12 + Math.floor(Math.random() * (CHEESE_H - 18));
      // fully inside the cheese
      if (cheeseAlphaAt(x, y) && cheeseAlphaAt(x - 4, y) && cheeseAlphaAt(x + 4, y) && cheeseAlphaAt(x, y - 4) && cheeseAlphaAt(x, y + 4)) {
        const max = 2.5;
        critSpot = { x, y, life: max, max };
        return;
      }
    }
  }

  let golden = null;            // { x, y, life, max }
  const goldenDelay = () => (40 + Math.random() * 80) * (has("whiskers") ? 0.5 : 1) / (evt().goldenRate || 1);
  let nextGolden = 25 + Math.random() * 20; // first one comes fairly soon

  function spawnGolden() {
    let x, y;
    do {
      x = 20 + Math.random() * (W - 40);
      y = 20 + Math.random() * (H - 40);
    } while (x > CHEESE_X - 14 && x < CHEESE_X + CHEESE_W + 14 && y > cheeseY - 14 && y < CHEESE_BASE + 14);
    const max = has("whiskers") ? 18 : 13;
    golden = { x, y, life: max, max };
  }

  function clickGolden(e) {
    golden = null;
    nextGolden = goldenDelay();
    const pool = GOLDEN_EFFECTS.filter(g => !(g.cpsMult && baseCps() === 0));
    let r = Math.random() * pool.reduce((s, g) => s + g.weight, 0);
    const fx = pool.find(g => (r -= g.weight) < 0) || pool[0];
    // show the message in the middle of the scene so it never gets cut off
    const rr = canvas.getBoundingClientRect();
    e = { clientX: rr.left + rr.width / 2, clientY: rr.top + rr.height * 0.3 };
    flash("gold");
    if (fx.id === "lucky") {
      const gain = Math.max(clickPower() * 30 + 50, Math.min(state.coins * 0.15, cps() * 900));
      earn(gain);
      floatText(e.clientX, e.clientY, "LUCKY! +" + fmt(gain), "gold");
    } else {
      // same buff again just refreshes its timer
      const old = buffs.findIndex(b => b.id === fx.id);
      if (old >= 0) buffs.splice(old, 1);
      buffs.push({ id: fx.id, name: fx.name, label: fx.label, secs: fx.secs, until: t + fx.secs, cpsMult: fx.cpsMult, clickMult: fx.clickMult });
      floatText(e.clientX, e.clientY, fx.name + "! " + fx.label, "gold");
    }
    updateUI();
  }

  const flashEl = document.getElementById("flash");
  function flash(kind) {
    flashEl.className = "";
    void flashEl.offsetWidth; // restart animation
    flashEl.className = "flash-" + kind;
  }

  const GOLD_PAL = { o: "#7a4a0a", Y: "#fff3a0", G: "#ffd43b", h: "#e0a800", D: "#d4a017" };
  const goldenSprite = spriteFromStrings([
    "..........oo....",
    "........ooYYo...",
    "......ooYYYYo...",
    "....ooYYYYYYYo..",
    "..ooYYYYYYYYYo..",
    "ooYYYYYYYYYYYYo.",
    "oGGGGGGGGGGGGGo.",
    "oGGhGGGGGhhGGGo.",
    "oGhhGGGGGGGGGGo.",
    "oGGGGGhhGGGGhGo.",
    "oDDDDDDDDDDDDDo.",
    "ooooooooooooooo.",
  ], GOLD_PAL);

  function updateSpecials(dt) {
    if (critSpot) {
      critSpot.life -= dt;
      if (critSpot.life <= 0) { critSpot = null; nextCritSpot = critSpotDelay(); }
    } else if ((nextCritSpot -= dt) <= 0) spawnCritSpot();

    if (golden) {
      golden.life -= dt;
      if (golden.life <= 0) { golden = null; nextGolden = goldenDelay(); }
    } else if ((nextGolden -= dt) <= 0) spawnGolden();

    for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i].until <= t) buffs.splice(i, 1);
    if (t - lastClickT > (evt().comboWindow || COMBO_WINDOW)) combo = 0;
  }

  function drawSpecials() {
    if (critSpot) {
      const cx = CHEESE_X + critSpot.x, cy = cheeseY + critSpot.y;
      const fade = Math.min(1, critSpot.life * 2, (critSpot.max - critSpot.life) * 4);
      const k = Math.sin(t * 12) > 0 ? 1 : 0;
      ctx.globalAlpha = fade;
      disc(ctx, cx, cy, 4 + k, "rgba(255, 60, 60, 0.35)");
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(cx - 5 - k, cy, 11 + 2 * k, 1);
      ctx.fillRect(cx, cy - 5 - k, 1, 11 + 2 * k);
      ctx.fillStyle = "#ffe066";
      ctx.fillRect(cx - 2, cy, 5, 1);
      ctx.fillRect(cx, cy - 2, 1, 5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx, cy, 1, 1);
      ctx.globalAlpha = 1;
    }
    if (golden) {
      const fade = Math.min(1, golden.life / 2, (golden.max - golden.life) * 2);
      const bob = Math.round(Math.sin(t * 3) * 2);
      const x = Math.round(golden.x), y = Math.round(golden.y) + bob;
      ctx.globalAlpha = fade;
      disc(ctx, x, y, 17, `rgba(255, 215, 60, ${0.2 + 0.15 * Math.sin(t * 6)})`);
      ctx.drawImage(goldenSprite, x - 16, y - 12, 32, 24);
      // twinkles around it
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + i * Math.PI / 2;
        const px = Math.round(x + Math.cos(a) * 19), py = Math.round(y + Math.sin(a) * 15);
        ctx.fillStyle = i % 2 ? "#ffffff" : "#fff3a0";
        ctx.fillRect(px, py, 1, 1);
        if (Math.sin(t * 8 + i) > 0.3) { ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3); }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- events ----------
  const monsters = [];   // blood moon critters
  const lava = [];       // hot cheese chunks from the volcano
  const weather = [];    // rain drops, snow flakes, leaves, embers
  let cloudT = 0;
  let nextMonster = 0, nextLava = 0;

  function startEvent(id) {
    const pool = EVENTS.filter(ev => ev.id !== lastEventId);
    const def = id ? EVENTS.find(ev => ev.id === id) : pool[Math.floor(Math.random() * pool.length)];
    activeEvent = { def, until: t + def.dur };
    lastEventId = def.id;
    // make the event's specials show up right away
    if (def.goldenRate && !golden) nextGolden = Math.min(nextGolden, 2);
    if (def.critRate && !critSpot) nextCritSpot = Math.min(nextCritSpot, 1);
    nextMonster = 1; nextLava = 1;
    flash(def.id === "bloodmoon" || def.id === "volcano" ? "crit" : "gold");
    const r = canvas.getBoundingClientRect();
    floatText(r.left + r.width / 2, r.top + r.height * 0.45, def.name + "!", "event");
  }

  function endEvent() {
    activeEvent = null;
    nextEvent = 100 + Math.random() * 100;
    for (const m of monsters) poof(m.x, m.y - 6, "#9b5de5");
    monsters.length = 0;
  }

  function poof(x, y, col) {
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      particles.push({ kind: "crumb", x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 20, life: 0.5, col: i % 2 ? col : "#ffffff" });
    }
  }

  function updateEvents(dt) {
    if (activeEvent) {
      if (t >= activeEvent.until) endEvent();
    } else if ((nextEvent -= dt) <= 0) startEvent();
    const id = activeEvent ? activeEvent.def.id : "";
    cloudT += dt * (id === "windy" ? 10 : 1);

    // blood moon monsters walk in from the sides
    if (id === "bloodmoon" && (nextMonster -= dt) <= 0 && monsters.length < 6) {
      nextMonster = 2 + Math.random() * 2.5;
      const fromLeft = Math.random() < 0.5;
      monsters.push({ x: fromLeft ? -6 : W + 6, y: FLOOR_TOP + 6 + Math.random() * (FLOOR_BOTTOM - FLOOR_TOP - 6),
        dir: fromLeft ? 1 : -1, phase: Math.random() * 6, life: 14, col: Math.random() < 0.5 ? "#9b5de5" : "#2fbf71" });
    }
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.phase += dt * 8; m.life -= dt;
      const goal = m.dir > 0 ? CHEESE_X - 2 : CHEESE_X + CHEESE_W + 2;
      if ((goal - m.x) * m.dir > 0) m.x += m.dir * 12 * dt;
      if (m.life <= 0) { poof(m.x, m.y - 6, m.col); monsters.splice(i, 1); }
    }

    // volcano throws hot cheese
    if (id === "volcano" && (nextLava -= dt) <= 0) {
      nextLava = 1.2 + Math.random() * 1.3;
      lava.push({ x: 24, y: 68, vx: 25 + Math.random() * 45, vy: -70 - Math.random() * 30, landY: 112 + Math.random() * 55, life: 6, landed: false });
    }
    for (let i = lava.length - 1; i >= 0; i--) {
      const l = lava[i];
      if (!l.landed) {
        l.vy += 90 * dt; l.x += l.vx * dt; l.y += l.vy * dt;
        if (l.vy > 0 && l.y >= l.landY) { l.y = l.landY; l.landed = true; spawnCrumbs(l.x, l.y, 4, 0.6); }
      } else if ((l.life -= dt) <= 0) lava.splice(i, 1);
    }

    // weather particles
    const spawn = (n, mk) => { for (let i = 0; i < n; i++) weather.push(mk()); };
    if (id === "rain" && weather.length < 90) spawn(3, () => ({ k: "rain", x: Math.random() * (W + 30) - 10, y: -4, vx: -15, vy: 160 }));
    if (id === "freeze" && weather.length < 70 && Math.random() < 0.6) spawn(1, () => ({ k: "snow", x: Math.random() * W, y: -2, vx: 0, vy: 14 + Math.random() * 10, ph: Math.random() * 6 }));
    if (id === "windy" && weather.length < 25 && Math.random() < 0.25) spawn(1, () => ({ k: "leaf", x: -4, y: Math.random() * H, vx: 70 + Math.random() * 40, vy: (Math.random() - 0.5) * 20, ph: Math.random() * 6 }));
    if (id === "volcano" && weather.length < 40 && Math.random() < 0.5) spawn(1, () => ({ k: "ember", x: 22 + Math.random() * 6, y: 66, vx: (Math.random() - 0.3) * 20, vy: -30 - Math.random() * 30, life: 1.5 }));
    for (let i = weather.length - 1; i >= 0; i--) {
      const w = weather[i];
      w.x += w.vx * dt; w.y += w.vy * dt;
      if (w.k === "snow") w.x += Math.sin(t * 2 + w.ph) * 6 * dt;
      if (w.k === "leaf") w.y += Math.sin(t * 5 + w.ph) * 15 * dt;
      if (w.k === "ember" && (w.life -= dt) <= 0) { weather.splice(i, 1); continue; }
      const floor = w.k === "rain" ? FLOOR_TOP + ((i * 37) % (FLOOR_BOTTOM - FLOOR_TOP)) : H + 4;
      if (w.y > floor || w.x > W + 8 || w.x < -12) {
        if (w.k === "rain" && Math.random() < 0.4) particles.push({ kind: "crumb", x: w.x, y: w.y, vx: (Math.random() - 0.5) * 20, vy: -20, life: 0.2, col: "#a5d8ff" });
        weather.splice(i, 1);
      }
    }
  }

  const STARS = Array.from({ length: 28 }, () => [Math.floor(rnd() * W), Math.floor(rnd() * (GROUND_Y - 20))]);
  const SUN_X = 132, SUN_Y = 20;

  // sky effects drawn right after the background
  function drawSky() {
    const id = activeEvent ? activeEvent.def.id : "";
    const k = activeEvent ? Math.min(1, (t - (activeEvent.until - activeEvent.def.dur)) / 2, (activeEvent.until - t) / 2) : 0;
    if (!id || k <= 0) return;
    ctx.globalAlpha = k;
    if (id === "eclipse" || id === "bloodmoon") {
      ctx.fillStyle = id === "eclipse" ? "rgba(12, 10, 40, 0.75)" : "rgba(60, 0, 12, 0.75)";
      ctx.fillRect(0, 0, W, GROUND_Y);
      ctx.fillStyle = id === "eclipse" ? "rgba(12, 10, 40, 0.45)" : "rgba(40, 0, 0, 0.45)";
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
      ctx.fillStyle = "#ffffff";
      for (const [x, y] of STARS) if (Math.sin(t * 3 + x) > -0.6) ctx.fillRect(x, y, 1, 1);
      if (id === "eclipse") {
        disc(ctx, SUN_X, SUN_Y, 12, "rgba(255, 243, 160, 0.35)");
        disc(ctx, SUN_X, SUN_Y, 10, "#fff3a0");
        disc(ctx, SUN_X - 1, SUN_Y, 9, "#14102e");
      } else {
        disc(ctx, SUN_X, SUN_Y, 13, "rgba(255, 40, 40, 0.25)");
        disc(ctx, SUN_X, SUN_Y, 10, "#c92a2a");
        disc(ctx, SUN_X + 3, SUN_Y - 3, 2, "#a51d1d");
        disc(ctx, SUN_X - 4, SUN_Y + 3, 3, "#a51d1d");
        ctx.fillStyle = "#ff6b6b"; ctx.fillRect(SUN_X - 6, SUN_Y - 6, 3, 2);
      }
    } else if (id === "rain") {
      ctx.fillStyle = "rgba(50, 60, 85, 0.45)";
      ctx.fillRect(0, 0, W, H);
    } else if (id === "freeze") {
      ctx.fillStyle = "rgba(200, 230, 255, 0.35)";
      ctx.fillRect(0, 0, W, H);
    } else if (id === "flare") {
      ctx.fillStyle = "rgba(255, 140, 0, 0.18)";
      ctx.fillRect(0, 0, W, H);
      const r = 14 + Math.round(Math.sin(t * 6) * 2);
      disc(ctx, SUN_X, SUN_Y, r + 6, "rgba(255, 120, 0, 0.3)");
      for (let i = 0; i < 8; i++) {
        const a = t * 0.8 + i * Math.PI / 4, len = r + 6 + ((i % 2) ? 4 : 0) + Math.round(Math.sin(t * 9 + i) * 3);
        for (let d = r; d < len; d++) { ctx.fillStyle = d % 2 ? "#ff922b" : "#ffd43b"; ctx.fillRect(Math.round(SUN_X + Math.cos(a) * d), Math.round(SUN_Y + Math.sin(a) * d), 2, 2); }
      }
      disc(ctx, SUN_X, SUN_Y, r, "#ffd43b");
      disc(ctx, SUN_X, SUN_Y, r - 3, "#fff3a0");
    } else if (id === "volcano") {
      ctx.fillStyle = "rgba(255, 70, 0, 0.18)";
      ctx.fillRect(0, 0, W, GROUND_Y);
      const fl = Math.sin(t * 10) > 0;
      ctx.fillStyle = fl ? "#ff6b00" : "#ffa94d";
      ctx.fillRect(20, 66, 9, 2);
      ctx.fillStyle = "#ff3d00";
      ctx.fillRect(19, 68, 2, 6); ctx.fillRect(28, 68, 2, 9); ctx.fillRect(17, 74, 2, 6);
      disc(ctx, 24, 64, 5, "rgba(255, 120, 0, 0.35)");
    }
    ctx.globalAlpha = 1;
  }

  function drawMonster(m) {
    const x = Math.round(m.x), b = Math.round(Math.abs(Math.sin(m.phase)) * 3), y = Math.round(m.y) - b;
    disc(ctx, x, y - 5, 6, OUTLINE);
    disc(ctx, x, y - 5, 5, m.col);
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 4, y - 12, 1, 2); ctx.fillRect(x + 3, y - 12, 1, 2);   // horns
    ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 3, y - 7, 2, 2); ctx.fillRect(x + 1, y - 7, 2, 2);  // eyes
    ctx.fillStyle = "#000000"; ctx.fillRect(x - 3 + (m.dir > 0 ? 1 : 0), y - 6, 1, 1); ctx.fillRect(x + 1 + (m.dir > 0 ? 1 : 0), y - 6, 1, 1);
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 2, y - 3, 4, 1);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(x + 1, y - 3, 1, 1);                                     // tiny fang
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x - 4, Math.round(m.y), 9, 1);                  // shadow
  }

  function drawLava() {
    for (const l of lava) {
      const x = Math.round(l.x), y = Math.round(l.y);
      const blink = l.landed && l.life < 1.5 && Math.sin(t * 20) > 0;
      if (blink) continue;
      disc(ctx, x, y, 5, "rgba(255, 90, 0, 0.35)");
      ctx.fillStyle = OUTLINE; ctx.fillRect(x - 4, y - 3, 8, 6);
      ctx.fillStyle = "#ff922b"; ctx.fillRect(x - 3, y - 2, 6, 4);
      ctx.fillStyle = "#ffd43b"; ctx.fillRect(x - 3, y - 2, 6, 1);
      ctx.fillStyle = "#e8590c"; ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x - 2, y + 1, 1, 1);
      if (!l.landed) { ctx.fillStyle = "#ff6b00"; ctx.fillRect(x - Math.sign(l.vx) * 5, y - 1, 2, 2); }
    }
  }

  function drawWeather() {
    for (const w of weather) {
      const x = Math.round(w.x), y = Math.round(w.y);
      if (w.k === "rain") { ctx.fillStyle = "#a5d8ff"; ctx.fillRect(x, y, 1, 3); }
      else if (w.k === "snow") { ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, 1, 1); if ((x + y) % 3 === 0) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); } }
      else if (w.k === "leaf") { ctx.fillStyle = Math.sin(t * 8 + w.ph) > 0 ? "#40c057" : "#f59f00"; ctx.fillRect(x, y, 2, 1); ctx.fillRect(x + 1, y + 1, 1, 1); }
      else if (w.k === "ember") { ctx.fillStyle = w.life > 0.7 ? "#ffd43b" : "#ff6b00"; ctx.fillRect(x, y, 1, 1); }
    }
  }

  // ---------- input ----------
  function toScene(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
  }

  // combo state (not saved)
  let combo = 0, lastClickT = -10, comboShownT = -10;
  const comboMax = () => has("tail") ? 5 : 3;
  const comboMult = () => Math.min(comboMax(), 1 + Math.floor(combo / 10) * 0.25);

  function earn(n) { state.coins += n; state.total += n; }

  canvas.addEventListener("pointerdown", e => {
    const [sx, sy] = toScene(e);

    // 1. golden cheese
    if (golden && Math.hypot(sx - golden.x, sy - golden.y) < 18) {
      e.preventDefault();
      clickGolden(e);
      return;
    }

    // 2. blood moon monsters
    const mon = monsters.find(m => Math.hypot(sx - m.x, sy - (m.y - 6)) < 10);
    if (mon) {
      e.preventDefault();
      monsters.splice(monsters.indexOf(mon), 1);
      poof(mon.x, mon.y - 6, "#9b5de5");
      const old = buffs.find(b => b.id === "double");
      if (old) { old.until = Math.min(t + 60, Math.max(old.until, t) + DOUBLE_SECS); old.secs = old.until - t; }
      else buffs.push({ id: "double", name: "DOUBLE CHEESE", label: "x2 all", secs: DOUBLE_SECS, until: t + DOUBLE_SECS, cpsMult: 2, clickMult: 2 });
      floatText(e.clientX, e.clientY, "DOUBLE CHEESE! 20s", "monster");
      updateUI();
      return;
    }

    // 3. hot cheese from the volcano
    const hot = lava.find(l => Math.hypot(sx - l.x, sy - l.y) < 10);
    if (hot) {
      e.preventDefault();
      lava.splice(lava.indexOf(hot), 1);
      const gain = Math.max(clickPower() * 15, cps() * 20);
      earn(gain);
      spawnCrumbs(hot.x, hot.y, 8, 1.2);
      floatText(e.clientX, e.clientY, "HOT CHEESE +" + fmt(gain), "hot");
      updateUI();
      return;
    }

    // 4. the cheese itself
    const onSpot = critSpot && Math.hypot(sx - (CHEESE_X + critSpot.x), sy - (cheeseY + critSpot.y)) < 8;
    if (!onSpot && cheeseAlphaAt(sx - CHEESE_X, sy - cheeseY) === 0) return;
    e.preventDefault();

    combo = (t - lastClickT <= (evt().comboWindow || COMBO_WINDOW)) ? combo + (evt().comboStep || 1) : 1;
    lastClickT = t;

    let gain = clickPower() * comboMult();
    let kind = "", label = "";
    if (onSpot) {
      const m = CRIT_SPOT_MULT * (has("claws") ? 2 : 1);
      gain *= m; kind = "crit big"; label = `CRIT x${m}! `;
      critSpot = null;
      nextCritSpot = critSpotDelay();
      flash("crit");
      spawnCrumbs(sx, sy, 16, 1.6);
    } else if (Math.random() < LUCKY_CRIT_CHANCE) {
      const m = LUCKY_CRIT_MULT * (has("claws") ? 2 : 1);
      gain *= m; kind = "crit"; label = `crit x${m} `;
      spawnCrumbs(sx, sy, 9, 1.2);
    } else {
      spawnCrumbs(sx, sy, 5);
    }
    earn(gain);
    squash = 1;
    floatText(e.clientX, e.clientY, label + "+" + fmt(gain, true), kind);
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
    const x = { worm: 25, bunny: 21, cow: 27, pig: 24, bird: 22 }[h.kind] || 22;
    DRAW[h.kind](ictx, h, x, 21, 1, iconState);
    const it = makeItem(icon, () => (sellMode ? sellHelper(h) : buyHelper(h)));
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

  // sell: refund half of what the last one cost
  let sellMode = false;
  const refundOf = h => state.owned[h.id] > 0
    ? Math.floor(Math.ceil(h.cost * Math.pow(COST_GROWTH, state.owned[h.id] - 1)) / 2) : 0;

  function sellHelper(h) {
    if (state.owned[h.id] < 1) return;
    const r = refundOf(h);
    state.owned[h.id]--;
    state.coins += r;           // refund only, so it does not count toward "total made"
    // remove a sprite if there are now more on screen than owned
    const mine = critters.filter(c => c.h === h);
    if (mine.length > state.owned[h.id]) {
      const c = mine[mine.length - 1];
      poof(c.x, c.y - 6, "#ffd43b");
      critters.splice(critters.indexOf(c), 1);
    }
    updateUI();
    save();
  }

  const modeBuy = document.getElementById("modeBuy"), modeSell = document.getElementById("modeSell");
  function setSellMode(on) {
    sellMode = on;
    modeBuy.classList.toggle("on", !on); modeSell.classList.toggle("on", on);
    modeBuy.setAttribute("aria-pressed", String(!on)); modeSell.setAttribute("aria-pressed", String(on));
    shopEl.classList.toggle("selling", on);
    updateUI();
  }
  modeBuy.addEventListener("click", () => setSellMode(false));
  modeSell.addEventListener("click", () => setSellMode(true));

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

  const comboEl = document.getElementById("combo");
  const crownLine = document.getElementById("crownLine");
  const prestigeSection = document.getElementById("prestigeSection");
  const prestigeInfo = document.getElementById("prestigeInfo");
  const buffsEl = document.getElementById("buffs");
  let buffsKey = "";

  function updateUI() {
    // combo meter
    if (combo >= 5) {
      comboEl.hidden = false;
      comboEl.textContent = `COMBO ${combo} · x${comboMult().toFixed(2)}`;
      comboEl.classList.toggle("hot", comboMult() >= comboMax());
    } else comboEl.hidden = true;
    // active golden buffs
    const chips = buffs.slice();
    if (activeEvent) chips.unshift({ id: "evt", event: true, name: activeEvent.def.name, label: activeEvent.def.label, until: activeEvent.until, secs: activeEvent.def.dur });
    const key = chips.map(b => b.id + Math.ceil(b.until - t)).join();
    if (key !== buffsKey) {
      buffsKey = key;
      buffsEl.replaceChildren(...chips.map(b => {
        const d = document.createElement("div");
        d.className = "buff" + (b.event ? " event" : "") + (b.id === "double" ? " double" : "");
        d.textContent = `${b.name} ${b.label} · ${Math.ceil(b.until - t)}s`;
        const bar = document.createElement("i");
        bar.style.width = (100 * (b.until - t) / b.secs) + "%";
        d.appendChild(bar);
        return d;
      }));
    }

    coinsEl.textContent = fmt(state.coins);
    cpsEl.textContent = fmt(cps(), true);
    perClickEl.textContent = fmt(clickPower(), true);
    crownLine.hidden = state.crowns === 0;
    crownLine.textContent = `crowns: ${state.crowns} (+${Math.round(state.crowns * CROWN_BONUS * 100)}% coins)`;
    const pGain = crownsFor(state.total);
    prestigeSection.hidden = !(state.crowns > 0 || state.total >= PRESTIGE_BASE * 0.3);
    prestigeBtn.disabled = pGain < 1;
    const nextAt = PRESTIGE_BASE * Math.pow(pGain + 1, 3);
    prestigeInfo.textContent = pGain < 1
      ? `make ${fmt(PRESTIGE_BASE)} coins this run to earn your first crown (${fmt(state.total)} so far).`
      : `reset coins, helpers and upgrades. keep crowns. next crown at ${fmt(nextAt)} made.`;
    prestigeBtn.querySelector(".name").textContent = prestigeBtn.dataset.armed ? "SURE? CLICK AGAIN" : `PRESTIGE: +${pGain} crowns`;
    prestigeBtn.querySelector(".desc").textContent = `each crown = +${CROWN_BONUS * 100}% coins forever`;
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
      btn.disabled = sellMode ? state.owned[h.id] < 1 : (!unlocked || !afford);
      btn.classList.toggle("affordable", !sellMode && unlocked && afford);
      it.name.textContent = unlocked ? h.name : "???";
      it.desc.textContent = unlocked ? `${h.desc} +${fmt(h.cps, true)}/s each` : "keep clicking...";
      it.cost.textContent = sellMode ? (state.owned[h.id] ? "sell for 🧀 " + fmt(refundOf(h)) : "none to sell") : "🧀 " + fmt(c);
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

  const resetBtn = document.getElementById("reset");
  let resetArmed = null;
  resetBtn.addEventListener("click", () => {
    // first click asks, second click (within 3s) resets
    if (!resetArmed) {
      resetBtn.textContent = "sure? click again";
      resetArmed = setTimeout(() => { resetArmed = null; resetBtn.textContent = "reset"; }, 3000);
      return;
    }
    clearTimeout(resetArmed); resetArmed = null;
    resetBtn.textContent = "reset";
    state.crowns = 0;
    wipeRun();
  });

  function wipeRun() {
    state.coins = 0; state.total = 0; state.upgrades = [];
    HELPERS.forEach(h => (state.owned[h.id] = 0));
    critters.length = 0;
    buffs.length = 0;
    save();
    updateUI();
  }

  // prestige: trade this run for crowns (+10% coins each, forever)
  const prestigeBtn = document.getElementById("prestigeBtn");
  let prestigeArmed = null;
  prestigeBtn.addEventListener("click", () => {
    const gain = crownsFor(state.total);
    if (gain < 1) return;
    if (!prestigeArmed) {
      prestigeBtn.dataset.armed = "1";
      prestigeArmed = setTimeout(() => { prestigeArmed = null; delete prestigeBtn.dataset.armed; updateUI(); }, 3000);
      updateUI();
      return;
    }
    clearTimeout(prestigeArmed); prestigeArmed = null; delete prestigeBtn.dataset.armed;
    state.crowns += gain;
    flash("gold");
    const r = canvas.getBoundingClientRect();
    floatText(r.left + r.width / 2, r.top + r.height * 0.4, `+${gain} CROWNS!`, "event");
    wipeRun();
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
        if (kind === "bird") { c.step = Math.sin(c.phase * 3) > 0; c.lift = Math.min(30, dist * 0.8) + (c.step ? 1 : 0); }
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
    updateSpecials(dt);
    updateEvents(dt);

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

  const cheeseImg = () => (activeEvent && activeEvent.def.id === "freeze") ? frozenCheese : cheese.canvas;

  function draw() {
    ctx.drawImage(background, 0, 0);
    drawSky();


    for (const c of clouds) {
      const x = ((c.x + cloudT * c.v) % (W + 40)) - 30;
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
      ctx.drawImage(cheeseImg(), Math.round(80 - w / 2), cheeseY + (CHEESE_H - h), w, h);
    } else {
      ctx.drawImage(cheeseImg(), CHEESE_X, cheeseY);
    }

    for (const c of critters) if (c.y >= CHEESE_BASE) drawCritter(c);
    for (const m of monsters) drawMonster(m);
    drawLava();

    drawSpecials();
    drawWeather();

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

  if (location.hash === "#dev") {
    window.cheeseDev = { startEvent, spawnGolden, give: n => earn(n), state, monsters, lava };
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
