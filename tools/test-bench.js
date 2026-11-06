// 不等他：先到場邊、看不到答案、可以回來；戰況抽屜：平常收著；被丟中整個螢幕有特效、不擋鍵盤、會自己消失
const {chromium,ctx,page,name,reset,room,guess}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
const opt={vp:{width:402,height:810}};
const both=async(p,id)=>{await p.click(id);await p.waitForTimeout(80);await p.click(id);};
(async()=>{const b=await chromium.launch();
 // 大廳不等
 await reset();let r=await room(b,3,opt);let [h,a,x]=r.ps;await a.click('#ready');await h.waitForTimeout(250);
 ok(await h.$eval('#start',e=>e.disabled),'有人沒準備時開始鍵不能按');await both(h,'#forceStart');await a.waitForSelector('.pad');await x.waitForSelector('#backIn');
 ok(await h.evaluate(()=>derive().parts.length===2),'只有準備好的人開始');ok(await x.evaluate(()=>benchOf(me)&&!isSeated(me)),'沒準備的人到場邊');
 ok(await x.evaluate(()=>!document.querySelector('.ghostcard')),'場邊沒有幽靈天使');
 for(const q of [h,a]){await q.click('#randSecret');await q.click('.pad [data-k="ok"]');}
 await a.waitForFunction(()=>derive().status==='playing',null,{timeout:9000});await a.waitForSelector('.pad');
 const sec=await a.evaluate(()=>[secretOf(derive().A[me]),secretOf(me)]);await x.waitForTimeout(300);
 const tx=await x.evaluate(()=>document.body.innerText);ok(!tx.includes(sec[0])&&!tx.includes(sec[1]),'場邊看不到大家的題目');
 await x.reload();await x.waitForSelector('#backIn',{timeout:6000});ok(true,'場邊重新整理還在場邊');
 await guess(a,'1234'===sec[0]?'4321':'1234');await x.click('#backIn');await x.waitForSelector('.pad',{timeout:6000});
 ok(await x.evaluate(()=>me in derive().A&&derive().status==='playing'&&isSeated(me)),'回來就能猜');ok(await a.evaluate(()=>derive().status==='playing'),'回來不影響別人');
 const ax=await x.evaluate(()=>secretOf(derive().A[me]));ok(/^\d{4}$/.test(ax),'回來的人有題目可猜');
 await guess(x,ax);await guess(a,sec[0]);const hs=await h.evaluate(()=>secretOf(derive().A[me]));await guess(h,hs);await h.waitForFunction(()=>derive().status==='over',null,{timeout:6000});ok(true,'三個人都猜完才結算');
 for(const c of r.cs)await c.close();
 // 出題太慢、結算後回座位
 await reset();r=await room(b,3,opt);[h,a,x]=r.ps;await a.click('#ready');await x.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');
 for(const q of [h,a]){await q.click('#randSecret');await q.click('.pad [data-k="ok"]');}await h.waitForTimeout(250);await both(h,'#skipWait');await x.waitForSelector('#backIn');await a.waitForFunction(()=>derive().parts.length===2&&derive().status==='playing',null,{timeout:9000});ok(true,'出題太慢，房主不等他，兩人重新分配後開始');
 await a.waitForSelector('.pad');for(const q of [h,a]){const v=await q.evaluate(()=>secretOf(derive().A[me]));await guess(q,v);}await h.waitForFunction(()=>derive().status==='over');await h.click('#again');await x.waitForSelector('#ready',{timeout:6000});ok(await x.evaluate(()=>isSeated(me)&&!isWatcher(me)),'下一局自動回到座位');
 for(const c of r.cs)await c.close();
 // 合作
 await reset();r=await room(b,3,opt);[h,a,x]=r.ps;await h.click('[data-gmode="coop"]');await a.waitForTimeout(200);await a.click('#ready');await h.waitForTimeout(250);await both(h,'#forceStart');await x.waitForSelector('#backIn');await h.waitForTimeout(5000);
 ok(await h.evaluate(()=>coopState().order.length===2),'合作：先兩人開打');const boss=await h.evaluate(()=>coopState().bossSecret);ok(!(await x.evaluate(()=>document.body.innerText)).includes(boss),'合作：場邊看不到魔王的題目');
 await x.click('#backIn');await h.waitForTimeout(500);ok(await h.evaluate(()=>coopState().order.length===3),'合作：回來排進順序');for(const c of r.cs)await c.close();
 // 抽屜
 await reset();r=await room(b,2,opt);[h,a]=r.ps;await a.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');for(const q of [h,a]){await q.click('#randSecret');await q.click('.pad [data-k="ok"]');}await a.waitForFunction(()=>derive().status==='playing',null,{timeout:9000});await a.waitForSelector('.pad');
 const vis=p=>p.evaluate(()=>{const e=document.querySelector('#arena svg.stage'),r=e.getBoundingClientRect();return getComputedStyle(document.getElementById('arena')).visibility==='visible'&&r.left>=0&&r.right<=innerWidth+1&&r.top<innerHeight;});
 ok(!(await vis(a)),'平常戰況收著');ok(await a.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),'遊戲中不用滑');
 const hit=(p,it)=>p.evaluate(it=>playFx({target:me,from:derive().A[me],item:it||'tomato',n:1,name:'小美'}),it);
 const hsN=(p,sel)=>p.evaluate(sel=>document.querySelectorAll((sel||'').split(',').map(x=>'#hitl .hs'+x).join(',')).length,sel);
 await hit(a);await a.waitForTimeout(250);ok(await hsN(a,'.drip.tomato')===1,'被番茄丟：螢幕上有番茄');ok(!(await vis(a)),'被丟不會打開戰況');
 ok(await a.evaluate(()=>getComputedStyle(document.getElementById('hitl')).pointerEvents==='none'&&+getComputedStyle(document.querySelector('#hitl .hs')).opacity<0.9),'特效半透明、不擋手指');
 await a.click('.pad [data-k="1"]');ok(await a.evaluate(()=>input==='1'),'特效在的時候還能打字');await a.click('.pad [data-k="del"]').catch(()=>{});
 ok(await a.evaluate(()=>+getComputedStyle(document.getElementById('hitl')).zIndex<+getComputedStyle(document.getElementById('arenaFab')).zIndex),'特效在側邊按鈕下面，不擋丟東西');
 await a.waitForTimeout(3100);ok(await hsN(a)===0,'幾秒後自己消失');
 for(const [it,sel,m] of [['egg','.drip.egg','雞蛋'],['bomb','.soot','炸彈：灰灰的'],['slipper','.loom','拖鞋：飛向臉'],['hammer','.loom','大鐵盆：飛向臉']]){await hit(a,it);await a.waitForTimeout(150);ok(await hsN(a,sel)>0,m);}
 await a.waitForTimeout(450);ok(await hsN(a,'.orbit')>0,'拖鞋、鐵盆撞到後眼冒金星');
 await a.evaluate(()=>playFx({target:me,from:derive().A[me],item:'flower',n:1,name:'小美'}));await a.waitForTimeout(150);ok(await hsN(a,'.fall')>=10,'花：飄花瓣');
 await a.evaluate(()=>{for(let i=0;i<6;i++)screenHit('tomato');});ok(await hsN(a,'.drip,.soot')<=8,'一直被丟最多同時 8 塊');
 {const bd=await a.textContent('#arenaBadge');ok(bd==='6','被丟幾次就累積幾個數字 '+bd);}
 await a.evaluate(()=>document.querySelectorAll('#hitl .hs').forEach(e=>e.remove()));
 await a.evaluate(()=>playFx({target:me,from:'boss',item:'egg',n:1},true));await a.waitForTimeout(150);ok(await hsN(a,'.drip.egg')===1,'魔王反擊打到自己也有特效');
 await a.evaluate(()=>playFx({target:me,from:me,item:'egg',n:1},true));await a.waitForTimeout(150);ok(await hsN(a,'.drip.egg')===1,'自己丟的不算');
 await a.evaluate(()=>document.querySelectorAll('#hitl .hs').forEach(e=>e.remove()));
 await a.click('#arenaFab');await a.waitForTimeout(300);ok(await vis(a),'點開看得到');ok(await a.evaluate(()=>!!document.querySelector('#arena .ibar')&&!!document.querySelector('#arena .ptable')),'互砸和別人的進度都在裡面');ok((await a.$eval('#arenaBadge',e=>e.hidden)),'打開後數字清掉');
 await hit(a);await a.waitForTimeout(700);ok(await hsN(a,'.drip.tomato')===1,'戰況打開時被丟中，螢幕一樣有特效');
 await a.click('#arenaClose');await a.waitForTimeout(300);await a.evaluate(()=>{document.querySelectorAll('#hitl .hs').forEach(e=>e.remove());ls.set('ab_peek_off','1');});await hit(a);await a.waitForTimeout(300);ok(await hsN(a)===0,'勾「被丟不要特效」就沒有');
 await a.click('#notesFab').catch(()=>{});await a.evaluate(()=>{setNotes(false);ls.set('ab_peek_off','0');});await a.click('#mpAngel');await a.waitForSelector('.angelcard');await a.click('.angelcard .aclose');await a.waitForTimeout(100);
 ok(await a.evaluate(()=>document.querySelector('.angelcard').hidden&&!document.querySelector('.angeltab').hidden),'小天使收起變側邊標籤');await a.click('.angeltab');ok(await a.evaluate(()=>!document.querySelector('.angelcard').hidden),'小天使可以再打開');await a.click('.angelcard .aclose');await guess(a,'1357');await a.waitForTimeout(200);ok(!(await a.$('.angeltab')),'下一次猜題才消失');
 ok(a.__errs===undefined||a.__errs.length===0,'沒有錯誤');
 await b.close();console.log(fails?`失敗 ${fails}`:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1)});
