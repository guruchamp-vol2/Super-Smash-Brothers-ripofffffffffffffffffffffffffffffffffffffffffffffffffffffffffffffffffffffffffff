/* proc-variants.js
 * Drop this AFTER game.js (in index.html), or paste at the very end of game.js.
 * Adds directional attack/special rows + procedural 16x16 sprite generation for all fighters.
 */
(function(){
  if (typeof window === 'undefined') return;
  if (!window.canvas || !window.ctx) { /* ok if not ready yet */ }

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
  F.prototype.attack = function(){
    const c = this._controlsSnapshot || {};
    this._attackAnim = 'attack_' + variantFrom(this, c);
    return _origAttack.apply(this, arguments);
  };
  const _origSpecial = F.prototype.special;
  F.prototype.special = function(){
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

  function buildProcSheet(char, altIndex){
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
        drawBody(g, pal, pose);
        drawAccents(g, char.id||char.name||'unknown', pal, pose, name);
        // tiny spark on big moves
        if (/attack_|special_|fs/.test(name)){
          g.globalAlpha = Math.max(0, 0.35 - i/frames*0.35);
          pix(g, 12, 7, 3, 2, pal.accent || '#ffffff');
          g.globalAlpha = 1;
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