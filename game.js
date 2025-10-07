// Smashlike — FS + extended animation rows (runtime sprites)
const $=(q)=>document.querySelector(q); const $$=(q)=>[...document.querySelectorAll(q)];
const Screens={ show(id){ const tgt = document.querySelector(id); if(!tgt){ console.warn('Screens.show target missing:', id); return; } document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); tgt.classList.remove('hidden'); }};

// === ONLINE (client) ===
const Online = {
  active: false,
  socket: null,
  code: null,
  role: null, // 'p1' | 'p2'
  connected: false,
  peerControls: {left:false,right:false,attack:false,special:false,jump:false,fastfall:false,shield:false,pick:false,use:false,fs:false},
  sendTimer: 0,
};

function onlineStatus(msg){ const el = document.getElementById('onlineStatus'); if (el) el.textContent = msg; }
function setOnlineGoSelect(enabled){ const b = document.getElementById('onlineGoSelect'); if (b){ b.disabled = !enabled; } }

function ensureSocket(){
  if (Online.socket) return Online.socket;
  try{
    // eslint-disable-next-line no-undef
    const s = io();
    Online.socket = s;
    s.on('connect', ()=>{ Online.connected = true; onlineStatus('Connected. Create a room, join one, or find a random match.'); });
    s.on('disconnect', ()=>{ Online.connected = false; onlineStatus('Disconnected.'); });

    s.on('errorMsg', (e)=>{ onlineStatus(e && e.message ? e.message : 'Server error'); });

    s.on('roomCreated', ({ code, role })=>{
      Online.code = code; Online.role = role; Online.active = true;
      onlineStatus(`Room created. Code: ${code} — You are ${role.toUpperCase()}. Share the code and then go to Character Select.`);
      setOnlineGoSelect(true);
    });
    s.on('roomJoined', ({ code, role })=>{
      Online.code = code; Online.role = role; Online.active = true;
      onlineStatus(`Joined room ${code}. You are ${role.toUpperCase()}. Go to Character Select.`);
      setOnlineGoSelect(true);
    });
    s.on('playerJoined', ()=>{ onlineStatus(`Peer joined. Room ${Online.code}.`); });
    s.on('queued', ()=>{ onlineStatus('Queued for random match…'); });
    s.on('matched', ({ code, role })=>{
      Online.code = code; Online.role = role; Online.active = true;
      onlineStatus(`Matched! Room ${code}. You are ${role.toUpperCase()}. Go to Character Select.`);
      setOnlineGoSelect(true);
    });
    s.on('peerReady', ({ role })=>{
      onlineStatus(`Peer (${role.toUpperCase()}) is ready… waiting for you.`);
    });

    // Server starts the match when both sent ready
    // payload: { code, p1:{id,alt}, p2:{id,alt}, rules, stageId }
    s.on('start', async ({ p1: P1, p2: P2, rules, stageId })=>{
      try{
        // Assign App selections from server canonical data
        const cById = (id)=> CHARACTERS.find(c=>c.id===id) || CHARACTERS[0];
        App.rules = Object.assign({}, App.rules, rules||{});
        App.p1.char = cById(P1 && P1.id || 'bruiser'); App.p1.alt = Math.max(0, P1 && P1.alt || 0);
        App.p2.char = cById(P2 && P2.id || 'ninja');   App.p2.alt = Math.max(0, P2 && P2.alt || 0);
        App.stage = STAGES.find(s=>s.id===stageId) || STAGES[0];
        // Ensure P2 is human in online
        try{ const p2CpuEl = document.getElementById('p2Cpu'); if (p2CpuEl) p2CpuEl.checked = false; }catch{}
        await startBattle();
      }catch(e){ console.error('Failed to start match from server', e); }
    });

document.addEventListener('DOMContentLoaded', () => {
  $$('.mode-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const m = btn.getAttribute('data-mode')||'stock';
      App.mode = m;
      const labels = { stock:'Stock', training:'Training', timed:'Timed', hyper:'Hyper' };
      const badge = document.getElementById('modeBadge'); if (badge) badge.textContent = labels[m]||m;
      buildCharacterSelect();
      Screens.show('#chars');
    });
  });
});

    // Input relay from peer
    s.on('peerInput', ({ controls })=>{
      Object.assign(Online.peerControls, controls||{});
    });

    s.on('peerLeft', ()=>{
      onlineStatus('Peer left the room.');
    });

  }catch(e){ console.error('Socket.io unavailable', e); }
  return Online.socket;
}

const App = {
  mode: 'stock',
  rules: { 
    stocks: 3,
    time: 0,
    ratio: 1.0,
    itemsOn: true,
    itemFreq: 8,
    cpuLevel: 1,
    shake: true,
    sparks: true,
    // new rules
    tagTeam: false,
    teamSize: 2,
    powerUpsOn: true,
    powerUpFreq: 10,
    hitboxViewer: false,
  },
  p1: { char:null, alt:0 },
  p2: { char:null, alt:0 },
  stage: null,
  track: null,
};

const CHARACTERS = [
  { id:'bruiser', name:'Bruiser', kit:'heavy', stats:{weight:1.1, speed:1.0},
    alts:[
      {name:'Default', colors:{body:'#7dd3fc', outline:'#0ea5e9', accent:'#e5fbff'}},
      {name:'Crimson', colors:{body:'#fecaca', outline:'#dc2626', accent:'#ffe0e0'}},
      {name:'Neon', colors:{body:'#a7f3d0', outline:'#10b981', accent:'#d7ffe8'}},
      {name:'Midnight', colors:{body:'#c7d2fe', outline:'#4f46e5', accent:'#e4e9ff'}},
    ]
  },
  { id:'ninja', name:'Ninja', kit:'fast', stats:{weight:0.9, speed:1.3},
    alts:[
      {name:'Default', colors:{body:'#fde68a', outline:'#f59e0b', accent:'#fff4c1'}},
      {name:'Rose', colors:{body:'#fbcfe8', outline:'#db2777', accent:'#ffd5eb'}},
      {name:'Mint', colors:{body:'#bbf7d0', outline:'#22c55e', accent:'#e3ffe9'}},
      {name:'Ink', colors:{body:'#e9d5ff', outline:'#7c3aed', accent:'#f3e9ff'}},
    ]
  },
  { id:'gunner', name:'Gunner', kit:'ranged', stats:{weight:1.0, speed:1.05},
    alts:[
      {name:'Default', colors:{body:'#d1fae5', outline:'#10b981', accent:'#f3fffb'}},
      {name:'Volt', colors:{body:'#fef3c7', outline:'#d97706', accent:'#fff6d8'}},
      {name:'Void', colors:{body:'#e2e8f0', outline:'#0ea5e9', accent:'#f7fbff'}},
    ]
  },
  { id:'mage', name:'Mage', kit:'zoner', stats:{weight:0.95, speed:0.95},
    alts:[
      {name:'Default', colors:{body:'#e9d5ff', outline:'#7c3aed', accent:'#f7ecff'}},
      {name:'Flare', colors:{body:'#fee2e2', outline:'#ef4444', accent:'#fff1f1'}},
      {name:'Ocean', colors:{body:'#bfdbfe', outline:'#2563eb', accent:'#e9f3ff'}},
    ]
  },
];

const STAGES = [
  { id:'trainingRoom', name:'Training Room', bg:'#0b1020', bounds:{w:2000,h:1400}, platforms:[
    {x:0,y:520,w:1100,h:20,ground:true}, {x:320,y:380,w:180,h:16}, {x:610,y:340,w:180,h:16}, {x:460,y:270,w:180,h:16},
  ]},
  { id:'tripoint', name:'Tripoint Plaza', bg:'#101820', dynamic:{type:'dayNight'}, bounds:{w:2200,h:1400}, platforms:[
    {x:0,y:540,w:1100,h:20,ground:true}, {x:410,y:420,w:280,h:16},
  ]},
  { id:'wide', name:'Big Field', bg:'#0f0f16', dynamic:{type:'dayNight'}, bounds:{w:2600,h:1600}, platforms:[
    {x:0,y:560,w:1100,h:20,ground:true}
  ],
  },
  // -------- SONIC --------
  { id:'greenHill', name:'Green Hill Zone', bg:'#185a2a', dynamic:{type:'dayNight'}, bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:390,y:420,w:280,h:16}, {x:760,y:360,w:220,h:16} ] },
  { id:'labyrinth', name:'Labyrinth Zone', bg:'#0a2a44', bounds:{w:2200,h:1500},
    platforms:[ {x:0,y:520,w:1100,h:20,ground:true}, {x:280,y:410,w:220,h:16}, {x:620,y:460,w:260,h:16} ] },
  { id:'scrapBrain', name:'Scrap Brain Zone', bg:'#1b1b23', bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:340,y:420,w:240,h:16}, {x:600,y:340,w:240,h:16} ] },
  { id:'collisionChaos', name:'Collision Chaos', bg:'#2b0b3a', dynamic:{type:'dayNight'}, bounds:{w:2200,h:1500},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:280,y:380,w:200,h:16}, {x:700,y:380,w:200,h:16} ] },
  { id:'stardustSpeedway', name:'Stardust Speedway', bg:'#10152e', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:430,y:420,w:280,h:16} ] },
  { id:'metallicMadness', name:'Metallic Madness', bg:'#231936', bounds:{w:2300,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:300,y:440,w:220,h:16}, {x:660,y:360,w:220,h:16} ] },
  { id:'chemicalPlant', name:'Chemical Plant Zone', bg:'#0f214a', bounds:{w:2300,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:300,y:480,w:260,h:16}, {x:680,y:420,w:240,h:16} ] },
  { id:'aquaticRuin', name:'Aquatic Ruin Zone', bg:'#0b2e24', dynamic:{type:'dayNight'}, bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:360,y:420,w:220,h:16}, {x:720,y:420,w:220,h:16} ] },
  { id:'casinoNight', name:'Casino Night Zone', bg:'#14122a', bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:520,w:1100,h:20,ground:true}, {x:300,y:400,w:260,h:16}, {x:680,y:400,w:260,h:16} ] },
  { id:'oilOcean', name:'Oil Ocean Zone', bg:'#371f0b', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:420,y:440,w:300,h:16} ] },
  { id:'metropolis', name:'Metropolis Zone', bg:'#1b1c1f', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:320,y:440,w:240,h:16}, {x:700,y:360,w:240,h:16} ] },
  { id:'wingFortress', name:'Wing Fortress Zone', bg:'#0f172a', dynamic:{type:'dayNight'}, bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:480,y:420,w:180,h:16}, {x:760,y:380,w:160,h:16} ] },
  { id:'angelIsland', name:'Angel Island', bg:'#0d3a2a', dynamic:{type:'dayNight'}, bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:380,y:420,w:220,h:16}, {x:680,y:360,w:200,h:16} ] },
  { id:'hydrocity', name:'Hydrocity', bg:'#063a52', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:300,y:460,w:280,h:16}, {x:700,y:400,w:240,h:16} ] },
  { id:'mushroomHill', name:'Mushroom Hill', bg:'#224118', dynamic:{type:'dayNight'}, bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:320,y:400,w:220,h:16}, {x:740,y:400,w:220,h:16} ] },
  { id:'flyingBattery', name:'Flying Battery', bg:'#1d2333', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:360,y:440,w:240,h:16}, {x:720,y:360,w:220,h:16} ] },
  { id:'lavaReef', name:'Lava Reef', bg:'#3a0f0f', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:420,y:440,w:260,h:16} ] },
  { id:'skySanctuary', name:'Sky Sanctuary', bg:'#87b5ff', dynamic:{type:'dayNight'}, bounds:{w:2400,h:1600},
    platforms:[ {x:100,y:560,w:900,h:20,ground:true}, {x:360,y:420,w:240,h:16}, {x:720,y:380,w:200,h:16} ] },
  { id:'emeraldCoast', name:'Emerald Coast', bg:'#0f3340', dynamic:{type:'dayNight'}, bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:320,y:420,w:260,h:16} ] },
  { id:'speedHighway', name:'Speed Highway', bg:'#0b1020', bounds:{w:2500,h:1600},
    platforms:[ {x:0,y:560,w:1200,h:20,ground:true}, {x:520,y:420,w:260,h:16} ] },
  { id:'radicalHighway', name:'Radical Highway', bg:'#0a0f1c', bounds:{w:2500,h:1600},
    platforms:[ {x:0,y:560,w:1200,h:20,ground:true}, {x:340,y:440,w:220,h:16}, {x:800,y:380,w:220,h:16} ] },
  { id:'cityEscape', name:'City Escape', bg:'#1a2a39', bounds:{w:2500,h:1600},
    platforms:[ {x:0,y:560,w:1200,h:20,ground:true}, {x:480,y:420,w:260,h:16} ] },
  { id:'finalRush', name:'Final Rush / Final Chase', bg:'#101820', bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:560,w:1250,h:20,ground:true}, {x:420,y:440,w:260,h:16}, {x:860,y:360,w:220,h:16} ] },
  { id:'seasideHill', name:'Seaside Hill', bg:'#1a3d4a', dynamic:{type:'dayNight'}, bounds:{w:2500,h:1600},
    platforms:[ {x:0,y:540,w:1200,h:20,ground:true}, {x:360,y:420,w:240,h:16} ] },
  { id:'railCanyon', name:'Rail Canyon', bg:'#3a2410', bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:560,w:1250,h:20,ground:true}, {x:520,y:420,w:260,h:16} ] },
  { id:'westopolis', name:'Westopolis', bg:'#1c1c1c', bounds:{w:2500,h:1600},
    platforms:[ {x:0,y:560,w:1200,h:20,ground:true}, {x:340,y:440,w:240,h:16}, {x:820,y:380,w:200,h:16} ] },
  { id:'waterPalace', name:'Water Palace', bg:'#0d2b4d', bounds:{w:2500,h:1600},
    platforms:[ {x:0,y:560,w:1200,h:20,ground:true}, {x:420,y:460,w:280,h:16}, {x:840,y:400,w:220,h:16} ] },
  { id:'crisisCity', name:'Crisis City', bg:'#3b1a14', bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:560,w:1250,h:20,ground:true}, {x:440,y:420,w:260,h:16}, {x:900,y:360,w:220,h:16} ] },
  { id:'kingdomValley', name:'Kingdom Valley', bg:'#16202a', bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:560,w:1250,h:20,ground:true}, {x:520,y:440,w:260,h:16} ] },
  { id:'rooftopRun', name:'Rooftop Run', bg:'#22324a', dynamic:{type:'dayNight'}, bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:540,w:1250,h:20,ground:true}, {x:500,y:420,w:260,h:16} ] },
  { id:'tropicalResort', name:'Tropical Resort', bg:'#0b2130', dynamic:{type:'dayNight'}, bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:540,w:1250,h:20,ground:true}, {x:380,y:420,w:240,h:16}, {x:860,y:380,w:220,h:16} ] },
  { id:'planetWisp', name:'Planet Wisp', bg:'#162a1f', dynamic:{type:'dayNight'}, bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:560,w:1250,h:20,ground:true}, {x:480,y:440,w:280,h:16} ] },
  { id:'sunsetHeights', name:'Sunset Heights', bg:'#432614', dynamic:{type:'dayNight'}, bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:540,w:1250,h:20,ground:true}, {x:520,y:420,w:260,h:16} ] },
  { id:'chaosIsland', name:'Chaos Island', bg:'#0e1620', bounds:{w:2600,h:1700},
    platforms:[ {x:0,y:560,w:1250,h:20,ground:true}, {x:420,y:440,w:240,h:16}, {x:900,y:360,w:220,h:16} ] },

  // -------- UNDERTALE (2015) --------
  { id:'ruins', name:'Ruins', bg:'#3b1f36', bounds:{w:2200,h:1500},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:380,y:420,w:240,h:16} ] },
  { id:'snowdin', name:'Snowdin', bg:'#0f2a3a', dynamic:{type:'dayNight'}, bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:320,y:420,w:240,h:16}, {x:720,y:380,w:200,h:16} ] },
  { id:'waterfall', name:'Waterfall', bg:'#071e36', bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:420,y:440,w:260,h:16} ] },
  { id:'hotland', name:'Hotland', bg:'#3a1b08', bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:340,y:420,w:240,h:16}, {x:720,y:360,w:200,h:16} ] },

  // -------- DELTARUNE (2019–2025+) --------
  { id:'castleTown', name:'Castle Town', bg:'#14172e', bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:540,w:1100,h:20,ground:true}, {x:420,y:420,w:240,h:16} ] },
  { id:'cardKingdom', name:'Card Kingdom', bg:'#2c1538', bounds:{w:2300,h:1500},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:360,y:440,w:240,h:16}, {x:740,y:380,w:200,h:16} ] },
  { id:'cyberCity', name:'Cyber City', bg:'#061c2f', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:480,y:420,w:260,h:16} ] },
  { id:'tvWorld', name:'TV World', bg:'#121212', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:360,y:440,w:240,h:16}, {x:720,y:360,w:220,h:16} ] },
  { id:'churchDark', name:'Church Dark-World', bg:'#1b2031', bounds:{w:2400,h:1600},
    platforms:[ {x:0,y:560,w:1100,h:20,ground:true}, {x:380,y:420,w:240,h:16} ] },
];

const MUSIC = [
  { id:'anthem', name:'Prototype Anthem', generator:(ctx)=> melody(ctx,[0,4,7,12],[.5,.5,.5,1]) },
  { id:'drive', name:'Hyper Drive', generator:(ctx)=> bassRun(ctx,[0,3,5,7]) },
  { id:'zen', name:'Zen Garden', generator:(ctx)=> plucks(ctx,[0,2,7,9]) },
];

const canvas = document.getElementById('game');
const ctx = canvas ? canvas.getContext('2d') : null;
if (ctx) ctx.imageSmoothingEnabled = false;

// Global switch: use portrait-derived fallback sheets when no real sheet exists
const USE_PORTRAIT_FALLBACK = false;
// Force procedural tiny character sprites (ignore portrait + external sheets)
const FORCE_PROCEDURAL = true;

// Portrait mapping loaded from assets/portraits.json
let PORTRAITS = {};
async function ensurePortraitsLoaded(){
  if (ensurePortraitsLoaded._done) return;
  try{
    const res = await fetch('assets/portraits.json', { cache: 'no-store' });
    if (res.ok){ PORTRAITS = await res.json(); }
  }catch(e){ /* ignore; will fallback to color tiles */ }
  ensurePortraitsLoaded._done = true;
}

// External sprite index loaded from assets/sprites/index.json
let SPRITE_INDEX = {};
async function ensureSpritesIndexLoaded(){
  if (ensureSpritesIndexLoaded._done) return;
  try{
    const res = await fetch('assets/sprites/index.json', { cache: 'no-store' });
    if (res.ok){ SPRITE_INDEX = await res.json(); }
  }catch(e){ /* ignore; use procedural */ }
  ensureSpritesIndexLoaded._done = true;
}
function loadImage(src){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=src; }); }

// Build an animated sheet from a single portrait by applying subtle transforms per frame
function makeSheetFromPortrait(img){
  const rows=ANIMS.length; const framesPerRow=Math.max(...ANIMS.map(a=>a[1]));
  const fw=48, fh=48; // logical source frame size
  const sheet=document.createElement('canvas'); sheet.width=framesPerRow*fw; sheet.height=rows*fh; const g=sheet.getContext('2d'); g.imageSmoothingEnabled=false;
  const meta={ frameSize:[fw,fh], anims:{} };
  const scale = Math.min(fw*0.9/img.width, fh*0.9/img.height);
  const drawFrame=(r,i,animName,frames)=>{
    const t=i/frames; const cx=i*fw+fw/2, cy=r*fh+fh/2; g.save(); g.translate(cx,cy);
    let offx=0, offy=0, rot=0, sx=scale, sy=scale;
    switch(animName){
      case 'idle': offy = Math.sin(t*2*Math.PI)*2; break;
      case 'walk': offx = Math.sin(t*2*Math.PI)*2; offy = Math.cos(t*2*Math.PI)*1; break;
      case 'run': offx = Math.sin(t*4*Math.PI)*3; rot = Math.sin(t*2*Math.PI)*0.05; break;
      case 'jump': offy = -6*Math.sin(Math.min(1,t)*Math.PI); break;
      case 'aerial': rot = Math.sin(t*2*Math.PI)*0.06; break;
      case 'attack': offx = (i<frames*0.5? 4: -2); rot = (i<frames*0.5? 0.08: -0.04); break;
      case 'special': offx = (Math.sin(t*2*Math.PI)>0? 3:-3); break;
      case 'hitstun': offx = (i%2?1:-1)*2; offy=(i%2?-1:1)*2; break;
      case 'ko': rot = t*0.6; offy = Math.min(12, t*24); break;
      case 'fs': sx=sy=scale*1.05; offx = Math.sin(t*2*Math.PI)*2; offy = Math.cos(t*2*Math.PI)*2; break;
    }
    g.rotate(rot); g.drawImage(img, -img.width*scale/2+offx, -img.height*scale/2+offy, img.width*scale, img.height*scale); g.restore();
  };
  ANIMS.forEach(([name,frames,fps],r)=>{ meta.anims[name]={row:r,frames,fps}; for(let i=0;i<frames;i++) drawFrame(r,i,name,frames); });
  return {sheet,meta};
}

/* Debug overlay disabled */
const debugOverlay = null;
function updateDebug() {}


// ===== runtime sprite gen =====
const MANIFEST={}; const SPRITES={};
const ANIMS=[
  ['idle',16,12], ['walk',16,14], ['run',16,20],
  ['jump',12,16], ['aerial',12,14],
  ['attack',14,20], ['special',14,20],
  ['hitstun',10,18], ['ko',12,14],
  ['fs',16,22]
];
const FW=16,FH=16;

function pose_idle(t){ const by=9+Math.sin(t*2*Math.PI)*0.35; return {
  torso:[8,by+1,8,by+5], head:[8,by-2+0.2*Math.sin(t*4*Math.PI)],
  l_arm:[8,by+2,6-1.0*Math.sin(t*2*Math.PI),by+4],
  r_arm:[8,by+2,10+1.0*Math.sin(t*2*Math.PI),by+4],
  l_leg:[8,by+5,7-0.5*Math.sin(t*2*Math.PI),by+8],
  r_leg:[8,by+5,9+0.5*Math.sin(t*2*Math.PI),by+8],
};}
function pose_walk(t){ const by=9,s=Math.sin(t*2*Math.PI); return {
  torso:[8,by+1+0.2*Math.sin(t*4*Math.PI),8,by+5], head:[8,by-2+0.3*Math.sin(t*4*Math.PI)],
  l_arm:[8,by+2,6-2.0*s,by+4], r_arm:[8,by+2,10+2.0*s,by+4],
  l_leg:[8,by+5,7-1.7*s,by+8.2], r_leg:[8,by+5,9+1.7*s,by+8.2],
};}
function pose_run(t){ const by=8,s=Math.sin(t*2*Math.PI); return {
  torso:[8,by+1,8,by+5], head:[8,by-2+0.6*Math.sin(t*4*Math.PI)],
  l_arm:[8,by+2,6-3.2*s,by+4], r_arm:[8,by+2,10+3.2*s,by+4],
  l_leg:[8,by+5,7-3.0*s,by+8.2], r_leg:[8,by+5,9+3.0*s,by+8.2],
};}
function pose_jump(t){ const by=9-2.0*Math.sin(Math.PI*t); return {
  torso:[8,by,8,by+4], head:[8,by-3],
  l_arm:[8,by+2,6.5,by+3.5], r_arm:[8,by+2,9.5,by+3.5],
  l_leg:[8,by+5,7.5,by+7.8], r_leg:[8,by+5,8.5,by+7.8],
};}
function pose_aerial(t){ const by=7+Math.sin(t*2*Math.PI)*0.2; return {
  torso:[8,by+1,8,by+5], head:[8,by-2],
  l_arm:[8,by+2,6.5,by+3.5], r_arm:[8,by+2,9.5,by+3.5],
  l_leg:[8,by+5,7.2,by+7.6], r_leg:[8,by+5,8.8,by+7.6],
};}
function pose_attack(t){ const by=9,swing=Math.sin(Math.min(1.0,t)*Math.PI); const ang=-0.9+2.4*swing;
  const rx=8+Math.cos(ang)*3.6, ry=by+2+Math.sin(ang)*3.6; const la=0.4-0.5*swing, lx=8+Math.cos(la)*2.7, ly=by+2+Math.sin(la)*2.7;
  return { torso:[8,by+1,8,by+5], head:[8,by-2], r_arm:[8,by+2,rx,ry], l_arm:[8,by+2,lx,ly], l_leg:[8,by+5,7,by+8.5], r_leg:[8,by+5,9,by+8.5] };
}
function pose_special(t){ const by=9,charge=Math.min(1.0,t/0.6),ang=2.3-1.4*charge;
  const rx=8+Math.cos(ang)*2.8, ry=by+2+Math.sin(ang)*2.8; const lx=8-Math.cos(ang)*2.8, ly=by+2+Math.sin(ang)*2.8; const crouch=0.6*(1.0 - Math.cos(Math.min(1.0,t)*Math.PI));
  return { torso:[8,by+1,8,by+5], head:[8,by-2], r_arm:[8,by+2,rx,ry], l_arm:[8,by+2,lx,ly], l_leg:[8,by+5,7,by+8.4+crouch*0.5], r_leg:[8,by+5,9,by+8.4+crouch*0.5] };
}
function pose_hitstun(t){ const by=9+Math.sin(t*6*Math.PI)*0.6; return {
  torso:[8,by+1,8,by+5], head:[8,by-1.5], l_arm:[8,by+2,7.0,by+4], r_arm:[8,by+2,9.0,by+4], l_leg:[8,by+5,7.2,by+8.5], r_leg:[8,by+5,8.8,by+8.5],
};}
function pose_ko(t){ const by=9; const ang = t*4*Math.PI; const rx=8+Math.cos(ang)*2.6, ry=by+1+Math.sin(ang)*2.6;
  return { torso:[8,by+1,8,by+5], head:[8,by-2], r_arm:[8,by+2,rx,ry], l_arm:[8,by+2,16-rx,ry], l_leg:[8,by+5,7,by+8.8], r_leg:[8,by+5,9,by+8.8] };
}
function pose_fs(t){ const by=8-0.8*Math.sin(t*2*Math.PI); const ang = -1.2 + 2.4*t;
  return { torso:[8,by+1,8,by+5], head:[8,by-2-0.5*Math.sin(t*4*Math.PI)],
    r_arm:[8,by+2,8+Math.cos(ang)*3.8,by-0.2+Math.sin(ang)*3.8],
    l_arm:[8,by+2,8-Math.cos(ang)*3.8,by-0.2+Math.sin(ang)*3.8],
    l_leg:[8,by+5,7,by+8.2], r_leg:[8,by+5,9,by+8.2] };
}

const POSES={idle:pose_idle, walk:pose_walk, run:pose_run, jump:pose_jump, aerial:pose_aerial, attack:pose_attack, special:pose_special, hitstun:pose_hitstun, ko:pose_ko, fs:pose_fs};

function rgba(hex,a=1){ const c=hex.replace('#',''); const n=parseInt(c,16); const r=(n>>16)&255,g=(n>>8)&255,b=n&255; return [r,g,b,Math.floor(255*a)]; }
function drawFigure(g,pal,pose){
  // Blocky 8-bit character renderer (matches provided sheet style)
  const [primary,secondary,accent]=pal; // primary=shirt, secondary=pants, accent=belt/detail
  const [tx1,ty1,tx2,ty2]=pose.torso;
  const cx=(tx1+tx2)/2;
  const col = (c)=>`rgba(${c[0]},${c[1]},${c[2]},${(c[3]||255)/255})`;

  // Derived palette
  const skin=[241,194,141,255];
  const hair=[45,35,30,255];

  // Head: 6x5 block with two hair rows
  const [hx,hy]=pose.head;
  g.fillStyle=`rgba(${hair[0]},${hair[1]},${hair[2]},1)`; g.fillRect(hx-3,hy-3,6,2);
  g.fillStyle=`rgba(${skin[0]},${skin[1]},${skin[2]},1)`; g.fillRect(hx-3,hy-1,6,4);
  // Eyes
  g.fillStyle='#000'; g.fillRect(hx-2,hy,1,1); g.fillRect(hx+1,hy,1,1);

  // Torso: 6x6 shirt
  g.fillStyle=col(primary); g.fillRect(cx-3,ty1+1,6,6);

  // Helper: draw pixel segment with squares along line
  function seg(x1,y1,x2,y2,w,color){
    const dx=x2-x1, dy=y2-y1; const len=Math.max(1,Math.hypot(dx,dy));
    const steps=Math.ceil(len/1.2); g.fillStyle=color;
    for(let i=0;i<=steps;i++){ const t=i/steps; const x=x1+dx*t, y=y1+dy*t; g.fillRect(Math.round(x-w/2),Math.round(y-w/2),w,w); }
  }

  // Arms from shoulders to pose endpoints (skin color)
  const shoulderY=ty1+3; const lShoulder=cx-3, rShoulder=cx+3;
  const [lax1,lay1,lax2,lay2]=pose.l_arm; const [rax1,ray1,rax2,ray2]=pose.r_arm;
  seg(lShoulder,shoulderY,lax2,lay2,2,`rgba(${skin[0]},${skin[1]},${skin[2]},1)`);
  seg(rShoulder,shoulderY,rax2,ray2,2,`rgba(${skin[0]},${skin[1]},${skin[2]},1)`);

  // Legs from hips to pose endpoints (pants color)
  const hipY=ty1+7; const lHip=cx-2, rHip=cx+2;
  const [llx1,lly1,llx2,lly2]=pose.l_leg; const [rlx1,rly1,rlx2,rly2]=pose.r_leg;
  seg(lHip,hipY,llx2,lly2,2,col(secondary));
  seg(rHip,hipY,rlx2,rly2,2,col(secondary));

  // Accent belt
  g.fillStyle=col(accent); g.fillRect(cx-1,ty1+5,2,1);
}

function makeSheetFromColors(colors, animOverride){
  const pal=[rgba(colors.body), rgba(colors.outline), rgba(colors.accent||'#ffffff')];
  const list = ANIMS.map(([n,fpsFrames,defFps])=>[n,fpsFrames,defFps]); // clone
  const mapped = ANIMS.map(([name,defFrames,defFps])=>{
    const ov = animOverride && animOverride[name];
    return [name, ov ? ov[0] : defFrames, ov ? ov[1] : defFps];
  });
  const rows=mapped.length, cols=Math.max(...mapped.map(a=>a[1]));
  const sheet=document.createElement('canvas'); sheet.width=cols*FW; sheet.height=rows*FH; const g=sheet.getContext('2d'); g.imageSmoothingEnabled=false;
  const meta={ frameSize:[FW,FH], anims:{} };
  mapped.forEach(([name,frames,fps],r)=>{
    meta.anims[name]={row:r,frames,fps};
    for(let i=0;i<frames;i++){
      const t=i/frames; const pose=POSES[name](t);
      g.save(); g.translate(i*FW,r*FH);
      if(name==='hitstun'){ g.globalAlpha = 0.75 + 0.25*Math.sin((i/frames)*4*Math.PI); }
      drawFigure(g,pal,pose);
      if(['attack','special','fs'].includes(name)){
        g.fillStyle=`rgba(${pal[2][0]},${pal[2][1]},${pal[2][2]},${1-i/frames})`;
        g.fillRect(12,7,3,2);
      }
      g.restore();
    }
  });
  return {sheet,meta};
}
async function buildSpritesForSelection(){
  await ensureSpritesIndexLoaded();
  const p1Char=(App.p1.char||CHARACTERS[0]);
  const p2Char=(App.p2.char||CHARACTERS[1]);

  async function buildFor(char, side){
    const id = char.id + '_' + side;
    // Prefer external sheet if configured
    const ext = SPRITE_INDEX[char.id];
    if (!FORCE_PROCEDURAL && ext && ext.sheet && ext.anims && ext.frameSize){
      try{
        const img = await loadImage(ext.sheet);
        SPRITES[id] = img;
        MANIFEST[id] = { frameSize: ext.frameSize, anims: ext.anims };
        return id;
      }catch(e){ /* fallback to portrait/procedural */ }
    }
    // Try building from a portrait if available
    const portraitSrc = PORTRAITS[char.id];
    if (!FORCE_PROCEDURAL && USE_PORTRAIT_FALLBACK && portraitSrc){
      try{
        const pimg = await loadImage(portraitSrc);
        const {sheet,meta} = makeSheetFromPortrait(pimg);
        SPRITES[id]=sheet; MANIFEST[id]={...meta};
        return id;
      }catch(e){ /* fallback to procedural */ }
    }
    // Procedural fallback using palette + anim override
    const colors = char.alts[side==='p1'?(App.p1.alt||0):(App.p2.alt||0)].colors;
    const {sheet,meta} = makeSheetFromColors(colors, char.anim||null);
    SPRITES[id]=sheet; MANIFEST[id]={...meta};
    return id;
  }

  const [p1Id, p2Id] = await Promise.all([ buildFor(p1Char,'p1'), buildFor(p2Char,'p2') ]);
  return {p1Id,p2Id};
}

// ===== UI bindings =====
document.addEventListener('DOMContentLoaded', () => {
  const title   = document.getElementById('title');
  const startBtn= document.getElementById('btnStart');
  if (!title || !startBtn) return;
  const go = () => { if (!title.classList.contains('hidden')) Screens.show('#main'); };
  startBtn.addEventListener('click', go);
  const any = () => { go(); window.removeEventListener('keydown', any); window.removeEventListener('mousedown', any); window.removeEventListener('touchstart', any); };
  window.addEventListener('keydown', any);
  window.addEventListener('mousedown', any);
  window.addEventListener('touchstart', any, { passive: true });
});

let el;
el = $('#gotoSmash');               if (el) el.addEventListener('click', ()=> Screens.show('#modes'));
el = $('#gotoTrainingShortcut');    if (el) el.addEventListener('click', ()=> { App.mode='training'; $('#modeBadge')&&($('#modeBadge').textContent='Training'); buildCharacterSelect(); Screens.show('#chars'); });
el = $('#backMain1');               if (el) el.addEventListener('click', ()=> Screens.show('#main'));
el = $('#gotoModes');               if (el) el.addEventListener('click', ()=> Screens.show('#modes'));
el = $('#configureRules');          if (el) el.addEventListener('click', ()=> Screens.show('#rules'));
el = $('#backModes');               if (el) el.addEventListener('click', ()=> Screens.show('#modes'));
el = $('#rulesConfirm');            if (el) el.addEventListener('click', ()=> { readRules(); Screens.show('#modes'); });

// Online menu navigation + actions
el = $('#gotoOnline');              if (el) el.addEventListener('click', ()=> { Screens.show('#online'); ensureSocket(); setOnlineGoSelect(!!Online.active); onlineStatus(Online.connected? 'Connected.':'Connecting…'); });
el = $('#onlineBack');              if (el) el.addEventListener('click', ()=> Screens.show('#main'));
el = $('#btnCreateRoom');           if (el) el.addEventListener('click', ()=> { const name=$('#onlineName')?.value||''; ensureSocket(); Online.socket.emit('createRoom', { name }); });
el = $('#btnJoinRoom');             if (el) el.addEventListener('click', ()=> { const name=$('#onlineName')?.value||''; const code=($('#roomCodeInput')?.value||'').trim().toUpperCase(); if(!code){ onlineStatus('Enter a code.'); return;} ensureSocket(); Online.socket.emit('joinRoom', { code, name }); });
el = $('#btnRandom');               if (el) el.addEventListener('click', ()=> { const name=$('#onlineName')?.value||''; ensureSocket(); Online.socket.emit('randomQueue', { name }); });
el = $('#onlineGoSelect');          if (el) el.addEventListener('click', ()=> { if(!Online.active){ onlineStatus('Create/join a room or match first.'); return;} buildCharacterSelect(); Screens.show('#chars'); });

// Generic handler for all mode buttons
$$('.mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const m = btn.getAttribute('data-mode')||'stock';
    App.mode = m;
    const labels = { stock:'Stock', training:'Training', timed:'Timed', hyper:'Hyper' };
    const badge = document.getElementById('modeBadge'); if (badge) badge.textContent = labels[m]||m;
    buildCharacterSelect();
    Screens.show('#chars');
  });
});

el = $('#charsBack');               if (el) el.addEventListener('click', ()=> Screens.show('#modes'));
el = $('#openStage');               if (el) el.addEventListener('click', ()=> { buildStages(); Screens.show('#stages'); });
el = $('#stagesBack');              if (el) el.addEventListener('click', ()=> Screens.show('#chars'));
el = $('#stagesConfirm');           if (el) el.addEventListener('click', ()=> Screens.show('#chars'));
el = $('#openMusic');               if (el) el.addEventListener('click', ()=> { buildMusic(); Screens.show('#music'); });
el = $('#musicBack');               if (el) el.addEventListener('click', ()=> Screens.show('#chars'));
el = $('#musicConfirm');            if (el) el.addEventListener('click', ()=> Screens.show('#chars'));

// Character select side toggles
const p1Btn = document.getElementById('viewP1');
const p2Btn = document.getElementById('viewP2');
if (p1Btn){ p1Btn.addEventListener('click', ()=>{ pickSide='p1'; p1Btn.classList.add('primary'); p2Btn&&p2Btn.classList.remove('primary'); }); }
if (p2Btn){ p2Btn.addEventListener('click', ()=>{ pickSide='p2'; p2Btn.classList.add('primary'); p1Btn&&p1Btn.classList.remove('primary'); }); }

el = $('#charsReady');
if (el) el.addEventListener('click', (e)=>{
  e.preventDefault();
  document.activeElement && document.activeElement.blur();
  // Online flow: send ready to server; local flow: start immediately
  if (Online.active && Online.socket && Online.connected){
    const my = (Online.role === 'p2') ? App.p2 : App.p1;
    const payload = { charId: my.char.id, alt: (Online.role==='p2'? App.p2.alt : App.p1.alt) };
    if (Online.role === 'p1'){
      payload.rules = App.rules;
      payload.stageId = (App.stage && App.stage.id) || 'trainingRoom';
    }
    Online.socket.emit('ready', payload);
    const badge = Online.role === 'p1' ? 'P1' : 'P2';
    const code = Online.code || '—';
    const st = document.getElementById('onlineStatus'); if (st) st.textContent = `Ready sent (${badge}). Room ${code}. Waiting for peer…`;
  } else {
    startBattle();
  }
});

function readRules(){
  let el;
  el = document.getElementById('ruleStocks');       App.rules.stocks       = el ? +el.value : 3;
  el = document.getElementById('ruleTime');         App.rules.time         = el ? +el.value : 0;
  el = document.getElementById('ruleRatio');        App.rules.ratio        = el ? +el.value : 1.0;
  el = document.getElementById('ruleItemsOn');      App.rules.itemsOn      = el ? !!el.checked : true;
  el = document.getElementById('ruleItemFreq');     App.rules.itemFreq     = el ? +el.value : 8;
  el = document.getElementById('ruleCpuLevel');     App.rules.cpuLevel     = el ? +el.value : 3;
  el = document.getElementById('ruleScreenShake');  App.rules.shake        = el ? !!el.checked : true;
  el = document.getElementById('ruleHitSparks');    App.rules.sparks       = el ? !!el.checked : true;
  // new
  el = document.getElementById('ruleTagTeam');      App.rules.tagTeam      = el ? !!el.checked : false;
  el = document.getElementById('ruleTeamSize');     App.rules.teamSize     = el ? Math.max(2, Math.min(3, +el.value||2)) : 2;
  el = document.getElementById('rulePowerUpsOn');   App.rules.powerUpsOn   = el ? !!el.checked : true;
  el = document.getElementById('rulePowerUpFreq');  App.rules.powerUpFreq  = el ? +el.value : 10;
  el = document.getElementById('ruleHitboxViewer'); App.rules.hitboxViewer = el ? !!el.checked : false;
}

function buildCharacterSelect(){
  const modeMap={stock:'Stock Battle',training:'Training',timed:'Timed',hyper:'Hyper Smash'};
  $('#modeLabel') && ($('#modeLabel').textContent = modeMap[App.mode] || '—');
  if (!ensurePortraitsLoaded._done){ ensurePortraitsLoaded().then(buildCharacterSelect); }

  // Defaults for both sides
  App.p1.char = App.p1.char || CHARACTERS[0];
  App.p2.char = App.p2.char || CHARACTERS[1];
  App.p1.alt = App.p1.alt||0; App.p2.alt = App.p2.alt||0;

  // Hide old side-by-side grids if present
  const g1 = document.getElementById('p1Chars'); const g2 = document.getElementById('p2Chars');
  if (g1) g1.style.display='none'; if (g2) g2.style.display='none';

  // Ensure a unified grid exists under the toggles
  let ugrid = document.getElementById('charGrid');
  if (!ugrid){
    ugrid = document.createElement('div'); ugrid.id='charGrid'; ugrid.className='grid auto';
    // Prefer to insert after toggles if present, else at top of card
    const toggles = document.getElementById('charToggles');
    const card = document.querySelector('#chars .card');
    if (toggles && toggles.parentElement){ toggles.parentElement.insertBefore(ugrid, toggles.nextSibling); }
    else if (card){ card.insertBefore(ugrid, card.children[1]||null); }
  }
  ugrid.innerHTML='';

  // Helper to update badges and previews
  function refreshUI(){
    // Clear badges
    ugrid.querySelectorAll('.sel-badge').forEach(b=>b.remove());
    // Place P1/P2 badges on their selected tiles
    [ ['p1', App.p1.char], ['p2', App.p2.char] ].forEach(([side, ch])=>{
      const el = ugrid.querySelector(`.char-tile[data-id="${ch.id}"]`);
      if (el){
        const b = document.createElement('div'); b.className=`sel-badge ${side}`; b.textContent = side.toUpperCase();
        Object.assign(b.style,{position:'absolute',right:'6px',bottom:'6px',background: side==='p1'? '#60a5fa':'#f472b6',color:'#000',fontWeight:'900',borderRadius:'10px',padding:'2px 6px',fontSize:'12px'});
        el.appendChild(b);
        el.style.outline = '2px solid rgba(255,255,255,0.15)';
      }
    });
    // Update bottom panels
    const p1Name = document.getElementById('p1Name'); if (p1Name) p1Name.textContent = App.p1.char.name;
    const p2Name = document.getElementById('p2Name'); if (p2Name) p2Name.textContent = App.p2.char.name;
    renderAlts('#p1Alts','p1'); renderAlts('#p2Alts','p2');
  }

  // Build unified grid tiles
  CHARACTERS.forEach((c)=>{
    const tile = document.createElement('div');
    tile.className='char-tile item';
    tile.dataset.id = c.id;
    Object.assign(tile.style,{position:'relative', padding:'8px'});
    // Portrait: use URL if available, else fallback to color block
    const col = (c.alts && c.alts[0] && c.alts[0].colors ? c.alts[0].colors.body : '#1f2937');
    const outline = (c.alts && c.alts[0] && c.alts[0].colors ? c.alts[0].colors.outline : '#111827');
    const portrait = PORTRAITS[c.id] || (c.portrait || null);
    const thumb = document.createElement('div');
    if (portrait){
      Object.assign(thumb.style,{
        height:'64px',borderRadius:'10px',
        backgroundImage:`linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.35)), url(${portrait})`,
        backgroundSize:'cover', backgroundPosition:'center',
        border:`2px solid ${outline}`
      });
    } else {
      Object.assign(thumb.style,{height:'64px',borderRadius:'10px',background:`linear-gradient(180deg, ${col}, #0b0c12)`, border:`2px solid ${outline}`});
    }
    const label = document.createElement('div'); label.textContent=c.name.toUpperCase();
    Object.assign(label.style,{marginTop:'6px',fontFamily:'Barlow Condensed, system-ui',fontWeight:'900',fontSize:'14px',letterSpacing:'.06em'});
    tile.appendChild(thumb); tile.appendChild(label);
    tile.onclick = ()=>{
      App[pickSide].char = c; App[pickSide].alt = 0; refreshUI();
    };
    ugrid.appendChild(tile);
  });

  const renderAlts = (rowId, side) => {
    const row = $(rowId); if(!row) return; row.innerHTML=''; const sel = App[side].char || CHARACTERS[0];
    App[side].char = sel;
    sel.alts.forEach((alt,i)=>{
      const b=document.createElement('button'); b.className='ghost row'; b.style.alignItems='center'; b.style.gap='8px';
      b.innerHTML = `<span class="alt" style="display:inline-block;width:34px;height:34px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px #000;margin-right:6px;background:${alt.colors.body};border-color:${alt.colors.outline}"></span>${alt.name}`;
      b.onclick = ()=>{ App[side].alt=i; renderAlts(rowId, side); };
      if(i===App[side].alt) b.style.outline='3px solid var(--accent)';
      row.appendChild(b);
    });
  };

  refreshUI();
}
function getStageBg(){
  const st = App.stage;
  if(!st) return '#0b0c12';
  if(st.dynamic && st.dynamic.type==='dayNight'){
    const t = (Math.sin(worldTime*0.05)+1)/2; // 0..1
    const day = [16,24,32];
    const night = [3,6,12];
    const mix=(a,b,t)=>`rgb(${Math.round(a[0]*(1-t)+b[0]*t)},${Math.round(a[1]*(1-t)+b[1]*t)},${Math.round(a[2]*(1-t)+b[2]*t)})`;
    return mix(day, night, t);
  }
  return st.bg||'#0b0c12';
}
function buildStages(){
  const grid=$('#stageGrid'); if(!grid) return; grid.innerHTML='';
  STAGES.forEach(st=>{
    const el=document.createElement('div'); el.className='item'; el.innerHTML=`<div style="font-weight:800">${st.name}</div><div class="muted">${st.platforms.length} platforms</div>`;
    el.onclick=()=>{ App.stage=st; $$('#stageGrid .item').forEach(i=>i.style.outline=''); el.style.outline='3px solid var(--accent)'; };
    grid.appendChild(el);
  });
  if(!App.stage) App.stage = STAGES[0];
}
function buildMusic(){
  const grid = document.getElementById('musicGrid'); if (!grid) return;
  grid.innerHTML = '';
  MUSIC.forEach((t)=>{
    const el=document.createElement('div'); el.className='item'; el.textContent=t.name;
    el.onclick=()=>{ App.track=t; startMusic(); $$('#musicGrid .item').forEach(i=>i.style.outline=''); el.style.outline='3px solid var(--accent)'; };
    grid.appendChild(el);
  });
  if (!App.track) { App.track = MUSIC[0]; startMusic(); }
}

// ==== Audio ====
let audioCtx=null, currentNodes=[];
function ensureAudio(){ if(!audioCtx){ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); } }
function stopMusic(){ currentNodes.forEach(n=>{try{n.stop? n.stop(): n.disconnect()}catch{} }); currentNodes=[]; }
function startMusic(){ ensureAudio(); stopMusic(); if(App.track) currentNodes = App.track.generator(audioCtx) || []; }
function melody(ctx, chord, lengths){
  const now = ctx.currentTime+0.05; let t=now; const nodes=[]; const tempo=120; const spb=60/tempo;
  const master = ctx.createGain(); master.gain.value=.15; master.connect(ctx.destination);
  for(let bar=0;bar<120;bar++){
    for(let i=0;i<lengths.length;i++){
      const osc=ctx.createOscillator(); const gain=ctx.createGain();
      const note = 220*Math.pow(2,(chord[i%chord.length]+12*(bar%2))/12);
      osc.type='sawtooth'; osc.frequency.value=note; gain.gain.setValueAtTime(0.0001,t); gain.gain.exponentialRampToValueAtTime(.4,t+.01); gain.gain.exponentialRampToValueAtTime(.001,t+lengths[i]*spb);
      osc.connect(gain); gain.connect(master); osc.start(t); osc.stop(t+lengths[i]*spb+.02); nodes.push(osc);
      t+=lengths[i]*spb;
    }
  }
  return nodes;
}
function bassRun(ctx, steps){
  const master=ctx.createGain(); master.gain.value=.18; master.connect(ctx.destination);
  const tempo=128, spb=60/tempo; let t=ctx.currentTime+0.05; const nodes=[];
  for(let i=0;i<600;i++){
    const osc=ctx.createOscillator(); const gain=ctx.createGain();
    osc.type='square'; const f=110*Math.pow(2,(steps[i%steps.length]-12*(i%4==0?0:1))/12); osc.frequency.value=f;
    gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(.35,t+.02); gain.gain.exponentialRampToValueAtTime(.001,t+spb*.9);
    osc.connect(gain); gain.connect(master); osc.start(t); osc.stop(t+spb);
    nodes.push(osc); t+=spb;
  }
  return nodes;
}
function plucks(ctx, steps){
  const master=ctx.createGain(); master.gain.value=.14; master.connect(ctx.destination);
  const tempo=96, spb=60/tempo; let t=ctx.currentTime+0.05; const nodes=[];
  for(let i=0;i<600;i++){
    const osc=ctx.createOscillator(); const gain=ctx.createGain();
    osc.type='triangle'; const f=330*Math.pow(2,(steps[i%steps.length]+(i%8<4?0:12))/12); osc.frequency.value=f;
    gain.gain.setValueAtTime(.0001,t); gain.gain.exponentialRampToValueAtTime(.3,t+.01); gain.gain.exponentialRampToValueAtTime(.001,t+spb*1.2);
    osc.connect(gain); gain.connect(master); osc.start(t); osc.stop(t+spb*1.3); nodes.push(osc); t+=spb/2;
  }
  return nodes;
}

// ==== Engine + FS ====
const G=1800, FRICTION=0.82, AIR_FRICTION=0.91, JUMP_V=620;
const FS_CHARGE_HIT=0.8, FS_CHARGE_TAKEN=0.4;

class Entity{ constructor(x,y,w,h){ Object.assign(this,{x,y,w,h,vx:0,vy:0,dir:1,dead:false}); } }
class Fighter extends Entity{
  constructor(side,spec,alt,spriteKey){
    super(200+side*600, 400, 40, 48);
    this.side=side; this.spec=spec; this.alt=alt; this.name=spec.name;
    this.spriteKey=spriteKey; this.meta=MANIFEST[spriteKey]; this.sheet=SPRITES[spriteKey];
    this.onGround=false; this.damage=0; this.stocks= App.mode==='training'? Infinity: App.rules.stocks;
    this.holding=null; this.shield=100; this.inv=0; this.stats={kos:0, falls:0, dealt:0};
    this.aiLevel=(side===1?App.rules.cpuLevel:0);
    this.anim='idle'; this.frame=0; this.ft=0;
    this.tAttack=0; this.tSpecial=0; this.tHitstun=0; this.tKO=0;
    this.fs=0; this.fsActive=false; this.tFS=0; this.buff={speed:0,armor:0,double:0,damage:0,invuln:0,invis:0,jump:0,rocket:0,reflect:0,special:0,phase:0,regen:0,healingAura:0,slow:0}; this.extraJumps=0;
  }
  jump(){
    if(this.onGround){ this.vy= -JUMP_V * (this.buff.jump>0?1.35:1.0); this.onGround=false; this.extraJumps = (this.buff.double>0 ? 1 : 0); }
    else if(this.extraJumps>0){ this.vy = -JUMP_V*0.9 * (this.buff.jump>0?1.2:1.0); this.extraJumps--; }
  }
  fastfall(){ if(this.vy>50) this.vy += 450; }
  attack(op){
    if(this._cooldown&&this._cooldown>0) return; this._cooldown=0.25; this.tAttack=0.28;
    if (this.spec.moves && typeof this.spec.moves.attack === 'function'){
      this.spec.moves.attack(this, op);
      return;
    }
    if (this.holding && typeof this.holding.onAttack === 'function'){
      this.holding.onAttack(this, op);
      return;
    }
    const power=this.spec.kit==='heavy'?(12+Math.random()*6):(8+Math.random()*4);
    const kb=this.spec.kit==='heavy'?600:520;
    if(Math.abs(this.x-op.x)<80 && Math.abs(this.y-op.y)<60){ hit(this,op,power*App.rules.ratio,kb*sign(this.dir)); }
  }
  special(op){
    if(this._scd&&this._scd>0) return; this._scd=.8; this.tSpecial=0.5;
    if (this.spec.moves && typeof this.spec.moves.special === 'function'){
      this.spec.moves.special(this, op);
      return;
    }
    if (this.holding && typeof this.holding.onSpecial === 'function'){
      this.holding.onSpecial(this, op);
      return;
    }
    const spd=420*this.spec.stats.speed*sign(this.dir);
    projectiles.push(new Projectile(this.x+this.w/2,this.y+20,spd,0,this,6*App.rules.ratio,520));
  }
  tryFS(op){
    if(this.fs<100 || this.fsActive) return;
    this.fsActive=true; this.tFS=1.1; this.fs=0;
    addHitbox(this, -40,-20, this.w+80, this.h+40, 26*App.rules.ratio, 720*sign(this.dir), 520, 0.5);
  }
  pickOrDrop(){
    if(this.holding){ items.push(this.holding); this.holding=null; return; }
    let best=null,d=48; for(const it of items){ if(Math.abs(it.x-this.x)<d && Math.abs(it.y-this.y)<d){ best=it; d=Math.abs(it.x-this.x); } }
    if(best){
      // Immediate-use items (power-ups) apply on pickup
      if(best.immediate){ best.use(this, opponentOf(this)); items.splice(items.indexOf(best),1); }
      else { this.holding=best; items.splice(items.indexOf(best),1); }
    }
  }
  useItem(op){ if(!this.holding) return; this.holding.use(this,op); if(this.holding.consumable) this.holding=null; }
  update(dt,controls){
    if(this.aiLevel>0 && this===p2) cpuThink(this, opponentOf(this));
    // buff timers decay
    this.buff.speed=Math.max(0,this.buff.speed-dt);
    this.buff.armor=Math.max(0,this.buff.armor-dt);
    this.buff.double=Math.max(0,this.buff.double-dt);
    this.buff.damage=Math.max(0,this.buff.damage-dt);
    this.buff.invuln=Math.max(0,(this.buff.invuln||0)-dt);
    this.buff.invis=Math.max(0,(this.buff.invis||0)-dt);
    this.buff.jump=Math.max(0,(this.buff.jump||0)-dt);
    this.buff.rocket=Math.max(0,(this.buff.rocket||0)-dt);
    this.buff.reflect=Math.max(0,(this.buff.reflect||0)-dt);
    this.buff.special=Math.max(0,(this.buff.special||0)-dt);
    this.buff.phase=Math.max(0,(this.buff.phase||0)-dt);
    this.buff.regen=Math.max(0,(this.buff.regen||0)-dt);
    this.buff.healingAura=Math.max(0,(this.buff.healingAura||0)-dt);
    this.buff.slow=Math.max(0,(this.buff.slow||0)-dt);
    if(this.buff.regen>0){ this.damage = Math.max(0, this.damage - 6*dt); }
    if(this.buff.healingAura>0){ this.damage = Math.max(0, this.damage - 4*dt); }

    this.inv=Math.max(0,this.inv-dt); this._cooldown=Math.max(0,(this._cooldown||0)-dt); this._scd=Math.max(0,(this._scd||0)-dt);
    this.tAttack=Math.max(0,this.tAttack-dt); this.tSpecial=Math.max(0,this.tSpecial-dt);
    this.tHitstun=Math.max(0,this.tHitstun-dt); this.tKO=Math.max(0,this.tKO-dt);
    if(controls.fs) this.tryFS(opponentOf(this));

    const move=(controls.right?1:0)-(controls.left?1:0);
    const accel=this.onGround?210:140;
    let spdMul = this.spec.stats.speed * (this.buff.speed>0?1.5:1.0) * (App.mode==='hyper'?1.25:1.0);
    if (this.buff.jump>0) spdMul *= 1.1;
    if (this.buff.slow>0) spdMul *= 0.6;
    if (this.holding && this.holding.speedMul) spdMul *= this.holding.speedMul;
    this.vx += move*accel*dt*spdMul; this.dir = move!==0? (move>0?1:-1) : this.dir;
    if(!controls.left && !controls.right) this.vx*= this.onGround? FRICTION : AIR_FRICTION;
    if(controls.jump) { this.jump(); controls.jump=false; }
    if(controls.fastfall) this.fastfall();
    if(controls.attack) { this.attack(opponentOf(this)); controls.attack=false; }
    if(controls.special){ this.special(opponentOf(this)); controls.special=false; }
    if(controls.pick){ this.pickOrDrop(); controls.pick=false; }
    if(controls.use){ this.useItem(opponentOf(this)); controls.use=false; }
    if(controls.shield){ this.vx*=0.75; this.shield=Math.max(0,this.shield-dt*15); }

    // Hyper mode keeps FS charged
    if(App.mode==='hyper') this.fs = 100;

    this.vy += G*dt; this.vy=Math.min(this.vy,900);
    this.x += this.vx*dt; this.y += this.vy*dt;
    this.collideStage();

    // ===== blast zones relative to the visible canvas ONLY
    if(startGrace<=0){
      if(this.y>canvas.height+220 || this.y<-220 || this.x<-220 || this.x>canvas.width+220){
        this.fall();
      }
    }

    if(this.fsActive){ this.tFS-=dt; if(this.tFS<=0) this.fsActive=false; }

    const speed=Math.abs(this.vx);
    if(this.tKO>0) this.anim='ko';
    else if(this.fsActive) this.anim='fs';
    else if(this.tHitstun>0) this.anim='hitstun';
    else if(this.tAttack>0) this.anim='attack';
    else if(this.tSpecial>0) this.anim='special';
    else if(!this.onGround && this.vy<0) this.anim='jump';
    else if(!this.onGround && this.vy>=0) this.anim='aerial';
    else if(this.onGround && speed>280) this.anim='run';
    else if(this.onGround && speed>15) this.anim='walk';
    else this.anim='idle';

    const A=(MANIFEST[this.spriteKey]||MANIFEST[Object.keys(MANIFEST)[0]]).anims[this.anim];
    const fps=A.fps; const max=A.frames; this.ft+=dt; const adv=1/fps;
    while(this.ft>=adv){ this.ft-=adv; this.frame=(this.frame+1)%max; }
  }
  fall(){
    this.tKO=0.8;
    if(App.mode==='training'){ this.damage=0; this.placeSpawn(); this.inv=1.2; }
    else{
      this.stocks-=1; this.stats.falls++; if(this.stocks<=0){ this.dead=true; }
      this.damage=0; this.placeSpawn(); this.inv=1.2;
    }
    if(App.rules.shake) shake(8,350);
  }
  placeSpawn(){ this.x=canvas.width*(this.side? .7:.3); this.y=200; this.vx=this.vy=0; }
  collideStage(){
    this.onGround=false; for(const p of App.stage.platforms){
      if(this.x+this.w>p.x && this.x<p.x+p.w && this.y+this.h>p.y && this.y+this.h<p.y+40 && this.vy>0){
        this.y=p.y-this.h; this.vy=0; this.onGround=true; this.extraJumps = (this.buff.double>0 ? 1 : 0);
      }
    }
  }
  render(){
    const A=(MANIFEST[this.spriteKey]||MANIFEST[Object.keys(MANIFEST)[0]]).anims[this.anim];
    const fw=(MANIFEST[this.spriteKey]||MANIFEST[Object.keys(MANIFEST)[0]]).frameSize[0], fh=(MANIFEST[this.spriteKey]||MANIFEST[Object.keys(MANIFEST)[0]]).frameSize[1];
    const sx=this.frame*fw, sy=A.row*fh; const px=Math.round(this.x), py=Math.round(this.y);
    ctx.save(); ctx.imageSmoothingEnabled=false; if (this.buff && this.buff.invis>0) ctx.globalAlpha = 0.4;
    if(this.dir<0){ ctx.scale(-1,1); ctx.drawImage(this.sheet, sx,sy,fw,fh, -px-this.w, py, this.w, this.h); }
    else { ctx.drawImage(this.sheet, sx,sy,fw,fh, px, py, this.w, this.h); }
    ctx.restore();
    ctx.fillStyle=this.alt.colors.outline; const fx=this.dir>0? this.x+this.w-8: this.x-8; ctx.beginPath(); ctx.moveTo(fx,this.y+12); ctx.lineTo(fx+8*this.dir,this.y+20); ctx.lineTo(fx,this.y+28); ctx.fill();
    if(this.holding){ ctx.fillStyle='#fff9'; ctx.fillRect(this.x+this.w/2-8,this.y-10,16,8); this.holding.preview(this.x+this.w/2-10,this.y-34); }
  }
}

class Projectile{
  constructor(x,y,vx,vy,owner,damage,kb){ this.x=x; this.y=y; this.w=12; this.h=6; this.vx=vx; this.vy=vy; this.owner=owner; this.damage=damage; this.kb=kb; this.ttl=2.5; this.dead=false; }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.ttl-=dt; if(this.ttl<=0) this.dead=true; }
  render(){ ctx.fillStyle='#e2e8f0'; ctx.fillRect(this.x,this.y,this.w,this.h); }
}
class BouncyProjectile extends Projectile{
  constructor(x,y,vx,vy,owner,damage,kb){ super(x,y,vx,vy,owner,damage,kb); this.bounces=3; this.w=10; this.h=10; }
  update(dt){
    super.update(dt);
    if(this.x<0 || this.x+this.w>canvas.width){ this.vx*=-1; this.bounces--; }
    if(this.y<0 || this.y+this.h>canvas.height){ this.vy*=-1; this.bounces--; }
    if(this.bounces<=0) this.dead=true;
  }
  render(){ ctx.fillStyle='#ffd166'; ctx.fillRect(this.x,this.y,this.w,this.h); }
}

function addHitbox(owner, ox,oy,w,h, dmg, kbx,kby, ttl=0.12){ hitboxes.push({x:owner.x+(owner.dir>0?ox:owner.w-ox-w), y:owner.y+oy, w,h, owner, dmg, kbx:kbx*owner.dir, kby, ttl}); }
const hitboxes=[];

function hit(src, tgt, dmg, kb){
  if(tgt.inv>0) return;
  if(tgt.buff && tgt.buff.invuln>0) return;
  if(tgt.buff && tgt.buff.phase>0){ tgt.buff.phase = 0; tgt.inv = Math.max(tgt.inv||0, 0.15); return; }
  // modifiers
  let dmg2 = dmg;
  if(src && src.buff && src.buff.damage>0) dmg2 *= 1.25;
  if(App.mode==='hyper') dmg2 *= 1.4;

  tgt.damage += dmg2;
  let kbScale = (1+tgt.damage/120) * 0.9;
  if (tgt.holding && tgt.holding.reduceKbFactor){ kbScale *= tgt.holding.reduceKbFactor; }
  if(tgt && tgt.buff && tgt.buff.armor>0){ kbScale *= 0.6; }
  const kbBase = Math.abs(kb) * (App.mode==='hyper'?1.3:1.0);
  tgt.vx = sign(kb) * kbBase * kbScale;
  tgt.vy = -kbBase*0.35*kbScale;
  tgt.inv=0.25; tgt.tHitstun=Math.min(0.4, 0.15 + dmg2/30) * (tgt.buff.armor>0?0.7:1.0);
  src.stats.dealt += dmg2;
  src.fs = Math.min(100, src.fs + dmg2*FS_CHARGE_HIT);
  tgt.fs = Math.min(100, tgt.fs + dmg2*FS_CHARGE_TAKEN*0.5);
  if(App.rules.sparks) sparks.push({x:tgt.x+tgt.w/2,y:tgt.y+tgt.h/2,t:0.2});
}
function updateHitboxes(dt, p1,p2){
  for(let i=hitboxes.length-1;i>=0;i--){
    const hb=hitboxes[i]; hb.ttl-=dt; if(hb.ttl<=0){ hitboxes.splice(i,1); continue; }
    const t = hb.owner===p1? p2 : p1;
    if(hb.x < t.x+t.w && hb.x+hb.w>t.x && hb.y<t.y+t.h && hb.y+hb.h>t.y){ hit(hb.owner,t,hb.dmg,hb.kbx||0); hitboxes.splice(i,1); }
  }
}

const items=[], projectiles=[], helpers=[], sparks=[];

class Item{
  constructor(name,consumable=true){ Object.assign(this,{name,x:Math.random()*900+80,y:100,w:20,h:20,consumable}); }
  use(by,op){}; update(dt){ this.vy=(this.vy||0)+G*dt; this.y+=this.vy*dt; for(const p of App.stage.platforms){ if(this.x+this.w>p.x&&this.x<p.x+p.w&&this.y+this.h>p.y&&this.vy>0){ this.y=p.y-this.h; this.vy=0; }} }
  draw(){ ctx.fillStyle='#ddd'; ctx.fillRect(this.x,this.y,this.w,this.h); }
  preview(x,y){ ctx.fillStyle='#ddd'; ctx.fillRect(x,y,20,18); }
}
// Power-Ups
class PowerUp extends Item{ constructor(name){ super(name,true); this.immediate=true; this.color='#a78bfa'; }
  apply(by){}
  use(by){ this.apply(by); }
  draw(){ ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x+10,this.y+10,9,0,Math.PI*2); ctx.fill(); }
  preview(x,y){ ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(x+10,y+9,9,0,Math.PI*2); ctx.fill(); }
}
class PU_Speed extends PowerUp{ constructor(){ super('Speed'); this.color='#22c55e'; } apply(by){ by.buff.speed=8; } }
class PU_Armor extends PowerUp{ constructor(){ super('Armor'); this.color='#60a5fa'; } apply(by){ by.buff.armor=6; } }
class PU_Double extends PowerUp{ constructor(){ super('Double Jump'); this.color='#f59e0b'; } apply(by){ by.buff.double=10; by.extraJumps=1; } }
class PU_Damage extends PowerUp{ constructor(){ super('Power'); this.color='#ef4444'; } apply(by){ by.buff.damage=6; } }
class Heart extends Item{ constructor(){ super('Heart'); this.color='#f87171'; }
  use(by){ by.damage=Math.max(0,by.damage-30); }
  draw(){ ctx.fillStyle=this.color; ctx.beginPath(); const x=this.x,y=this.y; ctx.moveTo(x+10,y+18); ctx.bezierCurveTo(x+22,y+6,x+20,y-4,x+10,y+4); ctx.bezierCurveTo(x,y-4,x-2,y+6,x+10,y+18); ctx.fill(); }
  preview(x,y){ this.x=x; this.y=y; this.draw(); } }
class Bomb extends Item{ constructor(){ super('Bomb'); this.color='#fde047'; }
  use(by,op){ hit(by,op,22*App.rules.ratio,700*sign(by.dir)); this.consumable=true; }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,18,18); ctx.fillStyle='#222'; ctx.fillRect(this.x+6,this.y-6,6,8); }
  preview(x,y){ ctx.fillStyle=this.color; ctx.fillRect(x,y,18,18); } }
class AssistTrophy extends Item{ constructor(){ super('Assist'); this.color='#93c5fd'; }
  use(by,op){ helpers.push(new Helper(by,op)); }
  draw(){ ctx.strokeStyle=this.color; ctx.strokeRect(this.x,this.y,20,20); ctx.beginPath(); ctx.arc(this.x+10,this.y+10,6,0,Math.PI*2); ctx.stroke(); } }
class Helper{
  constructor(owner,target){ this.x=owner.x+(owner.dir>0?40:-40); this.y=owner.y; this.w=28; this.h=36; this.vx=0; this.vy=0; this.owner=owner; this.target=target; this.timer=6; this.color='#93c5fd'; this.dead=false; }
  update(dt){ this.timer-=dt; if(this.timer<=0) this.dead=true; const dir=this.target.x>this.x?1:-1; this.vx=dir*280; this.vy+=G*dt; this.x+=this.vx*dt; this.y+=this.vy*dt;
    for(const p of App.stage.platforms){ if(this.x+this.w>p.x&&this.x<p.x+p.w&&this.y+this.h>p.y&&this.vy>0){ this.y=p.y-this.h; this.vy=0; }}
    if(Math.abs(this.x-this.target.x)<50 && Math.abs(this.y-this.target.y)<60){ hit(this.owner,this.target,6*App.rules.ratio,420*dir); } }
  render(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,this.w,this.h); } }
function randomPowerUp(){ const r=Math.random(); if(r<.25) return new PU_Speed(); if(r<.5) return new PU_Armor(); if(r<.75) return new PU_Double(); return new PU_Damage(); }

// === Extended items ===
// Utility helpers for item effects
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function radialHit(owner, cx, cy, r, dmg, kb){
  const apply=(t)=>{
    const dx=t.x+ t.w/2 - cx, dy=t.y+ t.h/2 - cy; const dir = Math.sign(dx)||1; hit(owner, t, dmg, kb*dir);
  };
  if (p1 && Math.hypot((p1.x+p1.w/2)-cx, (p1.y+p1.h/2)-cy) <= r) apply(p1);
  if (p2 && Math.hypot((p2.x+p2.w/2)-cx, (p2.y+p2.h/2)-cy) <= r) apply(p2);
}

class NovaCore extends Item{ constructor(){ super('Nova Core', true); this.color='#f97316'; }
  use(by){ radialHit(by, by.x+by.w/2, by.y+by.h/2, 160, 20*App.rules.ratio, 820); if(App.rules.shake) shake(10,280); }
  draw(){ ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x+10,this.y+10,9,0,Math.PI*2); ctx.fill(); }
}
class EchoBeacon extends Item{ constructor(){ super('Echo Beacon', true); this.color='#22d3ee'; }
  use(by,op){ for(let i=0;i<2;i++) helpers.push(new Helper(by, opponentOf(by))); }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,20,12); }
}
class ShockBlade extends Item{ constructor(){ super('Shock Blade', false); this.color='#7dd3fc'; this.reduceKbFactor=1.0; this.speedMul=1.0; }
  onAttack(by,op){ dashHit(by, by.w+60, by.h-8, 9*App.rules.ratio, 700, 0.18); }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,20,4); }
}
class MeteorGauntlet extends Item{ constructor(){ super('Meteor Gauntlet', true); this.color='#fb7185'; }
  use(by){ by.buff.damage = Math.max(by.buff.damage, 10); }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,16,16); }
}
class PhotonBlaster extends Item{ constructor(){ super('Photon Blaster', false); this.color='#60a5fa'; this.ammo=8; }
  use(by){ if(this.ammo<=0){ this.consumable=true; return; } this.ammo--; projectiles.push(new Projectile(by.x+by.w/2, by.y+20, 900*by.dir, 0, by, 5*App.rules.ratio, 520)); }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,18,10); }
}
class PlasmaLauncher extends Item{ constructor(){ super('Plasma Launcher', false); this.color='#a78bfa'; }
  use(by){ projectiles.push(new Projectile(by.x+by.w/2, by.y+18, 600*by.dir, -40, by, 9*App.rules.ratio, 640)); }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,20,12); }
}
class EmberFlower extends Item{ constructor(){ super('Ember Flower', false); this.color='#f59e0b'; }
  use(by){ for(let i=0;i<4;i++){ projectiles.push(new Projectile(by.x+by.w/2, by.y+18, (380+60*i)*by.dir, -30+i*8, by, 3*App.rules.ratio, 420)); } }
  draw(){ ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(this.x+10,this.y+10,8,0,Math.PI*2); ctx.fill(); }
}
class CryoShard extends Item{ constructor(){ super('Cryo Shard', true); this.color='#93c5fd'; }
  use(by){ const pr=new Projectile(by.x+by.w/2, by.y+20, 700*by.dir, 0, by, 2*App.rules.ratio, 380); pr.onHit=(t)=>{ t.tHitstun=Math.max(t.tHitstun,0.8); t.buff.slow = Math.max(t.buff.slow||0, 2.5); }; projectiles.push(pr); }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,12,12); }
}
class TimeMine extends Item{ constructor(){ super('Time Mine', true); this.color='#eab308'; }
  use(by){ const trap={x:this.x,y:this.y,w:20,h:20,t:3,owner:by,update:(dt)=>{trap.t-=dt; if(trap.t<=0) trap.dead=true; [p1,p2].forEach(tg=>{ if(!tg) return; if(tg===trap.owner) return; const d=Math.hypot((tg.x+tg.w/2)-trap.x,(tg.y+tg.h/2)-trap.y); if(d<100){ tg.buff.slow=Math.max(tg.buff.slow||0, 0.2); }});},render:()=>{ctx.strokeStyle='#eab308'; ctx.strokeRect(trap.x,trap.y,trap.w,trap.h);} }; helpers.push(trap); }
}
class VoltaBomb extends Item{ constructor(){ super('Volta Bomb', true); this.color='#22c55e'; }
  use(by){ radialHit(by, by.x+by.w/2, by.y+by.h/2, 120, 8*App.rules.ratio, 680); }
}
class PulseGrenade extends Item{ constructor(){ super('Pulse Grenade', true); this.color='#f87171'; }
  use(by){ radialHit(by, by.x+by.w/2+40*by.dir, by.y+by.h/2, 130, 2*App.rules.ratio, 820); }
}
class GravityWell extends Item{ constructor(){ super('Gravity Well', true); this.color='#64748b'; }
  use(by){ const trap={x:by.x+by.w/2+by.dir*20,y:by.y+by.h/2,w:14,h:14,t:5,owner:by,update:(dt)=>{trap.t-=dt; if(trap.t<=0) trap.dead=true; [p1,p2].forEach(tg=>{ if(!tg) return; if(tg===trap.owner) return; const dx=trap.x-(tg.x+tg.w/2), dy=trap.y-(tg.y+tg.h/2); const d=Math.hypot(dx,dy); if(d<220){ tg.vx += (dx/d)*240*dt; tg.vy += (dy/d)*220*dt; }});},render:()=>{ctx.strokeStyle='#94a3b8'; ctx.beginPath(); ctx.arc(trap.x,trap.y,10,0,Math.PI*2); ctx.stroke();} }; helpers.push(trap); }
}
class DriftBarrel extends Item{ constructor(){ super('Drift Barrel', true); this.color='#f59e0b'; }
  use(by){ by.vx = 1000*by.dir; by.vy = -200; if(App.rules.shake) shake(6,200); }
}
class LootCrate extends Item{ constructor(){ super('Loot Crate', true); this.color='#6b7280'; }
  use(by){ if(Math.random()<0.15){ radialHit(by, by.x+by.w/2, by.y+by.h/2, 90, 6*App.rules.ratio, 600); } else { items.push(randomLoot()); } }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,20,16); }
}
class NanoCapsule extends Item{ constructor(){ super('Nano Capsule', true); this.color='#a3e635'; }
  use(by){ if(Math.random()<0.5) items.push(new Heart()); else items.push(randomPowerUp()); }
}
class AuraFruit extends Item{ constructor(){ super('Aura Fruit', true); this.color='#34d399'; }
  use(by){ by.damage = Math.max(0, by.damage - 25); }
}
class SteelShield extends Item{ constructor(){ super('Steel Shield', false); this.color='#94a3b8'; this.reduceKbFactor=0.7; this.speedMul=0.85; }
  draw(){ ctx.fillStyle=this.color; ctx.fillRect(this.x,this.y,20,24); }
}
class MirrorOrb extends Item{ constructor(){ super('Mirror Orb', true); this.color='#60a5fa'; this.reflective=true; }
  use(by){ by.buff.reflect = Math.max(by.buff.reflect||0, 10); }
}
class WarpDice extends Item{ constructor(){ super('Warp Dice', true); this.color='#f472b6'; }
  use(by){ const dx= (180+Math.random()*140)*by.dir; by.x = clamp(by.x+dx, 20, canvas.width-60); if(App.rules.shake) shake(3,120); }
}
class JetBoots extends Item{ constructor(){ super('Jet Boots', true); this.color='#22c55e'; }
  use(by){ by.buff.jump = Math.max(by.buff.jump||0, 10); }
}
class ThunderRod extends Item{ constructor(){ super('Thunder Rod', false); this.color='#fbbf24'; }
  onAttack(by,op){ addHitbox(by, -10, -80, by.w+20, 90, 4*App.rules.ratio, 520, 0, 0.08); }
}
class TornadoFan extends Item{ constructor(){ super('Tornado Fan', false); this.color='#a3a3a3'; }
  use(by){ const trap={x:by.x+by.w/2,y:by.y+by.h/2,w:10,h:10,t:2,owner:by,update:(dt)=>{trap.t-=dt; if(trap.t<=0) trap.dead=true; [p1,p2].forEach(tg=>{ if(!tg) return; if(tg===trap.owner) return; const dx=(tg.x+tg.w/2)-trap.x, dy=(tg.y+tg.h/2)-trap.y; const d=Math.hypot(dx,dy); if(d<140){ tg.vx += (dx/d)*180*dt; tg.vy += (dy/d)*140*dt*0.4; }});},render:()=>{ctx.strokeStyle='#e5e7eb'; ctx.beginPath(); ctx.arc(trap.x,trap.y,14,0,Math.PI*2); ctx.stroke();} }; helpers.push(trap); }
}
class InfernoHammer extends Item{ constructor(){ super('Inferno Hammer', false); this.color='#ef4444'; this.speedMul=0.7; }
  onAttack(by,op){ dashHit(by, by.w+80, by.h, 16*App.rules.ratio, 780, 0.22); }
}
class StarlightWand extends Item{ constructor(){ super('Starlight Wand', true); this.color='#d8b4fe'; }
  use(by){ by.buff.special = Math.max(by.buff.special||0, 15); }
}
class KineticDisk extends Item{ constructor(){ super('Kinetic Disk', true); this.color='#38bdf8'; }
  use(by){ const pr=new BouncyProjectile(by.x+by.w/2, by.y+20, 800*by.dir, -60, by, 5*App.rules.ratio, 520); pr.bounces=6; projectiles.push(pr); }
}
class ShadowSphere extends Item{ constructor(){ super('Shadow Sphere', true); this.color='#1f2937'; }
  use(by){ by.buff.invis = Math.max(by.buff.invis||0, 6); }
  draw(){ ctx.fillStyle='rgba(31,41,55,0.9)'; ctx.beginPath(); ctx.arc(this.x+10,this.y+10,9,0,Math.PI*2); ctx.fill(); }
}
class MagnetDrone extends Item{ constructor(){ super('Magnet Drone', true); this.color='#22d3ee'; }
  use(by){ const drone={x:by.x,y:by.y,w:14,h:14,t:8,owner:by,update:(dt)=>{drone.t-=dt; if(drone.t<=0) drone.dead=true; items.forEach(it=>{ if(it===this) return; const dx=by.x - it.x, dy=by.y - it.y; const d=Math.hypot(dx,dy); if(d<300){ it.x += (dx/d)*160*dt; it.y += (dy/d)*160*dt; }});},render:()=>{ctx.strokeStyle='#22d3ee'; ctx.strokeRect(drone.x,drone.y,14,14);} }; helpers.push(drone); }
}
class MeteorHammer extends Item{ constructor(){ super('Meteor Hammer', false); this.color='#9ca3af'; this.speedMul=0.8; }
  onAttack(by,op){ dashHit(by, by.w+90, by.h, 18*App.rules.ratio, 820, 0.24); }
}
class HealingRay extends Item{ constructor(){ super('Healing Ray', true); this.color='#86efac'; }
  use(by){ by.buff.healingAura = Math.max(by.buff.healingAura||0, 6); }
}
class ChaosDice extends Item{ constructor(){ super('Chaos Dice', true); this.color='#f59e0b'; }
  use(by){ const r=Math.random(); if(r<0.2){ by.buff.speed=8; } else if(r<0.4){ by.buff.damage=8; } else if(r<0.6){ by.buff.slow=3; } else if(r<0.8){ by.damage+=20; } else { by.buff.invuln=3; } }
}
class NovaCrown extends Item{ constructor(){ super('Nova Crown', true); this.color='#fde047'; }
  use(by){ by.buff.invuln = Math.max(by.buff.invuln||0, 6); }
}
class CryoGrenade extends Item{ constructor(){ super('Cryo Grenade', true); this.color='#93c5fd'; }
  use(by){ const pr=new Projectile(by.x+by.w/2,by.y+10, 520*by.dir, -80, by, 1*App.rules.ratio, 200); pr.onHit=(t)=>{ t.buff.slow=Math.max(t.buff.slow||0,2.0); t.tHitstun=Math.max(t.tHitstun,0.6); }; projectiles.push(pr); }
}
class WarpBlade extends Item{ constructor(){ super('Warp Blade', false); this.color='#a855f7'; }
  onAttack(by,op){ by.x += 40*by.dir; dashHit(by, by.w+50, by.h-8, 8*App.rules.ratio, 660, 0.16); }
}
class BloomBomb extends Item{ constructor(){ super('Bloom Bomb', true); this.color='#f472b6'; }
  use(by){ radialHit(by, by.x+by.w/2, by.y+by.h/2, 110, 1*App.rules.ratio, 200); if(p1) p1.tHitstun=Math.max(p1.tHitstun,0.8); if(p2) p2.tHitstun=Math.max(p2.tHitstun,0.8); }
}
class VortexDisk extends Item{ constructor(){ super('Vortex Disk', true); this.color='#64748b'; }
  use(by){ const trap={x:by.x+by.w/2,y:by.y+by.h/2,w:12,h:12,t:4,owner:by,update:(dt)=>{trap.t-=dt; if(trap.t<=0) trap.dead=true; [p1,p2].forEach(tg=>{ if(!tg) return; if(tg===trap.owner) return; const dx=trap.x-(tg.x+tg.w/2), dy=trap.y-(tg.y+tg.h/2); const d=Math.hypot(dx,dy); if(d<160){ tg.vx += (dx/d)*300*dt; tg.vy += (dy/d)*280*dt; }});},render:()=>{ctx.strokeStyle='#94a3b8'; ctx.beginPath(); ctx.arc(trap.x,trap.y,12,0,Math.PI*2); ctx.stroke();} }; helpers.push(trap); }
}
class SolarCore extends Item{ constructor(){ super('Solar Core', true); this.color='#facc15'; }
  use(by){ by.buff.regen = Math.max(by.buff.regen||0, 12); }
}
class SpecterLantern extends Item{ constructor(){ super('Specter Lantern', true); this.color='#c084fc'; }
  use(by,op){ for(let i=0;i<3;i++){ const h=new Helper(by, opponentOf(by)); h.timer=3; helpers.push(h); } }
}
class BlastBoots extends Item{ constructor(){ super('Blast Boots', true); this.color='#f87171'; }
  use(by){ by.buff.rocket = Math.max(by.buff.rocket||0, 8); by.buff.speed = Math.max(by.buff.speed||0, 6); }
}
class EnergyCoil extends Item{ constructor(){ super('Energy Coil', false); this.color='#22d3ee'; }
  use(by){ const pr=new BouncyProjectile(by.x+by.w/2,by.y+18, 500*by.dir, 0, by, 4*App.rules.ratio, 520); pr.bounces=4; pr.onHit=(t)=>{ pr.damage += 2*App.rules.ratio; }; projectiles.push(pr); }
}
class NovaRing extends Item{ constructor(){ super('Nova Ring', true); this.color='#fde047'; }
  use(by){ radialHit(by, by.x+by.w/2+10*by.dir, by.y+by.h/2, 140, 3*App.rules.ratio, 720); }
}
class ArcCrystal extends Item{ constructor(){ super('Arc Crystal', true); this.color='#60a5fa'; }
  use(by){ by.buff.damage = Math.max(by.buff.damage||0, 10); }
}
class PhaseCloak extends Item{ constructor(){ super('Phase Cloak', true); this.color='#94a3b8'; }
  use(by){ by.buff.phase = 1; }
}

function randomLoot(){
  const arr=[NovaCore, EchoBeacon, ShockBlade, MeteorGauntlet, PhotonBlaster, PlasmaLauncher, EmberFlower, CryoShard, TimeMine, VoltaBomb, PulseGrenade, GravityWell, DriftBarrel, LootCrate, NanoCapsule, AuraFruit, SteelShield, MirrorOrb, WarpDice, JetBoots, ThunderRod, TornadoFan, InfernoHammer, StarlightWand, KineticDisk, ShadowSphere, MagnetDrone, MeteorHammer, HealingRay, ChaosDice, NovaCrown, CryoGrenade, WarpBlade, BloomBomb, VortexDisk, SolarCore, SpecterLantern, BlastBoots, EnergyCoil, NovaRing, ArcCrystal, PhaseCloak];
  const C = arr[Math.floor(Math.random()*arr.length)]; return new C();
}
function spawnRandomItem(){
  const roll=Math.random();
  if(App.rules.powerUpsOn && roll<0.25){ items.push(randomPowerUp()); return; }
  if(roll<0.6){ items.push(randomLoot()); return; }
  if(roll<0.78) items.push(new Heart()); else if(roll<0.9) items.push(new Bomb()); else items.push(new AssistTrophy());
}

// ==== Controls ====
const keys={};
function clearKeys(){ for(const k of Object.keys(keys)) delete keys[k]; }
window.addEventListener('keydown',e=>{ keys[e.key]=true; });
window.addEventListener('keyup',e=>{ keys[e.key]=false; });

const controlsP1={left:false,right:false,attack:false,special:false,jump:false,fastfall:false,shield:false,pick:false,use:false,fs:false,tag:false,assist:false};
const controlsP2={left:false,right:false,attack:false,special:false,jump:false,fastfall:false,shield:false,pick:false,use:false,fs:false,tag:false,assist:false};
function resetControls(c){ Object.keys(c).forEach(k=> c[k]=false); }
function updateControls(){
  controlsP1.left=!!keys['a']; controlsP1.right=!!keys['d']; controlsP1.fastfall=!!keys['s']; if(keys['w']||keys[' ']){ controlsP1.jump=true; }
  if(keys['j']||keys['z']) controlsP1.attack=true; if(keys['k']||keys['x']) controlsP1.special=true; if(keys['l']) controlsP1.shield=true; if(keys['h']) controlsP1.pick=true; if(keys['u']) controlsP1.use=true; controlsP1.fs=!!keys['o'];
  controlsP1.tag = !!keys['y']; controlsP1.assist = !!keys['t'];
  controlsP2.left=!!keys['ArrowLeft']; controlsP2.right=!!keys['ArrowRight']; controlsP2.fastfall=!!keys['ArrowDown']; if(keys['ArrowUp']||keys['0']){ controlsP2.jump=true; }
  if(keys['1']||keys[',']) controlsP2.attack=true; if(keys['2']||keys['/']) controlsP2.special=true; if(keys['3']) controlsP2.shield=true; if(keys['.']) controlsP2.pick=true; controlsP2.fs=!!keys['9'];
  controlsP2.tag = !!keys['7']; controlsP2.assist = !!keys['6'];
}

// During online game, override remote side's controls with peer data and emit local inputs at ~30Hz
function applyOnlineControls(dt){
  if (!Online.active || !running || !Online.socket) return;
  // Decide which side is local vs remote
  const localIsP1 = (Online.role === 'p1');
  const local = localIsP1 ? controlsP1 : controlsP2;
  const remote = localIsP1 ? controlsP2 : controlsP1;

  // apply peer inputs into remote
  Object.assign(remote, Online.peerControls);

  // send local inputs at ~30Hz
  Online.sendTimer -= dt;
  if (Online.sendTimer <= 0){
    Online.sendTimer = 1/30;
    try{ Online.socket.emit('input', { controls: local, t: performance.now() }); }catch{}
  }
}

// ==== Game loop ====
let p1,p2; let last=0; let running=false; let paused=false; let itemTimer=0; let powerTimer=0; let timer=0; let worldTime=0;
let startGrace = 0; // KO & results lockout at match start
let preStart = false; // freeze gameplay during countdown
let countdownT = 0;  // seconds remaining in countdown
let pickSide = 'p1'; // which side the next character click assigns to
function opponentOf(f){ return f===p1? p2 : p1; }

// Tag team state
let teams=null; // { p1:[Fighter,...], p2:[Fighter,...] }
let teamIdx={ p1:0, p2:0 };
let tagCD={ p1:0, p2:0 };
let assistCD={ p1:0, p2:0 };

function chooseTeamChars(selChar, count){
  const list = CHARACTERS.filter(c=>c.id!==selChar.id);
  const picks=[]; let i=0; while(picks.length<count && i<list.length){ const idx=(Math.floor(Math.random()*list.length)); const c=list.splice(idx,1)[0]; if(c) picks.push(c); i++; }
  return picks;
}
function buildTeams(){
  teams = { p1:[p1], p2:[p2] };
  teamIdx = { p1:0, p2:0 };
  tagCD = { p1:0, p2:0 };
  assistCD = { p1:0, p2:0 };
  const p1Adds = chooseTeamChars(p1.spec, Math.max(0, App.rules.teamSize-1));
  const p2Adds = chooseTeamChars(p2.spec, Math.max(0, App.rules.teamSize-1));
  p1Adds.forEach((c)=>{ teams.p1.push(new Fighter(0, c, (c.alts||[p1.alt])[0], p1.spriteKey /* palette via alt handled inside Fighter */)); });
  p2Adds.forEach((c)=>{ teams.p2.push(new Fighter(1, c, (c.alts||[p2.alt])[0], p2.spriteKey )); });
}
function doTag(side){ if(!App.rules.tagTeam) return; if(tagCD[side]>0) return; const cur = side==='p1'? p1: p2; if(cur.tHitstun>0 || !cur.onGround) return; const arr = teams[side]; if(!arr || arr.length<2) return; let idx = (teamIdx[side]+1)%arr.length; const next = arr[idx];
  // bring in next at current position
  next.x = cur.x; next.y = cur.y; next.vx = 0; next.vy = 0; next.dir = cur.dir; next.inv = 1.0; next.placeSpawn = cur.placeSpawn.bind(next);
  if(side==='p1') p1 = next; else p2 = next;
  teamIdx[side] = idx; tagCD[side] = 3.0; if(App.rules.shake) shake(4,180);
}
function doAssist(side){ if(!App.rules.tagTeam) return; if(assistCD[side]>0) return; const arr = teams[side]; if(!arr || arr.length<2) return; const opp = side==='p1'? p2: p1; const curIdx = teamIdx[side]; const assistPick = arr[(curIdx+1)%arr.length]; helpers.push(new Helper(side==='p1'?p1:p2, opp)); assistCD[side]=5.0; }

async function startBattle(){
  // Hide overlays hard
  document.getElementById('results')?.classList.add('hidden');
  document.getElementById('pause')?.classList.add('hidden');

  Screens.show('#gameScreen'); ensureAudio(); startMusic(); await ensurePortraitsLoaded();
  if(!App.stage) App.stage = STAGES[0];
  // Debug: log when a battle is starting and what the selected config is
  console.log('startBattle() - App (pre-build):', { mode: App.mode, rules: App.rules, p1: App.p1, p2: App.p2, stage: App.stage && App.stage.id });
  const {p1Id,p2Id}= await buildSpritesForSelection();
  p1 = new Fighter(0, App.p1.char||CHARACTERS[0], (App.p1.char||CHARACTERS[0]).alts[App.p1.alt||0], p1Id);
  p2 = new Fighter(1, App.p2.char||CHARACTERS[1], (App.p2.char||CHARACTERS[1]).alts[App.p2.alt||0], p2Id);

  // Build tag teams if enabled
  teams = null; teamIdx={p1:0,p2:0}; tagCD={p1:0,p2:0}; assistCD={p1:0,p2:0};
  if (App.rules.tagTeam){ buildTeams(); }

  // Respect P2 CPU checkbox + level selector — if unchecked, make p2 human (aiLevel 0)
  try{
    const p2CpuEl = document.getElementById('p2Cpu');
    const lvlEl = document.getElementById('p2CpuLevel');
    const uiLvl = lvlEl ? Math.max(1, Math.min(9, parseInt(lvlEl.value||'1',10))) : (App.rules.cpuLevel||1);
    if (p2CpuEl && !p2CpuEl.checked){ p2.aiLevel = 0; }
    else { p2.aiLevel = uiLvl; }
    // keep global rules in sync for any code referencing it
    App.rules.cpuLevel = p2.aiLevel;
  } catch(e){ /* ignore in environments without DOM */ }

  // Debug: log created fighter objects and the start grace period
  console.log('startBattle() - created fighters:', { p1Id, p2Id, p1_preview: { name: p1.name, dead: p1.dead, stocks: p1.stocks }, p2_preview: { name: p2.name, dead: p2.dead, stocks: p2.stocks }, startGrace });

  // force spawn to canvas-based positions
  p1.placeSpawn(); p2.placeSpawn();

  // Begin 3-2-1 countdown overlay and freeze gameplay
  preStart = true; countdownT = 3.1;
  document.getElementById('countdown')?.classList.remove('hidden');
  const ctxt0 = document.getElementById('countdownText'); if (ctxt0) ctxt0.textContent = '3';

  running=true; paused=false; items.length=0; projectiles.length=0; helpers.length=0; itemTimer=0; powerTimer=0; last=0; worldTime=0;
  p1.vx=p1.vy=p2.vx=p2.vy=0;

  clearKeys(); resetControls(controlsP1); resetControls(controlsP2);

  timer = App.rules.time>0? App.rules.time*60 : 0;
  startGrace = 1.25; // <== prevent instant KO/results
  updateHUD(); updateDebug(); requestAnimationFrame(loop);
}
function endBattle(){ running=false; Screens.show('#chars'); }

function updateHUD(){
  const h1=$('#hudP1'), h2=$('#hudP2');
  const parts=(v)=>{ const n=Math.max(0, v|0); const d=Math.floor((v%1)*100); return {n, d} };
  const mkCard=(side, f)=>{
    const id = f && f.spec ? f.spec.id : (side==='p1'? (App.p1.char&&App.p1.char.id): (App.p2.char&&App.p2.char.id));
    const src = (PORTRAITS && PORTRAITS[id]) || '';
    const fs = `<div class="fsbar"><div style="width:${f?Math.floor(f.fs):0}%;"></div></div>`;
    const pct = f? f.damage: 0; const pp=parts(pct);
    const badge = side==='p1'? 'P1' : ( (f && f.aiLevel>0)? 'CPU' : 'P2');
    const name = f && f.name ? f.name : (id||'—');
    const imgStyle = src? `background-image: url(${src}); background-size: cover; background-position: center;` : '';
    const card = `
      <div class="hudcard" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:12px;background:rgba(8,10,16,.65);backdrop-filter:blur(3px);border:1px solid rgba(255,255,255,0.08)">
        <div class="portrait" style="width:44px;height:44px;border-radius:8px;border:2px solid rgba(255,255,255,0.18);${imgStyle}"></div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <div style="display:flex;align-items:center;gap:6px;font-weight:900;letter-spacing:.04em">
            <span>${name.toUpperCase()}</span>
            <span style="background:${side==='p1'?'#60a5fa':'#f472b6'};color:#000;padding:1px 6px;border-radius:10px;font-size:12px">${badge}</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:2px">
            <span class="percent" style="font-size:40px;line-height:34px;font-weight:900;text-shadow:2px 2px 0 #000,-2px 2px 0 #000,2px -2px 0 #000,-2px -2px 0 #000">${pp.n}</span>
            <span style="font-size:16px;opacity:.9;transform:translateY(-4px)">.${pp.d.toString().padStart(2,'0')}</span>
            <span style="font-size:18px;margin-left:2px">%</span>
          </div>
          ${fs}
        </div>
        <div class="stocks" style="margin-left:8px;display:flex;gap:6px">${renderStocks(f)}</div>
      </div>`;
    return card;
  };
  h1.innerHTML = mkCard('p1', p1);
  h2.innerHTML = mkCard('p2', p2);
  $('#hudTimer').textContent = App.mode==='training' ? 'Training' : (App.mode==='timed' && timer>0 ? formatTime(timer) : 'Battle');
}
function renderStocks(f){ if(App.mode==='training') return '<div class="stock"></div>'; let s=''; for(let i=0;i<(f?f.stocks:0);i++) s+='<div class="stock"></div>'; return s; }
function formatTime(sec){ const m=Math.floor(sec/60); const s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; }

function loop(ts){ if(!running) return; if(!last) last=ts; const dt=Math.min(.033,(ts-last)/1000); last=ts; if(!paused){ frame(dt); } requestAnimationFrame(loop); }

function frame(dt){
  // Defensive: if results overlay is visible, do not run updates
  const resultsEl = document.getElementById('results');
  if (resultsEl && !resultsEl.classList.contains('hidden')){
    updateDebug();
    return;
  }
  if(startGrace>0) startGrace -= dt;

  // Starting countdown freeze
  if (preStart){
    countdownT -= dt;
    const cEl = document.getElementById('countdown');
    const tEl = document.getElementById('countdownText');
    if (cEl) cEl.classList.remove('hidden');
    if (tEl){
      if (countdownT > 2) tEl.textContent = '3';
      else if (countdownT > 1) tEl.textContent = '2';
      else if (countdownT > 0) tEl.textContent = '1';
      else tEl.textContent = 'GO!';
    }

    // draw scene without updates
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle=getStageBg(); ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const p of App.stage.platforms){ ctx.fillStyle=p.ground?'#2c2f4a':'#39405e'; ctx.fillRect(p.x,p.y,p.w,p.h); }
    p1.render(); p2.render();
    drawSparks();
    if(App.rules.hitboxViewer) drawDebugBoxes();
    updateHUD();

    if (countdownT <= -0.25){
      preStart = false;
      document.getElementById('countdown')?.classList.add('hidden');
      startGrace = Math.max(startGrace, 0.75);
    }
    updateDebug();
    return;
  }

  updateControls();
  applyOnlineControls(dt);
  p1.update(dt,controlsP1); 
  p2.update(dt,controlsP2);

  worldTime += dt;
  // Tag mechanics
  if(App.rules.tagTeam){
    tagCD.p1 = Math.max(0, tagCD.p1 - dt); tagCD.p2 = Math.max(0, tagCD.p2 - dt);
    assistCD.p1 = Math.max(0, assistCD.p1 - dt); assistCD.p2 = Math.max(0, assistCD.p2 - dt);
    if(controlsP1.tag){ doTag('p1'); controlsP1.tag=false; }
    if(controlsP2.tag){ doTag('p2'); controlsP2.tag=false; }
    if(controlsP1.assist){ doAssist('p1'); controlsP1.assist=false; }
    if(controlsP2.assist){ doAssist('p2'); controlsP2.assist=false; }
  }

  updateHitboxes(dt, p1, p2);

  for(const pr of projectiles){
    pr.update(dt);
    if(collide(pr,p1)&&pr.owner!==p1){
      if ((p1.buff && p1.buff.reflect>0) || (p1.holding && p1.holding.reflective)){
        pr.owner = p1; pr.vx *= -1; pr.vy *= -0.5;
      } else {
        if (typeof pr.onHit === 'function') { try{ pr.onHit(p1); }catch{} }
        hit(pr.owner,p1,pr.damage,pr.kb*sign(pr.vx)); pr.dead=true;
      }
    }
    if(collide(pr,p2)&&pr.owner!==p2){
      if ((p2.buff && p2.buff.reflect>0) || (p2.holding && p2.holding.reflective)){
        pr.owner = p2; pr.vx *= -1; pr.vy *= -0.5;
      } else {
        if (typeof pr.onHit === 'function') { try{ pr.onHit(p2); }catch{} }
        hit(pr.owner,p2,pr.damage,pr.kb*sign(pr.vx)); pr.dead=true;
      }
    }
  }
  for(const h of helpers){ h.update(dt); }
  for(const s of sparks){ s.t-=dt; } 
  removeDead(projectiles); removeDead(helpers); for(let i=sparks.length-1;i>=0;i--) if(sparks[i].t<=0) sparks.splice(i,1);

  if(App.rules.itemsOn && App.mode!=='training'){ itemTimer-=dt; if(itemTimer<=0){ spawnRandomItem(); itemTimer = Math.max(2, App.rules.itemFreq)+Math.random()*2; } }
  if(App.rules.powerUpsOn && App.mode!=='training'){ powerTimer-=dt; if(powerTimer<=0){ items.push(randomPowerUp()); powerTimer = Math.max(4, App.rules.powerUpFreq)+Math.random()*3; } }
  items.forEach(i=> i.update(dt));

  if(App.mode==='timed' && timer>0){ timer -= dt; if(timer<=0){ concludeTimed(); return; } }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=getStageBg(); ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const p of App.stage.platforms){ ctx.fillStyle=p.ground?'#2c2f4a':'#39405e'; ctx.fillRect(p.x,p.y,p.w,p.h); }
  items.forEach(i=> i.draw());
  projectiles.forEach(p=> p.render());
  helpers.forEach(h=> h.render());
  p1.render(); p2.render();
  drawSparks();
  if(App.rules.hitboxViewer) drawDebugBoxes();
  updateHUD();

  // Don’t allow immediate results during the grace window
  if(startGrace<=0 && App.mode!=='training' && (p1.dead||p2.dead)){ showResults(); running=false; }
  updateDebug();
}
function drawSparks(){ for(const s of sparks){ ctx.globalAlpha=Math.max(0,s.t/0.2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x,s.y,8*(s.t/0.2),0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; } }
function drawDebugBoxes(){
  // fighters
  ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='#22c55e'; ctx.fillRect(p1.x,p1.y,p1.w,p1.h); ctx.fillStyle='#ef4444'; ctx.fillRect(p2.x,p2.y,p2.w,p2.h); ctx.restore();
  // hitboxes
  ctx.save(); ctx.strokeStyle='#f59e0b'; hitboxes.forEach(h=>{ ctx.strokeRect(h.x,h.y,h.w,h.h); }); ctx.restore();
  // projectiles
  ctx.save(); ctx.strokeStyle='#93c5fd'; projectiles.forEach(pr=>{ ctx.strokeRect(pr.x,pr.y,pr.w,pr.h); }); ctx.restore();
}
function collide(a,b){ return (a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y); }
function removeDead(arr){ for(let i=arr.length-1;i>=0;i--) if(arr[i].dead) arr.splice(i,1); }

// ==== Pause / overlays (Escape) ====
window.addEventListener('keydown', function(e){
  const gs = document.getElementById('gameScreen');
  if (!gs || gs.classList.contains('hidden')) return;
  if (preStart) return; // ignore inputs while countdown is running

  const pauseEl = document.getElementById('pause');

  if (e.key === 'Escape'){
    paused = !paused;
    if (pauseEl) pauseEl.classList.toggle('hidden', !paused);
  }

  if (App.mode === 'training' && e.key === 'i'){
    paused = true;
    if (pauseEl) pauseEl.classList.remove('hidden');
    spawnMenu();
  }
});

document.getElementById('resume')?.addEventListener('click', function(){
  paused = false; document.getElementById('pause')?.classList.add('hidden');
});
document.getElementById('endBattle')?.addEventListener('click', function(){
  paused = false; document.getElementById('pause')?.classList.add('hidden'); endBattle();
});
document.getElementById('spawnItem')?.addEventListener('click', function(){ spawnMenu(); });

function spawnMenu(){
  const old = $('#pause .panel .spawnGrid'); if(old) old.remove();
  const grid = document.createElement('div'); grid.className='grid auto gap spawnGrid'; grid.style.marginTop='10px';
  [
    {n:'Heart',c:()=>items.push(new Heart())},
    {n:'Bomb',c:()=>items.push(new Bomb())},
    {n:'Assist Trophy',c:()=>items.push(new AssistTrophy())},
    {n:'Nova Core',c:()=>items.push(new NovaCore())},
    {n:'Echo Beacon',c:()=>items.push(new EchoBeacon())},
    {n:'Photon Blaster',c:()=>items.push(new PhotonBlaster())},
    {n:'Steel Shield',c:()=>items.push(new SteelShield())},
    {n:'Gravity Well',c:()=>items.push(new GravityWell())},
    {n:'Loot Crate',c:()=>items.push(new LootCrate())}
  ]
    .forEach(o=>{const it=document.createElement('div'); it.className='item'; it.textContent=o.n; it.onclick=()=>{o.c(); grid.remove();}; grid.appendChild(it);});
  document.querySelector('#pause .panel')?.appendChild(grid);
}

function concludeTimed(){
  const p1score = p1.stats.kos - p1.stats.falls + p1.stats.dealt/1000;
  const p2score = p2.stats.kos - p2.stats.falls + p2.stats.dealt/1000;
  showResults(p1score===p2score? 'Sudden Death (proto)' : (p1score>p2score? 'Player 1 Wins!' : 'Player 2 Wins!'));
  running=false;
}
function showResults(title){
  console.log('showResults() called', { title, p1_dead: p1 && p1.dead, p2_dead: p2 && p2.dead, startGrace });
  running = false; paused = true; updateDebug();

  // Determine winner/placement
  let p1Place = 1, p2Place = 2;
  if (title){ /* explicit */ }
  else if (p1 && p2){ if (p1.dead && !p2.dead) { p1Place=2; p2Place=1; } else if (!p1.dead && p2.dead) { p1Place=1; p2Place=2; } }

  const rt = document.getElementById('resultTitle');
  if (rt){ rt.textContent = 'GAME!'; rt.style.fontSize='56px'; rt.style.letterSpacing='.06em'; }

  const card = (f, place, side) => {
    const id = f && f.spec ? f.spec.id : 'unknown';
    const src = PORTRAITS && PORTRAITS[id] ? PORTRAITS[id] : '';
    const name = (f && f.name) ? f.name.toUpperCase() : id.toUpperCase();
    const badge = side==='p1' ? 'P1' : (f && f.aiLevel>0 ? 'CPU' : 'P2');
    const topColor = side==='p1' ? '#ef4444' : '#111827';
    const sub = side==='p1' ? '#ffccd5' : '#d1d5db';
    const k = (f && f.stats && f.stats.kos)||0; const falls=(f && f.stats && f.stats.falls)||0; const dealt=(f && f.stats && f.stats.dealt)||0;
    const img = src ? `background-image:linear-gradient(180deg, rgba(0,0,0,.0), rgba(0,0,0,.25)), url(${src}); background-size:cover; background-position:center;` : '';
    return `
      <div class="rescard" style="flex:1;min-width:260px;border-radius:16px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,0.06)">
        <div style="height:120px;${img}"></div>
        <div style="background:${topColor};color:#fff;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">
          <div style="font-weight:900;letter-spacing:.04em">${name}</div>
          <div style="display:flex;align-items:center;gap:8px"><span style="background:#fff;color:#000;border-radius:10px;padding:2px 8px;font-weight:900">${badge}</span><span style="font-size:28px;font-weight:900">${place}</span></div>
        </div>
        <div style="background:linear-gradient(180deg,#0f1116,#0b0c12);color:${sub};padding:10px 12px;">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><span>Total</span><span style="font-weight:900;color:#fff">${(k - falls) >= 0? '+':''}${(k - falls)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><span>KOs</span><span style="color:#fff">${k}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><span>Falls</span><span style="color:#fff">${falls}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span>Damage Dealt</span><span style="color:#fff">${dealt.toFixed(1)}</span></div>
        </div>
      </div>`;
  };

  const statsEl = document.getElementById('resultStats');
  if (statsEl){
    statsEl.innerHTML = `<div style="display:flex;gap:16px;flex-wrap:wrap">${card(p1,p1Place,'p1')}${card(p2,p2Place,'p2')}</div>`;
  }
  const results = document.getElementById('results'); if (results) results.classList.remove('hidden');
}

let shakeAmt=0, shakeEnd=0;
function shake(mag, ms){ shakeAmt=mag; shakeEnd=performance.now()+ms; const tick=()=>{ if(performance.now()<shakeEnd){ const dx=(Math.random()*shakeAmt-shakeAmt/2),dy=(Math.random()*shakeAmt-shakeAmt/2); ctx.setTransform(1,0,0,1,dx,dy); requestAnimationFrame(tick); } else ctx.setTransform(1,0,0,1,0,0); }; tick(); }
function sign(v){ return v<0?-1:1; }

// === simple helpers for unique moves ===
function fireFan(owner, count, spreadDeg, speed, dmg){
  const baseAng = 0; const toRad = Math.PI/180; const spread = spreadDeg * toRad;
  for(let i=0;i<count;i++){
    const t = count>1? (i/(count-1)) : 0.5;
    const ang = -spread/2 + spread*t + baseAng;
    const vx = Math.cos(ang) * speed * owner.dir;
    const vy = Math.sin(ang) * speed * 0.6;
    projectiles.push(new Projectile(owner.x+owner.w/2, owner.y+22, vx, vy, owner, dmg*App.rules.ratio, 520));
  }
}
function dashHit(owner, w,h,dmg,kb, duration){ addHitbox(owner, owner.dir>0?0:-w+owner.w, 0, w, h, dmg*App.rules.ratio, kb, 0, duration); }

function cpuThink(bot, foe){
  const lvl = Math.max(1, Math.min(9, bot.aiLevel || App.rules.cpuLevel || 1));
  const ln = lvl/9; // 0.11..1
  const now = performance.now()/1000;
  bot._aiCD = bot._aiCD || 0; // next allowed decision time
  if (now < bot._aiCD) return; // rate limit decisions
  const baseDelay = 0.28 + (1-ln)*0.35; // slower reactions at lower levels
  bot._aiCD = now + baseDelay;

  const c = { left:false,right:false,jump:false,fastfall:false,attack:false,special:false,shield:false,pick:false,use:false,fs:false };

  // Approach/space
  if(Math.abs(bot.x-foe.x)>30){ c.left = bot.x>foe.x; c.right = bot.x<foe.x; }
  // Vertical decision
  if((foe.y+foe.h) < bot.y && Math.random() < 0.015*ln) c.jump=true;

  // Offensive decisions tuned down heavily
  if(Math.random() < 0.012*ln){ c.attack=true; }
  if(Math.random() < 0.006*ln){ c.special=true; }

  // FS sparingly
  if(bot.fs>=100 && Math.random() < 0.004*ln){ c.fs=true; }

  // Items
  if(bot.holding==null && items.some(i=>Math.abs(i.x-bot.x)<26 && Math.abs(i.y-bot.y)<26) && Math.random() < 0.02*ln){ c.pick=true; }
  if(bot.holding!=null && Math.random() < 0.012*ln){ c.use=true; }

  Object.assign(bot===p2?controlsP2:controlsP1, c);
}

// === Add requested characters with unique specials and animation tuning ===
(function(){
  const fastAnim = { attack:[12,20], special:[12,20], run:[10,22] };
  const heavyAnim = { attack:[10,14], special:[10,14], run:[8,14] };
  const magicAnim = { attack:[12,16], special:[14,18], run:[8,16] };

  const add = (...arr)=>arr.forEach(c=>CHARACTERS.push(c));

  add(
    { id:'sonic', name:'Sonic', kit:'fast', stats:{weight:0.9, speed:1.6}, anim:fastAnim, moves:{
      attack:(self,op)=>{ dashHit(self, self.w+46, self.h-10, 7, 600, 0.16); },
      special:(self,op)=>{ if(self._scd>0) return; self._scd=.9; self.tSpecial=.45; self.vx=900*sign(self.dir); dashHit(self, self.w+80, self.h-8, 10, 660, 0.18); }
    }, alts:[
      {name:'Default', colors:{body:'#1fb6ff', outline:'#005bbb', accent:'#a7f3ff'}},
      {name:'Dark',    colors:{body:'#0ea5e9', outline:'#111827', accent:'#93c5fd'}}
    ]},
    { id:'tails', name:'Tails', kit:'ranged', stats:{weight:0.95, speed:1.3}, anim:fastAnim, moves:{
      attack:(s,o)=>{ fireFan(s,2,20,420,5); },
      special:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; fireFan(s,3,40,520,6); }
    }, alts:[
      {name:'Default', colors:{body:'#fbbf24', outline:'#b45309', accent:'#fff3c4'}},
      {name:'Blue',    colors:{body:'#60a5fa', outline:'#1e40af', accent:'#bfdbfe'}}
    ]},
    { id:'knuckles', name:'Knuckles', kit:'heavy', stats:{weight:1.2, speed:1.0}, anim:heavyAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+30, s.h-10, 10, 640, 0.14); },
      special:(s,o)=>{ s._scd=1.1; s.tSpecial=.5; addHitbox(s, -20, s.h-24, s.w+40, 28, 14*App.rules.ratio, 700, 0, 0.18); if(App.rules.shake) shake(6,250); }
    }, alts:[
      {name:'Default', colors:{body:'#ef4444', outline:'#7f1d1d', accent:'#fecaca'}},
      {name:'Emerald', colors:{body:'#10b981', outline:'#065f46', accent:'#a7f3d0'}}
    ]},
    { id:'amy', name:'Amy', kit:'heavy', stats:{weight:1.05, speed:1.15}, anim:heavyAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+50, s.h-8, 9, 600, 0.16); },
      special:(s,o)=>{ s._scd=1.0; s.tSpecial=.6; dashHit(s, s.w+70, s.h, 12, 650, 0.2); }
    }, alts:[
      {name:'Default', colors:{body:'#f472b6', outline:'#9d174d', accent:'#ffd1e7'}},
      {name:'Mint',    colors:{body:'#34d399', outline:'#065f46', accent:'#c7f9e5'}}
    ]},
    { id:'shadow', name:'Shadow', kit:'fast', stats:{weight:1.0, speed:1.5}, anim:fastAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+40, s.h-8, 8, 600, 0.14); },
      special:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; s.vx = 1000*sign(s.dir); dashHit(s, s.w+90, s.h-10, 11, 680, 0.18); }
    }, alts:[
      {name:'Default', colors:{body:'#111827', outline:'#ef4444', accent:'#ffe4e6'}},
      {name:'Gold',    colors:{body:'#fbbf24', outline:'#92400e', accent:'#fff1b8'}}
    ]},
    { id:'cream', name:'Cream', kit:'support', stats:{weight:0.85, speed:1.2}, anim:magicAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+22, s.h-12, 6, 520, 0.12); },
      special:(s,o)=>{ s._scd=1.2; s.tSpecial=.5; helpers.push(new Helper(s,o)); }
    }, alts:[
      {name:'Default', colors:{body:'#fcd34d', outline:'#b45309', accent:'#fff0b3'}},
      {name:'Cherry',  colors:{body:'#fda4af', outline:'#9f1239', accent:'#ffe4e6'}}
    ]},

    // Undertale / Deltarune style casts (simplified specials)
    { id:'frisk', name:'Frisk', kit:'fast', stats:{weight:0.92, speed:1.35}, anim:fastAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+28, s.h-10, 8, 560, 0.14); },
      special:(s,o)=>{ fireFan(s,3,20,500,6); }
    }, alts:[{name:'Default', colors:{body:'#93c5fd', outline:'#1e40af', accent:'#bfdbfe'}},{name:'Green', colors:{body:'#86efac', outline:'#065f46', accent:'#dcfce7'}}]},
    { id:'toriel', name:'Toriel', kit:'zoner', stats:{weight:1.0, speed:1.0}, anim:magicAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+24, s.h-8, 7, 540, 0.14); },
      special:(s,o)=>{ fireFan(s,5,60,480,5); }
    }, alts:[{name:'Default', colors:{body:'#e9d5ff', outline:'#7c3aed', accent:'#f7ecff'}},{name:'Fire', colors:{body:'#fca5a5', outline:'#7f1d1d', accent:'#fecaca'}}]},
    { id:'papyrus', name:'Papyrus', kit:'ranged', stats:{weight:0.98, speed:1.1}, anim:fastAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+30, s.h-10, 8, 560, 0.14); },
      special:(s,o)=>{ fireFan(s,4,10,540,5); }
    }, alts:[{name:'Default', colors:{body:'#d1fae5', outline:'#10b981', accent:'#bbf7d0'}},{name:'Blue', colors:{body:'#93c5fd', outline:'#1d4ed8', accent:'#c7d2fe'}}]},
    { id:'sans', name:'Sans', kit:'ranged', stats:{weight:0.9, speed:1.1}, anim:fastAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+22, s.h-10, 7, 520, 0.12); },
      special:(s,o)=>{ fireFan(s,6,30,560,4); }
    }, alts:[{name:'Default', colors:{body:'#e5e7eb', outline:'#1f2937', accent:'#cbd5e1'}},{name:'Blue', colors:{body:'#93c5fd', outline:'#1d4ed8', accent:'#bfdbfe'}}]},
    { id:'undyne', name:'Undyne', kit:'ranged', stats:{weight:1.1, speed:1.15}, anim:fastAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+34, s.h-8, 9, 600, 0.14); },
      special:(s,o)=>{ fireFan(s,5,20,640,6); }
    }, alts:[{name:'Default', colors:{body:'#60a5fa', outline:'#1d4ed8', accent:'#bfdbfe'}},{name:'Green', colors:{body:'#86efac', outline:'#065f46', accent:'#dcfce7'}}]},
    { id:'mettaton', name:'Mettaton', kit:'ranged', stats:{weight:1.05, speed:1.05}, anim:magicAnim, moves:{
      attack:(s,o)=>{ fireFan(s,2,16,520,5); },
      special:(s,o)=>{ fireFan(s,6,60,520,4); }
    }, alts:[{name:'Default', colors:{body:'#f472b6', outline:'#7c3aed', accent:'#fbcfe8'}},{name:'Silver', colors:{body:'#e5e7eb', outline:'#6b7280', accent:'#f3f4f6'}}]},
    { id:'mettaton_ex', name:'Mettaton EX', kit:'ranged', stats:{weight:1.05, speed:1.2}, anim:magicAnim, moves:{
      attack:(s,o)=>{ fireFan(s,3,24,560,5); },
      special:(s,o)=>{ fireFan(s,10,80,600,4); }
    }, alts:[{name:'Default', colors:{body:'#f472b6', outline:'#ff6b81', accent:'#ffd1e7'}},{name:'Black', colors:{body:'#111827', outline:'#4b5563', accent:'#e5e7eb'}}]},
    { id:'asgore', name:'Asgore', kit:'heavy', stats:{weight:1.25, speed:0.95}, anim:heavyAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+40, s.h, 11, 700, 0.18); },
      special:(s,o)=>{ s._scd=1.2; s.tSpecial=.6; dashHit(s, s.w+90, s.h, 15, 750, 0.22); if(App.rules.shake) shake(10,300); }
    }, alts:[{name:'Default', colors:{body:'#f59e0b', outline:'#92400e', accent:'#fde68a'}},{name:'Blue', colors:{body:'#60a5fa', outline:'#1e40af', accent:'#bfdbfe'}}]},

    { id:'kris', name:'Kris', kit:'fast', stats:{weight:1.0, speed:1.3}, anim:fastAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+30, s.h-8, 8, 600, 0.14); },
      special:(s,o)=>{ dashHit(s, s.w+70, s.h-8, 10, 640, 0.18); }
    }, alts:[{name:'Default', colors:{body:'#60a5fa', outline:'#1e40af', accent:'#93c5fd'}},{name:'Yellow', colors:{body:'#fde047', outline:'#a16207', accent:'#fff4b3'}}]},
    { id:'susie', name:'Susie', kit:'heavy', stats:{weight:1.2, speed:1.05}, anim:heavyAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+46, s.h, 10, 660, 0.16); },
      special:(s,o)=>{ s._scd=1.1; s.tSpecial=.5; dashHit(s, s.w+80, s.h, 13, 700, 0.2); }
    }, alts:[{name:'Default', colors:{body:'#a78bfa', outline:'#6d28d9', accent:'#ddd6fe'}},{name:'Green', colors:{body:'#34d399', outline:'#065f46', accent:'#a7f3d0'}}]},
    { id:'ralsei', name:'Ralsei', kit:'magic', stats:{weight:0.95, speed:1.15}, anim:magicAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+24, s.h-10, 7, 540, 0.14); },
      special:(s,o)=>{ fireFan(s,4,50,520,6); }
    }, alts:[{name:'Default', colors:{body:'#34d399', outline:'#065f46', accent:'#a7f3d0'}},{name:'Pink', colors:{body:'#f472b6', outline:'#9d174d', accent:'#fecdd3'}}]},
    { id:'jevil', name:'Jevil', kit:'chaos', stats:{weight:1.0, speed:1.35}, anim:fastAnim, moves:{
      attack:(s,o)=>{ const vx=600*sign(s.dir); projectiles.push(new BouncyProjectile(s.x+s.w/2,s.y+20,vx, -80, s, 6*App.rules.ratio, 520)); },
      special:(s,o)=>{ projectiles.push(new BouncyProjectile(s.x+s.w/2,s.y+20,520*sign(s.dir),-200,s,7*App.rules.ratio,540)); projectiles.push(new BouncyProjectile(s.x+s.w/2,s.y+20,-520*sign(s.dir),-120,s,7*App.rules.ratio,540)); }
    }, alts:[{name:'Default', colors:{body:'#a78bfa', outline:'#3b0764', accent:'#c4b5fd'}},{name:'Gold', colors:{body:'#facc15', outline:'#78350f', accent:'#fde68a'}}]},
    { id:'spade_king', name:'Spade King', kit:'heavy', stats:{weight:1.3, speed:0.95}, anim:heavyAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+40, s.h, 11, 700, 0.18); },
      special:(s,o)=>{ s._scd=1.2; s.tSpecial=.6; dashHit(s, s.w+100, s.h, 16, 760, 0.22); if(App.rules.shake) shake(10,300); }
    }, alts:[{name:'Default', colors:{body:'#111827', outline:'#4338ca', accent:'#a5b4fc'}},{name:'Ruby', colors:{body:'#ef4444', outline:'#7f1d1d', accent:'#fecaca'}}]},
    { id:'noelle', name:'Noelle', kit:'magic', stats:{weight:0.95, speed:1.15}, anim:magicAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+24, s.h-10, 7, 540, 0.14); },
      special:(s,o)=>{ fireFan(s,3,30,560,6); }
    }, alts:[{name:'Default', colors:{body:'#93c5fd', outline:'#1e40af', accent:'#bfdbfe'}},{name:'Mint', colors:{body:'#86efac', outline:'#065f46', accent:'#dcfce7'}}]},
    { id:'spamton', name:'Spamton', kit:'ranged', stats:{weight:0.98, speed:1.2}, anim:fastAnim, moves:{
      attack:(s,o)=>{ fireFan(s,3,24,540,4); },
      special:(s,o)=>{ fireFan(s,6,60,580,4); }
    }, alts:[{name:'Default', colors:{body:'#e5e7eb', outline:'#111827', accent:'#facc15'}},{name:'Cyan', colors:{body:'#22d3ee', outline:'#0e7490', accent:'#a5f3fc'}}]},
    { id:'tenna', name:'Tenna', kit:'fast', stats:{weight:1.0, speed:1.4}, anim:fastAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+30, s.h-8, 8, 600, 0.14); },
      special:(s,o)=>{ fireFan(s,4,16,660,6); }
    }, alts:[{name:'Default', colors:{body:'#06b6d4', outline:'#0e7490', accent:'#a5f3fc'}},{name:'Violet', colors:{body:'#a78bfa', outline:'#6d28d9', accent:'#ddd6fe'}}]},
    { id:'knight', name:'Knight', kit:'heavy', stats:{weight:1.2, speed:1.0}, anim:heavyAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+36, s.h, 10, 680, 0.16); },
      special:(s,o)=>{ s._scd=1.2; s.tSpecial=.6; dashHit(s, s.w+80, s.h, 14, 720, 0.2); }
    }, alts:[{name:'Default', colors:{body:'#cbd5e1', outline:'#475569', accent:'#94a3b8'}},{name:'Crimson', colors:{body:'#ef4444', outline:'#7f1d1d', accent:'#fecaca'}}]},
    { id:'gerson', name:'Gerson', kit:'heavy', stats:{weight:1.15, speed:0.98}, anim:heavyAnim, moves:{
      attack:(s,o)=>{ dashHit(s, s.w+30, s.h, 10, 640, 0.16); },
      special:(s,o)=>{ s._scd=1.2; s.tSpecial=.55; addHitbox(s, -10, s.h-20, s.w+60, 26, 12*App.rules.ratio, 700, 0, 0.2); if(App.rules.shake) shake(8,260); }
    }, alts:[{name:'Default', colors:{body:'#22c55e', outline:'#14532d', accent:'#86efac'}},{name:'Stone', colors:{body:'#94a3b8', outline:'#334155', accent:'#cbd5e1'}}]}
  );
})();

window.Smashlike = {
  addStage(stage){ STAGES.push(stage); },
  addCharacter(c){ CHARACTERS.push(c); },
  addMusic(t){ MUSIC.push(t); },
};
/**
 * smashlike-extended-moves.js
 * Drop this after your main game script. It:
 *  1) Adds `up`/`down` flags to controls.
 *  2) Extends Fighter.attack / Fighter.special so they dispatch to per-variant moves:
 *       moves.attack.{side,up,down,aerial} and moves.special.{side,up,down,aerial}
 *     (Falls back to your existing simple attack/special if a variant isn't provided.)
 *  3) Assigns themed movesets to a bunch of characters (base 4 + Sonic crew + UT/DR picks).
 *
 * Nothing in the base file needs to be edited—this file monkey-patches at runtime.
 */
(function(){
  if (typeof window === "undefined") return;

  const Smashlike = window.Smashlike || {};
  const projectiles = window.projectiles || (window.projectiles = []);
  const App = window.App || { rules: { ratio: 1 } };
  const controlsP1 = window.controlsP1 || (window.controlsP1 = {});
  const controlsP2 = window.controlsP2 || (window.controlsP2 = {});

  // --- add up/down to control sampling (wrap updateControls) ---
  const _origUpdateControls = window.updateControls;
  window.updateControls = function(){
    if (_origUpdateControls) _origUpdateControls();
    if (typeof controlsP1.up === "undefined") { controlsP1.up = false; controlsP1.down = false; }
    if (typeof controlsP2.up === "undefined") { controlsP2.up = false; controlsP2.down = false; }
    try{
      const keys = window.keys || {};
      controlsP1.up   = !!keys["w"];
      controlsP1.down = !!keys["s"];
      controlsP2.up   = !!(keys["ArrowUp"] || keys["0"]);
      controlsP2.down = !!keys["ArrowDown"];
    }catch(e){}
  };

  const sign = (v)=> (v<0?-1:1);
  function variantFrom(self, controls){
    if (!self.onGround) return 'aerial';
    if (controls && controls.up)   return 'up';
    if (controls && controls.down) return 'down';
    return 'side';
  }

  const CHAR = window.CHARACTERS || [];
  function getChar(id){ return CHAR.find(c=>c.id===id); }
  function setMoves(id, config){
    const c = getChar(id);
    if (!c) return;
    c.moves = c.moves || {};
    if (config.attack) c.moves.attack = config.attack;
    if (config.special) c.moves.special = config.special;
    if (config.anim) c.anim = config.anim;
  }

  const F = window.Fighter;
  if (!F) { console.warn("[extended-moves] Fighter not found yet; load this after the main script."); return; }

  // --- default fallbacks (approximate your base logic) ---
  function defaultAttack(self, op){
    if(self._cooldown&&self._cooldown>0) return; self._cooldown=0.25; self.tAttack=0.28;
    if (self.holding && typeof self.holding.onAttack === 'function'){ self.holding.onAttack(self, op); return; }
    const power=self.spec && self.spec.kit==='heavy'?(12+Math.random()*6):(8+Math.random()*4);
    const kb=self.spec && self.spec.kit==='heavy'?600:520;
    const hit = (window.hit||function(){});
    if(op && Math.abs(self.x-op.x)<80 && Math.abs(self.y-op.y)<60){ hit(self,op,power*App.rules.ratio,kb*sign(self.dir||1)); }
  }
  function defaultSpecial(self, op){
    if(self._scd&&self._scd>0) return; self._scd=.8; self.tSpecial=0.5;
    if (self.holding && typeof self.holding.onSpecial === 'function'){ self.holding.onSpecial(self, op); return; }
    const Projectile = window.Projectile || function(){};
    const spd=420*(self.spec?.stats?.speed||1)*sign(self.dir||1);
    projectiles.push(new Projectile((self.x||0)+(self.w||0)/2,(self.y||0)+20,spd,0,self,6*App.rules.ratio,520));
  }

  // snapshot controls each update so attack/special can pick a variant
  const _origUpdate = F.prototype.update;
  F.prototype.update = function(dt, controls){
    this._controlsSnapshot = controls ? JSON.parse(JSON.stringify(controls)) : null;
    return _origUpdate ? _origUpdate.apply(this, arguments) : undefined;
  };

  // variant-aware attack/special
  F.prototype.attack = function(op){
    const controls = this._controlsSnapshot || {};
    if(this._cooldown && this._cooldown>0) return;
    this._cooldown=0.25; this.tAttack=0.28;
    const mv = this.spec?.moves?.attack;
    const key = variantFrom(this, controls);
    if (mv && typeof mv === 'object' && typeof mv[key] === 'function') return mv[key](this, op);
    if (typeof mv === 'function') return mv(this, op);
    if (this.holding && typeof this.holding.onAttack === 'function') return this.holding.onAttack(this, op);
    return defaultAttack(this, op);
  };

  F.prototype.special = function(op){
    const controls = this._controlsSnapshot || {};
    if(this._scd && this._scd>0) return;
    this._scd=.8; this.tSpecial=0.5;
    const mv = this.spec?.moves?.special;
    const key = variantFrom(this, controls);
    if (mv && typeof mv === 'object' && typeof mv[key] === 'function') return mv[key](this, op);
    if (typeof mv === 'function') return mv(this, op);
    if (this.holding && typeof this.holding.onSpecial === 'function') return this.holding.onSpecial(this, op);
    return defaultSpecial(this, op);
  };

  // --- helper hooks from your game (be tolerant if absent) ---
  const dashHit = window.dashHit || function(){};
  const fireFan = window.fireFan || function(){};
  const addHitbox = window.addHitbox || function(){};
  const shake = window.shake || function(){};
  const BouncyProjectile = window.BouncyProjectile || function(){};

  // simple anim maps (optional)
  const fastAnim  = { attack:[12,20], special:[12,20], run:[10,22] };
  const heavyAnim = { attack:[10,14], special:[10,14], run:[8,14]  };
  const magicAnim = { attack:[12,16], special:[14,18], run:[8,16]  };

  // ======== Character-themed movesets (examples) ========
  // Base archetypes
  setMoves('bruiser', {
    anim: heavyAnim,
    attack: {
      side:   (s,o)=>{ dashHit(s, s.w+42, s.h, 10, 660, 0.16); shake(4,180); },
      up:     (s,o)=>{ addHitbox(s,-10,-80,s.w+20,80, 8*App.rules.ratio,600,0, .14); },
      down:   (s,o)=>{ addHitbox(s,-16,s.h-18,s.w+64,24, 12*App.rules.ratio,720,0, .16); shake(6,200); },
      aerial: (s,o)=>{ dashHit(s, s.w+34, s.h-10, 9, 600, 0.14); }
    },
    special: {
      side:   (s,o)=>{ s._scd=1.0; s.tSpecial=.5; dashHit(s, s.w+70, s.h, 14, 720, 0.20); shake(8,260); },
      up:     (s,o)=>{ s._scd=1.1; s.tSpecial=.55; s.vy = -720; addHitbox(s,-6,-80,s.w+12,90, 10*App.rules.ratio, 520, -100, .20); },
      down:   (s,o)=>{ s._scd=1.2; s.tSpecial=.6; addHitbox(s,-20,s.h-24,s.w+70,28, 16*App.rules.ratio,760,0,.2); shake(10,300); },
      aerial: (s,o)=>{ s._scd=.9; s.tSpecial=.45; addHitbox(s,-14,s.h-14,s.w+42,20, 11*App.rules.ratio,640,0,.14); }
    }
  });

  setMoves('ninja', {
    anim: fastAnim,
    attack: {
      side:   (s,o)=>{ dashHit(s, s.w+28, s.h-10, 7, 560, 0.12); },
      up:     (s,o)=>{ addHitbox(s, -6, -84, s.w+12, 84, 6*App.rules.ratio, 540, 0, .10); },
      down:   (s,o)=>{ addHitbox(s, -4, s.h-8, s.w+8, 18, 8*App.rules.ratio, 620, 0, .10); },
      aerial: (s,o)=>{ dashHit(s, s.w+60, s.h-8, 8, 600, 0.12); }
    },
    special: {
      side:   (s,o)=>{ s._scd=.9; s.tSpecial=.45; s.vx = 980*(s.dir||1); dashHit(s, s.w+72, s.h-8, 10, 660, 0.18); },
      up:     (s,o)=>{ s._scd=1.0; s.tSpecial=.5; s.vy=-840; addHitbox(s,-8,-90,s.w+16,90,9*App.rules.ratio,520,0,.18); },
      down:   (s,o)=>{ s._scd=1.0; s.tSpecial=.5; addHitbox(s,-60,-12,120,30,7*App.rules.ratio,520,0,.12); },
      aerial: (s,o)=>{ s._scd=.9; s.tSpecial=.45; addHitbox(s,-10,s.h-14,s.w+20,16,9*App.rules.ratio,600,0,.12); }
    }
  });

  setMoves('gunner', {
    anim: { attack:[12,18], special:[12,20], run:[12,18] },
    attack: {
      side:   (s,o)=>{ const P=window.Projectile; if(!P) return; projectiles.push(new P(s.x+s.w/2, s.y+20, 640*(s.dir||1), 0, s, 5*App.rules.ratio, 520)); },
      up:     (s,o)=>{ const P=window.Projectile; if(!P) return; projectiles.push(new P(s.x+s.w/2, s.y+10, 0, -700, s, 4*App.rules.ratio, 480)); },
      down:   (s,o)=>{ fireFan(s, 2, 18, 560, 4); },
      aerial: (s,o)=>{ const P=window.Projectile; if(!P) return; projectiles.push(new P(s.x+s.w/2, s.y+22, 720*(s.dir||1), 40, s, 5*App.rules.ratio, 520)); }
    },
    special: {
      side:   (s,o)=>{ s._scd=.85; s.tSpecial=.45; fireFan(s, 3, 10, 600, 5); },
      up:     (s,o)=>{ s._scd=1.0; s.tSpecial=.5; fireFan(s, 5, 60, 540, 4); },
      down:   (s,o)=>{ s._scd=1.0; s.tSpecial=.5; const P=window.Projectile; if(!P) return; const pr=new P(s.x+s.w/2,s.y+20, 520*(s.dir||1), 0, s, 2*App.rules.ratio, 280); pr.onHit=(t)=>{ t.buff=t.buff||{}; t.buff.slow=Math.max(t.buff.slow||0,1.5); }; projectiles.push(pr); },
      aerial: (s,o)=>{ s._scd=.9; s.tSpecial=.45; fireFan(s, 4, 24, 620, 4); }
    }
  });

  setMoves('mage', {
    anim: magicAnim,
    attack: {
      side:   (s,o)=>{ fireFan(s, 3, 30, 460, 4); },
      up:     (s,o)=>{ fireFan(s, 4, 80, 440, 3); },
      down:   (s,o)=>{ const P=window.Projectile; if(!P) return; const pr=new P(s.x+s.w/2, s.y+18, 520*(s.dir||1), 0, s, 2*App.rules.ratio, 320); pr.onHit=(t)=>{ t.buff=t.buff||{}; t.buff.slow=Math.max(t.buff.slow||0,1.6); }; projectiles.push(pr); },
      aerial: (s,o)=>{ fireFan(s, 3, 20, 500, 4); }
    },
    special: {
      side:   (s,o)=>{ s._scd=1.0; s.tSpecial=.5; const P=window.Projectile; if(!P) return; const pr=new P(s.x+s.w/2, s.y+18, 540*(s.dir||1), -30, s, 7*App.rules.ratio, 520); pr.onHit=(t)=>{ t.tHitstun=Math.max(t.tHitstun||0,0.6); t.buff=t.buff||{}; t.buff.slow=Math.max(t.buff.slow||0,2.0); }; projectiles.push(pr); },
      up:     (s,o)=>{ s._scd=1.1; s.tSpecial=.55; fireFan(s, 6, 100, 520, 4); },
      down:   (s,o)=>{ s._scd=1.1; s.tSpecial=.55; addHitbox(s,-18,s.h-22,s.w+36,20,10*App.rules.ratio,540,0,.16); },
      aerial: (s,o)=>{ s._scd=1.0; s.tSpecial=.5; fireFan(s, 5, 60, 560, 4); }
    }
  });

  // Sonic crew
  setMoves('sonic', {
    attack: {
      side:(s,o)=>{ dashHit(s, s.w+46, s.h-10, 7, 600, 0.16); },
      up:(s,o)=>{ s.vy=-900; addHitbox(s,-8,-90,s.w+16,90,8*App.rules.ratio,600,0,.16); },
      down:(s,o)=>{ addHitbox(s,-50,-10,100,26,8*App.rules.ratio,600,0,.12); },
      aerial:(s,o)=>{ dashHit(s, s.w+70, s.h-8, 8, 620, 0.14); }
    },
    special: {
      side:(s,o)=>{ s._scd=.9; s.tSpecial=.45; s.vx = 1000*(s.dir||1); dashHit(s, s.w+80, s.h-8, 10, 660, 0.18); },
      up:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; s.vy = -960; addHitbox(s,-8,-100,s.w+16,100,10*App.rules.ratio,680,0,.2); },
      down:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; addHitbox(s,-60,-12,120,32,9*App.rules.ratio,640,0,.16); },
      aerial:(s,o)=>{ s._scd=.9; s.tSpecial=.45; dashHit(s, s.w+90, s.h-8, 11, 680, 0.18); }
    }
  });

  setMoves('tails', {
    attack: { side:(s,o)=>fireFan(s,2,20,420,5), up:(s,o)=>fireFan(s,3,40,440,5), down:(s,o)=>fireFan(s,2,16,420,4), aerial:(s,o)=>fireFan(s,2,24,460,5) },
    special:{ side:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; fireFan(s,3,40,520,6); },
              up:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; s.vy=-800; fireFan(s,4,60,520,5); },
              down:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; fireFan(s,6,70,500,4); },
              aerial:(s,o)=>{ s._scd=.95; s.tSpecial=.48; fireFan(s,4,50,540,5); } }
  });

  setMoves('knuckles', {
    attack: { side:(s,o)=>dashHit(s,s.w+30,s.h-10,10,640,0.14),
             up:(s,o)=>addHitbox(s,-10,-86,s.w+20,86,10*App.rules.ratio,620,0,.16),
             down:(s,o)=>addHitbox(s,-18,s.h-18,s.w+36,22,11*App.rules.ratio,660,0,.16),
             aerial:(s,o)=>dashHit(s,s.w+40,s.h-8,9,620,0.14)
    },
    special: { side:(s,o)=>{ s._scd=1.1; s.tSpecial=.5; addHitbox(s,-20,s.h-24,s.w+40,28,14*App.rules.ratio,700,0,.18); shake(6,250); },
               up:(s,o)=>{ s._scd=1.2; s.tSpecial=.55; s.vy=-840; addHitbox(s,-8,-96,s.w+16,96,12*App.rules.ratio,700,0,.2); },
               down:(s,o)=>{ s._scd=1.2; s.tSpecial=.55; addHitbox(s,-24,s.h-20,s.w+60,30,16*App.rules.ratio,760,0,.2); },
               aerial:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; dashHit(s,s.w+80,s.h,12,680,0.18); } }
  });

  setMoves('amy', {
    attack: { side:(s,o)=>dashHit(s,s.w+50,s.h-8,9,600,0.16),
             up:(s,o)=>addHitbox(s,-6,-84,s.w+12,84,8*App.rules.ratio,560,0,.14),
             down:(s,o)=>addHitbox(s,-18,s.h-16,s.w+36,22,10*App.rules.ratio,620,0,.14),
             aerial:(s,o)=>dashHit(s,s.w+64,s.h,10,640,0.16) },
    special:{ side:(s,o)=>{ s._scd=1.0; s.tSpecial=.6; dashHit(s,s.w+70,s.h,12,650,0.2); },
              up:(s,o)=>{ s._scd=1.1; s.tSpecial=.55; s.vy=-820; addHitbox(s,-8,-92,s.w+16,92,11*App.rules.ratio,640,0,.18); },
              down:(s,o)=>{ s._scd=1.1; s.tSpecial=.55; addHitbox(s,-28,s.h-18,s.w+56,24,14*App.rules.ratio,680,0,.18); },
              aerial:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; dashHit(s,s.w+80,s.h,12,660,0.18); } }
  });

  setMoves('shadow', {
    attack: { side:(s,o)=>dashHit(s,s.w+40,s.h-8,8,600,0.14),
             up:(s,o)=>addHitbox(s,-6,-90,s.w+12,90,9*App.rules.ratio,620,0,.16),
             down:(s,o)=>addHitbox(s,-50,-8,100,24,8*App.rules.ratio,620,0,.12),
             aerial:(s,o)=>dashHit(s,s.w+70,s.h-10,10,640,0.16) },
    special:{ side:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; s.vx=1000*(s.dir||1); dashHit(s,s.w+90,s.h-10,11,680,0.18); },
              up:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; s.vy=-920; addHitbox(s,-8,-96,s.w+16,96,11*App.rules.ratio,660,0,.2); },
              down:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; addHitbox(s,-64,-10,128,28,10*App.rules.ratio,660,0,.16); },
              aerial:(s,o)=>{ s._scd=.95; s.tSpecial=.48; dashHit(s,s.w+96,s.h-8,11,700,0.2); } }
  });

  // Undertale + Deltarune
  setMoves('frisk', {
    attack:  { side:(s,o)=>dashHit(s,s.w+28,s.h-10,8,560,0.14),
               up:(s,o)=>addHitbox(s,-6,-78,s.w+12,78,7*App.rules.ratio,540,0,.12),
               down:(s,o)=>addHitbox(s,-6,s.h-8,s.w+12,18,8*App.rules.ratio,580,0,.12),
               aerial:(s,o)=>dashHit(s,s.w+36,s.h-8,8,560,0.14) },
    special: { side:(s,o)=>fireFan(s,3,20,500,6),
               up:(s,o)=>fireFan(s,5,70,520,5),
               down:(s,o)=>{ const P=window.Projectile; if(!P) return; const pr=new P(s.x+s.w/2,s.y+18,540*(s.dir||1),0,s,2*App.rules.ratio,320); pr.onHit=(t)=>{ t.buff=t.buff||{}; t.buff.slow=Math.max(t.buff.slow||0,1.5); }; projectiles.push(pr); },
               aerial:(s,o)=>fireFan(s,4,30,540,5) }
  });

  setMoves('sans', {
    attack:  { side:(s,o)=>dashHit(s,s.w+22,s.h-10,7,520,0.12),
               up:(s,o)=>fireFan(s,3,50,520,4),
               down:(s,o)=>fireFan(s,2,26,500,4),
               aerial:(s,o)=>fireFan(s,4,24,560,4) },
    special: { side:(s,o)=>fireFan(s,6,30,560,4),
               up:(s,o)=>fireFan(s,8,90,540,4),
               down:(s,o)=>{ const P=window.Projectile; if(!P) return; const pr=new P(s.x+s.w/2,s.y+20,560*(s.dir||1),0,s,2*App.rules.ratio,280); pr.onHit=(t)=>{ t.buff=t.buff||{}; t.buff.slow=Math.max(t.buff.slow||0,1.8); }; projectiles.push(pr); },
               aerial:(s,o)=>fireFan(s,6,60,560,4) }
  });

  setMoves('undyne', {
    attack:  { side:(s,o)=>dashHit(s,s.w+34,s.h-8,9,600,0.14),
               up:(s,o)=>fireFan(s,3,20,640,6),
               down:(s,o)=>addHitbox(s,-12,s.h-16,s.w+24,20,10*App.rules.ratio,620,0,.14),
               aerial:(s,o)=>dashHit(s,s.w+44,s.h-8,9,620,0.14) },
    special: { side:(s,o)=>fireFan(s,5,20,640,6),
               up:(s,o)=>fireFan(s,7,80,600,5),
               down:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; addHitbox(s,-24,s.h-18,s.w+48,26,14*App.rules.ratio,680,0,.18); },
               aerial:(s,o)=>fireFan(s,6,40,640,5) }
  });

  setMoves('kris', {
    attack:  { side:(s,o)=>dashHit(s,s.w+30,s.h-8,8,600,0.14),
               up:(s,o)=>addHitbox(s,-8,-86,s.w+16,86,8*App.rules.ratio,580,0,.14),
               down:(s,o)=>addHitbox(s,-8,s.h-10,s.w+16,20,9*App.rules.ratio,600,0,.14),
               aerial:(s,o)=>dashHit(s,s.w+42,s.h-8,9,620,0.14) },
    special: { side:(s,o)=>dashHit(s,s.w+70,s.h-8,10,640,0.18),
               up:(s,o)=>{ s.vy=-820; addHitbox(s,-8,-92,s.w+16,92,10*App.rules.ratio,640,0,.18); },
               down:(s,o)=>{ addHitbox(s,-20,s.h-16,s.w+40,24,12*App.rules.ratio,680,0,.18); },
               aerial:(s,o)=>dashHit(s,s.w+80,s.h-8,11,660,0.2) }
  });

  setMoves('susie', {
    attack:  { side:(s,o)=>dashHit(s,s.w+46,s.h,10,660,0.16),
               up:(s,o)=>addHitbox(s,-12,-90,s.w+24,90,10*App.rules.ratio,620,0,.18),
               down:(s,o)=>addHitbox(s,-18,s.h-18,s.w+36,22,12*App.rules.ratio,660,0,.16),
               aerial:(s,o)=>dashHit(s,s.w+58,s.h,10,680,0.18) },
    special: { side:(s,o)=>{ s._scd=1.1; s.tSpecial=.5; dashHit(s, s.w+80, s.h, 13, 700, 0.2); },
               up:(s,o)=>{ s._scd=1.2; s.tSpecial=.55; s.vy=-860; addHitbox(s,-10,-96,s.w+20,96,12*App.rules.ratio,700,0,.2); },
               down:(s,o)=>{ s._scd=1.2; s.tSpecial=.55; addHitbox(s,-24,s.h-20,s.w+60,30,16*App.rules.ratio,760,0,.2); },
               aerial:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; dashHit(s,s.w+90,s.h,12,700,0.2); } }
  });

  setMoves('ralsei', {
    attack:  { side:(s,o)=>dashHit(s,s.w+24,s.h-10,7,540,0.14),
               up:(s,o)=>fireFan(s,4,60,520,5),
               down:(s,o)=>addHitbox(s,-10,s.h-14,s.w+20,20,9*App.rules.ratio,600,0,.14),
               aerial:(s,o)=>fireFan(s,3,30,540,5) },
    special: { side:(s,o)=>fireFan(s,4,50,520,6),
               up:(s,o)=>fireFan(s,6,90,520,5),
               down:(s,o)=>{ s._scd=1.0; s.tSpecial=.5; addHitbox(s,-18,s.h-18,s.w+36,24,10*App.rules.ratio,620,0,.16); },
               aerial:(s,o)=>fireFan(s,5,60,560,5) }
  });

  setMoves('jevil', {
    attack:  { side:(s,o)=>{ const P=BouncyProjectile; if(!P) return; const vx=600*(s.dir||1); projectiles.push(new P(s.x+s.w/2,s.y+20,vx,-80,s,6*App.rules.ratio,520)); },
               up:(s,o)=>{ const P=BouncyProjectile; if(!P) return; const vx=520*(s.dir||1); projectiles.push(new P(s.x+s.w/2,s.y+20, vx,-200,s,6*App.rules.ratio,520)); },
               down:(s,o)=>{ const P=BouncyProjectile; if(!P) return; const vx=520*(s.dir||1); projectiles.push(new P(s.x+s.w/2,s.y+20, vx, 200,s,6*App.rules.ratio,520)); },
               aerial:(s,o)=>{ const P=BouncyProjectile; if(!P) return; const vx=680*(s.dir||1); projectiles.push(new P(s.x+s.w/2,s.y+18, vx,-140,s,7*App.rules.ratio,540)); } },
    special: { side:(s,o)=>{ const P=BouncyProjectile; if(!P) return; projectiles.push(new P(s.x+s.w/2,s.y+20,520*(s.dir||1),-200,s,7*App.rules.ratio,540)); projectiles.push(new P(s.x+s.w/2,s.y+20,-520*(s.dir||1),-120,s,7*App.rules.ratio,540)); },
               up:(s,o)=>{ fireFan(s,7,120,560,4); },
               down:(s,o)=>{ addHitbox(s,-60, -10, 120, 28, 10*App.rules.ratio, 700, 0, .16); },
               aerial:(s,o)=>{ fireFan(s,8,100,600,4); } }
  });

  setMoves('spamton', {
    attack:  { side:(s,o)=>fireFan(s,3,24,540,4),
               up:(s,o)=>fireFan(s,4,60,540,4),
               down:(s,o)=>fireFan(s,2,20,520,4),
               aerial:(s,o)=>fireFan(s,5,40,560,4) },
    special: { side:(s,o)=>fireFan(s,6,60,580,4),
               up:(s,o)=>fireFan(s,8,100,560,4),
               down:(s,o)=>{ const P=window.Projectile; if(!P) return; const pr=new P(s.x+s.w/2,s.y+20, 560*(s.dir||1), 0, s, 1*App.rules.ratio, 240); pr.onHit=(t)=>{ t.buff=t.buff||{}; t.buff.slow=Math.max(t.buff.slow||0,1.4); }; projectiles.push(pr); },
               aerial:(s,o)=>fireFan(s,6,80,580,4) }
  });

  console.log('[smashlike-extended-moves] loaded: directional specials & aerial variants enabled.');
})();



/* ==========================================================================
 * Procedural Character Sprite Overlays (single-file mode)
 * Forces per-character frame generation on the spot—no portraits/sheets.
 * This augments the existing runtime with character-aware renderers.
 * Place at END of file. It depends on: ctx, ANIMS, POSES, FW/FH, CHARACTERS.
 * ========================================================================== */

(function(){
  if (typeof window === 'undefined') return;
  const gDoc = (typeof document!=='undefined') ? document : null;

  // Helper to draw a filled triangle
  function tri(g, x1,y1,x2,y2,x3,y3, fill){
    g.fillStyle = fill; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.lineTo(x3,y3); g.closePath(); g.fill();
  }
  // Helper to draw a tiny outlined circle
  function dot(g, x,y,r, fill){
    g.fillStyle = fill; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }

  function rgbaStr(arr){ return `rgba(${arr[0]},${arr[1]},${arr[2]},${(arr[3]||255)/255})`; }

  // Default blocky body (already in file), expose it here too
  const __orig_drawFigure = typeof drawFigure === 'function' ? drawFigure : null;

  // Tiny kit overlay brushes to make silhouettes recognizable
  const brushes = {
    shoes(g, cx, baseY, dir, colors){
      // simple shoes: two rectangles
      g.fillStyle = colors.main || '#e11d48';
      g.fillRect(cx - 6*dir, baseY, 8, 3);
      g.fillRect(cx + -1*dir, baseY, 8, 3);
      if (colors.stripe){
        g.fillStyle = colors.stripe;
        g.fillRect(cx - 6*dir, baseY+1, 8, 1);
        g.fillRect(cx + -1*dir, baseY+1, 8, 1);
      }
    },
    glove(g, x,y, w,h){ g.fillStyle='#f3f4f6'; g.fillRect(x,y,w,h); },
    scarf(g, cx, cy, color){ g.fillStyle=color; g.fillRect(cx-4, cy, 8, 2); g.fillRect(cx+2, cy+2, 2, 6); },
    dress(g, cx, topY, color){ g.fillStyle=color; g.fillRect(cx-5, topY, 10, 7); },
    horns(g, hx, hy, color){ g.fillStyle=color; tri(g, hx-4,hy-4, hx-1,hy-6, hx-1,hy-1, color); tri(g, hx+4,hy-4, hx+1,hy-6, hx+1,hy-1, color); },
    quill(g, x,y, len, tilt, color){ g.save(); g.translate(x,y); g.rotate(tilt); tri(g, 0,0, -len, -2, -len, 2, color); g.restore(); },
  };

  // Character-aware overlay after drawing the default body.
  // pose carries key points; we rely on head center (hx,hy), torso, arms/legs endpoints.
  function drawCharacter(g, id, pal, pose, dir){
    // Fallback to base body if renderer not specialized
    if (!__orig_drawFigure) return;

    // draw base
    __orig_drawFigure(g, pal, pose);

    const primary = rgbaStr(pal[0]);
    const secondary = rgbaStr(pal[1]);
    const accent = rgbaStr(pal[2]);

    // Common anchors
    const [tx1,ty1,tx2,ty2] = pose.torso;
    const cx = (tx1+tx2)/2;
    const footY = ty1+8.5;
    const [hx,hy] = pose.head;

    // Switch by id for simple, readable silhouettes
    switch(String(id||'')){
      // ===== SONIC CREW =====
      case 'sonic': {
        // Blue quills
        const blue = primary;
        brushes.quill(g, hx-1, hy-1, 10, -0.25, blue);
        brushes.quill(g, hx-2, hy+1, 12, -0.10, blue);
        brushes.quill(g, hx-3, hy+3, 14, 0.02,  blue);
        // Ears
        tri(g, hx-4,hy-4, hx-2,hy-6, hx-1,hy-3, '#0a0a0a');
        tri(g, hx+4,hy-4, hx+2,hy-6, hx+1,hy-3, '#0a0a0a');
        // Shoes red + white stripe
        brushes.shoes(g, cx, footY, dir, { main:'#ef4444', stripe:'#f8fafc' });
        break;
      }
      case 'tails': {
        // Twin tails (orange), slightly spinning with time by arms
        g.fillStyle = primary;
        tri(g, cx-2,ty1+6, cx-10,ty1+10, cx-4,ty1+12, primary);
        tri(g, cx+2,ty1+6, cx+10,ty1+10, cx+4,ty1+12, primary);
        // White tip
        g.fillStyle = '#f8fafc'; g.fillRect(cx-11, ty1+10, 3,2); g.fillRect(cx+8, ty1+10, 3,2);
        // Shoes
        brushes.shoes(g, cx, footY, dir, { main:'#ef4444', stripe:'#f8fafc' });
        // Gloves
        brushes.glove(g, cx-6, ty1+4, 3,3); brushes.glove(g, cx+3, ty1+4, 3,3);
        break;
      }
      case 'knuckles': {
        // Dread-like quills (red)
        const red = primary;
        brushes.quill(g, hx-2, hy+0, 8, 0.04, red);
        brushes.quill(g, hx-1, hy+2, 9, 0.12, red);
        brushes.quill(g, hx-3, hy+1, 7, -0.1, red);
        // Gloves (spiked)
        brushes.glove(g, cx-6, ty1+4, 4,3); brushes.glove(g, cx+2, ty1+4, 4,3);
        dot(g, cx-4, ty1+5, 1.2, '#e5e7eb'); dot(g, cx+6, ty1+5, 1.2, '#e5e7eb');
        // Shoes green base
        brushes.shoes(g, cx, footY, dir, { main:'#16a34a', stripe:'#064e3b' });
        break;
      }
      case 'amy': {
        // Headband spike + dress
        tri(g, hx-3,hy-4, hx,hy-7, hx+3,hy-4, '#ef4444');
        brushes.dress(g, cx, ty1+2, '#f472b6');
        brushes.shoes(g, cx, footY, dir, { main:'#ef4444', stripe:'#fde68a' });
        break;
      }
      case 'shadow': {
        // Longer back quills and red accents
        brushes.quill(g, hx-2, hy, 12, 0.02, '#111827');
        brushes.quill(g, hx-3, hy+2, 14, 0.08, '#111827');
        // Red stripes
        tri(g, hx-4, hy-1, hx-7, hy, hx-4, hy+1, '#ef4444');
        tri(g, hx+4, hy-1, hx+7, hy, hx+4, hy+1, '#ef4444');
        brushes.shoes(g, cx, footY, dir, { main:'#111827', stripe:'#ef4444' });
        break;
      }

      // ===== UNDERTALE =====
      case 'frisk': {
        // Blue sweater w/ purple stripe
        g.fillStyle = '#60a5fa'; g.fillRect(cx-3, ty1+1, 6, 2);
        g.fillStyle = '#a78bfa'; g.fillRect(cx-3, ty1+3, 6, 2);
        break;
      }
      case 'toriel': {
        brushes.horns(g, hx, hy-1, '#e5e7eb');
        g.fillStyle = '#7c3aed'; g.fillRect(cx-3, ty1+1, 6, 6);
        break;
      }
      case 'papyrus': {
        g.fillStyle = '#ef4444'; g.fillRect(cx-3, ty1+1, 6, 2);
        brushes.scarf(g, cx, ty1, '#ef4444');
        break;
      }
      case 'sans': {
        // Hoodie outline
        g.fillStyle = '#e5e7eb'; g.fillRect(cx-3, ty1+1, 6, 2);
        break;
      }
      case 'undyne': {
        g.fillStyle = '#60a5fa'; g.fillRect(cx-3, ty1+1, 6, 6);
        tri(g, hx+4, hy-2, hx+7, hy-4, hx+5, hy-1, '#ef4444'); // eyepatch hint
        break;
      }
      case 'mettaton':
      case 'mettaton_ex': {
        g.fillStyle = '#f472b6'; g.fillRect(cx-3, ty1+1, 6, 2);
        g.fillStyle = '#111827'; g.fillRect(cx-1, ty1+3, 2, 2);
        break;
      }
      case 'asgore': {
        brushes.horns(g, hx, hy-1, '#fde68a');
        g.fillStyle = '#f59e0b'; g.fillRect(cx-3, ty1+1, 6, 6);
        break;
      }

      // ===== DELTARUNE =====
      case 'kris': { g.fillStyle = '#60a5fa'; g.fillRect(cx-3, ty1+1, 6, 2); break; }
      case 'susie': { g.fillStyle = '#a78bfa'; g.fillRect(cx-3, ty1+1, 6, 6); break; }
      case 'ralsei': { brushes.scarf(g, cx, ty1+2, '#10b981'); break; }
      case 'jevil': { g.fillStyle = '#a78bfa'; g.fillRect(cx-3, ty1+1, 6, 6); break; }
      case 'spade_king': { g.fillStyle = '#111827'; g.fillRect(cx-3, ty1+1, 6, 6); break; }
      case 'noelle': { g.fillStyle = '#93c5fd'; g.fillRect(cx-3, ty1+1, 6, 6); break; }
      case 'spamton': { g.fillStyle = '#e5e7eb'; g.fillRect(cx-3, ty1+1, 6, 6); break; }
      case 'tenna': { g.fillStyle = '#06b6d4'; g.fillRect(cx-3, ty1+1, 6, 6); break; }
      case 'knight': { g.fillStyle = '#9ca3af'; g.fillRect(cx-3, ty1+1, 6, 6); break; }
      case 'gerson': { g.fillStyle = '#22c55e'; g.fillRect(cx-3, ty1+1, 6, 6); break; }

      default: {
        // No extra overlay
      }
    }
  }

  // Make an animated sheet for a specific character id using the global POSES/ANIMS
  function makeSheetForCharacter(charId, colors, animOverride){
    const pal=[
      (typeof rgba === 'function' ? rgba(colors.body) : [255,255,255,255]),
      (typeof rgba === 'function' ? rgba(colors.outline) : [200,200,200,255]),
      (typeof rgba === 'function' ? rgba(colors.accent||'#ffffff') : [255,255,255,255])
    ];
    const mapped = ANIMS.map(([name,defFrames,defFps])=>{
      const ov = animOverride && animOverride[name];
      return [name, ov ? ov[0] : defFrames, ov ? ov[1] : defFps];
    });
    const rows=mapped.length, cols=Math.max(...mapped.map(a=>a[1]));
    const sheet = (gDoc ? gDoc.createElement('canvas') : new OffscreenCanvas(cols*FW, rows*FH));
    sheet.width = cols*FW; sheet.height = rows*FH;
    const g = (sheet.getContext ? sheet.getContext('2d') : sheet.getContext('2d')); // OffscreenCanvas compat
    g.imageSmoothingEnabled = false;
    const meta={ frameSize:[FW,FH], anims:{} };

    mapped.forEach(([name,frames,fps],r)=>{
      meta.anims[name]={row:r,frames,fps};
      for(let i=0;i<frames;i++){
        const t=i/frames; const pose = POSES[name](t);
        g.save(); g.translate(i*FW, r*FH);
        // Render: base + character overlay
        drawCharacter(g, charId, pal, pose, 1);
        // Simple effect cue for heavy actions
        if(['attack','special','fs'].includes(name)){
          g.fillStyle = rgbaStr(pal[2]);
          g.globalAlpha = 0.6 * (1 - i/frames);
          g.fillRect(12,7,3,2);
          g.globalAlpha = 1.0;
        }
        g.restore();
      }
    });
    return {sheet, meta};
  }

  // Monkey-patch sprite builder to ALWAYS use our character-aware procedural sheets
  if (typeof buildSpritesForSelection === 'function'){
    window._orig_buildSpritesForSelection = buildSpritesForSelection;
    window.buildSpritesForSelection = async function(){
      const p1Char=(App.p1.char||CHARACTERS[0]);
      const p2Char=(App.p2.char||CHARACTERS[1]);
      async function buildFor(char, side){
        const id = char.id + '_' + side;
        const colors = char.alts[(side==='p1'?(App.p1.alt||0):(App.p2.alt||0))].colors;
        const {sheet,meta} = makeSheetForCharacter(char.id, colors, char.anim||null);
        SPRITES[id]=sheet; MANIFEST[id]={...meta}; return id;
      }
      const [p1Id, p2Id] = await Promise.all([ buildFor(p1Char,'p1'), buildFor(p2Char,'p2') ]);
      return {p1Id,p2Id};
    };
  }

  // Also ensure runtime ignores portraits/sheets (belt + suspenders)
  try{
    window.USE_PORTRAIT_FALLBACK = false;
    window.FORCE_PROCEDURAL = true;
  }catch{}
})();
(function(){
  if (typeof window === 'undefined') return;
  if (!window.canvas || !window.ctx) { console.warn('[proc-variants] canvas not ready yet'); }

  // --------- 1) Global switches (force procedural) ----------
  try{
    window.USE_PORTRAIT_FALLBACK = false;
    window.FORCE_PROCEDURAL = true;
  }catch{}

  // --------- 2) Extend animation list with variants ----------
  const BASE = window.ANIMS || [
    ['idle',16,12], ['walk',16,14], ['run',16,20],
    ['jump',12,16], ['aerial',12,14],
    ['attack',14,20], ['special',14,20],
    ['hitstun',10,18], ['ko',12,14], ['fs',16,22]
  ];
  const BASE_NO_GENERIC = BASE.filter(([n])=> n!=='attack' && n!=='special');

  const VARIANT_ROWS = [
    ['attack_side',  14, 20],
    ['attack_up',    14, 20],
    ['attack_down',  14, 20],
    ['attack_aerial',14, 20],
    ['special_side', 14, 20],
    ['special_up',   14, 20],
    ['special_down', 14, 20],
    ['special_aerial',14,20],
  ];
  const EXT_ANIMS = [...BASE_NO_GENERIC, ...VARIANT_ROWS];
  window.ANIMS = EXT_ANIMS;

  // --------- 3) Fighter animation dispatch (variant-aware) ----------
  const F = window.Fighter;
  if (!F){ console.warn('[proc-variants] Fighter missing; load this after game.js'); return; }

  function variantFrom(self, controls){
    if (!self.onGround) return 'aerial';
    if (controls && controls.up)   return 'up';
    if (controls && controls.down) return 'down';
    return 'side';
  }

  // Snapshot controls each frame so actions can read intent
  const _origUpdate = F.prototype.update;
  F.prototype.update = function(dt, controls){
    this._controlsSnapshot = controls ? {...controls} : null;
    const ret = _origUpdate.apply(this, arguments);

    // Prefer specific variant rows while attack/special timers are active
    const meta = (window.MANIFEST && window.MANIFEST[this.spriteKey]) ? window.MANIFEST[this.spriteKey] : null;
    const has = (name)=> meta && meta.anims && meta.anims[name];

    if(this.tKO>0 && has('ko'))                this.anim='ko';
    else if(this.fsActive && has('fs'))        this.anim='fs';
    else if(this.tHitstun>0 && has('hitstun')) this.anim='hitstun';
    else if(this.tAttack>0){
      const av = this._attackAnim || 'attack_side';
      this.anim = has(av) ? av : (has('attack_side')?'attack_side':'attack');
    } else if(this.tSpecial>0){
      const sv = this._specialAnim || 'special_side';
      this.anim = has(sv) ? sv : (has('special_side')?'special_side':'special');
    } else {
      const spd=Math.abs(this.vx);
      if(!this.onGround && this.vy<0 && has('jump'))        this.anim='jump';
      else if(!this.onGround && this.vy>=0 && has('aerial')) this.anim='aerial';
      else if(this.onGround && spd>280 && has('run'))       this.anim='run';
      else if(this.onGround && spd>15 && has('walk'))       this.anim='walk';
      else                                                  this.anim='idle';
    }
    return ret;
  };
  const _origAttack = F.prototype.attack;
  F.prototype.attack = function(op){
    const c = this._controlsSnapshot || {};
    this._attackAnim = 'attack_' + variantFrom(this, c);
    return _origAttack.apply(this, arguments);
  };
  const _origSpecial = F.prototype.special;
  F.prototype.special = function(op){
    const c = this._controlsSnapshot || {};
    this._specialAnim = 'special_' + variantFrom(this, c);
    return _origSpecial.apply(this, arguments);
  };

  // --------- 4) Procedural sheet generator with accents ----------
  const FW = window.FW || 16, FH = window.FH || 16;
  const ANIMS = window.ANIMS;

  // Utility draw
  function pix(g,x,y,w,h,fill){ g.fillStyle=fill; g.fillRect(Math.round(x),Math.round(y),w,h); }
  function seg(g, x1,y1,x2,y2,w,fill){
    const dx=x2-x1, dy=y2-y1, len=Math.max(1,Math.hypot(dx,dy)), steps=Math.ceil(len/1.2);
    g.fillStyle=fill;
    for(let i=0;i<=steps;i++){ const t=i/steps, x=x1+dx*t, y=y1+dy*t; g.fillRect(Math.round(x-w/2),Math.round(y-w/2),w,w); }
  }

  // Base poses from game.js if present
  const POSES = window.POSES || {};
  function basePose(name, t){
    if (name==='idle'   && POSES.idle)   return POSES.idle(t);
    if (name==='walk'   && POSES.walk)   return POSES.walk(t);
    if (name==='run'    && POSES.run)    return POSES.run(t);
    if (name==='jump'   && POSES.jump)   return POSES.jump(t);
    if (name==='aerial' && POSES.aerial) return POSES.aerial(t);
    if (name==='hitstun'&& POSES.hitstun)return POSES.hitstun(t);
    if (name==='ko'     && POSES.ko)     return POSES.ko(t);
    if (name==='fs'     && POSES.fs)     return POSES.fs(t);
    // fallback mini idle-ish pose
    return { torso:[8,10,8,14], head:[8,7], r_arm:[8,11,11,11], l_arm:[8,11,5,11], l_leg:[8,15,7,17], r_leg:[8,15,9,17] };
  }

  // Directional attack/special pose variants
  function poseVariant(kind, t, varKey){ // varKey: side|up|down|aerial
    const p = (kind==='attack' && window.pose_attack) ? window.pose_attack(t) :
              (kind==='special'&& window.pose_special)? window.pose_special(t) :
              basePose('aerial', t);
    const out = JSON.parse(JSON.stringify(p));
    const swing = Math.sin(Math.min(1.0,t)*Math.PI);
    function setArm(a, ang, len){
      const by=(p.torso?p.torso[1]+1:10), cx=8;
      const rx = cx + Math.cos(ang)*len;
      const ry = by + Math.sin(ang)*len;
      out[a] = [8, by, rx, ry];
    }
    if (varKey==='side'){ setArm('r_arm', -0.9 + 2.4*swing, 3.6); setArm('l_arm', 0.4 - 0.5*swing, 2.7); }
    if (varKey==='up'){   setArm('r_arm', -1.6 + 2.0*swing, 4.0); setArm('l_arm',-0.8 + 0.8*swing, 2.6); out.head[1]-=1.0; }
    if (varKey==='down'){ setArm('r_arm',  1.7 - 1.8*swing, 4.0); setArm('l_arm', 2.2 - 0.9*swing, 2.8); out.torso[1]+=0.6; }
    if (varKey==='aerial'){ setArm('r_arm', -0.5 + 2.2*swing, 3.0); setArm('l_arm', 2.6 - 1.6*swing, 2.6); }
    return out;
  }

  function drawBody(g, pal, pose){
    const skin = '#f2c68d', hair='#2d231e';
    const shirt = pal.body, pants = pal.outline, accent = pal.accent || '#ffffff';
    const [tx1,ty1,tx2,ty2]=pose.torso; const cx=(tx1+tx2)/2;
    const [hx,hy]=pose.head;

    // Hair + face
    pix(g,hx-3,hy-3,6,2,hair);
    pix(g,hx-3,hy-1,6,4,skin);
    pix(g,hx-2,hy,1,1,'#000'); pix(g,hx+1,hy,1,1,'#000');

    // Torso
    pix(g,cx-3,ty1+1,6,6,shirt);

    // Arms
    const shoulderY = ty1+3, lShoulder=cx-3, rShoulder=cx+3;
    const la=pose.l_arm, ra=pose.r_arm;
    if(la) seg(g,lShoulder,shoulderY,la[2],la[3],2,skin);
    if(ra) seg(g,rShoulder,shoulderY,ra[2],ra[3],2,skin);

    // Legs
    const hipY=ty1+7, lHip=cx-2, rHip=cx+2;
    const ll=pose.l_leg, rl=pose.r_leg;
    if(ll) seg(g,lHip,hipY,ll[2],ll[3],2,pants);
    if(rl) seg(g,rHip,hipY,rl[2],rl[3],2,pants);

    // Belt
    pix(g,cx-1,ty1+5,2,1,accent);
  }

  function drawAccents(g, charId, pal, pose, rowName){
    const [hx,hy] = pose.head || [8,7];
    const px=(x,y,w=1,h=1,c='#000')=>pix(g,x,y,w,h,c);

    switch(charId){
      case 'sonic': {
        const b = pal.body || '#1fb6ff';
        // quills
        px(hx-4,hy-2,2,1,b); px(hx-5,hy-1,3,1,b); px(hx-6,hy,4,1,b);
        px(hx+2,hy-2,2,1,b); px(hx+2,hy-1,3,1,b); px(hx+2,hy,4,1,b);
        // shoes
        const fy = Math.max((pose.l_leg&&pose.l_leg[3])||14,(pose.r_leg&&pose.r_leg[3])||14);
        px(hx-6, fy-1,3,2, '#b30000'); px(hx+3, fy-1,3,2, '#b30000');
        px(hx-6, fy-2,3,1, '#ffffff');  px(hx+3, fy-2,3,1, '#ffffff');
        if (/attack_aerial|special_aerial|aerial/.test(rowName)){ g.globalAlpha=0.25; pix(g,hx-8,hy-8,16,16,b); g.globalAlpha=1; }
        break;
      }
      case 'tails': {
        const t='#f59e0b'; px(hx-6, hy+6,3,2,t); px(hx-8, hy+7,3,2,t); px(hx+4, hy+6,3,2,t); px(hx+6, hy+7,3,2,t); break;
      }
      case 'knuckles': {
        px(hx-7, hy+5,2,2,'#ffffff'); px(hx+6, hy+5,2,2,'#ffffff');
        px(hx-6, hy+8,3,2,'#b30000'); px(hx+3, hy+8,3,2,'#b30000');
        break;
      }
      case 'amy': {
        px(hx-4, hy+4,8,2, pal.accent || '#ffd1e7'); // dress edge
        if (/attack|special/.test(rowName)){ px(hx+6, hy+2,3,3,'#ffcc00'); px(hx+9, hy+2,1,3,'#aa7700'); } // hammer hint
        break;
      }
      case 'shadow': {
        px(hx-4,hy-3,8,1,'#ff1a1a'); px(hx-5,hy-2,2,1,'#ff1a1a'); px(hx+3,hy-2,2,1,'#ff1a1a');
        px(hx-6, hy+6,2,1,'#ffd400'); px(hx+4, hy+6,2,1,'#ffd400');
        break;
      }
      // Light UNDERTALE/DELTARUNE identifiers (kept minimal, 16px vibe)
      case 'frisk':       px(hx-4, hy+3,8,1,'#7c3aed'); break;
      case 'ralsei':      px(hx-3, hy-5,6,2,'#0ea5e9'); px(hx-4, hy-7,8,2,'#0ea5e9'); break;
      case 'susie':       px(hx+5, hy-1,2,2,'#a21caf'); break;
      case 'undyne':      px(hx-5, hy-3,2,2,'#60a5fa'); break;
      case 'papyrus':     px(hx-5, hy-5,10,1,'#e11d48'); break;
      case 'sans':        px(hx-2, hy+3,4,1,'#60a5fa'); break;
      case 'asgore':      px(hx-5, hy-5,2,2,'#facc15'); px(hx+3, hy-5,2,2,'#facc15'); break;
      case 'mettaton':
      case 'mettaton_ex': px(hx+4, hy+2,3,3,'#f472b6'); break;
      case 'jevil':       px(hx-6, hy-4,3,2,'#a78bfa'); px(hx+3, hy-4,3,2,'#a78bfa'); break;
      case 'spade_king':  px(hx-5, hy-5,10,3,'#111827'); break;
      case 'noelle':      px(hx-4, hy-5,8,1,'#86efac'); break;
      case 'kris':        px(hx-4, hy+4,8,1,'#fbbf24'); break;
      case 'tenna':       px(hx-4, hy-5,8,1,'#06b6d4'); break;
      default: break;
    }
  }

  function buildProcSheet(char, altIndex, side){
    const alt = (char.alts && char.alts[Math.max(0, Math.min((char.alts.length-1)||0, altIndex||0))]) || { colors:{body:'#7dd3fc', outline:'#0ea5e9', accent:'#e5fbff'} };
    const pal = alt.colors || {body:'#7dd3fc', outline:'#0ea5e9', accent:'#e5fbff'};

    const rows = ANIMS;
    const cols = Math.max(...rows.map(a=>a[1]||16));
    const sheet = document.createElement('canvas');
    sheet.width = cols*FW; sheet.height = rows.length*FH;
    const g = sheet.getContext('2d'); g.imageSmoothingEnabled=false;

    const meta={ frameSize:[FW,FH], anims:{} };

    rows.forEach(([name,frames,fps],r)=>{
      meta.anims[name]={row:r,frames,fps};
      for(let i=0;i<frames;i++){
        const t=i/frames;
        let pose;
        if (name.startsWith('attack_')){
          const vk = name.split('_')[1];
          pose = poseVariant('attack', t, vk);
        } else if (name.startsWith('special_')){
          const vk = name.split('_')[1];
          pose = poseVariant('special', t, vk);
        } else {
          pose = basePose(name, t);
        }
        g.save();
        g.translate(i*FW, r*FH);
        // draw
        drawBody(g, pal, pose);
        drawAccents(g, char.id||char.name||'unknown', pal, pose, name);

        // Very light trail for big moves
        if (/attack_|special_|fs/.test(name)){
          g.globalAlpha = Math.max(0, 0.4 - i/frames*0.4);
          pix(g, 12, 7, 3, 2, pal.accent || '#ffffff');
        }
        g.restore();
      }
    });
    return {sheet, meta};
  }

  // --------- 5) Override sprite builder to use our procedural sheets ----------
  const SPRITES = window.SPRITES || (window.SPRITES = {});
  const MANIFEST = window.MANIFEST || (window.MANIFEST = {});

  async function buildSpritesForSelection_proc(){
    const p1Char = (window.App && window.App.p1 && window.App.p1.char) || (window.CHARACTERS && window.CHARACTERS[0]);
    const p2Char = (window.App && window.App.p2 && window.App.p2.char) || (window.CHARACTERS && window.CHARACTERS[1]);
    const p1Alt  = (window.App && window.App.p1 && window.App.p1.alt) || 0;
    const p2Alt  = (window.App && window.App.p2 && window.App.p2.alt) || 0;

    function buildOne(char, side, altIndex){
      const id = char.id + '_' + side;
      const built = buildProcSheet(char, altIndex, side);
      SPRITES[id] = built.sheet;
      MANIFEST[id] = { frameSize: built.meta.frameSize, anims: built.meta.anims };
      return id;
    }

    const p1Id = buildOne(p1Char, 'p1', p1Alt);
    const p2Id = buildOne(p2Char, 'p2', p2Alt);
    return {p1Id, p2Id};
  }

  // Swap in our builder
  window.buildSpritesForSelection = buildSpritesForSelection_proc;

  console.log('[proc-variants] Loaded: procedural variants enabled, ANIMS extended.');
})();
(function(){
  if (typeof window === 'undefined') return;
  if (!window.canvas || !window.ctx) { /* ok before boot */ }

  try{ window.USE_PORTRAIT_FALLBACK = false; window.FORCE_PROCEDURAL = true; }catch{}

  const BASE = window.ANIMS || [
    ['idle',16,12], ['walk',16,14], ['run',16,20],
    ['jump',12,16], ['aerial',12,14],
    ['attack',14,20], ['special',14,20],
    ['hitstun',10,18], ['ko',12,14], ['fs',16,22]
  ];
  const BASE_NO_GENERIC = BASE.filter(([n])=> n!=='attack' && n!=='special');
  const VARIANT_ROWS = [
    ['attack_side',14,20],['attack_up',14,20],['attack_down',14,20],['attack_aerial',14,20],
    ['special_side',14,20],['special_up',14,20],['special_down',14,20],['special_aerial',14,20]
  ];
  const EXT_ANIMS = [...BASE_NO_GENERIC, ...VARIANT_ROWS];
  window.ANIMS = EXT_ANIMS;

  const F = window.Fighter;
  if (!F){ console.warn('[proc-variants] Fighter missing; load this file after game.js'); return; }

  function variantFrom(self, controls){
    if (!self.onGround) return 'aerial';
    if (controls && controls.up)   return 'up';
    if (controls && controls.down) return 'down';
    return 'side';
  }
  const _origUpdate = F.prototype.update;
  F.prototype.update = function(dt, controls){
    this._controlsSnapshot = controls ? {...controls} : null;
    const ret = _origUpdate.apply(this, arguments);

    const meta = window.MANIFEST && window.MANIFEST[this.spriteKey];
    const has = (n)=> meta && meta.anims && meta.anims[n];

    if(this.tKO>0 && has('ko')) this.anim='ko';
    else if(this.fsActive && has('fs')) this.anim='fs';
    else if(this.tHitstun>0 && has('hitstun')) this.anim='hitstun';
    else if(this.tAttack>0){
      const av = this._attackAnim || 'attack_side';
      this.anim = has(av) ? av : (has('attack_side')?'attack_side':'attack');
    } else if(this.tSpecial>0){
      const sv = this._specialAnim || 'special_side';
      this.anim = has(sv) ? sv : (has('special_side')?'special_side':'special');
    } else {
      const spd = Math.abs(this.vx);
      if(!this.onGround && this.vy<0 && has('jump')) this.anim='jump';
      else if(!this.onGround && this.vy>=0 && has('aerial')) this.anim='aerial';
      else if(this.onGround && spd>280 && has('run')) this.anim='run';
      else if(this.onGround && spd>15 && has('walk')) this.anim='walk';
      else this.anim='idle';
    }
    return ret;
  };
  const _origAttack = F.prototype.attack;
  F.prototype.attack = function(op){
    const c = this._controlsSnapshot || {};
    this._attackAnim = 'attack_' + variantFrom(this, c);
    return _origAttack.apply(this, arguments);
  };
  const _origSpecial = F.prototype.special;
  F.prototype.special = function(op){
    const c = this._controlsSnapshot || {};
    this._specialAnim = 'special_' + variantFrom(this, c);
    return _origSpecial.apply(this, arguments);
  };

  const FW = window.FW || 16, FH = window.FH || 16;
  const ANIMS = window.ANIMS;

  function pix(g,x,y,w,h,c){ g.fillStyle=c; g.fillRect(Math.round(x),Math.round(y),w,h); }
  function seg(g,x1,y1,x2,y2,w,c){
    const dx=x2-x1, dy=y2-y1, len=Math.max(1,Math.hypot(dx,dy)), steps=Math.ceil(len/1.15);
    g.fillStyle=c;
    for(let i=0;i<=steps;i++){ const t=i/steps, x=x1+dx*t, y=y1+dy*t; g.fillRect(Math.round(x-w/2),Math.round(y-w/2),w,w); }
  }

  const POSES = window.POSES || {};
  function basePose(name, t){
    if (POSES[name]) return POSES[name](t);
    return { torso:[8,10,8,14], head:[8,7], r_arm:[8,11,11,11], l_arm:[8,11,5,11], l_leg:[8,15,7,17], r_leg:[8,15,9,17] };
  }
  function poseVariant(kind, t, varKey){
    const p = (kind==='attack' && window.pose_attack) ? window.pose_attack(t) :
              (kind==='special'&& window.pose_special)? window.pose_special(t) :
              basePose('aerial', t);
    const out = JSON.parse(JSON.stringify(p));
    const swing = Math.sin(Math.min(1,t)*Math.PI);
    function setArm(which, ang, len){
      const baseY=(p.torso?p.torso[1]+1:10), cx=8;
      const rx = cx + Math.cos(ang)*len, ry = baseY + Math.sin(ang)*len;
      out[which] = [8, baseY, rx, ry];
    }
    if (varKey==='side'){ setArm('r_arm', -0.9 + 2.4*swing, 3.6); setArm('l_arm', 0.4 - 0.5*swing, 2.7); }
    if (varKey==='up'){   setArm('r_arm', -1.6 + 2.0*swing, 4.0); setArm('l_arm', -0.8 + 0.8*swing, 2.6); out.head[1]-=1.0; }
    if (varKey==='down'){ setArm('r_arm',  1.7 - 1.8*swing, 4.0); setArm('l_arm',  2.2 - 0.9*swing, 2.8); out.torso[1]+=0.6; }
    if (varKey==='aerial'){ setArm('r_arm', -0.5 + 2.2*swing, 3.0); setArm('l_arm',  2.6 - 1.6*swing, 2.6); }
    return out;
  }

  function drawBody(g, pal, pose, charId){
    const skin = (charId==='sonic'||charId==='shadow') ? '#e7c39b' : '#f2c68d';
    const hair = '#2d231e';
    const shirt = pal.body, pants = pal.outline, accent = pal.accent || '#ffffff';
    const [tx1,ty1,tx2,ty2]=pose.torso; const cx=(tx1+tx2)/2;
    const [hx,hy]=pose.head;

    pix(g,hx-3,hy-3,6,2,hair);
    pix(g,hx-3,hy-1,6,4,skin);
    pix(g,hx-2,hy,1,1,'#000'); pix(g,hx+1,hy,1,1,'#000');

    pix(g,cx-3,ty1+1,6,6,shirt);

    const shoulderY=ty1+3, lShoulder=cx-3, rShoulder=cx+3;
    const la=pose.l_arm, ra=pose.r_arm;
    if(la) seg(g,lShoulder,shoulderY,la[2],la[3],2,skin);
    if(ra) seg(g,rShoulder,shoulderY,ra[2],ra[3],2,skin);

    const hipY=ty1+7, lHip=cx-2, rHip=cx+2;
    const ll=pose.l_leg, rl=pose.r_leg;
    if(ll) seg(g,lHip,hipY,ll[2],ll[3],2,pants);
    if(rl) seg(g,rHip,hipY,rl[2],rl[3],2,pants);

    pix(g,cx-1,ty1+5,2,1,accent);
  }

  function accents(g, id, pal, pose, rowName){
    const [hx,hy] = pose.head || [8,7];
    const px=(x,y,w=1,h=1,c='#000')=>pix(g,x,y,w,h,c);

    switch(id){
      case 'sonic': {
        const blue = pal.body || '#1276ff';
        const shoes = '#b30000', stripe='#ffffff', muzzle='#e7c39b', ear='#ffe3bd';
        px(hx-2, hy-1,4,2, muzzle);
        px(hx-4, hy-3,1,1, ear); px(hx+3, hy-3,1,1, ear);
        px(hx-5, hy-1,3,1, blue); px(hx-6, hy,4,1, blue); px(hx-7, hy+1,3,1, blue);
        px(hx+2, hy-1,3,1, blue); px(hx+2, hy,4,1, blue); px(hx+3, hy+1,3,1, blue);
        px(hx-6, hy+3,2,1,'#ffffff'); px(hx+4, hy+3,2,1,'#ffffff');
        const fy = Math.max((pose.l_leg&&pose.l_leg[3])||14,(pose.r_leg&&pose.r_leg[3])||14);
        px(hx-6, fy-1,3,2, shoes); px(hx+3, fy-1,3,2, shoes);
        px(hx-6, fy-2,3,1, stripe); px(hx+3, fy-2,3,1, stripe);
        if (/attack_aerial|special_aerial|aerial|fs/.test(rowName)){ g.globalAlpha=0.20; pix(g,hx-8,hy-8,16,16,blue); g.globalAlpha=1; }
        break;
      }
      case 'tails': {
        const t='#f59e0b', muzzle='#f4d4a7';
        px(hx-6, hy+6,3,2,t); px(hx-8, hy+7,3,2,t);
        px(hx+4, hy+6,3,2,t); px(hx+6, hy+7,3,2,t);
        px(hx-2, hy-1,4,2, muzzle);
        px(hx-6, hy+3,2,1,'#ffffff'); px(hx+4, hy+3,2,1,'#ffffff');
        break;
      }
      case 'knuckles': {
        px(hx-7, hy+5,2,2,'#ffffff'); px(hx+6, hy+5,2,2,'#ffffff');
        px(hx-6, hy+8,3,2,'#b30000'); px(hx+3, hy+8,3,2,'#b30000');
        break;
      }
      case 'amy': {
        px(hx-4, hy+4,8,2, pal.accent || '#ffd1e7');
        if (/attack|special/.test(rowName)){ px(hx+6, hy+2,3,3,'#ffcc00'); px(hx+9, hy+2,1,3,'#aa7700'); }
        break;
      }
      case 'shadow': {
        px(hx-4,hy-3,8,1,'#ff1a1a'); px(hx-5,hy-2,2,1,'#ff1a1a'); px(hx+3,hy-2,2,1,'#ff1a1a');
        px(hx-6, hy+6,2,1,'#ffd400'); px(hx+4, hy+6,2,1,'#ffd400');
        break;
      }
      case 'frisk':       px(hx-4, hy+3,8,1,'#7c3aed'); break;
      case 'ralsei':      px(hx-3, hy-5,6,2,'#0ea5e9'); px(hx-4, hy-7,8,2,'#0ea5e9'); break;
      case 'susie':       px(hx+5, hy-1,2,2,'#a21caf'); break;
      case 'undyne':      px(hx-5, hy-3,2,2,'#60a5fa'); break;
      case 'papyrus':     px(hx-5, hy-5,10,1,'#e11d48'); break;
      case 'sans':        px(hx-2, hy+3,4,1,'#60a5fa'); break;
      case 'asgore':      px(hx-5, hy-5,2,2,'#facc15'); px(hx+3, hy-5,2,2,'#facc15'); break;
      case 'mettaton':
      case 'mettaton_ex': px(hx+4, hy+2,3,3,'#f472b6'); break;
      case 'jevil':       px(hx-6, hy-4,3,2,'#a78bfa'); px(hx+3, hy-4,3,2,'#a78bfa'); break;
      case 'spade_king':  px(hx-5, hy-5,10,3,'#111827'); break;
      case 'noelle':      px(hx-4, hy-5,8,1,'#86efac'); break;
      case 'kris':        px(hx-4, hy+4,8,1,'#fbbf24'); break;
      case 'tenna':       px(hx-4, hy-5,8,1,'#06b6d4'); break;
      default: break;
    }
  }

  function buildProcSheet(char, altIndex, side){
    const alt = (char.alts && char.alts[Math.max(0, Math.min((char.alts.length-1)||0, altIndex||0))]) || { colors:{body:'#7dd3fc', outline:'#0ea5e9', accent:'#e5fbff'} };
    const pal = alt.colors || {body:'#7dd3fc', outline:'#0ea5e9', accent:'#e5fbff'};

    const rows = ANIMS;
    const cols = Math.max(...rows.map(a=>a[1]||16));
    const sheet = document.createElement('canvas');
    sheet.width = cols*FW; sheet.height = rows.length*FH;
    const g = sheet.getContext('2d'); g.imageSmoothingEnabled=false;

    const meta={ frameSize:[FW,FH], anims:{} };

    rows.forEach(([name,frames,fps],r)=>{
      meta.anims[name]={row:r,frames,fps};
      for(let i=0;i<frames;i++){
        const t=i/frames;
        let pose;
        if (name.startsWith('attack_')){
          pose = poseVariant('attack', t, name.split('_')[1]);
        } else if (name.startsWith('special_')){
          pose = poseVariant('special', t, name.split('_')[1]);
        } else {
          pose = basePose(name, t);
        }
        g.save();
        g.translate(i*FW, r*FH);

        drawBody(g, pal, pose, char.id);
        accents(g, char.id||char.name||'unknown', pal, pose, name);

        if (/attack_|special_|fs/.test(name)){
          g.globalAlpha = Math.max(0, 0.35 - i/frames*0.35);
          pix(g, 12, 7, 3, 2, pal.accent || '#ffffff');
        }
        g.restore();
      }
    });
    return {sheet, meta};
  }

  const SPRITES = window.SPRITES || (window.SPRITES = {});
  const MANIFEST = window.MANIFEST || (window.MANIFEST = {});

  async function buildSpritesForSelection_proc(){
    const p1Char = (window.App && window.App.p1 && window.App.p1.char) || (window.CHARACTERS && window.CHARACTERS[0]);
    const p2Char = (window.App && window.App.p2 && window.App.p2.char) || (window.CHARACTERS && window.CHARACTERS[1]);
    const p1Alt  = (window.App && window.App.p1 && window.App.p1.alt) || 0;
    const p2Alt  = (window.App && window.App.p2 && window.App.p2.alt) || 0;

    function buildOne(char, side, altIndex){
      const id = (char.id||'char') + '_' + side;
      const built = buildProcSheet(char, altIndex, side);
      SPRITES[id] = built.sheet;
      MANIFEST[id] = { frameSize: built.meta.frameSize, anims: built.meta.anims };
      return id;
    }

    const p1Id = buildOne(p1Char, 'p1', p1Alt);
    const p2Id = buildOne(p2Char, 'p2', p2Alt);
    return {p1Id, p2Id};
  }

  window.buildSpritesForSelection = buildSpritesForSelection_proc;
  console.log('[proc-variants] Loaded — procedural sprites & directional rows active.');
})();