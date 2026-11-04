// 開場：一個人的 VS 進度條、多人等大家連線（好了才上色）、合作模式也有，卡住不會當掉
const {chromium,BASE,ctx,page,name,reset,room,guess}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
const vs=p=>p.evaluate(()=>{const e=document.getElementById('vsM');return{on:!e.hidden,sub:(e.querySelector('.vssub')||{}).textContent||'',pct:(e.querySelector('.vspct')||{}).textContent||'',bar:parseInt(((e.querySelector('.vsbar i')||{}).style||{}).width)||0,gray:e.querySelectorAll('.rp.wait').length,ros:e.querySelectorAll('.rp').length};});
(async()=>{await reset();const b=await chromium.launch();
 // 一個人
 let c=await ctx(b,{vp:{width:402,height:810}}),p=await page(c);await name(p,'小明');await p.click('#goSolo');await p.click('#soloStart');await p.click('#randSecret');await p.click('.pad [data-k="ok"]');
 const t0=Date.now();await p.waitForTimeout(500);let v=await vs(p);ok(v.on&&v.bar>0&&v.bar<100&&/載入中/.test(v.pct),`單人：開場有進度條 ${v.pct}`);
 await p.waitForTimeout(1500);v=await vs(p);ok(v.on,'單人：2 秒時還在');
 await p.waitForFunction(()=>document.getElementById('vsM').hidden);const dt=Date.now()-t0;ok(dt>2400&&dt<3400,`單人：停留 ${dt} ms`);
 await p.click('#soloQuit').catch(()=>{});await p.waitForTimeout(100);await p.click('#soloBack');await p.waitForTimeout(150);await p.click('#giveUp');await p.click('#giveUp');await p.waitForTimeout(150);await p.click('#soloAgain');await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(300);await p.click('#vsM');await p.waitForTimeout(80);ok((await vs(p)).on===false,'單人：點一下可以跳過');await c.close();
 // 三人互猜，大雄卡住
 await reset();let r=await room(b,3,{vp:{width:402,height:810}});let [h,a,x]=r.ps;
 const look=await h.evaluate(()=>app.querySelector('svg.stage').innerHTML);ok(/未準備/.test(look),'大廳：標出未準備');
 ok(await h.evaluate(()=>{const c=[...document.querySelectorAll('svg.stage g.char')].find(g=>g.dataset.who!==me);return !/#(?!([0-9a-f]{2})\1\1)[0-9a-f]{6}/i.test(c.querySelector('path,rect').parentNode.innerHTML.split('<text')[0]);}),'大廳：沒準備的人是灰色');
 await a.click('#ready');await x.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');
 ok((await a.$$('.rp')).length===3&&(await a.$$('.rp.wait')).length===3,'出題：還沒出題的人是灰色');
 await a.click('#randSecret');await a.click('.pad [data-k="ok"]');await h.waitForTimeout(250);ok((await h.$$('.rp.wait')).length===2,'出題：出好的人上色');
 await x.evaluate(()=>{window.__ss=syncStep;syncStep=async()=>{};});
 await h.click('#randSecret');await h.click('.pad [data-k="ok"]');await x.click('#randSecret');await x.click('.pad [data-k="ok"]');await a.waitForTimeout(500);
 v=await vs(a);ok(v.on&&v.ros===3&&v.gray===1,`多人：等人時對決畫面有名單，1 人灰色（${v.pct}）`);ok(/等 .+ 連線/.test(v.pct),'多人：說明在等誰');ok(/你要猜/.test(v.sub),'多人：說你要猜誰');
 ok(await a.evaluate(()=>derive().status==='loading'),'還沒開始');
 await a.waitForTimeout(7500);await a.evaluate(()=>render());await a.waitForTimeout(100);ok(!(await vs(a)).on&&(await a.$$('.rp.wait')).length===1,'卡住超過 7 秒退回一般畫面');
 await x.evaluate(()=>{syncStep=window.__ss;render();});await a.waitForTimeout(700);v=await vs(a);ok(v.on&&v.gray===0&&/秒後開始/.test(v.pct),`全部好了才倒數（${v.pct}）`);
 const sa=await a.evaluate(()=>g().startAt);await a.waitForFunction(()=>document.getElementById('vsM').hidden,null,{timeout:6000});ok(Math.abs(Date.now()-sa)<900,'倒數結束就開始');ok(!!(await a.$('.pad')),'開始後鍵盤在');
 ok(!(await vs(h)).on&&!(await vs(x)).on,'三個人都進遊戲');
 // 有人離線時舞台變灰（只測畫法）
 for(const q of r.ps)await q.context().close();
 // 合作：兩人，小美卡住，房主延後，最多兩次
 await reset();r=await room(b,2,{vp:{width:402,height:810}});[h,a]=r.ps;await h.click('[data-gmode="coop"]');await a.waitForTimeout(200);await a.click('#ready');await h.waitForTimeout(250);
 await a.evaluate(()=>{window.__cs=coopStep;coopStep=()=>{};});await h.click('#start');await h.waitForTimeout(1200);
 v=await vs(h);ok(v.on&&/全隊 2 人/.test(v.sub),`合作：也有對決畫面（${v.sub}）`);ok(!(await vs(a)).on===false,'合作：隊友也看得到');
 const s0=await h.evaluate(()=>g().coop.startAt);await h.waitForTimeout(3000);const s1=await h.evaluate(()=>g().coop.startAt);ok(s1>s0,'合作：有人沒連上，房主延後開始');
 await h.waitForFunction(()=>!coopState().countdown,null,{timeout:12000});ok(await h.evaluate(()=>num(g().coop.ext)<=2),'合作：最多延兩次，不會卡死');
 await a.evaluate(()=>{coopStep=window.__cs;render();});await h.waitForTimeout(400);ok(!(await vs(h)).on,'合作：開始後畫面收掉');
 await b.close();console.log(fails?`失敗 ${fails}`:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1)});
