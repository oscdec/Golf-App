/* Shared storage helpers. All app data lives in this phone's browser storage under keys starting with "rg."
   (plus the Tempo tab's older "tempoFrames" key). Backup/restore copies exactly these keys. */
const Store=(()=>{
  const PREFIX="rg.",EXTRA=["tempoFrames"];
  function get(k,fallback){
    try{const v=localStorage.getItem(PREFIX+k);return v==null?fallback:JSON.parse(v)}catch(e){return fallback}
  }
  function set(k,v){
    try{localStorage.setItem(PREFIX+k,JSON.stringify(v));return true}
    catch(e){alert("Couldn't save. The phone's storage for this app may be full.");return false}
  }
  const isAppKey=k=>k.startsWith(PREFIX)||EXTRA.includes(k);
  function appKeys(){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(isAppKey(k))out.push(k)}return out}
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const today=()=>iso(new Date());
  const fmtDate=(s,opts)=>{const [y,m,d]=String(s).split("-").map(Number);if(!y)return "";
    return new Date(y,m-1,d).toLocaleDateString(undefined,opts||{month:"short",day:"numeric",year:"numeric"})};
  return {get,set,appKeys,isAppKey,uid,today,iso,fmtDate};
})();
