// Smashlike — FS + extended animation rows (runtime sprites)
const $=(q)=>document.querySelector(q); const $$=(q)=>[...document.querySelectorAll(q)];
const Screens={ show(id){ $$('.screen').forEach(s=>s.classList.add('hidden')); $(id).classList.remove('hidden'); }};

const App = {
  mode: 'stock',
  rules: { stocks: 3, time: 0, ratio: 1.0, itemsOn: true, itemFreq: 8, cpuLevel: 3, shake: true, sparks: true },
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

// ===== runtime sprite gen =====
const MANIFEST={}; const SPRITES={};
const ANIMS=[
  ['idle',8,12], ['walk',10,12], ['run',8,16],
  ['jump',8,14], ['aerial',8,12],
  ['attack',10,16], ['special',10,16],
  ['hitstun',6,16], ['ko',8,12],
  ['fs',12,18]
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
  const [body,outline,accent]=pal; const [tx1,ty1,tx2,ty2]=pose.torso;
  g.fillStyle=`rgba(${body[0]},${body[1]},${body[2]},${body[3]/255})`; g.strokeStyle=`rgba(${outline[0]},${outline[1]},${outline[2]},${outline[3]/255})`;
  g.fillRect(tx1-1,ty1,3,ty2-ty1); g.strokeRect(tx1-1,ty1,3,ty2-ty1);
  const [hx,hy]=pose.head; g.fillRect(hx-2,hy-2,4,4); g.strokeRect(hx-2,hy-2,4,4);
  g.fillStyle='rgba(0,0,0,1)'; g.fillRect(hx-1,hy,1,1); g.fillRect(hx+1,hy,1,1);
  g.strokeStyle=`rgba(${body[0]},${body[1]},${body[2]},${body[3]/255})`; g.lineWidth=2;
  ['l_arm','r_arm','l_leg','r_leg'].forEach(k=>{ const [x1,y1,x2,y2]=pose[k]; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); });
  g.fillStyle=`rgba(${accent[0]},${accent[1]},${accent[2]},${accent[3]/255})`; const cx=(tx1+tx2)/2, cy=(ty1+ty2)/2; g.fillRect(cx-1,cy-1,2,2);
}

function makeSheetFromColors(colors){
  const pal=[rgba(colors.body), rgba(colors.outline), rgba(colors.accent||'#ffffff')];
  const rows=ANIMS.length, cols=Math.max(...ANIMS.map(a=>a[1]));
  const sheet=document.createElement('canvas'); sheet.width=cols*FW; sheet.height=rows*FH; const g=sheet.getContext('2d'); g.imageSmoothingEnabled=false;
  const meta={ frameSize:[FW,FH], anims:{} };
  ANIMS.forEach(([name,frames,fps],r)=>{
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
function buildSpritesForSelection(){
  const p1Sel=(App.p1.char||CHARACTERS[0]).alts[App.p1.alt||0].colors;
  const p2Sel=(App.p2.char||CHARACTERS[1]).alts[App.p2.alt||0].colors;
  const p1Id=(App.p1.char||CHARACTERS[0]).id+'_p1'; const p2Id=(App.p2.char||CHARACTERS[1]).id+'_p2';
  [[p1Id,p1Sel],[p2Id,p2Sel]].forEach(([id,colors])=>{
    const {sheet,meta}=makeSheetFromColors(colors); SPRITES[id]=sheet; MANIFEST[id]={...meta};
  });
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

el = $('#charsReady');
if (el) el.addEventListener('click', (e)=>{
  e.preventDefault();
  document.activeElement && document.activeElement.blur();
  startBattle();
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
  const buildGrid = (sideId, altRowId, side) => {
    const grid = $(sideId); if(!grid) return; grid.innerHTML = '';
    CHARACTERS.forEach((c)=>{
      const el = document.createElement('div'); el.className='item'; el.innerHTML = `<div style="font-weight:800">${c.name}</div><div class="muted">${c.kit}</div>`;
      el.onclick = ()=> { App[side].char = c; App[side].alt = 0; renderAlts(altRowId, side); $$(`${sideId} .item`).forEach(i=>i.style.outline=''); el.style.outline='3px solid var(--accent)'; };
      grid.appendChild(el);
    });
  };
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
  buildGrid('#p1Chars','#p1Alts','p1');
  buildGrid('#p2Chars','#p2Alts','p2');
  App.p1.char = CHARACTERS[0]; App.p2.char = CHARACTERS[1];
  renderAlts('#p1Alts','p1'); renderAlts('#p2Alts','p2');
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
    super(200+side*600, 400, 56, 64);
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
    const power=this.spec.kit==='heavy'?(12+Math.random()*6):(8+Math.random()*4);
    const kb=this.spec.kit==='heavy'?600:520;
    if(Math.abs(this.x-op.x)<80 && Math.abs(this.y-op.y)<60){ hit(this,op,power*App.rules.ratio,kb*sign(this.dir)); }
  }
  special(op){
    if(this._scd&&this._scd>0) return; this._scd=.8; this.tSpecial=0.5;
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
  if(keys['j']) controlsP1.attack=true; if(keys['k']) controlsP1.special=true; if(keys['l']) controlsP1.shield=true; if(keys['h']) controlsP1.pick=true; if(keys['u']) controlsP1.use=true; controlsP1.fs=!!keys['o'];
  controlsP2.left=!!keys['ArrowLeft']; controlsP2.right=!!keys['ArrowRight']; controlsP2.fastfall=!!keys['ArrowDown']; if(keys['ArrowUp']||keys['0']){ controlsP2.jump=true; }
  if(keys['1']) controlsP2.attack=true; if(keys['2']) controlsP2.special=true; if(keys['3']) controlsP2.shield=true; if(keys['.']) controlsP2.pick=true; controlsP2.fs=!!keys['9'];
}

// ==== Game loop ====
let p1,p2; let last=0; let running=false; let paused=false; let itemTimer=0; let timer=0;
let startGrace = 0; // KO & results lockout at match start
function opponentOf(f){ return f===p1? p2 : p1; }

function startBattle(){
  // Hide overlays hard
  document.getElementById('results')?.classList.add('hidden');
  document.getElementById('pause')?.classList.add('hidden');

  Screens.show('#gameScreen'); ensureAudio(); startMusic();
  if(!App.stage) App.stage = STAGES[0];
  // Debug: log when a battle is starting and what the selected config is
  console.log('startBattle() - App (pre-build):', { mode: App.mode, rules: App.rules, p1: App.p1, p2: App.p2, stage: App.stage && App.stage.id });
  const {p1Id,p2Id}=buildSpritesForSelection();
  p1 = new Fighter(0, App.p1.char||CHARACTERS[0], (App.p1.char||CHARACTERS[0]).alts[App.p1.alt||0], p1Id);
  p2 = new Fighter(1, App.p2.char||CHARACTERS[1], (App.p2.char||CHARACTERS[1]).alts[App.p2.alt||0], p2Id);

  // Respect P2 CPU checkbox — if unchecked, make p2 human (aiLevel 0)
  try{
    const p2CpuEl = document.getElementById('p2Cpu');
    if (p2CpuEl && !p2CpuEl.checked){ p2.aiLevel = 0; }
    else { p2.aiLevel = App.rules.cpuLevel; }
  } catch(e){ /* ignore in environments without DOM */ }

  // Debug: log created fighter objects and the start grace period
  console.log('startBattle() - created fighters:', { p1Id, p2Id, p1_preview: { name: p1.name, dead: p1.dead, stocks: p1.stocks }, p2_preview: { name: p2.name, dead: p2.dead, stocks: p2.stocks }, startGrace });

  // force spawn to canvas-based positions
  p1.placeSpawn(); p2.placeSpawn();

  running=true; paused=false; items.length=0; projectiles.length=0; helpers.length=0; itemTimer=0; last=0;
  p1.vx=p1.vy=p2.vx=p2.vy=0;

  clearKeys(); resetControls(controlsP1); resetControls(controlsP2);

  timer = App.rules.time>0? App.rules.time*60 : 0;
  startGrace = 1.25; // <== prevent instant KO/results
  updateHUD(); requestAnimationFrame(loop);
}
function endBattle(){ running=false; Screens.show('#chars'); }

function updateHUD(){
  const h1=$('#hudP1'), h2=$('#hudP2');
  const fs1 = `<div class="fsbar"><div style="width:${p1?Math.floor(p1.fs):0}%;"></div></div>`;
  const fs2 = `<div class="fsbar"><div style="width:${p2?Math.floor(p2.fs):0}%;"></div></div>`;
  const t1 = `<div class="percent">${Math.floor(p1? p1.damage:0)}%</div>${fs1}<div class="stocks">${renderStocks(p1)}</div>`;
  const t2 = `<div class="stocks">${renderStocks(p2)}</div>${fs2}<div class="percent">${Math.floor(p2? p2.damage:0)}%</div>`;
  h1.innerHTML=t1; h2.innerHTML=t2;
  $('#hudTimer').textContent = App.mode==='training' ? 'Training' : (App.mode==='timed' && timer>0 ? formatTime(timer) : 'Battle');
}
function renderStocks(f){ if(App.mode==='training') return '<div class="stock"></div>'; let s=''; for(let i=0;i<(f?f.stocks:0);i++) s+='<div class="stock"></div>'; return s; }
function formatTime(sec){ const m=Math.floor(sec/60); const s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; }

function loop(ts){ if(!running) return; if(!last) last=ts; const dt=Math.min(.033,(ts-last)/1000); last=ts; if(!paused){ frame(dt); } requestAnimationFrame(loop); }

function frame(dt){
  if(startGrace>0) startGrace -= dt;

  updateControls();
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
}
function drawSparks(){ for(const s of sparks){ ctx.globalAlpha=Math.max(0,s.t/0.2); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(s.x,s.y,8*(s.t/0.2),0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; } }
function collide(a,b){ return (a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y); }
function removeDead(arr){ for(let i=arr.length-1;i>=0;i--) if(arr[i].dead) arr.splice(i,1); }

// ==== Pause / overlays (Escape) ====
window.addEventListener('keydown', function(e){
  const gs = document.getElementById('gameScreen');
  if (!gs || gs.classList.contains('hidden')) return;

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
  // Debug: log why results are being shown
  console.log('showResults() called', { title, p1_dead: p1 && p1.dead, p2_dead: p2 && p2.dead, startGrace });
  const rt = document.getElementById('resultTitle');
  if (rt) rt.textContent = title || (p1.dead ? 'Player 2 Wins!' : 'Player 1 Wins!');
  const statsEl = document.getElementById('resultStats');
  if (statsEl){
    statsEl.innerHTML='';
    statsEl.insertAdjacentHTML('beforeend', `<div class="panel"><h3>P1 — ${p1.name}</h3><div>Damage Dealt: ${p1.stats.dealt.toFixed(1)}</div><div>Falls: ${p1.stats.falls}</div></div>`);
    statsEl.insertAdjacentHTML('beforeend', `<div class="panel"><h3>P2 — ${p2.name}</h3><div>Damage Dealt: ${p2.stats.dealt.toFixed(1)}</div><div>Falls: ${p2.stats.falls}</div></div>`);
  }
  document.getElementById('results')?.classList.remove('hidden');
}

let shakeAmt=0, shakeEnd=0;
function shake(mag, ms){ shakeAmt=mag; shakeEnd=performance.now()+ms; const tick=()=>{ if(performance.now()<shakeEnd){ const dx=(Math.random()*shakeAmt-shakeAmt/2),dy=(Math.random()*shakeAmt-shakeAmt/2); ctx.setTransform(1,0,0,1,dx,dy); requestAnimationFrame(tick); } else ctx.setTransform(1,0,0,1,0,0); }; tick(); }
function sign(v){ return v<0?-1:1; }

function cpuThink(bot, foe){
  const lvl = App.rules.cpuLevel;
  const c = { left:false,right:false,jump:false,fastfall:false,attack:false,special:false,shield:false,pick:false,use:false,fs:false };
  if(Math.abs(bot.x-foe.x)>20){ c.left = bot.x>foe.x; c.right = bot.x<foe.x; }
  if(foe.y+foe.h < bot.y && Math.random()<0.02*lvl) c.jump=true;
  if(Math.random()<0.03*lvl){ c.attack=true; }
  if(Math.random()<0.015*lvl){ c.special=true; }
  if(bot.fs>=100 && Math.random()<0.01*lvl){ c.fs=true; }
  if(bot.holding==null && items.some(i=>Math.abs(i.x-bot.x)<30 && Math.abs(i.y-bot.y)<30)){ c.pick=true; }
  if(bot.holding!=null && Math.random()<0.02*lvl){ c.use=true; }
  Object.assign(bot===p2?controlsP2:controlsP1, c);
}

window.Smashlike = {
  addStage(stage){ STAGES.push(stage); },
  addCharacter(c){ CHARACTERS.push(c); },
  addMusic(t){ MUSIC.push(t); },
};
