// 小天使：不把位置填進筆記（不然只剩一種時等於給答案）；合作模式全隊共用同一張卡片，有人再猜就一起消失
const {chromium,reset,room,guess}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();
 await reset();const r=await room(b,2,{vp:{width:402,height:810}});const [h,a]=r.ps;
 await h.click('[data-gmode="coop"]');await a.waitForTimeout(300);await a.click('#ready');await h.waitForTimeout(300);await h.click('#start');
 await h.waitForFunction(()=>{const C=coopState();return C&&!C.countdown&&C.guesser;},null,{timeout:15000});
 const who=async()=>{const id=await h.evaluate(()=>coopState().guesser);return id===await h.evaluate(()=>me)?h:a;};
 const turn=async g=>{const p=await who();await p.waitForSelector('.pad');await guess(p,g);await h.waitForFunction(n=>coopState().T.length>=n,null,{timeout:15000},await h.evaluate(()=>coopState().T.length+1));await h.waitForFunction(()=>{const C=coopState();return !C.waitingBoss;},null,{timeout:15000});};
 await turn('1234');await turn('5678');
 const caller=a, other=h;
 await caller.waitForSelector('#coopAngel',{timeout:8000}).catch(async()=>{console.log('no angel btn',JSON.stringify(await caller.evaluate(()=>{const C=coopState();return{over:C.over,wb:C.waitingBoss,cd:C.countdown,T:C.T.length,g:C.guesser===me,an:coopAngelsLeft(),max:angelMax()};})));});await caller.click('#coopAngel');await caller.waitForSelector('.angelcard',{timeout:5000});
 await other.waitForSelector('.angelcard',{timeout:5000}).catch(()=>{});
 const lbl=await other.evaluate(()=>{const c=document.querySelector('.angelcard .lbl');return c&&c.textContent;});
 ok(!!lbl&&lbl.includes('小美')&&lbl.includes('全隊'),'隊友也看到小天使，寫明是誰叫的：'+lbl);
 ok(await caller.evaluate(()=>/小天使幫你整理/.test(document.querySelector('.angelcard .lbl').textContent)),'叫的人看到自己的');
 ok(await other.evaluate(()=>notes.pos.every(v=>!v))&&await caller.evaluate(()=>notes.pos.every(v=>!v)),'位置不會被填進筆記');
 ok(await caller.evaluate(()=>coopAngelsLeft())===await other.evaluate(()=>coopAngelsLeft()),'次數全隊共用');
 await other.reload();await other.waitForTimeout(1500);ok(await other.evaluate(()=>!!document.querySelector('.angelcard')),'重新整理後還沒人猜，卡片還在');
 await turn('9012');await h.waitForTimeout(400);
 ok(!(await h.$('.angelcard'))&&!(await a.$('.angelcard')),'有人再猜一次，兩邊的卡片一起消失');
 // 只剩一種可能時也不會把答案排好
 ok(await a.evaluate(()=>{const s0=JSON.stringify(notes.pos);const html=angelHelp([{g:'1234',A:4,B:0}],4,false);return JSON.stringify(notes.pos)===s0&&/位置自己排/.test(html);}),'只剩一種時只說線索夠了，不排答案');
 const errs=[...h.__errs,...a.__errs];ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 await b.close();console.log(fails?'失敗 '+fails:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
