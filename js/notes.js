/* Notes tab: seven boxes for the feels and cues I'm working on.
   "Update" saves what's in a box to its history (last 5 kept, newest first) and clears the box.
   Data: rg.notes = {cur:{area:text}, edited:{area:ms}, hist:{area:[{text,at}]}}.
   Exposes Notes.get(area) / Notes.name(area) so practice sessions can show the matching box. */
const Notes=(()=>{
  const AREAS=[["general","General"],["mental","Mental"],["driver","Driver"],["irons","Irons"],["wedges","Wedges"],["chipping","Chipping"],["putting","Putting"]];
  const KEEP=5;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let data=Store.get("notes",null)||{};
  data.cur=data.cur||{};data.edited=data.edited||{};data.hist=data.hist||{};
  const save=()=>Store.set("notes",data);
  const get=a=>data.cur[a]||"";
  const name=a=>(AREAS.find(x=>x[0]===a)||[a,a])[1];
  const when=ms=>{const d=new Date(ms);return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()===new Date().getFullYear()?undefined:"numeric"})};

  const root=document.getElementById("notesRoot");
  const open=new Set();      // boxes whose Previous notes list is showing
  const undo={};             // area -> {text,timer} for the Undo bar after Update

  function card([a,label]){
    const h=data.hist[a]||[],u=undo[a];
    const prev=h.map((n,i)=>`<li><div class="n-when">${esc(when(n.at))}</div><div class="n-text">${esc(n.text)}</div>
      <button class="ghost sm" data-act="restore" data-a="${a}" data-i="${i}">Put back in the box</button></li>`).join("");
    return `<section class="panel n-card" data-a="${a}">
      <div class="n-top"><h2 id="n-${a}">${esc(label)}</h2><span class="hint" data-edited="${a}">${data.edited[a]&&get(a)?"Edited "+esc(when(data.edited[a])):""}</span></div>
      <textarea class="r-input n-box" data-a="${a}" spellcheck="false" autocapitalize="sentences" aria-labelledby="n-${a}" placeholder="Feels and cues for ${esc(label.toLowerCase())}…">${esc(get(a))}</textarea>
      ${u?`<div class="n-undo" role="status"><span>Saved to Previous notes and cleared.</span><button class="ghost sm" data-act="undo" data-a="${a}">Undo</button></div>`:""}
      <div class="row n-acts"><button class="ghost" data-act="update" data-a="${a}">Update</button>
        <button class="ghost" data-act="prev" data-a="${a}" aria-expanded="${open.has(a)}"${h.length?"":" disabled"}>Previous notes${h.length?` (${h.length})`:""}</button></div>
      ${open.has(a)&&h.length?`<ol class="n-prev">${prev}</ol>`:""}
    </section>`;
  }
  function render(){
    if(!root)return;
    root.innerHTML=`<header><h1>Notes</h1><p class="sub">The feels and cues you're working on. <b>Update</b> saves what's in a box to Previous notes and clears it so you can start fresh. The last ${KEEP} are kept.</p></header>${AREAS.map(card).join("")}`;
  }
  const rerender=a=>{const el=root.querySelector(`.n-card[data-a="${a}"]`);if(!el)return render();
    const tmp=document.createElement("div");tmp.innerHTML=card(AREAS.find(x=>x[0]===a));el.replaceWith(tmp.firstElementChild)};

  let saveT=null;
  root?.addEventListener("input",e=>{const t=e.target.closest(".n-box");if(!t)return;const a=t.dataset.a;
    data.cur[a]=t.value;data.edited[a]=Date.now();
    const lab=root.querySelector(`[data-edited="${a}"]`);if(lab)lab.textContent=t.value?"Edited "+when(data.edited[a]):"";
    if(undo[a]){clearTimeout(undo[a].timer);delete undo[a];root.querySelector(`.n-card[data-a="${a}"] .n-undo`)?.remove()}
    clearTimeout(saveT);saveT=setTimeout(save,400)});
  const flush=()=>{if(saveT){clearTimeout(saveT);saveT=null;save()}};
  root?.addEventListener("focusout",flush);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)flush()});
  window.addEventListener("pagehide",flush);

  const act={
    update(a){
      const text=(data.cur[a]||"").trim();if(!text){root.querySelector(`.n-box[data-a="${a}"]`)?.focus();return}
      flush();
      const h=data.hist[a]=data.hist[a]||[];h.unshift({text,at:Date.now()});const dropped=h.length>KEEP?h.pop():null;
      const before=data.cur[a];data.cur[a]="";data.edited[a]=Date.now();save();
      if(undo[a])clearTimeout(undo[a].timer);
      undo[a]={text:before,dropped,timer:setTimeout(()=>{delete undo[a];rerender(a)},10000)};
      rerender(a);
    },
    undo(a){const u=undo[a];if(!u)return;clearTimeout(u.timer);delete undo[a];
      const h=data.hist[a]||[];h.shift();if(u.dropped)h.push(u.dropped);data.cur[a]=u.text;data.edited[a]=Date.now();save();rerender(a)},
    prev(a){open.has(a)?open.delete(a):open.add(a);rerender(a)},
    restore(a,el){const n=(data.hist[a]||[])[+el.dataset.i];if(!n)return;
      if(get(a).trim()&&get(a).trim()!==n.text&&!confirm("Replace what's in the box now with this note?"))return;
      data.cur[a]=n.text;data.edited[a]=Date.now();save();open.delete(a);rerender(a);root.querySelector(`.n-box[data-a="${a}"]`)?.focus()},
  };
  root?.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const f=act[el.dataset.act];if(f){e.preventDefault();f(el.dataset.a,el)}});
  window.addEventListener("hashchange",()=>{if(location.hash.slice(1).split("/")[0]==="notes"){
    const focused=document.activeElement&&root.contains(document.activeElement);if(!focused){data=Store.get("notes",data);render()}}});
  render();
  return {get,name,AREAS};
})();
