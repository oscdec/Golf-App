/* Insights tab: round stats charts (handicap index, scores, Tiger 6, penalties, GIR+1, scoring by par type, scoring mix).
   Charts are hand-built SVG sized to the screen, with tap/drag tooltips and a "Show numbers" table.
   Data comes from Rounds.history() and Rounds.list(). Redrawn whenever the tab is shown. */
(()=>{
const root=document.getElementById("insightsRoot");if(!root)return;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const COUNTS=[["r10","Last 10",10],["r20","Last 20",20],["r40","Last 40",40]];
const RANGES=[["3m","3 months",91],["6m","6 months",182],["1y","1 year",365],["2y","2 years",730],["all","All",0]];
let range=Store.get("insightsRange","1y");
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
  charts.push({id,labels,series,fmt,tip});
  return `${legend}<div class="i-chart" id="${id}" role="img" aria-label="${esc(series.map(s=>s.name).join(", "))} over ${n} rounds"></div>`;
}
function draw(c){
  const box=document.getElementById(c.id);if(!box)return;
  const W=Math.max(260,box.clientWidth),H=210,named=c.series.length>1,L=34,R=named?62:14,T=12,B=26;
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
    tipEl.innerHTML=`<b>${esc(long(c.labels[i]))}</b>`+c.series.map(s=>s.vals[i]==null?"":`<span><i style="background:var(${s.color})"></i>${esc(s.name)} <em>${c.tip(s.vals[i],s)}</em></span>`).join("");
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
function render(){
  if(!window.Rounds||!Rounds.list){root.innerHTML="";return}
  charts.length=0;
  const full=Rounds.list();
  /* rolling average over all rounds, so the line is right at the start of any range */
  const rollAll=full.map((_,i)=>i+1<ROLL_MIN?null:+(full.slice(Math.max(0,i-ROLL+1),i+1).reduce((a,r)=>a+r.score,0)/Math.min(ROLL,i+1)).toFixed(1));
  const cnt=COUNTS.find(x=>x[0]===range);
  let from,keep;
  if(cnt){keep=full.map((r,i)=>i>=full.length-cnt[2]);from=full.length?full[Math.max(0,full.length-cnt[2])].date:"9999"}
  else{from=cutoff();keep=full.map(r=>!from||r.date>=from)}
  const list=full.filter((_,i)=>keep[i]),roll=rollAll.filter((_,i)=>keep[i]);
  const hist=Rounds.history().filter(h=>!from||h.date>=from);
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

  root.innerHTML=`<header><h1>Insights</h1></header>${filt}
  <section class="panel i-card"><h2>Handicap index</h2>${hc}</section>
  <section class="panel i-card"><h2>Scores</h2>${sc}</section>
  <section class="panel i-card"><h2>Tiger 6 mistakes</h2>${t6}</section>
  <section class="panel i-card"><h2>Penalties</h2>${pn}</section>
  <section class="panel i-card"><h2>GIR+1</h2>${gi}</section>
  <section class="panel i-card"><h2>Scoring by par type</h2>${pt}</section>
  <section class="panel i-card"><h2>Scoring mix per round</h2>${mx}</section>`;
  charts.forEach(draw);
}
root.addEventListener("click",e=>{const t=e.target.closest("[data-t6]");if(t){t6pick=t.dataset.t6;render();return}
  const b=e.target.closest("[data-range]");if(!b)return;range=b.dataset.range;Store.set("insightsRange",range);render()});
const showing=()=>location.hash.slice(1).split("/")[0]==="insights";
window.addEventListener("hashchange",()=>{if(showing())render()});
let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(showing())charts.forEach(draw)},150)});
if(showing())render();
})();
