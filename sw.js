/* 幾A幾B 的 service worker：
   開網頁時一律先向網站確認新版（不會卡在舊版），沒有網路、網路卡住或網站回錯誤時才用手機裡的備份，
   所以沒網路也打得開，可以玩邊緣人模式。Firebase、Google 字型都不經過這裡。
   這個網域還放了其他程式，快取是共用的：名稱一律用 1a2b- 開頭，只清自己的舊快取，別人的絕對不動。 */
const PREFIX='1a2b-', CACHE=PREFIX+'v2', OLD=['ab-v1'];
const CORE=['./','manifest.webmanifest','favicon-32.png','icon-180.png','icon-192.png','icon-512.png'];
const NAV_MS=3000, ASSET_MS=6000;
const ROOT=new URL('./',self.registration.scope).pathname;
const isShell=u=>u.pathname===ROOT||u.pathname===ROOT+'index.html';

self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'no-cache'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const k of await caches.keys())if((k.startsWith(PREFIX)&&k!==CACHE)||OLD.includes(k))await caches.delete(k);
  await self.clients.claim();})());});

/* 萬一連備份都沒有，也不要出現瀏覽器的錯誤頁 */
const offlinePage=()=>new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>幾A幾B</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8fb;color:#1f2733;font:17px/1.6 -apple-system,BlinkMacSystemFont,'PingFang TC','Microsoft JhengHei',sans-serif;text-align:center"><div style="padding:24px"><h1 style="font-size:24px;color:#1d3a6b;margin:0 0 8px">目前沒有網路</h1><p style="margin:0 0 20px">連上網路後再打開一次，就能開始玩。</p><button onclick="location.reload()" style="font:inherit;font-weight:700;min-height:48px;padding:0 24px;border:0;border-radius:12px;background:#1d3a6b;color:#fff">重新整理</button></div></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8'}});

/* 先問網路：離線或錯誤頁立刻改用備份，網路卡住最多等 ms 毫秒；逾時後新版仍在背景存好，遊戲內的更新提示會接手 */
async function fresh(e,url,key,ms,store){
  const cache=await caches.open(CACHE);
  const net=fetch(url,{cache:'no-cache'}).then(res=>{
    if(store&&res&&res.ok){const copy=res.clone();e.waitUntil(cache.put(key,copy).catch(()=>{}));}
    return res;});
  e.waitUntil(net.catch(()=>{}));
  let timer=null, res=null;
  const slow=new Promise(ok=>{timer=setTimeout(()=>ok(null),ms);});
  try{res=await Promise.race([net,slow]);}catch(err){}
  clearTimeout(timer);
  if(res&&res.ok)return res;
  const hit=await cache.match(key,{ignoreSearch:true});
  if(hit)return hit;
  if(res)return res;
  return net; /* 沒有備份：只能繼續等網路 */
}

self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.searchParams.has('_')||!u.pathname.startsWith(ROOT))return;
  if(r.mode==='navigate'){
    if(!isShell(u))return; /* 直接打開圖片之類的檔案，交給瀏覽器，不要蓋掉遊戲本體的備份 */
    e.respondWith(fresh(e,u.origin+u.pathname,'./',NAV_MS,true).catch(()=>offlinePage()));
    return;
  }
  e.respondWith(fresh(e,r,r,ASSET_MS,true));
});
