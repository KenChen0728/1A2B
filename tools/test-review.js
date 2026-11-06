// 結算後：別人先回大廳，留下來看的人分頁切得動、復盤可以換人看；丟到已經回大廳的人，要丟他的角色，不是螢幕中間
const {chromium,reset,room,guess}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();
 await reset();const r=await room(b,2,{vp:{width:402,height:810}});const [h,a]=r.ps;
 await a.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');
 for(const q of [h,a]){await q.click('#randSecret');await q.click('.pad [data-k="ok"]');}
 await a.waitForFunction(()=>derive().status==='playing',null,{timeout:9000});await a.waitForSelector('.pad');
 for(const q of [h,a]){await q.waitForSelector('.pad');const sec=await q.evaluate(()=>secretOf(derive().A[me]));await guess(q,sec==='1234'?'5678':'1234');await guess(q,sec);}
 await h.waitForFunction(()=>derive().status==='over',null,{timeout:9000});await a.waitForTimeout(400);
 const hid=await h.evaluate(()=>me), aid=await a.evaluate(()=>me);
 await h.click('#again');await a.waitForSelector('#endReview',{timeout:6000});ok(true,'房主回大廳，另一人留在結算');
 await a.click(`[data-view="${hid}"]`);await a.waitForTimeout(150);
 ok(await a.evaluate(h=>document.querySelector(`[data-view="${h}"]`).getAttribute('aria-pressed')==='true'&&document.getElementById('rpBtn').dataset.rpw===h,hid),'留下來看時，點別人的分頁切得過去');
 await a.click('#rpBtn');await a.waitForSelector('#rpM .looktabs button');
 ok(await a.$$eval('#rpM .looktabs button',bs=>bs.length)===2,'復盤視窗裡每個人一個分頁');
 ok(await a.evaluate(()=>document.querySelector('#rpM .looktabs button[aria-pressed=true]').textContent!=='你'),'打開的是剛剛選的那個人');
 await a.click('#rpM .looktabs button:not([aria-pressed=true])');await a.waitForTimeout(150);
 ok(await a.evaluate(()=>document.querySelector('#rpM .looktabs button[aria-pressed=true]').textContent==='你'&&!!document.querySelector('#rpM .rplist')),'可以換看自己的復盤');
 await a.click('#rpM [data-rp="x"]');
 // 丟已經回大廳的人：大廳沒有頒獎台，要丟到他在大廳的角色
 await h.evaluate(a=>playFx({target:'p:'+me,pid:a,item:'tomato',n:1,name:'小美',res:'h'}),aid);await h.waitForTimeout(120);
 const fly=await h.evaluate(()=>{const f=document.querySelector('#fxl .fly');return !!f;});
 await h.waitForTimeout(800);
 ok(fly&&await h.evaluate(()=>!!document.querySelector(`g.char[data-who="${me}"] g.hit`)||isDown(me)),'回大廳的人看到番茄丟在自己的角色上');
 await h.evaluate(()=>document.querySelectorAll('#fxl > *').forEach(e=>e.remove()));
 await h.evaluate(a=>playFx({target:'p:nobody',pid:a,item:'tomato',n:1,name:'小美'}),aid);await h.waitForTimeout(100);
 ok(await h.evaluate(()=>!document.querySelector('#fxl .fly')),'目標不在畫面上就不飛（不會飛向螢幕中間）');
 const errs=[...h.__errs,...a.__errs];ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 await b.close();console.log(fails?'失敗 '+fails:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
