# Glow War — Claude Code Context

## Project Overview
Browser-based React card game (single `.jsx` file). No build step — loads directly as a React artifact/component.
Current version: **v169**. Working file convention: `war-game-vNN.jsx` (deploy by incrementing NN).

## File Locations
- Working file: `war-game-v169.jsx` (rename to next version before editing)
- QA suites: `war_qa.mjs` (52 tests), `deep_qa.mjs` (131 tests)
- Deploy: copy to outputs, bump version string in source

## Deploy Pattern
```bash
cp war-game-vNNN.jsx war-game-vNN+1.jsx   # bump version first
# edit the new file
# update version string: grep for >vNNN< and replace with >vNN+1<
node --input-type=module < check_balance.mjs   # brace/paren balance
node war_qa.mjs && node deep_qa.mjs            # must be 0 failures
```

## Balance Check (inline)
```bash
node --input-type=module <<'EOF'
import fs from 'fs';
const c=fs.readFileSync('war-game-vNNN.jsx','utf8');
let b=0,p=0;for(const ch of c){if(ch==='{')b++;else if(ch==='}')b--;else if(ch==='(')p++;else if(ch===')')p--;}
console.log(`Braces:${b} Parens:${p}`);  // must both be 0
EOF
```

---

## Architecture

### Single-file React component
- No imports beyond React — all components defined in one file
- `export default function GlowWarGame()` is the root component
- **ALL sub-components must be defined at module top level** — never inside render functions or other components. If defined inside, React sees a new type each render → infinite remount/animation loop.

### Phase Machine
```
idle → resolve → collecting → war → war_card → war_reveal → collecting
                                              → double_war → double_war_card → double_reveal → collecting
collecting → (collectAndDeal + fight) → idle
any phase → gameover
```
- `"collecting"` is transient for BOTH duel and war collect
- Distinguished by `warCollect`: `null` = duel collect, non-null = war collect
- `pol = config.pileSide === "right"`

### War State — two refs only
```js
const warSlotRef = useRef(0);
const warSpoilsRef = useRef({ps:[], cs:[]});
const dw2SlotRef = useRef(0);        // double war slot counter
const dw2SpoilsRef = useRef({ps:[], cs:[]});
```

### Key Refs
```js
const gWinRef = useRef(null);
const pendingWarWinRef = useRef(null);
const pendingActionRef = useRef(null);
const addLogRef = useRef(null);  // wired to addLog each render — see CRITICAL #2
```

### addLogRef wiring order (CRITICAL — must be in this order)
```js
const logRef = useRef([]);
const addLogRef = useRef(null);        // 1. declare BEFORE addLog
const addLog = useCallback((...) => { // 2. define addLog
  ...
}, []);
addLogRef.current = addLog;           // 3. wire AFTER addLog defined
```
If addLogRef is used before its `const` declaration → ReferenceError → blank screen.

### INIT_BF (battlefield initial state)
```js
const INIT_BF = {
  phase:"idle", cpuF:null, plF:null, cpuSp:[], plSp:[], cpuW:null, plW:null,
  rw:null, revealed:false, tapCt:0, pot:0, maxSp:0, warCollect:null, warInfo:null,
  fightSlide:null, mercySpoils:0,
  dw2PlSp:[], dw2CpuSp:[], dw2PlW:null, dw2CpuW:null, dw2Round:0
};
```

### bf destructure (ALL fields required — missing fields → undefined in JSX → blank screen)
```js
const {phase,cpuF,plF,cpuSp,plSp,cpuW,plW,rw,revealed,pot,warCollect,warInfo,
  fightSlide,mercySpoils,dw2PlSp,dw2CpuSp,dw2PlW,dw2CpuW,dw2Round} = bf;
```

### WAR_PHASES arrays
```js
const WAR_PHASES = ["war","war_card","war_reveal","double_reveal","double_war","double_war_card","collecting"];
const inWar = [...].includes(phase);   // includes double_war, double_war_card
const inDouble = phase==="double_reveal" || phase==="double_war" || phase==="double_war_card";
```

---

## Config State
```js
useState(() => {
  const w = typeof window !== "undefined" ? window.innerWidth : 400;
  const cardSize = w<360 ? "sm" : w<600 ? "md" : "lg";
  return {
    muted:true, volume:.7, pileSide:"right", showMsg:true, autoSpeed:0,
    gameMode:"cards", warTarget:3, warAutoFill:false, logEvents:true,
    cardSize, showDevBar:true
  };
})
```

## Card Size System
```js
const CS = config.cardSize || "md";
const csSmall=CS==="sm", csMed=CS==="md", csLg=CS==="lg";
const CW = csSmall?27 : csMed?47 : 60;
const CH = csSmall?39 : csMed?68 : 87;
```

## Global Constants
```js
const RANK_FONT = {small:6, med:13, def:10};
const SV = {"♠":3, "♥":2, "♦":1, "♣":0};
const PIP_SZ = {sm:9, md:19, lg:24};  // pip suit sizes — used by Pips; keeps battlefield & collect pile in sync
```

## Card Glow Variants
- `"win"` → green `#22c55e`
- `"lose"` → red `#e74c3c`
- `"dw2"` → purple `#cc44ff` (double war winner)

## Card Suit Rule
**Every visible card face must display a suit at all times** — on the battlefield, in collection piles, and on draw pile top card.
- Number cards: suit appears as pips via the Pips component
- Face cards (J/Q/K): chess piece + large suit shown in center via Pips
- Aces: large suit centered via Pips
- Corner rank labels on J/Q/K/A include a suit subscript

## Spoil vs War Card Deal Rule
**Spoil cards always deal face-down. War cards always deal face-up.**
- In manual mode: each spoil tap places a face-down card; the war card tap reveals result immediately.
- In autoFill mode: all spoils + war card are placed in one step; spoils show face-down for ~500ms then auto-flip via `revealed:true`.
- `revealed:false` → spoils face-down; `revealed:true` → spoils flip face-up (FlipCard animation).
- The W slot is never `faceDown` regardless of `revealed` — war card is always face-up on placement.
- Double war autoFill: all 3 dw2 spoils + dw2 war card placed in one tap (face-down); tap again to resolve.

## Double War Rendering
dw2 spoil cards render **in-slot** (not as an overlay):
- S1/S2/S3 slots: War 1 spoil cards stay face-up; dw2 spoils appear as per-slot absolute overlays face-down
- W slot: War 1 war card stays face-up; dw2 war card overlays face-up, purple glow on `double_reveal`
- No `Dw2Overlay` component — removed in v159. Cards are positioned per-slot.

## HUD Layout
Left: `time · duels · wars · pot · you · cpu`
Center: `GLOW WAR` title + mode badge
Right: `autoplay · war-autofill · restart · Settings ⚙️ · [Log] · ✕`

## Dev Bar
- Location: above AD SPACE, bottom of screen
- Visible when: `config.showDevBar && phase !== "gameover"`
- Contents: "⚙ DEV" label · Speed Play button · "|" · WARx1 / WARx2 / WARx3 buttons
- `lastRig` state tracks active rig button glow; clears when double_war phase fires

## War Card Glow Standard
**War card result is revealed at the moment the card is placed — not on a separate reveal tap.**
- War-1 cards (`plW`/`cpuW`): glow determined by `warTie` and `rw` in `war_reveal`/`double_reveal`
  - Tie (both in `double_war`/`double_war_card` with `rw=null|"tie"`) → orange `"tie"` glow
  - Winner/loser in `war_reveal`/`double_reveal` → green `"win"` / red `"lose"` glow
- dw2 war cards (`dw2PlW`/`dw2CpuW`): glow set in `rw` at card-placement time
  - Placed via `placeDw2WarCard()` helper which computes `rw="tie"|"player"|"cpu"` immediately
  - `glow="tie"` (orange) when `rw="tie"`; `glow="win"/"lose"` when `rw="player"/"cpu"` + `dw2Revealed`
- **Never** use "face-down then tap to reveal" for war cards — result is shown as soon as card lands

## War Alert Animation
- CSS keyframe `warAlert`: flashes 3× (opacity .15→1→.15→1→.15→1) then stays solid — `forwards` fill
- Applied to the war title div with `key={\`wa-${dw2Round}\`}` so animation resets each new war level
- When `showStats` is true (reveal phase), `animation:"none"` allows opacity transition to 0.25 (stats overlay)
- Do NOT switch back to `wP` (infinite pulse) for war entry — `warAlert` handles both flash and resting state

---

## CRITICAL RULES — Never Violate

**#1 — Never call setPCollect (or any collect pile setter) inside rigDecks**
Even a no-op array write triggers a React re-render that races with phase state and freezes the game. `rigDecks` touches `setPDeck` only.

**#2 — addLogRef, not addLog, inside useCallback(fn, [])**
`useCallback` with `[]` deps captures a stale `addLog`. Always use `addLogRef.current(...)` inside rigDecks and similar zero-dep callbacks. Wire the ref each render: `addLogRef.current = addLog`.

**#3 — No components defined inside render functions**
Causes infinite remount → CSS animations restart every frame. All components (FlipCard, Ghost, MercySlot, WarPathRow, etc.) must be at module top level.

**#4 — All bf fields must be in the destructure**
Adding a new field to INIT_BF without adding it to the destructure → undefined in JSX → blank screen or subtle bugs.

**#5 — Temporal Dead Zone: declare refs before use**
`const addLogRef = useRef(null)` must appear BEFORE `addLogRef.current = addLog` in the component body. JS `const` has no hoisting — accessing before declaration throws ReferenceError → blank screen.

**#6 — resolveWar is dead code**
`resolveWar` useCallback was removed (v157). Do not re-introduce. War resolution happens entirely inside `warStep()` and the `double_war_card` tap branch.

**#7 — Dev autoplay drives war phases through tapPileRef**
When `dev=true`, the autoplay loop calls `tapPileRef.current()` for war/double_war phases — NOT `wrapBfState(phase:"collecting")` directly. Skipping to collecting bypasses the slot sequence.

**#8 — Python replace scripts: verify indentation after apply**
Multi-site patch scripts can produce wrong indentation. Always `grep -n` the changed area after applying.

**#9 — QA strings match comments too**
Don't put the thing you're testing for in inline comments inside the function being tested — the string search will find the comment and falsely pass.

**#10 — Use resetWarSlots() / resetDw2Slots() for war counter resets**
Never write `warSlotRef.current=0; warSpoilsRef.current={ps:[],cs:[]};` inline. Use the dedicated helper `resetWarSlots()` instead. Same for `resetDw2Slots()`. These helpers are defined immediately after the ref declarations and are safe to call inside any useCallback (refs only, no stale closure risk).

**#11 — No dead refs or unused props**
Before adding a new `useRef`, a new prop, or a new `useCallback`, confirm it is wired AND read somewhere. Scaffolded-but-never-completed features become invisible bugs. Dead code removed in v162: `lastTap`, `onDblTap`, `autoCompleteWar`, `dblTapPile`, `autoCompleteWarRef`, `introRef`.

**#12 — Guard optional-chaining on ref callbacks**
When a ref holds a callback that might not be wired at call time, use optional chaining: `someRef.current?.(args)`. Applies especially to `scheduleAnimFallbackRef.current?.()`.

---

## Known Architecture Debt (parking lot)
- War path row cards (Ghost/MercySlot/WarPathRow) use hardcoded `60×87` — threading CS props is a larger refactor
- Triple/quadruple war chaining: `dw2Round` increments correctly but needs visual QA
- "Stuff the ballot box" feature: give player a subtle thumb on the scale
- `pDrawDomRef` / `cDrawDomRef` are attached to DOM but not yet read — reserved for future deal-intro position animation

---

## Log Prefix Map
```
duel→DUEL  war→WAR  spoil→SPOIL  warCard→WCARD  mercy→MERCY
collect→COLL  init→INIT  setting→SET
dw2spoil→DW SP  dw2card→DW CD  dev→DEV
```

## Gameover / Forfeit Flow
Mode switch or Restart mid-game routes through gameover screen via `pendingActionRef`.
`gWinReason==="forfeit"` shows forfeit subtitle.

## Autoplay Loop — war gating
```js
// Non-dev: stop loop entirely for all war phases
if(WAR_PHASES.includes(phase) && !dev){ autoLoopRef.current=false; return; }
// Dev: drive through tapPileRef (not direct state mutation)
if((ph==="war"||ph==="war_card")&&curDev) warStepRef.current();
if((ph==="war_reveal"||ph==="double_reveal")&&curDev) tapPileRef.current();
if((ph==="double_war"||ph==="double_war_card")&&curDev) tapPileRef.current();
```
