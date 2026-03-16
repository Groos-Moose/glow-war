import React, { useState, useEffect, useRef, useCallback } from "react";

const SUITS=["♠","♥","♦","♣"];
const RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RV=Object.fromEntries(RANKS.map((r,i)=>[r,i+2])); // 2=2..A=14
// Card rank font sizes — global so Card and CollectPile stay in sync
const RANK_FONT={small:6, med:13, def:10};
const cardValue=cards=>cards.reduce((s,c)=>s+(RV[c.rank]||0),0);
function buildWarInfo(playerWon,pWC,cWC,plF,cpuF,plSp,cpuSp,allCards){
  const yours=[plF,...(plSp||[]),pWC].filter(Boolean);
  const theirs=[cpuF,...(cpuSp||[]),cWC].filter(Boolean);
  return{playerWon,yourVal:cardValue(yours),theirVal:cardValue(theirs),
    totalVal:cardValue(allCards),count:playerWon?theirs.length:yours.length,yourWC:pWC,theirWC:cWC};
}
const SV={"♠":3,"♥":2,"♦":1,"♣":0};
// ── PARKING LOT ──────────────────────────────────────────────────────────────
// FUTURE: "Stuff the ballot box" — give player a thumb on the scale option
//   e.g. occasional card peek, deck stack assist, or slight shuffle bias
// ─────────────────────────────────────────────────────────────────────────────
const RS=new Set(["♥","♦"]);

const DECK_BACK={bg:"linear-gradient(135deg,#1a0030,#3a006a,#1a0030)",border:"#7c3fbf",pat:"repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,.04) 4px,rgba(255,255,255,.04) 8px)",sym:""};
const WAR_SYMBOL="🔱"; // War symbol per round — change this to customize all war displays

const CPU_FAM={name:"CPU",crest:"🤖",color:"#0a1a2a",accent:"#8899ff"};
const PF={name:"Player",crest:"✨",color:"#1a0a2a",accent:"#DAA520"};
const rndCpu=()=>CPU_FAM;
const mkDeck=()=>{const d=[];for(const s of SUITS)for(const r of RANKS)d.push({suit:s,rank:r});return d;};
const shuf=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;};
// Deal alternating — player gets cards 0,2,4… CPU gets 1,3,5…
const dealDeck=d=>{const p=[],c=[];d.forEach((x,i)=>(i%2===0?p:c).push(x));return[p,c];};

// ── QUIPS ──────────────────────────────────────────────────────────────────────
// warQuip: considers the duel cards, the war cards, AND what was in the spoils.
// plSp/cpuSp = the face-down spoil cards from both sides of the war pile.
function warQuip(playerWon,pWC,cWC,pF,cF,plSp,cpuSp){
  const pick=arr=>arr[Math.random()*arr.length|0];
  const pr=pWC?.rank||"?", cr=cWC?.rank||"?";   // war cards
  const prf=pF?.rank||"?", crf=cF?.rank||"?";   // duel cards
  const pvWar=RV[pr]||0, cvWar=RV[cr]||0;
  const pvDuel=RV[prf]||0, cvDuel=RV[crf]||0;
  const duelHigh=pvDuel>=12||cvDuel>=12;
  const duelBig=pvDuel>=10&&cvDuel>=10;
  const an=r=>["A","8"].includes(r)?"an":"a";
  const An=r=>an(r)==="an"?"An":"A";

  // Duel context prefix — only for high-value matched duel cards
  const duelCtx=()=>{
    if(prf==="A") return pick(["Two Aces in the duel — ","Matched Aces on the field — ","Both Aces locked it — "]);
    if(prf==="K") return pick(["Kings clashed in the duel — ","Two Kings, one war — ","Matched Kings — "]);
    if(prf==="Q") return pick(["Queens tied the duel — ","Two Queens sparked this — "]);
    if(prf==="J") return pick(["Jacks triggered this war — ","Matched Jacks — "]);
    if(duelBig)   return pick([`Two ${prf}s forced this — `,`${prf} met ${crf}, war broke out — `]);
    return "";
  };

  // Spoil suffix — what high cards were hiding face-down in the war pile?
  // Winner collects spoils; loser loses them. CPU comments on the loot (or the loss).
  const allSp=[...(plSp||[]),...(cpuSp||[])];
  const spRanks=allSp.map(c=>c.rank);
  const spAces=spRanks.filter(r=>r==="A").length;
  const spKings=spRanks.filter(r=>r==="K").length;
  const spQueens=spRanks.filter(r=>r==="Q").length;
  const spJacks=spRanks.filter(r=>r==="J").length;
  const spFaces=spAces+spKings+spQueens+spJacks;

  const spoilCtx=()=>{
    if(!allSp.length) return "";
    if(playerWon){
      // Player won — CPU mourns / acknowledges what player got
      if(spAces>=2)    return pick([" Two Aces were buried in those spoils. Painful."," You got two Aces in the pot. That hurts."]);
      if(spAces&&spKings) return pick([" An Ace and a King were in there. Costly loss."," The spoils hid an Ace and a King. Ouch."]);
      if(spAces)       return pick([" There was an Ace in those spoils too!"," An Ace was hiding in that pot. Well taken."]);
      if(spKings&&spQueens) return pick([" A King AND a Queen were in those spoils!"," The pot held a King and Queen. Lucky you."]);
      if(spKings>=2)   return pick([" Two Kings were in those spoils!"," You pulled two Kings out of that war."]);
      if(spKings)      return pick([" A King was buried in there too."," There was a King in those spoils. Nice haul."]);
      if(spQueens>=2)  return pick([" Two Queens in the spoils. You're welcome."," You got two Queens from that war."]);
      if(spFaces>=3)   return pick([" The spoils were loaded with royalty."," Three face cards in that pot. Lucky."]);
      if(spFaces>=2)   return pick([" Two face cards hiding in there."," Real value in those spoils."]);
    } else {
      // CPU won — gloats about what it picked up
      if(spAces>=2)    return pick([" Two Aces in the spoils. A magnificent haul."," The pot held two Aces. Mine now."]);
      if(spAces&&spKings) return pick([" An Ace and a King were in there. Splendid."," The spoils had an Ace and a King. Glorious."]);
      if(spAces)       return pick([" And there was an Ace in the spoils. Bonus."," An Ace hiding in the pot. I'll take it."]);
      if(spKings&&spQueens) return pick([" A King and Queen were in those spoils. Royal haul!"," The pot hid a King and a Queen. Magnificent."]);
      if(spKings>=2)   return pick([" Two Kings in the spoils. Remarkable."," I pulled two Kings from that war."]);
      if(spKings)      return pick([" A King was in those spoils too. Excellent."," The pot held a King as well. Worth fighting for."]);
      if(spQueens>=2)  return pick([" Two Queens in the spoils. A fine reward."," Two Queens from that war. Satisfying."]);
      if(spFaces>=3)   return pick([" The spoils were packed with royalty."," Three face cards in that pot. Exceptional."]);
      if(spFaces>=2)   return pick([" Real value hiding in those spoils."," Two face cards in the pot. Good war."]);
    }
    return "";
  };

  if(playerWon){
    const ctx=duelHigh?duelCtx():"";
    if(pr==="A"&&cr==="A") return ctx+pick(["Both Aces! Suit settled it. Well played.","Two Aces — yours wins on suit. Brutal.","Suit decides between Aces. Yours wins."])+spoilCtx();
    if(pr==="A")  return ctx+pick([`Your Ace crushes my ${cr}. ${duelHigh?"Doubly stings.":"Ouch."}`,`An Ace vs my ${cr}. ${duelHigh?"After those duel cards too!":"No contest."}`,`Nice Ace. My ${cr} had no answer.`])+spoilCtx();
    if(pr==="K")  return ctx+pick([`Your King takes my ${cr}. ${duelHigh?"A royal finish!":"Well played."}`,`A King! My ${cr} falls.`,`Your King over my ${cr}. I concede.`])+spoilCtx();
    if(pr==="Q")  return ctx+pick([`Your Queen outranks my ${cr}.`,`A Queen takes my ${cr}. ${duelHigh?"After that duel too!":"Fine."}`,`Your Queen, my ${cr}. You win.`])+spoilCtx();
    if(pr==="J")  return ctx+pick([`Your Jack beats my ${cr}. Every rank counts.`,`A Jack takes my ${cr}. Stings.`,`Fine — your Jack wins.`])+spoilCtx();
    if(pvWar>cvWar) return ctx+pick([`Your ${pr} over my ${cr}. ${duelHigh?"Big pot, well earned.":"You win this round."}`,`${pr} beats ${cr}. Well fought.`,`Your ${pr} claims my ${cr}.`])+spoilCtx();
    return ctx+pick([`You take it with ${an(pr)} ${pr}. ${duelHigh?"Quite the war.":"Surprising."}`,`${pr} wins the war. ${duelBig?"Both duellists paid.":"I underestimated you."}`,`Your ${pr} vs my ${cr}. Earned it.`])+spoilCtx();
  } else {
    const ctx=duelHigh?duelCtx():"";
    if(cr==="A"&&pr==="A") return ctx+pick(["Both Aces — mine wins on suit. Superior.","Two Aces, mine takes it. Inevitable.","Suit settles Aces. Mine wins."])+spoilCtx();
    if(cr==="A")  return ctx+pick([`My Ace takes your ${pr}. ${duelHigh?"A worthy pot.":"Nothing personal."}`,`${An("A")} Ace vs your ${pr}. ${duelHigh?"After those duel cards — glorious!":"I'll take it."}`,`Your ${pr} vs my Ace. No contest.`])+spoilCtx();
    if(cr==="K")  return ctx+pick([`My King takes your ${pr}. ${duelHigh?"A royal haul!":"Long live the King!"}`,`A King — your ${pr} is mine now. ${duelHigh?"Worth every spoil.":"Expected."}`,`Your ${pr} falls to my King.`])+spoilCtx();
    if(cr==="Q")  return ctx+pick([`My Queen claims your ${pr}. ${duelHigh?"Fitting end!":"Splendid."}`,`A Queen! Your ${pr} was never enough.`,`My Queen outranks your ${pr}.`])+spoilCtx();
    if(cr==="J")  return ctx+pick([`My Jack takes your ${pr}. ${duelHigh?"Surprising, after those cards!":"Every card counts."}`,`A Jack beats your ${pr}. Barely, but it counts.`,`Your ${pr} loses to my Jack.`])+spoilCtx();
    if(cvWar>pvWar) return ctx+pick([`My ${cr} over your ${pr}. ${duelHigh?"Big pot — mine.":"Mine!"}`,`${cr} beats ${pr}. ${duelBig?"Those duel cards made it worth it.":"I'll take it."}`,`Your ${pr} vs my ${cr}. I win.`])+spoilCtx();
    return ctx+pick([`I take it with ${an(cr)} ${cr}. ${duelHigh?"What a war.":"Better luck next time."}`,`My ${cr} beats your ${pr}. ${duelBig?"We both paid for this.":"The war is mine."}`,`Your ${pr} vs my ${cr}. Mine.`])+spoilCtx();
  }
}

// ── AUDIO ──────────────────────────────────────────────────────────────────────
function sfxClash(ctx,v,vol){const n=ctx.currentTime,g=ctx.createGain();g.connect(ctx.destination);g.gain.setValueAtTime(vol*.9,n);g.gain.exponentialRampToValueAtTime(.001,n+.8);[[1200,800,400],[900,1400,600],[1500,700,350]][v%3].forEach((f,i)=>{const o=ctx.createOscillator(),h=ctx.createGain();o.connect(h);h.connect(g);o.type="sawtooth";o.frequency.setValueAtTime(f,n);o.frequency.exponentialRampToValueAtTime(f*.1,n+.6);h.gain.setValueAtTime(.3/(i+1),n);h.gain.exponentialRampToValueAtTime(.001,n+.6);o.start(n+i*.02);o.stop(n+.6);});}
function sfxWhoosh(ctx,vol){const n=ctx.currentTime,bs=ctx.sampleRate*.3,buf=ctx.createBuffer(1,bs,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<bs;i++)d[i]=(Math.random()*2-1)*(1-i/bs);const s=ctx.createBufferSource();s.buffer=buf;const f=ctx.createBiquadFilter();f.type="bandpass";f.frequency.value=800;const g=ctx.createGain();g.gain.setValueAtTime(vol*.2,n);g.gain.exponentialRampToValueAtTime(.001,n+.3);s.connect(f);f.connect(g);g.connect(ctx.destination);s.start(n);}
function sfxFanfare(ctx,vol){const n=ctx.currentTime;[523,659,784,1047].forEach((freq,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type="square";o.frequency.value=freq;g.gain.setValueAtTime(0,n+i*.12);g.gain.linearRampToValueAtTime(vol*.25,n+i*.12+.05);g.gain.exponentialRampToValueAtTime(.001,n+i*.12+.3);o.start(n+i*.12);o.stop(n+i*.12+.4);});}
function sfxDrum(ctx,vol){const n=ctx.currentTime;for(let i=0;i<3;i++){const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type="sine";o.frequency.setValueAtTime(120,n+i*.2);o.frequency.exponentialRampToValueAtTime(40,n+i*.2+.15);g.gain.setValueAtTime(vol*.7,n+i*.2);g.gain.exponentialRampToValueAtTime(.001,n+i*.2+.2);o.start(n+i*.2);o.stop(n+i*.2+.25);}}
function sfxDefeat(ctx,vol){const n=ctx.currentTime;[400,350,300,250].forEach((freq,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type="sine";o.frequency.value=freq;g.gain.setValueAtTime(0,n+i*.18);g.gain.linearRampToValueAtTime(vol*.3,n+i*.18+.06);g.gain.exponentialRampToValueAtTime(.001,n+i*.18+.35);o.start(n+i*.18);o.stop(n+i*.18+.45);});}

// ── PIPS ───────────────────────────────────────────────────────────────────────
const PIPS={"2":[[1,0],[1,6]],"3":[[1,0],[1,3],[1,6]],"4":[[0,0],[2,0],[0,6],[2,6]],"5":[[0,0],[2,0],[1,3],[0,6],[2,6]],"6":[[0,0],[2,0],[0,3],[2,3],[0,6],[2,6]],"7":[[0,0],[2,0],[0,3],[2,3],[1,1],[0,6],[2,6]],"8":[[0,0],[2,0],[0,3],[2,3],[1,1],[1,5],[0,6],[2,6]],"9":[[0,0],[2,0],[0,2],[2,2],[1,3],[0,4],[2,4],[0,6],[2,6]],"10":[[0,0],[2,0],[0,2],[2,2],[1,1],[1,5],[0,4],[2,4],[0,6],[2,6]]};
// PIP_SZ: global pip suit sizes — all cards reference this so collection pile and
// battlefield cards stay visually consistent. Use collection pile (no size flag) as model.
const PIP_SZ={sm:9, md:19, lg:24};
function Pips({rank,suit,color,small,med}){
  const ps=small?PIP_SZ.sm:med?PIP_SZ.md:PIP_SZ.lg;
  if(["J","Q","K"].includes(rank))return(<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:2}}>
    <div style={{fontSize:small?11:med?20:26,color,lineHeight:1}}>{rank==="K"?"♚":rank==="Q"?"♛":"♞"}</div>
    <div style={{fontSize:small?13:med?22:28,color,lineHeight:1}}>{suit}</div>
  </div>);
  if(rank==="A")return(<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:small?15:med?30:37,color}}>{suit}</div></div>);
  const cols=["17%","50%","83%"],rows=["26%","35%","43%","50%","57%","65%","74%"];
  return(<div style={{position:"absolute",inset:0}}>{(PIPS[rank]||[]).map(([c,r],i)=>(<div key={i} style={{position:"absolute",left:cols[c],top:rows[r],transform:"translate(-50%,-50%)",fontSize:ps,color,lineHeight:1,userSelect:"none"}}>{suit}</div>))}</div>);
}

// ── CARD BACK ──────────────────────────────────────────────────────────────────
function CardBack({small,med,sx={}}){
  const W=small?27:med?60:47,H=small?39:med?87:68;
  return(<div style={{width:W,height:H,borderRadius:7,flexShrink:0,overflow:"hidden",position:"relative",background:DECK_BACK.bg,border:`2px solid ${DECK_BACK.border}66`,boxShadow:"0 3px 8px rgba(0,0,0,.5)",...sx}}><div style={{position:"absolute",inset:3,border:`1px solid ${DECK_BACK.border}44`,borderRadius:5,background:DECK_BACK.pat,display:"flex",alignItems:"center",justifyContent:"center",fontSize:small?10:med?24:18,color:`${DECK_BACK.border}cc`}}>{DECK_BACK.sym}</div></div>);
}

// ── CARD SLOT ──────────────────────────────────────────────────────────────────
function CardSlot({small,med,label}){
  const W=small?27:med?60:47,H=small?39:med?87:68;
  return(<div style={{width:W,height:H,borderRadius:7,flexShrink:0,border:"2px dashed rgba(255,100,100,.25)",background:"rgba(255,50,50,.02)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:2}}>{label&&<div style={{fontSize:6,color:"rgba(255,150,150,.32)",textAlign:"center",lineHeight:1.2}}>{label}</div>}</div>);
}

// ── PLAYING CARD ───────────────────────────────────────────────────────────────
// small=27×39  med=60×87  default=47×68
function Card({card,faceDown=false,glow=null,small=false,med=false,sx={}}){
  const isRed=card&&RS.has(card.suit);
  const W=small?27:med?60:47, H=small?39:med?87:68;
  const col=isRed?"#c0392b":"#1c1c3a";
  const rf=small?RANK_FONT.small:med?RANK_FONT.med:RANK_FONT.def;
  const shadow=glow==="win"?"0 0 18px 7px #22c55e,0 0 36px 12px rgba(34,197,94,.4),0 4px 12px rgba(0,0,0,.6)":glow==="lose"?"0 0 18px 7px #e74c3c,0 0 36px 12px rgba(231,76,60,.4),0 4px 12px rgba(0,0,0,.6)":glow==="dw2"?"0 0 18px 7px #cc44ff,0 0 36px 12px rgba(180,0,255,.4),0 4px 12px rgba(0,0,0,.6)":glow==="tie"?"0 0 18px 7px #f97316,0 0 36px 12px rgba(249,115,22,.4),0 4px 12px rgba(0,0,0,.6)":"0 4px 14px rgba(0,0,0,.65)";
  const bc=glow==="win"?"#22c55e":glow==="lose"?"#e74c3c":glow==="dw2"?"#cc44ff":glow==="tie"?"#f97316":"rgba(139,90,43,.35)";
  const base={width:W,height:H,borderRadius:7,flexShrink:0,position:"relative",boxShadow:shadow,border:`2px solid ${bc}`,transition:"box-shadow .3s,border-color .3s",...sx};
  if(faceDown)return <CardBack small={small} med={med} sx={base}/>;
  if(!card)return <div style={{...base,background:"rgba(255,255,255,.02)",boxShadow:"none",border:"2px dashed rgba(255,255,255,.08)"}}/>;
  return(<div style={{...base,background:"linear-gradient(145deg,#fefaf0,#f5e8cc)"}}>
    <div style={{position:"absolute",top:3,left:4,display:"flex",flexDirection:"column",alignItems:"flex-start",userSelect:"none"}}>
      <div style={{fontSize:rf,fontWeight:"bold",color:col,lineHeight:1.1}}>{card.rank}</div>
      {["J","Q","K","A"].includes(card.rank)&&<div style={{fontSize:rf*0.75,fontWeight:"bold",color:col,opacity:.85,lineHeight:1}}>{card.suit}</div>}
    </div>
    <div style={{position:"absolute",bottom:3,right:4,display:"flex",flexDirection:"column-reverse",alignItems:"flex-end",transform:"rotate(180deg)",userSelect:"none"}}>
      <div style={{fontSize:rf,fontWeight:"bold",color:col,lineHeight:1.1}}>{card.rank}</div>
      {["J","Q","K","A"].includes(card.rank)&&<div style={{fontSize:rf*0.75,fontWeight:"bold",color:col,opacity:.85,lineHeight:1}}>{card.suit}</div>}
    </div>
    <Pips rank={card.rank} suit={card.suit} color={col} small={small} med={med}/>
  </div>);
}

// ── DRAW PILE ──────────────────────────────────────────────────────────────────
function DrawPile({count,onTap,tappable,fam,side,cascade="up",showDisc=true,small=false,med=false}){
  const W=small?27:med?47:60, H=small?39:med?68:87;
  const layers=count>0?((count-1)%3)+1:0;
  const ac=fam?.accent||"#DAA520";
  const handleClick=()=>{
    if(!tappable)return;
    onTap&&onTap();
  };
  return(
    <div style={{display:"flex",flexDirection:side==="left"?"row":"row-reverse",alignItems:"center",gap:10}}>
      <div style={{position:"relative",cursor:tappable&&count>0?"pointer":"default",width:W,height:H+layers*3}} onClick={handleClick}>
        {layers===0?(
          <div style={{position:"absolute",top:0,left:0,width:W,height:H,borderRadius:6,border:"2px dashed rgba(255,255,255,.1)",background:"rgba(0,0,0,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:18,opacity:.15}}>🂠</div>
          </div>
        ):(
          Array.from({length:layers}).map((_,i)=>{
            // i=0=back, i=layers-1=top (yOff=0, zIndex=layers)
            const isTop=i===layers-1;
            const yOff=(layers-1-i)*3;
            return(
              <div key={i} style={{position:"absolute",top:yOff,left:0,zIndex:i+1,width:W,height:H,borderRadius:6,
                overflow:"hidden",
                background:DECK_BACK.bg,
                border:`2px solid ${isTop&&tappable?ac:DECK_BACK.border+(isTop?"99":"44")}`,
                boxShadow:isTop&&tappable?`0 0 14px 4px ${ac}66,0 3px 8px rgba(0,0,0,.6)`:`0 ${2+i}px ${4+i}px rgba(0,0,0,.3)`}}>
                <div style={{position:"absolute",inset:3,border:`1px solid ${DECK_BACK.border}44`,borderRadius:4,
                  background:DECK_BACK.pat,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:13,color:`${DECK_BACK.border}cc`}}>{DECK_BACK.sym}</div>
              </div>
            );
          })
        )}
        {count>0&&<div style={{position:"absolute",top:H-22,right:6,zIndex:30,
          background:`linear-gradient(135deg,${fam?.color||"#1a1a1a"}ee,${fam?.accent||"#555"}ee)`,
          border:`1.5px solid ${ac}`,borderRadius:5,
          minWidth:22,height:20,padding:"0 5px",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:10,fontWeight:"bold",color:"#fff",
          boxShadow:`0 0 6px 1px ${ac}55,0 1px 4px rgba(0,0,0,.9)`,
          backdropFilter:"blur(3px)"}}>{count}</div>}
      </div>
      {/* Disc + name — suppressed when showDisc=false (base rows render it separately) */}
      {showDisc&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <div style={{width:40,height:40,borderRadius:"50%",
          background:`linear-gradient(135deg,${fam?.color||"#333"},${fam?.accent||"#888"}44)`,
          border:`3px solid ${ac}`,display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:17,boxShadow:"0 4px 12px rgba(0,0,0,.5)"}}>{fam?.crest||"🛡️"}</div>
        <div style={{color:ac,fontSize:7,textAlign:"center",maxWidth:56,lineHeight:1.3}}>{fam?.name}</div>
      </div>}
    </div>
  );
}


// ── COLLECT PILE ───────────────────────────────────────────────────────────────
// Face-up won cards. Grows visual stack like DrawPile. Top-aligned.
function CollectPile({cards,topCard,fam,onTap,small=false,med=false,pulse=false}){
  const W=small?27:med?47:60, H=small?39:med?68:87;
  const ac=fam?.accent||"#DAA520";
  const count=cards.length;
  const layers=count>0?((count-1)%3)+1:0;
  // Use explicitly tracked topCard (last winning duel card) for the face
  const top=topCard||null;
  const isRed=top&&RS.has(top.suit);
  const col=isRed?"#c0392b":"#1c1c3a";
  // pulse: glow when this is the only available tap target (e.g. draw empty during war_reveal)
  const pulseStyle=pulse?{animation:"collectPulse 1s ease-in-out infinite",boxShadow:"0 0 16px 5px #DAA52099"}:{};
  // Total height matches DrawPile so tops align
  return(
    <div onClick={onTap||undefined} style={{position:"relative",width:W,height:H+layers*3,flexShrink:0,cursor:onTap?"pointer":"default"}}>
      {count===0?(
        <div style={{position:"absolute",top:0,left:0,width:W,height:H,borderRadius:6,
          border:pulse?"2px dashed #DAA520":"2px dashed rgba(255,255,255,.1)",
          background:pulse?"rgba(218,165,32,.08)":"rgba(0,0,0,.2)",
          display:"flex",alignItems:"center",justifyContent:"center",
          flexDirection:"column",gap:3,...pulseStyle}}>
          {pulse?<><div style={{fontSize:14}}>👆</div><div style={{fontSize:6,color:"#DAA520",letterSpacing:.5,textAlign:"center",lineHeight:1.3}}>COLLECT</div></>
          :<div style={{fontSize:15,opacity:.15}}>🂠</div>}
        </div>
      ):(
        Array.from({length:layers}).map((_,i)=>{
          // i=0 is the BACK card (highest yOff), i=layers-1 is the TOP card (yOff=0, renders last = on top)
          const isTop=i===layers-1;
          const yOff=(layers-1-i)*3;
          return(
            <div key={i} style={{position:"absolute",top:yOff,left:0,zIndex:i+1,
              width:W,height:H,borderRadius:6,overflow:isTop?"visible":"hidden",
              border:`2px solid ${isTop?"rgba(139,90,43,.75)":"rgba(139,90,43,.25)"}`,
              boxShadow:isTop?"0 3px 14px rgba(0,0,0,.6)":`0 ${2+i}px ${4+i}px rgba(0,0,0,.3)`,
              background:"linear-gradient(145deg,#fefaf0,#f5e8cc)"}}>
              {isTop&&top&&(<>
                <div style={{position:"absolute",top:2,left:3,fontSize:RANK_FONT.med,fontWeight:"bold",color:col,lineHeight:1.1,userSelect:"none"}}>{top.rank}</div>
                <div style={{position:"absolute",bottom:2,right:3,fontSize:RANK_FONT.med,fontWeight:"bold",color:col,lineHeight:1.1,transform:"rotate(180deg)",userSelect:"none"}}>{top.rank}</div>
                <Pips rank={top.rank} suit={top.suit} color={col}/>
              </>)}
            </div>
          );
        })
      )}
      {count>0&&(
        <div style={{position:"absolute",top:H-22,right:6,zIndex:30,
          background:`linear-gradient(135deg,${fam?.color||"#1a1a1a"}ee,${fam?.accent||"#555"}ee)`,
          border:`1.5px solid ${ac}`,borderRadius:5,
          minWidth:22,height:20,padding:"0 5px",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:10,fontWeight:"bold",color:"#fff",
          boxShadow:`0 0 6px 1px ${ac}55,0 1px 4px rgba(0,0,0,.9)`}}>{count}</div>
      )}
    </div>
  );
}

// ── WAR SPOILS ROW ─────────────────────────────────────────────────────────────
function WarRow({spoils,warCard,revealed,glow,isPlayer,fam}){
  const slots=[];
  if(!isPlayer){
    for(let i=0;i<3;i++){const c=spoils[i]||null;slots.push({key:`s${i}`,card:c,fd:!revealed,lbl:c?null:`S${i+1}`,isW:false});}
    slots.push({key:"w",card:warCard,fd:false,lbl:warCard?null:"WAR",isW:true,glow});
  } else {
    slots.push({key:"w",card:warCard,fd:false,lbl:warCard?null:"WAR",isW:true,glow});
    for(let i=2;i>=0;i--){const c=spoils[i]||null;slots.push({key:`s${i}`,card:c,fd:!revealed,lbl:c?null:`S${i+1}`,isW:false});}
  }
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
      <div style={{fontSize:6,color:fam?.accent||"#aaa",letterSpacing:1}}>{fam?.crest} {fam?.name}</div>
      <div style={{display:"flex",gap:3,alignItems:"flex-end"}}>
        {slots.map(s=>s.card?<Card key={s.key} card={s.card} faceDown={s.fd} glow={s.isW?s.glow:null} med/>:<CardSlot key={s.key} med label={s.lbl}/>)}
      </div>
    </div>
  );
}

// ── FLIP CARD ────────────────────────────────────────────────────────────────
// Must be defined OUTSIDE Battlefield so React sees a stable component type
// across renders. If defined inside, every Battlefield re-render creates a new
// function reference → React treats it as a different type → unmount+remount
// every frame → infinite animation restart.
//
// The key prop at the call site (sl.k + revealed) changes exactly once when
// revealed flips true, causing a single DOM remount → animation plays once and stops.
function FlipCard({card,isSpoil,glow,revealIdx,revealed,forceFaceDown=false}){
  return(
    // isolation:isolate creates a stacking context so the animation transform
    // cannot escape into the parent layout. contain:layout prevents the
    // animated box from influencing ancestor flex sizing during the flip.
    // Explicit 60×87 (med size) ensures the wrapper never collapses under contain:layout.
    <div style={{flexShrink:0,width:60,height:87,
      isolation:"isolate",contain:"layout",
      animation:(!forceFaceDown&&isSpoil&&revealed)
        ?`cardFlip .45s ease-in-out ${revealIdx*200}ms 1 forwards`
        :"none"}}>
      <Card card={card} faceDown={forceFaceDown||(isSpoil&&!revealed)} glow={glow} med/>
    </div>
  );
}

// ── GHOST SLOT & WAR PATH ROW ─────────────────────────────────────────────────
// TOP-LEVEL — must NOT be defined inside Battlefield or any render fn.
// If defined inside a render fn, React sees a new type each render,
// unmounts+remounts every instance, and CSS animations restart infinitely.
function Ghost({label}){
  return(
    <div style={{width:60,height:87,flexShrink:0,borderRadius:6,
      border:"1px dashed rgba(255,255,255,.08)",background:"rgba(255,255,255,.01)",
      display:"flex",alignItems:"center",justifyContent:"center"}}>
      {label&&<span style={{fontSize:8,color:"rgba(255,255,255,.1)"}}>{label}</span>}
    </div>
  );
}

// ── MERCY SLOT ───────────────────────────────────────────────────────────────
function MercySlot({empty=false}){
  const W=60,H=87;
  if(empty) return(
    <div style={{width:W,height:H,borderRadius:7,flexShrink:0,
      border:"2px dashed rgba(160,100,255,.5)",
      background:"rgba(80,0,160,.07)",
      display:"flex",alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:3,
      boxShadow:"0 0 8px 2px rgba(120,0,255,.12) inset"}}>
      <div style={{fontSize:16,lineHeight:1}}>🃏</div>
      <div style={{fontSize:5.5,color:"rgba(180,140,255,.85)",fontWeight:"bold",
        letterSpacing:.4,textAlign:"center",lineHeight:1.4}}>NO<br/>CARDS</div>
    </div>
  );
  return(
    <div style={{width:W,height:H,borderRadius:7,flexShrink:0,
      border:"2px dashed rgba(255,80,80,.55)",
      background:"rgba(255,30,30,.07)",
      display:"flex",alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:3,
      boxShadow:"0 0 8px 2px rgba(255,60,60,.15) inset"}}>
      <div style={{fontSize:14,lineHeight:1}}>⚠️</div>
      <div style={{fontSize:6,color:"rgba(255,120,120,.8)",fontWeight:"bold",
        letterSpacing:.5,textAlign:"center",lineHeight:1.3}}>MERCY</div>
    </div>
  );
}
function WarTrophy({count,target,accent,W,H}){
  // Renders an SVG trophy sized exactly to the card (W×H).
  // In race mode: Win count stacked above a rule above the goal (Win|Goal).
  // In classic mode: raw count over cup center.
  const isRace=target!=null;
  return(
    <div style={{position:"relative",width:W,height:H,flexShrink:0}}>
      <svg viewBox="0 0 60 87" width={W} height={H} style={{display:"block"}}>
        {/* Cup body */}
        <path d="M18 8 Q15 36 22 46 Q28 54 30 55 Q32 54 38 46 Q45 36 42 8 Z"
          fill={accent} opacity={.85}/>
        {/* Handles */}
        <path d="M18 12 Q8 12 8 22 Q8 32 18 30" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity={.7}/>
        <path d="M42 12 Q52 12 52 22 Q52 32 42 30" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity={.7}/>
        {/* Stem */}
        <rect x="27" y="55" width="6" height="10" fill={accent} opacity={.75}/>
        {/* Plaque base */}
        <rect x="16" y="65" width="28" height="14" rx="3" fill={accent} opacity={.7}/>
        {/* Plaque text "wars" — clipped inside plaque area */}
        <text x="30" y="75" textAnchor="middle" fill="#1a0a00" fontSize="7" fontWeight="bold" fontFamily="Georgia,serif" letterSpacing="0.5">wars</text>
        {/* Shine on cup */}
        <ellipse cx="26" cy="22" rx="3" ry="6" fill="white" opacity={.18}/>
      </svg>
      {/* Count badge overlaid on cup center */}
      {isRace?(
        // Race mode: Win stacked above divider line above Goal
        <div style={{position:"absolute",top:"12%",left:"50%",transform:"translateX(-50%)",
          textAlign:"center",userSelect:"none",pointerEvents:"none",minWidth:W*0.6}}>
          <div style={{fontSize:14,fontWeight:"bold",color:"#1a0a00",lineHeight:1,
            textShadow:"0 1px 2px rgba(255,255,255,.3)"}}>{count}</div>
          <div style={{width:"80%",margin:"1px auto",borderTop:"1.5px solid rgba(0,0,0,.4)"}}/>
          <div style={{fontSize:11,fontWeight:"bold",color:"#1a0a00",lineHeight:1,
            textShadow:"0 1px 2px rgba(255,255,255,.3)"}}>{target}</div>
        </div>
      ):(
        <div style={{position:"absolute",top:"22%",left:"50%",transform:"translateX(-50%)",
          fontSize:13,fontWeight:"bold",color:"#1a0a00",lineHeight:1,textAlign:"center",
          textShadow:"0 1px 2px rgba(255,255,255,.3)",userSelect:"none",pointerEvents:"none",
          minWidth:W*0.5}}>
          {count}
        </div>
      )}
    </div>
  );
}
function WarPathRow({spoils,warCard,glow,isPlayer,fam,inWar,pathBg,pathBorder,revealed,warCollect,rw,pol,carpetDelta,warCardRef,onAnimDone,mercySpoils,dw2Sp,dw2W,dw2Revealed,dw2Round}){
  // Slots always show War 1 cards face-up (spoils revealed, warCard face-up).
  // During double war, dw2 cards render as per-slot overlays on top (see below).
  const inDw2 = (dw2Sp&&dw2Sp.length>0)||!!dw2W||dw2Round>0;
  const s=Array.from({length:3},(_,i)=>spoils[i]||null);
  const slots=[
    {k:"s0",card:s[0],lbl:"S1",isSpoil:true, revealIdx:0,g:null,faceDown:false},
    {k:"s1",card:s[1],lbl:"S2",isSpoil:true, revealIdx:1,g:null,faceDown:false},
    {k:"s2",card:s[2],lbl:"S3",isSpoil:true, revealIdx:2,g:null,faceDown:false},
    {k:"w", card:warCard,lbl:"W",isSpoil:false,revealIdx:3,g:glow,faceDown:false},
  ];
  const collecting = !!warCollect; // any collect phase
  const carpetFly = warCollect==="carpet"||warCollect==="fight"||warCollect==="duelfly";
  // Direction war pile flies in carpet phase: toward winner's fight card side
  // playerWon + pol=true(right) → right (+X). playerWon + pol=false(left) → left (-X).
  // cpuWon → opposite.
  const carpetTX = carpetFly ? (carpetDelta?.dx||0) : 0;
  const carpetTY = carpetFly ? (carpetDelta?.dy||0) : 0;
  return(
    <div style={{
      flex:1,minHeight:0,width:"100%",
      background:pathBg,transition:"background .4s",
      display:"flex",flexDirection:"column",
      overflow:carpetFly?"visible":"hidden",
      position:"relative",
      borderTop:isPlayer?`1px solid ${pathBorder}`:"none",
      borderBottom:isPlayer?"none":`1px solid ${pathBorder}`,
    }}>
      <div style={{flex:1,display:"flex",alignItems:"center",
        justifyContent:"center",
        gap:4,padding:"0 8px",overflow:carpetFly?"visible":"hidden",
        transition:carpetFly?"transform .32s cubic-bezier(.4,0,.2,1), opacity .25s ease-in 80ms":"none",
        transform:`translateX(${carpetTX}px) translateY(${carpetTY}px)`,
        opacity:carpetFly?0:1}}
        onTransitionEnd={e=>{
          if(carpetFly&&e.propertyName==="transform"&&warCollect==="carpet"&&onAnimDone)
            onAnimDone("carpet");
        }}>
        {slots.map(sl=>{
          // LAYERED COLLAPSE: each spoil slides RIGHT under the next card.
          // Med card = 80px + 4px gap = 84px per slot.
          // z-index: War=10, S3=3, S2=2, S1=1 → each card goes UNDER the one to its right.
          // Stagger: S1 starts first (delay=0), S2 at 120ms, S3 at 240ms.
          // Each slides all the way to War card position (right-anchored).
          // Opacity stays 1 so you see them sliding under — they vanish behind W.
          const travelX = sl.isSpoil ? (3 - sl.revealIdx) * 84 : 0;
          const colDelay = sl.isSpoil ? sl.revealIdx * 120 : 0;
          // z-index: when collecting, spoils go LOW (behind next card to right)
          // War card stays on top so spoils visually slide underneath it.
          const zIdx = collecting
            ? (sl.isSpoil ? sl.revealIdx + 1 : 10)   // S1=1, S2=2, S3=3, W=10
            : (sl.isSpoil ? 4 - sl.revealIdx : 5);   // normal: S1=4 on top, W=5
          return sl.card
            ?<div key={`wrap-${sl.k}`} ref={!sl.isSpoil?warCardRef:null} style={{
                flexShrink:0,
                position:"relative",
                zIndex: zIdx,
                transition:sl.isSpoil&&collecting
                  ?`transform .28s cubic-bezier(.4,0,.2,1) ${colDelay}ms`
                  :"none",
                transform:sl.isSpoil&&collecting
                  ?`translateX(${travelX}px)`
                  :"translateX(0)",
              }}
              onTransitionEnd={e=>{
                // Fire "spoils" step only from the last actual spoil's transform end
                if(sl.isSpoil&&e.propertyName==="transform"&&warCollect==="spoils"&&onAnimDone){
                  const lastIdx=spoils.length-1;
                  if(sl.revealIdx===lastIdx) onAnimDone("spoils");
                }
              }}>
                <FlipCard key={`${sl.k}-${revealed?1:0}`}
                  card={sl.card} isSpoil={sl.isSpoil} glow={sl.g}
                  revealIdx={sl.revealIdx} revealed={revealed}/>
                {/* dw2 overlay: spoils use FlipCard for flip animation on reveal; W card always face-up */}
                {inDw2&&(sl.isSpoil?(dw2Sp?.[sl.revealIdx]!=null):(dw2W!=null))&&(
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {sl.isSpoil
                      ?<FlipCard key={`dw2-${sl.k}-r${dw2Round}-${dw2Revealed?1:0}`}
                          card={dw2Sp[sl.revealIdx]}
                          isSpoil={true}
                          glow={null}
                          revealIdx={sl.revealIdx}
                          revealed={dw2Revealed}/>
                      :<Card card={dw2W} faceDown={false} glow={dw2Revealed?(rw&&rw!=="tie"?(isPlayer?(rw==="player"?"win":"lose"):(rw==="cpu"?"win":"lose")):"tie"):null} med/>
                    }
                  </div>
                )}

              </div>
            :(inWar?(()=>{
              // mercy slot: this index was skipped because pile was too short
              const isMercy = sl.isSpoil && (mercySpoils===-1 || (mercySpoils>0 && sl.revealIdx>=mercySpoils));
              if(isMercy) return <MercySlot key={sl.k} empty={mercySpoils===-1}/>;

              return <Ghost key={sl.k} label={sl.lbl}/>;
            })():null);
        })}

      </div>
    </div>
  );
}

// ── BATTLEFIELD ────────────────────────────────────────────────────────────────
// 3 rows:
//   1. CPU War Carpet  — full width horizontal lane
//   2. Fight Row       — [CPU Card] [Message Centre] [Player Card]
//   3. Player War Carpet — full width horizontal lane
function Battlefield({bf,cpuFam,plFam,quip,pol,pCollectRef:pCRef,cCollectRef:cCRef,dealIntro,introDelt,introTotal,onDealClick,onAnimDone,animStepRef,CW=60,CH=87,csSmall=false,csMed=false,csLg=true,pTotal=0,cTotal=0,potCards=0}){
  // Refs for measuring carpet→fight-card distance
  const cpuFightRef=useRef(null);   // winner fight card slot (cpu side)
  const plFightRef=useRef(null);    // winner fight card slot (player side)
  const cpuWarRef=useRef(null);     // cpu carpet war-card position
  const plWarRef=useRef(null);      // player carpet war-card position
  const [cpuCarpetDelta,setCpuCarpetDelta]=useState({dx:0,dy:0});
  const [plCarpetDelta,setPlCarpetDelta]=useState({dx:0,dy:0});
  const [duelDelta,setDuelDelta]=useState({dx:0,dy:0});

  useEffect(()=>{
    if(bf.warCollect==="carpet"){
      // Carpet rows fly to winner's fight card slot
      const winnerRef=bf.rw==="player"?plFightRef:cpuFightRef;
      if(!winnerRef.current||!cpuWarRef.current||!plWarRef.current)return;
      const wR=winnerRef.current.getBoundingClientRect();
      const cR=cpuWarRef.current.getBoundingClientRect();
      const pR=plWarRef.current.getBoundingClientRect();
      setCpuCarpetDelta({dx:wR.left-cR.left, dy:wR.top-cR.top});
      setPlCarpetDelta ({dx:wR.left-pR.left, dy:wR.top-pR.top});
      // Pre-measure duelfly delta (fight card → winner's collect pile) while layout is stable
      const collectRef=bf.rw==="player"?pCRef:cCRef;
      const fightRef=bf.rw==="player"?plFightRef:cpuFightRef;
      if(collectRef?.current&&fightRef.current){
        const dest=collectRef.current.getBoundingClientRect();
        const fR=fightRef.current.getBoundingClientRect();
        setDuelDelta({dx:dest.left-fR.left, dy:dest.top-fR.top});
      }
    }
  },[bf.warCollect, bf.rw, pCRef, cCRef]);
  const {phase,cpuF,plF,cpuSp,plSp,cpuW,plW,rw,revealed,pot,warCollect,warInfo,fightSlide,mercySpoils,dw2PlSp,dw2CpuSp,dw2PlW,dw2CpuW,dw2Round}=bf;
  const duelFly=warCollect==="duelfly";
  const inWar=["war","war_card","war_reveal","double_reveal","double_war","double_war_card"].includes(phase)||(phase==="collecting"&&warCollect!==null);
  const inDouble=phase==="double_reveal"||phase==="double_war"||phase==="double_war_card";

  const fpg=phase==="resolve"&&plF&&cpuF?(RV[plF.rank]>RV[cpuF.rank]?"win":null):null;
  const fcg=phase==="resolve"&&plF&&cpuF?(RV[cpuF.rank]>RV[plF.rank]?"win":null):null;
  // warTie: War-1 cards (plW/cpuW) glow orange throughout all dw2 phases until winner is revealed
  const warTie=(phase==="double_war"||phase==="double_war_card")&&plW&&cpuW&&(rw===null||rw==="tie");
  const wpg=warTie?"tie":((phase==="war_reveal"||phase==="double_reveal")&&plW&&cpuW&&rw&&rw!=="tie"?(rw==="player"?"win":"lose"):null);
  const wcg=warTie?"tie":((phase==="war_reveal"||phase==="double_reveal")&&plW&&cpuW&&rw&&rw!=="tie"?(rw==="cpu"?"win":"lose"):null);

  const borderCol=inDouble?"#ff9900":inWar?"#f33":"rgba(218,165,32,.25)";
  const glowShadow=inDouble?"0 0 28px 8px rgba(255,140,0,.3)":inWar?"0 0 28px 8px rgba(255,50,50,.28)":"0 0 12px rgba(0,0,0,.6)";
  const warAccent=inDouble?"#ffaa00":"#ff5555";
  const warGlow=inDouble?"0 0 10px #ffaa00":"0 0 10px #ff3333";
  const pathBg=inWar?(inDouble?"rgba(80,30,0,.4)":"rgba(80,0,0,.35)"):"rgba(255,255,255,.015)";
  const pathBorder=inWar?(inDouble?"rgba(255,140,0,.25)":"rgba(255,80,80,.2)"):"rgba(255,255,255,.05)";


  return(
    <div style={{
      background:"linear-gradient(180deg,rgba(14,6,30,.97),rgba(30,14,6,.97),rgba(14,6,30,.97))",
      border:`2px solid ${borderCol}`,borderRadius:14,
      boxShadow:glowShadow,transition:"border .4s,box-shadow .4s",
      display:"flex",flexDirection:"column",alignItems:"stretch",
      flex:1,minHeight:0,overflow:"hidden",
    }}>

      {/* Row 1 — CPU War Carpet (full width) */}
      <WarPathRow spoils={cpuSp} warCard={cpuW} glow={wcg} isPlayer={false} fam={cpuFam} inWar={inWar} pathBg={pathBg} pathBorder={pathBorder} revealed={revealed} warCollect={warCollect} rw={rw} pol={pol} carpetDelta={cpuCarpetDelta} warCardRef={cpuWarRef} mercySpoils={mercySpoils||0} dw2Sp={dw2CpuSp||[]} dw2W={dw2CpuW||null} dw2Revealed={phase==="double_reveal"} dw2Round={dw2Round||0}/>

      {/* Row 2 — Duel Carpet: 3% | 22% CPU card | 50% HUD | 22% Player card | 3% */}
      <div style={{flex:1,minHeight:0,display:"flex",alignItems:"center",
        flexDirection:pol?"row":"row-reverse",
        borderTop:`1px solid ${pathBorder}`,borderBottom:`1px solid ${pathBorder}`,
        background:"rgba(0,0,0,.25)",transition:"border .4s,background .4s",overflow:"hidden"}}>

        {/* 3% gutter */}
        <div style={{width:"3%",flexShrink:0}}/>

        {/* 22% CPU Fight Card — centered */}
        <div style={{width:"22%",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          <div style={{fontSize:7,color:cpuFam?.accent||"#ccc",lineHeight:1,height:10}}>{cpuFam?.name}</div>
          <div ref={cpuFightRef} style={{position:"relative",width:CW,height:CH}}>
            <div style={{position:"absolute",inset:0,borderRadius:6,
              border:"1px dashed rgba(255,255,255,.12)",background:"rgba(255,255,255,.02)"}}/>
            {cpuF&&<div style={{position:"absolute",inset:0,
              transition:(duelFly&&rw==="cpu")?"transform .4s cubic-bezier(.4,0,.2,1), opacity .35s ease-in 50ms":fightSlide?"transform .25s ease-in, opacity .2s ease-in 60ms":"none",
              zIndex:(duelFly&&rw==="cpu")?20:fightSlide==="cpu"?0:2,
              opacity:(duelFly&&rw==="cpu")?0:fightSlide==="cpu"?0:(warCollect==="fight"&&rw!=="cpu")?0.15:1,
              transform:(duelFly&&rw==="cpu")?`translateX(${duelDelta.dx}px) translateY(${duelDelta.dy}px) scale(.85)`:fightSlide==="cpu"?(pol?"translateX(400px)":"translateX(-400px)"):"translateX(0)"}}
              onTransitionEnd={e=>{if(e.propertyName!=="transform")return;if(duelFly&&rw==="cpu")onAnimDone("duelfly");else if(fightSlide==="cpu")onAnimDone(animStepRef.current||"fight_slide");}}>
              <Card card={cpuF} glow={fightSlide||warCollect?null:fcg} small={csSmall} med={csMed||csLg}/>
            </div>}
          </div>
        </div>

        {/* 50% HUD */}
        <div style={{width:"50%",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}>
          <div style={{height:csSmall?44:csMed?56:68,width:"100%",display:dealIntro?"none":"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
            {/* WAR/DUEL graphic — always visible, fades when stats overlay */}
            {(()=>{
              const sz=csSmall?"sm":csMed?"md":"lg";
              const iSz={sm:20,md:28,lg:36}[sz];
              const tSz={sm:12,md:14,lg:18}[sz];
              const lSp={sm:1,md:1.5,lg:2}[sz];
              const showStats=(phase==="war_reveal"||phase==="double_reveal")&&revealed&&warInfo;
              const warRound=dw2Round||0;
              const prefixes=["","DOUBLE","TRIPLE","QUADRUPLE"];
              const prefix=warRound<prefixes.length?prefixes[warRound]:`${warRound+1}×`;
              const symLine=Array.from({length:warRound+1},()=>WAR_SYMBOL).join(" ");
              if(inWar) return(
                <div key={`wa-${dw2Round}`} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontWeight:"bold",letterSpacing:lSp,color:warAccent,textShadow:warGlow,animation:showStats?"none":"warAlert 1.8s ease-out forwards",textAlign:"center",lineHeight:1.4,opacity:showStats?.25:1,transition:"opacity .4s"}}>
                  <div style={{fontSize:iSz,lineHeight:1,marginBottom:1}}>{symLine}</div>
                  <div style={{fontSize:prefix?tSz*0.85:0,letterSpacing:lSp,minHeight:prefix?undefined:0,visibility:prefix?"visible":"hidden"}}>{prefix}</div>
                  <div style={{fontSize:tSz,letterSpacing:lSp}}>W A R</div>
                </div>
              );
              return(
                <div style={{fontWeight:"bold",letterSpacing:lSp,color:"rgba(218,165,32,.35)",textAlign:"center",lineHeight:1.3}}>
                  <div style={{fontSize:iSz,lineHeight:1,marginBottom:1}}>⚔️</div>
                  <div style={{fontSize:tSz}}>D U E L</div>
                </div>
              );
            })()}
            {/* War stats overlay — appears on top of graphic during reveal */}
            {(phase==="war_reveal"||phase==="double_reveal")&&(
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,textAlign:"center",lineHeight:1.5,padding:"0 4px",
                opacity:revealed&&warInfo?1:0,
                transition:"opacity .5s ease-in",
                transitionDelay:revealed&&warInfo?"850ms":"0ms"}}>
                {warInfo&&(<div>
                  <div style={{color:warInfo.playerWon?"#86efac":"#fca5a5",fontWeight:"bold",fontSize:9}}>
                    {warInfo.playerWon?"🏆 You captured":"💀 You lost"} {warInfo.count} cards <span style={{color:"#e2c97a",fontWeight:"normal",fontSize:8}}>· {warInfo.totalVal}pts</span>
                  </div>
                  <div style={{color:"#86efac",fontSize:8}}>⚔️ {plFam?.name||"You"}: {warInfo.yourWC?.rank}{warInfo.yourWC?.suit} <b>({warInfo.yourVal})</b></div>
                  <div style={{color:"#fca5a5",fontSize:8}}>🛡 {cpuFam?.name||"Them"}: {warInfo.theirWC?.rank}{warInfo.theirWC?.suit} <b>({warInfo.theirVal})</b></div>
                  <div style={{display:"flex",justifyContent:"center",gap:6,fontSize:7,color:"rgba(220,200,160,.6)"}}>
                    <span>🂠 {potCards}</span>
                  </div>
                  {quip&&<div style={{fontSize:8,fontStyle:"italic",color:quip.win?"#86efac":"#fca5a5",animation:"quipIn .4s ease-out"}}>🤖 {quip.text}</div>}
                </div>)}
              </div>
            )}
          </div>
          {dealIntro&&(()=>{
            const rem=introDelt===0?introTotal:Math.max(0,introTotal-introDelt);
            const canTap=introDelt===0;
            // marginTop:12 = label(10) + gap(2) — aligns card bottom with duel card bottoms
            // filter:drop-shadow for glow so it never affects layout geometry
            return(
              <div style={{position:"relative",width:CW,height:CH,flexShrink:0,marginTop:12,
                cursor:canTap?"pointer":"default",
                filter:canTap?"drop-shadow(0 0 10px rgba(218,165,32,.9))":"none"}}
                onClick={canTap?onDealClick:undefined}>
                <div style={{position:"absolute",inset:0,borderRadius:8,overflow:"hidden",
                  background:"repeating-linear-gradient(45deg,#3a0080 0,#3a0080 4px,#5500bb 4px,#5500bb 8px)",
                  border:`2px solid ${canTap?"#DAA520":"rgba(218,165,32,.45)"}`}}>
                  <div style={{position:"absolute",inset:4,border:"1px solid rgba(218,165,32,.25)",borderRadius:5}}/>
                </div>
                <div style={{position:"absolute",top:CH-22,right:6,zIndex:10,
                  background:"linear-gradient(135deg,#1a0a2aee,#55330088)",
                  border:"1.5px solid #DAA520",borderRadius:5,
                  minWidth:csSmall?16:22,height:csSmall?16:20,padding:"0 5px",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:csSmall?8:10,fontWeight:"bold",color:"#fff"}}>
                  {rem}
                </div>
                {canTap&&(
                  <div style={{position:"absolute",inset:0,zIndex:11,
                    display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8}}>
                    <div style={{fontSize:csSmall?6:csMed?7:9,color:"#DAA520",fontWeight:"bold",letterSpacing:1.5,
                      textShadow:"0 0 8px #DAA520",animation:"wP 1.2s ease-in-out infinite",
                      textAlign:"center",lineHeight:1.5,background:"rgba(10,0,20,.65)",
                      borderRadius:5,padding:csSmall?"2px 4px":"4px 7px"}}>
                      TAP TO<br/>DEAL
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {!(phase==="war_reveal"||phase==="double_reveal")&&(
            <div style={{fontSize:16,color:inWar?warAccent:"rgba(218,165,32,.45)",
              letterSpacing:.5,textAlign:"center",lineHeight:1.3,minHeight:18,fontWeight:"bold"}}>
              {inWar
                ? (phase==="double_reveal"?"🔥 DOUBLE WINNER"
                  : ((mercySpoils!==0)&&(phase==="war"||phase==="war_card"||phase==="war_reveal"||phase==="double_reveal")
                    ? <span style={{color:"#ff7070",fontSize:11,fontWeight:"bold",letterSpacing:.5,
                        textShadow:"0 0 8px rgba(255,80,80,.5)",lineHeight:1.4,display:"block"}}>
                        ⚠️ MERCY RULE<br/>
                        <span style={{fontSize:9,fontWeight:"normal",color:"rgba(255,150,150,.8)"}}>
                          {mercySpoils===-1?"No cards for spoils":(`Short pile — ${3-mercySpoils} spoil${3-mercySpoils!==1?"s":""} skipped`)}
                        </span>
                      </span>
                    : ""))
                : (pot>0?`${pot} cards at stake`:"")}
            </div>
          )}
        </div>

        {/* 22% Player Fight Card — centered */}
        <div style={{width:"22%",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          <div style={{fontSize:7,color:plFam?.accent||"#DAA520",lineHeight:1,height:10}}>{plFam?.name}</div>
          <div ref={plFightRef} style={{position:"relative",width:CW,height:CH}}>
            <div style={{position:"absolute",inset:0,borderRadius:6,
              border:"1px dashed rgba(255,255,255,.12)",background:"rgba(255,255,255,.02)"}}/>
            {plF&&<div style={{position:"absolute",inset:0,
              transition:(duelFly&&rw==="player")?"transform .4s cubic-bezier(.4,0,.2,1), opacity .35s ease-in 50ms":fightSlide?"transform .25s ease-in, opacity .2s ease-in 60ms":"none",
              zIndex:(duelFly&&rw==="player")?20:fightSlide==="player"?0:2,
              opacity:(duelFly&&rw==="player")?0:fightSlide==="player"?0:(warCollect==="fight"&&rw!=="player")?0.15:1,
              transform:(duelFly&&rw==="player")?`translateX(${duelDelta.dx}px) translateY(${duelDelta.dy}px) scale(.85)`:fightSlide==="player"?(pol?"translateX(-400px)":"translateX(400px)"):"translateX(0)"}}
              onTransitionEnd={e=>{if(e.propertyName!=="transform")return;if(duelFly&&rw==="player")onAnimDone("duelfly");else if(fightSlide==="player")onAnimDone(animStepRef.current||"fight_slide");}}>
              <Card card={plF} glow={fightSlide||warCollect?null:fpg} small={csSmall} med={csMed||csLg}/>
            </div>}
          </div>
        </div>

        {/* 3% gutter */}
        <div style={{width:"3%",flexShrink:0}}/>

      </div>

      {/* Row 3 — Player War Carpet (full width) */}
      <WarPathRow spoils={plSp} warCard={plW} glow={wpg} isPlayer={true} fam={plFam} inWar={inWar} pathBg={pathBg} pathBorder={pathBorder} revealed={revealed} warCollect={warCollect} rw={rw} pol={pol} carpetDelta={plCarpetDelta} warCardRef={plWarRef} onAnimDone={onAnimDone} mercySpoils={mercySpoils||0} dw2Sp={dw2PlSp||[]} dw2W={dw2PlW||null} dw2Revealed={phase==="double_reveal"} dw2Round={dw2Round||0}/>

    </div>
  );
}

// ── GAME OVER ─────────────────────────────────────────────────────────────────
function StatRow({label,val,dim=false}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"2px 0"}}>
      <span style={{color:dim?"rgba(255,255,255,.3)":"rgba(200,184,122,.7)",fontSize:9,letterSpacing:.3}}>{label}</span>
      <span style={{color:dim?"rgba(255,255,255,.3)":"rgba(255,255,255,.85)",fontSize:9,fontWeight:"bold",letterSpacing:.5}}>{val}</span>
    </div>
  );
}
function ModeStats({label,icon,data,fmt,accent}){
  const total=data.wins+data.losses;
  if(total===0)return null;
  const pct=total>0?Math.round(data.wins/total*100):0;
  const avgDuels=total>0?Math.round(data.duels/total):0;
  const avgWars=total>0?Math.round(data.wars/total):0;
  return(
    <div style={{background:"rgba(255,255,255,.03)",border:`1px solid ${accent}33`,borderRadius:8,padding:"8px 10px",minWidth:130,flex:1}}>
      <div style={{fontSize:9,color:accent,fontWeight:"bold",letterSpacing:1,marginBottom:5}}>{icon} {label}</div>
      <div style={{display:"flex",gap:6,marginBottom:4,alignItems:"baseline",flexWrap:"wrap"}}>
        <span style={{color:"#22c55e",fontWeight:"bold",fontSize:13}}>{data.wins}W</span>
        <span style={{color:"#e74c3c",fontWeight:"bold",fontSize:13}}>{data.losses}L</span>
        <span style={{color:"rgba(255,255,255,.35)",fontSize:8}}>Win Rate</span>
        <span style={{color:accent,fontWeight:"bold",fontSize:13}}>{pct}%</span>
      </div>
      <StatRow label="Avg duels/game" val={avgDuels}/>
      <StatRow label="Avg wars/game" val={avgWars}/>
      {data.bestTime!==null&&<StatRow label="Best time" val={fmt(data.bestTime)}/>}
    </div>
  );
}
function GameOverOverlay({gWin,gWinReason,gameMode,warTarget,cpuFam,playerName,dur,fmt,fights,wars,pWarWins,cWarWins,onRestart,sessionStats}){
  const isWin=gWin==="player";
  const byWars=gWinReason==="wars";
  const byForfeit=gWinReason==="forfeit";
  const winLine=byForfeit
    ?"✋ Game ended early — forfeit recorded."
    :byWars
      ?(isWin?`${PF.crest} ${playerName} won ${warTarget} wars!`:`${cpuFam?.crest} ${cpuFam?.name} won ${warTarget} wars!`)
      :gameMode==="wars"
        ?(isWin?`${cpuFam?.crest} ${cpuFam?.name} ran out of cards!`:`${PF.crest} ${playerName} ran out of cards!`)
        :(isWin?`${PF.crest} ${playerName} conquers all 52 cards!`:`${cpuFam?.crest} ${cpuFam?.name} wins with 52 cards!`);
  const modeBadge=gameMode==="wars"?`🏁 War Race — First to ${warTarget}`:"🂠 Classic — Capture all 52";
  const sWins=sessionStats.classic.wins+sessionStats.race.wins;
  const sLosses=sessionStats.classic.losses+sessionStats.race.losses;
  const sTotal=sWins+sLosses;
  const sPct=sTotal>0?Math.round(sWins/sTotal*100):0;
  const hasMultiMode=sessionStats.classic.wins+sessionStats.classic.losses>0
    && sessionStats.race.wins+sessionStats.race.losses>0;
  return(
    <div style={{position:"absolute",inset:0,zIndex:100,background:isWin?"radial-gradient(ellipse at center,rgba(0,60,0,.97),rgba(0,0,0,.97))":"radial-gradient(ellipse at center,rgba(60,0,0,.97),rgba(0,0,0,.97))",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,overflowY:"auto",padding:"16px 0"}}>
      <div style={{fontSize:10,color:"rgba(255,255,255,.3)",letterSpacing:2}}>{modeBadge}</div>
      <div style={{fontSize:64,animation:"bounceIn .6s ease-out",filter:isWin?"drop-shadow(0 0 20px #22c55e)":"drop-shadow(0 0 20px #e74c3c)",lineHeight:1}}>{isWin?"🏆":"💀"}</div>
      <div style={{fontSize:30,fontWeight:"bold",letterSpacing:4,color:isWin?"#22c55e":"#e74c3c",textShadow:isWin?"0 0 30px #22c55e":"0 0 30px #e74c3c",animation:"pulseText 1.5s ease-in-out infinite"}}>{isWin?"VICTORY!":"DEFEAT!"}</div>
      <div style={{fontSize:11,color:isWin?"#86efac":"#fca5a5",textAlign:"center",lineHeight:1.6}}>{winLine}</div>

      {/* ── This game ── */}
      <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"8px 14px",width:220}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,.3)",letterSpacing:1.5,marginBottom:5,textAlign:"center"}}>THIS GAME</div>
        <div style={{display:"flex",gap:14,fontSize:10,color:"rgba(255,255,255,.5)",justifyContent:"center",flexWrap:"wrap"}}>
          <span>⏱ {fmt(dur)}</span>
          <span>⚔️ {fights} duels</span>
          <span>🔥 {wars} wars</span>
          <span>🏆 {pWarWins}–{cWarWins} war W/L</span>
        </div>
      </div>

      {/* ── Session summary ── */}
      {sTotal>0&&(
        <div style={{width:220}}>
          <div style={{fontSize:8,color:"rgba(255,255,255,.3)",letterSpacing:1.5,marginBottom:4,textAlign:"center"}}>SESSION</div>
          <div style={{display:"flex",gap:4}}>
            {(!hasMultiMode)
              ? <div style={{flex:1,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"baseline",marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{color:"#22c55e",fontWeight:"bold",fontSize:14}}>{sWins}W</span>
                    <span style={{color:"#e74c3c",fontWeight:"bold",fontSize:14}}>{sLosses}L</span>
                    <span style={{color:"rgba(255,255,255,.35)",fontSize:9}}>Win Rate</span>
                    <span style={{color:"#DAA520",fontWeight:"bold",fontSize:14}}>{sPct}%</span>
                  </div>
                  {(()=>{const m=gameMode==="wars"?sessionStats.race:sessionStats.classic;const t=m.wins+m.losses;return t>0&&(<>
                    <StatRow label="Avg duels/game" val={t>0?Math.round(m.duels/t):0}/>
                    <StatRow label="Avg wars/game" val={t>0?Math.round(m.wars/t):0}/>
                    {m.bestTime!==null&&<StatRow label="Best win time" val={fmt(m.bestTime)}/>}
                  </>);})()}
                </div>
              : <>
                  <ModeStats label="CLASSIC" icon="🂠" data={sessionStats.classic} fmt={fmt} accent="#DAA520"/>
                  <ModeStats label="WAR RACE" icon="🏁" data={sessionStats.race} fmt={fmt} accent="#cc88ff"/>
                </>
            }
          </div>
        </div>
      )}

      <div style={{width:200,height:6,borderRadius:3,background:"rgba(255,255,255,.08)",overflow:"hidden"}}>
        <div style={{height:"100%",width:isWin?"100%":"0%",background:isWin?"linear-gradient(90deg,#22c55e,#4ade80)":"linear-gradient(90deg,#e74c3c,#f87171)",transition:"width 1s ease",borderRadius:3}}/>
      </div>
      <button onClick={onRestart} style={{background:"linear-gradient(135deg,#6b2a00,#3d1a00)",border:"2px solid #DAA520",color:"#DAA520",padding:"10px 28px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:"bold",letterSpacing:1,boxShadow:"0 0 20px rgba(218,165,32,.3)"}}>⚔️ Battle Again</button>
    </div>
  );
}

// ── CONFIG ────────────────────────────────────────────────────────────────────
function Tog({active,onClick,children}){return <button onClick={onClick} style={{background:active?"linear-gradient(135deg,#6b3a00,#DAA520)":"rgba(255,255,255,.05)",border:active?"1px solid #DAA520":"1px solid rgba(255,255,255,.15)",color:active?"#fff":"#777",padding:"5px 10px",borderRadius:7,cursor:"pointer",fontSize:10,fontWeight:"bold"}}>{children}</button>;}
function CRow({label,children}){return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:13,gap:8}}><span style={{color:"#c8b87a",fontSize:11,minWidth:82}}>{label}</span><div style={{display:"flex",alignItems:"center",gap:5}}>{children}</div></div>;}
function ConfigMenu({config,onUpdate,onClose,dev,setDev,playerName,setPlayerName,pWarWins,cWarWins,onSettingChange}){
  const warFloor=Math.max(1,(pWarWins||0),(cWarWins||0))+1;
  const upd=(patch)=>{onUpdate(patch);if(onSettingChange)Object.entries(patch).forEach(([k,v])=>onSettingChange(k,v));};
  return(
    <div style={{position:"absolute",inset:0,zIndex:200,background:"rgba(0,0,0,.92)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"linear-gradient(160deg,#1a0f05,#0f0a1a)",border:"2px solid rgba(218,165,32,.5)",borderRadius:18,padding:"22px 20px",width:"88%",maxWidth:340,maxHeight:"90vh",overflowY:"auto",position:"relative"}}>
        {/* Close X — upper right */}
        <button onClick={onClose} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:"rgba(218,165,32,.7)",fontSize:18,cursor:"pointer",lineHeight:1,padding:4}}>✕</button>
        <div style={{fontSize:15,color:"#DAA520",textAlign:"center",marginBottom:2,letterSpacing:2}}>⚙️ Settings</div>
        <div style={{fontSize:9,color:"rgba(218,165,32,.65)",textAlign:"center",letterSpacing:1.5,marginBottom:14}}>v165</div>

        {/* ── Game Mode ── */}
        <div style={{background:"rgba(218,165,32,.06)",border:"1px solid rgba(218,165,32,.2)",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
          <div style={{fontSize:10,color:"#DAA520",letterSpacing:1,marginBottom:10,textAlign:"center"}}>GAME MODE</div>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            <button onClick={()=>upd({gameMode:"cards"})} style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",fontSize:9,fontWeight:"bold",letterSpacing:.5,
              background:config.gameMode==="cards"?"linear-gradient(135deg,#3d1a00,#DAA520)":"rgba(255,255,255,.04)",
              border:config.gameMode==="cards"?"1px solid #DAA520":"1px solid rgba(255,255,255,.1)",
              color:config.gameMode==="cards"?"#fff":"#666"}}>
              🂠 Classic<br/><span style={{fontSize:8,opacity:.7}}>Capture all 52</span>
            </button>
            <button onClick={()=>upd({gameMode:"wars"})} style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",fontSize:9,fontWeight:"bold",letterSpacing:.5,
              background:config.gameMode==="wars"?"linear-gradient(135deg,#1a0030,#8b44cc)":"rgba(255,255,255,.04)",
              border:config.gameMode==="wars"?"1px solid #cc88ff":"1px solid rgba(255,255,255,.1)",
              color:config.gameMode==="wars"?"#fff":"#666"}}>
              🏁 War Race<br/><span style={{fontSize:8,opacity:.7}}>First to win wars</span>
            </button>
          </div>
          {config.gameMode==="wars"&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{color:"#c8b87a",fontSize:11}}>War target</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>upd({warTarget:Math.max(warFloor,config.warTarget-1)})} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                <span style={{color:"#cc88ff",fontSize:16,fontWeight:"bold",minWidth:24,textAlign:"center"}}>{config.warTarget}</span>
                <button onClick={()=>upd({warTarget:Math.min(26,config.warTarget+1)})} style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.15)",color:"#fff",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
              </div>
            </div>
          )}
        </div>

        <CRow label="War Auto Fill"><Tog active={config.warAutoFill} onClick={()=>upd({warAutoFill:!config.warAutoFill})}>{config.warAutoFill?"On ✓":"Off"}</Tog></CRow>
        <CRow label="Sound"><Tog active={!config.muted} onClick={()=>upd({muted:!config.muted})}>{config.muted?"🔇 Off":"🔊 On"}</Tog></CRow>
        <CRow label="Volume"><input type="range" min={0} max={1} step={.05} value={config.volume} onChange={e=>upd({volume:parseFloat(e.target.value)})} style={{width:100,accentColor:"#DAA520"}}/><span style={{color:"#DAA520",fontSize:11,minWidth:26}}>{Math.round(config.volume*100)}%</span></CRow>
        <CRow label="Draw Pile Side"><div style={{display:"flex",gap:5}}>{["left","right"].map(s=><Tog key={s} active={config.pileSide===s} onClick={()=>upd({pileSide:s})}>{s==="left"?"◀ Left":"Right ▶"}</Tog>)}</div></CRow>
        <CRow label="Card Size"><div style={{display:"flex",gap:4}}>{[["S","sm"],["M","md"],["L","lg"]].map(([l,v])=><Tog key={v} active={(config.cardSize||"md")===v} onClick={()=>upd({cardSize:v})}>{l}</Tog>)}</div></CRow>
        <CRow label="Msg Bar"><Tog active={config.showMsg} onClick={()=>upd({showMsg:!config.showMsg})}>{config.showMsg?"On":"Off"}</Tog></CRow>
        <CRow label="Auto Speed"><div style={{display:"flex",gap:4}}>{[["Off",0],["1x",1],["2x",2],["3x",3]].map(([l,v])=><Tog key={v} active={config.autoSpeed===v} onClick={()=>upd({autoSpeed:v})}>{l}</Tog>)}</div></CRow>
        <CRow label="Dev Bar"><Tog active={config.showDevBar} onClick={()=>upd({showDevBar:!config.showDevBar})}>{config.showDevBar?"🟢 ON":"⚫ OFF"}</Tog></CRow>
        <CRow label="Log Events"><Tog active={config.logEvents} onClick={()=>upd({logEvents:!config.logEvents})}>{config.logEvents?"🟢 ON":"⚫ OFF"}</Tog></CRow>

        <CRow label="Your Faction">
          <input value={playerName} onChange={e=>setPlayerName(e.target.value.slice(0,24))} maxLength={24} placeholder="Player"
            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(218,165,32,.3)",color:"#DAA520",borderRadius:6,padding:"5px 8px",fontSize:10,width:140,outline:"none",fontFamily:"'Segoe UI',Verdana,Geneva,sans-serif"}}/>
        </CRow>

        <button onClick={onClose} style={{background:"linear-gradient(135deg,#8B2020,transparent)",border:"1px solid #DAA52044",color:"#DAA520",padding:"8px",borderRadius:9,cursor:"pointer",fontSize:11,fontWeight:"bold",width:"100%"}}>Close</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
// Phase machine:
//   idle → resolve → (collect+fight) → resolve/war
//   war → war_card → war_reveal → (collect+fight)
//   double_reveal → (collect+fight)
//   gameover

const INIT_BF={phase:"idle",cpuF:null,plF:null,cpuSp:[],plSp:[],cpuW:null,plW:null,rw:null,revealed:false,tapCt:0,pot:0,maxSp:0,warCollect:null,warInfo:null,fightSlide:null,mercySpoils:0,dw2PlSp:[],dw2CpuSp:[],dw2PlW:null,dw2CpuW:null,dw2Round:0};

export default function App(){
  // cardSize: "sm"=small(27×39) "md"=medium(47×68) "lg"=large(60×87)
  const [config,setConfig]=useState(()=>{
    const w=typeof window!=="undefined"?window.innerWidth:400;
    const cardSize=w<360?"sm":w<600?"md":"lg";
    return {muted:true,volume:.7,pileSide:"right",showMsg:true,autoSpeed:0,gameMode:"cards",warTarget:3,warAutoFill:false,logEvents:true,cardSize,showDevBar:true};
  });
  const [showConfig,setShowConfig]=useState(false);
  const [dev,setDev]=useState(false);
  const [eventLog,setEventLog]=useState([]);
  const [showLog,setShowLog]=useState(false);
  const [logCopied,setLogCopied]=useState(false);
  const logCopyTimer=useRef(null);
  const logRef=useRef([]);
  const addLogRef=useRef(null); // kept fresh each render; lets rigDecks (useCallback []) always reach addLog
  const addLog=useCallback((type,msg,data={})=>{
    if(!configRef.current.logEvents) return;
    const entry={t:Date.now(),type,msg,...(Object.keys(data).length?{data}:{})};
    logRef.current=[...logRef.current.slice(-199),entry];
    setEventLog(l=>[...l.slice(-199),entry]);
  },[]);
  addLogRef.current=addLog; // wire each render — addLogRef is declared above, so no TDZ
  const [cpuFam,setCpuFam]=useState(()=>rndCpu());
  const cfRef=useRef(cpuFam); cfRef.current=cpuFam;
  const [playerName,setPlayerName]=useState("Player");

  // ── Game state ──
  const [pDeck,setPDeck]=useState([]);
  const [cDeck,setCDeck]=useState([]);
  const [pCollect,setPCollect]=useState([]);       // player collection pile (face-up won cards)
  const [cCollect,setCCollect]=useState([]);       // cpu collection pile
  const [pLastWon,setPLastWon]=useState(null);     // last card player won (face shown on collect pile)
  const [cLastWon,setCLastWon]=useState(null);     // last card cpu won
  const [bf,setBfState]=useState(INIT_BF);       // all battlefield display
  const [wCards,setWCards]=useState([]);           // cards in the current pot
  const [dur,setDur]=useState(0);
  const [fights,setFights]=useState(0);
  const [wars,setWars]=useState(0);
  const [pWarWins,setPWarWins]=useState(0);
  const pWarWinsRef=useRef(0);
  const [cWarWins,setCWarWins]=useState(0);
  const cWarWinsRef=useRef(0);
  const [started,setStarted]=useState(false);
  const [dealIntro,setDealIntro]=useState(true);    // true while deal animation runs
  const [introCards,setIntroCards]=useState(()=>shuf(mkDeck())); // cards queued for deal animation
  const [introDelt,setIntroDelt]=useState(0);        // count of cards dealt so far
  const [msg,setMsg]=useState("Tap your draw pile to begin!");
  const [gWin,setGWin]=useState(null);
  const gWinRef=useRef(null);
  const [gWinReason,setGWinReason]=useState("cards"); // "cards" | "wars"
  // Session stats — persist across restarts within same page session
  // Session stats — persist across restarts within same page session
  // Shape: { classic:{wins,losses,duels,wars,bestTime:null}, race:{wins,losses,duels,wars} }
  const [sessionStats,setSessionStats]=useState({
    classic:{wins:0,losses:0,duels:0,wars:0,bestTime:null},
    race:{wins:0,losses:0,duels:0,wars:0,bestTime:null},
  });
  // Derived for convenience
  const sessionWins=sessionStats.classic.wins+sessionStats.race.wins;
  const sessionLosses=sessionStats.classic.losses+sessionStats.race.losses;
  const [confirmRestart,setConfirmRestart]=useState(false); // inline restart confirm
  const [surrenderModal,setSurrenderModal]=useState(false);
  const [pendingMode,setPendingMode]=useState(null); // mode-change confirm
  const pendingActionRef=useRef(null); // action to run when Battle Again is clicked after forced gameover
  const pendingWarWinRef=useRef(null); // {winner} — set when race war is won; gameover fires on next tap // war race stuck = no cards
  const [quip,setQuip]=useState(null);
  const [closed,setClosed]=useState(false);
  const [tick,setTick]=useState(0);  // increments every fight — keeps autoplay effect firing

  // ── Audio refs ──
  const actx=useRef(null); const cvRef=useRef(0);
  const getCtx=()=>{if(!actx.current)actx.current=new(window.AudioContext||window.webkitAudioContext)();return actx.current;};

  // ── Mutable refs for use inside callbacks / effects ──
  const pDeckRef=useRef(pDeck);   pDeckRef.current=pDeck;
  const cDeckRef=useRef(cDeck);   cDeckRef.current=cDeck;
  const pCollectRef=useRef(pCollect); pCollectRef.current=pCollect;
  const cCollectRef=useRef(cCollect); cCollectRef.current=cCollect;

  // ── CANONICAL FLIP EFFECT ─────────────────────────────────────────────────
  // Single source of truth: whenever a draw pile hits 0 and the matching
  // collect pile has cards, shuffle and flip immediately.
  // This replaces all scattered flip logic throughout the codebase.
  useEffect(()=>{
    if(!started) return;
    if(pDeck.length===0&&pCollect.length>0){
      const flipped=shuf([...pCollect]);
      setPDeck(flipped);setPCollect([]);
    }
  },[pDeck.length, started]);
  useEffect(()=>{
    if(!started) return;
    if(cDeck.length===0&&cCollect.length>0){
      const flipped=shuf([...cCollect]);
      setCDeck(flipped);setCCollect([]);
    }
  },[cDeck.length, started]);
  // DOM refs for collect pile position measurement (duelfly animation)
  const pCollectDomRef=useRef(null);
  const cCollectDomRef=useRef(null);
  // DOM refs for draw pile position (deal intro animation)
  const pDrawDomRef=useRef(null);
  const cDrawDomRef=useRef(null);
  const bfRef=useRef(bf);         bfRef.current=bf;
  // phaseRef: updated synchronously inside setBfState so the autoplay loop
  // always reads the latest phase even before React re-renders.
  const phaseRef=useRef(bf.phase);
  const startedRef=useRef(started); startedRef.current=started;
  const wCardsRef=useRef(wCards); wCardsRef.current=wCards;
  pWarWinsRef.current=pWarWins; cWarWinsRef.current=cWarWins;
  const autoRef=useRef(null);     // setTimeout handle for autoplay
  const devRef=useRef(dev);         devRef.current=dev;
  const [lastRig,setLastRig]=useState(0); // tracks last-clicked rig depth for glow
  const scheduleAnimFallbackRef=useRef(null); // wired each render so tapPile ([] deps) can call it
  // rigDecks: stamps pDeck at given slot positions to match cDeck ranks.
  // Takes an explicit slots array — caller is responsible for phase-correct positions.
  // NEVER touches pCollect (avoids re-render side-effects, CLAUDE.md rule #1).
  // Returns count of successfully rigged slots.
  const rigDecks=useCallback((slots)=>{
    const pd=[...pDeckRef.current];
    const cd=[...cDeckRef.current];
    if(pd.length<1||cd.length<1) return 0;
    let stamped=0;
    const riggedPos=new Set();
    slots.forEach(i=>{
      if(cd[i]===undefined||pd[i]===undefined) return;
      const targetRank=cd[i].rank;
      if(pd[i].rank===targetRank){stamped++;riggedPos.add(i);return;} // already matches
      const swapIdx=pd.findIndex((c,j)=>j!==i&&!riggedPos.has(j)&&c.rank===targetRank);
      if(swapIdx<0) return; // no matching card available — skip this slot
      [pd[i],pd[swapIdx]]=[pd[swapIdx],pd[i]];
      riggedPos.add(i);
      stamped++;
    });
    if(stamped>0) setPDeck(pd); // only pDeck — pCollect intentionally untouched
    return stamped;
  },[]);
  // handleRigBtn: calculates phase-aware rig slots, always illuminates the button,
  // pre-fills draw pile from collect if needed, then rigs.
  // CLAUDE.md rule #1: only handleRigBtn may call setPCollect; rigDecks must not.
  const handleRigBtn=useCallback((depth)=>{
    const ph=phaseRef.current;
    const n=warSlotRef.current;   // spoils placed so far in current war (0-3)
    const m=dw2SlotRef.current;   // dw2 spoils placed so far (0-3)
    // Phase-aware slot calculation:
    // Idle/resolve/collecting: fresh deal — duel at [0], war at [4], dw2 at [8]
    // In war (n spoils placed): war card at [3-n], dw2 war at [3-n+4]
    // In war_card: war card at [0], dw2 war at [4]
    // In double_war (m spoils placed): dw2 war card at [3-m]
    // In double_war_card: dw2 war card at [0]
    let slots;
    if(ph==='idle'||ph==='resolve'||ph==='collecting'||ph==='war_reveal'||ph==='double_reveal'){
      slots=[0, depth>=2?4:-1, depth>=3?8:-1].filter(i=>i>=0);
    } else if(ph==='war'){
      const wc=3-n;
      // depth=1: already in a war — nothing to rig
      slots=[depth>=2?wc:-1, depth>=3?wc+4:-1].filter(i=>i>=0);
    } else if(ph==='war_card'){
      slots=[depth>=2?0:-1, depth>=3?4:-1].filter(i=>i>=0);
    } else if(ph==='double_war'){
      const dw2c=3-m;
      slots=[depth>=3?dw2c:-1].filter(i=>i>=0);
    } else if(ph==='double_war_card'){
      slots=[depth>=3?0:-1].filter(i=>i>=0);
    } else {
      slots=[];
    }
    // Always illuminate the button regardless of rig outcome
    setLastRig(depth);
    if(slots.length===0){
      if(addLogRef.current) addLogRef.current("dev",`WARx${depth} armed — no card slots to rig in phase:${ph}`);
      return;
    }
    const needed=Math.max(...slots)+1;
    const doRig=()=>{
      const s=rigDecks(slots);
      if(addLogRef.current) addLogRef.current("dev",`WARx${depth} — deck rigged (${s} slot${s!==1?"s":""})`);
    };
    let needsWait=false;
    if(pDeckRef.current.length<needed&&pCollectRef.current.length>0){
      setPDeck(shuf([...pCollectRef.current,...pDeckRef.current])); setPCollect([]); needsWait=true;
    }
    if(cDeckRef.current.length<needed&&cCollectRef.current.length>0){
      setCDeck(shuf([...cCollectRef.current,...cDeckRef.current])); setCCollect([]); needsWait=true;
    }
    if(needsWait){setTimeout(doRig,0);}else{doRig();}
  },[rigDecks]);
  const configRef=useRef(config);   configRef.current=config;

  const ctRef=useRef(null);       // timer interval

  // ── setBf: merge patch into bf state ──
  // setBf: merge patch AND update phaseRef synchronously
  const setBf=useCallback(patch=>wrapBfState(s=>{
    const next={...s,...(typeof patch==="function"?patch(s):patch)};
    if(next.phase!==s.phase) phaseRef.current=next.phase;
    return next;
  }),[]);
  // wrapBfState: wraps setBfState to keep phaseRef in sync.
  // Plain objects are MERGED into current state (not replaced) so partial updates are safe.
  const wrapBfState=useCallback((val)=>{
    if(typeof val==="function"){
      setBfState(s=>{const next=val(s);if(next.phase&&next.phase!==s.phase)phaseRef.current=next.phase;return next;});
    } else {
      if(val.phase) phaseRef.current=val.phase;
      setBfState(s=>({...s,...val}));
    }
  },[]);

  // ── Sound ──
  const snd=useCallback((t)=>{
    if(config.muted)return;
    try{const ctx=getCtx(),v=config.volume;
      if(t==="clash"){sfxClash(ctx,cvRef.current,v);cvRef.current=(cvRef.current+1)%3;}
      else if(t==="whoosh")sfxWhoosh(ctx,v);
      else if(t==="fanfare")sfxFanfare(ctx,v);
      else if(t==="war")sfxDrum(ctx,v);
      else if(t==="defeat")sfxDefeat(ctx,v);
    }catch(e){if(devRef.current)console.warn("Audio error:",e);}
  },[config.muted,config.volume]);

  // ── AudioContext cleanup on unmount ────────────────────────────────────────
  useEffect(()=>{
    return()=>{
      if(actx.current&&actx.current.state!=="closed"){
        actx.current.close().catch(()=>{});
      }
    };
  },[]);

  // ── Timer ──
  const phase=bf.phase;
  useEffect(()=>{
    if(started&&phase!=="gameover"&&!closed&&!showConfig){ctRef.current=setInterval(()=>setDur(d=>d+1),1000);}
    else clearInterval(ctRef.current);
    return()=>clearInterval(ctRef.current);
  },[started,phase,closed,showConfig]);

  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  // Sync refs for recordResult (called inside callbacks, can't read state directly)
  const durRef=useRef(dur); durRef.current=dur;
  const fightsRef=useRef(fights); fightsRef.current=fights;
  const warsRef=useRef(wars); warsRef.current=wars;

  // ── Quip helper ──
  const showQuip=useCallback((text,win)=>{
    setQuip({text,win});
  },[]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE GAME LOGIC
  // All functions work with EXPLICIT parameters (not state reads) so they're
  // safe to call from both tap handlers and autoplay.
  // ═══════════════════════════════════════════════════════════════════════════

  // dealFight: draw top card from each deck, update state
  // pot / potCards carry over accumulated war pot from previous rounds
  const dealFight=useCallback((pd,cd,pot,potCards)=>{
    // Inline refill: if draw is empty but collect has cards, flip now (async effect is too slow)
    if(pd.length===0&&pCollectRef.current.length>0){
      pd=shuf([...pCollectRef.current]); setPDeck(pd); setPCollect([]);
    }
    if(cd.length===0&&cCollectRef.current.length>0){
      cd=shuf([...cCollectRef.current]); setCDeck(cd); setCCollect([]);
    }
    if(!pd.length||!cd.length)return;
    const pc=pd[0], cc=cd[0];
    const newPd=pd.slice(1), newCd=cd.slice(1);
    const newWC=[...potCards,pc,cc];
    setPDeck(newPd); setCDeck(newCd); setWCards(newWC);
    setFights(f=>f+1);
    setQuip(null);  // clear quip on every new fight
    const pv=RV[pc.rank], cv=RV[cc.rank];
    if(pv===cv){
      // Reset war slot counter and spoils accumulator for fresh war
      resetWarSlots();
      resetDw2Slots();
      // Log war declaration immediately when tie cards hit the battlefield
      addLogRef.current("war",`${pc.rank}${pc.suit} vs ${cc.rank}${cc.suit}`);
      // Mercy rule: only if draw AND collect are both empty — otherwise warStep will refill
      const pTotalAfter = newPd.length + pCollectRef.current.length;
      const cTotalAfter = newCd.length + cCollectRef.current.length;
      if(pTotalAfter===0||cTotalAfter===0){
        const warWinner=pTotalAfter===0?"cpu":"player";
        const loser=warWinner==="player"?"cpu":"player";
        const allCards=[...potCards,pc,cc];
        const topCard=warWinner==="player"?pc:cc;
        const wi=buildWarInfo(warWinner==="player",pc,cc,pc,cc,[],[],allCards);
        // Skip straight to war_reveal so the collection animation plays properly
        wrapBfState({phase:"war_reveal",cpuF:cc,plF:pc,cpuSp:[],plSp:[],cpuW:cc,plW:pc,rw:warWinner,revealed:true,tapCt:0,pot:pot+2,maxSp:0,warInfo:wi,warCollect:null,fightSlide:null,mercySpoils:-1});
        setWCards(allCards);
        const merMsg=warWinner==="player"?`⚔️ Mercy rule — ${cfRef.current.name} ran out of cards!`:"⚔️ Mercy rule — you ran out of cards!";
        setMsg(merMsg);
        snd("war");
        // Auto-collect only in dev mode — in normal/autoplay, player must tap to collect (same as regular war)
        if(devRef.current){
          setTimeout(()=>{
            // Guard: don't override gameover if it was set while we waited
            if(phaseRef.current==="gameover") return;
            wrapBfState(s=>s.phase==="gameover"?s:{...s,phase:"collecting",warCollect:"spoils"});
            animStepRef.current = "spoils";
            scheduleAnimFallbackRef.current?.("spoils", 800);
          },1200);
        }
      } else {
      wrapBfState({phase:"war",cpuF:cc,plF:pc,cpuSp:[],plSp:[],cpuW:null,plW:null,rw:null,revealed:false,tapCt:0,pot:pot+2,maxSp:3,warCollect:null,fightSlide:null,warInfo:null,mercySpoils:0,dw2PlSp:[],dw2CpuSp:[],dw2PlW:null,dw2CpuW:null,dw2Round:0});
        setMsg("⚔️ WAR! Place 3 spoils then your war card.");
        snd("war");
      }
    } else {
      const w=pv>cv?"player":"cpu";
      addLog("duel",`P=${pc.rank}${pc.suit}(${pv}) CPU=${cc.rank}${cc.suit}(${cv}) · ${w==="player"?"P wins":"CPU wins"}`);
      wrapBfState({phase:"resolve",cpuF:cc,plF:pc,cpuSp:[],plSp:[],cpuW:null,plW:null,rw:w,revealed:false,tapCt:0,pot,warCollect:null,fightSlide:null,warInfo:null,dw2PlSp:[],dw2CpuSp:[],dw2PlW:null,dw2CpuW:null,dw2Round:0});
      if(w==="player"){setMsg(`✅ You win! ${pc.rank}(${pv}) vs ${cc.rank}(${cv}).`);}
      else{setMsg(`❌ ${cfRef.current.name} wins! ${cc.rank}(${cv}) vs ${pc.rank}(${pv}).`);}
      snd("clash");
      // Auto-collect if player draw pile is now empty (can't tap an empty pile)
      if(newPd.length===0){
        const slide=w==="player"?"cpu":"player";
        wrapBfState(s=>({...s,phase:"collecting",fightSlide:slide}));
        startCollectAnimRef.current("fight");
      }
    }
  },[snd]);

  // warSlotRef: 0=need S1, 1=need S2, 2=need S3, 3=place war card
  const warSlotRef=useRef(0);
  // warSpoilsRef: accumulates spoil card pairs between taps — plain ref, no React
  const warSpoilsRef=useRef({ps:[],cs:[]});
  // dw2 mirrors warSlot/warSpoils for the Double War slot-by-slot sequence
  const dw2SlotRef=useRef(0);
  const dw2SpoilsRef=useRef({ps:[],cs:[]});

  // ── War slot reset helpers ────────────────────────────────────────────────
  // Called at every war conclusion, mercy, and phase restart. Pure ref ops —
  // safe to call inside any useCallback regardless of stale closures.
  const resetWarSlots=()=>{warSlotRef.current=0;warSpoilsRef.current={ps:[],cs:[]};};
  const resetDw2Slots=()=>{dw2SlotRef.current=0;dw2SpoilsRef.current={ps:[],cs:[]};};

  // ── warStep: event-driven war state machine ──────────────────────────────
  // warSlotRef is the single counter. Everything else is read from live refs each tap.
  // No snapshots. No warStateRef. No phase string checks for decisions.
  const warStep=useCallback(()=>{
    const ph = phaseRef.current;
    if(ph!=="war" && ph!=="war_card") return;

    const autoFill = configRef.current.warAutoFill;

    // Always fresh from live refs — they are updated synchronously by setPDeck etc.
    let pd = [...pDeckRef.current];
    let cd = [...cDeckRef.current];
    let wc = [...wCardsRef.current];
    let pCollectLocal=[...pCollectRef.current];
    let cCollectLocal=[...cCollectRef.current];

    // Refill draw from collect whenever draw has ≤1 card (needs 2 to place a spoil + keep war card)
    // This applies regardless of autoFill — a player with collect cards should never be mercy-blocked
    if(pd.length<=1&&pCollectLocal.length>0){
      const nw=shuf([...pCollectLocal,...(pd.length===1?pd:[])]);
      setPDeck(nw); setPCollect([]); pd=nw; pCollectLocal=[];
      addLog("collect","P draw refilled from collect | draw now: "+nw.length);
    }
    if(cd.length<=1&&cCollectLocal.length>0){
      const nw=shuf([...cCollectLocal,...(cd.length===1?cd:[])]);
      setCDeck(nw); setCCollect([]); cd=nw; cCollectLocal=[];
      addLog("collect","CPU draw refilled from collect | draw now: "+nw.length);
    }

    // Mercy: pile empty — collect immediately
    if(pd.length===0||cd.length===0){
      resetWarSlots();
      const cur=bfRef.current;
      const ew=pd.length===0?"cpu":"player";
      collectAndDealRef.current(pd,cd,ew,wc,pCollectLocal,cCollectLocal,ew==="player"?cur.plF:cur.cpuF);
      return;
    }

    // ── SLOT CHECK ───────────────────────────────────────────────────────────
    // warSlotRef: 0→1→2→3 tracks how many spoils placed this war.
    // warSpoilsRef: accumulates the actual cards — plain ref, no React lag.
    const canSpoil = () => warSlotRef.current < 3 && pd.length > 1 && cd.length > 1;
    let ps = [...warSpoilsRef.current.ps];
    let cs = [...warSpoilsRef.current.cs];

    // Inline refill helper — called whenever a draw pile drops to ≤1 mid-war loop
    const refillIfNeeded=()=>{
      if(pd.length<=1&&pCollectLocal.length>0){
        const nw=shuf([...pCollectLocal,...pd]);
        setPDeck(nw); setPCollect([]); pd=nw; pCollectLocal=[];
        addLog("collect","P draw refilled from collect | draw now: "+nw.length);
      }
      if(cd.length<=1&&cCollectLocal.length>0){
        const nw=shuf([...cCollectLocal,...cd]);
        setCDeck(nw); setCCollect([]); cd=nw; cCollectLocal=[];
        addLog("collect","CPU draw refilled from collect | draw now: "+nw.length);
      }
    };

    if(autoFill){
      while(canSpoil()){
        const a=pd.shift(), b=cd.shift();
        ps.push(a); cs.push(b); wc.push(a,b);
        warSlotRef.current++;
        addLog("spoil",`S${warSlotRef.current}: P=${a.rank}${a.suit}(${RV[a.rank]}) CPU=${b.rank}${b.suit}(${RV[b.rank]}) | draw P:${pd.length} CPU:${cd.length}`);
        refillIfNeeded(); // refill after each draw so canSpoil() sees accurate length
      }
      warSpoilsRef.current = {ps:[...ps], cs:[...cs]};
      if(warSlotRef.current<3){
        addLog("mercy",`Only ${warSlotRef.current}/3 spoils — P draw:${pd.length} CPU draw:${cd.length} (mercy: short pile)`);
        // Mark empty slots as mercy so the UI can render them distinctly
        wrapBfState(s=>({...s, mercySpoils:warSlotRef.current, plSp:[...ps], cpuSp:[...cs]}));
      }
    } else if((refillIfNeeded(),canSpoil())){
      const a=pd.shift(), b=cd.shift();
      ps.push(a); cs.push(b); wc.push(a,b);
      warSlotRef.current++;
      warSpoilsRef.current = {ps:[...ps], cs:[...cs]};
      setPDeck([...pd]); setCDeck([...cd]); setWCards([...wc]);
      snd("whoosh");
      addLog("spoil",`S${warSlotRef.current}: P=${ps[ps.length-1].rank}${ps[ps.length-1].suit}(${RV[ps[ps.length-1].rank]}) CPU=${cs[cs.length-1].rank}${cs[cs.length-1].suit}(${RV[cs[cs.length-1].rank]}) | draw P:${pd.length} CPU:${cd.length}`);
      wrapBfState(s=>({...s, plSp:[...ps], cpuSp:[...cs]}));
      setMsg(`Spoil ${warSlotRef.current}/3 — ${3-warSlotRef.current} more to go.`);
      return;
    }

    // ── PLACE WAR CARD ───────────────────────────────────────────────────────
    if(pd.length===0||cd.length===0){
      resetWarSlots();
      collectAndDealRef.current(pd,cd,pd.length===0?"cpu":"player",wc,
        pCollectRef.current,cCollectRef.current);
      return;
    }

    const a=pd.shift(), b=cd.shift(); wc.push(a,b);
    resetWarSlots();

    const pv=RV[a.rank], cv=RV[b.rank];
    const isDouble=pv===cv;
    const playerWon=pv!==cv?pv>cv:SV[a.suit]>SV[b.suit];
    addLog("warCard",`P=${a.rank}${a.suit}(${RV[a.rank]}) CPU=${b.rank}${b.suit}(${RV[b.rank]}) → ${isDouble?"tied":playerWon?"P wins":"CPU wins"} · pot ${wc.length} | draw P:${pd.length} CPU:${cd.length}`);
    const w=playerWon?"player":"cpu";
    const cur=bfRef.current;

    showQuip(warQuip(playerWon,a,b,cur.plF,cur.cpuF,ps,cs),playerWon);
    setWars(x=>x+1);
    if(playerWon){
      const nextPWW=pWarWinsRef.current+1;
      pWarWinsRef.current=nextPWW;
      setPWarWins(nextPWW);
      if(configRef.current.gameMode==="wars"&&nextPWW>=configRef.current.warTarget&&startedRef.current&&fightsRef.current>0){
        gWinRef.current="player";
        pendingWarWinRef.current="player";
      }
    } else {
      const nextCWW=cWarWinsRef.current+1;
      cWarWinsRef.current=nextCWW;
      setCWarWins(nextCWW);
      if(configRef.current.gameMode==="wars"&&nextCWW>=configRef.current.warTarget&&startedRef.current&&fightsRef.current>0){
        gWinRef.current="cpu";
        pendingWarWinRef.current="cpu";
      }
    }

    setPDeck([...pd]); setCDeck([...cd]); setWCards([...wc]);
    const wi=buildWarInfo(playerWon,a,b,wc[0],wc[1],ps,cs,wc);
    const potLabel=wc.length>2?` (${wc.length} cards)`:"";
    const potVal=cardValue(wc);
    // autoFill: show spoils face-down first, then auto-flip after short delay
    // manual: player tapped each spoil face-down already; reveal immediately on war card tap
    const revealNow=!autoFill;
    if(!isDouble){
      setLastRig(0);
      wrapBfState(s=>({...s,
        plSp:[...ps],cpuSp:[...cs],tapCt:ps.length,
        plW:a,cpuW:b,rw:w,revealed:revealNow,phase:"war_reveal",warInfo:wi,
        dw2PlSp:[],dw2CpuSp:[],dw2PlW:null,dw2CpuW:null,dw2Round:0,
      }));
      setMsg(playerWon
        ?`⚔️ You win the War${potLabel}! Total value: ${potVal}`
        :`⚔️ ${cfRef.current.name} wins the War${potLabel}. Total value: ${potVal}`);
      if(autoFill) setTimeout(()=>wrapBfState(s=>s.phase==="war_reveal"?{...s,revealed:true}:s),500);
    } else {
      addLog("war",`War x2 | P=${a.rank}${a.suit} vs CPU=${b.rank}${b.suit}`);
      setLastRig(0); // rig consumed — clear dev bar glow
      resetDw2Slots();
      wrapBfState(s=>({...s,
        plSp:[...ps],cpuSp:[...cs],tapCt:ps.length,
        plW:a,cpuW:b,rw:null,revealed:revealNow,phase:"double_war",warInfo:wi,
        dw2PlSp:[],dw2CpuSp:[],dw2PlW:null,dw2CpuW:null,dw2Round:(s.dw2Round||0)+1,
      }));
      setMsg(`🔥 DOUBLE WAR! Both played ${a.rank} — tap to deal spoils!`);
      if(autoFill) setTimeout(()=>wrapBfState(s=>s.phase==="double_war"?{...s,revealed:true}:s),500);
    }
    snd("clash");
  },[snd,showQuip]);
  const warStepRef=useRef(warStep); warStepRef.current=warStep;

  // collectAndDeal: won cards go to winner's COLLECTION pile (face-up).
  // Draw pile feeds fighting. When player draw pile empties, pause for flip.
  // CPU auto-flips its own collect pile.
  const collectAndDeal=useCallback((pd,cd,winner,cards,pc,cc,topCard)=>{
    const newPc=winner==="player"?[...pc,...shuf(cards)]:pc;
    const newCc=winner==="cpu"?[...cc,...shuf(cards)]:cc;
    setPCollect(newPc); setCCollect(newCc);
    // Track top face card — use explicitly passed winner's fight card
    if(topCard){
      if(winner==="player")setPLastWon(topCard);
      else setCLastWon(topCard);
    } else {
      if(winner==="player"){setPLastWon(bfRef.current.plF||null);}
      else{setCLastWon(bfRef.current.cpuF||null);}
    }
    const pTotal=pd.length+newPc.length;
    const cTotal=cd.length+newCc.length;
    if(pTotal===0){
      setPDeck([]);setCDeck(cd);
      wrapBfState({...INIT_BF,phase:"gameover"});recordResult("cpu");setGWinReason("cards");setWCards([]);
      snd("defeat");setMsg("💀 DEFEAT — you lost all your cards.");
      return;
    }
    if(cTotal===0){
      setPDeck(pd);setCDeck([]);
      wrapBfState({...INIT_BF,phase:"gameover"});recordResult("player");setGWinReason("cards");setWCards([]);
      snd("fanfare");setMsg("🏆 VICTORY — you captured all 52 cards!");
      return;
    }
    // CPU out-of-cards check (flip handled by canonical effect)
    let finalCd=cd; let finalCc=newCc;
    if(cd.length===0&&newCc.length===0){
      // CPU truly out of cards → player wins
      setPDeck(pd);setCDeck([]);setPCollect(newPc);setCCollect([]);
      wrapBfState({...INIT_BF,phase:"gameover"});recordResult("player");setGWinReason("cards");setWCards([]);
      snd("fanfare");setMsg("🏆 VICTORY — opponent ran out of cards!");
      return;
    }
    // Player out-of-cards check (flip handled by canonical effect)
    let finalPd=pd; let finalPc=newPc;
    if(pd.length===0&&newPc.length===0){
      // Player truly out of cards → cpu wins
      setPDeck([]);setCDeck(finalCd);setPCollect([]);setCCollect(finalCc);
      wrapBfState({...INIT_BF,phase:"gameover"});recordResult("cpu");setGWinReason("cards");setWCards([]);
      snd("defeat");setMsg("💀 DEFEAT — you ran out of cards!");
      return;
    }
    setWCards([]);
    setTick(t=>t+1);
    // Inline flip for dealFight call — canonical effect fires async so we must flip here too
    let dealPd=finalPd, dealCd=finalCd;
    if(dealPd.length===0&&newPc.length>0){dealPd=shuf([...newPc]);setPDeck(dealPd);setPCollect([]);}
    if(dealCd.length===0&&newCc.length>0){dealCd=shuf([...newCc]);setCDeck(dealCd);setCCollect([]);}
    dealFight(dealPd,dealCd,0,[]);
  },[snd,dealFight]);


  // ── tapPile: single entry point for all player input ──────────────────────
  // "resolve", "war_reveal", "double_reveal" all collect AND immediately deal
  // the next fight — no idle bounce, no extra tap needed.
  const tapLock=useRef(false);
  const tapPile=useCallback(()=>{
    if(tapLock.current)return;   // block re-entrant taps during state transitions
    tapLock.current=true;
    setTimeout(()=>{tapLock.current=false;},80); // release after React render cycle
    const cur=bfRef.current;
    const pd=pDeckRef.current, cd=cDeckRef.current, wc=wCardsRef.current;
    if(!startedRef.current){tapLock.current=false;return;}
    switch(cur.phase){
      case "idle":{        dealFightRef.current(pd,cd,0,[]);
        break;
      }
      case "resolve":{
        if(phaseRef.current!=="resolve")break; // double-tap guard (phaseRef updates sync)
        const slide=bfRef.current.rw==="player"?"cpu":"player";
        wrapBfState(s=>({...s,phase:"collecting",fightSlide:slide}));
        startCollectAnimRef.current("fight"); // onTransitionEnd fires collectAndDeal
        break;
      }
      case "war":
      case "war_card":{
        // warStep is the single brain — handles empty piles via mercy path
        warStepRef.current();
        break;
      }
      case "double_war":
      case "double_war_card":{
        // S1→S2→S3 face-down one per tap, then war card placed face-up with result shown immediately.
        // autoFill=true: all spoils + war card placed in one tap; result shown immediately.
        // War card glow: "tie"=orange, "player"/"cpu"=green/red — set at placement, not on reveal.
        const dAutoFill=configRef.current.warAutoFill;
        let dPd=[...pDeckRef.current], dCd=[...cDeckRef.current];
        if(dPd.length===0&&pCollectRef.current.length>0){dPd=shuf([...pCollectRef.current]);setPDeck(dPd);setPCollect([]);}
        if(dCd.length===0&&cCollectRef.current.length>0){dCd=shuf([...cCollectRef.current]);setCDeck(dCd);setCCollect([]);}
        const dCur=bfRef.current;
        // Mercy: any deck empty after refill attempts
        if(dPd.length===0||dCd.length===0){
          resetDw2Slots();
          const merWinner=dPd.length===0?"cpu":"player";
          collectAndDealRef.current(dPd,dCd,merWinner,
            [...wCardsRef.current,...(dCur.dw2PlSp||[]),...(dCur.dw2CpuSp||[])],
            pCollectRef.current,cCollectRef.current);
          break;
        }
        let dPs=[...dw2SpoilsRef.current.ps], dCs=[...dw2SpoilsRef.current.cs];

        // Helper: compute war card result and transition to double_war_card
        const placeDw2WarCard=(wA,wB,allPot,allPs,allCs)=>{
          const wPv=RV[wA.rank], wCv=RV[wB.rank];
          const isWTie=wPv===wCv;
          const wPlayerWon=wPv!==wCv?wPv>wCv:SV[wA.suit]>SV[wB.suit];
          const wRw=isWTie?"tie":(wPlayerWon?"player":"cpu");
          addLog("dw2spoil",`DW war card placed | draw P:${dPd.length} CPU:${dCd.length}`);
          setPDeck([...dPd]); setCDeck([...dCd]); setWCards(allPot);
          wrapBfState(s=>({...s,phase:"double_war_card",dw2PlSp:[...allPs],dw2CpuSp:[...allCs],dw2PlW:wA,dw2CpuW:wB,rw:wRw}));
          if(isWTie){setMsg(`🔥 War cards tied again! Both played ${wA.rank} — tap to continue!`);}
          else{setMsg(`🔥 War card revealed — ${wPlayerWon?"You win":"CPU wins"}! Tap to collect.`);}
          snd(isWTie?"clash":"win");
        };

        if(dCur.phase==="double_war"&&dAutoFill){
          // AutoFill: place all 3 spoils + war card in one burst
          const allDw2=[...wCardsRef.current];
          while(dw2SlotRef.current<3&&dPd.length>1&&dCd.length>1){
            const dA=dPd.shift(), dB=dCd.shift();
            dPs.push(dA); dCs.push(dB); allDw2.push(dA,dB);
            dw2SlotRef.current++;
            addLog("dw2spoil",`DW S${dw2SlotRef.current}: P=${dA.rank}${dA.suit}(${RV[dA.rank]}) CPU=${dB.rank}${dB.suit}(${RV[dB.rank]}) | draw P:${dPd.length} CPU:${dCd.length}`);
          }
          dw2SpoilsRef.current={ps:[...dPs],cs:[...dCs]};
          if(dPd.length===0||dCd.length===0){
            resetDw2Slots();
            collectAndDealRef.current(dPd,dCd,dPd.length===0?"cpu":"player",[...allDw2],pCollectRef.current,cCollectRef.current);
            break;
          }
          const dA=dPd.shift(), dB=dCd.shift(); allDw2.push(dA,dB);
          placeDw2WarCard(dA,dB,allDw2,dPs,dCs);
        } else if(dw2SlotRef.current<3&&dCur.phase==="double_war"){
          // Place one face-down spoil (S1, S2, S3 one per tap)
          const dA=dPd.shift(), dB=dCd.shift();
          dPs.push(dA); dCs.push(dB);
          dw2SlotRef.current++;
          dw2SpoilsRef.current={ps:[...dPs],cs:[...dCs]};
          setPDeck([...dPd]); setCDeck([...dCd]);
          setWCards([...wCardsRef.current,dA,dB]);
          addLog("dw2spoil",`DW S${dw2SlotRef.current}: P=${dA.rank}${dA.suit}(${RV[dA.rank]}) CPU=${dB.rank}${dB.suit}(${RV[dB.rank]}) | draw P:${dPd.length} CPU:${dCd.length}`);
          wrapBfState(s=>({...s,phase:"double_war",dw2PlSp:[...dPs],dw2CpuSp:[...dCs]}));
          const rem=3-dw2SlotRef.current;
          setMsg(rem>0?`🔥 Double War spoil ${dw2SlotRef.current}/3 — ${rem} more.`:"🔥 All spoils placed — tap to place war card.");
          snd("whoosh");
        } else if(dCur.phase==="double_war"&&dw2SlotRef.current>=3&&!dCur.dw2PlW){
          // All 3 spoils placed — place the war card (result revealed immediately)
          if(dPd.length===0||dCd.length===0){
            resetDw2Slots();
            collectAndDealRef.current(dPd,dCd,dPd.length===0?"cpu":"player",
              [...wCardsRef.current,...dPs,...dCs],pCollectRef.current,cCollectRef.current);
            break;
          }
          const dA=dPd.shift(), dB=dCd.shift();
          placeDw2WarCard(dA,dB,[...wCardsRef.current,dA,dB],dPs,dCs);
        } else if(dCur.phase==="double_war_card"){
          // Collect/continue tap — rw already set at card placement
          const dA=dCur.dw2PlW, dB=dCur.dw2CpuW;
          if(!dA||!dB){ snd("whoosh"); break; }
          const dW=dCur.rw; // "player", "cpu", or "tie"
          const dAllW=wCardsRef.current;
          if(dW==="tie"){
            // Another war level
            const nextRound=(dCur.dw2Round||1)+1;
            resetDw2Slots();
            addLog("war",`War x${nextRound} | P=${dA.rank}${dA.suit} vs CPU=${dB.rank}${dB.suit}`);
            wrapBfState(s=>({...s,phase:"double_war",dw2PlSp:[],dw2CpuSp:[],dw2PlW:null,dw2CpuW:null,rw:null,dw2Round:nextRound}));
            setMsg(`🔥 WAR × ${nextRound} — tap for more spoils!`);
            snd("clash");
          } else {
            const dPlayerWon=dW==="player";
            addLog("dw2card",`DW Card: P=${dA.rank}${dA.suit}(${RV[dA.rank]}) CPU=${dB.rank}${dB.suit}(${RV[dB.rank]}) → ${dPlayerWon?"P wins":"CPU wins"} · pot ${dAllW.length}`);
            if(dPlayerWon){
              const nextPWW=pWarWinsRef.current+1; pWarWinsRef.current=nextPWW; setPWarWins(nextPWW);
              if(configRef.current.gameMode==="wars"&&nextPWW>=configRef.current.warTarget&&startedRef.current&&fightsRef.current>0){gWinRef.current="player";pendingWarWinRef.current="player";}
            } else {
              const nextCWW=cWarWinsRef.current+1; cWarWinsRef.current=nextCWW; setCWarWins(nextCWW);
              if(configRef.current.gameMode==="wars"&&nextCWW>=configRef.current.warTarget&&startedRef.current&&fightsRef.current>0){gWinRef.current="cpu";pendingWarWinRef.current="cpu";}
            }
            setWars(x=>x+1);
            resetDw2Slots(); setLastRig(0);
            const dCur2=bfRef.current;
            const dWi=buildWarInfo(dPlayerWon,dA,dB,dCur2.plF,dCur2.cpuF,
              [...(dCur2.plSp||[]),dCur2.plW,...(dCur2.dw2PlSp||[])].filter(Boolean),
              [...(dCur2.cpuSp||[]),dCur2.cpuW,...(dCur2.dw2CpuSp||[])].filter(Boolean),dAllW);
            wrapBfState(s=>({...s,rw:dW,phase:"double_reveal",dw2PlW:dA,dw2CpuW:dB,warInfo:dWi}));
            setMsg(dPlayerWon
              ?`🔥 You win! ${dA.rank} beats ${dB.rank} · ${dAllW.length} cards!`
              :`🔥 ${cfRef.current.name} wins! ${dB.rank} beats ${dA.rank} · ${dAllW.length} cards!`);
            snd("clash");
          }
        }
        break;
      }
      case "war_reveal":
      case "double_reveal":{
        if(phaseRef.current!=="war_reveal"&&phaseRef.current!=="double_reveal")break; // phaseRef updates sync
        // If this war just won the race, fire gameover now (user has seen the war hand)
        if(pendingWarWinRef.current){
          const winner=pendingWarWinRef.current;
          pendingWarWinRef.current=null;
          wrapBfState(s=>({...s,phase:"gameover"}));
          recordResult(winner);
          setGWinReason("wars");
          break;
        }
        // Single atomic update: phase+warCollect together so inWar stays true with no gap
        wrapBfState(s=>({...s,phase:"collecting",warCollect:"spoils"}));
        animStepRef.current = "spoils";
        scheduleAnimFallbackRef.current?.("spoils", 800);
        break;
      }
      case "collecting":{ break; }
      case "gameover":{ break; }
      default:break;
    }
  },[]);
  const tapPileRef=useRef(tapPile);
  tapPileRef.current=tapPile;

  // ── startGame ──────────────────────────────────────────────────────────────
  const recordResult=useCallback((winner)=>{
    gWinRef.current=winner;
    setGWin(winner);
    // Record per-mode stats snapshot at game end
    const mode=configRef.current.gameMode==="wars"?"race":"classic";
    setSessionStats(prev=>{
      const prev_mode=prev[mode];
      const newBest=winner==="player"
        ?(prev_mode.bestTime===null?durRef.current:Math.min(prev_mode.bestTime,durRef.current))
        :prev_mode.bestTime;
      return {...prev,[mode]:{
        wins:prev_mode.wins+(winner==="player"?1:0),
        losses:prev_mode.losses+(winner==="cpu"?1:0),
        duels:prev_mode.duels+fightsRef.current,
        wars:prev_mode.wars+warsRef.current,
        bestTime:newBest,
      }};
    });
  },[]);

  const startGame=useCallback(()=>{
    clearTimeout(autoRef.current); resetWarSlots(); setConfirmRestart(false); setSurrenderModal(false); gWinRef.current=null; pendingWarWinRef.current=null; setLastRig(0); pWarWinsRef.current=0; cWarWinsRef.current=0;
    const cfg=configRef.current;
    addLog("init","━━━ NEW GAME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    addLog("init",`Mode: ${cfg.gameMode==="wars"?`War Race (first to ${cfg.warTarget})`:cfg.gameMode==="cards"?"Classic Cards":"Unknown"}`);
    addLog("init",`Auto Speed: ${cfg.autoSpeed===0?"Off":cfg.autoSpeed+"x"}  |  Dev Speed Play: ${dev?"ON":"OFF"}`);
    addLog("init",`Pile Side: ${cfg.pileSide}  |  Card Size: ${cfg.cardSize||"md"}  |  Sound: ${cfg.muted?"OFF":"ON"}`);
    addLog("init",`War Auto-Fill: ${cfg.warAutoFill?"ON":"OFF"}  |  Msg Bar: ${cfg.showMsg?"ON":"OFF"}`);
    addLog("init","━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const nc=rndCpu();setCpuFam(nc);cfRef.current=nc;
    const deck=shuf(mkDeck());
    // Reset everything but show the deal intro first
    setPDeck([]);setCDeck([]);wrapBfState(INIT_BF);setWCards([]);
    setPCollect([]);setCCollect([]);setPLastWon(null);setCLastWon(null);
    setDur(0);setFights(0);setWars(0);setPWarWins(0);setCWarWins(0);setTick(0);setStarted(false);setGWin(null);setGWinReason("cards");setQuip(null);
    setIntroCards(deck);setIntroDelt(0);setDealIntro(true);
    setMsg("✨ Dealing cards...");
  },[]);



  // ── Deal intro engine ───────────────────────────────────────────────────
  // Auto-trigger deal when autoplay/dev is on and deck is waiting
  useEffect(()=>{
    if(!dealIntro||introDelt!==0)return;
    const active=devRef.current||configRef.current.autoSpeed>0;
    if(!active)return;
    const t=setTimeout(()=>setIntroDelt(1),200);
    return()=>clearTimeout(t);
  },[dealIntro,introDelt]);

  // When introDelt advances from 1..52, fire a card every 55ms round-robin
  useEffect(()=>{
    if(!dealIntro||introDelt===0)return;
    const idx=introDelt-1; // 0-based card index
    const total=introCards.length;
    if(idx>=total){
      // All cards dealt — piles already built card-by-card, just finalize
      setDealIntro(false);setIntroCards([]);setIntroDelt(0);
      setStarted(true);
      setMsg("Tap your draw pile to begin!");
      return;
    }
    const card=introCards[idx];
    const toPlayer=idx%2===1; // 0→CPU, 1→Player, 2→CPU ...
    if(toPlayer){setPDeck(d=>[...d,card]);}else{setCDeck(d=>[...d,card]);}
    const delay=Math.max(10, 22 - Math.floor(idx/8)*2); // fast deal, accelerates
    const t=setTimeout(()=>setIntroDelt(n=>n+1), delay);
    return()=>clearTimeout(t);
  },[dealIntro,introDelt,introCards]);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOPLAY ENGINE
  //
  // Single useEffect. Deps: only phase/dev/autoSpeed/started — the primitives
  // that determine whether/how to run. Game functions are accessed via stable
  // refs so the closure is never stale and the effect never re-registers mid-
  // run or races with itself. Each step changes phase → effect fires again →
  // next step scheduled → continuous loop.
  // ═══════════════════════════════════════════════════════════════════════════
  const autoSpeed=config.autoSpeed;

  // Stable refs pointing at latest game functions
  const dealFightRef=useRef(dealFight);
  dealFightRef.current=dealFight;
  const collectAndDealRef=useRef(collectAndDeal);
  collectAndDealRef.current=collectAndDeal;
  // ── ANIMATION SEQUENCER ─────────────────────────────────────────────────────
  // animStep: tracks the active collect animation step.
  // Prevents duplicate onTransitionEnd fires (browsers fire once per property).
  // Values: null | "fight_slide" | "spoils" | "carpet" | "fight" | "duelfly"
  const animStepRef = useRef(null);
  // Called by onTransitionEnd handlers on animated elements to advance the chain
  // Fallback: if onTransitionEnd never fires (reduced motion, hidden tab, no card shown),
  // advance after a generous timeout. Each step clears the previous fallback.
  const animFallbackRef = useRef(null);
  const scheduleAnimFallback = useCallback((step, ms) => {
    clearTimeout(animFallbackRef.current);
    animFallbackRef.current = setTimeout(() => {
      if(animStepRef.current === step) onAnimDoneRef.current(step);
    }, ms);
  }, []);
  scheduleAnimFallbackRef.current = scheduleAnimFallback;

  const onAnimDone = useCallback((step) => {
    if(animStepRef.current !== step) return; // stale/duplicate fire, ignore
    clearTimeout(animFallbackRef.current); // cancel fallback — real event fired
    animStepRef.current = null; // consume — next step will set a new value
    if(step === "fight_slide"){
      // Normal fight collect: card finished sliding → collect and deal
      collectAndDealRef.current(
        pDeckRef.current, cDeckRef.current,
        bfRef.current.rw, wCardsRef.current,
        pCollectRef.current, cCollectRef.current,
        bfRef.current.rw==="player"?bfRef.current.plF:bfRef.current.cpuF
      );
    } else if(step === "spoils"){
      // If no spoils exist (mercy rule), skip directly to carpet
      const hasSpoils = (bfRef.current.plSp?.length||0) > 0;
      if(!hasSpoils){
        animStepRef.current = "carpet"; // skip directly to carpet step (no spoils to animate)
        wrapBfState(s=>({...s, warCollect:"carpet"}));
        scheduleAnimFallback("carpet", 500);
        return;
      }
      animStepRef.current = "carpet";
      wrapBfState(s=>({...s, warCollect:"carpet"}));
      scheduleAnimFallback("carpet", 500); // carpet fly = .32s, fallback at 500ms
    } else if(step === "carpet"){
      animStepRef.current = "fight";
      wrapBfState(s=>({...s, warCollect:"fight", fightSlide: s.rw==="player"?"cpu":"player"}));
      scheduleAnimFallback("fight", 400); // fight slide = .25s, fallback at 400ms
    } else if(step === "fight"){
      animStepRef.current = "duelfly";
      wrapBfState(s=>({...s, warCollect:"duelfly"}));
      scheduleAnimFallback("duelfly", 600); // duel fly = .4s, fallback at 600ms
    } else if(step === "duelfly"){
      // Winner flew to collect pile → collect and deal
      collectAndDealRef.current(
        pDeckRef.current, cDeckRef.current,
        bfRef.current.rw, wCardsRef.current,
        pCollectRef.current, cCollectRef.current,
        bfRef.current.rw==="player"?bfRef.current.plF:bfRef.current.cpuF
      );
    }
  }, [wrapBfState, scheduleAnimFallback]);
  const onAnimDoneRef = useRef(onAnimDone);
  onAnimDoneRef.current = onAnimDone;

  // startCollectAnim: kicks off either fight_slide or war collect sequence
  const startCollectAnim = useCallback((type) => {
    if(type === "fight"){
      animStepRef.current = "fight_slide";
      scheduleAnimFallback("fight_slide", 400); // card slide = .25s, fallback at 400ms
    } else if(type === "war"){
      animStepRef.current = "spoils";
      wrapBfState(s=>({...s, warCollect:"spoils"}));
      // Spoil fallback: 3 spoils × 120ms stagger + 280ms anim = ~640ms, fallback at 800ms
      scheduleAnimFallback("spoils", 800);
    }
  }, [wrapBfState, scheduleAnimFallback]);
  const startCollectAnimRef = useRef(startCollectAnim);
  startCollectAnimRef.current = startCollectAnim;

  // Autoplay engine — fully ref-based, no stale closure issues.
  // Uses a single self-cancelling loop driven entirely by refs.
  // The effect only STARTS or STOPS the loop; step() re-reads all state via refs.
  const autoLoopRef=useRef(false);
  // resolve or collecting transitions before the phase ref updates
  useEffect(()=>{
    const active = dev || autoSpeed>0;
    if(!active || !started || phase==="gameover"){
      autoLoopRef.current=false;
      clearTimeout(autoRef.current);
      return;
    }
    // War phases: always stop the loop (warAutoFill effect handles its own timing after tap)
    const WAR_PHASES=["war","war_card","war_reveal","double_reveal","double_war","double_war_card","collecting"];
    if(WAR_PHASES.includes(phase)&&!dev){
      autoLoopRef.current=false;
      clearTimeout(autoRef.current);
      return;
    }
    // Start loop if not already running
    if(autoLoopRef.current) return;
    autoLoopRef.current=true;
    const loop=()=>{
      if(!autoLoopRef.current) return;
      const curDev=devRef.current;
      const curSpeed=configRef.current.autoSpeed;
      const active2=curDev||curSpeed>0;
      if(!active2||!startedRef.current){autoLoopRef.current=false;return;}
      // Use phaseRef (updated synchronously in wrapBfState) to avoid stale renders
      const ph=phaseRef.current;
      if(ph==="gameover"||gWinRef.current){autoLoopRef.current=false;return;}
      // Hard stop for war phases unless dev — warAutoFill uses its own effect
      if(!curDev&&(ph==="war"||ph==="war_card"||ph==="war_reveal"||ph==="double_reveal"||ph==="double_war"||ph==="double_war_card"||ph==="collecting")){
        autoLoopRef.current=false;return;
      }
      // dev+collecting: keep loop running (anim fallback drives the phase forward)
      const d=curDev?50:curSpeed===1?950:curSpeed===2?350:100;
      const pd=pDeckRef.current, cd=cDeckRef.current;
      const wc=wCardsRef.current, cur=bfRef.current;
      if(ph==="idle"){
        let fpd=pd,fcd=cd;
        // flip handled by canonical effect
        if(fpd.length>0&&fcd.length>0) dealFightRef.current(fpd,fcd,0,[]);
      } else if(ph==="resolve"){
        const slide=cur.rw==="player"?"cpu":"player";
        wrapBfState(s=>s.phase==="resolve"?{...s,phase:"collecting",fightSlide:slide}:s);
        startCollectAnimRef.current("fight");
      } else if((ph==="war"||ph==="war_card")&&curDev){
        // dev mode: drive war through warStep (same path as a tap)
        warStepRef.current();
      } else if((ph==="war_reveal"||ph==="double_reveal")&&curDev){
        // dev: tap through war_reveal/double_reveal → triggers collect animation
        tapPileRef.current();
      } else if((ph==="double_war"||ph==="double_war_card")&&curDev){
        // dev: drive each dw2 step through tapPile (S1→S2→S3→war card→reveal)
        tapPileRef.current();
      } else if(ph==="collecting"&&curDev){
        // collecting is transient; animFallback fires the phase forward — just keep ticking
      }
      autoRef.current=setTimeout(loop, d);
    };
    clearTimeout(autoRef.current);
    autoRef.current=setTimeout(loop, dev?50:autoSpeed===1?950:autoSpeed===2?350:100);
    return()=>{autoLoopRef.current=false;clearTimeout(autoRef.current);};
  },[phase, tick, dev, autoSpeed, started, config.warAutoFill]);

  // ── HUD display values ────────────────────────────────────────────────────
  const pol=config.pileSide==="right";
  // Card size props derived from config
  const CS=config.cardSize||"md";
  const csSmall=CS==="sm", csMed=CS==="md", csLg=CS==="lg";
  // Physical card pixel dims for layout calculations
  const CW=csSmall?27:csMed?47:60, CH=csSmall?39:csMed?68:87;
  const inWar=["war","war_card","war_reveal","double_reveal","double_war","double_war_card"].includes(phase)||(phase==="collecting"&&bf.warCollect!==null);
  const aLbl=autoSpeed===0?"Auto:Off":autoSpeed===1?"Auto 1x":autoSpeed===2?"Auto 2x":"Auto 3x";
  const aCol=autoSpeed===0?"#ef4444":"#22c55e";
  const aBg=autoSpeed===0?"rgba(50,0,0,.85)":"rgba(0,44,14,.9)";

  const mCol=inWar?"#ffaaaa":phase==="resolve"&&bf.rw==="player"?"#86efac":phase==="resolve"?"#fca5a5":"#c8b87a";
  const pileOk=phase!=="gameover"&&!gWinRef.current; // also block during 350ms gameover delay
  // True card counts: draw + collect + any cards currently on battlefield
  const pCount=pDeck.length+pCollect.length+(bf.plF?1:0)+(bf.plSp?.length||0)+(bf.plW?1:0);
  const cCount=cDeck.length+cCollect.length+(bf.cpuF?1:0)+(bf.cpuSp?.length||0)+(bf.cpuW?1:0);
  const total=pCount+cCount||52;
  const pPct=Math.round((pCount/total)*100);

  if(closed) return(
    <div style={{maxWidth:480,margin:"0 auto",fontFamily:"'Segoe UI',Verdana,Geneva,sans-serif"}}>
      <div style={{background:"rgba(0,0,0,.9)",border:"1px solid rgba(218,165,32,.3)",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontSize:14}}>⚔️</div>
        <div style={{flex:1,fontSize:11,color:"#DAA520",letterSpacing:1}}>GLOW WAR</div>
        <div style={{fontSize:9,color:"rgba(200,184,122,.5)"}}>{fmt(dur)} · {fights} duels</div>
        <button onClick={()=>setClosed(false)} style={{background:"rgba(60,20,0,.8)",border:"1px solid rgba(218,165,32,.4)",color:"#DAA520",padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:"bold"}}>▶ Resume</button>
      </div>
    </div>
  );

  // ── CARD AUDIT (dev) ─────────────────────────────────────────────────────────
  // Runs every time any pile changes. Checks: total === 52, no duplicates.
  useEffect(()=>{
    if(!started||dealIntro) return;
    const all=[...pDeck,...cDeck,...pCollect,...cCollect,...wCards];
    const total=all.length;
    if(total!==52){
      console.error(`%c[CARD AUDIT] ❌ Total cards: ${total} (expected 52) | pDeck:${pDeck.length} cDeck:${cDeck.length} pCollect:${pCollect.length} cCollect:${cCollect.length} wCards:${wCards.length} | phase:${phaseRef.current}`,"color:red;font-weight:bold");
    }
    const seen=new Map();
    const dupes=[];
    for(const c of all){
      const k=`${c.rank}${c.suit}`;
      if(seen.has(k)) dupes.push(k);
      else seen.set(k,true);
    }
    if(dupes.length){
      console.error(`%c[CARD AUDIT] ❌ Duplicate cards: ${dupes.join(", ")} | phase:${phaseRef.current}`,"color:red;font-weight:bold");
    }
  },[pDeck,cDeck,pCollect,cCollect,wCards,started,dealIntro]);

  return(
    <div style={{height:"100vh",maxWidth:480,margin:"0 auto",overflow:"hidden",background:"linear-gradient(180deg,#06030f,#150a03,#0a0614,#06030f)",color:"#e8d5a3",display:"flex",flexDirection:"column",position:"relative",fontFamily:"'Segoe UI',Verdana,Geneva,sans-serif"}}>
      <style>{`
        @keyframes wP{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes warAlert{0%{opacity:.15}15%{opacity:1}30%{opacity:.15}45%{opacity:1}60%{opacity:.15}75%,100%{opacity:1}}
        @keyframes bounceIn{0%{transform:scale(0) rotate(-10deg)}60%{transform:scale(1.2) rotate(3deg)}100%{transform:scale(1) rotate(0)}}
        @keyframes pulseText{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes quipIn{0%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes cardFlip{0%{transform:scaleX(1)}45%{transform:scaleX(0)}55%{transform:scaleX(0)}100%{transform:scaleX(1)}}
      `}</style>

      {/* ══ HUD ROW 1: Game Stats | Title | Options ══════════════════════════ */}
      <div style={{flexShrink:0,background:"rgba(0,0,0,.75)",borderBottom:"1px solid rgba(218,165,32,.2)"}}>
        <div style={{display:"flex",alignItems:"center",padding:"5px 8px",gap:4}}>

          {/* Game Stats */}
          {(()=>{
            return(
              <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:28}}>
                  <div style={{fontSize:9,color:"#DAA520",fontVariantNumeric:"tabular-nums",lineHeight:1.2}}>{fmt(dur)}</div>
                  <div style={{fontSize:6,color:"rgba(218,165,32,.4)",lineHeight:1}}>time</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:16}}>
                  <div style={{fontSize:9,color:"#c8b87a",fontVariantNumeric:"tabular-nums",lineHeight:1.2}}>{fights}</div>
                  <div style={{fontSize:6,color:"rgba(200,184,122,.4)",lineHeight:1}}>duels</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:14}}>
                  <div style={{fontSize:9,color:"#ff9966",fontVariantNumeric:"tabular-nums",lineHeight:1.2}}>{wars}</div>
                  <div style={{fontSize:6,color:"rgba(255,153,102,.4)",lineHeight:1}}>wars</div>
                </div>
              </div>
            );
          })()}

          {/* Title + mode badge */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:11,color:"#DAA520",letterSpacing:2,fontWeight:"bold",lineHeight:1.2}}>GLOW WAR</div>
            <div style={{fontSize:7,color:config.gameMode==="wars"?"#cc88ff":"rgba(218,165,32,.4)",letterSpacing:1,lineHeight:1.2}}>
              {config.gameMode==="wars"?`⚔️ WAR RACE · ${config.warTarget} WINS`:"🂠 CLASSIC"}
            </div>
          </div>

          {/* Options */}
          <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
            {/* Autoplay: play▶ when off(red), ▶+Nx badge when on(green) */}
            <button onClick={()=>setConfig(c=>({...c,autoSpeed:(c.autoSpeed+1)%4}))}
              title={autoSpeed===0?"Autoplay: OFF — click to enable":`Autoplay ${autoSpeed}x — click to change`}
              style={{width:26,height:26,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                position:"relative",background:aBg,
                border:`1.5px solid ${aCol}99`,borderRadius:6,cursor:"pointer",
                boxShadow:autoSpeed>0?`0 0 7px 1px ${aCol}66`:"none",transition:"all .2s"}}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <polygon points="1,1 11,6 1,11" fill={aCol}/>
              </svg>
              {autoSpeed>0&&<span style={{position:"absolute",bottom:1,right:2,fontSize:7,fontWeight:"900",color:"#22c55e",lineHeight:1,textShadow:"0 0 4px #22c55e"}}>{autoSpeed}x</span>}
            </button>
            {/* War auto-fill */}
            <button onClick={()=>setConfig(c=>({...c,warAutoFill:!c.warAutoFill}))}
              title="War Auto Fill"
              style={{width:26,height:26,flexShrink:0,background:config.warAutoFill?"rgba(218,165,32,.15)":"rgba(0,0,0,.4)",border:config.warAutoFill?"1.5px solid #DAA520":"1px solid rgba(255,255,255,.12)",borderRadius:6,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:config.warAutoFill?"0 0 6px 1px rgba(218,165,32,.4)":"none",
              transition:"all .2s"}}>⚔️</button>

            <div style={{position:"relative"}}>
              <button onClick={()=>{const inProgress=started&&phase!=="gameover"||dealIntro;if(!inProgress){setConfirmRestart(false);startGame();}else{setConfirmRestart(r=>!r);}}} style={{width:26,height:26,flexShrink:0,background:confirmRestart?"rgba(218,165,32,.25)":"rgba(60,20,0,.8)",border:confirmRestart?"1px solid #DAA520":"1px solid rgba(218,165,32,.3)",color:"#DAA520",borderRadius:6,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>↺</button>
              {confirmRestart&&<div style={{position:"absolute",top:30,right:0,zIndex:200,background:"rgba(20,8,0,.97)",border:"1px solid #DAA520",borderRadius:8,padding:"8px 10px",minWidth:120,boxShadow:"0 4px 20px rgba(0,0,0,.8)"}}>
                <div style={{fontSize:9,color:"#c8b87a",marginBottom:6,textAlign:"center",letterSpacing:.5}}>Restart game?</div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>{
                    setConfirmRestart(false);
                    // If game was in progress, show gameover so player sees stats first
                    const inProg=started&&phase!=="gameover"&&fights>0;
                    if(inProg){
                      pendingActionRef.current=()=>setTimeout(startGame,50);
                      wrapBfState(s=>({...s,phase:"gameover"}));
                      recordResult("cpu");
                      setGWin("cpu");
                      setGWinReason("forfeit");
                    } else {
                      startGame();
                    }
                  }} style={{flex:1,padding:"4px 0",background:"linear-gradient(135deg,#6b2a00,#DAA520)",border:"none",color:"#fff",borderRadius:5,cursor:"pointer",fontSize:9,fontWeight:"bold"}}>Yes</button>
                  <button onClick={()=>setConfirmRestart(false)} style={{flex:1,padding:"4px 0",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.2)",color:"#aaa",borderRadius:5,cursor:"pointer",fontSize:9}}>No</button>
                </div>
              </div>}
            </div>
            <button onClick={()=>{clearTimeout(autoRef.current);setShowConfig(true);}} style={{width:26,height:26,flexShrink:0,background:"none",border:"1px solid rgba(218,165,32,.3)",borderRadius:6,color:"#DAA520",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>⚙️</button>
            {/* Log button — only visible when logEvents enabled, glows blue when capturing */}
            {config.logEvents&&<button onClick={()=>setShowLog(l=>!l)} title={showLog?"Hide log":"Show log"}
              style={{width:26,height:26,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                position:"relative",
                background:showLog?"rgba(0,70,140,.5)":eventLog.length>0?"rgba(0,30,70,.4)":"rgba(0,0,0,.4)",
                border:showLog?"1.5px solid #4a9eff":eventLog.length>0?"1px solid rgba(74,158,255,.4)":"1px solid rgba(255,255,255,.12)",
                borderRadius:6,cursor:"pointer",
                boxShadow:showLog?"0 0 8px 2px rgba(74,158,255,.5)":eventLog.length>0?"0 0 4px 1px rgba(74,158,255,.25)":"none",
                opacity:showLog?1:.7,transition:"all .2s"}}>
              <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
                <line x1="0" y1="1" x2="13" y2="1" stroke={showLog?"#4a9eff":eventLog.length>0?"#6ab4ff":"#667"} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="0" y1="5.5" x2="9" y2="5.5" stroke={showLog?"#4a9eff":eventLog.length>0?"#6ab4ff":"#667"} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="0" y1="10" x2="11" y2="10" stroke={showLog?"#4a9eff":eventLog.length>0?"#6ab4ff":"#667"} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {eventLog.length>0&&!showLog&&<span style={{position:"absolute",top:1,right:2,fontSize:7,fontWeight:"bold",color:"#4a9eff",lineHeight:1}}>{eventLog.length>99?"99+":eventLog.length}</span>}
            </button>}
            <button onClick={()=>{clearTimeout(autoRef.current);setClosed(true);}} style={{width:26,height:26,flexShrink:0,background:"rgba(0,0,0,.6)",border:"1px solid rgba(255,255,255,.15)",borderRadius:6,color:"rgba(255,255,255,.5)",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>
          </div>
        </div>

        {/* HUD ROW 2: Progress Meter */}
        <div style={{position:"relative",height:14,background:"rgba(0,0,0,.4)",borderTop:"1px solid rgba(255,255,255,.04)"}}>
          <div style={{position:"absolute",left:0,top:0,height:"100%",
            width:pol?`${100-pPct}%`:`${pPct}%`,
            background:pol?`linear-gradient(90deg,${cpuFam?.color||"#2a2a2a"},${cpuFam?.accent||"#888"})`:"linear-gradient(90deg,#9a7410,#DAA520)",
            transition:"width .4s"}}/>
          <div style={{position:"absolute",right:0,top:0,height:"100%",
            width:pol?`${pPct}%`:`${100-pPct}%`,
            background:pol?"linear-gradient(90deg,#9a7410,#DAA520)":`linear-gradient(90deg,${cpuFam?.color||"#2a2a2a"},${cpuFam?.accent||"#888"})`,
            transition:"width .4s"}}/>
          <div style={{position:"absolute",inset:0,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 5px",pointerEvents:"none"}}>
            {pol?(
              <><span style={{fontSize:8,color:"rgba(255,255,255,.8)",fontWeight:"bold",zIndex:1}}>{cpuFam?.crest} {cCount}</span>
                <span style={{fontSize:8,color:"rgba(0,0,0,.8)",fontWeight:"bold",zIndex:1}}>{pCount} {PF.crest}</span></>
            ):(
              <><span style={{fontSize:8,color:"rgba(0,0,0,.8)",fontWeight:"bold",zIndex:1}}>{PF.crest} {pCount}</span>
                <span style={{fontSize:8,color:"rgba(255,255,255,.8)",fontWeight:"bold",zIndex:1}}>{cCount} {cpuFam?.crest}</span></>
            )}
          </div>
        </div>

        {/* Message bar — single line, game msg only. Banter is Battlefield-only. */}
        {config.showMsg&&(
          <div style={{padding:"2px 10px",height:22,background:"rgba(0,0,0,.25)",borderTop:"1px solid rgba(255,255,255,.04)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
            <div style={{fontSize:10,color:mCol,textAlign:"center",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{msg}</div>
          </div>
        )}
      </div>

      {/* ══ CPU BASE: [DrawPile][CollectPile][Trophy][Disc] ════════════ */}
      <div style={{flexShrink:0,height:116,display:"flex",alignItems:"center",padding:"6px 12px",gap:8,overflow:"hidden",
        background:"rgba(0,0,0,.15)",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,flexDirection:pol?"row":"row-reverse"}}>
          {/* Draw Deck */}
          <div ref={cDrawDomRef} style={{height:100,display:"flex",alignItems:"flex-start"}}><DrawPile count={cDeck.length} tappable={false} fam={cpuFam} side="left" cascade="up" showDisc={false}/></div>
          {/* Collection Pile */}
          <div ref={cCollectDomRef} style={{height:100,display:"flex",alignItems:"flex-start"}}><CollectPile cards={cCollect} topCard={cLastWon} fam={cpuFam}/></div>
          {/* War Trophy */}
          <WarTrophy count={cWarWins} target={config.gameMode==="wars"?config.warTarget:null} accent={cpuFam?.accent||"#aaa"} W={CW} H={CH}/>
          {/* CPU Disc */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
            <div style={{width:40,height:40,borderRadius:"50%",
              background:`linear-gradient(135deg,${cpuFam?.color||"#333"},${cpuFam?.accent||"#888"}44)`,
              border:`3px solid ${cpuFam?.accent||"#DAA520"}`,display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:17,boxShadow:"0 4px 12px rgba(0,0,0,.5)"}}>{cpuFam?.crest||"🛡️"}</div>
            <div style={{color:cpuFam?.accent||"#aaa",fontSize:7,textAlign:"center",maxWidth:56,lineHeight:1.3}}>{cpuFam?.name}</div>
          </div>
        </div>
      </div>

      {/* ══ BATTLEFIELD ══════════════════════════════════════════════════════ */}
      <div style={{flex:1,minHeight:0,padding:"2px 4px",display:"flex",flexDirection:"column"}}>
        <Battlefield bf={bf} cpuFam={cpuFam} plFam={{...PF,name:playerName}} quip={quip} pol={pol} CW={CW} CH={CH} csSmall={csSmall} csMed={csMed} csLg={csLg} pCollectRef={pCollectDomRef} cCollectRef={cCollectDomRef} dealIntro={dealIntro} introDelt={introDelt} introTotal={introCards.length} onDealClick={()=>setIntroDelt(n=>n===0?1:n)} onAnimDone={onAnimDoneRef.current} animStepRef={animStepRef} pTotal={pDeck.length+pCollect.length} cTotal={cDeck.length+cCollect.length} potCards={wCards.length}/>
      </div>

      {/* ══ PLAYER BASE: [Disc][Trophy][CollectPile][DrawPile] ══════════ */}
      <div style={{flexShrink:0,height:116,display:"flex",alignItems:"center",padding:"6px 12px",gap:8,overflow:"hidden",
        background:"rgba(0,0,0,.15)",borderTop:"1px solid rgba(255,255,255,.06)"}}>
        {/* row-reverse when pol=true so DrawPile appears on right */}
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,flexDirection:pol?"row-reverse":"row"}}>
          {/* Draw Deck */}
          <div ref={pDrawDomRef} style={{height:CH+13,display:"flex",alignItems:"flex-start"}}><DrawPile
            count={pDeck.length}
            onTap={pileOk?(started?tapPileRef.current:startGame):undefined}
            tappable={pileOk}
            small={csSmall} med={csMed}
            fam={{...PF,name:playerName}} side="left" cascade="down" showDisc={false}/></div>
          {/* Collection Pile — pulse when draw empty and it's the only tap target */}
          <div ref={pCollectDomRef} style={{height:CH+13,display:"flex",alignItems:"flex-start"}}>
            <CollectPile cards={pCollect} topCard={pLastWon} fam={{...PF,name:playerName}}
              small={csSmall} med={csMed}
              onTap={(phase==="war_reveal"||phase==="double_reveal")?tapPile:undefined}
              pulse={(phase==="war_reveal"||phase==="double_reveal")&&pDeck.length===0}
            /></div>
          {/* War Trophy */}
          <WarTrophy count={pWarWins} target={config.gameMode==="wars"?config.warTarget:null} accent="#DAA520" W={CW} H={CH}/>
          {/* Player Disc */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
            <div style={{width:40,height:40,borderRadius:"50%",
              background:`linear-gradient(135deg,${PF.color||"#333"},${PF.accent||"#888"}44)`,
              border:`3px solid ${PF.accent||"#DAA520"}`,display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:17,boxShadow:"0 4px 12px rgba(0,0,0,.5)"}}>{PF.crest||"⚔️"}</div>
            <div style={{color:PF.accent||"#DAA520",fontSize:7,textAlign:"center",maxWidth:56,lineHeight:1.3}}>{playerName}</div>
          </div>
        </div>
      </div>

      {/* ══ DEV BAR ══════════════════════════════════════════════════════════ */}
      {config.showDevBar&&phase!=="gameover"&&(
        <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          padding:"4px 10px",background:"rgba(40,0,60,.85)",
          borderTop:"1px solid rgba(180,60,255,.3)"}}>
          <span style={{fontSize:7,color:"rgba(180,80,255,.7)",letterSpacing:1.5,fontWeight:"bold",flexShrink:0}}>⚙ DEV</span>
          {/* Dev speed play toggle */}
          <button onClick={()=>setDev(d=>!d)} title={dev?"Speed Play ON — click to disable":"Speed Play OFF — click to enable"}
            style={{padding:"2px 8px",fontSize:8,fontWeight:"bold",
              color:dev?"#ff44aa":"rgba(255,68,170,.4)",
              background:dev?"rgba(70,0,35,.8)":"rgba(20,10,20,.6)",
              border:dev?"1px solid #ff44aa99":"1px solid rgba(180,80,140,.2)",
              borderRadius:5,cursor:"pointer",letterSpacing:.5,
              boxShadow:dev?"0 0 6px rgba(255,68,170,.35)":"none",
              transition:"all .2s"}}>
            Speed Play
          </button>
          <span style={{color:"rgba(180,80,255,.3)",fontSize:10,flexShrink:0}}>|</span>
          {[["WARx1",1,"#ff6644","Rig next fight → single WAR"],
            ["WARx2",2,"#ff44cc","Rig WAR → DOUBLE WAR"],
            ["WARx3",3,"#cc44ff","Rig WAR → DOUBLE → TRIPLE"]
          ].map(([label,depth,col,tip])=>{
            const active=lastRig===depth;
            return(
              <button key={label} title={tip} onClick={()=>handleRigBtn(depth)}
                style={{padding:"2px 10px",fontSize:8,fontWeight:"bold",
                  color:active?"#fff":col,
                  background:active?col+"cc":"rgba(0,0,0,.55)",
                  border:`1px solid ${col}${active?"ff":"99"}`,
                  borderRadius:5,cursor:"pointer",letterSpacing:.5,
                  boxShadow:active?`0 0 8px 3px ${col}88`:"none",
                  transition:"all .15s"}}>
                {label}
              </button>
            );
          })}
        </div>
      )}
      {/* ══ AD SPACE ═════════════════════════════════════════════════════════ */}
      <div style={{flexShrink:0,minHeight:24,maxHeight:40,background:"rgba(0,0,0,.5)",borderTop:"1px solid rgba(255,255,255,.05)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:8,color:"rgba(255,255,255,.07)",letterSpacing:2}}>AD SPACE</div>
      </div>

      {surrenderModal&&(
        <div style={{position:"absolute",inset:0,zIndex:150,background:"rgba(0,0,0,.85)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"radial-gradient(ellipse,rgba(60,0,0,.98),rgba(10,0,0,.98))",border:"2px solid rgba(255,80,80,.5)",borderRadius:14,padding:"24px 28px",maxWidth:260,textAlign:"center",boxShadow:"0 0 40px rgba(255,50,50,.25)"}}>
            <div style={{fontSize:36,marginBottom:8}}>🏳️</div>
            <div style={{fontSize:16,fontWeight:"bold",color:"#e74c3c",letterSpacing:1,marginBottom:6}}>OUT OF CARDS</div>
            <div style={{fontSize:10,color:"rgba(255,200,200,.7)",lineHeight:1.6,marginBottom:16}}>
              You have no cards left to continue the war.<br/>
              You must surrender this battle.
            </div>
            <button onClick={()=>{
              setSurrenderModal(false);
              wrapBfState({...INIT_BF,phase:"gameover"});
              recordResult("cpu");
              setGWinReason("cards");
              setWCards([]);
              snd("defeat");
              setMsg("💀 DEFEAT — surrendered in war.");
            }} style={{width:"100%",padding:"9px 0",background:"linear-gradient(135deg,#6b0000,#c0392b)",border:"2px solid rgba(255,80,80,.4)",color:"#fff",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:"bold",letterSpacing:1}}>
              🏳️ I Surrender
            </button>
          </div>
        </div>
      )}
      {phase==="gameover"&&<GameOverOverlay gWin={gWin} gWinReason={gWinReason} gameMode={config.gameMode} warTarget={config.warTarget} cpuFam={cpuFam} playerName={playerName} dur={dur} fmt={fmt} fights={fights} wars={wars} pWarWins={pWarWins} cWarWins={cWarWins} onRestart={()=>{if(pendingActionRef.current){const fn=pendingActionRef.current;pendingActionRef.current=null;fn();}else{startGame();}}} sessionStats={sessionStats}/>}
      {showLog&&<div style={{position:"absolute",top:50,right:0,bottom:0,width:"min(320px,100%)",
        background:"rgba(6,3,14,.98)",border:"1px solid rgba(74,158,255,.25)",borderRadius:"0 0 0 12px",
        display:"flex",flexDirection:"column",zIndex:50,boxShadow:"-6px 0 32px rgba(0,0,0,.8)"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"7px 10px",borderBottom:"1px solid rgba(74,158,255,.12)",flexShrink:0,
          background:"rgba(0,30,70,.4)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <svg width="11" height="9" viewBox="0 0 13 11" fill="none">
              <line x1="0" y1="1" x2="13" y2="1" stroke="#4a9eff" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="0" y1="5.5" x2="9" y2="5.5" stroke="#4a9eff" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="0" y1="10" x2="11" y2="10" stroke="#4a9eff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{color:"#4a9eff",fontWeight:"bold",fontSize:10,letterSpacing:1.5,fontFamily:"monospace"}}>EVENT LOG</span>
            <span style={{background:"rgba(74,158,255,.2)",border:"1px solid rgba(74,158,255,.3)",
              borderRadius:8,padding:"0 5px",fontSize:9,color:"#4a9eff",fontFamily:"monospace"}}>{eventLog.length}</span>
          </div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>{
              const header="TIME         │ TYPE    │ EVENT\n"+"-".repeat(60);
              const rows=eventLog.map(e=>{
                const ts=new Date(e.t).toISOString().slice(11,23);
                const type=e.type.toUpperCase().slice(0,7).padEnd(7);
                return `${ts} │ ${type} │ ${e.msg}`;
              });
              const txt=header+"\n"+rows.join("\n");
              navigator.clipboard.writeText(txt).then(()=>{
                setLogCopied(true);
                clearTimeout(logCopyTimer.current);
                logCopyTimer.current=setTimeout(()=>setLogCopied(false),2000);
              }).catch(()=>{});
            }} style={{padding:"2px 8px",
              background:logCopied?"rgba(34,197,94,.25)":"rgba(74,158,255,.12)",
              border:logCopied?"1px solid #22c55e":"1px solid rgba(74,158,255,.3)",
              borderRadius:4,color:logCopied?"#22c55e":"#4a9eff",
              fontSize:9,cursor:"pointer",fontFamily:"monospace",letterSpacing:.5,
              transition:"all .2s"}}>{logCopied?"✓ COPIED":"COPY"}</button>
            <button onClick={()=>{setEventLog([]);logRef.current=[];}}
              style={{padding:"2px 8px",background:"rgba(255,80,80,.08)",border:"1px solid rgba(255,80,80,.25)",
              borderRadius:4,color:"#ff7070",fontSize:9,cursor:"pointer",fontFamily:"monospace",letterSpacing:.5}}>CLR</button>
            <button onClick={()=>setShowLog(false)}
              style={{width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",
              background:"none",border:"1px solid rgba(255,255,255,.12)",
              borderRadius:4,color:"rgba(255,255,255,.35)",fontSize:11,cursor:"pointer",lineHeight:1}}>✕</button>
          </div>
        </div>
        {/* Entries — newest first */}
        <div style={{flex:1,overflowY:"auto",padding:"4px 0",display:"flex",flexDirection:"column-reverse"}}>
          {eventLog.length===0&&<div style={{color:"rgba(255,255,255,.2)",padding:"20px",textAlign:"center",
            fontFamily:"monospace",fontSize:10,letterSpacing:1}}>— no events —</div>}
          <div style={{display:"flex",flexDirection:"column"}}>
          {eventLog.map((e,i)=>{
            const tc={duel:"#60a5fa",war:"#fb923c",spoil:"#4ade80",warCard:"#f97316",mercy:"#f87171",collect:"#a78bfa",init:"#facc15",setting:"#e879f9"}[e.type]||"#94a3b8";
            const prefix={duel:"DUEL ",war:"WAR  ",spoil:"SPOIL",warCard:"WCARD",mercy:"MERCY",collect:"COLL ",init:"INIT ",setting:"SET  ",dw2spoil:"DW SP",dw2card:"DW CD",dev:"DEV  "}[e.type]||e.type.slice(0,5).toUpperCase().padEnd(5);
            return <div key={i} style={{padding:"3px 8px 3px 10px",borderBottom:"1px solid rgba(255,255,255,.03)",
              display:"grid",gridTemplateColumns:"52px 52px 1fr",gap:4,alignItems:"start",
              background:i===eventLog.length-1?"rgba(74,158,255,.04)":"transparent"}}>
              <span style={{color:"rgba(255,255,255,.2)",fontSize:8,fontFamily:"monospace",paddingTop:1}}>{new Date(e.t).toISOString().slice(14,23)}</span>
              <span style={{color:tc,fontSize:9,fontFamily:"monospace",fontWeight:"bold"}}>{prefix}</span>
              <span style={{color:"rgba(220,220,240,.8)",fontSize:9,fontFamily:"monospace",wordBreak:"break-all",lineHeight:1.4}}>{e.msg}</span>
            </div>;
          })}
          </div>
        </div>
      </div>}
      {/* ── Mode Change Confirm ─────────────────────────────────── */}
      {pendingMode!==null&&(
        <div style={{position:"absolute",inset:0,zIndex:300,background:"rgba(0,0,0,.85)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"linear-gradient(160deg,#1a0a00,#0f0a1a)",border:"2px solid rgba(218,165,32,.6)",borderRadius:16,padding:"22px 20px",width:"82%",maxWidth:300,textAlign:"center"}}>
            <div style={{fontSize:22,marginBottom:8}}>⚔️</div>
            <div style={{fontSize:13,color:"#DAA520",fontWeight:"bold",marginBottom:8,letterSpacing:1}}>Switch Game Mode?</div>
            <div style={{fontSize:10,color:"rgba(220,200,160,.75)",lineHeight:1.5,marginBottom:16}}>
              You have an active game in progress.<br/>
              Switching to <strong style={{color:"#cc88ff"}}>{pendingMode==="wars"?"🏁 War Race":"🂠 Classic"}</strong> will end the current game and start a new one.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{
                const newMode=pendingMode;
                setPendingMode(null);
                setShowConfig(false);
                // Go to gameover so player sees loss + stats, then switch mode on Battle Again
                pendingActionRef.current=()=>{setConfig(c=>({...c,gameMode:newMode}));setTimeout(startGame,50);};
                wrapBfState(s=>({...s,phase:"gameover"}));
                recordResult("cpu");
                setGWin("cpu");
                setGWinReason("forfeit");
              }} style={{flex:1,padding:"9px 4px",borderRadius:9,cursor:"pointer",fontSize:11,fontWeight:"bold",
                background:"linear-gradient(135deg,#8B2020,#cc3333)",border:"1px solid #cc333366",color:"#fff"}}>
                Yes, Switch
              </button>
              <button onClick={()=>setPendingMode(null)}
                style={{flex:1,padding:"9px 4px",borderRadius:9,cursor:"pointer",fontSize:11,fontWeight:"bold",
                background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.2)",color:"#DAA520"}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showConfig&&<ConfigMenu config={config} playerName={playerName} setPlayerName={setPlayerName} pWarWins={pWarWins} cWarWins={cWarWins} onUpdate={u=>{
        // Intercept game mode changes mid-game — ask for confirmation
        const ph=phaseRef.current;
        const isMidGame=started && ph!=="gameover" && ph!=="idle" && fights>0;
        if(u.gameMode!==undefined && u.gameMode!==config.gameMode && isMidGame){
          setPendingMode(u.gameMode);
          return; // don't apply yet — wait for confirm
        }
        setConfig(c=>({...c,...u}));
      }} onClose={()=>setShowConfig(false)} dev={dev} setDev={setDev}
        onSettingChange={(key,val)=>addLog("setting",`${key} → ${val}`)}/>}
    </div>
  );
}
