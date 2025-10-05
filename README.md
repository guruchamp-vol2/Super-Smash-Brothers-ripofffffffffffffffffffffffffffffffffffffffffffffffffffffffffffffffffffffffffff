# Smashlike Ultimate — Open Prototype

A single‑page, asset‑free prototype inspired by Super Smash Bros. Ultimate. Built for learning and quick modding.

> **Not affiliated with Nintendo/HAL.** This is an original codebase with simple placeholder visuals and procedural audio.

## Features
- SSBU‑style flow: Title → Main Menu → Modes → Rules → Character/Alt Select → Stage/Music → Game → Results
- Modes: **Stock**, **Training** (infinite stocks + item spawner), **Timed**
- **Rules**: stocks, time limit, damage ratio, items on/off & frequency, CPU level, screen shake, hit sparks
- **Alts** per character (palettes)
- **Stages** framework with 3 built‑in stages
- **Items**: Heart (heal), Bomb (knockback), Assist Trophy (spawns a helper)
- **Music**: 3 procedural tracks via WebAudio + music select menu
- **HUD**, **Pause**, **Results** screen
- Basic **CPU** (levels 1–9) that chases, jumps, attacks, uses items
- Small **modding API** (`window.Smashlike.addStage/addCharacter/addMusic`)

## Run
Open `index.html` in a modern desktop browser. No server required.

## Controls
**Player 1** — WASD, `J` (attack), `K` (special), `L` (shield), `H` (pick/drop), `U` (use item).  
**Player 2** — Arrows/`0` to jump, `1` (attack), `2` (special), `3` (shield), `.` (pick/drop).  
`Enter` to pause. **Training**: press `I` or Pause → *Spawn Item*.

## Modding
Open DevTools Console and call:

```js
Smashlike.addStage({
  id:'flatmania', name:'Flatmania', bg:'#0e141c',
  bounds:{w:2200,h:1400},
  platforms: [{x:0,y:540,w:1100,h:20,ground:true},{x:410,y:420,w:280,h:16}]
});

Smashlike.addCharacter({
  id:'blaster', name:'Blaster',
  alts:[
    {name:'Default', colors:{body:'#c7f9cc', outline:'#38b000'}},
    {name:'Cosmic',  colors:{body:'#bdb2ff', outline:'#7c3aed'}}
  ],
  stats:{weight:1.0, speed:1.15},
  kit:'fast'
});
```

## License
MIT — see `LICENSE`.
