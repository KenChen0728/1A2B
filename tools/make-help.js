// 重新產生說明裡的真實畫面截圖（畫面改版後跑一次）：先開 node tools/server.js，再 node tools/make-help.js
const {chromium,BASE,ctx,page,reset,name,guess,room}=require('./lib');const fs=require('fs'),path=require('path');
const RAW=path.join(__dirname,'shots','help');fs.mkdirSync(RAW,{recursive:true});
const W=366,H=206,opt={dsf:2};
const LOOK='1.1.1.1.3.0.0';
async function grab(p,n,sel,dy=0){ // 把 sel 捲到畫面上方，截一塊固定大小（比例和說明的圖框一樣）
  const y=await p.evaluate(({sel,dy})=>{const e=document.querySelector(sel);const r=e.getBoundingClientRect();const t=r.top+scrollY-dy;window.scrollTo(0,Math.max(0,t-20));return Math.round(t-Math.max(0,t-20)>=0?(document.querySelector(sel).getBoundingClientRect().top-dy):0);},{sel,dy});
  await p.waitForTimeout(120);
  const vp=p.viewportSize(),top=Math.max(0,Math.min(y,vp.height-H));
  await p.screenshot({path:`${RAW}/${n}.png`,clip:{x:(vp.width-W)/2,y:top,width:W,height:H}});}
(async()=>{await reset();const b=await chromium.launch();
 const init=c=>c.addInitScript(l=>{try{localStorage.setItem('ab_help_seen','1');localStorage.setItem('ab_look',l);}catch(e){}},LOOK);
 // 單人
 let c=await ctx(b,opt);await init(c);let p=await page(c);await name(p,'小明');
 await grab(p,'friends1','.homemenu',16);
 await p.click('#goSolo');await grab(p,'solo1','.card.solo',8);
 await p.click('[data-smode="practice"]');await p.click('#soloStart');await p.waitForTimeout(100);await p.evaluate(()=>{solo.secret='5278';});
 await guess(p,'1234');await guess(p,'5678');await p.waitForTimeout(3300);await grab(p,'rule2','#mineH',64);
 await p.click('#hintBtn');await p.waitForSelector('.posbox');await p.waitForTimeout(200);await p.click('.posb[data-p="1"]');await p.waitForTimeout(80);
 await p.screenshot({path:`${RAW}/stuck2.png`,clip:{x:12,y:(p.viewportSize().height-H)/2,width:W,height:H}});await p.click('[data-x="ok"]');await p.waitForTimeout(3300);
 await p.click('#soloAngel');await p.waitForTimeout(700);await p.screenshot({path:`${RAW}/stuck3.png`,clip:{x:12,y:0,width:W,height:H}});await p.click('.aclose');
 await grab(p,'stuck4','.tools',120);
 await p.click('#notesFab');await p.waitForTimeout(350);await p.screenshot({path:`${RAW}/stuck1.png`,clip:{x:390-W,y:0,width:W,height:H}});await p.click('#notesClose');await p.waitForTimeout(100);
 await guess(p,'5278');await p.waitForTimeout(300);await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(3300);await grab(p,'rule3','h1',10);await p.click('#soloQuit');
 // 對魔王
 await p.click('#goSolo');await p.click('[data-smode="duel"]');await p.selectOption('#stageSel','office');await p.click('#soloStart');await p.waitForTimeout(100);await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(120);
 await guess(p,'1234');await p.waitForTimeout(2000);await grab(p,'solo2','.card.vil',8);
 await p.click('#giveUp');await p.click('#giveUp');await p.waitForTimeout(300);await p.click('#explainBtn');await p.waitForTimeout(120);await grab(p,'solo3','#explainBtn',60);
 await c.close();
 // 多人
 await reset();const r=await room(b,3,opt);const [h,a,x]=r.ps;for(const q of r.ps)await q.evaluate(l=>localStorage.setItem('ab_look',l),LOOK);await h.waitForTimeout(300);
 await grab(a,'friends3','#ready',150);
 await grab(h,'fun1','.ibar',190);
 await h.click('[data-fin="0"]');await h.waitForTimeout(250);await grab(h,'modes2','[data-fin="1"]',60);await h.click('[data-fin="1"]');await h.waitForTimeout(150);
 await a.click('#ready');await x.click('#ready');await h.waitForTimeout(250);await h.click('#start');await a.waitForSelector('.pad');await a.waitForTimeout(150);await grab(a,'friends4','#randSecret',96);
 for(const q of [h,a,x]){await q.click('#randSecret');await q.click('.pad [data-k="ok"]');}
 await h.waitForTimeout(5200);await h.waitForSelector('.pad');for(const q of [h,a,x]){const v=await q.evaluate(()=>secretOf(derive().A[me]));if(q!==x){await guess(q,v);}else{await q.click('#giveUp');await q.click('#giveUp');}}
 await a.waitForTimeout(700);await a.evaluate(()=>window.scrollTo(0,0));await grab(x,'fun2','svg.podium',-110);
 await h.click('#again');await h.waitForTimeout(300);await a.click('#endReview').catch(()=>{});await x.click('#endReview').catch(()=>{});await a.waitForTimeout(200);
 await h.click('[data-gmode="coop"]');await h.waitForTimeout(200);await a.click('#ready');await x.click('#ready');
 const wc=await ctx(b,opt);await init(wc);const w=await page(wc,BASE+'#'+r.code);await name(w,'路人','#watchBtn');await grab(w,'watch0','.card',8);await w.click('#watchBtn');await w.waitForTimeout(300);
 await h.waitForTimeout(250);await h.click('#start');await h.waitForTimeout(3900);
 const mine=[h,a,x];for(const q of mine){if(await q.evaluate(()=>coopState().guesser===me)){await grab(q,'modes3','.turn',64);break;}}
 await w.waitForTimeout(200);await grab(w,'watch1','.ghostcard',8);
 await b.close();})().catch(e=>{console.error(e);process.exit(1)});
