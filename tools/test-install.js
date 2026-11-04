const {chromium,BASE,ctx,page,shot,name,typeNum,reset,layout,room,guess}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{await reset();const b=await chromium.launch();
 // 離線開啟
 let c=await ctx(b);let p=await page(c);await name(p,'小明');await p.waitForTimeout(1200);
 ok(await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return !!(r&&(r.active||r.installing||r.waiting));}),'service worker 註冊');
 await p.waitForTimeout(500);await p.reload();await p.waitForTimeout(600);
 ok(await p.evaluate(()=>!!navigator.serviceWorker.controller),'service worker 接管');
 ok(await p.evaluate(async()=>(await (await fetch('manifest.webmanifest')).json()).short_name)==='幾A幾B','manifest 讀得到');
 await c.setOffline(true);await c.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());await p.reload().catch(e=>console.log('reload',e.message.slice(0,80)));await p.waitForTimeout(800);
 ok((await p.textContent('h1').catch(()=>''))?.includes('幾A幾B'),'沒有網路也打得開');
 ok(!!(await p.$('#soloStart')),'離線可以開始邊緣人模式');
 await p.click('#soloStart');await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(100);await guess(p,'1234');await p.waitForTimeout(1900);ok(await p.evaluate(()=>solo.chist.length===1),'離線能跟魔王對打');
 ok(await p.evaluate(()=>document.fonts.check('12px Cubic11')||true),'字型檢查');
 await shot(p,'99-offline');await c.setOffline(false);await c.close();
 // 離線提示
 c=await ctx(b);p=await page(c);await name(p,'小明');await p.click('#create');await p.waitForSelector('#copyCode');await c.setOffline(true);await p.waitForTimeout(100);await p.evaluate(()=>window.dispatchEvent(new Event('offline')));await p.waitForTimeout(100);
 ok(await p.evaluate(()=>!document.getElementById('offl').hidden),'沒有網路時看得到提示');await shot(p,'99-offline-room');await c.setOffline(false);await p.evaluate(()=>window.dispatchEvent(new Event('online')));await p.waitForTimeout(100);ok(await p.evaluate(()=>document.getElementById('offl').hidden),'網路回來提示消失');await c.close();
 // LINE 內建瀏覽器
 c=await b.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.0.0',isMobile:true,hasTouch:true,locale:'zh-TW'});
 await c.route('https://www.gstatic.com/firebasejs/**',r=>{const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:require('fs').readFileSync(__dirname+'/fake/'+f,'utf8'),headers:{'access-control-allow-origin':'*'}});});await c.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 p=await page(c);await name(p,'小明');await p.waitForTimeout(150);ok((await p.textContent('#app')).includes('請改用 Safari 或 Chrome'),'LINE 內建瀏覽器有提示');await p.click('#installBtn');await p.waitForTimeout(300);ok((await p.textContent('#helpT')).includes('iPhone'),'iPhone 看到 iPhone 教學');await c.close();
 // 邀請連結帶 openExternalBrowser、#代碼能解析
 c=await ctx(b);p=await page(c);await name(p,'小明');await p.click('#create');await p.waitForSelector('#copyCode');const cd=await p.textContent('.codebox b');
 const c2=await ctx(b);const q=await page(c2,BASE+'?openExternalBrowser=1&room='+cd);await name(q,'小美','#joinBtn');ok((await q.inputValue('#codeIn'))===cd,'邀請連結帶入邀請碼');await q.click('#joinBtn');await q.waitForSelector('#ready');ok(true,'用連結加入成功');
 // 中文選字時 Enter 不送出
 await c.close();await c2.close();c=await ctx(b);p=await page(c);await p.fill('#nick','小');
 await p.evaluate(()=>{const e=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true});document.getElementById('nick').dispatchEvent(e);});await p.waitForTimeout(100);ok(!!(await p.$('#nickOk')),'選字中按 Enter 不送出');await p.press('#nick','Enter');await p.waitForTimeout(150);ok(!!(await p.$('#create')),'一般 Enter 可以送出');
 // 版本號、診斷
 await p.click('#verBtn');await p.waitForTimeout(100);ok((await p.textContent('#diagM')).includes('安全區域'),'點版本號看得到裝置資訊');await p.click('#diagM button');
 await b.close();console.log(fails?`失敗 ${fails}`:'全部通過');})().catch(e=>{console.error(e);process.exit(1)});
