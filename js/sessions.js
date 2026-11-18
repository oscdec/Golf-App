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
  striking:{title:"Technical Ball Striking",min:60,disc:"Full swing",where:"Launch monitor",routines:["center","face"],notes:["driver","irons"]},
  bscombine:{title:"Ball-Striking Combine",min:30,disc:"Full swing",where:"Launch monitor",games:["bsc","skytrak"],notes:["driver","irons"]},
  wedgecombine:{title:"Wedge Combine",min:30,disc:"Wedges",where:"Launch monitor",games:["wedge"],notes:["wedges"]},
  wedge2:{title:"Wedge session",min:30,disc:"Wedges",where:"Launch monitor",games:["wedge",{k:"ladder",o:{set:"wedges"}}],notes:["wedges"]},
  techchip:{title:"Technical Chipping",min:30,disc:"Chipping",where:"Practice facility",routine:true,notes:["chipping"]},
  techputt:{title:"Technical Putting",min:30,disc:"Putting",where:"Practice facility",routine:true,notes:["putting"]},
  chipgame:{title:"Chipping game",min:30,disc:"Chipping",where:"Practice facility",games:["chipc","updown"],notes:["chipping"]},
  puttgame:{title:"Putting game",min:30,disc:"Putting",where:"Practice facility",games:["combine","lag"],notes:["putting"]},
};
/* Routines: steps with their own minutes. A step can have drills (items) and a tally (row label, out of N),
   with an optional pass mark. Center Strike / Startline is from Dane Cvetkovic's "one-hour range routine" Short;
   the warm-up is our addition (the video's blocks add up to 50 minutes). */
const ROUTINES={
  center:{title:"Center Strike / Startline",steps:[
    {name:"Warm-up",min:10,note:"Not in the video, added to fill the hour: easy swings, short clubs up to the 5-iron. Change or drop it."},
    {name:"Technique",min:20,items:["10× Turn in the barrel","10× Width in transition","10× Head glued to wall"]},
    {name:"Strike",min:10,prompt:"How many can you hit through the gate?",tip:"Gate: two tees (or similar) just outside the toe and heel of the club at address.",tally:[["9-iron",5],["7-iron",5],["5-iron",5]]},
    {name:"Startline",min:10,prompt:"Can you start the ball on line?",tally:[["Draw",5],["Straight",5],["Fade",5]]},
    {name:"Performance",min:10,prompt:"Visualize the first hole. Hit at least 5 of 10 in the fairway to pass.",tally:[["Fairways",10]],pass:5},
  ]},
  /* From Dane Cvetkovic's "full range session if you want to break 80" Short. Its blocks add up to 63 minutes. */
  face:{title:"Face Control / Tempo",steps:[
    {name:"Warm-up",min:3,items:["Loosen up","Feel the club"]},
    {name:"Technique",min:20,items:["5× Stable neck","5× Split grip","10× Center strike"]},
    {name:"Startline & Tempo",min:20,prompt:"33% – 66% – 100%",tip:"Hit shots at about a third, two-thirds and full speed, starting each one on your line."},
    {name:"Driver challenge",min:20,prompt:"10 shots: hit 7 of 10 inside your zone (50 yards wide) to finish.",tally:[["Inside the zone",10]],pass:7},
  ]},
};
const rTitle=id=>ROUTINES[id]?ROUTINES[id].title:"";
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
      return `<a class="s-sess${dn?" done":""}" href="#practice/s/${id}"><span class="s-name">${esc(s.title)}<small>${s.min} min · ${esc(s.where)}${s.routines?" · "+s.routines.map(rTitle).join(" or "):""}</small></span><span class="s-mark">${dn?"✓ Done":"›"}</span></a>`}).join("");
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
function routineOutline(id){const r=ROUTINES[id];if(!r)return "";
  return r.steps?`<ol class="s-outline">${r.steps.map(st=>`<li><b>${esc(st.name)}</b> · ${st.min} min${st.items?": "+esc(st.items.join(", ")):st.prompt?": "+esc(st.prompt):""}</li>`).join("")}</ol>`:`<p class="hint">Steps to come.</p>`}
function whatHtml(s){
  if(s.routines)return `<p class="hint">Pick the routine when you start: ${s.routines.map(r=>esc(rTitle(r))).join(" or ")}.</p>${s.routines.map(r=>`<div class="label">${esc(rTitle(r))}</div>${routineOutline(r)}`).join("")}`;
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
  ${s.routines?routinePanel(s,b):`<section class="panel s-what">${s.routine?whatHtml(s):`<div class="label">${gamesOf(s).length>1?"Pick a game":"Game"}</div><div class="r-list">${games}</div>`}
    ${played?`<div class="label">Played this block</div><div class="r-list">${played}</div>`:""}</section>`}
  ${notes?`<section class="panel s-notes"><div class="s-noteshd"><div class="label">Your notes</div><a class="ghost sm" href="#notes">Edit in Notes</a></div>${notes}</section>`:""}
  ${run.blocks.length>1?`<section class="panel"><div class="label">Today's blocks</div><ol class="s-steps">${steps}</ol></section>`:""}`;
}

/* Routine inside a block: pick it, then step through with a countdown per step and tap counters. */
const tallyOf=(b,i,j)=>((b.tally||{})[i]||{})[j]||0;
const stepTotal=(b,i,st)=>(st.tally||[]).reduce((t,_,j)=>t+tallyOf(b,i,j),0);
function routinePanel(s,b){
  if(b.r==null)return `<section class="panel s-what"><div class="label">Which routine today?</div>
    <div class="r-list">${s.routines.map(id=>`<button class="r-row p-game" data-act="pickr" data-r="${id}"><span class="r-name">${esc(rTitle(id))}<small>${ROUTINES[id].steps?ROUTINES[id].steps.map(x=>x.name+" "+x.min).join(" · "):"Steps to come"}</small></span><span class="p-go">›</span></button>`).join("")}</div></section>`;
  const r=ROUTINES[b.r],touched=Object.keys(b.tally||{}).length>0;
  const change=!touched&&!(b.st>0)?`<button class="ghost sm" data-act="pickr" data-r="">Change routine</button>`:"";
  if(!r.steps)return `<section class="panel s-what"><div class="s-rhd"><div class="label">${esc(r.title)}</div>${change}</div><p class="hint">Steps for this routine are still to come. The session clock and your notes work as usual.</p></section>`;
  const i=b.st||0,st=r.steps[i],n=r.steps.length;
  const tally=(st.tally||[]).map(([l,of],j)=>{const v=tallyOf(b,i,j);
    return `<div class="s-tally"><span>${esc(l)}</span><div class="stepper"><button data-act="tal" data-i="${i}" data-j="${j}" data-v="-1" aria-label="One fewer ${esc(l)}">−</button><output>${v} / ${of}</output><button data-act="tal" data-i="${i}" data-j="${j}" data-v="1" aria-label="One more ${esc(l)}">+</button></div></div>`}).join("");
  const tot=stepTotal(b,i,st),of=(st.tally||[]).reduce((t,x)=>t+x[1],0);
  const pass=st.pass!=null?`<p class="s-pass ${tot>=st.pass?"ok":""}">${tot>=st.pass?"✓ Passed":`${st.pass-tot} more to pass`} · ${tot} of ${of}</p>`:st.tally?`<p class="hint">Total ${tot} of ${of}</p>`:"";
  const list=r.steps.map((x,k)=>{const t=x.tally?` · ${stepTotal(b,k,x)}/${x.tally.reduce((a,y)=>a+y[1],0)}`:"";
    return `<li class="${k<i?"done":k===i?"cur":""}"><span>${esc(x.name)}</span><small>${x.min} min${t}</small></li>`}).join("");
  return `<section class="panel s-what s-routine">
    <div class="s-rhd"><div class="label">${esc(r.title)} · step ${i+1} of ${n}</div>${change}</div>
    <h2 class="s-stepname">${esc(st.name)}</h2>
    <div class="s-stepclock"><span data-clock="step">${st.min}:00</span><small data-clock="steplbl">left in step</small></div>
    ${st.items?`<ul class="s-items">${st.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    ${st.prompt?`<p class="s-prompt">${esc(st.prompt)}</p>`:""}${st.tip?`<p class="hint">${esc(st.tip)}</p>`:""}${st.note?`<p class="hint">${esc(st.note)}</p>`:""}
    ${tally}${pass}
    <div class="row">${i>0?`<button class="ghost" data-act="step" data-v="-1">‹ Back a step</button>`:""}${i<n-1?`<button class="play" data-act="step" data-v="1">Next: ${esc(r.steps[i+1].name)}</button>`:""}</div>
    <ol class="s-steps">${list}</ol></section>`;
}
function routineResult(b){const r=ROUTINES[b.r];if(!r||!r.steps)return null;
  return r.steps.filter(x=>x.tally).map(x=>{const k=r.steps.indexOf(x),tot=stepTotal(b,k,x),of=x.tally.reduce((a,y)=>a+y[1],0);
    return {step:x.name,rows:x.tally.map(([l,o],j)=>[l,tallyOf(b,k,j),o]),total:tot,of,pass:x.pass!=null?tot>=x.pass:null}})}

function paint(){
  if(!run)return;
  const b=blk(),el=elapsed(),be=el-b.at,bl=b.min*60000-be,tl=planned()-el;
  const set=(k,v)=>document.querySelectorAll(`[data-clock="${k}"]`).forEach(n=>{if(n.textContent!==v)n.textContent=v});
  set("elapsed",clock(el));set("block",clock(bl));set("blocklbl",bl>=0?"left":"over");
  set("left",clock(tl));set("leftlbl",tl>=0?"Left in session":"Over planned time");
  document.querySelectorAll('[data-clock="block"]').forEach(n=>n.classList.toggle("over",bl<0));
  document.querySelectorAll('[data-clock="bar"]').forEach(n=>{n.style.width=Math.min(100,be/(b.min*60000)*100)+"%";n.classList.toggle("over",bl<0)});
  const r=b.r&&ROUTINES[b.r];if(r&&r.steps){const st=r.steps[b.st||0],sl=st.min*60000-(el-(b.stAt||b.at));
    set("step",clock(sl));set("steplbl",sl>=0?"left in step":"over");document.querySelectorAll('[data-clock="step"]').forEach(n=>n.classList.toggle("over",sl<0))}
  if(bl<=0&&!b.buzzed&&run.since){b.buzzed=true;saveRun();try{if(navigator.userActivation?.hasBeenActive)navigator.vibrate?.([200,100,200])}catch(e){}}
}
setInterval(paint,1000);

function logRun(){
  const w=week(),log=Store.get("practiceLog",[]);
  run.blocks.forEach(b=>{if(b.used==null)return;const s=SESS[b.s];
    log.push({run:run.id,date:run.date,s:b.s,title:s.title+(b.r?" · "+rTitle(b.r):""),disc:s.disc,min:Math.round(b.used/60000),done:!!b.done,games:b.games,
      ...(b.r?{routine:b.r,results:routineResult(b)}:{})});
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
    ${rows.filter(x=>x.results&&x.results.length).map(x=>`<div class="label">${esc(x.title)}</div><ul class="s-res">${x.results.map(rr=>`<li><div><b>${esc(rr.step)}</b><span class="${rr.pass===false?"bad":rr.pass?"good":""}">${rr.total}/${rr.of}${rr.pass==null?"":rr.pass?" ✓ passed":" ✗ not passed"}</span></div>${rr.rows.length>1?`<small>${rr.rows.map(([l,v,o])=>`${esc(l)} ${v}/${o}`).join(" · ")}</small>`:""}</li>`).join("")}</ul>`).join("")}
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
  pickr(el){if(!run)return;const b=blk();b.r=el.dataset.r||null;b.st=0;b.stAt=elapsed();b.tally={};saveRun();P.render()},
  step(el){if(!run)return;const b=blk(),r=ROUTINES[b.r];if(!r||!r.steps)return;b.st=Math.max(0,Math.min(r.steps.length-1,(b.st||0)+ +el.dataset.v));b.stAt=elapsed();saveRun();P.render();window.scrollTo(0,0)},
  tal(el){if(!run)return;const b=blk(),r=ROUTINES[b.r],i=+el.dataset.i,j=+el.dataset.j,of=r.steps[i].tally[j][1];
    b.tally=b.tally||{};const t=b.tally[i]=b.tally[i]||{};t[j]=Math.max(0,Math.min(of,(t[j]||0)+ +el.dataset.v));saveRun();P.render()},
  launch(el){let o={};try{o=JSON.parse(el.dataset.o||"{}")}catch(e){}P.launch(el.dataset.k,o)},
};
return {init,weekCard,sessView,runView,sumView,runBar,homeCard,running,addGame,act,paint};
})();
