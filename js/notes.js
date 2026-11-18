/* Notes tab: seven boxes for the feels and cues I'm working on.
   The box is where I write; what I type is kept as I go (so nothing is lost) but isn't final until I tap Update.
   "Update" saves a dated copy of the box to Previous Notes (last 5 kept, newest first) and leaves the text in the box.
   Data: rg.notes = {cur:{area:text}, edited:{area:ms}, hist:{area:[{text,at}]}}.
   Exposes Notes.get(area) (the last Update; the box text if the box was never updated) and Notes.name(area),
   so practice sessions can show the matching box. */
const Notes=(()=>{
  const AREAS=[["general","General"],["mental","Mental"],["driver","Driver"],["irons","Irons"],["wedges","Wedges"],["chipping","Chipping"],["putting","Putting"]];
  const KEEP=5;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let data=Store.get("notes",null)||{};
  function tidy(){data.cur=data.cur||{};data.edited=data.edited||{};data.hist=data.hist||{};
    /* Until Nov 18, Update cleared the box. Put the last update back in any box it left empty. */
    AREAS.forEach(([a])=>{const h=data.hist[a];if(!(data.cur[a]||"").trim()&&h&&h.length)data.cur[a]=h[0].text})}
  tidy();
  const save=()=>Store.set("notes",data);
  const box=a=>data.cur[a]||"";
  const last=a=>(data.hist[a]||[])[0]||null;
  const get=a=>{const l=last(a);return l?l.text:box(a)};
  const name=a=>(AREAS.find(x=>x[0]===a)||[a,a])[1];
  const when=ms=>{const d=new Date(ms);return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()===new Date().getFullYear()?undefined:"numeric"})};
  const unsaved=a=>{const l=last(a),t=box(a).trim();return l?t!==l.text:!!t};
  function status(a){const l=last(a);
    if(unsaved(a))return `<span class="n-dirty">Not saved yet: tap Update</span>${l?` · last update ${esc(when(l.at))}`:""}`;
    return l?`Saved ${esc(when(l.at))}`:""}

  const root=document.getElementById("notesRoot");
  const open=new Set();      // boxes whose Previous Notes list is showing
  const undo={};             // area -> {dropped,timer} for the Undo bar after Update

  function card([a,label]){
    const h=data.hist[a]||[],u=undo[a];
    const prev=h.map((n,i)=>`<li><div class="n-when">${esc(when(n.at))}${i===0?" · latest":""}</div><div class="n-text">${esc(n.text)}</div>
      ${n.text!==box(a).trim()?`<button class="ghost sm" data-act="restore" data-a="${a}" data-i="${i}">Put Back In The Box</button>`:""}</li>`).join("");
    return `<section class="panel n-card" data-a="${a}">
      <div class="n-top"><h2 id="n-${a}">${esc(label)}</h2><span class="hint" data-status="${a}">${status(a)}</span></div>
      <textarea class="r-input n-box" data-a="${a}" spellcheck="false" autocapitalize="sentences" aria-labelledby="n-${a}" placeholder="Feels and cues for ${esc(label.toLowerCase())}…">${esc(box(a))}</textarea>
      ${u?`<div class="n-undo" role="status"><span>Saved to Previous Notes.</span><button class="ghost sm" data-act="undo" data-a="${a}">Undo</button></div>`:""}
      <div class="row n-acts"><button class="ghost" data-act="update" data-a="${a}">Update</button>
        <button class="ghost" data-act="prev" data-a="${a}" aria-expanded="${open.has(a)}">Previous Notes${h.length?` (${h.length})`:""}</button></div>
      ${open.has(a)?(h.length?`<ol class="n-prev">${prev}</ol>`:`<p class="hint n-none">No previous notes yet. When you tap <b>Update</b>, a dated copy of what's in the box is saved here (the last ${KEEP} are kept). The text stays in the box.</p>`):""}
    </section>`;
  }
  function render(){
    if(!root)return;
    root.innerHTML=`<header><h1>Notes</h1><p class="sub">The feels and cues you're working on. Type freely; when it's right, tap <b>Update</b>. That saves a dated copy to Previous Notes (the last ${KEEP} are kept) and leaves the text in the box. Practice sessions show your latest update.</p></header>${AREAS.map(card).join("")}`;
  }
  const rerender=a=>{const el=root.querySelector(`.n-card[data-a="${a}"]`);if(!el)return render();
    const tmp=document.createElement("div");tmp.innerHTML=card(AREAS.find(x=>x[0]===a));el.replaceWith(tmp.firstElementChild)};

  let saveT=null;
  root?.addEventListener("input",e=>{const t=e.target.closest(".n-box");if(!t)return;const a=t.dataset.a;
    data.cur[a]=t.value;data.edited[a]=Date.now();
    const lab=root.querySelector(`[data-status="${a}"]`);if(lab){const v=status(a);if(lab.innerHTML!==v)lab.innerHTML=v}
    if(undo[a]){clearTimeout(undo[a].timer);delete undo[a];root.querySelector(`.n-card[data-a="${a}"] .n-undo`)?.remove()}
    clearTimeout(saveT);saveT=setTimeout(save,400)});
  const flush=()=>{if(saveT){clearTimeout(saveT);saveT=null;save()}};
  root?.addEventListener("focusout",flush);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)flush()});
  window.addEventListener("pagehide",flush);

  const act={
    update(a){
      const text=box(a).trim();if(!text){root.querySelector(`.n-box[data-a="${a}"]`)?.focus();return}
      flush();
      if(!unsaved(a)){rerender(a);return}
      const h=data.hist[a]=data.hist[a]||[];h.unshift({text,at:Date.now()});const dropped=h.length>KEEP?h.pop():null;save();
      if(undo[a])clearTimeout(undo[a].timer);
      undo[a]={dropped,timer:setTimeout(()=>{delete undo[a];rerender(a)},10000)};
      rerender(a);
    },
    undo(a){const u=undo[a];if(!u)return;clearTimeout(u.timer);delete undo[a];
      const h=data.hist[a]||[];h.shift();if(u.dropped)h.push(u.dropped);save();rerender(a)},
    prev(a){open.has(a)?open.delete(a):open.add(a);rerender(a)},
    restore(a,el){const n=(data.hist[a]||[])[+el.dataset.i];if(!n)return;
      if(unsaved(a)&&box(a).trim()&&!confirm("What's in the box now hasn't been saved with Update. Replace it with this note?"))return;
      data.cur[a]=n.text;data.edited[a]=Date.now();save();open.delete(a);rerender(a);root.querySelector(`.n-box[data-a="${a}"]`)?.focus()},
  };
  root?.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(!el)return;const f=act[el.dataset.act];if(f){e.preventDefault();f(el.dataset.a,el)}});
  window.addEventListener("hashchange",()=>{if(location.hash.slice(1).split("/")[0]==="notes"){
    const focused=document.activeElement&&root.contains(document.activeElement);if(!focused){data=Store.get("notes",data);tidy();render()}}});
  render();
  return {get,name,AREAS};
})();
