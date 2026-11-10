// 聲音：背景音樂（大廳、戰鬥、熱血爆發）、音效（只有丟的人和被丟的人聽得到、開關會記住）、結算短曲只放一次、標題列和丟東西那一排放得下
const {chromium,ctx,page,name,reset,room,layout,guess,BASE}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
/* 記下每支手機放了哪些音效 */
const spy=p=>p.evaluate(()=>{window.__sfx=[];const o=ChipAudio.playSfx;ChipAudio.playSfx=n=>{const r=o(n);if(r)__sfx.push(n);return r;};});   // 只記真的有放出來的
const log=p=>p.evaluate(()=>__sfx.slice());
(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 await reset();const c0=await ctx(b,{vp:{width:360,height:640}});const p=await page(c0,BASE);await name(p,'阿明');
 for(const k of ['lobby','battle','battleHot','win5','lose5']){const r=await p.evaluate(async k=>{const bf=await BGM.render(k,k==='lose5'||k==='win5'?9.5:8);let pk=0,sq=0,n=0,nan=0;for(let ch=0;ch<2;ch++){const d=bf.getChannelData(ch);for(const v of d){if(!isFinite(v)){nan++;continue;}const a=Math.abs(v);if(a>pk)pk=a;sq+=v*v;n++;}}return{pk,rms:Math.sqrt(sq/n),nan};},k);
   ok(!r.nan&&r.pk<0.99&&r.rms>0.02,`${k}：音量不爆、聽得到（最大 ${r.pk.toFixed(2)}、平均 ${r.rms.toFixed(3)}）`);}
 ok(await p.evaluate(()=>!document.querySelector('.musbtn')&&!BGM.song),'首頁沒有音樂、沒有音符鍵');
 await p.click('#goSolo');await p.click('#soloStart');await p.waitForSelector('.musbtn');await spy(p);
 ok(await p.evaluate(()=>document.querySelector('.musbtn').getAttribute('aria-pressed')==='false'&&!BGM.song),'邊緣人：有音符鍵，預設沒有音樂');
 ok((await layout(p)).length===0,'360 寬邊緣人標題列放得下');
 await p.click('.musbtn');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>localStorage.getItem('ab_bgm')==='1'&&BGM.song==='calm'&&ChipAudio.playing==='lobby'&&BGM.state==='running'),'按音符打開：出題時放大廳的曲子');
 await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(400);await p.evaluate(()=>{const v=document.getElementById('vsM');if(v&&!v.hidden)v.click();});await p.waitForTimeout(2300);
 ok(await p.evaluate(()=>BGM.song==='battle'&&ChipAudio.playing==='battle'&&!ChipAudio.intensity),'開始猜：換成戰鬥的曲子，平時不熱血');
 ok(await p.evaluate(()=>{const s=document.querySelector('input[data-sfx]');return !!s&&s.checked;}),'丟東西那一排有「音效」，預設打開');
 await p.click('#giveUp');await p.click('#giveUp');await p.waitForTimeout(2300);
 ok(await p.evaluate(()=>!BGM.song&&__sfx.filter(n=>n==='lose5').length===1),'放棄：音樂停，放一次失敗短曲 '+JSON.stringify(await log(p)));
 await p.waitForTimeout(4500);ok(await p.evaluate(()=>!BGM.song&&__sfx.filter(n=>n==='lose5').length===1),'還在結算畫面時保持安靜，短曲不會重放');
 await p.click('#soloQuit');await p.waitForTimeout(300);await p.click('#goSolo');await p.click('[data-smode="practice"]');await p.click('#soloStart');await p.waitForTimeout(2300);
 /* 熱血爆發：猜到 3A 就打開 */
 const sec=await p.evaluate(()=>solo.secret);const miss='0123456789'.split('').find(d=>!sec.includes(d));const g3=miss+sec.slice(1);
 await guess(p,g3);await p.waitForTimeout(2600);
 ok(await p.evaluate(()=>BGM.song==='battle'&&ChipAudio.intensity===true&&hotOn),'猜到 3A：熱血爆發打開');
 await guess(p,sec);await p.waitForTimeout(2300);ok(await p.evaluate(()=>!BGM.song&&__sfx.includes('win5')),'猜中：放勝利短曲 '+JSON.stringify(await log(p)));
 await p.click('#soloQuit');await p.click('#soloQuit').catch(()=>{});await p.waitForSelector('#create',{timeout:5000}).catch(()=>{});await p.waitForTimeout(2300);
 ok(await p.evaluate(()=>!code&&!solo&&!BGM.song),'回首頁就停');
 await p.reload();await p.waitForTimeout(800);await p.click('#goSolo');await p.click('[data-smode="duel"]');await p.click('#soloStart');await p.waitForTimeout(2300);ok(await p.evaluate(()=>BGM.song==='calm'),'重新整理後還記得開著');
 await p.click('.musbtn');await p.waitForTimeout(300);ok(await p.evaluate(()=>localStorage.getItem('ab_bgm')==='0'&&!BGM.song),'再按一次關掉');
 await c0.close();
 /* 房間：丟的人和被丟的人聽得到，其他人不出聲；音效開關會記住；觀眾預設有音樂 */
 await reset();const r=await room(b,3,{vp:{width:360,height:640}});const [h,a,x]=r.ps;
 ok((await layout(h)).length===0,'360 寬房間標題列、丟東西那一排放得下');
 for(const q of [h,a,x])await spy(q);
 const aid=await a.evaluate(()=>me);
 await h.evaluate(id=>{fxItem='tomato';throwAt(id);},aid);await h.waitForTimeout(800);
 const lh=await log(h);ok(lh.includes('throw')&&lh.includes('tomato'),'丟的人：聽到丟出去和打中 '+JSON.stringify(lh));
 await a.waitForTimeout(3600);const la=await log(a),lx=await log(x);
 ok(la.includes('tomato')&&!la.includes('throw'),'被丟的人：聽到打中（沒有丟出去的聲音） '+JSON.stringify(la));
 ok(lx.length===0,'旁邊的人：不出聲 '+JSON.stringify(lx));
 /* 大鐵盆：第一下把人打倒後，接著丟（他躺著）也要有聲音；連丟 5 下每下都響 */
 for(const q of [h,a])await q.evaluate(()=>{__sfx.length=0;});
 await h.waitForTimeout(1000);await h.evaluate(id=>{fxItem='hammer';throwAt(id);},aid);await h.waitForTimeout(900);
 ok(await h.evaluate(id=>isDown(id),aid),'大鐵盆打中：被打倒');
 for(let i=0;i<4;i++){await h.evaluate(id=>throwAt(id),aid);await h.waitForTimeout(250);}await h.waitForTimeout(800);
 const ph=(await log(h)).filter(n=>n==='pot4').length;ok(ph===5,`丟的人：大鐵盆連丟 5 下（被打倒後也是）每下都有聲音（${ph} 下）`);
 await a.waitForTimeout(3600);const pa=(await log(a)).filter(n=>n==='pot4').length;ok(pa===5,`被丟的人：躺著被大鐵盆打也有聲音（${pa} 下）`);
 await h.waitForTimeout(3200);
 await h.evaluate(()=>{const s=document.querySelector('input[data-sfx]');s.click();});await h.waitForTimeout(300);
 ok(await h.evaluate(()=>localStorage.getItem('ab_sfx')==='0'&&[...document.querySelectorAll('input[data-sfx]')].every(s=>!s.checked)),'按「音效」關掉：記住');
 await h.evaluate(()=>{__sfx.length=0;});await h.waitForTimeout(4200);await h.evaluate(id=>{fxItem='egg';throwAt(id);},aid);await h.waitForTimeout(800);
 ok((await log(h)).length===0,'音效關掉後丟東西沒有聲音');
 await h.evaluate(()=>{const s=document.querySelector('input[data-sfx]');s.click();});await h.waitForTimeout(300);
 ok(await h.evaluate(()=>localStorage.getItem('ab_sfx')==='1'&&__sfx.includes('throw')),'再按一次打開（會「咻」一聲讓你知道）');
 await x.click('#toWatch');await x.waitForSelector('.ghostcard');await x.waitForTimeout(2300);
 ok(await x.evaluate(()=>BGM.song==='calm'&&document.querySelector('.musbtn').getAttribute('aria-pressed')==='true'),'改觀戰：預設有音樂');
 ok(await h.evaluate(()=>!BGM.song),'玩家那邊還是沒有音樂');
 await a.click('#ready');await h.waitForTimeout(300);await h.click('#start');await h.waitForFunction(()=>g().phase!=='lobby');await x.waitForTimeout(700);
 ok(await x.evaluate(()=>BGM.song==='battle'),'遊戲開始：1 秒內換成戰鬥的曲子（換畫面就換，不用等）');
 await x.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await x.waitForTimeout(300);
 ok(await x.evaluate(()=>!BGM.song&&ChipAudio.hushed),'切到背景就停：總音量先收到 0');
 await x.waitForTimeout(300);ok(await x.evaluate(()=>ChipAudio.state==='suspended'),'收完 0.12 秒後才暫停（不會在還有聲音的地方停住）');
 await x.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await x.waitForTimeout(300);
 ok(await x.evaluate(()=>BGM.song==='battle'&&!ChipAudio.hushed),'回來接著放、音量恢復');
 await x.evaluate(()=>{ChipAudio.playSfx('pot4');Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await x.waitForTimeout(300);
 ok(await x.evaluate(()=>ChipAudio.voices===0),'切到背景時還在響的音效（鐵盆尾巴）一起收掉，回來不會接著響');
 await x.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await x.waitForTimeout(300);
 await h.click('#again');await h.click('#again');await h.waitForFunction(()=>g().phase==='lobby');await x.waitForTimeout(2300);
 ok(await x.evaluate(()=>BGM.song==='calm'),'回到大廳換回輕鬆的曲子');
 const errs=[...p.__errs,...h.__errs,...a.__errs,...x.__errs];ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 await b.close();console.log(fails?'失敗 '+fails:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(1);});
