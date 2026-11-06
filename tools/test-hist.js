// 看全部：紀錄跳出大視窗一次列出來、會跟著更新、這局結束自己關；更新視窗不在結算時跳出，跳出後按鈕 0.9 秒內按了沒作用
const {chromium,reset,room,guess,layout}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();
 // 合作：隊友猜的時候，打開的視窗會跟著多一筆
 await reset();let r=await room(b,2,{vp:{width:402,height:776}});let [h,a]=r.ps;
 await h.click('[data-gmode="coop"]');await a.waitForTimeout(300);await a.click('#ready');await h.waitForTimeout(300);await h.click('#start');
 await h.waitForFunction(()=>{const C=coopState();return C&&!C.countdown&&C.guesser;},null,{timeout:15000});
 const hid=await h.evaluate(()=>me);
 const turn=async g=>{const id=await h.evaluate(()=>coopState().guesser);const p=id===hid?h:a;await p.waitForSelector('.pad');await guess(p,g);const n=await h.evaluate(()=>coopState().T.length);await h.waitForFunction(n=>coopState().T.length>=n&&!coopState().waitingBoss,null,{timeout:15000},n);};
 await turn('1234');ok(!(await h.$('#histAll')),'只有 1 筆時不出現「看全部」');
 await turn('5678');
 const viewer=(await h.evaluate(()=>coopState().guesser))===hid?a:h;
 await viewer.waitForSelector('#histAll');ok((await layout(viewer)).length===0,'加了按鈕標題列沒有超出');
 await viewer.click('#histAll');await viewer.waitForSelector('#histM:not([hidden]) .hrow');
 ok(await viewer.$$eval('#histM .hrow',e=>e.length)===2,'跳出視窗列出全部 2 筆');
 ok(await viewer.evaluate(()=>{const e=document.querySelector('#histM .histall');return e.scrollHeight<=e.clientHeight+1;}),'視窗裡不用滑');
 await turn('9012');await viewer.waitForTimeout(300);
 ok(await viewer.$$eval('#histM .hrow',e=>e.length)===3,'隊友猜了，視窗跟著多一筆');
 await viewer.click('#histM [data-hx]');ok(await viewer.evaluate(()=>document.getElementById('histM').hidden&&!histOpen),'按 ✕ 關掉');
 await viewer.click('#histAll');await viewer.waitForTimeout(100);await viewer.mouse.click(5,5);ok(await viewer.evaluate(()=>document.getElementById('histM').hidden),'點外面也會關');
 for(const c of r.cs)await c.close();
 // 對戰：結算時不跳更新視窗；回大廳、手停了才跳，按鈕先不能按
 await reset();r=await room(b,2,{vp:{width:402,height:810}});[h,a]=r.ps;
 await a.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');
 for(const q of [h,a]){await q.click('#randSecret');await q.click('.pad [data-k="ok"]');}
 await a.waitForFunction(()=>derive().status==='playing',null,{timeout:9000});
 for(const q of [h,a]){await q.waitForSelector('.pad');const sec=await q.evaluate(()=>secretOf(derive().A[me]));await guess(q,sec==='1234'?'5678':'1234');await guess(q,sec==='5678'?'1234':'5678');}
 await h.waitForSelector('#histAll');await h.click('#histAll');await h.waitForSelector('#histM:not([hidden])');
 const sh=await h.evaluate(()=>secretOf(derive().A[me]));await h.evaluate(()=>setHist(false));await guess(h,sh);
 const sa=await a.evaluate(()=>secretOf(derive().A[me]));await guess(a,sa);
 await h.waitForFunction(()=>derive().status==='over',null,{timeout:9000});
 await h.evaluate(()=>{updShown=true;lastTap=0;updTick();});await h.waitForTimeout(100);
 ok(await h.evaluate(()=>document.getElementById('upd').hidden),'結算畫面不跳更新視窗');
 await h.click('#again');await h.waitForTimeout(500);await h.evaluate(()=>{lastTap=Date.now();updTick();});
 ok(await h.evaluate(()=>document.getElementById('upd').hidden),'剛點過畫面不跳');
 await h.evaluate(()=>{lastTap=Date.now()-3000;updTick();});
 ok(await h.evaluate(()=>!document.getElementById('upd').hidden&&document.querySelector('#upd button').disabled),'回到大廳、手停了才跳，按鈕先不能按');
 await h.waitForTimeout(1000);ok(await h.evaluate(()=>!document.querySelector('#upd button').disabled),'0.9 秒後才能按');
 await h.evaluate(()=>{document.getElementById('upd').hidden=true;});
 const errs=[...h.__errs,...a.__errs];ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 await b.close();console.log(fails?'失敗 '+fails:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
