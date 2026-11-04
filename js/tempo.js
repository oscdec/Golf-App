/* Tempo tab: frame-based swing tempo trainer */
(()=>{
const $=id=>document.getElementById(id);
const S={back:24,down:8,fps:30,rest:4,lock:true,ratio:3,quiet:false,countIn:true,tmode:"up",tlen:600,awake:false};
try{Object.assign(S,JSON.parse(localStorage.getItem("tempoFrames")||"{}"))}catch(e){}
S.lock=true; /* the lock starts on every time; only the checkbox turns it off */
if(S.ratio!==2&&S.ratio!==3)S.ratio=3;
if(S.back!==S.down*S.ratio)S.down=Math.max(2,Math.round(S.back/S.ratio)),S.back=S.down*S.ratio;
if(S.fps!==30){S.back=Math.round(S.back*30/S.fps);S.down=Math.round(S.down*30/S.fps);S.fps=30}
const save=()=>{try{localStorage.setItem("tempoFrames",JSON.stringify(S))}catch(e){}};

const FULL=[[18,6],[21,7],[24,8],[27,9],[30,10]], SHORT=[[14,7],[16,8],[18,9],[20,10],[22,11]];
function chips(el,list){el.innerHTML="";list.forEach(([b,d])=>{const c=document.createElement("button");c.className="chip";c.textContent=b+"/"+d;c.dataset.b=b;c.dataset.d=d;c.onclick=()=>{S.back=b;S.down=d;S.ratio=b/d;render()};el.appendChild(c)})}
chips($("pFull"),FULL);chips($("pShort"),SHORT);

let cells=[];
function buildStrip(){
  const n=S.back+S.down,strip=$("strip");strip.style.gridTemplateColumns=`repeat(${n+1},minmax(0,1fr))`;strip.innerHTML="";cells=[];
  for(let i=0;i<=n;i++){const c=document.createElement("div");c.className="cell "+(i<S.back?"bk":"dn");if(i===0||i===S.back||i===n)c.classList.add("mark");strip.appendChild(c);cells.push(c)}
}
let render=function(){
  const f=S.fps,ms=x=>Math.round(x/f*1000);
  $("big").innerHTML=`<span class="b">${S.back}</span><span class="s">/</span><span class="d">${S.down}</span>`;
  $("sRatio").textContent=(S.back/S.down).toFixed(2)+" : 1";
  $("sBack").textContent=ms(S.back)+" ms";$("sDown").textContent=ms(S.down)+" ms";
  $("sTotal").textContent=((S.back+S.down)/f).toFixed(2)+" s";
  $("backOut").textContent=S.back;$("downOut").textContent=S.down;
  $("stripLabel").textContent=`${S.back+S.down} frames at ${f} fps · ${(1000/f).toFixed(1)} ms each`;
  $("tTop").textContent="Top · "+S.back;$("tImp").textContent="Impact · "+(S.back+S.down);
  $("rest").value=S.rest;$("restOut").textContent=fmtRest(S.rest);
  $("lock").checked=S.lock;$("lockText").textContent=`Lock ${S.ratio}:1 ratio`;$("quiet").checked=S.quiet;$("countIn").checked=S.countIn;$("awake").checked=S.awake;
  document.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed",+c.dataset.b===S.back&&+c.dataset.d===S.down));
  buildStrip();save();
};
function fmtRest(r){return (r<10?r.toFixed(1):String(Math.round(r*10)/10))+" s"}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function setBack(v){S.back=clamp(v,6,90);if(S.lock){S.down=clamp(Math.round(S.back/S.ratio),2,45);S.back=S.down*S.ratio}render()}
function setDown(v){S.down=clamp(v,2,45);if(S.lock){S.back=clamp(S.down*S.ratio,6,90);S.down=S.back/S.ratio}render()}
$("backMinus").onclick=()=>setBack(S.back-(S.lock?S.ratio:1));$("backPlus").onclick=()=>setBack(S.back+(S.lock?S.ratio:1));
$("downMinus").onclick=()=>setDown(S.down-1);$("downPlus").onclick=()=>setDown(S.down+1);
$("rest").oninput=e=>{S.rest=+e.target.value;$("restOut").textContent=fmtRest(S.rest);save()};
$("lock").onchange=e=>{S.lock=e.target.checked;if(S.lock)setDown(S.down);else render()};
$("quiet").onchange=e=>{S.quiet=e.target.checked;save()};
$("countIn").onchange=e=>{S.countIn=e.target.checked;save()};
$("awake").onchange=async e=>{S.awake=e.target.checked;save();
  if(!running)return;
  if(S.awake){try{wake=await navigator.wakeLock?.request("screen")}catch(err){}}else{try{wake?.release()}catch(err){}wake=null}};

/* audio: render one rep + pause into a WAV and loop it in an <audio> element.
   Timing is baked into the samples, and media playback keeps running with the screen off. */
const SR=22050,LEAD=0.3;
let audio=new Audio(),url=null,running=false,lastPos=0,loop=null,wake=null,reloadT=null;
audio.loop=true;audio.preload="auto";
function makeLoop(){
  const f=S.fps,B=S.back/f,D=S.down/f;
  /* count-in: the same takeaway/top/impact pattern, low and soft, then a full-swing-length gap (backswing + downswing) */
  const T0=S.countIn?LEAD+B+D+B+D:LEAD,tTop=T0+B,tImp=tTop+D,len=tImp+S.rest;
  const n=Math.round(len*SR),pcm=new Int16Array(n);
  const tone=(t,freq,dur,amp)=>{const s0=Math.round(t*SR),m=Math.round(dur*SR);
    for(let i=0;i<m&&s0+i<n;i++){const x=i/SR,env=Math.min(1,x/0.003)*Math.exp(-x*38/dur*0.15);
      const tri=2/Math.PI*Math.asin(Math.sin(2*Math.PI*freq*x));pcm[s0+i]=Math.max(-32767,Math.min(32767,pcm[s0+i]+tri*env*amp*32767))}};
  if(S.countIn){tone(LEAD,440,.07,.45);tone(LEAD+B,440,.07,.45);tone(LEAD+B+D,440,.07,.45)}
  tone(T0,660,.09,.85);tone(tTop,660,.09,.85);if(!S.quiet)tone(tImp,990,.12,.9);
  const buf=new ArrayBuffer(44+n*2),v=new DataView(buf),w=(o,str)=>{for(let i=0;i<4;i++)v.setUint8(o+i,str.charCodeAt(i))};
  w(0,"RIFF");v.setUint32(4,36+n*2,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,SR,true);v.setUint32(28,SR*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,n*2,true);
  new Int16Array(buf,44).set(pcm);
  if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
  loop={len,f,T0,back:S.back,down:S.down};return url;
}
/* end-of-session chime */
const chime=(()=>{const n=Math.round(1.4*SR),pcm=new Int16Array(n);
  [[0,784],[.18,988],[.36,1319]].forEach(([t,f])=>{const s0=Math.round(t*SR);for(let i=0;s0+i<n;i++){const x=i/SR;pcm[s0+i]+=Math.sin(2*Math.PI*f*x)*Math.min(1,x/.004)*Math.exp(-x*3.2)*0.3*32767}});
  const buf=new ArrayBuffer(44+n*2),v=new DataView(buf),w=(o,str)=>{for(let i=0;i<4;i++)v.setUint8(o+i,str.charCodeAt(i))};
  w(0,"RIFF");v.setUint32(4,36+n*2,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,SR,true);v.setUint32(28,SR*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,n*2,true);
  new Int16Array(buf,44).set(pcm);const a=new Audio(URL.createObjectURL(new Blob([buf],{type:"audio/wav"})));a.preload="auto";return a})();

/* session timer: counts while tones play, pauses on Stop */
let elapsed=0,runStart=null,finishing=false,done=false,ticker=null,lastMeta="";
const nowMs=()=>elapsed+(runStart?Date.now()-runStart:0);
const fmt=ms=>{const t=Math.max(0,Math.ceil(ms/1000)-0),h=Math.floor(t/3600),m=Math.floor(t%3600/60),sec=t%60;
  return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(sec).padStart(2,"0")};
function timerText(){
  if(S.tmode==="down"){const left=S.tlen*1000-nowMs();return fmt(left>0?Math.ceil(left/1000)*1000:0)}
  return fmt(Math.floor(nowMs()/1000)*1000);
}
function paintTimer(){
  const t=timerText();if($("clock").textContent!==t)$("clock").textContent=t;$("clock").classList.toggle("done",done);
  $("tLabel").textContent=done?"Session complete":S.tmode==="down"?(finishing?"Finishing this rep":"Remaining"):"Elapsed";
  $("mUp").setAttribute("aria-pressed",S.tmode==="up");$("mDown").setAttribute("aria-pressed",S.tmode==="down");
  $("tlen").value=String(S.tlen);$("tlen").hidden=S.tmode!=="down";
  updateMeta(t);
}
function updateMeta(t){
  if(!("mediaSession" in navigator))return;
  const title=`${t} ${S.tmode==="down"?"left":"elapsed"} · ${S.back}/${S.down}`,artist=`${fmtRest(S.rest)} pause between reps`;
  const key=title+artist;if(key===lastMeta)return;lastMeta=key;
  try{navigator.mediaSession.metadata=new MediaMetadata({title,artist,album:"Swing Tempo Frames"});
    if(S.tmode==="down"&&navigator.mediaSession.setPositionState)
      navigator.mediaSession.setPositionState({duration:S.tlen,position:Math.min(S.tlen,nowMs()/1000),playbackRate:1});}catch(e){}
}
function mediaSession(){
  if(!("mediaSession" in navigator))return;
  try{navigator.mediaSession.setActionHandler("play",()=>start());navigator.mediaSession.setActionHandler("pause",()=>stop());
    navigator.mediaSession.setActionHandler("stop",()=>stop());}catch(e){}
}
function phaseNow(){
  const pos=audio.currentTime%loop.len;
  lastPos=pos;
  const fr=Math.floor((pos-loop.T0)*loop.f),n=loop.back+loop.down;
  const ph=fr<0&&S.countIn&&pos>=LEAD?"Count-in":fr>=0&&fr<=n?"Swing":"Pause";
  return {fr,n,ph};
}
function tick(){
  if(!running)return;
  const {ph}=phaseNow();
  if(S.tmode==="down"&&!finishing&&nowMs()>=S.tlen*1000)finishing=true;
  if(finishing&&ph==="Pause"){finish();return}
  paintTimer();
}
function finish(){
  stop();done=true;finishing=false;elapsed=S.tlen*1000;paintTimer();
  try{chime.currentTime=0;chime.play()}catch(e){}
}
let shownPh="",shownLit=-1;
function draw(){
  if(!running)return;
  const {fr,n,ph}=phaseNow();
  if(ph!==shownPh){shownPh=ph;$("phase").textContent=ph;$("phase").dataset.p=ph}
  const lit=fr>=0&&fr<=n+6?Math.min(fr,n):-1;
  if(lit!==shownLit){shownLit=lit;cells.forEach((c,i)=>c.classList.toggle("on",i<=lit))}
  requestAnimationFrame(draw);
}
async function start(){
  if(running)return;
  if(done||(S.tmode==="down"&&nowMs()>=S.tlen*1000))resetTimer();
  audio.src=makeLoop();audio.currentTime=0;lastPos=0;
  try{await audio.play()}catch(e){$("status").textContent="Tap Start again to allow sound";return}
  $("status").textContent="";
  running=true;runStart=Date.now();mediaSession();
  try{navigator.mediaSession.playbackState="playing"}catch(e){}
  shownPh="";shownLit=-1;requestAnimationFrame(draw);clearInterval(ticker);ticker=setInterval(tick,500);paintTimer();
  $("play").textContent="Stop";$("play").setAttribute("aria-pressed","true");
  if(S.awake)try{wake=await navigator.wakeLock?.request("screen")}catch(e){}
}
function stop(){
  if(runStart){elapsed+=Date.now()-runStart;runStart=null}
  running=false;audio.pause();clearInterval(ticker);
  try{navigator.mediaSession.playbackState="paused"}catch(e){}
  $("phase").textContent="Ready";$("phase").dataset.p="";cells.forEach(c=>c.classList.remove("on"));
  $("play").textContent="Start";$("play").setAttribute("aria-pressed","false");try{wake?.release()}catch(e){}wake=null;
  paintTimer();
}
function resetTimer(){
  elapsed=0;runStart=running?Date.now():null;finishing=false;done=false;paintTimer();
}
function reload(){if(!running)return;clearTimeout(reloadT);reloadT=setTimeout(()=>{stop();start()},250)}
const _render=render;render=function(){_render();reload();paintTimer()};
$("rest").addEventListener("change",reload);$("quiet").addEventListener("change",reload);$("countIn").addEventListener("change",reload);
$("mUp").onclick=()=>{S.tmode="up";finishing=false;done=false;save();paintTimer()};
$("mDown").onclick=()=>{S.tmode="down";finishing=false;done=false;save();paintTimer()};
$("tlen").onchange=e=>{S.tlen=+e.target.value;finishing=false;done=false;save();paintTimer()};
$("reset").onclick=resetTimer;
$("play").onclick=()=>running?stop():start();
render();
})();
