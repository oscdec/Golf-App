/* Practice sessions: the suggested week, and the session runner with its clocks.
   practice.js owns the #practice routes; it calls in here for the week card and the
   session (#practice/s/<id>), runner (#practice/run) and summary (#practice/sum/<runId>) screens.
   Data:
     rg.plan  {days:{slot:[sessionId]}}           my usual week (defaults to DEFAULT below)
     rg.week  {of:"YYYY-MM-DD" (Monday), days, done:{sessionId:"YYYY-MM-DD"}}   this week; resets each Monday
     rg.run   the session in progress: blocks, clock (acc ms + since timestamp while running)
     rg.practiceLog [{run,date,s,title,disc,min,done,games}]   minutes per finished block, for Insights later */
const Sessions=(()=>{
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));

const SESS={
  striking:{title:"Standard Ball Striking",min:60,disc:"Full swing",where:"Launch monitor",routine:true,notes:["driver","irons"]},
  bscombine:{title:"Ball-Striking Combine",min:30,disc:"Full swing",where:"Launch monitor",games:["bsc","skytrak"],notes:["driver","irons"]},
  wedgecombine:{title:"Wedge Combine",min:30,disc:"Wedges",where:"Launch monitor",games:["wedge"],notes:["wedges"]},
  wedge2:{title:"Wedge session",min:30,disc:"Wedges",where:"Launch monitor",games:["wedge",{k:"ladder",o:{set:"wedges"}}],notes:["wedges"]},
  techchip:{title:"Technical Chipping",min:30,disc:"Chipping",where:"Practice facility",routine:true,notes:["chipping"]},
  techputt:{title:"Technical Putting",min:30,disc:"Putting",where:"Practice facility",routine:true,notes:["putting"]},
  chipgame:{title:"Chipping game",min:30,disc:"Chipping",where:"Practice facility",games:["chipc","updown"],notes:["chipping"]},
  puttgame:{title:"Putting game",min:30,disc:"Putting",where:"Practice facility",games:["combine","lag"],notes:["putting"]},
};
const SLOTS=[["mon","Monday","Mon"],["tue","Tuesday","Tue"],["wed","Wednesday","Wed"],["thu","Thursday","Thu"],["fri","Friday","Fri"],["wknd","Weekend · Sat or Sun","Weekend"]];
const DEFAULT={mon:[],tue:["striking"],wed:["techchip","techputt"],thu:["bscombine","wedgecombine"],fri:["chipgame","puttgame"],wknd:["wedge2"]};
let P={go(){},render(){},launch(){},gameName:k=>k,gameSub:()=>"",gameRow:()=>""};
const init=h=>{P={...P,...h}};

/* ---------- the week ---------- */
const mondayOf=(d=new Date())=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return Store.iso(x)};
const slotOf=(d=new Date())=>{const w=d.getDay();return w===0||w===6?"wknd":["","mon","tue","wed","thu","fri"][w]};
const slotName=s=>(SLOTS.find(x=>x[0]===s)||[s,s,s])[1];
function tidy(days){const out={},seen=new Set();SLOTS.forEach(([s])=>{out[s]=(days&&days[s]||[]).filter(id=>SESS[id]&&!seen.has(id)&&seen.add(id))});
  Object.keys(SESS).forEach(id=>{if(!seen.has(id)){const home=Object.keys(DEFAULT).find(s=>DEFAULT[s].includes(id))||"wknd";out[home].push(id)}});return out}
const usual=()=>tidy((Store.get("plan",null)||{}).days||DEFAULT);
function week(){
  let w=Store.get("week",null);const of=mondayOf();
  if(!w||w.of!==of){w={of,days:usual(),done:{}};Store.set("week",w)}
  else w.days=tidy(w.days);
  w.done=w.done||{};return w;
}
const saveWeek=w=>Store.set("week",w);
const slotHas=(w,id)=>Object.keys(w.days).find(s=>w.days[s].includes(id));

function weekCard(){
  const w=week(),today=slotOf();let total=0,done=0;
  const rows=SLOTS.map(([slot,name])=>{
    const ids=w.days[slot]||[];total+=ids.length;
    const dayDone=ids.length>0&&ids.every(id=>w.done[id]);
    const list=ids.map(id=>{const s=SESS[id],dn=!!w.done[id];if(dn)done++;
      return `<a class="s-sess${dn?" done":""}" href="#practice/s/${id}"><span class="s-name">${esc(s.title)}<small>${s.min} min · ${esc(s.where)}</small></span><span class="s-mark">${dn?"✓ Done":"›"}</span></a>`}).join("");
    return `<div class="s-day${dayDone?" done":""}${slot===today?" today":""}">
      <div class="s-dayhd"><span class="s-dname">${esc(name)}${slot===today?`<small>Today</small>`:""}</span>${ids.length?(dayDone?`<span class="s-donepill">✓ Done</span>`:`<button class="ghost sm" data-act="startday" data-slot="${slot}">Start</button>`):""}</div>
      ${list||`<p class="hint s-empty">${slot==="mon"?"Play day":"Nothing planned"}</p>`}</div>`;
  }).join("");
  const differs=JSON.stringify(w.days)!==JSON.stringify(usual());
  const [y,m,d]=w.of.split("-").map(Number);
  return `<section class="s-week" aria-label="This week">
    <div class="s-weekhd"><div class="label">This week · suggested plan</div><span class="hint">Week of ${esc(new Date(y,m-1,d).toLocaleDateString(undefined,{month:"short",day:"numeric"}))} · ${done} of ${total} done</span></div>
    ${rows}
    <p class="hint">Start any day, in any order. Tap a session to start it alone, move it to another day or mark it done.</p>
    ${differs?`<div class="row"><button class="ghost sm" data-act="resetweek">Back to my usual week</button><button class="ghost sm" data-act="saveusual">Make this my usual week</button></div>`:""}
  </section>`;
}

const gamesOf=s=>(s.games||[]).map(g=>typeof g==="string"?{k:g,o:{}}:g);
function whatHtml(s){
  if(s.routine)return `<p class="hint">Routine to come: the steps for ${esc(s.title)} will show here once you add them. For now the session gives you the clock and your notes.</p>`;
  const g=gamesOf(s);
  return `<p class="hint">${g.length>1?"Play one of: ":"Game: "}${g.map(x=>esc(P.gameName(x.k,x.o))).join(" or ")}.</p>`;
}
function sessView(id){
  const s=SESS[id];if(!s)return null;const w=week(),slot=slotHas(w,id),dn=w.done[id];
  const mates=(w.days[slot]||[]).filter(x=>x!==id).map(x=>SESS[x].title);
  return `<a class="r-back" href="#practice">‹ Practice</a>
  <header><h1>${esc(s.title)}</h1><p class="sub">${s.min} minutes · ${esc(s.disc)} · ${esc(s.where)}</p></header>
  <section class="panel s-info">${whatHtml(s)}${dn?`<p class="s-donenote">✓ Done this week (${esc(Store.fmtDate(dn,{weekday:"short",month:"short",day:"numeric"}))})</p>`:""}</section>
  <button class="play r-wide" data-act="startone" data-s="${id}">Start this session</button>
  <section class="panel r-form"><div class="r-field"><div class="label">This week's day</div>
    <div class="r-opts">${SLOTS.map(([sl,,short])=>`<button class="r-opt" data-act="move" data-s="${id}" data-slot="${sl}" aria-pressed="${sl===slot}">${short}</button>`).join("")}</div>
    <p class="hint">${mates.length?`Shares ${esc(slotName(slot))} with ${esc(mates.join(" and "))}. Moving it splits it off; the other session stays put.`:"Move it to any day this week."}</p></div></section>
  <div class="row"><button class="ghost" data-act="markdone" data-s="${id}">${dn?"Mark not done":"Mark done (practiced without the app)"}</button></div>`;
}

/* ---------- the runner ---------- */
let run=Store.get("run",null);
const saveRun=()=>Store.set("run",run);
const running=()=>!!run;
const elapsed=()=>run?run.acc+(run.since?Date.now()-run.since:0):0;
const blk=()=>run.blocks[run.i];
const planned=()=>run.blocks.reduce((t,b)=>t+b.min,0)*60000;
const clock=ms=>{const t=Math.floor(Math.abs(ms)/1000),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;
  return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(s).padStart(2,"0")};

function start(ids,label){
  if(run){P.go("run");return}
  ids=ids.filter(id=>SESS[id]);if(!ids.length)return;
  run={id:Store.uid(),label,date:Store.today(),startedAt:Date.now(),acc:0,since:Date.now(),i:0,
    blocks:ids.map(id=>({s:id,min:SESS[id].min,at:0,games:[]}))};
  saveRun();P.go("run");
}
function addGame(gameId){if(!run)return;const b=blk();if(!b.games.includes(gameId)){b.games.push(gameId);saveRun()}}

function runBar(){
  if(!run)return "";const s=SESS[blk().s];
  return `<a class="s-runbar" href="#practice/run"><span class="s-dot${run.since?"":" paused"}"></span><span class="s-rname">${esc(s.title)}</span><b data-clock="block"></b><small data-clock="blocklbl">left</small></a>`;
}
function homeCard(){
  if(!run)return "";const s=SESS[blk().s];
  return `<section class="panel r-active"><span class="pill live">${run.since?"Session running":"Session paused"}</span>
    <div class="r-title">${esc(run.label)}<small>${esc(s.title)} · <span data-clock="block"></span> <span data-clock="blocklbl">left</span> · practiced <span data-clock="elapsed"></span></small></div>
    <div class="row"><a class="play" href="#practice/run">Open session</a></div></section>`;
}
function runView(){
  if(!run)return null;
  const b=blk(),s=SESS[b.s],last=run.i===run.blocks.length-1,paused=!run.since;
  const games=gamesOf(s).map(g=>`<button class="r-row p-game" data-act="launch" data-k="${g.k}" data-o="${esc(JSON.stringify(g.o||{}))}"><span class="r-name">${esc(P.gameName(g.k,g.o))}<small>${esc(P.gameSub(g.k))}</small></span><span class="p-go">›</span></button>`).join("");
  const played=b.games.map(P.gameRow).join("");
  const notes=(s.notes||[]).map(a=>{const t=typeof Notes!=="undefined"?Notes.get(a):"";
    return `<div class="s-note"><div class="label">${esc(typeof Notes!=="undefined"?Notes.name(a):a)}</div>${t?`<p>${esc(t)}</p>`:`<p class="hint">Nothing written yet.</p>`}</div>`}).join("");
  const steps=run.blocks.map((x,i)=>{const t=SESS[x.s],st=i<run.i?(x.done?"done":"skip"):i===run.i?"cur":"";
    return `<li class="${st}"><span>${esc(t.title)}</span><small>${i<run.i?(x.done?"✓ "+Math.round(x.used/60000)+" min":"Skipped"):x.min+" min"}</small></li>`}).join("");
  return `<a class="r-back" href="#practice">‹ Practice</a>
  <header><h1>${esc(run.label)}</h1><p class="sub">${run.blocks.length>1?`Block ${run.i+1} of ${run.blocks.length} · `:""}${esc(s.disc)} · ${esc(s.where)}</p></header>
  <section class="panel s-clock">
    <div class="s-big"><div class="label">${esc(s.title)} · <span data-clock="blocklbl">left</span></div><div class="clock" data-clock="block">0:00</div><div class="p-bar"><i data-clock="bar"></i></div></div>
    <div class="s-tot"><div><div class="label">Practiced</div><div class="v" data-clock="elapsed">0:00</div></div>
      <div><div class="label" data-clock="leftlbl">Left in session</div><div class="v" data-clock="left">0:00</div></div>
      <div><div class="label">Planned</div><div class="v">${clock(planned())}</div></div></div>
    ${paused?`<p class="s-paused">Paused. The clocks are stopped.</p>`:""}
  </section>
  <div class="row s-ctl"><button class="play" data-act="next">${last?"Finish session":"Finish block"}</button>
    <button class="ghost" data-act="pause">${paused?"Resume":"Pause"}</button>
    ${last?"":`<button class="ghost" data-act="skip">Skip block</button>`}
    <button class="ghost danger" data-act="endrun">End now</button></div>
  <section class="panel s-what">${s.routine?whatHtml(s):`<div class="label">${gamesOf(s).length>1?"Pick a game":"Game"}</div><div class="r-list">${games}</div>`}
    ${played?`<div class="label">Played this block</div><div class="r-list">${played}</div>`:""}</section>
  ${notes?`<section class="panel s-notes"><div class="s-noteshd"><div class="label">Your notes</div><a class="ghost sm" href="#notes">Edit in Notes</a></div>${notes}</section>`:""}
  ${run.blocks.length>1?`<section class="panel"><div class="label">Today's blocks</div><ol class="s-steps">${steps}</ol></section>`:""}`;
}

function paint(){
  if(!run)return;
  const b=blk(),el=elapsed(),be=el-b.at,bl=b.min*60000-be,tl=planned()-el;
  const set=(k,v)=>document.querySelectorAll(`[data-clock="${k}"]`).forEach(n=>{if(n.textContent!==v)n.textContent=v});
  set("elapsed",clock(el));set("block",clock(bl));set("blocklbl",bl>=0?"left":"over");
  set("left",clock(tl));set("leftlbl",tl>=0?"Left in session":"Over planned time");
  document.querySelectorAll('[data-clock="block"]').forEach(n=>n.classList.toggle("over",bl<0));
  document.querySelectorAll('[data-clock="bar"]').forEach(n=>{n.style.width=Math.min(100,be/(b.min*60000)*100)+"%";n.classList.toggle("over",bl<0)});
  if(bl<=0&&!b.buzzed&&run.since){b.buzzed=true;saveRun();try{if(navigator.userActivation?.hasBeenActive)navigator.vibrate?.([200,100,200])}catch(e){}}
}
setInterval(paint,1000);

function logRun(){
  const w=week(),log=Store.get("practiceLog",[]);
  run.blocks.forEach(b=>{if(b.used==null)return;const s=SESS[b.s];
    log.push({run:run.id,date:run.date,s:b.s,title:s.title,disc:s.disc,min:Math.round(b.used/60000),done:!!b.done,games:b.games});
    if(b.done)w.done[b.s]=Store.today()});
  Store.set("practiceLog",log);saveWeek(w);
  const id=run.id;run=null;Store.set("run",null);P.go("sum/"+id,true);
}
function closeBlock(done){const b=blk();b.used=elapsed()-b.at;b.done=done;
  if(run.i>=run.blocks.length-1){if(run.since){run.acc=elapsed();run.since=null}logRun();return}
  run.i++;blk().at=elapsed();saveRun();P.render();window.scrollTo(0,0);
}
function sumView(id){
  const rows=Store.get("practiceLog",[]).filter(x=>x.run===id);if(!rows.length)return null;
  const tot=rows.reduce((t,x)=>t+x.min,0);
  return `<header><h1>Session done</h1><p class="sub">${esc(Store.fmtDate(rows[0].date,{weekday:"long",month:"short",day:"numeric"}))}</p></header>
  <section class="panel r-sum"><div class="label">Practiced</div><div class="r-big">${tot} min</div>
    <ol class="s-steps">${rows.map(x=>`<li class="${x.done?"done":"skip"}"><span>${esc(x.title)}</span><small>${x.done?"✓ ":"Not done · "}${x.min} min</small></li>`).join("")}</ol>
    ${rows.some(x=>x.games.length)?`<div class="label">Games</div><div class="r-list">${rows.flatMap(x=>x.games).map(P.gameRow).join("")}</div>`:""}
    <p class="hint">Done sessions are highlighted on this week's plan.</p></section>
  <div class="row"><a class="play" href="#practice">Done</a><a class="ghost" href="#notes" style="display:inline-flex;align-items:center">Update my notes</a></div>`;
}

const act={
  startday(el){const w=week(),ids=w.days[el.dataset.slot]||[],todo=ids.filter(id=>!w.done[id]);start(todo.length?todo:ids,slotName(el.dataset.slot).split(" ·")[0]+" session")},
  startone(el){const s=SESS[el.dataset.s];start([el.dataset.s],s.title)},
  move(el){const w=week(),id=el.dataset.s;SLOTS.forEach(([s])=>{w.days[s]=w.days[s].filter(x=>x!==id)});w.days[el.dataset.slot].push(id);saveWeek(w);P.render()},
  markdone(el){const w=week(),id=el.dataset.s;if(w.done[id])delete w.done[id];else w.done[id]=Store.today();saveWeek(w);P.render()},
  resetweek(){const w=week();w.days=usual();saveWeek(w);P.render()},
  saveusual(){if(!confirm("Use this week's layout as your usual week from now on?"))return;Store.set("plan",{days:clone(week().days)});P.render()},
  pause(){if(!run)return;if(run.since){run.acc=elapsed();run.since=null}else run.since=Date.now();saveRun();P.render()},
  next(){if(run)closeBlock(true)},
  skip(){if(run&&confirm(`Skip ${SESS[blk().s].title}? It stays open on this week's plan.`))closeBlock(false)},
  endrun(){if(!run||!confirm("End the session now?"))return;
    const b=blk(),mins=Math.round((elapsed()-b.at)/60000);
    const done=mins>=1&&confirm(`Count ${SESS[b.s].title} as done this week? (${mins} min practiced)`);
    run.blocks=run.blocks.slice(0,run.i+1);closeBlock(done)},
  launch(el){let o={};try{o=JSON.parse(el.dataset.o||"{}")}catch(e){}P.launch(el.dataset.k,o)},
};
return {init,weekCard,sessView,runView,sumView,runBar,homeCard,running,addGame,act,paint};
})();
