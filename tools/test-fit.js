// 手機上各畫面要不要上下滑：印出每個畫面超出幾 px。第二個參數 FIT=1 時，規定要一屏放下的畫面超出就算失敗。
const {chromium,BASE,ctx,name,reset,room,guess,SHOTS}=require('./lib');
const PROFILES=[
 ['pwa430',430,868,0,34],['pwa402',402,810,0,34],['pwa393',393,793,0,34],['pwa390',390,797,0,34],['pwa375',375,762,0,34],
 ['se',375,647,0,0],['safari390',390,664,0,0],['safari430',430,746,0,0],['line390',390,700,0,0],['and360',360,640,0,0],['and412',412,783,0,0]];
const only=process.argv[2];
const MUST=new Set(['home','join','soloCfg','soloSetup','soloResult','lobbyHost','lobbyGuest','lobbyGuestReady','lobbyHost8','lobbyGuest8','coopLobby','secret','secretWait','overBtn','soloPlay0','soloPlay1','soloPlay3','play0','play1','play3','coopPlay0']);
const css=(t,b)=>`:root{--safe-top:${t}px!important;--safe-bot:${b}px!important}`;
const measure=(p)=>p.evaluate(()=>{const de=document.documentElement;return{over:Math.max(0,de.scrollHeight-innerHeight),h:de.scrollHeight};});
(async()=>{const b=await chromium.launch();let fail=0;const rows={};
 for(const [nm,w,h,st,sb] of PROFILES){if(only&&only!==nm&&only!=='all'&&only!=='1')continue;
  await reset();
  const opt={vp:{width:w,height:h},touch:true,mobile:false};
  const inj=async c=>c.addInitScript(([s])=>{addEventListener('DOMContentLoaded',()=>{const e=document.createElement('style');e.textContent=s;document.head.appendChild(e);});try{localStorage.setItem('ab_help_seen','1');}catch(e){}},[css(st,sb)]);
  const R={};const rec=async(p,k)=>{await p.waitForTimeout(280);R[k]=(await measure(p)).over;if(process.env.SHOT)await p.screenshot({path:`${process.env.SHOT}/${nm}-${k}.png`,fullPage:!!process.env.FULL});};
  const c=await ctx(b,opt);await inj(c);const p=await c.newPage();p.on('pageerror',e=>console.log('頁面錯誤',e.message));p.on('crash',()=>console.log('分頁當掉'));await p.goto(BASE);await p.waitForTimeout(300);await name(p,'小明');
  await rec(p,'home');
  await p.click('#goJoin');await rec(p,'join');await p.click('#homeBack');
  await p.click('#goSolo');await rec(p,'soloCfg');
  await p.click('#soloStart');await rec(p,'soloSetup');
  await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(150);await p.evaluate(()=>{const v=document.getElementById('vsM');if(v&&!v.hidden)v.click();});await rec(p,'soloPlay0');
  await guess(p,'1234');await p.waitForTimeout(1900);await rec(p,'soloPlay1');
  await guess(p,'5678');await p.waitForTimeout(1900);await guess(p,'9012');await p.waitForTimeout(1900);await rec(p,'soloPlay3');
  await p.click('#giveUp');await p.click('#giveUp');await rec(p,'soloResult');
  await p.click('#soloQuit');await p.waitForTimeout(100);await p.click('#goSolo');await p.click('[data-smode="practice"]').catch(()=>{});await p.waitForTimeout(80);
  await c.close();
  const cs=[],ps=[];const r=await (async()=>{const c0=await ctx(b,opt);await inj(c0);const p0=await c0.newPage();await p0.goto(BASE);await p0.waitForTimeout(250);await name(p0,'房主阿明');await p0.click('#create');await p0.waitForSelector('#copyCode');const code=await p0.textContent('.codebox b');
   const c1=await ctx(b,opt);await inj(c1);const p1=await c1.newPage();await p1.goto(BASE+'#'+code);await p1.waitForTimeout(250);await name(p1,'小美','#joinBtn');await p1.click('#joinBtn');await p1.waitForSelector('#ready');return{code,ps:[p0,p1],cs:[c0,c1]};})();
  const [ho,gu]=r.ps;
  await rec(ho,'lobbyHost');await rec(gu,'lobbyGuest');
  await ho.evaluate(async()=>{const seats={};for(let i=0;i<6;i++)seats['f'+i]={name:'玩家名字'+i,ready:i%2===0,joinedAt:Date.now(),look:'1.1.1.1.1.1.0',hb:Date.now()};await roomRef().update({seats,lastResult:{round:1,text:'房主阿明 獲勝（4 次猜中）'}});});
  await rec(ho,'lobbyHost8');await rec(gu,'lobbyGuest8');
  await ho.evaluate(async()=>{const seats={};for(let i=0;i<6;i++)seats['f'+i]=null;await roomRef().update({seats});});await ho.waitForTimeout(200);
  await gu.click('#ready');await ho.waitForTimeout(250);await rec(gu,'lobbyGuestReady');await ho.click('#start');await gu.waitForSelector('.pad');
  await rec(ho,'secret');await ho.click('#randSecret');await ho.click('.pad [data-k="ok"]');await rec(ho,'secretWait');
  await gu.click('#randSecret');await gu.click('.pad [data-k="ok"]');await gu.waitForTimeout(150);await rec(gu,'countdown');
  await gu.waitForSelector('.pad',{timeout:9000});await rec(gu,'play0');
  await guess(gu,'1234');await rec(gu,'play1');await guess(gu,'5678');await guess(ho,'1234');await guess(gu,'9012');await rec(gu,'play3');
  const a=await gu.evaluate(()=>secretOf(derive().A[me]));const a2=await ho.evaluate(()=>secretOf(derive().A[me]));await guess(gu,a);await rec(gu,'playDone');await guess(ho,a2);await gu.waitForTimeout(500);await rec(gu,'over');
  R.overBtn=await gu.evaluate(()=>{const r=document.getElementById('again').getBoundingClientRect();return Math.max(0,Math.round(r.bottom-innerHeight));});
  await r.cs[0].close();await r.cs[1].close();
  // 合作
  await reset();const c0=await ctx(b,opt);await inj(c0);const q=await c0.newPage();await q.goto(BASE);await q.waitForTimeout(250);await name(q,'房主阿明');await q.click('#create');await q.waitForSelector('#copyCode');
  await q.click('[data-gmode="coop"]');await rec(q,'coopLobby');await q.click('#start');await q.waitForTimeout(5000);await rec(q,'coopPlay0');
  await c0.close();
  rows[nm]=R;
  const bad=Object.entries(R).filter(([k,v])=>MUST.has(k)&&v>0);if(bad.length)fail+=bad.length;
  console.log(nm.padEnd(10),`${w}x${h}`,Object.entries(R).filter(([k,v])=>v>0).map(([k,v])=>`${MUST.has(k)?'!':''}${k}+${v}`).join(' ')||'全部一屏');
 }
 await b.close();console.log('要一屏放下卻超出',fail);process.exit(process.env.FIT&&fail?1:0);})().catch(e=>{console.error(e);process.exit(1)});
