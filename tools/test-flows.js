const {chromium,BASE,ctx,page,shot,name,typeNum,reset,layout,room,guess}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
const dump=async()=>(await (await fetch('http://localhost:8123/__dump')).json());
(async()=>{await reset();const b=await chromium.launch();
 // ---- 單人：存檔、重新整理、回首頁繼續
 let c=await ctx(b,{vp:{width:390,height:664}});let p=await page(c);await name(p,'小明');await p.click('#goSolo');
 await p.click('[data-diff="hard"]');await p.click('#soloAdvBtn');await p.click('[data-slen="5"]');await p.click('[data-srep="1"]');await p.click('#soloStart');
 await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(150);
 ok(await p.evaluate(()=>{const r=document.querySelector('.pad [data-k=ok]').getBoundingClientRect();return r.bottom<=innerHeight+160;}),'單人：確定鍵接近第一畫面');
 await shot(p,'70-solo-new');
 await p.evaluate(()=>window.scrollTo(0,300));await p.waitForTimeout(50);
 const H0=await p.evaluate(()=>document.documentElement.scrollHeight),Y0=await p.evaluate(()=>scrollY);
 await guess(p,'12345');await p.waitForTimeout(100);
 const H1=await p.evaluate(()=>document.documentElement.scrollHeight),Y1=await p.evaluate(()=>scrollY);
 ok(!!(await p.$('.pad')),'魔王思考時鍵盤還在');ok(H1>=H0-4,`魔王思考時頁面高度不會縮 ${H0}→${H1}`);
 ok(await p.$eval('.pad [data-k=ok]',e=>e.disabled),'思考時確定鍵停用');
 await shot(p,'71-solo-wait');
 await p.waitForTimeout(2200);
 await p.reload();await p.waitForTimeout(600);
 ok(await p.evaluate(()=>!!solo&&solo.hist.length===1),'重新整理回到原本的單人局');
 ok((await p.$$eval('.mine-h .hrow',e=>e.length))===1,'猜題紀錄還在');
 await p.click('#soloQuit');await p.waitForTimeout(150);
 ok(!!(await p.$('#soloBack')),'回首頁看到「繼續」');ok(!!(await p.$('#create')),'回到真正的首頁');await shot(p,'72-home-resume',true);
 await p.click('#soloBack');await p.waitForTimeout(200);ok(await p.evaluate(()=>!!solo),'按繼續回到遊戲');
 // 中途 CPU 回合被打斷
 await guess(p,'11111');await p.reload();await p.waitForTimeout(3000);
 ok(await p.evaluate(()=>solo&&solo.chist.length===solo.hist.length),'魔王回合被打斷後會補上');
 // 放棄後不留存檔
 await p.click('#giveUp');await p.click('#giveUp');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>localStorage.getItem('ab_solo')===null),'結束後存檔清掉');
 await p.click('#soloQuit');await p.waitForTimeout(100);ok(!(await p.$('#soloBack')),'結束後首頁沒有繼續');
 await p.click('#goSolo');ok(await p.evaluate(()=>soloCfg.len===5&&soloCfg.rep===true&&soloCfg.diff==='hard'),'設定還在記憶體');
 await p.reload();await p.waitForTimeout(300);ok(await p.evaluate(()=>soloCfg.len===5&&soloCfg.rep===true&&soloCfg.diff==='hard'),'重開後設定還在');
 ok(p.__errs.length===0,'單人沒有錯誤 '+p.__errs);await c.close();
 // ---- 出題時有人離開
 await reset();let r=await room(b,3);let [h,a,x]=r.ps;
 await a.click('#ready');await x.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');
 await h.click('#randSecret');await h.click('.pad [data-k="ok"]');await a.click('#randSecret');await a.click('.pad [data-k="ok"]');await a.waitForTimeout(250);
 await x.click('#leave');await x.waitForTimeout(100);await x.click('#leave');await a.waitForTimeout(600);
 await a.waitForSelector('.pad',{timeout:9000}).catch(()=>{});
 ok(!!(await a.$('.pad')),'出題時有人離開，其他人照常開始');
 ok(await a.evaluate(()=>{const D=derive();return D.parts.length===2&&D.A[me]!==me;}),'重新分配成兩人互猜');
 const ansA=await a.evaluate(()=>secretOf(derive().A[me]));ok(!!ansA,'拿得到題目');
 await guess(a,ansA);await a.waitForTimeout(300);ok(await a.evaluate(()=>derive().solved[me]===1),'猜中有算到');
 // 房主離開交棒
 await h.click('#giveUp');await h.click('#giveUp');await a.waitForTimeout(400);await shot(a,'73-over',true);
 await h.click('#leave');await a.waitForTimeout(400);ok(await a.evaluate(()=>isHost()),'房主離開交給下一位');
 await a.click('#again');await a.waitForTimeout(400);
 await a.click('#leave');await a.waitForTimeout(500);
 let d=await dump();ok(!d.some(([k])=>k.startsWith('rooms/')),'最後一人離開，房間清乾淨');
 // ---- 兩人，一人離開 → 回大廳
 await reset();r=await room(b,2);[h,a]=r.ps;await a.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');await a.click('#leave');await a.waitForTimeout(100);await a.click('#leave');await h.waitForTimeout(1200);
 ok(await h.evaluate(()=>derive().status==='lobby'),'兩人局有人離開，房主回大廳');
 // ---- 題目分配中有人離開
 ok(h.__errs.length===0&&a.__errs.length===0,'多人沒有錯誤 '+h.__errs+a.__errs);
 // ---- 重新整理回房間（分頁存活）
 await a.reload().catch(()=>{});
 await reset();r=await room(b,2);[h,a]=r.ps;await a.reload();await a.waitForTimeout(700);ok(await a.evaluate(()=>!!code),'重新整理自動回房間');
 // ---- 聊天被節流不吃字
 await h.click('#chatFab');await h.fill('#chatIn','第一句');await h.press('#chatIn','Enter');await h.waitForTimeout(200);ok((await h.inputValue('#chatIn'))==='','聊天送出後清空');
 await h.fill('#chatIn','第二句');await h.press('#chatIn','Enter');await h.waitForTimeout(200);ok((await h.inputValue('#chatIn'))==='第二句','太快時字留著');
 await h.click('#chatClose');
 // ---- 主持人結束這局要按兩次
 await a.click('#ready');await h.waitForTimeout(250);await h.click('#start');await h.waitForSelector('.pad');await h.waitForTimeout(100);await h.click('#again');await h.waitForTimeout(200);ok(await h.evaluate(()=>derive().status==='secret'),'按一次不會結束');await h.click('#again');await h.waitForTimeout(300);ok(await h.evaluate(()=>derive().status==='lobby'),'按兩次才結束');
 await b.close();console.log(fails?`失敗 ${fails}`:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1)});
