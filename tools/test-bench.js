// 不等他：先到場邊、看不到答案、可以回來；戰況抽屜：平常收著、被丟跳出、有冷卻
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
 const hit=p=>p.evaluate(()=>playFx({target:me,from:derive().A[me],item:'tomato',n:1,name:'小美'}));await hit(a);await a.waitForTimeout(350);ok(await vis(a),'被丟跳出來');ok(await a.evaluate(()=>document.querySelector('.pad [data-k=ok]').getBoundingClientRect().top>document.getElementById('arena').getBoundingClientRect().bottom),'跳出來不擋鍵盤');
 await a.click('.pad [data-k="1"]');ok(await a.evaluate(()=>input==='1'),'跳出來時還能打字');await a.click('.pad [data-k="del"]').catch(()=>{});
 await a.waitForTimeout(2600);ok(!(await vis(a)),'幾秒後收回');await hit(a);await hit(a);await a.waitForTimeout(400);ok(!(await vis(a)),'連續丟不會一直跳');ok((await a.textContent('#arenaBadge'))==='2','連續丟只累積數字');
 await a.click('#arenaFab');await a.waitForTimeout(300);ok(await vis(a),'點開看得到');ok(await a.evaluate(()=>!!document.querySelector('#arena .ibar')&&!!document.querySelector('#arena .ptable')),'互砸和別人的進度都在裡面');ok((await a.$eval('#arenaBadge',e=>e.hidden)),'打開後數字清掉');
 await a.click('#arenaClose');await a.waitForTimeout(300);await a.evaluate(()=>{peekNext=0;ls.set('ab_peek_off','1');});await hit(a);await a.waitForTimeout(400);ok(!(await vis(a)),'勾不跳出就不跳');
 await a.click('#notesFab').catch(()=>{});await a.evaluate(()=>{setNotes(false);ls.set('ab_peek_off','0');});await a.click('#mpAngel');await a.waitForSelector('.angelcard');await a.click('.angelcard .aclose');await a.waitForTimeout(100);
 ok(await a.evaluate(()=>document.querySelector('.angelcard').hidden&&!document.querySelector('.angeltab').hidden),'小天使收起變側邊標籤');await a.click('.angeltab');ok(await a.evaluate(()=>!document.querySelector('.angelcard').hidden),'小天使可以再打開');await a.click('.angelcard .aclose');await guess(a,'1357');await a.waitForTimeout(200);ok(!(await a.$('.angeltab')),'下一次猜題才消失');
 ok(a.__errs===undefined||a.__errs.length===0,'沒有錯誤');
 await b.close();console.log(fails?`失敗 ${fails}`:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1)});
