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
  striking:{title:"Technical Ball Striking",min:60,disc:"Full swing",where:"Launch Monitor",routines:["center","face"],notes:["driver","irons"]},
  bscombine:{title:"Ball-Striking Combine",min:30,disc:"Full swing",where:"Launch Monitor",games:["bsc","skytrak"],notes:["driver","irons"]},
  wedgecombine:{title:"Wedge Combine",min:30,disc:"Wedges",where:"Launch Monitor",games:["wedge"],notes:["wedges"]},
  wedge2:{title:"Wedge Session",min:30,disc:"Wedges",where:"Launch Monitor",games:["wedge",{k:"ladder",o:{set:"wedges30"}}],notes:["wedges"]},
  techchip:{title:"Technical Chipping",min:30,disc:"Chipping",where:"Practice Facility",routines:["chip"],notes:["chipping"]},
  techputt:{title:"Technical Putting",min:30,disc:"Putting",where:"Practice Facility",routines:["putt"],notes:["putting"]},
  chipgame:{title:"Chipping Game",min:30,disc:"Chipping",where:"Practice Facility",games:["chip20","updown"],notes:["chipping"]},
  puttgame:{title:"Putting Game",min:30,disc:"Putting",where:"Practice Facility",games:["combine","lag"],notes:["putting"]},
  freestyle:{title:"Ball Striking – Freestyle",min:20,disc:"Full swing",where:"Launch Monitor",optional:true,free:true,notes:["driver","irons"]},
};
/* Routines: steps with their own minutes. A step can have drills (items) and a tally (row label, out of N),
   with an optional pass mark. Center Strike / Startline is from Dane Cvetkovic's "one-hour range routine" Short;
   the warm-up is our addition (the video's blocks add up to 50 minutes). */
const ROUTINES={
  center:{title:"Center Strike / Startline",steps:[
    {name:"Warm-Up",min:5,note:"Not in the video: easy swings, short clubs up to the 5-iron."},
    {name:"Technique",min:20,items:["10× Easy hands, patient at the top","10× Wide in the downswing","10× Rotate in the barrel"]},
    {name:"Strike",min:10,prompt:"How many can you hit through the gate?",tip:"Gate: two tees (or similar) just outside the toe and heel of the club at address.",tally:[["9-iron",5],["7-iron",5],["5-iron",5]]},
    {name:"Startline",min:10,prompt:"Can you start the ball on line?",tally:[["Draw",5],["Straight",5],["Fade",5]]},
    {name:"Performance",min:10,prompt:"Visualize the first hole. Hit at least 6 of 10 in the fairway to pass.",tally:[["Fairways",10]],pass:6},
  ]},
  /* Built on Dane Cvetkovic's "full range session if you want to break 80" Short, changed by the owner Nov 17 (3 + 20 + 20 + 14 = 57 min). */
  face:{title:"Face Control / Tempo",steps:[
    {name:"Warm-Up",min:3,items:["Loosen up","Feel the club"]},
    {name:"Technique",min:20,items:["5× Easy hands, patient at the top","5× Wide in the downswing","10× Split grip drill","10× Center strike"]},
    {name:"Startline & Tempo",min:20,prompt:"10 shots at 33%, then 10 at 66%, then 10 at 100%. The app calls the club for each shot.",
      tip:"Grade every shot: did it start on your line, and did it land in the 20-yard window (within 10 yards left or right of center)?",
      seq:{speeds:["33%","66%","100%"],per:10,clubs:["PW","9-iron","8-iron","7-iron","6-iron","5-iron","4-iron","5-wood"]}},
    {name:"Driver Challenge",min:14,prompt:"10 shots: hit 7 of 10 inside your zone (50 yards wide) to finish.",tally:[["Inside the zone",10]],pass:7},
  ]},
  chip:{title:"Technical Chipping",steps:[
    {name:"Warm-Up",min:5,items:["Weight distribution","Ball position","Hand tension","“Ultimate feel tempo”"],prompt:"Check each one."},
    {name:"Random Shots",min:17,prompt:"Vary the hole, lie, club, shot type and finish with each rep."},
    {name:"Sand, Green, Rough, Green",min:8},
  ]},
  putt:{title:"Technical Putting",steps:[
    {name:"3' Startline Putts",min:6},
    {name:"Lag Putt And Finish",min:12,prompt:"Lag Putt, Two Putt without the scorekeeping.",tip:"From one spot, lag balls 1–3 to holes 1–3 (25–45 ft), hole out, then putt each to hole 4 and hole out."},
    {name:"3' To 8' Putting Spiral",min:12,prompt:"Work around the spiral from 3 to 8 feet.",tip:"Done early if you complete the whole spiral (8 ft): tap Finish.",pick:{label:"Farthest Spiral Distance",opts:[3,4,5,6,7,8],unit:"ft"}},
  ]},
};
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
/* A graded shot sequence: per speed, every club once plus random extras up to `per`, in random order. */
function makeSeq(q){return q.speeds.flatMap(sp=>{const extra=Array.from({length:Math.max(0,q.per-q.clubs.length)},()=>q.clubs[Math.floor(Math.random()*q.clubs.length)]);
  return shuffle([...q.clubs.slice(0,q.per),...extra]).map(club=>({sp,club}))})}
function ensureSeq(b,i,st){b.seq=b.seq||{};if(!b.seq[i]){b.seq[i]={shots:makeSeq(st.seq),res:[]};saveRun()}return b.seq[i]}
function seqStats(q,sq){const rows=q.speeds.map(sp=>{let n=0,l=0,w=0;(sq?sq.shots:[]).forEach((x,k)=>{const r=sq.res[k];if(x.sp===sp&&r){n++;if(r.l)l++;if(r.w)w++}});return [sp,l,w,n]});
  return {rows,line:rows.reduce((t,r)=>t+r[1],0),win:rows.reduce((t,r)=>t+r[2],0),n:rows.reduce((t,r)=>t+r[3],0)}}
const rTitle=id=>ROUTINES[id]?ROUTINES[id].title:"";
const SLOTS=[["mon","Monday","Mon"],["tue","Tuesday","Tue"],["wed","Wednesday","Wed"],["thu","Thursday","Thu"],["fri","Friday","Fri"],["wknd","Weekend · Sat or Sun","Weekend"]];
const DEFAULT={mon:[],tue:["striking"],wed:["techchip","techputt"],thu:["bscombine","wedgecombine"],fri:["chipgame","puttgame"],wknd:["wedge2","freestyle"]};
let P={go(){},render(){},launch(){},gameName:k=>k,gameSub:()=>"",gameRow:()=>""};
const init=h=>{P={...P,...h}};

/* ---------- practice log helpers ---------- */
const plog=()=>Store.get("practiceLog",[]);
const shortDate=d=>Store.fmtDate(d,{month:"short",day:"numeric"});
function lastDone(id,routine){const l=plog().filter(x=>(id==null||x.s===id)&&(!routine||x.routine===routine)&&(x.done||x.min>0)).sort((a,b)=>a.date<b.date?-1:1);return l.length?l[l.length-1].date:null}
const GAME_DISC={bsc:"Full swing",skytrak:"Full swing",safe:"Full swing",fairway:"Full swing",range:"Full swing",must:"Full swing",wedge:"Wedges",chipc:"Chipping",chip20:"Chipping",updown:"Chipping",combine:"Putting",lag:"Putting"};
/* A game played outside a session still counts as practice: time from start to finish, 1 to 60 minutes. */
function logFree(g,title){
  const disc=g.game==="ladder"?(g.setup.set==="irons"?"Full swing":"Wedges"):GAME_DISC[g.game]||"Full swing";
  const min=Math.max(1,Math.min(60,Math.round(((g.finishedAt||Date.now())-(g.startedAt||Date.now()))/60000)));
  const log=plog();log.push({run:null,free:true,date:g.date||Store.today(),s:null,title,disc,min,done:true,games:[g.id]});Store.set("practiceLog",log);
}
/* Count a game played on its own for one of this week's sessions: the session is marked done and the game's minutes move to it. */
function countGame(gid,id){const w=week();w.done[id]=Store.today();saveWeek(w);
  const log=plog();log.forEach(x=>{if(x.free&&x.games&&x.games.includes(gid)){x.free=false;x.s=id;x.title=SESS[id].title}});Store.set("practiceLog",log)}
/* An open session this week that offers this game (so a game played on its own can count for it). */
function matchSession(k){const w=week();return Object.keys(SESS).find(id=>!w.done[id]&&gamesOf(SESS[id]).some(g=>g.k===k))||null}

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

const hm=ms=>{const m=Math.floor(ms/60000),h=Math.floor(m/60);return h?`${h} h ${m%60} min`:`${m} min`};
/* Total practice this week (Mon–Sun): logged sessions and Extra Practice, plus the session running now. */
function weekTotal(){
  const w=week(),base=plog().filter(x=>x.date>=w.of).reduce((t,x)=>t+x.min,0)*60000;
  return `<section class="panel s-total"><div class="label">Practiced This Week</div><div class="s-tbig" data-clock="weektotal" data-base="${base}">${hm(base+(run?elapsed():0))}</div>
    <p class="hint">Since Monday, including Extra Practice${run?" and the session in progress":""}.</p></section>`;
}
function weekCard(){
  const w=week(),today=slotOf();let total=0,done=0;
  const rows=SLOTS.map(([slot,name])=>{
    const ids=w.days[slot]||[],req=ids.filter(id=>!SESS[id].optional);total+=req.length;
    const dayDone=req.length>0&&req.every(id=>w.done[id]);
    const list=ids.map(id=>{const s=SESS[id],dn=!!w.done[id];if(dn&&!s.optional)done++;const ld=lastDone(id);
      return `<div class="s-sess${dn?" done":""}${s.optional?" opt":""}" data-s="${id}"><span class="s-grip" role="button" tabindex="-1" aria-label="Drag ${esc(s.title)} to another day"><svg viewBox="0 0 12 20" aria-hidden="true"><circle cx="3" cy="4" r="1.6"/><circle cx="9" cy="4" r="1.6"/><circle cx="3" cy="10" r="1.6"/><circle cx="9" cy="10" r="1.6"/><circle cx="3" cy="16" r="1.6"/><circle cx="9" cy="16" r="1.6"/></svg></span>
        <a class="s-link" href="#practice/s/${id}"><span class="s-name">${esc(s.title)}${s.optional?` <em class="s-optpill">Optional</em>`:""}<small>${s.min} min · ${esc(s.where)}${s.routines&&s.routines.length>1?" · "+s.routines.map(rTitle).join(" or "):""}${ld?" · Last "+esc(shortDate(ld)):""}</small></span><span class="s-mark">${dn?"✓ Done":"›"}</span></a></div>`}).join("");
    return `<div class="s-day${dayDone?" done":""}${slot===today?" today":""}" data-slot="${slot}">
      <div class="s-dayhd"><span class="s-dname">${esc(name)}${slot===today?`<small>Today</small>`:""}</span>${req.length?(dayDone?`<span class="s-donepill">✓ Done</span>`:`<button class="ghost sm" data-act="startday" data-slot="${slot}">Start</button>`):""}</div>
      ${list||`<p class="hint s-empty">${slot==="mon"?"Play Day":"Nothing Planned"}</p>`}</div>`;
  }).join("");
  const differs=JSON.stringify(w.days)!==JSON.stringify(usual());
  const [y,m,d]=w.of.split("-").map(Number);
  const wk=plog().filter(x=>x.date>=w.of);
  const extra=wk.filter(x=>x.free||(x.s&&SESS[x.s]&&SESS[x.s].optional));
  return `<section class="s-week" aria-label="This week">
    <h2 class="p-h2">This Week</h2>
    <div class="s-weekhd"><div class="label">Suggested Plan · Week Of ${esc(new Date(y,m-1,d).toLocaleDateString(undefined,{month:"short",day:"numeric"}))}</div><span class="hint">${done} of ${total} done</span></div>
    ${rows}
    ${extra.length?`<div class="s-day s-extra"><div class="s-dayhd"><span class="s-dname">Extra Practice</span></div>${extra.map(x=>`<div class="s-xrow"><span>${esc(x.title)}<small>${esc(Store.fmtDate(x.date,{weekday:"short"}))}</small></span><b>${x.min} min</b></div>`).join("")}</div>`:""}
    <p class="hint">Drag a session by its handle to move it to another day. Start any day, in any order; tap a session to start it alone or mark it done. Games played on their own show under Extra Practice and count toward your minutes.</p>
    ${differs?`<div class="row"><button class="ghost sm" data-act="resetweek">Back To My Usual Week</button><button class="ghost sm" data-act="saveusual">Make This My Usual Week</button></div>`:""}
  </section>`;
}

const gamesOf=s=>(s.games||[]).map(g=>typeof g==="string"?{k:g,o:{}}:g);
function routineOutline(id){const r=ROUTINES[id];if(!r)return "";
  return r.steps?`<ol class="s-outline">${r.steps.map(st=>`<li><b>${esc(st.name)}</b> · ${st.min} min${st.items?": "+esc(st.items.join(", ")):st.prompt?": "+esc(st.prompt):""}</li>`).join("")}</ol>`:`<p class="hint">Steps to come.</p>`}
function whatHtml(s){
  if(s.free)return `<p class="hint">No structure: work on whatever feels needed. Optional, so it doesn't count toward the week's done total.</p>`;
  if(s.routines&&s.routines.length===1)return routineOutline(s.routines[0]);
  if(s.routines)return `<p class="hint">Pick the routine when you start: ${s.routines.map(r=>esc(rTitle(r))).join(" or ")}.</p>${s.routines.map(r=>{const ld=lastDone(null,r);return `<div class="label">${esc(rTitle(r))}${ld?" · Last "+esc(shortDate(ld)):""}</div>${routineOutline(r)}`}).join("")}`;
  if(s.routine)return `<p class="hint">Routine to come: the steps for ${esc(s.title)} will show here once you add them. For now the session gives you the clock and your notes.</p>`;
  const g=gamesOf(s);
  return `<p class="hint">${g.length>1?"Play one of: ":"Game: "}${g.map(x=>esc(P.gameName(x.k,x.o))).join(" or ")}.</p>`;
}
function sessView(id){
  const s=SESS[id];if(!s)return null;const w=week(),slot=slotHas(w,id),dn=w.done[id];
  const mates=(w.days[slot]||[]).filter(x=>x!==id).map(x=>SESS[x].title);
  return `<a class="r-back" href="#practice">‹ Practice</a>
  <header><h1>${esc(s.title)}</h1><p class="sub">${s.min} minutes · ${esc(s.disc.replace(/\b\w/g,c=>c.toUpperCase()))} · ${esc(s.where)}${s.optional?" · Optional":""}</p></header>
  <section class="panel s-info">${whatHtml(s)}${(()=>{const ld=lastDone(id);return ld?`<p class="hint">Last done ${esc(Store.fmtDate(ld,{weekday:"short",month:"short",day:"numeric"}))}.</p>`:`<p class="hint">Not done yet.</p>`})()}${dn?`<p class="s-donenote">✓ Done this week (${esc(Store.fmtDate(dn,{weekday:"short",month:"short",day:"numeric"}))})</p>`:""}</section>
  <button class="play r-wide" data-act="startone" data-s="${id}">Start This Session</button>
  <section class="panel r-form"><div class="r-field"><div class="label">This Week's Day</div>
    <div class="r-opts">${SLOTS.map(([sl,,short])=>`<button class="r-opt" data-act="move" data-s="${id}" data-slot="${sl}" aria-pressed="${sl===slot}">${short}</button>`).join("")}</div>
    <p class="hint">${mates.length?`Shares ${esc(slotName(slot))} with ${esc(mates.join(" and "))}. Moving it splits it off; the other session stays put.`:"Move it to any day this week."}</p></div></section>
  <div class="row"><button class="ghost" data-act="markdone" data-s="${id}">${dn?"Mark Not Done":"Mark Done (Practiced Without The App)"}</button></div>`;
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
  /* The clock waits until the start check-in is answered. */
  run={id:Store.uid(),label,date:Store.today(),startedAt:Date.now(),acc:0,since:null,i:0,ci:{start:null,end:null},cd:{},
    blocks:ids.map(id=>({s:id,min:SESS[id].min,at:0,games:[],...(SESS[id].routines&&SESS[id].routines.length===1?{r:SESS[id].routines[0],st:0,tally:{}}:{})}))};
  saveRun();P.go("run");
}
function addGame(gameId){if(!run)return;const b=blk();if(!b.games.includes(gameId)){b.games.push(gameId);saveRun()}}

function runBar(){
  if(!run)return "";const s=SESS[blk().s];
  return `<a class="s-runbar" href="#practice/run"><span class="s-dot${run.since?"":" paused"}"></span><span class="s-rname">${esc(s.title)}</span><b data-clock="block"></b><small data-clock="blocklbl">left</small></a>`;
}
function homeCard(){
  if(!run)return "";const s=SESS[blk().s];
  return `<section class="panel r-active"><span class="pill live">${inCheck()?(run.ending?"Finish Check-In":"Check-In Waiting"):run.since?"Session Running":"Session Paused"}</span>
    <div class="r-title">${esc(run.label)}<small>${esc(s.title)} · <span data-clock="block"></span> <span data-clock="blocklbl">left</span> · practiced <span data-clock="elapsed"></span></small></div>
    <div class="row"><a class="play" href="#practice/run">Open Session</a></div></section>`;
}
/* ---------- check-in at the start and end of every practice session ---------- */
const CI_Q=[["fun","Are You Having Fun?","yn"],["life","Is Golf Getting In The Way Of Real Life?","yn"],["hq","What's Your Happiness Quotient?","n10"]];
const inCheck=()=>!!(run&&run.ci&&(!run.ci.start||run.ending));
function checkinView(){
  const kind=run.ending?"end":"start",d=run.cd||{},ready=CI_Q.every(([k])=>d[k]!=null);
  const q=CI_Q.map(([k,label,t])=>`<div class="r-field s-ci"><div class="s-ciq">${esc(label)}</div>
    ${t==="yn"?`<div class="r-opts">${[["yes","Yes"],["no","No"]].map(([v,l])=>`<button class="r-opt" data-act="ci" data-q="${k}" data-v="${v}" aria-pressed="${d[k]===v}">${l}</button>`).join("")}</div>`
      :`<div class="r-nums s-hq">${Array.from({length:10},(_,n)=>`<button class="r-num" data-act="ci" data-q="${k}" data-v="${n+1}" aria-pressed="${d[k]===n+1}">${n+1}</button>`).join("")}</div>`}</div>`).join("");
  return `<a class="r-back" href="#practice">‹ Practice</a>
  <header><h1>${kind==="start"?"Before You Start":"Before You Finish"}</h1><p class="sub">${esc(run.label)} · quick check-in${kind==="start"?". The clock starts when you're done.":"."}</p></header>
  <section class="panel s-cis">${q}</section>
  <div class="row"><button class="play" data-act="${kind==="start"?"cistart":"ciend"}"${ready?"":" disabled"}>${kind==="start"?"Start Practice":"Finish Practice"}</button>
    <button class="ghost danger" data-act="discardrun">Discard</button></div>`;
}
function ciSummary(id){
  const c=Store.get("checkins",[]).filter(x=>x.run===id),s=c.find(x=>x.when==="start"),e=c.find(x=>x.when==="end");if(!s&&!e)return "";
  const v=(x,k)=>!x?"—":k==="hq"?x.hq:x[k]==="yes"?"Yes":"No";
  return `<div class="label">Check-In</div><table class="p-bench"><tr class="hd"><th></th><td>Start</td><td>End</td></tr>
    ${CI_Q.map(([k,l])=>`<tr><th>${esc(l.replace(/\?$/,""))}</th><td>${v(s,k)}</td><td>${v(e,k)}</td></tr>`).join("")}</table>`;
}
function saveCheckins(){
  if(!run.ci)return;const c=Store.get("checkins",[]);
  ["start","end"].forEach(w=>{const a=run.ci[w];if(a)c.push({run:run.id,date:run.date,when:w,fun:a.fun,life:a.life,hq:a.hq,at:a.at})});
  Store.set("checkins",c);
}

function runView(){
  if(!run)return null;
  if(inCheck())return checkinView();
  const b=blk(),s=SESS[b.s],last=run.i===run.blocks.length-1,paused=!run.since;
  const games=gamesOf(s).map(g=>`<button class="r-row p-game" data-act="launch" data-k="${g.k}" data-o="${esc(JSON.stringify(g.o||{}))}"><span class="r-name">${esc(P.gameName(g.k,g.o))}<small>${esc(P.gameSub(g.k))}</small></span><span class="p-go">›</span></button>`).join("");
  const played=b.games.map(P.gameRow).join("");
  const notes=(s.notes||[]).map(a=>{const t=typeof Notes!=="undefined"?Notes.get(a):"";
    return `<div class="s-note"><div class="label">${esc(typeof Notes!=="undefined"?Notes.name(a):a)}</div>${t?`<p>${esc(t)}</p>`:`<p class="hint">Nothing written yet.</p>`}</div>`}).join("");
  const steps=run.blocks.map((x,i)=>{const t=SESS[x.s],st=i<run.i?(x.done?"done":"skip"):i===run.i?"cur":"";
    return `<li class="${st}"><span>${esc(t.title)}</span><small>${i<run.i?(x.done?"✓ "+Math.round(x.used/60000)+" min":"Skipped"):x.min+" min"}</small></li>`}).join("");
  return `<a class="r-back" href="#practice">‹ Practice</a>
  <header><h1>${esc(run.label)}</h1><p class="sub">${run.blocks.length>1?`Block ${run.i+1} of ${run.blocks.length} · `:""}${esc(s.disc.replace(/\b\w/g,c=>c.toUpperCase()))} · ${esc(s.where)}</p></header>
  <section class="panel s-clock">
    <div class="s-big"><div class="label">${esc(s.title)} · <span data-clock="blocklbl">left</span></div><div class="clock" data-clock="block">0:00</div><div class="p-bar"><i data-clock="bar"></i></div></div>
    <div class="s-tot"><div><div class="label">Practiced</div><div class="v" data-clock="elapsed">0:00</div></div>
      <div><div class="label" data-clock="leftlbl">Left In Session</div><div class="v" data-clock="left">0:00</div></div>
      <div><div class="label">Planned</div><div class="v">${clock(planned())}</div></div></div>
    ${paused?`<p class="s-paused">Paused. The clocks are stopped.</p>`:""}
    <div class="s-alrow"><span class="hint">Alarm at the end of each section · rises to your media volume</span>
      <button class="ghost sm" data-act="altest">Test</button><button class="ghost sm" data-act="altoggle" aria-pressed="${alarmOn()}">${alarmOn()?"Alarm On":"Alarm Off"}</button></div>
  </section>
  <div class="row s-ctl"><button class="play" data-act="next">${last?"Finish Session":"Finish Block"}</button>
    <button class="ghost" data-act="pause">${paused?"Resume":"Pause"}</button>
    ${last?"":`<button class="ghost" data-act="skip">Skip Block</button>`}
    <button class="ghost" data-act="endrun">End Now</button>
    <button class="ghost danger" data-act="discardrun">Discard</button></div>
  ${s.free?`<section class="panel s-what"><p class="hint">Freestyle: no structure. Work on whatever feels needed; the clock keeps your time.</p></section>`:s.routines?routinePanel(s,b):`<section class="panel s-what">${s.routine?whatHtml(s):`<div class="label">${gamesOf(s).length>1?"Pick A Game":"Game"}</div><div class="r-list">${games}</div>`}
    ${played?`<div class="label">Played This Block</div><div class="r-list">${played}</div>`:""}</section>`}
  ${notes?`<section class="panel s-notes"><div class="s-noteshd"><div class="label">Your Notes</div><a class="ghost sm" href="#notes">Edit In Notes</a></div>${notes}</section>`:""}
  ${run.blocks.length>1?`<section class="panel"><div class="label">Today's Blocks</div><ol class="s-steps">${steps}</ol></section>`:""}`;
}

/* Routine inside a block: pick it, then step through with a countdown per step and tap counters. */
const tallyOf=(b,i,j)=>((b.tally||{})[i]||{})[j]||0;
const stepTotal=(b,i,st)=>(st.tally||[]).reduce((t,_,j)=>t+tallyOf(b,i,j),0);
function routinePanel(s,b){
  if(b.r==null)return `<section class="panel s-what"><div class="label">Which Routine Today?</div>
    <div class="r-list">${s.routines.map(id=>`<button class="r-row p-game" data-act="pickr" data-r="${id}"><span class="r-name">${esc(rTitle(id))}<small>${ROUTINES[id].steps?ROUTINES[id].steps.map(x=>x.name+" "+x.min).join(" · "):"Steps to come"}${(()=>{const ld=lastDone(null,id);return ld?" · Last "+esc(shortDate(ld)):""})()}</small></span><span class="p-go">›</span></button>`).join("")}</div></section>`;
  const r=ROUTINES[b.r],touched=Object.keys(b.tally||{}).length>0||Object.values(b.seq||{}).some(q=>q.res.length);
  const change=s.routines.length>1&&!touched&&!(b.st>0)?`<button class="ghost sm" data-act="pickr" data-r="">Change Routine</button>`:"";
  if(!r.steps)return `<section class="panel s-what"><div class="s-rhd"><div class="label">${esc(r.title)}</div>${change}</div><p class="hint">Steps for this routine are still to come. The session clock and your notes work as usual.</p></section>`;
  const i=b.st||0,st=r.steps[i],n=r.steps.length;
  const tally=(st.tally||[]).map(([l,of],j)=>{const v=tallyOf(b,i,j);
    return `<div class="s-tally"><span>${esc(l)}</span><div class="stepper"><button data-act="tal" data-i="${i}" data-j="${j}" data-v="-1" aria-label="One fewer ${esc(l)}">−</button><output>${v} / ${of}</output><button data-act="tal" data-i="${i}" data-j="${j}" data-v="1" aria-label="One more ${esc(l)}">+</button></div></div>`}).join("");
  const tot=stepTotal(b,i,st),of=(st.tally||[]).reduce((t,x)=>t+x[1],0);
  const pass=st.pass!=null?`<p class="s-pass ${tot>=st.pass?"ok":""}">${tot>=st.pass?"✓ Passed":`${st.pass-tot} More To Pass`} · ${tot} of ${of}</p>`:st.tally?`<p class="hint">Total ${tot} of ${of}</p>`:"";
  const list=r.steps.map((x,k)=>{const sq=x.seq&&(b.seq||{})[k],ss=sq&&seqStats(x.seq,sq);const t=ss&&ss.n?` · line ${ss.line}/${ss.n} · window ${ss.win}/${ss.n}`:x.tally?` · ${stepTotal(b,k,x)}/${x.tally.reduce((a,y)=>a+y[1],0)}`:x.pick&&(b.pick||{})[k]!=null?` · ${b.pick[k]} ${x.pick.unit}`:"";
    return `<li class="${k<i?"done":k===i?"cur":""}"><span>${esc(x.name)}</span><small>${x.min} min${t}</small></li>`}).join("");
  return `<section class="panel s-what s-routine">
    <div class="s-rhd"><div class="label">${esc(r.title)} · step ${i+1} of ${n}</div>${change}</div>
    <h2 class="s-stepname">${esc(st.name)}</h2>
    <div class="s-stepclock"><span data-clock="step">${st.min}:00</span><small data-clock="steplbl">Left In Step</small></div>
    ${st.items?`<ul class="s-items">${st.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    ${st.prompt?`<p class="s-prompt">${esc(st.prompt)}</p>`:""}${st.tip?`<p class="hint">${esc(st.tip)}</p>`:""}${st.note?`<p class="hint">${esc(st.note)}</p>`:""}
    ${st.seq?seqHtml(b,i,st):""}${tally}${pass}${st.pick?(()=>{const v=(b.pick||{})[i];return `<div class="r-field s-pick"><div class="label">${esc(st.pick.label)}</div>
      <div class="r-opts">${st.pick.opts.map(o=>`<button class="r-opt" data-act="pick" data-i="${i}" data-v="${o}" aria-pressed="${v===o}">${o} ${esc(st.pick.unit)}</button>`).join("")}</div>
      ${v===st.pick.opts[st.pick.opts.length-1]?`<p class="s-pass ok">✓ Whole spiral done: you can finish.</p>`:""}</div>`})():""}
    <div class="row">${i>0?`<button class="ghost" data-act="step" data-v="-1">‹ Back A Step</button>`:""}${i<n-1?`<button class="play" data-act="step" data-v="1">Next: ${esc(r.steps[i+1].name)}</button>`:""}</div>
    <ol class="s-steps">${list}</ol></section>`;
}
function seqHtml(b,i,st){
  const sq=ensureSeq(b,i,st),k=sq.res.length,tot=sq.shots.length,ss=seqStats(st.seq,sq);
  const cur=sq.shots[k];
  const table=`<table class="p-bench"><tr class="hd"><th></th><td>On Line</td><td>In Window</td></tr>${ss.rows.map(([sp,l,w,n])=>`<tr><th>${sp}</th><td>${l}/${n}</td><td>${w}/${n}</td></tr>`).join("")}<tr><th>Total</th><td>${ss.line}/${ss.n}</td><td>${ss.win}/${ss.n}</td></tr></table>`;
  if(!cur)return `<p class="s-pass ok">✓ All ${tot} shots graded.</p>${table}<div class="row"><button class="ghost" data-act="sequndo" data-i="${i}">Undo Last Shot</button></div>`;
  return `<div class="s-seq"><div class="label">Shot ${k+1} of ${tot} · ${esc(cur.sp)} speed</div>
    <div class="p-call">${esc(cur.club)}<span>${esc(cur.sp)} speed</span></div>
    <div class="p-btns two s-grade">
      <button class="p-btn good" data-act="seqhit" data-i="${i}" data-l="1" data-w="1"><b>Both</b>On line, in window</button>
      <button class="p-btn" data-act="seqhit" data-i="${i}" data-l="1" data-w="0"><b>Line</b>On line only</button>
      <button class="p-btn" data-act="seqhit" data-i="${i}" data-l="0" data-w="1"><b>Window</b>In window only</button>
      <button class="p-btn bad" data-act="seqhit" data-i="${i}" data-l="0" data-w="0"><b>Neither</b>Off line, outside</button></div>
    ${k?`<div class="row"><button class="ghost sm" data-act="sequndo" data-i="${i}">Undo Last Shot</button></div>`:""}</div>${k?table:""}`;
}
function routineResult(b){const r=ROUTINES[b.r];if(!r||!r.steps)return null;
  return r.steps.filter(x=>x.tally||x.pick||x.seq).map(x=>{if(x.seq){const k=r.steps.indexOf(x),ss=seqStats(x.seq,(b.seq||{})[k]);
      return {step:x.name,seq:true,rows:ss.rows,line:ss.line,win:ss.win,n:ss.n}}if(x.pick){const k=r.steps.indexOf(x),v=(b.pick||{})[k];
      return {step:x.name,pick:x.pick.label,value:v==null?null:v,unit:x.pick.unit}}const k=r.steps.indexOf(x),tot=stepTotal(b,k,x),of=x.tally.reduce((a,y)=>a+y[1],0);
    return {step:x.name,rows:x.tally.map(([l,o],j)=>[l,tallyOf(b,k,j),o]),total:tot,of,pass:x.pass!=null?tot>=x.pass:null}})}

/* ---------- section alarm ----------
   When a routine section (or a block with no routine) runs out of time, a beeping chime plays and rises in volume over
   about 20 seconds. It's played through Web Audio, which on a phone uses the media volume, so the media volume sets the
   top. The sound is scheduled ahead on the audio clock, so it fires on time even if the page's timers are slowed. */
const Alarm=(()=>{
  let ctx=null,nodes=[],master=null;
  function ac(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;if(!ctx)ctx=new C();if(ctx.state==="suspended")ctx.resume().catch(()=>{});return ctx}
  function cancel(){nodes.forEach(o=>{try{o.stop()}catch(e){}});nodes=[];if(master){try{master.disconnect()}catch(e){}master=null}}
  function play(atMs,secs=180,rise=20){
    cancel();const c=ac();if(!c)return;
    const t0=c.currentTime+Math.max(0,(atMs-Date.now())/1000);
    master=c.createGain();master.connect(c.destination);
    master.gain.setValueAtTime(0.0001,c.currentTime);master.gain.setValueAtTime(0.04,t0);master.gain.exponentialRampToValueAtTime(1,t0+rise);
    for(let t=t0;t<t0+secs;t+=1.2){
      [[880,0],[1320,.18]].forEach(([f,d])=>{const o=c.createOscillator(),e=c.createGain();o.type="triangle";o.frequency.value=f;
        e.gain.setValueAtTime(0.0001,t+d);e.gain.linearRampToValueAtTime(.9,t+d+.012);e.gain.exponentialRampToValueAtTime(.0001,t+d+.26);
        o.connect(e);e.connect(master);o.start(t+d);o.stop(t+d+.3);nodes.push(o)});
    }
  }
  /* Browsers only allow sound after a tap, so every tap wakes the audio up. */
  document.addEventListener("pointerdown",()=>{if(ctx&&ctx.state==="suspended")ctx.resume().catch(()=>{});else if(!ctx)ac()},{capture:true});
  return {play,cancel};
})();
const alarmOn=()=>Store.get("settings",{}).alarm!==false;
let alarmSig="";
/* The section running now: its key, when it ends (as a clock time), and what "next" does. */
function section(){
  const b=blk(),r=b.r&&ROUTINES[b.r],last=run.i===run.blocks.length-1,el=elapsed();
  if(r&&r.steps){const i=b.st||0,st=r.steps[i],start=i===0&&b.stAt==null?b.at:(b.stAt||b.at),left=st.min*60000-(el-start);
    return {key:run.i+":"+i,name:st.name,left,next:i<r.steps.length-1?{act:"step",label:"Next: "+r.steps[i+1].name}:{act:"next",label:last?"Finish Session":"Finish Block"}}}
  return {key:run.i+":b",name:SESS[b.s].title,left:b.min*60000-(el-b.at),next:{act:"next",label:last?"Finish Session":"Finish Block"}};
}
function syncAlarm(){
  if(!run||!run.since||inCheck()||!alarmOn()){if(alarmSig){Alarm.cancel();alarmSig=""}showAlarm(null);return}
  const sec=section(),off=(run.alarmOff||{})[sec.key];
  if(off){if(alarmSig){Alarm.cancel();alarmSig=""}showAlarm(null);return}
  /* Reschedule only when the section changes or its end time moves (pause/resume, step change). */
  const at=Date.now()+sec.left,[pk,pa]=alarmSig.split("@");
  if(pk!==sec.key||Math.abs(at-(+pa||0))>2500){Alarm.play(at);alarmSig=sec.key+"@"+at}
  showAlarm(sec.left<=0?sec:null);
}
function showAlarm(sec){
  let bar=document.getElementById("alarmBar");
  if(!sec){if(bar)bar.remove();return}
  if(!bar){bar=document.createElement("div");bar.id="alarmBar";bar.className="s-alarm";bar.setAttribute("role","alert");document.body.appendChild(bar);
    bar.addEventListener("click",e=>{const el=e.target.closest("[data-al]");if(!el||!run)return;e.preventDefault();
      const sec=section();run.alarmOff=run.alarmOff||{};run.alarmOff[sec.key]=true;Alarm.cancel();alarmSig="";saveRun();showAlarm(null);
      if(el.dataset.al==="next"){if(sec.next.act==="step")act.step({dataset:{v:"1"}});else act.next()}
      else P.render()})}
  const html=`<div class="s-almsg"><b>Time's Up</b><span>${esc(sec.name)}</span></div><div class="s-albtns"><button class="ghost" data-al="stop">Stop Sound</button><button class="play" data-al="next">${esc(sec.next.label)}</button></div>`;
  if(bar.dataset.k!==sec.key+sec.next.label){bar.innerHTML=html;bar.dataset.k=sec.key+sec.next.label}
}

function paint(){
  if(!run){if(alarmSig){Alarm.cancel();alarmSig=""}showAlarm(null);return}
  const b=blk(),el=elapsed(),be=el-b.at,bl=b.min*60000-be,tl=planned()-el;
  const set=(k,v)=>document.querySelectorAll(`[data-clock="${k}"]`).forEach(n=>{if(n.textContent!==v)n.textContent=v});
  document.querySelectorAll('[data-clock="weektotal"]').forEach(n=>{const v=hm(+n.dataset.base+el);if(n.textContent!==v)n.textContent=v});
  set("elapsed",clock(el));set("block",clock(bl));set("blocklbl",bl>=0?"left":"over");
  set("left",clock(tl));set("leftlbl",tl>=0?"Left In Session":"Over Planned Time");
  document.querySelectorAll('[data-clock="block"]').forEach(n=>n.classList.toggle("over",bl<0));
  document.querySelectorAll('[data-clock="bar"]').forEach(n=>{n.style.width=Math.min(100,be/(b.min*60000)*100)+"%";n.classList.toggle("over",bl<0)});
  const r=b.r&&ROUTINES[b.r];if(r&&r.steps){const st=r.steps[b.st||0],sl=st.min*60000-(el-(b.stAt||b.at));
    set("step",clock(sl));set("steplbl",sl>=0?"Left In Step":"Over");document.querySelectorAll('[data-clock="step"]').forEach(n=>n.classList.toggle("over",sl<0))}
  if(bl<=0&&!b.buzzed&&run.since){b.buzzed=true;saveRun();try{if(navigator.userActivation?.hasBeenActive)navigator.vibrate?.([200,100,200])}catch(e){}}
  syncAlarm();
}
setInterval(paint,1000);

function logRun(){
  const w=week(),log=Store.get("practiceLog",[]);
  run.blocks.forEach(b=>{if(b.used==null)return;const s=SESS[b.s];
    log.push({run:run.id,date:run.date,s:b.s,title:s.title+(b.r?" · "+rTitle(b.r):""),disc:s.disc,min:Math.round(b.used/60000),done:!!b.done,games:b.games,
      ...(b.r?{routine:b.r,results:routineResult(b)}:{})});
    if(b.done)w.done[b.s]=Store.today()});
  Store.set("practiceLog",log);saveWeek(w);saveCheckins();
  const id=run.id;run=null;Store.set("run",null);P.go("sum/"+id,true);
}
function closeBlock(done){const b=blk();b.used=elapsed()-b.at;b.done=done;
  if(run.i>=run.blocks.length-1){if(run.since){run.acc=elapsed();run.since=null}
    if(run.ci){run.ending=true;run.cd={};saveRun();P.render();window.scrollTo(0,0);return}
    logRun();return}
  run.i++;blk().at=elapsed();saveRun();P.render();window.scrollTo(0,0);
}
function sumView(id){
  const rows=Store.get("practiceLog",[]).filter(x=>x.run===id);if(!rows.length)return null;
  const tot=rows.reduce((t,x)=>t+x.min,0);
  return `<header><h1>Session Done</h1><p class="sub">${esc(Store.fmtDate(rows[0].date,{weekday:"long",month:"short",day:"numeric"}))}</p></header>
  <section class="panel r-sum"><div class="label">Practiced</div><div class="r-big">${tot} min</div>
    <ol class="s-steps">${rows.map(x=>`<li class="${x.done?"done":"skip"}"><span>${esc(x.title)}</span><small>${x.done?"✓ ":"Not done · "}${x.min} min</small></li>`).join("")}</ol>
    ${rows.filter(x=>x.results&&x.results.length).map(x=>`<div class="label">${esc(x.title)}</div><ul class="s-res">${x.results.map(rr=>rr.seq?`<li><div><b>${esc(rr.step)}</b><span>Line ${rr.line}/${rr.n} · Window ${rr.win}/${rr.n}</span></div><small>${rr.rows.map(([sp,l,w,n])=>`${sp}: line ${l}/${n}, window ${w}/${n}`).join(" · ")}</small></li>`:rr.pick?`<li><div><b>${esc(rr.step)}</b><span>${rr.value==null?"—":rr.value+" "+esc(rr.unit)}</span></div><small>${esc(rr.pick)}</small></li>`:`<li><div><b>${esc(rr.step)}</b><span class="${rr.pass===false?"bad":rr.pass?"good":""}">${rr.total}/${rr.of}${rr.pass==null?"":rr.pass?" ✓ passed":" ✗ not passed"}</span></div>${rr.rows.length>1?`<small>${rr.rows.map(([l,v,o])=>`${esc(l)} ${v}/${o}`).join(" · ")}</small>`:""}</li>`).join("")}</ul>`).join("")}
    ${rows.some(x=>x.games.length)?`<div class="label">Games</div><div class="r-list">${rows.flatMap(x=>x.games).map(P.gameRow).join("")}</div>`:""}
    ${ciSummary(id)}
    <p class="hint">Done sessions are highlighted on this week's plan.</p></section>
  <div class="row"><a class="play" href="#practice">Done</a><a class="ghost" href="#notes" style="display:inline-flex;align-items:center">Update My Notes</a></div>`;
}

const act={
  startday(el){const w=week(),ids=w.days[el.dataset.slot]||[],todo=ids.filter(id=>!w.done[id]);start(todo.length?todo:ids,slotName(el.dataset.slot).split(" ·")[0]+" Session")},
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
  discardrun(){if(!run)return;
    if(!confirm("Discard this session? None of its time counts toward your practice, and nothing is marked done. Games you finished in it stay in their own history."))return;
    run=null;Store.set("run",null);P.go("",true);P.render()},

  altoggle(){const st=Store.get("settings",{});st.alarm=!alarmOn();Store.set("settings",st);if(!st.alarm){Alarm.cancel();alarmSig=""}P.render()},
  altest(){Alarm.play(Date.now()+50,4,3);alarmSig="";setTimeout(()=>{Alarm.cancel();syncAlarm()},4300)},
  ci(el){if(!run)return;run.cd=run.cd||{};const q=el.dataset.q;run.cd[q]=q==="hq"?+el.dataset.v:el.dataset.v;saveRun();P.render()},
  cistart(){if(!run||!CI_Q.every(([k])=>(run.cd||{})[k]!=null))return;run.ci.start={...run.cd,at:Date.now()};run.cd={};run.since=Date.now();
    const b=blk();if(b.r)b.stAt=0;saveRun();P.render()},
  ciend(){if(!run||!CI_Q.every(([k])=>(run.cd||{})[k]!=null))return;run.ci.end={...run.cd,at:Date.now()};logRun()},
  seqhit(el){if(!run)return;const b=blk(),i=+el.dataset.i,r=ROUTINES[b.r],sq=ensureSeq(b,i,r.steps[i]);if(sq.res.length>=sq.shots.length)return;
    sq.res.push({l:el.dataset.l==="1",w:el.dataset.w==="1"});saveRun();P.render()},
  sequndo(el){if(!run)return;const b=blk(),sq=(b.seq||{})[+el.dataset.i];if(sq&&sq.res.length){sq.res.pop();saveRun();P.render()}},
  pickr(el){if(!run)return;const b=blk();b.r=el.dataset.r||null;b.st=0;b.stAt=elapsed();b.tally={};saveRun();P.render()},
  step(el){if(!run)return;const b=blk(),r=ROUTINES[b.r];if(!r||!r.steps)return;b.st=Math.max(0,Math.min(r.steps.length-1,(b.st||0)+ +el.dataset.v));b.stAt=elapsed();saveRun();P.render();window.scrollTo(0,0)},
  pick(el){if(!run)return;const b=blk(),i=+el.dataset.i,v=+el.dataset.v;b.pick=b.pick||{};b.pick[i]=b.pick[i]===v?null:v;saveRun();P.render()},
  tal(el){if(!run)return;const b=blk(),r=ROUTINES[b.r],i=+el.dataset.i,j=+el.dataset.j,of=r.steps[i].tally[j][1];
    b.tally=b.tally||{};const t=b.tally[i]=b.tally[i]||{};t[j]=Math.max(0,Math.min(of,(t[j]||0)+ +el.dataset.v));saveRun();P.render()},
  launch(el){let o={};try{o=JSON.parse(el.dataset.o||"{}")}catch(e){}P.launch(el.dataset.k,o)},
};
/* ---------- drag a session to another day (week card on the Practice home) ----------
   Press the handle and drag: works with touch and mouse. Drops between sessions in any day. */
(()=>{
  const root=document.getElementById("practiceRoot");if(!root)return;
  let d=null,raf=0;
  const rowsIn=day=>[...day.querySelectorAll(".s-sess")].filter(r=>r!==d.row);
  function place(x,y){
    const el=document.elementFromPoint(x,y),day=el&&el.closest(".s-week .s-day[data-slot]");if(!day)return;
    const before=rowsIn(day).find(r=>{const b=r.getBoundingClientRect();return y<b.top+b.height/2});
    if(before)before.before(d.ph);else{const rs=rowsIn(day);if(rs.length)rs[rs.length-1].after(d.ph);else{const e=day.querySelector(".s-empty");e?e.before(d.ph):day.appendChild(d.ph)}}
    root.querySelectorAll(".s-day.drop").forEach(x=>x!==day&&x.classList.remove("drop"));day.classList.add("drop");
  }
  function scroll(){if(!d)return;const m=70;if(d.y<m)window.scrollBy(0,-12);else if(d.y>innerHeight-m-70)window.scrollBy(0,12);
    d.ghost.style.top=(d.y-d.dy)+"px";place(d.x,d.y);raf=requestAnimationFrame(scroll)}
  root.addEventListener("pointerdown",e=>{
    const g=e.target.closest(".s-grip");if(!g||d)return;e.preventDefault();
    const row=g.closest(".s-sess"),r=row.getBoundingClientRect();
    const ghost=row.cloneNode(true);ghost.classList.add("s-ghost");Object.assign(ghost.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px"});
    const ph=document.createElement("div");ph.className="s-ph";ph.style.height=r.height+"px";
    d={id:row.dataset.s,row,ghost,ph,dy:e.clientY-r.top,x:e.clientX,y:e.clientY,pid:e.pointerId};
    row.after(ph);row.classList.add("s-dragging");document.body.appendChild(ghost);document.body.classList.add("s-isdrag");
    try{g.setPointerCapture(e.pointerId)}catch(_){}
    raf=requestAnimationFrame(scroll);
  });
  window.addEventListener("pointermove",e=>{if(!d||e.pointerId!==d.pid)return;e.preventDefault();d.x=e.clientX;d.y=e.clientY},{passive:false});
  function end(e,cancel){
    if(!d||(e&&e.pointerId!==d.pid))return;cancelAnimationFrame(raf);
    const day=d.ph.closest(".s-day[data-slot]");
    if(!cancel&&day){
      const slot=day.dataset.slot,idx=[...day.querySelectorAll(".s-sess,.s-ph")].filter(x=>x!==d.row).indexOf(d.ph);
      const w=week();SLOTS.forEach(([sl])=>{w.days[sl]=w.days[sl].filter(x=>x!==d.id)});w.days[slot].splice(Math.max(0,idx),0,d.id);saveWeek(w);
    }
    d.ghost.remove();d.ph.remove();document.body.classList.remove("s-isdrag");d=null;P.render();
  }
  window.addEventListener("pointerup",e=>end(e,false));
  window.addEventListener("pointercancel",e=>end(e,true));
})();

return {init,weekTotal,logFree,countGame,matchSession,title:id=>SESS[id]?SESS[id].title:id,weekCard,sessView,runView,sumView,runBar,homeCard,running,addGame,act,paint};
})();
