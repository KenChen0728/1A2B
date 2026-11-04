/* 幾A幾B 的 service worker：
   開網頁時一律先向網站確認新版（不會卡在舊版），沒有網路時才用手機裡的備份，
   所以沒網路也打得開，可以玩邊緣人模式。Firebase、Google 字型都不經過這裡。 */
const CACHE='ab-v1';
const CORE=['./','Cubic_11.woff2','manifest.webmanifest','icon-192.png','favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);
  await self.clients.claim();})());});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.searchParams.has('_'))return;
  e.respondWith((async()=>{
    const nav=r.mode==='navigate', cache=await caches.open(CACHE);
    const net=fetch(nav?u.origin+u.pathname:r,{cache:'no-cache'}).then(res=>{
      if(res&&res.ok){const k=nav?'./':r;cache.put(k,res.clone()).catch(()=>{});}
      return res;});
    /* 網路太慢時先用備份，不要讓人看白畫面；新版在背景存好，遊戲內的更新提示會接手 */
    const slow=new Promise(ok=>setTimeout(()=>ok(null),nav?4000:6000));
    try{const res=await Promise.race([net,slow]);if(res)return res;}catch(err){}
    const hit=await cache.match(nav?'./':r,{ignoreSearch:true});
    return hit||net;
  })());
});
