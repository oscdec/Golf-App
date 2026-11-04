/* Rounds tab: courses and tees, blind hole-by-hole scoring, Tiger 6, GIR+1, penalties, feel tags,
   best 3 shots, results and handicap. Screens are sub-routes of #rounds (e.g. #rounds/play) so the
   phone's back button works. While a round is in progress, no par, total or score-to-par is shown. */
(()=>{
const root=document.getElementById("roundsRoot");if(!root)return;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);

let courses=Store.get("courses",[]),rounds=Store.get("rounds",[]),tags=Store.get("tags",[]),past=Store.get("pastScores",[]);
const saveCourses=()=>Store.set("courses",courses),saveRounds=()=>Store.set("rounds",rounds),
  saveTags=()=>Store.set("tags",tags),savePast=()=>Store.set("pastScores",past);

const T6=[["d","D","Bad drive"],["t","T","Bad tee shot, not driver"],["m","115","Missed green inside 115"],["dc","DC","Double chip"]];
const CODES=[["d","D"],["t","T"],["m","115"],["dc","DC"],["p3","3p"],["five","5"]];

/* ---------- data helpers ---------- */
const active=()=>rounds.find(r=>r.status==="active");
const courseOf=id=>courses.find(c=>c.id===id);
function teeOf(r){const c=courseOf(r.cid),t=c&&c.tees.find(x=>x.id===r.tid);return t?{course:c,tee:t}:null}
const teeUsed=tid=>rounds.some(r=>r.tid===tid);
const holeDone=h=>h&&h.g!=null&&h.p!=null;
const toPar=d=>d===0?"E":d>0?"+"+d:"−"+(-d);
const newHole=()=>({g:null,p:null,pen:0,d:0,t:0,m:0,dc:0});

function stats(r){
  const tt=teeOf(r);if(!tt)return null;const {tee}=tt;
  const H=r.holes.map((h,i)=>{const par=tee.par[i],done=holeDone(h),score=done?h.g+h.p:null;
    return {i,par,si:tee.si[i],done,score,g:h.g,p:h.p,pen:h.pen||0,d:!!h.d,t:!!h.t,m:!!h.m,dc:!!h.dc,
      p3:done&&h.p>=3,five:done&&par===5&&score>5,gir1:done&&h.g<=par-1}});
  const done=H.filter(h=>h.done),T={};CODES.forEach(([k,c])=>T[c]=sum(H,h=>h[k]?1:0));
  return {H,complete:done.length===18,played:done.length,score:sum(done,h=>h.score),par:sum(done,h=>h.par),
    out:sum(done.filter(h=>h.i<9),h=>h.score),inn:sum(done.filter(h=>h.i>=9),h=>h.score),
    putts:sum(done,h=>h.p),pen:sum(H,h=>h.pen),gir1:sum(H,h=>h.gir1?1:0),T,t6:Object.values(T).reduce((a,b)=>a+b,0)};
}
function hcp(){
  const e=past.map(p=>({key:"p:"+p.id,date:p.date,order:0,diff:p.diff}));
  rounds.forEach(r=>{if(r.status!=="done")return;const tt=teeOf(r),s=stats(r);if(!tt||!s.complete)return;
    e.push({key:r.id,date:r.date,order:r.finishedAt||1,scores:s.H.map(h=>h.score),pars:tt.tee.par,sis:tt.tee.si,
      rating:tt.tee.rating,slope:tt.tee.slope,pcc:r.pcc})});
  return Handicap.compute(e);
}

/* ---------- routing ---------- */
const route=()=>{const h=location.hash.slice(1);return h==="rounds"||h.startsWith("rounds/")?h.split("/").slice(1):null};
const go=(p,replace)=>{const h="#rounds"+(p?"/"+p:"");if(replace)location.replace(h);else location.hash=h};
let draft=null,form=null,formKey="",returnTo="";

function render(){
  const p=route();if(!p)return;const [a,b,c]=p;let html;
  if(!a||a==="courses")returnTo="";
  switch(a){
    case undefined:case "":html=home();break;
    case "new":html=setup();break;
    case "play":{const r=active();if(!r){go("",true);return}html=play(r,false);break}
    case "edit":{const r=rounds.find(x=>x.id===b);if(!r){go("",true);return}html=play(r,true);break}
    case "finish":{const r=active();if(!r){go("",true);return}html=finish(r);break}
    case "r":{const r=rounds.find(x=>x.id===b);if(!r||r.status!=="done"){go("",true);return}html=detail(r,c==="saved");break}
    case "courses":html=courseList();break;
    case "course":html=teeForm("course:new");break;
    case "tee":html=teeForm(b==="new"?"tee:new:"+c:"tee:"+b+":"+c);break;
    case "tags":html=tagScreen();break;
    case "past":html=pastScreen();break;
    default:go("",true);return;
  }
  root.innerHTML=html;
}
const back=(href,label)=>`<a class="r-back" href="#rounds${href?"/"+href:""}">‹ ${esc(label)}</a>`;

/* ---------- home ---------- */
function home(){
  const h=hcp(),r=active(),hist=h.history.filter(x=>x.index!=null);
  let hc;
  if(h.index!=null){
    const prev=hist.length>1?hist[hist.length-2].index:null,ch=prev==null?"":(h.index-prev);
    const chTxt=ch===""||Math.abs(ch)<.05?"":`<span class="r-chg ${ch<0?"dn":"up"}">${ch<0?"▼":"▲"} ${Math.abs(ch).toFixed(1)}</span>`;
    hc=`<div class="r-big">${h.index<0?"+"+(-h.index).toFixed(1):h.index.toFixed(1)}${chTxt}</div>
      <p class="hint">Average of your best ${h.used} of the last ${Math.min(h.count,20)} scores. An estimate; GHIN is the official number.</p>`;
  }else{
    hc=`<div class="r-big muted">—</div><p class="hint">Needs 3 scores; you have ${h.count}. Add your recent scores from GHIN to start with your real index.</p>`;
  }
  const done=rounds.filter(x=>x.status==="done").sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.finishedAt||0)-(a.finishedAt||0));
  const rows=done.map(x=>{const tt=teeOf(x),s=stats(x),d=h.per[x.id];
    return `<button class="r-row" data-act="open" data-id="${x.id}">
      <span class="r-date">${esc(Store.fmtDate(x.date,{month:"short",day:"numeric"}))}<small>${esc(x.date.slice(0,4))}</small></span>
      <span class="r-name">${esc(tt?tt.course.name:"Deleted course")}<small>${esc(tt?tt.tee.name+" tees":"")}${s&&!s.complete?" · "+s.played+" holes":""}</small></span>
      <span class="r-score">${s?s.score:"—"}<small>${s&&s.played?toPar(s.score-s.par):""}${d?" · "+d.diff.toFixed(1):""}</small></span></button>`}).join("");
  const n=Backup.since();
  return `<header><h1>Rounds</h1></header>
  ${r?activeCard(r):`<button class="play r-wide" data-act="new">New round</button>`}
  <section class="panel r-hcp"><div class="label">Handicap index</div>${hc}</section>
  ${n>=3?`<a class="panel r-nudge" href="#insights">You've played ${n} rounds since your last backup. <b>Back up now ›</b></a>`:""}
  <section class="r-list"><div class="label">Played</div>${rows||`<p class="hint">No rounds yet. Your finished rounds show here.</p>`}</section>
  <nav class="r-links"><a href="#rounds/courses">Courses</a><a href="#rounds/tags">Feel tags</a><a href="#rounds/past">Past GHIN scores${past.length?" ("+past.length+")":""}</a></nav>`;
}
function activeCard(r){
  const tt=teeOf(r),n=r.holes.filter(holeDone).length;
  return `<section class="panel r-active"><span class="pill live">In progress</span>
    <div class="r-title">${esc(tt?tt.course.name:"")}<small>${esc(tt?tt.tee.name+" tees · ":"")}${esc(Store.fmtDate(r.date))}</small></div>
    <p class="hint">On hole ${(r.cur||0)+1} · ${n} of 18 holes entered</p>
    <div class="row"><button class="play" data-act="resume">Resume</button><button class="ghost" data-act="discard">Discard round</button></div></section>`;
}

/* ---------- new round ---------- */
function setup(){
  if(!draft){const last=[...rounds].filter(x=>x.status==="done").sort((a,b)=>(b.finishedAt||0)-(a.finishedAt||0))[0];
    draft={cid:null,tid:null,date:Store.today(),tags:[]};
    if(last&&teeOf(last)){draft.cid=last.cid;draft.tid=last.tid}
    else if(courses.length===1){draft.cid=courses[0].id;if(courses[0].tees.length===1)draft.tid=courses[0].tees[0].id}}
  const c=courseOf(draft.cid);if(!c)draft.cid=null;if(c&&!c.tees.some(t=>t.id===draft.tid))draft.tid=null;
  const copts=courses.map(x=>`<button class="r-opt" data-act="pickc" data-id="${x.id}" aria-pressed="${x.id===draft.cid}">${esc(x.name)}</button>`).join("");
  const topts=c?c.tees.map(t=>`<button class="r-opt" data-act="pickt" data-id="${t.id}" aria-pressed="${t.id===draft.tid}">${esc(t.name)}<small>${t.rating.toFixed(1)} / ${t.slope}</small></button>`).join(""):"";
  return `${back("","Rounds")}<header><h1>New round</h1></header>
  <section class="panel r-form">
    <div class="r-field"><div class="label">Course</div><div class="r-opts">${copts}<button class="r-opt add" data-act="addcourse">+ Add a course</button></div>
      ${courses.length?"":`<p class="hint">First time at a course? Add it with the par and handicap index of each hole from the scorecard, plus the course rating and slope for your tees. You only do this once.</p>`}</div>
    ${c?`<div class="r-field"><div class="label">Tees</div><div class="r-opts">${topts}<button class="r-opt add" data-act="addtee">+ Add tees</button></div></div>`:""}
    <div class="r-field"><label class="label" for="rDate">Date</label><input class="r-input" type="date" id="rDate" data-draft="date" value="${esc(draft.date)}" max="${Store.today()}"></div>
    <div class="r-field"><div class="label">Feels for today <span class="opt">optional</span></div>${tagPicker(draft.tags)}</div>
  </section>
  <button class="play r-wide" data-act="start" ${draft.tid?"":"disabled"}>Start round</button>
  <p class="hint r-center">Your score and pars stay hidden until the round is saved.</p>`;
}
function tagPicker(sel){
  const chips=tags.map(t=>`<button class="r-tag" data-act="tag" data-tag="${esc(t)}" aria-pressed="${sel.includes(t)}">${esc(t)}</button>`).join("");
  return `<div class="r-tags">${chips}</div><div class="r-addtag"><input class="r-input" maxlength="40" placeholder="New feel, e.g. quiet hands" aria-label="New feel tag"><button class="ghost" data-act="addtag">Add</button></div>`;
}

/* ---------- hole entry ---------- */
function nums(act,vals,cur,more){
  let s=vals.map(v=>`<button class="r-num" data-act="${act}" data-v="${v}" aria-pressed="${cur===v}">${v}</button>`).join("");
  if(more){const on=cur!=null&&cur>=more;s+=`<button class="r-num" data-act="${act}more" aria-pressed="${on}">${on?cur:more+"+"}</button>`}
  return `<div class="r-nums">${s}</div>`;
}
function play(r,editing){
  const tt=teeOf(r),i=Math.max(0,Math.min(17,r.cur||0)),h=r.holes[i];
  const dots=r.holes.map((x,k)=>`<button class="r-dot${holeDone(x)?" ok":""}" data-act="hole" data-h="${k}" ${k===i?'aria-current="true"':""} aria-label="Hole ${k+1}">${k+1}</button>`).join("");
  const info=editing&&tt?`<div class="r-parinfo">Par ${tt.tee.par[i]} · Index ${tt.tee.si[i]}</div>`:"";
  const t6=T6.map(([k,c,l])=>`<button class="r-t6" data-act="t6" data-k="${k}" aria-pressed="${!!h[k]}"><b>${c}</b><span>${l}</span></button>`).join("");
  const last=i===17;
  const next=last?(editing?`<button class="play" data-act="editdone">Done</button>`:`<button class="play" data-act="tofinish">Finish round</button>`)
    :`<button class="play" data-act="next">Hole ${i+2} ›</button>`;
  return `${editing?back("r/"+r.id,"Round"):back("","Rounds")}
  <div class="r-playhead"><div><div class="label">${esc(tt?tt.course.name+" · "+tt.tee.name:"")}</div><h1>Hole ${i+1}</h1></div>${info}</div>
  <div class="r-dots">${dots}</div>
  <section class="panel r-hole">
    <div class="r-field"><div class="label">Shots to reach the green</div>${nums("g",[1,2,3,4,5,6,7,8,9],h.g,10)}
      <p class="hint">Include penalty strokes. Holed out from off the green? Count that shot here and pick 0 putts.</p></div>
    <div class="r-field"><div class="label">Putts</div>${nums("p",[0,1,2,3,4,5],h.p,6)}</div>
    <div class="r-field"><div class="label">Penalty strokes</div>${nums("pen",[0,1,2,3,4],h.pen||0)}</div>
    <div class="r-holescore">${holeDone(h)?`Hole score <b>${h.g+h.p}</b>`:`<span class="hint">Pick shots to the green and putts.</span>`}</div>
  </section>
  <section class="panel r-hole"><div class="label">Tiger 6 mistakes on this hole</div><div class="r-t6s">${t6}</div>
    <p class="hint">3-putts and over-par par 5s are counted for you.</p></section>
  <div class="r-pager">${i>0?`<button class="ghost" data-act="prev">‹ Hole ${i}</button>`:"<span></span>"}${next}</div>
  ${editing?"":`<p class="hint r-center">Saved as you go. You can leave and resume any time.</p>`}`;
}

/* ---------- finish ---------- */
function finish(r){
  const miss=r.holes.map((h,i)=>holeDone(h)?null:i).filter(x=>x!=null);
  const best=[0,1,2].map(k=>`<label class="r-best"><span>${k+1}</span><textarea class="r-input" rows="2" data-best="${k}" maxlength="200" placeholder="${["e.g. 7-iron to 6 feet on 14","e.g. Flop over the bunker on 6","e.g. 30-footer that dropped on 18"][k]}">${esc((r.best||[])[k]||"")}</textarea></label>`).join("");
  return `${back("play","Hole 18")}<header><h1>Wrap up</h1></header>
  ${miss.length?`<section class="panel r-warn"><b>No score yet on hole${miss.length>1?"s":""} ${miss.map(i=>i+1).join(", ")}.</b>
    <div class="r-opts">${miss.slice(0,9).map(i=>`<button class="r-opt" data-act="jump" data-h="${i}">Hole ${i+1}</button>`).join("")}</div></section>`:""}
  <section class="panel r-form"><div class="r-field"><div class="label">Feels you played with</div>${tagPicker(r.tags||[])}</div></section>
  <section class="panel r-form"><div class="label">Your best 3 shots today</div>${best}<p class="hint">End on a high note.</p></section>
  <button class="play r-wide" data-act="save">Save round</button>`;
}

/* ---------- results ---------- */
function scorecard(s,from){
  const hs=s.H.slice(from,from+9),lab=from?"In":"Out";
  const row=(name,f,tot,cls)=>`<tr${cls?` class="${cls}"`:""}><th>${name}</th>${hs.map(f).join("")}<td class="tot">${tot}</td></tr>`;
  const sc=h=>{if(!h.done)return `<td>·</td>`;const d=h.score-h.par;return `<td class="${d<0?"u":d>=2?"o2":d===1?"o1":""}">${h.score}</td>`};
  const codes=h=>`<td class="codes">${CODES.filter(([k])=>h[k]).map(([,c])=>c).join("<br>")}</td>`;
  return `<table class="r-card">
    ${row("Hole",h=>`<td>${h.i+1}</td>`,lab,"hd")}
    ${row("Par",h=>`<td>${h.par}</td>`,sum(hs,h=>h.par),"par")}
    ${row("Score",sc,sum(hs.filter(h=>h.done),h=>h.score),"sc")}
    ${row("Putts",h=>`<td>${h.done?h.p:""}</td>`,sum(hs.filter(h=>h.done),h=>h.p))}
    ${row("GIR+1",h=>`<td>${h.gir1?"●":""}</td>`,sum(hs,h=>h.gir1?1:0))}
    ${row("Pen",h=>`<td>${h.pen||""}</td>`,sum(hs,h=>h.pen)||"")}
    ${row("T6",codes,sum(hs,h=>CODES.filter(([k])=>h[k]).length),"t6")}
  </table>`;
}
function detail(r,saved){
  const tt=teeOf(r),s=stats(r);if(!s)return `${back("","Rounds")}<p>This round's course was deleted.</p>`;
  const h=hcp(),d=h.per[r.id];
  const tile=(l,v,sub)=>`<div class="stat"><div class="label">${l}</div><div class="v">${v}</div>${sub?`<div class="hint">${sub}</div>`:""}</div>`;
  const t6=CODES.map(([,c])=>`<span class="r-code${s.T[c]?" on":""}"><b>${c}</b>${s.T[c]}</span>`).join("");
  const best=(r.best||[]).filter(x=>x&&x.trim());
  const pcc=[["","Not set"],["-1","−1"],["0","0"],["1","+1"],["2","+2"],["3","+3"]]
    .map(([v,l])=>`<option value="${v}" ${String(r.pcc??"")===v?"selected":""}>${l}</option>`).join("");
  const n=Backup.since();
  return `${back("","Rounds")}
  ${saved?`<div class="r-celebrate">Round saved. Here's how it went.</div>`:""}
  <section class="panel r-sum">
    <div class="label">${esc(Store.fmtDate(r.date,{weekday:"short",month:"short",day:"numeric",year:"numeric"}))} · ${esc(tt.course.name)} · ${esc(tt.tee.name)}</div>
    <div class="r-scoreline"><span class="r-big">${s.score}</span><span class="r-topar">${s.played?toPar(s.score-s.par):""}</span>
      ${s.complete?"":`<span class="pill">${s.played} of 18 holes</span>`}</div>
    <div class="stats r-stats">
      ${tile("Out / In",`${s.out} / ${s.inn}`)}${tile("Putts",s.putts)}${tile("GIR+1",`${s.gir1} / ${s.played}`)}${tile("Penalties",s.pen)}
      ${tile("Tiger 6",s.t6)}${tile("Differential",d?d.diff.toFixed(1):"—",d?(r.pcc==null?"PCC not set":"PCC "+(r.pcc>0?"+":"")+r.pcc):"Not used for handicap")}
      ${tile("Course hcp",d&&d.ch!=null?d.ch:"—")}${tile("Index after",d&&d.indexAfter!=null?d.indexAfter.toFixed(1):"—")}
    </div>
  </section>
  <section class="panel"><div class="label">Tiger 6</div><div class="r-codes">${t6}</div></section>
  ${best.length?`<section class="panel r-bestlist"><div class="label">Best 3 shots</div><ol>${best.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></section>`:""}
  ${(r.tags||[]).length?`<section class="panel"><div class="label">Feels</div><div class="r-tags">${r.tags.map(t=>`<span class="r-tag static">${esc(t)}</span>`).join("")}</div></section>`:""}
  <section class="panel r-cardwrap"><div class="label">Scorecard</div>${scorecard(s,0)}${scorecard(s,9)}</section>
  <section class="panel r-form"><div class="r-field"><label class="label" for="rPcc">Playing conditions (PCC) from GHIN</label>
    <select id="rPcc" data-pcc="${r.id}">${pcc}</select><p class="hint">Add it once GHIN posts it, usually the next day. Your differential updates.</p></div></section>
  ${saved&&n?`<section class="panel r-form"><div class="label">Back up</div><p class="hint">${esc(Backup.statusText())}</p><div class="row"><button class="play" data-act="backup">Save backup</button></div></section>`:""}
  <div class="row r-actions"><button class="ghost" data-act="edit" data-id="${r.id}">Edit holes</button><button class="ghost danger" data-act="delround" data-id="${r.id}">Delete round</button></div>`;
}

/* ---------- courses and tees ---------- */
function courseList(){
  const list=courses.map(c=>{const used=c.tees.some(t=>teeUsed(t.id));
    return `<section class="panel r-course"><div class="r-title">${esc(c.name)}</div>
    ${c.tees.map(t=>`<div class="r-teerow"><span>${esc(t.name)}<small>${t.rating.toFixed(1)} / ${t.slope} · Par ${t.par.reduce((a,b)=>a+b,0)}</small></span>
      <a class="ghost sm" href="#rounds/tee/${c.id}/${t.id}">Edit</a>${teeUsed(t.id)?"":`<button class="ghost sm" data-act="deltee" data-c="${c.id}" data-id="${t.id}">Remove</button>`}</div>`).join("")}
    <div class="row"><a class="ghost sm" href="#rounds/tee/new/${c.id}">+ Add tees</a>${used?"":`<button class="ghost sm danger" data-act="delcourse" data-id="${c.id}">Remove course</button>`}</div></section>`}).join("");
  return `${back("","Rounds")}<header><h1>Courses</h1></header>${list||`<p class="hint">No courses yet.</p>`}
  <a class="play r-wide" href="#rounds/course">+ Add a course</a>
  <p class="hint">Tees you've played can be edited (to fix a typo) but not removed. Edits apply to rounds already played on them.</p>`;
}
function teeForm(key){
  if(formKey!==key||!form){
    formKey=key;const [kind,x,y]=key.split(":");
    form={kind,cid:null,tid:null,name:"",tee:"",rating:"",slope:"",par:Array(18).fill(null),si:Array(18).fill("")};
    if(kind==="tee"&&x==="new"){form.cid=y;form.name=courseOf(y)?.name||""}
    else if(kind==="tee"){const c=courseOf(x),t=c&&c.tees.find(z=>z.id===y);
      if(c&&t)Object.assign(form,{cid:c.id,tid:t.id,name:c.name,tee:t.name,rating:String(t.rating),slope:String(t.slope),par:[...t.par],si:t.si.map(String)})}
  }
  const f=form,title=f.tid?"Edit tees":f.cid?"Add tees":"Add a course";
  const rows=f.par.map((p,i)=>`<div class="r-hrow"><span class="r-hn">${i+1}</span>
    <div class="seg r-par" role="group" aria-label="Par for hole ${i+1}">${[3,4,5].map(v=>`<button data-act="par" data-h="${i}" data-v="${v}" aria-pressed="${p===v}">${v}</button>`).join("")}</div>
    <input class="r-input r-si" inputmode="numeric" pattern="[0-9]*" maxlength="2" data-si="${i}" value="${esc(f.si[i])}" aria-label="Handicap index for hole ${i+1}" placeholder="–"></div>`).join("");
  const tp=f.par.every(x=>x)?f.par.reduce((a,b)=>a+b,0):"";
  return `${back(returnTo||"courses",returnTo==="new"?"New round":"Courses")}<header><h1>${title}</h1></header>
  <div class="panel r-warn" id="rErr" hidden></div>
  <section class="panel r-form">
    <div class="r-field"><label class="label" for="fName">Course name</label><input class="r-input" id="fName" data-f="name" value="${esc(f.name)}" maxlength="60" ${f.cid&&!f.tid?"readonly":""}></div>
    <div class="r-field"><label class="label" for="fTee">Tees</label><input class="r-input" id="fTee" data-f="tee" value="${esc(f.tee)}" maxlength="30" placeholder="e.g. Blue"></div>
    <div class="r-two">
      <div class="r-field"><label class="label" for="fRating">Course rating</label><input class="r-input" id="fRating" data-f="rating" inputmode="decimal" value="${esc(f.rating)}" placeholder="e.g. 71.4"></div>
      <div class="r-field"><label class="label" for="fSlope">Slope</label><input class="r-input" id="fSlope" data-f="slope" inputmode="numeric" value="${esc(f.slope)}" placeholder="e.g. 131"></div>
    </div>
  </section>
  <section class="panel r-form"><div class="r-hrow r-hhead"><span class="label">Hole</span><span class="label">Par</span><span class="label">Index</span></div>
    ${rows}<div class="r-hrow r-hhead"><span class="label">Total</span><span class="label" id="fParTot">${tp?"Par "+tp:""}</span><span></span></div>
    <p class="hint">Index is the hole's handicap ranking on the scorecard (1 = hardest, 18 = easiest).</p></section>
  <button class="play r-wide" data-act="savetee">Save</button>`;
}
function saveTee(){
  const f=form,errs=[];
  const name=f.name.trim(),tee=f.tee.trim(),rating=parseFloat(String(f.rating).replace(",",".")),slope=parseInt(f.slope,10);
  const si=f.si.map(v=>parseInt(v,10));
  if(!name)errs.push("Enter the course name.");
  if(!tee)errs.push("Enter the tees, e.g. Blue.");
  if(!(rating>=50&&rating<=85))errs.push("Course rating should be a number like 71.4.");
  if(!(slope>=55&&slope<=155))errs.push("Slope should be a whole number from 55 to 155.");
  const noPar=f.par.map((p,i)=>p?null:i+1).filter(Boolean);if(noPar.length)errs.push("Pick a par for hole "+noPar.join(", ")+".");
  const bad=si.map((v,i)=>v>=1&&v<=18?null:i+1).filter(Boolean);
  if(bad.length)errs.push("Enter an index from 1 to 18 for hole "+bad.join(", ")+".");
  else{const dup=[...new Set(si.filter((v,i)=>si.indexOf(v)!==i))];if(dup.length)errs.push("Each index 1–18 is used once; "+dup.join(", ")+" appears twice.");}
  const box=document.getElementById("rErr");
  if(errs.length){box.innerHTML=errs.map(esc).join("<br>");box.hidden=false;box.scrollIntoView({behavior:"smooth",block:"center"});return}
  let c=courseOf(f.cid);
  if(!c){c={id:Store.uid(),name,tees:[]};courses.push(c)}else c.name=name;
  const data={name:tee,rating:Math.round(rating*10)/10,slope,par:[...f.par],si};
  let tid=f.tid;
  if(tid){Object.assign(c.tees.find(t=>t.id===tid),data)}else{tid=Store.uid();c.tees.push({id:tid,...data})}
  saveCourses();form=null;formKey="";
  if(returnTo==="new"&&draft){draft.cid=c.id;draft.tid=tid}
  const to=returnTo||"courses";returnTo="";go(to,true);
}

/* ---------- feel tags and past scores ---------- */
function tagScreen(){
  return `${back("","Rounds")}<header><h1>Feel tags</h1></header>
  <section class="panel r-form"><p class="hint">Short names for the swing feels you play with. Pick them when you start or finish a round, so Insights can compare them with your scores.</p>
  ${tags.map(t=>`<div class="r-teerow"><span>${esc(t)}</span><button class="ghost sm" data-act="deltag" data-tag="${esc(t)}">Remove</button></div>`).join("")||`<p class="hint">No tags yet.</p>`}
  <div class="r-addtag"><input class="r-input" maxlength="40" placeholder="New feel, e.g. quiet hands" aria-label="New feel tag"><button class="ghost" data-act="addtag">Add</button></div>
  <p class="hint">Removing a tag keeps it on rounds that already used it.</p></section>`;
}
function pastScreen(){
  const list=[...past].sort((a,b)=>a.date<b.date?1:-1).map(p=>`<div class="r-teerow"><span>${esc(Store.fmtDate(p.date))}<small>Differential ${(+p.diff).toFixed(1)}</small></span><button class="ghost sm" data-act="delpast" data-id="${p.id}">Remove</button></div>`).join("");
  return `${back("","Rounds")}<header><h1>Past GHIN scores</h1></header>
  <section class="panel r-form"><p class="hint">So your index here matches GHIN from day one: in the GHIN app, open your score history and add your most recent 20 scores, each with its date and differential. Only add scores from before you started entering rounds here.</p>
  <div class="r-two"><div class="r-field"><label class="label" for="pDate">Date</label><input class="r-input" type="date" id="pDate" max="${Store.today()}"></div>
  <div class="r-field"><label class="label" for="pDiff">Differential</label><input class="r-input" id="pDiff" inputmode="decimal" placeholder="e.g. 12.4"></div></div>
  <button class="play" data-act="addpast">Add score</button><p class="hint" id="pMsg"></p></section>
  ${list?`<section class="panel r-form"><div class="label">${past.length} score${past.length>1?"s":""}</div>${list}</section>`:""}`;
}

/* ---------- actions ---------- */
function playRound(){const p=route();return p&&p[0]==="play"?active():p&&p[0]==="edit"?rounds.find(r=>r.id===p[1]):null}
function setHole(fn){const r=playRound();if(!r)return;fn(r.holes[Math.max(0,Math.min(17,r.cur||0))]);saveRounds();render()}
function ask(label,min,max){const v=parseInt(prompt(label,""),10);return v>=min&&v<=max?v:null}
function tagTarget(){const p=route();if(!p)return null;if(p[0]==="new")return draft?draft.tags:null;if(p[0]==="finish"){const r=active();if(r){r.tags=r.tags||[];return r.tags}}return null}
function addTag(btn){
  const inp=btn.closest(".r-addtag").querySelector("input"),v=inp.value.trim().replace(/\s+/g," ");if(!v)return;
  if(!tags.some(t=>t.toLowerCase()===v.toLowerCase())){tags.push(v);saveTags()}
  const t=tags.find(x=>x.toLowerCase()===v.toLowerCase()),sel=tagTarget();
  if(sel&&!sel.includes(t)){sel.push(t);if(route()[0]==="finish")saveRounds()}
  render();
}
const act={
  new(){draft=null;go("new")},
  resume(){go("play")},
  discard(){if(confirm("Discard this round? Everything entered for it will be deleted.")){rounds=rounds.filter(r=>r.status!=="active");saveRounds();render()}},
  open(el){go("r/"+el.dataset.id)},
  pickc(el){draft.cid=el.dataset.id;const c=courseOf(draft.cid);draft.tid=c&&c.tees.length===1?c.tees[0].id:null;render()},
  pickt(el){draft.tid=el.dataset.id;render()},
  addcourse(){returnTo="new";form=null;formKey="";go("course")},
  addtee(){returnTo="new";form=null;formKey="";go("tee/new/"+draft.cid)},
  tag(el){const sel=tagTarget();if(!sel)return;const t=el.dataset.tag,k=sel.indexOf(t);if(k>=0)sel.splice(k,1);else sel.push(t);if(route()[0]==="finish")saveRounds();render()},
  addtag(el){addTag(el)},
  start(){
    if(!draft||!draft.tid)return;if(active()){go("play",true);return}
    const r={id:Store.uid(),date:draft.date||Store.today(),cid:draft.cid,tid:draft.tid,tags:[...draft.tags],best:["","",""],
      holes:Array.from({length:18},newHole),status:"active",cur:0,pcc:null,startedAt:Date.now()};
    rounds.push(r);saveRounds();draft=null;go("play",true);
  },
  g(el){setHole(h=>h.g=+el.dataset.v)},
  gmore(){const v=ask("Shots to reach the green",1,30);if(v!=null)setHole(h=>h.g=v)},
  p(el){setHole(h=>h.p=+el.dataset.v)},
  pmore(){const v=ask("Putts",0,15);if(v!=null)setHole(h=>h.p=v)},
  pen(el){setHole(h=>h.pen=+el.dataset.v)},
  t6(el){const k=el.dataset.k;setHole(h=>h[k]=h[k]?0:1)},
  hole(el){const r=playRound();if(r){r.cur=+el.dataset.h;saveRounds();render()}},
  prev(){const r=playRound();if(r){r.cur=Math.max(0,(r.cur||0)-1);saveRounds();render();window.scrollTo(0,0)}},
  next(){const r=playRound();if(r){r.cur=Math.min(17,(r.cur||0)+1);saveRounds();render();window.scrollTo(0,0)}},
  tofinish(){go("finish")},
  jump(el){const r=active();if(r){r.cur=+el.dataset.h;saveRounds();go("play")}},
  editdone(){const r=playRound();if(r)go("r/"+r.id,true)},
  save(){
    const r=active();if(!r)return;
    const miss=r.holes.map((h,i)=>holeDone(h)?null:i+1).filter(Boolean);
    if(miss.length&&!confirm(`Hole${miss.length>1?"s":""} ${miss.join(", ")} ha${miss.length>1?"ve":"s"} no score. Save anyway? This round won't count toward your handicap.`))return;
    if(!(r.best||[]).some(x=>x&&x.trim())&&!confirm("Save without your best 3 shots?"))return;
    r.status="done";r.finishedAt=Date.now();r.best=(r.best||[]).map(x=>(x||"").trim());saveRounds();go("r/"+r.id+"/saved",true);
  },
  backup(){Backup.download();render()},
  edit(el){const r=rounds.find(x=>x.id===el.dataset.id);if(r){r.cur=0;saveRounds();go("edit/"+r.id)}},
  delround(el){if(confirm("Delete this round for good?")){rounds=rounds.filter(r=>r.id!==el.dataset.id);saveRounds();go("",true)}},
  par(el){const i=+el.dataset.h,v=+el.dataset.v;form.par[i]=v;
    el.parentElement.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b===el));
    const tot=document.getElementById("fParTot");if(tot)tot.textContent=form.par.every(x=>x)?"Par "+form.par.reduce((a,b)=>a+b,0):""},
  savetee(){saveTee()},
  deltee(el){const c=courseOf(el.dataset.c);if(!c||teeUsed(el.dataset.id)||!confirm("Remove these tees?"))return;
    c.tees=c.tees.filter(t=>t.id!==el.dataset.id);saveCourses();render()},
  delcourse(el){const c=courseOf(el.dataset.id);if(!c||c.tees.some(t=>teeUsed(t.id))||!confirm(`Remove ${c.name}?`))return;
    courses=courses.filter(x=>x!==c);saveCourses();render()},
  deltag(el){tags=tags.filter(t=>t!==el.dataset.tag);saveTags();render()},
  addpast(){
    const d=document.getElementById("pDate").value,v=parseFloat(String(document.getElementById("pDiff").value).replace(",","."));
    const msg=document.getElementById("pMsg");
    if(!d){msg.textContent="Pick the date of the score.";return}
    if(!(v>=-10&&v<=60)){msg.textContent="Enter the differential, e.g. 12.4.";return}
    past.push({id:Store.uid(),date:d,diff:Math.round(v*10)/10});savePast();render();
    const m=document.getElementById("pMsg");if(m)m.textContent="Added. Next one?";document.getElementById("pDiff")?.focus();
  },
  delpast(el){past=past.filter(p=>p.id!==el.dataset.id);savePast();render()},
};
root.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||!root.contains(el))return;const f=act[el.dataset.act];if(f){e.preventDefault();f(el)}});
root.addEventListener("input",e=>{const el=e.target;
  if(el.dataset.f&&form)form[el.dataset.f]=el.value;
  else if(el.dataset.si!=null&&form)form.si[+el.dataset.si]=el.value.replace(/\D/g,"");
  else if(el.dataset.best!=null){const r=active();if(r){r.best=r.best||["","",""];r.best[+el.dataset.best]=el.value;saveRounds()}}
  else if(el.dataset.draft&&draft)draft[el.dataset.draft]=el.value;
});
root.addEventListener("change",e=>{const el=e.target;
  if(el.dataset.pcc){const r=rounds.find(x=>x.id===el.dataset.pcc);if(r){r.pcc=el.value===""?null:+el.value;saveRounds();render()}}
});
root.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.closest(".r-addtag")){e.preventDefault();addTag(e.target)}});

window.addEventListener("hashchange",render);
render();
})();
