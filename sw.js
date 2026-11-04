/* Offline support.
   App files: network first, so updates arrive whenever there's signal; the saved copy is used offline.
   Fonts: saved copy first, since they never change.
   Bump VERSION on every release. */
const VERSION="golf-v9";
const APP=["./","index.html","css/app.css","js/app.js","js/store.js","js/handicap.js","js/backup.js","js/tempo.js","js/rounds.js","js/practice.js","js/insights.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(APP)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),ms))}

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);

  if(url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com"){
    e.respondWith(caches.open(VERSION).then(async c=>{
      const hit=await c.match(req);if(hit)return hit;
      const res=await fetch(req);c.put(req,res.clone());return res;
    }));
    return;
  }

  if(url.origin!==location.origin)return;

  e.respondWith((async()=>{
    const c=await caches.open(VERSION);
    try{
      /* no-cache: always check with the server (cheap if unchanged), so updates show on the next open
         instead of waiting out GitHub Pages' 10-minute browser cache */
      const res=await Promise.race([fetch(req.url,{cache:"no-cache",credentials:"same-origin"}),timeout(4000)]);
      if(res.ok)c.put(req,res.clone());
      return res;
    }catch(err){
      return (await c.match(req,{ignoreSearch:true}))||(req.mode==="navigate"?c.match("index.html"):Response.error());
    }
  })());
});
