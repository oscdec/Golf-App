/* Insights tab, in two views picked at the top (saved in rg.insightsView):
   Course: round stats (handicap index, scores, Tiger 6, penalties, GIR+1, scoring by par type, scoring mix) from Rounds.
   Practice: the check-in answers before and after each session (last 60 days), practice time per week by discipline,
   game results over time (per variant, with the 12-game average to beat) and routine scores over time.
   Charts are hand-built SVG sized to the screen, with tap/drag tooltips and a "Show numbers" table. Redrawn whenever the tab is shown. */
(()=>{
const root=document.getElementById("insightsRoot");if(!root)return;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const COUNTS=[["r10","Last 10",10],["r20","Last 20",20],["r40","Last 40",40]];
const RANGES=[["3m","3 months",91],["6m","6 months",182],["1y","1 year",365],["2y","2 years",730],["all","All",0]];
let range=Store.get("insightsRange","1y");
let view=Store.get("insightsView","course");
let gamePick=null,routinePick=null;
const ROLL=12,ROLL_MIN=3;
const T6=[["D","Bad drive"],["T","Bad tee shot, not driver"],["115","Missed green inside 115"],["DC","Double chip"],["3p","Three-putt"],["5","Bogey or worse on a par 5"]];
let t6pick="all";
/* rolling average of f over all rounds, so the line is right at the start of any range */
const rolling=(full,f)=>full.map((_,i)=>i+1<ROLL_MIN?null:+(full.slice(Math.max(0,i-ROLL+1),i+1).reduce((a,r)=>a+f(r),0)/Math.min(ROLL,i+1)).toFixed(2));
const avgOf=(a,f)=>a.length?a.reduce((s,x)=>s+f(x),0)/a.length:0;
const short=d=>Store.fmtDate(d,{month:"short",day:"numeric"});
const long=d=>Store.fmtDate(d);
const sgn1=v=>(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(2);
function cutoff(){const r=RANGES.find(x=>x[0]===range);if(!r||!r[2])return "";const d=new Date();d.setDate(d.getDate()-r[2]);return Store.iso(d)}

/* ---------- line chart ---------- */
function nice(lo,hi,n){
  if(lo===hi){lo-=1;hi+=1}
  const raw=(hi-lo)/n,mag=Math.pow(10,Math.floor(Math.log10(raw))),step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=raw);
  const a=Math.floor(lo/step)*step,b=Math.ceil(hi/step)*step,t=[];for(let v=a;v<=b+step/2;v+=step)t.push(+v.toFixed(6));return t;
}
const charts=[];
function lineChart(id,{labels,series,fmt,tip}){
  const n=labels.length;
  const legend=series.length>1?`<div class="i-legend">${series.map(s=>`<span><i style="background:var(${s.color})"></i>${esc(s.name)}</span>`).join("")}</div>`:"";
  charts.push({kind:"line",id,labels,series,fmt,tip});
  return `${legend}<div class="i-chart" id="${id}" role="img" aria-label="${esc(series.map(s=>s.name).join(", "))} over ${n} rounds"></div>`;
}
function draw(c){
  if(c.kind==="ci")return drawCI(c);
  if(c.kind==="bars")return drawBars(c);
  const box=document.getElementById(c.id);if(!box)return;
  const W=Math.max(260,box.clientWidth),H=210,named=c.series.length>1,L=34,R=named?Math.min(120,14+Math.max(...c.series.filter(s=>!s.dotsOnly).map(s=>s.name.length))*6.3):14,T=12,B=26;
  const all=c.series.flatMap(s=>s.vals).filter(v=>v!=null),ticks=nice(Math.min(...all),Math.max(...all),4);
  const y0=ticks[0],y1=ticks[ticks.length-1],n=c.labels.length;
  const X=i=>L+(n<2?(W-L-R)/2:i*(W-L-R)/(n-1)),Y=v=>T+(H-T-B)*(1-(v-y0)/(y1-y0||1));
  let g=ticks.map(t=>`<line x1="${L}" x2="${W-R}" y1="${Y(t)}" y2="${Y(t)}" class="i-grid"/><text x="${L-6}" y="${Y(t)+4}" class="i-ax" text-anchor="end">${c.fmt(t)}</text>`).join("");
  const xl=[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>a.indexOf(v)===i&&n>0);
  g+=xl.map(i=>`<text x="${X(i)}" y="${H-6}" class="i-ax" text-anchor="${i===0&&n>1?"start":i===n-1&&n>1?"end":"middle"}">${esc(short(c.labels[i]))}</text>`).join("");
  let lines="",ends=[];
  c.series.forEach(s=>{
    const pts=s.vals.map((v,i)=>v==null?null:[X(i),Y(v)]);
    if(s.dots)lines+=pts.filter(Boolean).map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(${s.color})" class="i-dot"/>`).join("");
    if(!s.dotsOnly){let d="";pts.forEach(p=>{if(p)d+=(d?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)});
      if(d)lines+=`<path d="${d}" fill="none" stroke="var(${s.color})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      if(n===1&&pts[0])lines+=`<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="4" fill="var(${s.color})"/>`}
    const last=[...pts].reverse().find(Boolean);if(named&&last&&!s.dotsOnly)ends.push({y:last[1],name:s.name,color:s.color});
  });
  ends.sort((a,b)=>a.y-b.y);for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<13)ends[i].y=ends[i-1].y+13;
  const lab=ends.map(e=>`<text x="${W-R+8}" y="${e.y+4}" class="i-end">${esc(e.name)}</text>`).join("");
  box.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}${lines}${lab}<line class="i-cross" y1="${T}" y2="${H-B}" x1="0" x2="0" visibility="hidden"/></svg><div class="i-tip" hidden></div>`;
  const svg=box.querySelector("svg"),cross=box.querySelector(".i-cross"),tipEl=box.querySelector(".i-tip");
  const show=e=>{const r=svg.getBoundingClientRect(),x=e.clientX-r.left;
    const i=n<2?0:Math.max(0,Math.min(n-1,Math.round((x-L)/((W-L-R)/(n-1)))));
    cross.setAttribute("x1",X(i));cross.setAttribute("x2",X(i));cross.setAttribute("visibility","visible");
    tipEl.innerHTML=`<b>${esc(long(c.labels[i]))}</b>`+c.series.map(s=>s.vals[i]==null?"":`<span><i style="background:var(${s.color})"></i>${esc(s.name)} <em>${c.tip(s.vals[i],s,i)}</em></span>`).join("");
    tipEl.hidden=false;const tw=tipEl.offsetWidth;tipEl.style.left=Math.max(0,Math.min(W-tw,X(i)-tw/2))+"px"};
  const hide=()=>{tipEl.hidden=true;cross.setAttribute("visibility","hidden")};
  svg.addEventListener("pointerdown",show);svg.addEventListener("pointermove",show);svg.addEventListener("pointerleave",hide);
}
function table(head,rows){
  return `<details class="i-table"><summary>Show numbers</summary><div class="i-scroll"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}
const empty=msg=>`<p class="hint i-empty">${esc(msg)}</p>`;

/* ---------- render ---------- */
function course(){
  if(!window.Rounds||!Rounds.list)return "";
  const full=Rounds.list();
  /* rolling average over all rounds, so the line is right at the start of any range */
  const rollAll=full.map((_,i)=>i+1<ROLL_MIN?null:+(full.slice(Math.max(0,i-ROLL+1),i+1).reduce((a,r)=>a+r.score,0)/Math.min(ROLL,i+1)).toFixed(1));
  const cnt=COUNTS.find(x=>x[0]===range);
  let from,keep;
  if(cnt){keep=full.map((r,i)=>i>=full.length-cnt[2]);from=full.length?full[Math.max(0,full.length-cnt[2])].date:"9999"}
  else{from=cutoff();keep=full.map(r=>!from||r.date>=from)}
  const list=full.filter((_,i)=>keep[i]),roll=rollAll.filter((_,i)=>keep[i]);
  /* handicap: a round-count filter means the last N scores, which includes past GHIN scores */
  const histAll=Rounds.history();
  const hist=cnt?histAll.slice(-cnt[2]):histAll.filter(h=>!from||h.date>=from);
  const btn=([k,l])=>`<button class="r-opt" data-range="${k}" aria-pressed="${k===range}">${l}</button>`;
  const filt=`<div class="i-ranges"><div class="r-opts i-range" role="group" aria-label="Number of rounds">${COUNTS.map(btn).join("")}</div>
    <div class="r-opts i-range" role="group" aria-label="Date range">${RANGES.map(btn).join("")}</div></div>`;

  /* handicap */
  let hc;
  if(hist.length<2)hc=empty(hist.length?"One index so far. The line appears from the second score.":"No handicap index yet in this range. It needs 3 scores (rounds or past GHIN scores).");
  else hc=lineChart("iHcp",{labels:hist.map(h=>h.date),series:[{name:"Handicap index",vals:hist.map(h=>h.index),color:"--s1"}],
      fmt:v=>v.toFixed(1),tip:v=>v.toFixed(1)})
    +`<p class="hint">${hist[0].index.toFixed(1)} → ${hist[hist.length-1].index.toFixed(1)} (${(hist[hist.length-1].index-hist[0].index>0?"+":"")+(hist[hist.length-1].index-hist[0].index).toFixed(1)}) over ${hist.length} scores.</p>`
    +table(["Date","Index"],[...hist].reverse().map(h=>[long(h.date),h.index.toFixed(1)]));

  /* scores */
  let sc;
  if(!list.length)sc=empty(cnt?"No finished 18-hole rounds yet.":"No finished 18-hole rounds in this range yet.");
  else{
    const scores=list.map(r=>r.score);
    const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
    sc=lineChart("iScore",{labels:list.map(r=>r.date),series:[{name:"Score",vals:scores,color:"--s2",dots:true,dotsOnly:true},{name:`${ROLL}-round avg`,vals:roll,color:"--s1"}],
        fmt:v=>String(Math.round(v)),tip:(v,s)=>s.dotsOnly?String(v):v.toFixed(1)})
      +`<p class="hint">Average ${avg.toFixed(1)} over ${scores.length} round${scores.length===1?"":"s"} · best ${Math.min(...scores)}. The line is the average of your last ${ROLL} rounds at each point (fewer until you've logged ${ROLL}).</p>`
      +table(["Date","Score","To par",`${ROLL}-rd avg`],[...list].map((r,i)=>[long(r.date),r.score,(r.score-r.par>0?"+":"")+(r.score-r.par),roll[i]==null?"–":roll[i].toFixed(1)]).reverse());
  }

  /* Tiger 6 */
  let t6;
  if(!list.length)t6=empty("Shows once you've finished a round in this range.");
  else{
    const f=t6pick==="all"?r=>r.t6total:r=>r.t6[t6pick]||0;
    const name=t6pick==="all"?"Tiger 6":t6pick;
    const rl=rolling(full,f).filter((_,i)=>keep[i]);
    const per=T6.map(([k,l])=>({k,l,avg:avgOf(list,r=>r.t6[k]||0),n:list.reduce((a,r)=>a+(r.t6[k]||0),0)})).sort((a,b)=>b.avg-a.avg);
    const max=Math.max(0.1,...per.map(x=>x.avg));
    const pick=`<div class="r-opts i-t6" role="group" aria-label="Mistake type">${[["all","All"],...T6].map(([k,l])=>`<button class="r-opt" data-t6="${k}" aria-pressed="${k===t6pick}" title="${esc(k==="all"?"All six":l)}">${esc(k==="all"?"All":k)}</button>`).join("")}</div>`;
    t6=pick+lineChart("iT6",{labels:list.map(r=>r.date),series:[{name:t6pick==="all"?"Mistakes":name,vals:list.map(f),color:"--s2",dots:true,dotsOnly:true},{name:`${ROLL}-round avg`,vals:rl,color:"--s1"}],
        fmt:v=>String(Math.round(v)),tip:(v,s)=>s.dotsOnly?String(v):v.toFixed(1)})
      +`<p class="hint">${t6pick==="all"?"All six mistakes":esc(T6.find(x=>x[0]===t6pick)[1])} per round: average ${avgOf(list,f).toFixed(1)} over ${list.length} round${list.length===1?"":"s"}. Tap a type above to see its trend.</p>`
      +`<div class="label i-sub">Average per round, by type</div>
      <div class="i-bars">${per.map(x=>`<div class="i-bar"><span class="i-bl" title="${esc(x.l)}">${esc(x.k)}</span><span class="i-track"><i style="width:${Math.max(x.avg?2:0,x.avg/max*100)}%"></i></span><span class="i-bv">${x.avg.toFixed(1)}</span></div>`).join("")}</div>
      <p class="hint">${T6.map(([k,l])=>`<b>${esc(k)}</b> ${esc(l.toLowerCase())}`).join(" · ")}.</p>`
      +table(["Date",...T6.map(x=>x[0]),"Total"],list.map(r=>[long(r.date),...T6.map(([k])=>r.t6[k]||0),r.t6total]).reverse());
  }

  /* penalties */
  let pn;
  if(!list.length)pn=empty("Shows once you've finished a round in this range.");
  else{
    const rl=rolling(full,r=>r.pen).filter((_,i)=>keep[i]);
    pn=lineChart("iPen",{labels:list.map(r=>r.date),series:[{name:"Penalty strokes",vals:list.map(r=>r.pen),color:"--s2",dots:true,dotsOnly:true},{name:`${ROLL}-round avg`,vals:rl,color:"--s1"}],
        fmt:v=>String(Math.round(v)),tip:(v,s)=>s.dotsOnly?String(v):v.toFixed(1)})
      +`<p class="hint">Penalty strokes per round: average ${avgOf(list,r=>r.pen).toFixed(1)} · ${list.filter(r=>!r.pen).length} of ${list.length} rounds with none.</p>`
      +table(["Date","Penalty strokes",`${ROLL}-rd avg`],list.map((r,i)=>[long(r.date),r.pen,rl[i]==null?"–":rl[i].toFixed(1)]).reverse());
  }

  /* GIR+1 */
  let gi;
  if(!list.length)gi=empty("Shows once you've finished a round in this range.");
  else{
    const rl=rolling(full,r=>r.gir1).filter((_,i)=>keep[i]);
    gi=lineChart("iGir",{labels:list.map(r=>r.date),series:[{name:"GIR+1",vals:list.map(r=>r.gir1),color:"--s2",dots:true,dotsOnly:true},{name:`${ROLL}-round avg`,vals:rl,color:"--s1"}],
        fmt:v=>String(Math.round(v)),tip:(v,s)=>(s.dotsOnly?String(v):v.toFixed(1))+" of 18"})
      +`<p class="hint">Holes per round where you reached the green within one shot over regulation. Average ${avgOf(list,r=>r.gir1).toFixed(1)} of 18 (${(avgOf(list,r=>r.gir1)/18*100).toFixed(0)}%) · best ${Math.max(...list.map(r=>r.gir1))}.</p>`
      +table(["Date","GIR+1",`${ROLL}-rd avg`],list.map((r,i)=>[long(r.date),r.gir1,rl[i]==null?"–":rl[i].toFixed(1)]).reverse());
  }

  /* par type */
  let pt;
  if(!list.length)pt=empty("Shows once you've finished a round in this range.");
  else{
    const rows=[3,4,5].map(p=>{const hs=list.flatMap(r=>r.holes).filter(h=>h.par===p);return {p,n:hs.length,avg:hs.length?hs.reduce((a,h)=>a+h.score-p,0)/hs.length:null,mean:hs.length?hs.reduce((a,h)=>a+h.score,0)/hs.length:null}});
    const max=Math.max(0.5,...rows.filter(r=>r.avg!=null).map(r=>Math.abs(r.avg)));
    pt=`<div class="i-bars">${rows.map(r=>r.avg==null?`<div class="i-bar"><span class="i-bl">Par ${r.p}s</span><span class="hint">No holes</span></div>`
      :`<div class="i-bar"><span class="i-bl">Par ${r.p}s</span><span class="i-track"><i class="${r.avg<0?"neg":""}" style="width:${Math.max(2,Math.abs(r.avg)/max*100)}%"></i></span><span class="i-bv">${sgn1(r.avg)}</span></div>`).join("")}</div>
      <p class="hint">Average score against par per hole. ${rows.filter(r=>r.n).map(r=>`Par ${r.p}s: ${r.mean.toFixed(2)} on ${r.n} holes`).join(" · ")}.</p>`;
  }

  /* scoring mix */
  let mx;
  if(!list.length)mx=empty("Shows once you've finished a round in this range.");
  else{
    const cnt=list.map(r=>{const d=r.holes.map(h=>h.score-h.par);return {b:d.filter(x=>x<=-1).length,p:d.filter(x=>x===0).length,o:d.filter(x=>x===1).length,dd:d.filter(x=>x>=2).length}});
    mx=lineChart("iMix",{labels:list.map(r=>r.date),series:[
        {name:"Birdies",vals:cnt.map(c=>c.b),color:"--s1",dots:list.length<25},
        {name:"Pars",vals:cnt.map(c=>c.p),color:"--s2",dots:list.length<25},
        {name:"Bogeys",vals:cnt.map(c=>c.o),color:"--s3",dots:list.length<25},
        {name:"Doubles",vals:cnt.map(c=>c.dd),color:"--s4",dots:list.length<25}],
      fmt:v=>String(Math.round(v)),tip:v=>String(v)})
      +`<p class="hint">Holes per round. Birdies include eagles; doubles include anything worse.</p>`
      +table(["Date","Birdies","Pars","Bogeys","Doubles"],list.map((r,i)=>[long(r.date),cnt[i].b,cnt[i].p,cnt[i].o,cnt[i].dd]).reverse());
  }

  return `${filt}
  <section class="panel i-card"><h2>Handicap index</h2>${hc}</section>
  <section class="panel i-card"><h2>Scores</h2>${sc}</section>
  <section class="panel i-card"><h2>Tiger 6 mistakes</h2>${t6}</section>
  <section class="panel i-card"><h2>Penalties</h2>${pn}</section>
  <section class="panel i-card"><h2>GIR+1</h2>${gi}</section>
  <section class="panel i-card"><h2>Scoring by par type</h2>${pt}</section>
  <section class="panel i-card"><h2>Scoring mix per round</h2>${mx}</section>`;
}
/* ---------- Practice view ---------- */
const DISC=[["Full swing","--s1"],["Wedges","--s2"],["Chipping","--s3"],["Putting","--s4"]];
const CI_DAYS=60;
const hm=m=>{m=Math.round(m);const h=Math.floor(m/60),r=m%60;return h?(r?`${h}h ${r}m`:`${h}h`):`${r}m`};
const yn=v=>v==="yes"?"Yes":v==="no"?"No":"—";
const clock=ms=>new Date(ms).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
const pct=(a,b)=>b?Math.round(a/b*100):null;
const avgN=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const sgnF=v=>(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(1);

/* Check-ins grouped by session: {run,date,at,start,end}. */
function checkinSessions(){
  const d=new Date();d.setDate(d.getDate()-(CI_DAYS-1));const cut=Store.iso(d);
  const by={};(Store.get("checkins",[])||[]).forEach(c=>{if(!c||!c.date||c.date<cut)return;const k=c.run||("x"+c.at);
    const o=by[k]=by[k]||{run:k,date:c.date};o[c.when==="end"?"end":"start"]=c});
  const list=Object.values(by).map(o=>({...o,at:(o.start||o.end).at||new Date(o.date+"T12:00").getTime()})).sort((a,b)=>a.at-b.at);
  return {cut,list};
}

function drawCI(c){
  const box=document.getElementById(c.id);if(!box)return;
  const W=Math.max(260,box.clientWidth),L=50,R=12,H=322;
  const X=t=>L+Math.max(0,Math.min(1,(t-c.t0)/(c.t1-c.t0)))*(W-L-R);
  const HT=26,HB=168,Y=v=>HB-(v-1)/9*(HB-HT);
  const rows={fun:[228,246],life:[290,308]};
  let g=`<text x="0" y="12" class="i-plab">Happiness quotient</text>`;
  g+=[1,4,7,10].map(t=>`<line x1="${L}" x2="${W-R}" y1="${Y(t)}" y2="${Y(t)}" class="i-grid"/><text x="${L-6}" y="${Y(t)+4}" class="i-ax" text-anchor="end">${t}</text>`).join("");
  const days=[c.t0,c.t0+(c.t1-c.t0)/2,c.t1-1];
  g+=days.map((t,i)=>`<text x="${X(t)}" y="186" class="i-ax" text-anchor="${["start","middle","end"][i]}">${esc(i===2?"Today":short(Store.iso(new Date(t))))}</text>`).join("");
  g+=`<text x="0" y="212" class="i-plab">Having fun?</text><text x="0" y="274" class="i-plab">Golf in the way of real life?</text>`;
  Object.values(rows).forEach(([b,a])=>{g+=`<line x1="${L}" x2="${W-R}" y1="${b}" y2="${b}" class="i-grid i-faint"/><line x1="${L}" x2="${W-R}" y1="${a}" y2="${a}" class="i-grid i-faint"/>
    <text x="${L-8}" y="${b+4}" class="i-ax" text-anchor="end">Before</text><text x="${L-8}" y="${a+4}" class="i-ax" text-anchor="end">After</text>`});
  let m="";
  c.list.forEach(s=>{const x=X(s.at),b=s.start,a=s.end;
    if(b&&a&&b.hq!=null&&a.hq!=null)m+=`<line x1="${x}" x2="${x}" y1="${Y(b.hq)}" y2="${Y(a.hq)}" class="i-link"/>`;
    if(b&&b.hq!=null)m+=`<circle cx="${x}" cy="${Y(b.hq)}" r="4" fill="var(--s1)" class="i-dot"/>`;
    if(a&&a.hq!=null)m+=`<circle cx="${x}" cy="${Y(a.hq)}" r="4" fill="var(--s2)" class="i-dot"/>`;
    Object.entries(rows).forEach(([k,[yb,ya]])=>[[b,yb,"--s1"],[a,ya,"--s2"]].forEach(([v,y,col])=>{if(!v||!v[k])return;
      m+=v[k]==="yes"?`<circle cx="${x}" cy="${y}" r="4" fill="var(${col})" class="i-dot"/>`:`<circle cx="${x}" cy="${y}" r="3" fill="var(--panel)" stroke="var(${col})" stroke-width="1.75"/>`}));
  });
  box.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}${m}<line class="i-cross" y1="20" y2="${H-4}" x1="0" x2="0" visibility="hidden"/></svg><div class="i-tip" hidden></div>`;
  const svg=box.querySelector("svg"),cross=box.querySelector(".i-cross"),tipEl=box.querySelector(".i-tip");
  const show=e=>{if(!c.list.length)return;const r=svg.getBoundingClientRect(),x=e.clientX-r.left;
    let best=c.list[0];c.list.forEach(s=>{if(Math.abs(X(s.at)-x)<Math.abs(X(best.at)-x))best=s});
    const bx=X(best.at),b=best.start||{},a=best.end||{};
    cross.setAttribute("x1",bx);cross.setAttribute("x2",bx);cross.setAttribute("visibility","visible");
    const d=b.hq!=null&&a.hq!=null?a.hq-b.hq:null;
    tipEl.innerHTML=`<b>${esc(long(best.date))} · ${esc(clock(best.at))}</b>
      <span><i style="background:var(--s1)"></i>Before <em>${b.hq??"—"} · fun ${yn(b.fun)} · life ${yn(b.life)}</em></span>
      <span><i style="background:var(--s2)"></i>After <em>${a.hq??"—"} · fun ${yn(a.fun)} · life ${yn(a.life)}</em></span>
      ${d==null?"":`<span>Happiness change <em>${d>0?"+":d<0?"−":""}${Math.abs(d)}</em></span>`}`;
    tipEl.hidden=false;const tw=tipEl.offsetWidth;tipEl.style.left=Math.max(0,Math.min(W-tw,bx-tw/2))+"px"};
  const hide=()=>{tipEl.hidden=true;cross.setAttribute("visibility","hidden")};
  svg.addEventListener("pointerdown",show);svg.addEventListener("pointermove",show);svg.addEventListener("pointerleave",hide);
}

function checkinCard(){
  const {cut,list}=checkinSessions();
  if(!list.length)return empty("No check-ins in the last 60 days yet. They're the three questions at the start and end of every practice session.");
  const both=list.filter(s=>s.start&&s.end&&s.start.hq!=null&&s.end.hq!=null);
  const bAvg=avgN(list.filter(s=>s.start&&s.start.hq!=null).map(s=>s.start.hq)),aAvg=avgN(list.filter(s=>s.end&&s.end.hq!=null).map(s=>s.end.hq));
  const ch=avgN(both.map(s=>s.end.hq-s.start.hq)),lower=both.filter(s=>s.end.hq<s.start.hq).length;
  const yes=(w,k)=>{const xs=list.map(s=>s[w]).filter(x=>x&&x[k]);return [xs.filter(x=>x[k]==="yes").length,xs.length]};
  const line=(k,lab)=>{const [b,bn]=yes("start",k),[a,an]=yes("end",k);return `${lab}: yes ${b} of ${bn} before · ${a} of ${an} after.`};
  let verdict="";
  if(both.length>=3)verdict=ch>=0.3?"Practice tends to leave you happier than when you started.":ch<=-0.3?"Practice tends to leave you a bit lower than when you started. Worth a look at which sessions do it.":"Practice doesn't change your happiness much either way.";
  else verdict="A pattern shows after a few sessions with both check-ins.";
  const t0=new Date(cut+"T00:00").getTime(),t1=new Date(Store.today()+"T00:00").getTime()+864e5;
  charts.push({kind:"ci",id:"iCI",list,t0,t1});
  return `<div class="i-key" aria-label="How to read this chart">
      <div><span><i style="background:var(--s1)"></i>Before practice</span><span><i style="background:var(--s2)"></i>After practice</span></div>
      <div class="i-k2"><svg width="16" height="22" viewBox="0 0 16 22" aria-hidden="true"><line x1="8" x2="8" y1="16" y2="6" class="i-link"/><circle cx="8" cy="16" r="4" fill="var(--s1)"/><circle cx="8" cy="6" r="4" fill="var(--s2)"/></svg><span>Orange above blue: you finished happier</span></div>
      <div class="i-k2"><svg width="16" height="22" viewBox="0 0 16 22" aria-hidden="true"><line x1="8" x2="8" y1="6" y2="16" class="i-link"/><circle cx="8" cy="6" r="4" fill="var(--s1)"/><circle cx="8" cy="16" r="4" fill="var(--s2)"/></svg><span>Orange below blue: the session left you lower</span></div>
      <div><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="var(--s1)"/></svg><span>Filled dot = Yes</span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="3.5" fill="var(--panel)" stroke="var(--s1)" stroke-width="1.75"/></svg><span>Ring = No</span></div>
      <p class="hint">Each column is one session, oldest on the left. For "Golf in the way of real life?", Yes is the one to watch. Tap any session to see all its answers.</p></div>
    <div class="i-chart" id="iCI" role="img" aria-label="Check-in answers before and after ${list.length} practice sessions over the last ${CI_DAYS} days"></div>
    <div class="stats i-stats">
      <div class="stat"><div class="label">Before</div><div class="v">${bAvg==null?"—":bAvg.toFixed(1)}</div><div class="hint">avg happiness</div></div>
      <div class="stat"><div class="label">After</div><div class="v">${aAvg==null?"—":aAvg.toFixed(1)}</div><div class="hint">avg happiness</div></div>
      <div class="stat"><div class="label">Change</div><div class="v">${ch==null?"—":sgnF(ch)}</div><div class="hint">per session</div></div>
      <div class="stat"><div class="label">Lower after</div><div class="v">${both.length?lower+" of "+both.length:"—"}</div><div class="hint">sessions</div></div></div>
    <p class="hint"><b>${esc(verdict)}</b> ${esc(line("fun","Having fun"))} ${esc(line("life","Golf in the way of real life"))}</p>`
    +table(["Date","Happy before","Happy after","Fun before","Fun after","Life before","Life after"],[...list].reverse().map(s=>{const b=s.start||{},a=s.end||{};
      return [short(s.date),b.hq??"—",a.hq??"—",yn(b.fun),yn(a.fun),yn(b.life),yn(a.life)]}));
}

/* practice minutes per week (Mon–Sun), last 8 weeks, stacked by discipline */
const monday=iso=>{const d=new Date(iso+"T12:00");d.setDate(d.getDate()-(d.getDay()+6)%7);return Store.iso(d)};
function drawBars(c){
  const box=document.getElementById(c.id);if(!box)return;
  const W=Math.max(260,box.clientWidth),H=210,L=40,R=12,T=12,B=26,n=c.weeks.length;
  const max=Math.max(30,...c.weeks.map(w=>w.total));
  const hrs=max>=120,ticks=hrs?nice(0,max/60,4).map(v=>v*60):nice(0,max,4),y1=ticks[ticks.length-1];
  const Y=v=>T+(H-T-B)*(1-v/y1),slot=(W-L-R)/n,bw=Math.min(34,slot*.62),X=i=>L+slot*i+slot/2;
  let g=ticks.map(t=>`<line x1="${L}" x2="${W-R}" y1="${Y(t)}" y2="${Y(t)}" class="i-grid"/><text x="${L-6}" y="${Y(t)+4}" class="i-ax" text-anchor="end">${hrs?t/60+"h":t+"m"}</text>`).join("");
  g+=c.weeks.map((w,i)=>(n-1-i)%2?"":`<text x="${X(i)}" y="${H-6}" class="i-ax" text-anchor="middle">${esc(i===n-1?"This wk":short(w.of))}</text>`).join("");
  let m="";
  c.weeks.forEach((w,i)=>{let y=Y(0);const segs=DISC.map(([d,col])=>[w.by[d]||0,col]).filter(x=>x[0]>0);
    segs.forEach(([v,col],j)=>{const h=Y(0)-Y(v),top=j===segs.length-1,x=X(i)-bw/2,yy=y-h,gap=j?2:0,hh=Math.max(1,h-gap);
      const r=top?Math.min(4,hh):0;
      m+=`<path d="M${x} ${y-gap}V${yy+r}${r?`Q${x} ${yy} ${x+r} ${yy}`:""}H${x+bw-r}${r?`Q${x+bw} ${yy} ${x+bw} ${yy+r}`:""}V${y-gap}Z" fill="var(${col})"/>`;y=yy});
  });
  box.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}${m}</svg><div class="i-tip" hidden></div>`;
  const svg=box.querySelector("svg"),tipEl=box.querySelector(".i-tip");
  const show=e=>{const r=svg.getBoundingClientRect(),i=Math.max(0,Math.min(n-1,Math.floor((e.clientX-r.left-L)/slot))),w=c.weeks[i];
    tipEl.innerHTML=`<b>Week of ${esc(short(w.of))}</b>`+DISC.map(([d,col])=>`<span><i style="background:var(${col})"></i>${esc(d)} <em>${hm(w.by[d]||0)}</em></span>`).join("")+`<span>Total <em>${hm(w.total)}</em></span>`;
    tipEl.hidden=false;const tw=tipEl.offsetWidth;tipEl.style.left=Math.max(0,Math.min(W-tw,X(i)-tw/2))+"px"};
  svg.addEventListener("pointerdown",show);svg.addEventListener("pointermove",show);svg.addEventListener("pointerleave",()=>tipEl.hidden=true);
}
function timeCard(){
  const log=(Store.get("practiceLog",[])||[]).filter(x=>x&&x.date&&x.min>0);
  const now=monday(Store.today()),weeks=[];
  for(let i=7;i>=0;i--){const d=new Date(now+"T12:00");d.setDate(d.getDate()-7*i);weeks.push({of:Store.iso(d),by:{},total:0})}
  log.forEach(x=>{const w=weeks.find(w=>w.of===monday(x.date));if(!w)return;const d=DISC.some(([k])=>k===x.disc)?x.disc:"Full swing";w.by[d]=(w.by[d]||0)+x.min;w.total+=x.min});
  if(!weeks.some(w=>w.total))return empty("No practice logged in the last 8 weeks yet.");
  charts.push({kind:"bars",id:"iTime",weeks});
  const past=weeks.slice(0,-1).filter(w=>w.total),avg=avgN(past.map(w=>w.total));
  const tot=DISC.map(([d])=>[d,weeks.reduce((a,w)=>a+(w.by[d]||0),0)]),all=tot.reduce((a,x)=>a+x[1],0);
  return `<div class="i-legend">${DISC.map(([d,col])=>`<span><i style="background:var(${col})"></i>${esc(d)}</span>`).join("")}</div>
    <div class="i-chart" id="iTime" role="img" aria-label="Practice minutes per week by discipline, last 8 weeks"></div>
    <p class="hint">This week ${hm(weeks[7].total)}${avg==null?"":` · ${hm(avg)} a week on average before that`}. Last 8 weeks: ${tot.map(([d,v])=>`${esc(d.toLowerCase())} ${pct(v,all)}%`).join(", ")}.</p>`
    +table(["Week of",...DISC.map(d=>d[0]),"Total"],[...weeks].reverse().map(w=>[short(w.of),...DISC.map(([d])=>hm(w.by[d]||0)),hm(w.total)]));
}

/* games: one chart per variant (picked), each result plus the 12-game average to beat */
function gamesCard(){
  const M=window.PracticeMeta;if(!M)return "";
  const done=(Store.get("games",[])||[]).filter(g=>g&&g.status==="done"&&M.has(g.game)&&typeof g.result==="number").sort((a,b)=>(a.finishedAt||0)-(b.finishedAt||0));
  if(!done.length)return empty("Finish a game and its results show here over time.");
  const vars={};done.forEach(g=>{(vars[g.variant]=vars[g.variant]||{k:g.game,v:g.variant,setup:g.setup,list:[]}).list.push(g)});
  const order=Object.values(vars).sort((a,b)=>b.list[b.list.length-1].finishedAt-a.list[a.list.length-1].finishedAt);
  const nm=x=>M.name(x.k)+(M.label(x.k,x.setup)?" · "+M.label(x.k,x.setup):"");
  if(!gamePick||!vars[gamePick])gamePick=order[0].v;
  const x=vars[gamePick],k=x.k,vals=x.list.map(g=>g.result);
  const roll=vals.map((_,i)=>i+1<ROLL_MIN?null:+avgN(vals.slice(Math.max(0,i-ROLL+1),i+1)).toFixed(2));
  const hi=M.better(k)==="high",best=hi?Math.max(...vals):Math.min(...vals),last12=avgN(vals.slice(-ROLL));
  const pick=order.length>1?`<div class="r-opts i-range" role="group" aria-label="Game">${order.map(o=>`<button class="r-opt" data-gpick="${esc(o.v)}" aria-pressed="${o.v===gamePick}">${esc(nm(o))}</button>`).join("")}</div>`:`<div class="label">${esc(nm(x))}</div>`;
  return pick+lineChart("iGame",{labels:x.list.map(g=>g.date||Store.iso(new Date(g.finishedAt))),
      series:[{name:"Result",vals,color:"--s2",dots:true,dotsOnly:true},{name:`${ROLL}-game avg`,vals:roll,color:"--s1"}],
      fmt:v=>M.axis(k,v),tip:(v,s)=>s.dotsOnly?M.fmt(k,v):M.avg(k,v)})
    +`<p class="hint">${hi?"Higher":"Lower"} is better. ${x.list.length} game${x.list.length===1?"":"s"} · best ${esc(M.fmt(k,best))} · average to beat ${esc(M.avg(k,last12))} (last ${Math.min(ROLL,vals.length)}). The line is the average of the last ${ROLL} games at each point.</p>`
    +table(["Date","Result",`${ROLL}-game avg`],x.list.map((g,i)=>[long(g.date||Store.iso(new Date(g.finishedAt))),M.fmt(k,g.result),roll[i]==null?"–":M.avg(k,roll[i])]).reverse());
}

/* routines: each scored step as % over time; the putting spiral's farthest distance gets its own chart */
function routinesCard(){
  const rt=typeof Sessions!=="undefined"&&Sessions.routineTitle?Sessions.routineTitle:k=>k;
  const log=(Store.get("practiceLog",[])||[]).filter(x=>x&&x.routine&&Array.isArray(x.results)&&x.results.length);
  if(!log.length)return empty("Finish a routine with scored steps (Center Strike / Startline, Face Control / Tempo or Technical Putting) and its scores show here.");
  const by={};log.forEach(x=>(by[x.routine]=by[x.routine]||[]).push(x));
  const keys=Object.keys(by).sort((a,b)=>by[b][by[b].length-1].date.localeCompare(by[a][by[a].length-1].date));
  if(!routinePick||!by[routinePick])routinePick=keys[0];
  const list=by[routinePick],labels=list.map(x=>x.date);
  const pick=keys.length>1?`<div class="r-opts i-range" role="group" aria-label="Routine">${keys.map(k=>`<button class="r-opt" data-rpick="${esc(k)}" aria-pressed="${k===routinePick}">${esc(rt(k))}</button>`).join("")}</div>`:`<div class="label">${esc(rt(routinePick))}</div>`;
  /* series in step order */
  const ser=[],ft=[];
  list.forEach((x,i)=>x.results.forEach(r=>{
    const put=(name,a,b,extra)=>{let s=ser.find(s=>s.name===name);if(!s){s={name,vals:Array(list.length).fill(null),raw:Array(list.length).fill(null)};ser.push(s)}
      s.vals[i]=pct(a,b);s.raw[i]=`${a}/${b}${extra||""}`};
    if(r.seq){if(r.n){put("On line",r.line,r.n);put("In window",r.win,r.n)}}
    else if(r.pick){let s=ft[0];if(!s){s={name:r.pick,unit:r.unit,vals:Array(list.length).fill(null)};ft.push(s)}s.vals[i]=r.value}
    else if(r.of)put(r.step,r.total,r.of,r.pass==null?"":r.pass?" ✓":" ✗");
  }));
  const cols=["--s1","--s2","--s3","--s4"],S=ser.slice(0,4).map((s,j)=>({...s,color:cols[j],dots:list.length<25}));
  let out=pick;
  if(S.length){
    out+=lineChart("iRoutine",{labels,series:S,fmt:v=>Math.round(v)+"%",tip:(v,s,i)=>`${s.raw[i]} (${v}%)`})
      +`<p class="hint">Share of each scored step you made, per session. ${list.length} session${list.length===1?"":"s"}${S.map(s=>{const a=avgN(s.vals.filter(v=>v!=null));return a==null?"":` · ${esc(s.name)} avg ${Math.round(a)}%`}).join("")}.</p>`
      +table(["Date",...S.map(s=>s.name)],list.map((x,i)=>[long(x.date),...S.map(s=>s.raw[i]==null?"–":s.raw[i])]).reverse());
  }
  ft.forEach(s=>{
    out+=`<div class="label i-sub">${esc(s.name)}</div>`+lineChart("iRoutineFt",{labels,series:[{name:s.name,vals:s.vals,color:"--s1",dots:true}],fmt:v=>Math.round(v)+" "+s.unit,tip:v=>v+" "+s.unit})
      +table(["Date",s.name],list.map((x,i)=>[long(x.date),s.vals[i]==null?"—":s.vals[i]+" "+s.unit]).reverse());
  });
  if(!S.length&&!ft.length)out+=empty("This routine has no scored steps yet.");
  return out;
}

function practice(){
  return `<section class="panel i-card"><h2>How Practice Feels</h2><p class="hint">Your three check-in answers before and after each session, last ${CI_DAYS} days.</p>${checkinCard()}</section>
  <section class="panel i-card"><h2>Practice Time</h2><p class="hint">Minutes per week by discipline, last 8 weeks, including games played on their own.</p>${timeCard()}</section>
  <section class="panel i-card"><h2>Games</h2>${gamesCard()}</section>
  <section class="panel i-card"><h2>Routines</h2>${routinesCard()}</section>`;
}

function render(){
  charts.length=0;
  const tog=`<div class="seg i-view" role="group" aria-label="Insights for">${[["course","Course"],["practice","Practice"]].map(([k,l])=>`<button data-view="${k}" aria-pressed="${k===view}">${l}</button>`).join("")}</div>`;
  root.innerHTML=`<header><h1>Insights</h1></header>${tog}${view==="practice"?practice():course()}`;
  charts.forEach(draw);
}
root.addEventListener("click",e=>{const v=e.target.closest("[data-view]");if(v){view=v.dataset.view;Store.set("insightsView",view);render();return}
  const gp=e.target.closest("[data-gpick]");if(gp){gamePick=gp.dataset.gpick;render();return}
  const rp=e.target.closest("[data-rpick]");if(rp){routinePick=rp.dataset.rpick;render();return}
  const t=e.target.closest("[data-t6]");if(t){t6pick=t.dataset.t6;render();return}
  const b=e.target.closest("[data-range]");if(!b)return;range=b.dataset.range;Store.set("insightsRange",range);render()});
const showing=()=>location.hash.slice(1).split("/")[0]==="insights";
window.addEventListener("hashchange",()=>{if(showing())render()});
let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(showing())charts.forEach(draw)},150)});
if(showing())render();
})();
