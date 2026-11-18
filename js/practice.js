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
const LADDERS={wedges30:[30,40,50,60,70,80,90,100],irons:[120,135,150,165,175,185,195],wedges:[40,50,60,70,80,90,100]};  /* "wedges" = the old 40-yard ladder, kept so past games still replay */
const COMBINE=[3,12,4,11,5,10,6,9,7,8];
const BENCH=[["Scratch",0,29.79],["5 hcp",5,31.03],["10 hcp",10,31.95],["15 hcp",15,32.91],["20 hcp",20,33.88]];

/* On-course benchmarks by handicap 0,5,10,15,20,25 (Shot Scope): approach proximity in feet by distance band;
   short game inside 50 yards. Real published numbers only; anything not published is left out, never estimated. */
const HC=[0,5,10,15,20,25],HC_LABEL=["Scratch","5 hcp","10 hcp","15 hcp","20 hcp","25 hcp"];
const APPROACH={b50:[26,36,41,48,49,57],b100:[38,50,57,72,81,91],b150:[54,82,92,122,132,168],
  /* 30–40 yd: Lou Stagner's Arccos medians from the rough (newsletter #27), handicaps 0–20, mean of his 30 and 40-yard rows
     (30: 14.8, 16.9, 19.9, 21.5, 24.5; 40: 17.0, 20.2, 24.2, 26.4, 29.1). Compared against the median of my shots. */
  b30:[15.9,18.6,22.1,24.0,26.8]};
const MEDIAN_BANDS={b30:true};
const BAND_NAME={b30:"30–40 yd",b50:"50–100 yd",b100:"100–150 yd",b150:"150–200 yd"};
const median=a=>{const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
/* Shot Scope inside 50 yards. The 10-handicap proximity and shots-to-finish weren't published, so they're left out (null), not estimated. */
const SG_PROX=[11,14,null,18,20,22],SG_FINISH=[2.45,2.55,null,2.78,2.86,3.01],SG_UD=[54,47,39,34,31,25];
/* Lou Stagner (Arccos) median proximity in feet from the rough, by distance, handicaps 0, 5, 10, 15, 20 (newsletter #27). */
const LOU_CHIP={10:[5.9,8.1,10.2,11.9,13.6],15:[8.0,10.2,12.1,13.9,15.7],20:[10.3,12.4,14.7,16.4,18.6],25:[12.2,14.8,17.1,18.9,21.5],30:[14.8,16.9,19.9,21.5,24.5]};
const CHIP_YDS=[10,15,20,25,30];
const CHIP_ZONES=[["Holed",0],["Inside 3 ft",2],["3–6 ft",4.5],["6–10 ft",8],["10–15 ft",12.5],["15–20 ft",17.5],["20–30 ft",25],["30 ft +",35],["Off the green",40]];
const CHIP_CALL={Short:"Under 10 yards, just off the green",Medium:"About 10–20 yards",Long:"About 20–30 yards"};
const r1=v=>Math.round(v*10)/10;
/* The handicap a value "plays like": interpolate along a benchmark row (lower values are better).
   Beyond the ends the nearest segment's slope continues; negative means a plus handicap. */
function playsLike(v,row){
  const n=row.length;let i=0;if(v<=row[0])i=0;else if(v>=row[n-1])i=n-2;else while(i<n-2&&v>row[i+1])i++;
  const lo=row[i],hi=row[i+1],h=hi===lo?HC[i]:HC[i]+5*(v-lo)/(hi-lo);
  return Math.max(-6,Math.min(36,h));
}
const benchAt=(row,h)=>{const n=row.length;h=Math.max(0,Math.min(5*(n-1),h));const i=Math.min(n-2,Math.floor(h/5));return row[i]+(row[i+1]-row[i])*(h-HC[i])/5};
const fmtHcp=v=>v==null?"—":(v<0?"+"+(-v).toFixed(1):v.toFixed(1))+" hcp";
const myIndex=()=>window.Rounds&&Rounds.index?Rounds.index():null;
const prox=(e,t)=>3*Math.hypot(e.c-t,e.o);   /* yards -> feet from the target */
/* Lou Stagner (Arccos), newsletter #96: proximity in feet from the FAIRWAY by 5-yard bucket, 50–54 … 125–129 yards,
   for handicaps 0, 5, 10, 15, 20. Average and median. */
const LOU_WEDGE_AVG=[[23,24,25,25,26,26,27,27,28,29,30,31,31,33,34,35],[27,28,29,30,30,31,31,33,34,34,35,36,37,39,40,42],
  [30,32,33,34,36,37,37,38,39,41,42,43,45,46,48,50],[33,35,37,39,40,42,42,44,46,46,48,50,52,54,56,59],[37,39,41,43,45,47,48,50,52,53,55,57,59,62,64,68]];
const LOU_WEDGE_MED=[[18,19,19,20,20,20,20,21,22,23,24,25,25,26,28,28],[21,21,22,23,23,24,24,25,26,27,28,29,30,31,32,34],
  [23,25,26,26,28,29,29,30,30,32,33,34,35,37,39,40],[26,28,30,31,32,33,33,35,36,37,39,41,42,43,45,47],[29,31,33,35,36,38,38,40,42,42,44,46,48,49,51,54]];
/* Lou Stagner (Arccos), newsletter #137: % of drives that were solid, handicaps 0, 5, 10, 15, 20, by distance within each group. */
const LOU_SOLID={short:[59.3,61.3,61.3,60.6,60.6],mid:[55.8,52.1,49.3,47.2,46.1],long:[47.9,43.7,40.6,38.6,37.3]};
/* The benchmark for one target distance: Lou's per-distance numbers where he has them, Shot Scope beyond 129 yards. */
function benchFor(t){
  if(t<50)return {row:t<=35?LOU_CHIP[30]:[17.0,20.2,24.2,26.4,29.1],stat:"median",src:"30–40 yd: Lou Stagner, medians from the rough"};
  if(t<130){const b=Math.min(15,Math.floor((t-50)/5));return {row:LOU_WEDGE_AVG.map(h=>h[b]),stat:"average",src:"50–129 yd: Lou Stagner, averages from the fairway"}}
  return {row:t<150?APPROACH.b100:APPROACH.b150,stat:"average",src:"140+ yd: Shot Scope on-course averages"};
}
/* Proximity games (launch monitor): each target distance is scored against its own benchmark and turned into the
   handicap it plays like; the game's result is the average over the distances (equal shots at each). */
function distReplay(order,log,drv){
  const shots=log.map((e,i)=>{const t=order[i];
    if(t==="D")return {t,e,drive:true,solid:e.c>=drv-30&&Math.abs(e.o)<=20};
    return {t,e,ft:prox(e,t)}});
  const ir=shots.filter(x=>!x.drive),by={};
  ir.forEach(x=>{(by[x.t]=by[x.t]||[]).push(x.ft)});
  const per=Object.keys(by).map(Number).sort((a,b)=>a-b).map(t=>{const b=benchFor(t),f=by[t],v=b.stat==="median"?median(f):sum(f)/f.length;
    return {t,n:f.length,v,stat:b.stat,src:b.src,row:b.row,hc:playsLike(v,b.row)}});
  let w=0,acc=0;per.forEach(x=>{w+=x.n;acc+=x.hc*x.n});
  const dr=shots.filter(x=>x.drive);
  return {n:log.length,shots,ir,dr,per,solid:dr.filter(x=>x.solid).length,hc:w?r1(acc/w):null};
}

/* ---------- game definitions ---------- */
const G={
  safe:{name:"Safe Side",kind:"Full Swing",better:"high",
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
  ladder:{name:"Distance Ladder",kind:"Wedges & Irons",better:"low",
    blurb:"Climb the targets one hit at a time: wedges from 30 yards, irons from 120. Fewer balls is better.",
    rules:["Wedges: 30 to 100 yards, 8 rungs. Irons: 120 to 195 yards, 7 rungs.","Hit the current target to climb a rung.","Normal: a miss drops you one rung. Hard: a miss sends you back to the start.","Wedges and irons, normal and hard, are tracked separately."],
    opts:{set:[["wedges30","Wedges"],["irons","Irons"]],mode:[["normal","Normal"],["hard","Hard"]]},
    variant:s=>`ladder-${s.set}-${s.mode}`,label:s=>`${s.set==="irons"?"Irons":s.set==="wedges"?"Wedges (from 40)":"Wedges"} · ${s.mode==="hard"?"Hard":"Normal"}`,
    start:o=>({set:o.set==="wedges"?"wedges30":(o.set||"wedges30"),mode:o.mode||"normal"}),
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
  range:{name:"Range Round",kind:"Full Swing",better:"low",
    blurb:"Play a course you know in your head: a tee shot and an approach on every hole.",
    rules:["Pick the tee shot and approach club for each hole, as if playing a course you know.","Both shots hit: birdie. One hit: par. Neither: bogey. Tee shot past the penalty line: double bogey, whatever the approach.","Full routine on every shot, and never the same club twice in a row.","9- and 18-hole rounds are tracked separately."],
    opts:{holes:[["9","9 holes"],["18","18 holes"]]},
    variant:s=>`range-${s.holes}`,label:s=>`${s.holes} holes`,
    start:o=>({holes:+(o.holes||18)}),
    replay:(s,log)=>{const sc=log.map(h=>h.t==="p"?2:(h.t==="h")+(h.a==="h")===2?-1:(h.t==="h")+(h.a==="h")===1?0:1);
      return {n:log.length,scores:sc,total:sum(sc),done:log.length>=s.holes,result:sum(sc)}},
    fmt:v=>toPar(v)},
  must:{name:"Must-Make Exit",kind:"Full Swing",better:"low",
    blurb:"You can't leave until you hit X in a row to one target, 125–160 yards. Fewer balls is better.",
    rules:["Pick how many in a row and a target from 125 to 160 yards. Use whatever club fits.","A miss resets the streak to zero.","Each \"in a row\" number is tracked separately. Good as the last drill of a session."],
    opts:{x:[["2","2 in a row"],["3","3 in a row"],["4","4 in a row"],["5","5 in a row"]],dist:"range"},
    variant:s=>`must-${s.x}`,label:s=>`${s.x} in a row`+(s.dist?` · ${s.dist} yd`:""),
    start:o=>({x:+(o.x||3),dist:+(o.dist||150)}),
    replay:(s,log)=>{let st=0;log.forEach(h=>{st=h?st+1:0});return {streak:st,balls:log.length,done:st>=s.x,result:log.length}},
    fmt:v=>v+" ball"+(v===1?"":"s")},
  bsc:{name:"Ball-Striking Combine",kind:"Full Swing · Launch Monitor",better:"low",bench:true,
    blurb:"24 balls: irons to six targets from 110 to 185 yards, plus 6 drives, in random order. Your result is the handicap your iron proximity plays like.",
    rules:["One ball at a time with your full routine. The app calls every shot.","Irons: 3 balls each at 110, 125, 140, 155, 170 and 185 yards. Enter carry and offline from the SkyTrak; the app works out how many feet you finished from the target.","Drives: 6, aimed at the middle. A solid drive carries within 30 yards of your normal driver carry and finishes within 20 yards of center (Lou Stagner's definition).","Result: for each distance, your average against its benchmark, turned into the handicap it plays like, then averaged. 110 and 125 yards: Lou Stagner's averages from the fairway. 140 to 185 yards: Shot Scope's on-course averages (Lou's table stops at 129). Range lies are easier than the course, so expect it to flatter you a little.","Drives are compared with Lou Stagner's solid-drive percentages by handicap.","Blow-ups: iron shots more than double the benchmark for your handicap."],
    opts:{drv:"drv"},variant:s=>s&&s.v===2?"bsc2":"bsc",label:()=>"",
    start:o=>({v:2,order:shuffle([...[110,125,140,155,170,185].flatMap(y=>[y,y,y]),"D","D","D","D","D","D"]),drv:+(o.drv||240)}),
    replay:(s,log)=>{const r=distReplay(s.order,log,s.drv);return {...r,done:log.length>=24,result:r.hc}},
    fmt:fmtHcp},
  wedge:{name:"Wedge Combine",kind:"Wedges · Launch Monitor",better:"low",bench:true,
    blurb:"24 wedges from 30 to 120 yards in random order. Your result is the handicap your proximity plays like.",
    rules:["One ball at a time with your full routine. The app calls every shot: 3 balls each at 30, 40, 50, 60, 75, 90, 105 and 120 yards.","Enter carry and offline from the SkyTrak; the app works out how many feet you finished from the target.","Result: for each distance, your proximity against Lou Stagner's Arccos numbers for that distance, turned into the handicap it plays like, then averaged. 30 and 40 yards: your median against his medians from the rough. 50 to 120 yards: your average against his averages from the fairway, in 5-yard steps. Range lies are easier than the course, so expect it to flatter you a little.","Also shown: how many finished inside 15 feet, and blow-ups (more than double the benchmark for your handicap)."],
    variant:s=>s&&s.v===2?"wedge2":s&&s.order&&s.order.includes(30)?"wedge30":"wedge",label:()=>"",
    start:()=>({v:2,order:shuffle([30,40,50,60,75,90,105,120].flatMap(y=>[y,y,y]))}),
    replay:(s,log)=>{const r=distReplay(s.order,log,0);return {...r,done:log.length>=24,result:r.hc}},
    fmt:fmtHcp},
  /* The first Chipping Combine (short/medium/long, Nov 17); no longer offered, kept so past games still open. */
  chipc:{name:"Chipping Combine (Old Version)",kind:"Chipping · No Putting",better:"low",
    blurb:"18 chips from short, medium and long spots. No putting: just mark where each one finishes. Compare your average leave to scratch through 25 handicaps.",
    rules:["The app calls each chip: short (under 10 yards, just off the green), medium (about 10–20 yards) or long (about 20–30 yards), 6 of each in random order.","Toss the ball and play the lie you get. Change holes every chip.","Tap where the ball finished. Quick measures: a flagstick is about 7 feet, a putter about 3 feet, a long stride about 3 feet.","Result: your average leave in feet, against Shot Scope's on-course averages from inside 50 yards. Off the green counts as 40 feet and as a double chip."],
    variant:()=>"chipc",label:()=>"",
    start:()=>({order:shuffle(["Short","Medium","Long"].flatMap(x=>[x,x,x,x,x,x]))}),
    replay:(s,log)=>{const ft=log.map(z=>CHIP_ZONES[z][1]),avg=log.length?sum(ft)/log.length:0;
      return {n:log.length,avg,in6:log.filter(z=>z<=2).length,dc:log.filter(z=>z===8).length,done:log.length>=18,result:r1(avg)}},
    fmt:v=>(+v).toFixed(1)+" ft"},
  chip20:{name:"Chipping Combine",kind:"Chipping · No Putting",better:"low",bench:true,
    blurb:"20 chips, 4 each from 10, 15, 20, 25 and 30 yards, in random order. No putting: just mark where each one finishes. Your result is the handicap your chipping plays like, against Lou Stagner's numbers.",
    rules:["The app calls each chip's distance: 10, 15, 20, 25 or 30 yards, 4 of each in random order. Pace it off (a long stride is about a yard).","Toss the ball and play the lie you get. Change holes every chip.","Tap where the ball finished. Quick measures: a flagstick is about 7 feet, a putter about 3 feet.","Result: for each distance, your median leave against Lou Stagner's Arccos medians from the rough (scratch to 20 handicap), turned into the handicap it plays like; the five are averaged. Off the green counts as 40 feet and as a double chip.","Range and practice-green lies are usually kinder than the course, so expect it to flatter you a little."],
    variant:()=>"chip20",label:()=>"",
    start:()=>({order:shuffle(CHIP_YDS.flatMap(y=>[y,y,y,y]))}),
    replay:(s,log)=>{const by={};log.forEach((z,i)=>{const y=s.order[i];(by[y]=by[y]||[]).push(CHIP_ZONES[z][1])});
      const per=CHIP_YDS.filter(y=>by[y]).map(y=>{const m=median(by[y]);return {y,n:by[y].length,med:m,hc:playsLike(m,LOU_CHIP[y])}});
      const all=log.map(z=>CHIP_ZONES[z][1]);
      return {n:log.length,per,avg:all.length?sum(all)/all.length:0,med:all.length?median(all):0,in6:log.filter(z=>z<=2).length,dc:log.filter(z=>z===8).length,
        done:log.length>=20,result:per.length?r1(sum(per.map(x=>x.hc))/per.length):null}},
    fmt:fmtHcp},
  updown:{name:"Up-and-Down 18",kind:"Chipping & Putting",better:"low",
    blurb:"18 holes from around the green, holed out. For days the facility lets you chip and putt.",
    rules:["12 holes from inside 25 yards and 6 from 25–50 yards, in random order. One ball per hole.","Toss the ball and play the lie you get. New hole every time, and hole out every putt.","Enter the strokes for each hole. If the chip missed the green, tap that first: it's a double chip.","Result: total strokes, against Shot Scope's average shots to finish from inside 50 yards, times 18."],
    variant:()=>"updown",label:()=>"",
    start:()=>({order:shuffle([..."IIIIIIIIIIII","O","O","O","O","O","O"])}),
    replay:(s,log)=>({n:log.length,total:sum(log.map(e=>e.s)),ud:log.filter(e=>e.s<=2).length,dc:log.filter(e=>e.dc).length,done:log.length>=18,result:sum(log.map(e=>e.s))}),
    fmt:v=>v+" strokes"},
  skytrak:{name:"SkyTrak Combine",kind:"Full Swing · Log A Result",better:"high",
    blurb:"Took the combine in the SkyTrak app? Log its score here so all your results live in one place.",
    rules:["Run the combine in the SkyTrak app.","Enter the overall score and the handicap SkyTrak shows. More calculations can come later."],
    variant:()=>"skytrak",label:()=>"",
    start:()=>({}),
    replay:(s,log)=>({done:log.length>=1,result:log[0]?log[0].score:null}),
    fmt:v=>(+v).toFixed(1)+" pts"},
};
const GROUPS=[["Full swing",["bsc","skytrak","safe","fairway","range","must"]],["Wedges & irons",["wedge","ladder"]],["Chipping",["chip20","updown"]],["Putting",["combine","lag"]]];

/* ---------- stats ---------- */
const active=()=>games.find(g=>g.status==="active");
const finished=(variant,before)=>games.filter(g=>g.status==="done"&&g.variant===variant&&(!before||g.finishedAt<before)).sort((a,b)=>a.finishedAt-b.finishedAt);
function stat(key,variant,before){
  const all=finished(variant,before),last=all.slice(-AVG_N);if(!all.length)return null;
  const vals=all.map(g=>g.result),best=G[key].better==="high"?Math.max(...vals):Math.min(...vals);
  return {avg:sum(last.map(g=>g.result))/last.length,n:last.length,total:all.length,best};
}
const fmtAvg=(key,v)=>{const r=Math.round(v*10)/10;return key==="range"?toPar(r):(key==="safe"||key==="fairway")?sgn(r):(key==="bsc"||key==="wedge"||key==="chipc"||key==="chip20"||key==="skytrak")?G[key].fmt(r):String(r)};
const beat=(key,v,avg)=>G[key].better==="high"?v>avg:v<avg;

/* ---------- routing ---------- */
const route=()=>{const h=location.hash.slice(1);return h==="practice"||h.startsWith("practice/")?h.split("/").slice(1):null};
const go=(p,replace)=>{const h="#practice"+(p?"/"+p:"");if(replace)location.replace(h);else location.hash=h};
let opts={},pendingTee=null,dcNext=false,side="";

function render(){
  const p=route();if(!p)return;const [a,b]=p;let html;
  switch(a){
    case undefined:case "":html=home();break;
    case "g":if(!G[b]){go("",true);return}html=intro(b);break;
    case "play":{const g=active();if(!g){go("",true);return}html=play(g);break}
    case "res":{const g=games.find(x=>x.id===b&&x.status!=="active");if(!g){go("",true);return}html=result(g,p[2]==="new");break}
    case "s":html=Sessions.sessView(b);if(!html){go("",true);return}break;
    case "run":html=Sessions.runView();if(!html){go("",true);return}break;
    case "sum":html=Sessions.sumView(b);if(!html){go("",true);return}break;
    default:go("",true);return;
  }
  if(a!=="run"&&a!==undefined&&a!=="")html=Sessions.runBar()+html;
  root.innerHTML=html;Sessions.paint();
  const f=root.querySelector("[data-autofocus]");if(f)f.focus({preventScroll:true});
}
const back=(href,label)=>`<a class="r-back" href="#practice${href?"/"+href:""}">‹ ${esc(label)}</a>`;

/* ---------- home ---------- */
function home(){
  const g=active();
  const card=k=>{const d=G[k],mine=games.filter(x=>x.game===k&&x.status!=="active").sort((a,b)=>b.finishedAt-a.finishedAt);
    const last=mine[0];
    const sub=last?`Last ${Store.fmtDate(last.date,{month:"short",day:"numeric"})}: ${last.status==="failed"?"Failed":d.fmt(last.result)}${d.label(last.setup)?" · "+d.label(last.setup):""}`:"Not played yet";
    return `<a class="r-row p-game" href="#practice/g/${k}"><span class="r-name">${esc(d.name)}<small>${esc(d.kind)} · ${esc(sub)}</small></span><span class="p-go">›</span></a>`};
  const cards=GROUPS.map(([lbl,ks])=>`<div class="label p-grp">${esc(lbl)}</div>${ks.map(card).join("")}`).join("");
  return `<header><h1>Practice</h1></header>
  ${Sessions.weekTotal()}
  ${Sessions.homeCard()}
  ${g?`<section class="panel r-active"><span class="pill live">In Progress</span><div class="r-title">${esc(G[g.game].name)}<small>${esc(G[g.game].label(g.setup))}</small></div>
    <div class="row"><button class="play" data-act="resume">Resume</button><button class="ghost" data-act="quit">Discard Game</button></div></section>`:""}
  ${Sessions.weekCard()}
  <section class="r-list"><h2 class="p-h2">Games</h2>${cards}</section>
  <section class="panel soon"><span class="pill">Coming Next</span><h2>More Practice Tools</h2>
    <ul><li>Build your own plan for a day</li><li>Practice time by discipline over any date range</li></ul></section>`;
}

/* ---------- game intro: rules, setup, average, history ---------- */
function optRow(name,list,cur){
  return `<div class="r-opts">${list.map(([v,l])=>`<button class="r-opt" data-act="opt" data-k="${name}" data-v="${v}" aria-pressed="${String(cur)===v}">${esc(l)}</button>`).join("")}</div>`;
}
function defaultOpts(k){const d=G[k];
  return {_k:k,...(d.opts?Object.fromEntries(Object.entries(d.opts).map(([n,l])=>[n,n==="dist"?150:n==="drv"?(Store.get("settings",{}).drv||240):(n==="holes"?"18":n==="x"?"3":l[0][0])])):{})}}
function intro(k){
  const d=G[k];
  if(opts._k!==k)opts=defaultOpts(k);
  const setup=d.start(opts),variant=d.variant(setup),st=stat(k,variant);
  let opt="";
  if(d.opts){
    for(const [n,l] of Object.entries(d.opts)){
      if(l==="drv")opt+=`<div class="r-field"><div class="label">Your normal driver carry</div><div class="stepper p-step"><button data-act="drv" data-v="-5" aria-label="Shorter">−</button><output>${opts.drv} yd</output><button data-act="drv" data-v="5" aria-label="Longer">+</button></div><p class="hint">Used for solid drives: carry within 30 yards of this.</p></div>`;
      else if(l==="range")opt+=`<div class="r-field"><div class="label">Target distance</div><div class="stepper p-step"><button data-act="dist" data-v="-5" aria-label="Shorter">−</button><output>${opts.dist} yd</output><button data-act="dist" data-v="5" aria-label="Longer">+</button></div></div>`;
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
  <details class="panel p-rules"><summary class="label">How It Works</summary><ul>${d.rules.map(r=>`<li>${esc(r)}</li>`).join("")}</ul></details>
  ${hist?`<section class="r-list"><div class="label">History</div>${hist}</section>`:""}`;
}

/* ---------- play ---------- */
function bar(n,total){return `<div class="p-bar"><i style="width:${Math.round(n/total*100)}%"></i></div>`}
function play(g){
  const d=G[g.game],s=d.replay(g.setup,g.log),k=g.game;let body="";
  const undo=g.log.length||pendingTee||(k==="updown"&&dcNext)?`<button class="ghost" data-act="undo">Undo</button>`:"<span></span>";
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
  }else if(k==="bsc"||k==="wedge"){
    const t=g.setup.order[s.n],drive=t==="D",lastShot=s.shots[s.shots.length-1];
    const live=s.ir.length?`average ${Math.round(sum(s.ir.map(x=>x.ft))/s.ir.length)} ft`:"";
    body=`<div class="p-head"><div class="label">Shot ${s.n+1} of 24${live?" · "+esc(live):""}</div>${bar(s.n,24)}</div>
    <div class="p-call">${drive?"Driver":t+" yd"}<span>${drive?"Aim at the middle · normal carry "+g.setup.drv+" yd":k==="wedge"?"Wedge to the target":"Iron to the target"}</span></div>
    <div class="b-entry">
      <label class="r-field"><span class="label">Carry (yd)</span><input class="r-input b-in" id="bCarry" type="number" inputmode="decimal" step="0.1" min="0" max="400" enterkeyhint="next" data-autofocus></label>
      <label class="r-field"><span class="label">Offline (yd)</span><input class="r-input b-in" id="bOff" type="number" inputmode="decimal" step="0.1" min="0" max="150" placeholder="0" enterkeyhint="done"></label>
      <div class="r-opts b-side">${[["L","Left"],["R","Right"]].map(([v,l])=>`<button class="r-opt" data-act="side" data-v="${v}" aria-pressed="${side===v}">${l}</button>`).join("")}</div>
    </div>
    <button class="play r-wide" data-act="shot">Save Shot</button>
    ${lastShot?`<p class="hint r-center">Last: ${lastShot.drive?"drive":lastShot.t+" yd"} · carry ${r1(lastShot.e.c)}, ${r1(lastShot.e.o)}${lastShot.e.s?" "+lastShot.e.s:""} offline → ${lastShot.drive?(lastShot.solid?"solid":"not solid"):Math.round(lastShot.ft)+" ft"}</p>`:""}`;
  }else if(k==="chipc"){
    const c=g.setup.order[s.n];
    body=`<div class="p-head"><div class="label">Chip ${s.n+1} of 18${s.n?` · average ${r1(s.avg)} ft`:""}</div>${bar(s.n,18)}</div>
    <div class="p-call">${c}<span>${CHIP_CALL[c]} · new hole, toss the ball</span></div>
    <div class="r-field"><div class="label">Where it finished</div><div class="c-zones">${CHIP_ZONES.map(([l],i)=>`<button class="p-btn${i<=2?" good":i===8?" bad":""}" data-act="log" data-v="${i}">${esc(l)}</button>`).join("")}</div></div>
    ${s.n?`<p class="hint r-center">Inside 6 ft: ${s.in6} · off the green: ${s.dc}</p>`:""}`;
  }else if(k==="chip20"){
    const y=g.setup.order[s.n];
    body=`<div class="p-head"><div class="label">Chip ${s.n+1} of 20${s.n?` · median ${r1(s.med)} ft`:""}</div>${bar(s.n,20)}</div>
    <div class="p-call">${y} yd<span>Pace it off · new hole, toss the ball</span></div>
    <div class="r-field"><div class="label">Where It Finished</div><div class="c-zones">${CHIP_ZONES.map(([l],i)=>`<button class="p-btn${i<=2?" good":i===8?" bad":""}" data-act="log" data-v="${i}">${esc(l)}</button>`).join("")}</div></div>
    ${s.n?`<p class="hint r-center">Inside 6 ft: ${s.in6} · off the green: ${s.dc}</p>`:""}`;
  }else if(k==="updown"){
    const c=g.setup.order[s.n];
    body=`<div class="p-head"><div class="label">Hole ${s.n+1} of 18 · ${s.total} strokes</div>${bar(s.n,18)}</div>
    <div class="p-call">${c==="I"?"Inside 25 yd":"25–50 yd"}<span>New hole, toss the ball, hole out</span></div>
    <button class="r-opt c-dc" data-act="dc" aria-pressed="${dcNext}">Chip Missed The Green</button>
    <div class="r-field"><div class="label">Strokes to hole out</div>${nums("ud",[1,2,3,4,5],null,6)}</div>
    ${s.n?`<div class="p-log">${g.log.map(e=>`<span class="${e.s<=2?"ok":e.s>=4?"no":""}">${e.s}${e.dc?"*":""}</span>`).join("")}</div><p class="hint">* chip missed the green</p>`:""}`;
  }else if(k==="skytrak"){
    body=`<div class="r-field"><label class="label" for="skScore">Combine score (0–100)</label><input class="r-input" id="skScore" type="number" inputmode="decimal" step="0.1" min="0" max="100" data-autofocus></div>
    <div class="r-field"><label class="label" for="skHcp">Handicap SkyTrak shows (optional)</label><input class="r-input" id="skHcp" type="text" inputmode="decimal" placeholder="e.g. 8.4 or +1.2"></div>
    <div class="r-field"><label class="label" for="skNote">Note (optional)</label><input class="r-input" id="skNote" type="text" placeholder="Targets, conditions…"></div>
    <button class="play r-wide" data-act="sksave">Save Result</button>`;
  }
  const st=stat(k,g.variant);
  return `${back("","Practice")}<header><h1>${esc(d.name)}</h1>${d.label(g.setup)?`<p class="sub">${esc(d.label(g.setup))}${st?" · average to beat "+fmtAvg(k,st.avg):""}</p>`:st?`<p class="sub">Average to beat ${fmtAvg(k,st.avg)}</p>`:""}</header>
  <section class="panel p-play">${body}</section>
  <div class="row p-foot">${undo}${k==="lag"?`<button class="ghost danger" data-act="fail">End As Failed</button>`:""}<button class="ghost" data-act="quit">Discard</button></div>`;
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
  }else if(k==="bsc"||k==="wedge"){
    const idx=myIndex(),ref=idx==null?10:idx;
    const bAt=t=>benchAt(benchFor(t).row,ref);
    const blow=s.ir.filter(x=>x.ft>2*bAt(x.t)).length,in15=s.ir.filter(x=>x.ft<=15).length;
    let lo=null,hi=null;if(idx!=null){HC.forEach((h,i)=>{if(h<=idx)lo=i});const f=HC.findIndex(h=>h>idx);hi=f<0?null:f}
    const mk=i=>i===lo||i===hi?"mark":"";
    const head=`<tr class="hd"><th></th>${HC_LABEL.map((l,i)=>`<td class="${mk(i)}">${l.replace(" hcp","")}</td>`).join("")}</tr>`;
    const bench=s.per.map(x=>`<tr><th>${x.t} yd<small>${x.stat==="median"?"median":"avg"}</small></th>${HC.map((h,i)=>`<td class="${mk(i)}">${x.row[i]!=null?x.row[i]:"—"}</td>`).join("")}</tr>`).join("");
    const srcs=[...new Set(s.per.map(x=>x.src))];
    extra=`<section class="panel"><div class="label">Plays Like, By Distance</div><table class="p-bench"><tr class="hd"><th></th><td>You</td><td>Plays like</td></tr>
      ${s.per.map(x=>`<tr><th>${x.t} yd</th><td>${Math.round(x.v)} ft ${x.stat==="median"?"median":"avg"}</td><td>${fmtHcp(r1(x.hc))}</td></tr>`).join("")}</table>
      <p class="hint">${k==="wedge"?`Inside 15 ft: ${in15} of 24. `:""}Blow-ups (more than double the ${idx==null?"10-handicap":"your-handicap"} benchmark): ${blow}.</p></section>
    <section class="panel"><div class="label">Benchmarks By Handicap (Feet)</div><div class="p-scroll"><table class="p-bench p-grid">${head}${bench}</table></div>
      <p class="hint">${srcs.map(esc).join(". ")}. ${idx==null?"Add rounds or past GHIN scores so the app can highlight the columns around your index.":`Highlighted: the columns around your index of ${idx.toFixed(1)}.`} Lou's tables stop at 20 handicap; beyond it the app extends the trend. On-course shots come from all kinds of lies, so the range usually flatters you a little.</p></section>
    ${k==="bsc"?`<section class="panel"><div class="label">Drives</div><div class="r-big">${s.solid} of 6 solid</div>
      <p class="hint">That's ${Math.round(s.solid/6*100)}%. Solid: carry of ${g.setup.drv-30} yd or more and within 20 yd of center. Below: Lou Stagner's Arccos numbers, % of drives that were solid by handicap, for the shortest, middle and longest hitters in each group. Six drives is a small sample, so watch the trend.</p>
      <table class="p-bench"><tr class="hd"><th></th><td>Shortest 10%</td><td>Middle</td><td>Longest 10%</td></tr>
      ${[0,1,2,3,4].map(i=>`<tr class="${mk(i)}"><th>${HC_LABEL[i]}</th><td>${LOU_SOLID.short[i]}%</td><td>${LOU_SOLID.mid[i]}%</td><td>${LOU_SOLID.long[i]}%</td></tr>`).join("")}</table>
      <div class="p-log">${s.dr.map(x=>`<span class="${x.solid?"ok":"no"}">${Math.round(x.e.c)} · ${r1(x.e.o)}${x.e.s||""}</span>`).join("")}</div></section>`:""}
    <section class="panel"><div class="label">Shots (Feet From Target)</div><div class="p-shots">${s.ir.map(x=>`<span class="${x.ft<=bAt(x.t)/2?"ok":x.ft>2*bAt(x.t)?"no":""}"><b>${Math.round(x.ft)}</b>${x.t} yd</span>`).join("")}</div></section>`;
  }else if(k==="chip20"){
    const idx=myIndex();
    const rows=[0,1,2,3,4].map(i=>[HC_LABEL[i],HC[i],...CHIP_YDS.map(y=>LOU_CHIP[y][i].toFixed(1))]);
    extra=`<section class="panel"><div class="label">Plays Like, By Distance</div><table class="p-bench"><tr class="hd"><th></th><td>Your median</td><td>Plays like</td></tr>
      ${s.per.map(x=>`<tr><th>${x.y} yd</th><td>${r1(x.med)} ft</td><td>${fmtHcp(r1(x.hc))}</td></tr>`).join("")}</table>
      <p class="hint">Inside 6 ft (holed included): ${s.in6} of 20 · off the green: ${s.dc} · median of all chips ${r1(s.med)} ft.</p></section>
    <section class="panel"><div class="label">Lou Stagner's Medians By Handicap (Feet)</div>${hcTable(CHIP_YDS.map(y=>y+" yd"),rows,idx)}
      <p class="hint">Arccos medians from the rough (Lou Stagner, newsletter #27). ${idx==null?"Add rounds or past GHIN scores so the app can highlight the rows around your index.":`Highlighted: the rows around your index of ${idx.toFixed(1)}.`} Lou's table stops at 20 handicap; beyond it the app extends the trend.</p></section>
    <section class="panel"><div class="label">Chips</div><div class="p-shots">${g.log.map((z,i)=>`<span class="${z<=2?"ok":z>=7?"no":""}"><b>${esc(CHIP_ZONES[z][0])}</b>${g.setup.order[i]} yd</span>`).join("")}</div></section>`;
  }else if(k==="chipc"){
    const idx=myIndex(),known=SG_PROX.map((v,i)=>[v,i]).filter(x=>x[0]!=null);
    const rows=known.map(([v,i])=>{const d=r1(v-g.result);return [HC_LABEL[i],HC[i],v+" ft",`<span class="${d>=0?"good":"bad"}">${d>=0?"+":"−"}${Math.abs(d).toFixed(1)}</span>`]});
    extra=`<section class="panel"><div class="label">Old Version</div>
      <p class="hint">This game is from the first Chipping Combine (short, medium and long). Inside 6 ft (holed included): ${s.in6} of 18 · off the green: ${s.dc}.</p></section>
    <section class="panel"><div class="label">Average leave by handicap, inside 50 yd (Shot Scope)</div>${hcTable(["Average","You vs them"],rows,idx)}
      <p class="hint">Plus means you finished closer than that handicap's average. ${idx==null?"Add rounds or past GHIN scores so the app can highlight the rows around your index.":`Highlighted: the rows around your index of ${idx.toFixed(1)}.`} On-course chips include bunkers and tougher lies.</p></section>
    <section class="panel"><div class="label">Chips</div><div class="p-shots">${g.log.map((z,i)=>`<span class="${z<=2?"ok":z>=7?"no":""}"><b>${esc(CHIP_ZONES[z][0])}</b>${g.setup.order[i]}</span>`).join("")}</div></section>`;
  }else if(k==="updown"){
    const idx=myIndex(),ud=Math.round(s.ud/18*100);
    const rows=HC.map((h,i)=>{if(SG_FINISH[i]==null)return [HC_LABEL[i],h,"—","—",SG_UD[i]+"%"];const b=r1(SG_FINISH[i]*18),d=r1(b-g.result);return [HC_LABEL[i],h,b.toFixed(1),`<span class="${d>=0?"good":"bad"}">${d>=0?"+":"−"}${Math.abs(d).toFixed(1)}</span>`,SG_UD[i]+"%"]});
    extra=`<section class="panel"><div class="label">Strokes gained vs benchmarks</div>${hcTable(["Strokes","Gained","Up & down"],rows,idx)}
      <p class="hint">You got up and down ${s.ud} of 18 (${ud}%) with ${s.dc} double chip${s.dc===1?"":"s"}. Benchmarks: Shot Scope's average shots to finish from inside 50 yards, times 18 (no 10-handicap figure was published). ${idx==null?"":`Highlighted: the rows around your index of ${idx.toFixed(1)}.`}</p></section>
    <section class="panel"><div class="label">Holes</div><div class="p-log">${g.log.map(e=>`<span class="${e.s<=2?"ok":e.s>=4?"no":""}">${e.s}${e.dc?"*":""}</span>`).join("")}</div></section>`;
  }else if(k==="skytrak"){
    const e=g.log[0]||{};
    extra=`<section class="panel"><div class="label">SkyTrak's numbers</div><p>Score ${esc(e.score)}${e.hcp?` · handicap ${esc(e.hcp)}`:""}</p>${e.note?`<p class="hint">${esc(e.note)}</p>`:""}</section>`;
  }else if(k==="range"){
    extra=`<section class="panel"><div class="label">Holes</div><div class="p-log">${s.scores.map(v=>`<span class="${v<0?"ok":v>1?"no":""}">${toPar(v)}</span>`).join("")}</div></section>`;
  }
  const now=stat(k,g.variant);
  return `${back("g/"+k,d.name)}
  <section class="panel r-sum"><div class="label">${esc(Store.fmtDate(g.date,{weekday:"short",month:"short",day:"numeric",year:"numeric"}))}${d.label(g.setup)?" · "+esc(d.label(g.setup)):""}</div>
    <div class="r-scoreline"><span class="r-big">${g.status==="failed"?"Failed":esc(d.fmt(g.result))}</span></div>${verdict}
    ${now?`<p class="hint">Average now ${fmtAvg(k,now.avg)} over your last ${now.n} · best ${esc(d.fmt(now.best))}</p>`:""}</section>
  ${extra}
  ${g.countedFor?`<section class="panel s-count"><p class="s-donenote">✓ Counted as this week's ${esc(Sessions.title(g.countedFor))}</p></section>`:fresh&&!Sessions.running()&&g.status==="done"?(()=>{const m=Sessions.matchSession(k);return m?`<section class="panel s-count"><p class="hint">Played on its own, so it's logged under Extra Practice. Want it to count for this week's plan?</p><button class="ghost" data-act="countsess" data-s="${m}">Count As This Week's ${esc(Sessions.title(m))}</button></section>`:""})():""}
  <div class="row r-actions">${fresh?`<a class="play" href="#practice${Sessions.running()?"/run":""}">${Sessions.running()?"Back To Session":"Done"}</a>`:"<span></span>"}<button class="ghost danger" data-act="delgame" data-id="${g.id}">Delete</button></div>`;
}

function hcTable(cols,rows,idx){
  let lo=null,hi=null;if(idx!=null){rows.forEach(r=>{if(r[1]<=idx)lo=r});hi=rows.find(r=>r[1]>idx)||null}
  return `<table class="p-bench"><tr class="hd"><th></th>${cols.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>${rows.map(r=>`<tr class="${r===lo||r===hi?"mark":""}"><th>${esc(r[0])}</th>${r.slice(2).map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
}

/* ---------- actions ---------- */
function finishIf(g){
  const s=G[g.game].replay(g.setup,g.log);
  if(s.done){g.status="done";g.result=s.result;g.finishedAt=Date.now();save();if(Sessions.running())Sessions.addGame(g.id);else Sessions.logFree(g,G[g.game].name);go("res/"+g.id+"/new",true);return true}
  save();return false;
}
const act={
  resume(){go("play")},
  quit(){if(confirm("Discard this game? Nothing from it will be saved.")){games=games.filter(g=>g.status!=="active");pendingTee=null;save();go("",true);render()}},
  open(el){go("res/"+el.dataset.id)},
  opt(el){opts[el.dataset.k]=el.dataset.v;render()},
  drv(el){opts.drv=Math.max(180,Math.min(330,(+opts.drv||240)+ +el.dataset.v));render()},
  side(el){side=side===el.dataset.v?"":el.dataset.v;root.querySelectorAll(".b-side .r-opt").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===side))},
  shot(){const g=active();if(!g)return;const ci=root.querySelector("#bCarry"),oi=root.querySelector("#bOff");
    const c=parseFloat(ci.value),o=oi.value===""?0:parseFloat(oi.value);
    if(!(c>=0&&c<=400)){ci.focus();ci.classList.add("bad");return}
    if(!(o>=0&&o<=150)){oi.focus();oi.classList.add("bad");return}
    g.log.push({c,o,s:o?side:""});side="";if(!finishIf(g))render()},
  dc(){dcNext=!dcNext;render()},
  ud(el){const g=active();if(!g)return;g.log.push({s:+el.dataset.v,dc:dcNext});dcNext=false;if(!finishIf(g))render()},
  udmore(el){const g=active();if(!g)return;const v=parseInt(prompt("How many strokes?",""),10);if(v>=+el.dataset.min&&v<=20){g.log.push({s:v,dc:dcNext});dcNext=false;if(!finishIf(g))render()}},
  sksave(){const g=active();if(!g)return;const si=root.querySelector("#skScore"),score=parseFloat(si.value);
    if(!(score>=0&&score<=100)){si.focus();si.classList.add("bad");return}
    g.log=[{score,hcp:root.querySelector("#skHcp").value.trim(),note:root.querySelector("#skNote").value.trim()}];finishIf(g)},
  countsess(el){const id=(route()||[])[1],g=games.find(x=>x.id===id);if(!g)return;g.countedFor=el.dataset.s;save();Sessions.countGame(g.id,el.dataset.s);render()},
  dist(el){opts.dist=Math.max(125,Math.min(160,(+opts.dist||150)+ +el.dataset.v));render()},
  begin(el){
    if(active()){go("play");return}
    const k=el.dataset.k,d=G[k],setup=d.start(opts);dcNext=false;side="";
    if(setup.drv)Store.set("settings",{...Store.get("settings",{}),drv:setup.drv});
    const g={id:Store.uid(),game:k,variant:d.variant(setup),setup,log:[],status:"active",date:Store.today(),startedAt:Date.now()};
    games.push(g);save();pendingTee=null;go("play",true);
  },
  log(el){const g=active();if(!g)return;g.log.push(+el.dataset.v);if(!finishIf(g))render()},
  logmore(el){const g=active();if(!g)return;const min=+el.dataset.min,v=parseInt(prompt("How many?",""),10);if(v>=min&&v<=60){g.log.push(v);if(!finishIf(g))render()}},
  tee(el){const g=active();if(!g)return;const v=el.dataset.v;if(v==="p"){g.log.push({t:"p",a:null});pendingTee=null;if(!finishIf(g))render()}else{pendingTee=v;render()}},
  appr(el){const g=active();if(!g||!pendingTee)return;g.log.push({t:pendingTee,a:el.dataset.v});pendingTee=null;if(!finishIf(g))render()},
  undo(){const g=active();if(!g)return;if(pendingTee){pendingTee=null}else if(g.game==="updown"&&dcNext){dcNext=false}else g.log.pop();side="";save();render()},
  fail(){const g=active();if(!g)return;if(!confirm("End this game as failed? It's saved but left out of your average."))return;
    const s=G.lag.replay(g.setup,g.log);g.status="failed";g.result=null;g.passed=s.passed;g.finishedAt=Date.now();save();if(Sessions.running())Sessions.addGame(g.id);else Sessions.logFree(g,G[g.game].name);go("res/"+g.id+"/new",true)},
  delgame(el){if(confirm("Delete this game for good?")){const g=games.find(x=>x.id===el.dataset.id);games=games.filter(x=>x!==g);save();go(g?"g/"+g.game:"",true)}},
};
root.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el||!root.contains(el))return;const f=act[el.dataset.act]||Sessions.act[el.dataset.act];if(f){e.preventDefault();f(el)}});
/* Enter in the carry box moves to offline; Enter in offline saves the shot. */
root.addEventListener("keydown",e=>{if(e.key!=="Enter")return;
  if(e.target.id==="bCarry"){e.preventDefault();root.querySelector("#bOff")?.focus()}
  else if(e.target.id==="bOff"){e.preventDefault();act.shot()}
  else if(e.target.id==="skScore"||e.target.id==="skHcp"||e.target.id==="skNote"){e.preventDefault();act.sksave()}});
root.addEventListener("input",e=>e.target.classList?.remove("bad"));
/* For the Insights tab: names, formats and direction of each game. */
window.PracticeMeta={has:k=>!!G[k],name:k=>G[k].name,label:(k,s)=>G[k].label(s||{}),fmt:(k,v)=>G[k].fmt(v),avg:(k,v)=>fmtAvg(k,v),better:k=>G[k].better,bench:k=>!!G[k].bench,
  axis:(k,v)=>k==="range"?toPar(Math.round(v)):G[k].bench&&v<0?"+"+(+(-v).toFixed(1)):String(+(+v).toFixed(1))};
Sessions.init({go,render,
  launch(k,o){if(!G[k])return;const g=active();if(g&&g.game!==k){if(!confirm(`${G[g.game].name} is still in progress. Discard it and start ${G[k].name}?`))return;games=games.filter(x=>x!==g);save()}
    else if(g){go("play");return}
    opts={...defaultOpts(k),...o};go("g/"+k)},
  gameName:(k,o)=>G[k]?G[k].name+(k==="ladder"&&o&&o.set?" · "+(o.set==="irons"?"Irons":"Wedges"):""):k,
  gameSub:k=>G[k]?G[k].kind:"",
  gameRow:id=>{const x=games.find(g=>g.id===id);if(!x)return "";const d=G[x.game];
    return `<a class="r-row p-game" href="#practice/res/${x.id}"><span class="r-name">${esc(d.name)}<small>${esc(d.label(x.setup)||d.kind)}</small></span><span class="r-score p-res">${x.status==="failed"?"Failed":esc(d.fmt(x.result))}</span></a>`}});
window.addEventListener("hashchange",render);
render();
})();
