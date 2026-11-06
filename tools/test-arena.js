// 戰況抽屜：遊戲中狀態短暫跳成載入中再回來，打開的戰況不會被收掉；連點時手指偏到外面不會關；被打倒的角色倒在舞台裡
const {chromium,reset,room}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();
 await reset();const r=await room(b,3,{vp:{width:402,height:776}});const [h,a,x]=r.ps;
 await a.click('#ready');await x.click('#ready');await h.waitForTimeout(300);await h.click('#start');await a.waitForSelector('.pad');
 for(const q of [h,a,x]){await q.click('#randSecret');await q.click('.pad [data-k="ok"]');}
 await h.waitForFunction(()=>derive().status==='playing',null,{timeout:9000});await h.waitForSelector('.pad');
 await h.click('#arenaFab');await h.waitForTimeout(400);ok(await h.evaluate(()=>arenaOpen&&document.getElementById('arena').classList.contains('open')),'打開戰況');
 // 有人回報狀態短暫對不上（斷線重連之類），全部人短暫變成載入中
 const round=await a.evaluate(()=>g().round);
 await a.evaluate(()=>roomRef().update({seats:{[me]:{ack:0}}}));await h.waitForFunction(()=>derive().status==='loading',null,{timeout:5000});
 ok(await h.evaluate(()=>!document.getElementById('arena')&&document.getElementById('notesBack').hidden),'載入中時沒有戰況，也不會留一層暗暗的背景');
 await a.evaluate(r=>roomRef().update({seats:{[me]:{ack:r}}}),round);await h.waitForFunction(()=>derive().status==='playing',null,{timeout:5000});await h.waitForTimeout(200);
 ok(await h.evaluate(()=>arenaOpen&&document.getElementById('arena').classList.contains('open')),'恢復後戰況還是打開的');
 // 連點時手指偏到抽屜外面
 const t=await h.evaluate(()=>{const g=[...document.querySelectorAll('#arena g.char[data-target]')].find(e=>e.dataset.who!==me);const r=g.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height*.4};});
 for(let i=0;i<6;i++){await h.mouse.click(t.x,t.y);await h.waitForTimeout(60);}
 await h.mouse.click(20,t.y);await h.waitForTimeout(200);ok(await h.evaluate(()=>arenaOpen),'剛連點完點到旁邊不會關');
 await h.waitForTimeout(1300);await h.mouse.click(20,t.y);await h.waitForTimeout(300);ok(await h.evaluate(()=>!arenaOpen&&arenaWhy==='點到旁邊'),'停一下再點旁邊才關，診斷記下原因');
 await h.click('#arenaFab');await h.waitForTimeout(400);
 // 被打倒的角色不會倒出舞台
 const inside=await h.evaluate(async()=>{const sv=document.querySelector('#arena svg.stage');const gs=[...sv.querySelectorAll('g.char[data-target]')].filter(e=>e.dataset.who!==me);
   for(const g of gs)throwAt(g.dataset.who);await new Promise(r=>setTimeout(r,900));const s=sv.getBoundingClientRect();
   return [...sv.querySelectorAll('g.char.down')].map(g=>{const r=g.getBoundingClientRect();return r.left>=s.left-2&&r.right<=s.right+2;});});
 ok(inside.length>0&&inside.every(Boolean),'被打倒的角色倒在舞台裡 '+JSON.stringify(inside));
 const errs=[...h.__errs,...a.__errs,...x.__errs];ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 await b.close();console.log(fails?'失敗 '+fails:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
