// Smashlike — FS + extended animation rows (runtime sprites)
const $=(q)=>document.querySelector(q); const $$=(q)=>[...document.querySelectorAll(q)];
const Screens={ show(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden')); const tgt = document.querySelector(id); if (tgt) tgt.classList.remove('hidden'); }};

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
  rules: { stocks: 3, time: 0, ratio: 1.0, itemsOn: true, itemFreq: 8, cpuLevel: 1, shake: true, sparks: true },
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
  { id:'tripoint', name:'Tripoint Plaza', bg:'#101820', bounds:{w:2200,h:1400}, platforms:[
    {x:0,y:540,w:1100,h:20,ground:true}, {x:410,y:420,w:280,h:16},
  ]},
  { id:'wide', name:'Big Field', bg:'#0f0f16', bounds:{w:2600,h:1600}, platforms:[
    {x:0,y:560,w:1100,h:20,ground:true}
  ]},
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

// --- debug overlay (helps diagnose running/paused/results state) ---
const debugOverlay = (function(){
  try{
    const d = document.createElement('div'); d.id='debugOverlay';
    Object.assign(d.style,{
      position:'fixed', right:'12px', top:'12px', padding:'8px 10px', background:'rgba(0,0,0,0.6)', color:'#fff', fontSize:'12px', zIndex:99999, borderRadius:'8px', fontFamily:'monospace'
    });
    document.body && document.body.appendChild(d);
    return d;
  }catch(e){ return null; }
})();
function updateDebug(){ try{ if(!debugOverlay) return; debugOverlay.textContent = `running:${running} paused:${paused} startGrace:${(startGrace||0).toFixed(2)} p1.dead:${p1?p1.dead:false} p2.dead:${p2?p2.dead:false} p1.stocks:${p1?p1.stocks:'-'} p2.stocks:${p2?p2.stocks:'-'}` }catch(e){} }

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

el = document.querySelector('.mode-btn.red');   if (el) el.addEventListener('click', ()=>{ App.mode='stock';  $('#modeBadge')&&($('#modeBadge').textContent='Stock');    buildCharacterSelect(); Screens.show('#chars'); });
el = document.querySelector('.mode-btn.green'); if (el) el.addEventListener('click', ()=>{ App.mode='training';$('#modeBadge')&&($('#modeBadge').textContent='Training'); buildCharacterSelect(); Screens.show('#chars'); });
el = document.querySelector('.mode-btn.blue');  if (el) el.addEventListener('click', ()=>{ App.mode='timed';   $('#modeBadge')&&($('#modeBadge').textContent='Timed');    buildCharacterSelect(); Screens.show('#chars'); });

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
  el = document.getElementById('ruleStocks');     App.rules.stocks   = el ? +el.value : 3;
  el = document.getElementById('ruleTime');       App.rules.time     = el ? +el.value : 0;
  el = document.getElementById('ruleRatio');      App.rules.ratio    = el ? +el.value : 1.0;
  el = document.getElementById('ruleItemsOn');    App.rules.itemsOn  = el ? !!el.checked : true;
  el = document.getElementById('ruleItemFreq');   App.rules.itemFreq = el ? +el.value : 8;
  el = document.getElementById('ruleCpuLevel');   App.rules.cpuLevel = el ? +el.value : 3;
  el = document.getElementById('ruleScreenShake');App.rules.shake    = el ? !!el.checked : true;
  el = document.getElementById('ruleHitSparks');  App.rules.sparks   = el ? !!el.checked : true;
}

function buildCharacterSelect(){
  const modeMap={stock:'Stock Battle',training:'Training',timed:'Timed'};
  $('#modeLabel') && ($('#modeLabel').textContent = modeMap[App.mode]);
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
    this.fs=0; this.fsActive=false; this.tFS=0;
  }
  jump(){ if(this.onGround){ this.vy=-JUMP_V; this.onGround=false; }}
  fastfall(){ if(this.vy>50) this.vy += 450; }
  attack(op){
    if(this._cooldown&&this._cooldown>0) return; this._cooldown=0.25; this.tAttack=0.28;
    if (this.spec.moves && typeof this.spec.moves.attack === 'function'){
      this.spec.moves.attack(this, op);
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
    if(best){ this.holding=best; items.splice(items.indexOf(best),1); }
  }
  useItem(op){ if(!this.holding) return; this.holding.use(this,op); if(this.holding.consumable) this.holding=null; }
  update(dt,controls){
    if(this.aiLevel>0 && this===p2) cpuThink(this, opponentOf(this));
    this.inv=Math.max(0,this.inv-dt); this._cooldown=Math.max(0,(this._cooldown||0)-dt); this._scd=Math.max(0,(this._scd||0)-dt);
    this.tAttack=Math.max(0,this.tAttack-dt); this.tSpecial=Math.max(0,this.tSpecial-dt);
    this.tHitstun=Math.max(0,this.tHitstun-dt); this.tKO=Math.max(0,this.tKO-dt);
    if(controls.fs) this.tryFS(opponentOf(this));

    const move=(controls.right?1:0)-(controls.left?1:0);
    const accel=this.onGround?210:140;
    this.vx += move*accel*dt*this.spec.stats.speed; this.dir = move!==0? (move>0?1:-1) : this.dir;
    if(!controls.left && !controls.right) this.vx*= this.onGround? FRICTION : AIR_FRICTION;
    if(controls.jump) { this.jump(); controls.jump=false; }
    if(controls.fastfall) this.fastfall();
    if(controls.attack) { this.attack(opponentOf(this)); controls.attack=false; }
    if(controls.special){ this.special(opponentOf(this)); controls.special=false; }
    if(controls.pick){ this.pickOrDrop(); controls.pick=false; }
    if(controls.use){ this.useItem(opponentOf(this)); controls.use=false; }
    if(controls.shield){ this.vx*=0.75; this.shield=Math.max(0,this.shield-dt*15); }

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
        this.y=p.y-this.h; this.vy=0; this.onGround=true;
      }
    }
  }
  render(){
    const A=(MANIFEST[this.spriteKey]||MANIFEST[Object.keys(MANIFEST)[0]]).anims[this.anim];
    const fw=(MANIFEST[this.spriteKey]||MANIFEST[Object.keys(MANIFEST)[0]]).frameSize[0], fh=(MANIFEST[this.spriteKey]||MANIFEST[Object.keys(MANIFEST)[0]]).frameSize[1];
    const sx=this.frame*fw, sy=A.row*fh; const px=Math.round(this.x), py=Math.round(this.y);
    ctx.save(); ctx.imageSmoothingEnabled=false;
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
  tgt.damage += dmg;
  tgt.vx = kb*(1+tgt.damage/120) * 0.9;
  tgt.vy = -Math.abs(kb)*0.35*(1+tgt.damage/120);
  tgt.inv=0.25; tgt.tHitstun=Math.min(0.4, 0.15 + dmg/30);
  src.stats.dealt += dmg;
  src.fs = Math.min(100, src.fs + dmg*FS_CHARGE_HIT);
  tgt.fs = Math.min(100, tgt.fs + dmg*FS_CHARGE_TAKEN*0.5);
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
function spawnRandomItem(){ const roll=Math.random(); if(roll<.34) items.push(new Heart()); else if(roll<.68) items.push(new Bomb()); else items.push(new AssistTrophy()); }

// ==== Controls ====
const keys={};
function clearKeys(){ for(const k of Object.keys(keys)) delete keys[k]; }
window.addEventListener('keydown',e=>{ keys[e.key]=true; });
window.addEventListener('keyup',e=>{ keys[e.key]=false; });

const controlsP1={left:false,right:false,attack:false,special:false,jump:false,fastfall:false,shield:false,pick:false,use:false,fs:false};
const controlsP2={left:false,right:false,attack:false,special:false,jump:false,fastfall:false,shield:false,pick:false,use:false,fs:false};
function resetControls(c){ Object.keys(c).forEach(k=> c[k]=false); }
function updateControls(){
  controlsP1.left=!!keys['a']; controlsP1.right=!!keys['d']; controlsP1.fastfall=!!keys['s']; if(keys['w']||keys[' ']){ controlsP1.jump=true; }
  if(keys['j']||keys['z']) controlsP1.attack=true; if(keys['k']||keys['x']) controlsP1.special=true; if(keys['l']) controlsP1.shield=true; if(keys['h']) controlsP1.pick=true; if(keys['u']) controlsP1.use=true; controlsP1.fs=!!keys['o'];
  controlsP2.left=!!keys['ArrowLeft']; controlsP2.right=!!keys['ArrowRight']; controlsP2.fastfall=!!keys['ArrowDown']; if(keys['ArrowUp']||keys['0']){ controlsP2.jump=true; }
  if(keys['1']||keys[',']) controlsP2.attack=true; if(keys['2']||keys['/']) controlsP2.special=true; if(keys['3']) controlsP2.shield=true; if(keys['.']) controlsP2.pick=true; controlsP2.fs=!!keys['9'];
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
let p1,p2; let last=0; let running=false; let paused=false; let itemTimer=0; let timer=0;
let startGrace = 0; // KO & results lockout at match start
let preStart = false; // freeze gameplay during countdown
let countdownT = 0;  // seconds remaining in countdown
let pickSide = 'p1'; // which side the next character click assigns to
function opponentOf(f){ return f===p1? p2 : p1; }

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

  running=true; paused=false; items.length=0; projectiles.length=0; helpers.length=0; itemTimer=0; last=0;
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
    ctx.fillStyle=App.stage.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const p of App.stage.platforms){ ctx.fillStyle=p.ground?'#2c2f4a':'#39405e'; ctx.fillRect(p.x,p.y,p.w,p.h); }
    p1.render(); p2.render();
    drawSparks();
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

  updateHitboxes(dt, p1, p2);

  for(const pr of projectiles){
    pr.update(dt);
    if(collide(pr,p1)&&pr.owner!==p1){ hit(pr.owner,p1,pr.damage,pr.kb*sign(pr.vx)); pr.dead=true;}
    if(collide(pr,p2)&&pr.owner!==p2){ hit(pr.owner,p2,pr.damage,pr.kb*sign(pr.vx)); pr.dead=true; }
  }
  for(const h of helpers){ h.update(dt); }
  for(const s of sparks){ s.t-=dt; } 
  removeDead(projectiles); removeDead(helpers); for(let i=sparks.length-1;i>=0;i--) if(sparks[i].t<=0) sparks.splice(i,1);

  if(App.rules.itemsOn && App.mode!=='training'){ itemTimer-=dt; if(itemTimer<=0){ spawnRandomItem(); itemTimer = Math.max(2, App.rules.itemFreq)+Math.random()*2; } }
  items.forEach(i=> i.update(dt));

  if(App.mode==='timed' && timer>0){ timer -= dt; if(timer<=0){ concludeTimed(); return; } }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=App.stage.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const p of App.stage.platforms){ ctx.fillStyle=p.ground?'#2c2f4a':'#39405e'; ctx.fillRect(p.x,p.y,p.w,p.h); }
  items.forEach(i=> i.draw());
  projectiles.forEach(p=> p.render());
  helpers.forEach(h=> h.render());
  p1.render(); p2.render();
  drawSparks();
  updateHUD();

  // Don’t allow immediate results during the grace window
  if(startGrace<=0 && App.mode!=='training' && (p1.dead||p2.dead)){ showResults(); running=false; }
  updateDebug();
}
function drawSparks(){ for(const s of sparks){ ctx.globalAlpha=Math.max(0,s.t/0.2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x,s.y,8*(s.t/0.2),0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; } }
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
  [{n:'Heart',c:()=>items.push(new Heart())},{n:'Bomb',c:()=>items.push(new Bomb())},{n:'Assist Trophy',c:()=>items.push(new AssistTrophy())}]
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
