/* Backup and restore: one JSON file holding every app key (see Store). Panel lives in the Insights tab. */
const Backup=(()=>{
  const APP="Resonant Golf",FORMAT=1;
  const meta=()=>Store.get("meta",{});
  function build(){
    const data={};
    Store.appKeys().filter(k=>k!=="rg.meta").forEach(k=>{try{data[k]=JSON.parse(localStorage.getItem(k))}catch(e){data[k]=localStorage.getItem(k)}});
    return JSON.stringify({app:APP,format:FORMAT,exported:new Date().toISOString(),data},null,1);
  }
  const fileName=ext=>`resonant-golf-backup-${Store.today()}.${ext}`;
  function mark(){Store.set("meta",{...meta(),lastBackup:Date.now()});paint()}
  function download(){
    const url=URL.createObjectURL(new Blob([build()],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=fileName("json");document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);mark();
  }
  function shareFile(){
    if(!navigator.canShare)return null;
    const json=build();
    for(const [type,ext] of [["application/json","json"],["text/plain","txt"]]){
      const f=new File([json],fileName(ext),{type});
      try{if(navigator.canShare({files:[f]}))return f}catch(e){}
    }
    return null;
  }
  async function share(){
    const f=shareFile();if(!f){download();return}
    try{await navigator.share({files:[f],title:"Resonant Golf backup"});mark()}catch(e){/* cancelled */}
  }
  function since(){
    const last=meta().lastBackup||0;
    return Store.get("rounds",[]).filter(r=>r.status==="done"&&(r.finishedAt||0)>last).length;
  }
  function statusText(){
    const last=meta().lastBackup;
    if(!last)return "No backup yet.";
    const n=since(),d=new Date(last).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
    return `Last backup ${d}.`+(n?` ${n} round${n>1?"s":""} played since.`:" Up to date.");
  }
  function restore(file){
    const rd=new FileReader();
    rd.onload=()=>{
      let obj;try{obj=JSON.parse(rd.result)}catch(e){alert("That file isn't a Resonant Golf backup.");return}
      if(!obj||obj.app!==APP||typeof obj.data!=="object"){alert("That file isn't a Resonant Golf backup.");return}
      const keys=Object.keys(obj.data).filter(Store.isAppKey);
      const rounds=(obj.data["rg.rounds"]||[]).filter(r=>r.status==="done").length,courses=(obj.data["rg.courses"]||[]).length;
      const when=obj.exported?new Date(obj.exported).toLocaleString():"an unknown date";
      if(!confirm(`Restore the backup from ${when}?\n\nIt has ${rounds} round${rounds===1?"":"s"} and ${courses} course${courses===1?"":"s"}. Everything currently in the app on this phone will be replaced.`))return;
      Store.appKeys().forEach(k=>localStorage.removeItem(k));
      try{keys.forEach(k=>localStorage.setItem(k,JSON.stringify(obj.data[k])))}catch(e){alert("Restore failed: the phone ran out of storage.");return}
      Store.set("meta",{lastBackup:Date.now()});
      location.reload();
    };
    rd.readAsText(file);
  }
  function paint(){const s=document.getElementById("bkStatus");if(s)s.textContent=statusText()}
  function init(){
    const p=document.getElementById("dataPanel");if(!p)return;
    p.innerHTML=`<h2>Your data</h2>
      <p class="hint">Everything is saved on this phone only. A backup file lets you get it all back if Chrome's data is cleared or you switch phones. Saving puts the file in your Downloads; sharing lets you send it to Google Drive or email.</p>
      <div class="row"><button class="play" id="bkSave">Save backup</button><button class="ghost" id="bkShare" hidden>Share backup…</button></div>
      <p class="hint" id="bkStatus"></p>
      <div class="row"><button class="ghost" id="bkRestore">Restore from a backup file</button><input type="file" id="bkFile" accept=".json,.txt,application/json,text/plain" hidden></div>`;
    document.getElementById("bkSave").onclick=download;
    const sh=document.getElementById("bkShare");sh.hidden=!shareFile();sh.onclick=share;
    const fi=document.getElementById("bkFile");
    document.getElementById("bkRestore").onclick=()=>{fi.value="";fi.click()};
    fi.onchange=()=>{if(fi.files[0])restore(fi.files[0])};
    paint();
  }
  window.addEventListener("hashchange",paint);
  document.addEventListener("DOMContentLoaded",init);
  return {download,share,since,statusText,paint,init};
})();
