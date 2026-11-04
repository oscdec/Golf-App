/* App shell: tab switching, offline support, install button, protected storage */
(()=>{
  const TABS=["tempo","practice","rounds","insights"];
  const views=[...document.querySelectorAll(".view")];
  const links=[...document.querySelectorAll(".tab")];

  function show(){
    const want=location.hash.slice(1).split("/")[0];
    const tab=TABS.includes(want)?want:"tempo";
    views.forEach(v=>{v.hidden=v.dataset.tab!==tab});document.body.dataset.tab=tab;
    links.forEach(a=>{if(a.dataset.tab===tab)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
    window.scrollTo(0,0);
  }
  window.addEventListener("hashchange",show);
  show();

  /* Works offline after the first visit. Bump the cache version in sw.js on every release. */
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
  }

  /* Ask Chrome to treat saved data as protected so it isn't cleared to free space. */
  try{navigator.storage?.persist?.()}catch(e){}

  /* Install button appears only when Chrome says the app can be installed. */
  let prompt=null;const btn=document.getElementById("install");
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();prompt=e;if(btn)btn.hidden=false});
  btn?.addEventListener("click",async()=>{if(!prompt)return;prompt.prompt();try{await prompt.userChoice}catch(e){}prompt=null;btn.hidden=true});
  window.addEventListener("appinstalled",()=>{if(btn)btn.hidden=true});
})();
