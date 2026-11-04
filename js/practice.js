/* Practice tab: Games (with Beat Your Average) and, later, Routines.
   Each game is defined by its setup and a log of inputs; everything shown (progress, score, done)
   is worked out by replaying the log, so Undo is just removing the last entry.
   Screens are sub-routes of #practice (e.g. #practice/play). One game can be in progress at a time. */
(()=>{
const root=document.getElementById("practiceRoot");if(!root)return;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sum=a=>a.reduce((s,x)=>s+x,0);
const sgn=v=>v>0?"+"+v:v<0?"−"+(-v):"0";
const toPar=v=>v===0?"E":v>0?"+"+v:"−"+(-v);

let games=Store.get("games",[]);
const save=()=>Store.set("games",games);
const AVG_N=12;

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const CLUBS=["PW","9i","8i","7i","6i","5i","4i","5w","Mini driver"];
const LADDERS={wedges:[40,50,60,70,80,90,100],irons:[120,135,150,165,175,185,195]};
const COMBINE=[3,12,4,11,5,10,6,9,7,8];
const BENCH=[["Scratch",0,29.79],["5 hcp",5,31.03],["10 hcp",10,31.95],["15 hcp",15,32.91],["20 hcp",20,33.88]];

/* ---------- game definitions ---------- */
const G={
  safe:{name:"Safe Side",kind:"Full swing",better:"high",
    blurb:"18 shots, every club as a draw and a fade, in random order. Pick a flag and a safe side; the other side of the flag is forbidden.",
    rules:["Pick a flag and choose which side is your safe miss. A line straight through the flag makes the other side forbidden.","The app picks each shot: club and shape, 9 clubs from PW to mini driver, each once as a draw and once as a fade.","Sweet spot, within about 5 yards on the safe side: +3. Safe miss, further out on the safe side: +1. Forbidden side, even by inches: −4."],
    variant:()=>"safe",label:()=>"",
    start:()=>({order:shuffle(CLUBS.flatMap(c=>[[c,"Draw"],[c,"Fade"]]))}),
    replay:(s,log)=>({n:log.length,total:sum(log),done:log.length>=18,result:sum(log)}),
    fmt:v=>sgn(v)+" pts"},
  lag:{name:"Lag Putt, Two Putt",kind:"Putting",better:"low",
    blurb:"Pass three 6-hole loops in 12 putts or fewer each. Fewer attempts is better; 3 is perfect.",
    rules:["From one spot, putt ball 1 to hole 1, ball 2 to hole 2, ball 3 to hole 3 (first putts 25–45 feet).","Hole out each, then putt it to hole 4. Hole out all three at hole 4. That's one loop of 6.","12 putts or fewer passes the loop. 13 or more: replay that same loop, not from Loop 1.","Out of time? End the game as Failed. Failed games don't count toward your average."],
    variant:()=>"lag",label:()=>"",
    start:()=>({}),
    replay:(s,log)=>{let loop=1;log.forEach(v=>{if(v<=12)loop++});const passed=Math.min(3,loop-1);
      return {loop:Math.min(loop,3),passed,attempts:log.length,done:passed>=3,result:log.length}},
    fmt:v=>v+" attempt"+(v===1?"":"s")},
  combine:{name:"Putting Combine",kind:"Putting",better:"low",
    blurb:"20 short putts from 3 to 12 feet, holed out. Compare your total to scratch through 20 handicaps.",
    rules:["Two putts from each distance, 3 to 12 feet: the app calls out the order (3, 12, 4, 11, 5, 10, 6, 9, 7, 8, then again).","Hole out every putt and enter how many it took.","Switch holes and putting direction every time. Step off distances (calibrate your steps) or use a tape."],
    variant:()=>"combine",label:()=>"",
    start:()=>({seq:[...COMBINE,...COMBINE]}),
    replay:(s,log)=>({n:log.length,total:sum(log),done:log.length>=20,result:sum(log)}),
    fmt:v=>v+" putts"},
  ladder:{name:"Distance Ladder",kind:"Wedges & irons",better:"low",
    blurb:"Climb 7 targets, one hit at a time. Fewer balls is better.",
    rules:["Wedges: 40 to 100 yards. Irons: 120 to 195 yards. 7 rungs each.","Hit the current target to climb a rung.","Normal: a miss drops you one rung. Hard: a miss sends you back to the start.","Wedges and irons, normal and hard, are tracked separately."],
    opts:{set:[["wedges","Wedges"],["irons","Irons"]],mode:[["normal","Normal"],["hard","Hard"]]},
    variant:s=>`ladder-${s.set}-${s.mode}`,label:s=>`${s.set==="irons"?"Irons":"Wedges"} · ${s.mode==="hard"?"Hard":"Normal"}`,
    start:o=>({set:o.set||"wedges",mode:o.mode||"normal"}),
    replay:(s,log)=>{const L=LADDERS[s.set];let r=0;log.forEach(h=>{if(h)r++;else r=s.mode==="hard"?0:Math.max(0,r-1)});
      return {rung:r,balls:log.length,done:r>=L.length,result:log.length,L}},
    fmt:v=>v+" ball"+(v===1?"":"s")},
  fairway:{name:"Fairway Finder",kind:"Driver",better:"high",
    blurb:"14 drives at a 30-yard fairway. The last 3 count double.",
    rules:["Set a fairway about 30 yards wide between two markers, plus a wider penalty line.","Fairway: +1. Past the penalty line: −1. Anything else: 0.","Drives 12, 13 and 14 count double: +2 or −2."],
    variant:()=>"fairway",label:()=>"",
    start:()=>({}),
    replay:(s,log)=>{const pts=log.map((v,i)=>v*(i>=11?2:1));return {n:log.length,total:sum(pts),done:log.length>=14,result:sum(pts)}},
    fmt:v=>sgn(v)+" pts"},
  range:{name:"Range Round",kind:"Full swing",better:"low",
    blurb:"Play a course you know in your head: a tee shot and an approach on every hole.",
    rules:["Pick the tee shot and approach club for each hole, as if playing a course you know.","Both shots hit: birdie. One hit: par. Neither: bogey. Tee shot past the penalty line: double bogey, whatever the approach.","Full routine on every shot, and never the same club twice in a row.","9- and 18-hole rounds are tracked separately."],
    opts:{holes:[["9","9 holes"],["18","18 holes"]]},
    variant:s=>`range-${s.holes}`,label:s=>`${s.holes} holes`,
    start:o=>({holes:+(o.holes||18)}),
    replay:(s,log)=>{const sc=log.map(h=>h.t==="p"?2:(h.t==="h")+(h.a==="h")===2?-1:(h.t==="h")+(h.a==="h")===1?0:1);
      return {n:log.length,scores:sc,total:sum(sc),done:log.length>=s.holes,result:sum(sc)}},
    fmt:v=>toPar(v)},
  must:{name:"Must-Make Exit",kind:"Full swing",better:"low",
    blurb:"You can't leave until you hit X in a row to one target, 125–160 yards. Fewer balls is better.",
    rules:["Pick how many in a row and a target from 125 to 160 yards. Use whatever club fits.","A miss resets the streak to zero.","Each \"in a row\" number is tracked separately. Good as the last drill of a session."],
    opts:{x:[["2","2 in a row"],["3","3 in a row"],["4","4 in a row"],["5","5 in a row"]],dist:"range"},
    variant:s=>`must-${s.x}`,label:s=>`${s.x} in a row`+(s.dist?` · ${s.dist} yd`:""),
    start:o=>({x:+(o.x||3),dist:+(o.dist||150)}),
    replay:(s,log)=>{let st=0;log.forEach(h=>{st=h?st+1:0});return {streak:st,balls:log.length,done:st>=s.x,result:log.length}},
    fmt:v=>v+" ball"+(v===1?"":"s")},
};
const ORDER=["safe","fairway","range","ladder","must","combine","lag"];

/* ---------- stats ---------- */
const active=()=>games.find(g=>g.status==="active");
const finished=(variant,before)=>games.filter(g=>g.status==="done"&&g.variant===variant&&(!before||g.finishedAt<before)).sort((a,b)=>a.finishedAt-b.finishedAt);
function stat(key,variant,before){
  const all=finished(variant,before),last=all.slice(-AVG_N);if(!all.length)return null;
  const vals=all.map(g=>g.result),best=G[key].better==="high"?Math.max(...vals):Math.min(...vals);
  return {avg:sum(last.map(g=>g.result))/last.length,n:last.length,total:all.length,best};
}
const fmtAvg=(key,v)=>{const r=Math.round(v*10)/10;return key==="range"?toPar(r):(key==="safe"||key==="fairway")?sgn(r):String(r)};
const beat=(key,v,avg)=>G[key].better==="high"?v>avg:v<avg;

/* ---------- routing ---------- */
const route=()=>{const h=location.hash.slice(1);return h==="practice"||h.startsWith("practice/")?h.split("/").slice(1):null};
const go=(p,replace)=>{const h="#practice"+(p?"/"+p:"");if(replace)location.replace(h);else location.hash=h};
let opts={},pendingTee=null;

function render(){
  const p=route();if(!p)return;const [a,b]=p;let html;
  switch(a){
    case undefined:case "":html=home();break;
    case "g":if(!G[b]){go("",true);return}html=intro(b);break;
    case "play":{const g=active();if(!g){go("",true);return}html=play(g);break}
    case "res":{const g=games.find(x=>x.id===b&&x.status!=="active");if(!g){go("",true);return}html=result(g,p[2]==="new");break}
    default:go("",true);return;
  }
  root.innerHTML=html;
}
const back=(href,label)=>`<a class="r-back" href="#practice${href?"/"+href:""}">‹ ${esc(label)}</a>`;

/* ---------- home ---------- */
function home(){
  const g=active();
  const cards=ORDER.map(k=>{const d=G[k],mine=games.filter(x=>x.game===k&&x.status!=="active").sort((a,b)=>b.finishedAt-a.finishedAt);
    const last=mine[0];
    const sub=last?`Last: ${last.status==="failed"?"Failed":d.fmt(last.result)}${d.label(last.setup)?" · "+d.label(last.setup):""}`:"Not played yet";
    return `<a class="r-row p-game" href="#practice/g/${k}"><span class="r-name">${esc(d.name)}<small>${esc(d.kind)} · ${esc(sub)}</small></span><span class="p-go">›</span></a>`}).join("");
  return `<header><h1>Practice</h1></header>
  ${g?`<section class="panel r-active"><span class="pill live">In progress</span><div class="r-title">${esc(G[g.game].name)}<small>${esc(G[g.game].label(g.setup))}</small></div>
    <div class="row"><button class="play" data-act="resume">Resume</button><button class="ghost" data-act="quit">Discard game</button></div></section>`:""}
  <section class="r-list"><div class="label">Games</div>${cards}</section>
  <section class="panel soon"><span class="pill">Coming next</span><h2>Routines</h2>
    <ul><li>Your saved practice routines, starting with "Standard ball striking"</li><li>Build each day's plan with minutes per section, timed as you go</li><li>Practice time by discipline over any date range</li><li>Notes and feels that pop up at your next session</li></ul></section>`;
}

/* ---------- game intro: rules, setup, average, history ---------- */
function optRow(name,list,cur){
  return `<div class="r-opts">${list.map(([v,l])=>`<button class="r-opt" data-act="opt" data-k="${name}" data-v="${v}" aria-pressed="${String(cur)===v}">${esc(l)}</button>`).join("")}</div>`;
}
function intro(k){
  const d=G[k];
  if(opts._k!==k)opts={_k:k,...(d.opts?Object.fromEntries(Object.entries(d.opts).map(([n,l])=>[n,n==="dist"?150:(n==="holes"?"18":n==="x"?"3":l[0][0])])):{})};
  const setup=d.start(opts),variant=d.variant(setup),st=stat(k,variant);
  let opt="";
  if(d.opts){
    for(const [n,l] of Object.entries(d.opts)){
      if(l==="range")opt+=`<div class="r-field"><div class="label">Target distance</div><div class="stepper p-step"><button data-act="dist" data-v="-5" aria-label="Shorter">−</button><output>${opts.dist} yd</output><button data-act="dist" data-v="5" aria-label="Longer">+</button></div></div>`;
      else opt+=`<div class="r-field">${optRow(n,l,opts[n])}</div>`;
    }
  }
  const hist=games.filter(x=>x.game===k&&x.status!=="active").sort((a,b)=>b.finishedAt-a.finishedAt).slice(0,15)
    .map(x=>`<button class="r-row" data-act="open" data-id="${x.id}"><span class="r-date">${esc(Store.fmtDate(x.date,{month:"short",day:"numeric"}))}<small>${esc(x.date.slice(0,4))}</small></span>
      <span class="r-name">${esc(d.label(x.setup)||d.name)}</span><span class="r-score p-res">${x.status==="failed"?"Failed":esc(d.fmt(x.result))}</span></button>`).join("");
  const busy=active();
  return `${back("","Practice")}<header><h1>${esc(d.name)}</h1><p class="sub">${esc(d.blurb)}</p></header>
  ${opt?`<section class="panel r-form">${opt}</section>`:""}
  <section class="panel p-avg">${st?`<div class="stats p-stats">
      <div class="stat"><div class="label">Average</div><div class="v">${fmtAvg(k,st.avg)}</div><div class="hint">last ${st.n}</div></div>
      <div class="stat"><div class="label">Best</div><div class="v">${esc(d.fmt(st.best))}</div></div>
      <div class="stat"><div class="label">Played</div><div class="v">${st.total}</div></div></div>
      <p class="hint">Beat ${fmtAvg(k,st.avg)} to win today.</p>`
    :`<p class="hint">No finished games yet${d.label(setup)?" for "+esc(d.label(setup)):""}. Your first one sets the average to beat.</p>`}</section>
  ${busy?`<p class="hint r-center">Finish or discard the game in progress (${esc(G[busy.game].name)}) first.</p>`:`<button class="play r-wide" data-act="begin" data-k="${k}">Start</button>`}
  <details class="panel p-rules"><summary class="label">How it works</summary><ul>${d.rules.map(r=>`<li>${esc(r)}</li>`).join("")}</ul></details>
  ${hist?`<section class="r-list"><div class="label">History</div>${hist}</section>`:""}`;
}

/* ---------- play ---------- */
function bar(n,total){return `<div class="p-bar"><i style="width:${Math.round(n/total*100)}%"></i></div>`}
function play(g){
  const d=G[g.game],s=d.replay(g.setup,g.log),k=g.game;let body="";
  const undo=g.log.length||pendingTee?`<button class="ghost" data-act="undo">Undo</button>`:"<span></span>";
  if(k==="safe"){const [club,shape]=g.setup.order[s.n]||["",""];
    body=`<div class="p-head"><div class="label">Shot ${s.n+1} of 18 · ${sgn(s.total)} pts</div>${bar(s.n,18)}</div>
    <div class="p-call">${esc(club)}<span class="${shape==="Draw"?"p-draw":"p-fade"}">${shape}</span></div>
    <div class="p-btns">${[[3,"Sweet spot","good"],[1,"Safe miss",""],[-4,"Forbidden side","bad"]].map(([v,l,c])=>`<button class="p-btn ${c}" data-act="log" data-v="${v}"><b>${sgn(v)}</b>${l}</button>`).join("")}</div>`;
  }else if(k==="lag"){
    body=`<div class="p-head"><div class="label">Loop ${s.loop} of 3 · attempt ${s.attempts+1}</div>${bar(s.passed,3)}</div>
    <div class="p-call">Loop ${s.loop}<span>${s.passed} passed</span></div>
    <div class="r-field"><div class="label">Total putts for this loop</div>${nums("log",[6,7,8,9,10,11,12,13,14,15,16,17,18],null,19)}<p class="hint">12 or fewer passes. 13 or more replays Loop ${s.loop}.</p></div>
    ${g.log.length?`<div class="p-log">${g.log.map(v=>`<span class="${v<=12?"ok":"no"}">${v}</span>`).join("")}</div>`:""}`;
  }else if(k==="combine"){const ft=g.setup.seq[s.n];
    body=`<div class="p-head"><div class="label">Putt ${s.n+1} of 20 · ${s.total} putts so far</div>${bar(s.n,20)}</div>
    <div class="p-call">${ft} ft<span>New hole, new direction</span></div>
    <div class="r-field"><div class="label">Putts to hole out</div>${nums("log",[1,2,3,4],null,5)}</div>`;
  }else if(k==="ladder"){const L=s.L;
    body=`<div class="p-head"><div class="label">${esc(d.label(g.setup))} · ${s.balls} ball${s.balls===1?"":"s"}</div></div>
    <div class="p-rungs">${L.map((y,i)=>`<span class="${i<s.rung?"ok":i===s.rung?"cur":""}">${y}</span>`).join("")}</div>
    <div class="p-call">${L[s.rung]} yd<span>Rung ${s.rung+1} of ${L.length}</span></div>
    <div class="p-btns two"><button class="p-btn good" data-act="log" data-v="1"><b>Hit</b>Climb a rung</button><button class="p-btn bad" data-act="log" data-v="0"><b>Miss</b>${g.setup.mode==="hard"?"Back to the start":"Down one rung"}</button></div>`;
  }else if(k==="fairway"){const dbl=s.n>=11;
    body=`<div class="p-head"><div class="label">Drive ${s.n+1} of 14 · ${sgn(s.total)} pts</div>${bar(s.n,14)}</div>
    <div class="p-call">Drive ${s.n+1}${dbl?`<span class="p-dbl">Counts double</span>`:"<span>&nbsp;</span>"}</div>
    <div class="p-btns">${[[1,"Fairway","good"],[0,"Neither",""],[-1,"Penalty","bad"]].map(([v,l,c])=>`<button class="p-btn ${c}" data-act="log" data-v="${v}"><b>${sgn(v*(dbl?2:1))}</b>${l}</button>`).join("")}</div>`;
  }else if(k==="range"){
    body=`<div class="p-head"><div class="label">Hole ${s.n+1} of ${g.setup.holes} · ${toPar(s.total)}</div>${bar(s.n,g.setup.holes)}</div>
    <div class="p-call">Hole ${s.n+1}<span>${pendingTee?"Approach":"Tee shot"}</span></div>
    ${pendingTee?`<div class="p-btns two"><button class="p-btn good" data-act="appr" data-v="h"><b>Hit</b>Green</button><button class="p-btn bad" data-act="appr" data-v="m"><b>Miss</b>&nbsp;</button></div>
      <p class="hint r-center">Tee shot: ${pendingTee==="h"?"hit":"miss"}</p>`
    :`<div class="p-btns"><button class="p-btn good" data-act="tee" data-v="h"><b>Hit</b>Fairway</button><button class="p-btn" data-act="tee" data-v="m"><b>Miss</b>&nbsp;</button><button class="p-btn bad" data-act="tee" data-v="p"><b>Penalty</b>Double bogey</button></div>`}
    ${s.n?`<div class="p-log">${s.scores.map(v=>`<span class="${v<0?"ok":v>1?"no":""}">${toPar(v)}</span>`).join("")}</div>`:""}`;
  }else if(k==="must"){
    body=`<div class="p-head"><div class="label">${g.setup.x} in a row at ${g.setup.dist} yd · ${s.balls} ball${s.balls===1?"":"s"}</div></div>
    <div class="p-streak">${Array.from({length:g.setup.x},(_,i)=>`<span class="${i<s.streak?"ok":""}"></span>`).join("")}</div>
    <div class="p-call">${s.streak} of ${g.setup.x}<span>in a row</span></div>
    <div class="p-btns two"><button class="p-btn good" data-act="log" data-v="1"><b>Hit</b>&nbsp;</button><button class="p-btn bad" data-act="log" data-v="0"><b>Miss</b>Streak resets</button></div>`;
  }
  const st=stat(k,g.variant);
  return `${back("","Practice")}<header><h1>${esc(d.name)}</h1>${d.label(g.setup)?`<p class="sub">${esc(d.label(g.setup))}${st?" · average to beat "+fmtAvg(k,st.avg):""}</p>`:st?`<p class="sub">Average to beat ${fmtAvg(k,st.avg)}</p>`:""}</header>
  <section class="panel p-play">${body}</section>
  <div class="row p-foot">${undo}${k==="lag"?`<button class="ghost danger" data-act="fail">End as failed</button>`:""}<button class="ghost" data-act="quit">Discard</button></div>`;
}
function nums(act,vals,cur,more){
  let s=vals.map(v=>`<button class="r-num" data-act="${act}" data-v="${v}">${v}</button>`).join("");
  if(more)s+=`<button class="r-num" data-act="${act}more" data-min="${more}">${more}+</button>`;
  return `<div class="r-nums">${s}</div>`;
}

/* ---------- result ---------- */
function result(g,fresh){
  const d=G[g.game],k=g.game,s=d.replay(g.setup,g.log),prev=stat(k,g.variant,g.finishedAt);
  let verdict="";
  if(g.status==="failed")verdict=`<div class="p-verdict miss">Failed · ${s.passed} of 3 loops passed in ${s.attempts} attempt${s.attempts===1?"":"s"}</div><p class="hint">Failed games don't count toward your average.</p>`;
  else if(!prev)verdict=`<div class="p-verdict">First one in the books. This is the average to beat next time.</div>`;
  else{const win=beat(k,g.result,prev.avg),pb=G[k].better==="high"?g.result>prev.best:g.result<prev.best;
    verdict=`<div class="p-verdict ${win?"win":"miss"}">${pb?"New personal best! ":""}${win?"You beat your average":"Missed your average"} of ${fmtAvg(k,prev.avg)}.</div>`}
  let extra="";
  if(k==="combine"){
    const idx=window.Rounds&&Rounds.index?Rounds.index():null;
    let lo=null,hi=null;if(idx!=null){BENCH.forEach(b=>{if(b[1]<=idx)lo=b});hi=BENCH.find(b=>b[1]>idx)||null}
    extra=`<section class="panel"><div class="label">Strokes gained vs benchmarks</div><table class="p-bench">
      ${BENCH.map(b=>{const sg=Math.round((b[2]-g.result)*100)/100,mark=b===lo||b===hi;
        return `<tr class="${mark?"mark":""}"><th>${b[0]}</th><td>${b[2].toFixed(2)}</td><td class="${sg>=0?"good":"bad"}">${sg>=0?"+":"−"}${Math.abs(sg).toFixed(2)}</td></tr>`}).join("")}</table>
      <p class="hint">${idx==null?"Add rounds or past GHIN scores so the app can highlight the benchmarks around your index.":`Highlighted: the benchmarks just ${lo&&hi?"below and above":lo?"below":"above"} your index of ${idx.toFixed(1)}. ${lo?`vs ${lo[0]}: ${(lo[2]-g.result)>=0?"gained":"lost"} ${Math.abs(lo[2]-g.result).toFixed(2)}. `:""}${hi?`vs ${hi[0]}: ${(hi[2]-g.result)>=0?"gained":"lost"} ${Math.abs(hi[2]-g.result).toFixed(2)}.`:""}`}</p></section>`;
  }else if(k==="safe"){
    extra=`<section class="panel"><div class="label">Shots</div><div class="p-shots">${g.setup.order.map(([c,sh],i)=>{const v=g.log[i];
      return `<span class="${v===3?"ok":v<0?"no":""}"><b>${sgn(v)}</b>${esc(c)} ${sh==="Draw"?"D":"F"}</span>`}).join("")}</div></section>`;
  }else if(k==="lag"){
    extra=`<section class="panel"><div class="label">Loop attempts</div><div class="p-log">${g.log.map(v=>`<span class="${v<=12?"ok":"no"}">${v}</span>`).join("")}</div></section>`;
  }else if(k==="range"){
    extra=`<section class="panel"><div class="label">Holes</div><div class="p-log">${s.scores.map(v=>`<span class="${v<0?"ok":v>1?"no":""}">${toPar(v)}</span>`).join("")}</div></section>`;
  }
  const now=stat(k,g.variant);
  return `${back("g/"+k,d.name)}
  <section class="panel r-sum"><div class="label">${esc(Store.fmtDate(g.date,{weekday:"short",month:"short",day:"numeric",year:"numeric"}))}${d.label(g.setup)?" · "+esc(d.label(g.setup)):""}</div>
    <div class="r-scoreline"><span class="r-big">${g.status==="failed"?"Failed":esc(d.fmt(g.result))}</span></div>${verdict}
    ${now?`<p class="hint">Average now ${fmtAvg(k,now.avg)} over your last ${now.n} · best ${esc(d.fmt(now.best))}</p>`:""}</section>
  ${extra}
  <div class="row r-actions">${fresh?`<a class="play" href="#practice">Done</a>`:"<span></span>"}<button class="ghost danger" data-act="delgame" data-id="${g.id}">Delete</button></div>`;
}

/* ---------- actions ---------- */
function finishIf(g){
  const s=G[g.game].replay(g.setup,g.log);
  if(s.done){g.status="done";g.result=s.result;g.finishedAt=Date.now();save();go("res/"+g.id+"/new",true);return true}
  save();return false;
}
const act={
  resume(){go("play")},
  quit(){if(confirm("Discard this game? Nothing from it will be saved.")){games=games.filter(g=>g.status!=="active");pendingTee=null;save();go("",true);render()}},
  open(el){go("res/"+el.dataset.id)},
  opt(el){opts[el.dataset.k]=el.dataset.v;render()},
  dist(el){opts.dist=Math.max(125,Math.min(160,(+opts.dist||150)+ +el.dataset.v));render()},
  begin(el){
    if(active()){go("play");return}
    const k=el.dataset.k,d=G[k],setup=d.start(opts);
    const g={id:Store.uid(),game:k,variant:d.variant(setup),setup,log:[],status:"active",date:Store.today(),startedAt:Date.now()};
    games.push(g);save();pendingTee=null;go("play",true);
  },
  log(el){const g=active();if(!g)return;g.log.push(+el.dataset.v);if(!finishIf(g))render()},
  logmore(el){const g=active();if(!g)return;const min=+el.dataset.min,v=parseInt(prompt("How many?",""),10);if(v>=min&&v<=60){g.log.push(v);if(!finishIf(g))render()}},
  tee(el){const g=active();if(!g)return;const v=el.dataset.v;if(v==="p"){g.log.push({t:"p",a:null});pendingTee=null;if(!finishIf(g))render()}else{pendingTee=v;render()}},
  appr(el){const g=active();if(!g||!pendingTee)return;g.log.push({t:pendingTee,a:el.dataset.v});pendingTee=null;if(!finishIf(g))render()},
  undo(){const g=active();if(!g)return;if(pendingTee){pendingTee=null}else g.log.pop();save();render()},
  fail(){const g=active();if(!g)return;if(!confirm("End this game as failed? It's saved but left out of your average."))return;
    const s=G.lag.replay(g.setup,g.log);g.status="failed";g.result=null;g.passed=s.passed;g.finishedAt=Date.now();save();go("res/"+g.id+"/new",true)},
  delgame(el){if(confirm("Delete this game for good?")){const g=games.find(x=>x.id===el.dataset.id);games=games.filter(x=>x!==g);save();go(g?"g/"+g.game:"",true)}},
};
root.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||!root.contains(el))return;const f=act[el.dataset.act];if(f){e.preventDefault();f(el)}});
window.addEventListener("hashchange",render);
render();
})();
