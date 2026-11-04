const {chromium,BASE,ctx,page,shot,name,typeNum,reset,layout}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{await reset();const b=await chromium.launch();
 // Firebase 載入很慢：畫面要先出來，邊緣人模式能玩，打字不被打斷
 const c=await ctx(b);await c.unroute('https://www.gstatic.com/firebasejs/**');let release;const gate=new Promise(r=>release=r);
 await c.route('https://www.gstatic.com/firebasejs/**',async r=>{await gate;const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:require('fs').readFileSync(__dirname+'/fake/'+f,'utf8'),headers:{'access-control-allow-origin':'*'}});});
 const p=await c.newPage();await p.addInitScript(()=>{try{localStorage.setItem('ab_help_seen','1');}catch(e){}});await p.goto(BASE);await p.waitForTimeout(400);
 ok(!!(await p.$('#nick')),'Firebase 還沒好就看到取名');await p.fill('#nick','小明');await p.click('#nickOk');await p.waitForTimeout(150);
 ok(await p.$eval('#create',e=>e.disabled&&e.textContent.includes('連線中')),'開新房間顯示連線中');
 await p.click('#goJoin');await p.waitForTimeout(100);await p.click('#codeIn');await p.keyboard.type('AB');
 release();await p.waitForTimeout(500);
 ok((await p.inputValue('#codeIn'))==='AB','連上時打到一半的字還在');ok(await p.evaluate(()=>document.activeElement.id==='codeIn'),'鍵盤沒有被收起來');ok(await p.$eval('#joinBtn',e=>!e.disabled),'加入按鈕變可以按');
 await p.click('#homeBack');await p.waitForTimeout(100);ok(await p.$eval('#create',e=>!e.disabled&&e.textContent==='開新房間'),'回首頁可以開房');
 console.log(p.__errs||'');await b.close();console.log(fails?`失敗 ${fails}`:'全部通過');})().catch(e=>{console.error(e);process.exit(1)});
