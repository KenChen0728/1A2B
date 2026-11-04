const {chromium,BASE,ctx,page,shot,name,typeNum,reset,layout,room,guess}=require('./lib');
const SIZES=[[360,640],[375,667],[390,844],[402,874],[430,932],[844,390],[667,375],[768,1024],[1024,768],[820,1180],[1180,820],[1366,768],[1280,800],[1920,1080],[2560,1440]];
(async()=>{await reset();const b=await chromium.launch();let bad=0;
 for(const [w,h] of SIZES){const mobile=w<1100;const c=await ctx(b,{vp:{width:w,height:h},mobile:false,touch:mobile});const p=await page(c);await name(p,'小明');await p.waitForTimeout(120);
  const res={};const chk=async k=>{const L=await layout(p);res[k]=L;if(L.length)bad++;};
  await chk('home');const mainOk=await p.evaluate(()=>{const r=document.getElementById('create').getBoundingClientRect();return Math.round(r.bottom);});
  await p.click('#goSolo');await p.waitForTimeout(60);await chk('soloCfg');const st=await p.evaluate(()=>Math.round(document.getElementById('soloStart').getBoundingClientRect().bottom));
  await p.click('#soloStart');await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(120);await chk('solo');
  const ok=await p.evaluate(()=>Math.round(document.querySelector('.pad [data-k=ok]').getBoundingClientRect().bottom));
  await guess(p,'1234');await p.waitForTimeout(1900);await p.click('#notesFab').catch(()=>{});await p.waitForTimeout(280);await chk('notes');await p.evaluate(()=>setNotes(false));
  await p.click('#giveUp');await p.click('#giveUp');await p.waitForTimeout(150);await chk('result');
  if([390,768,1024,1366,1920,844].includes(w)){await shot(p,`d-${w}x${h}-result`);await p.click('#soloAgain');await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(150);await shot(p,`d-${w}x${h}-solo`);await p.click('#soloQuit');await p.waitForTimeout(100);await shot(p,`d-${w}x${h}-home`);}
  console.log(`${w}x${h}`,'開房底',mainOk,'開始底',st,'確定底',ok,'/',h,JSON.stringify(Object.fromEntries(Object.entries(res).filter(([k,v])=>v.length))),p.__errs.join('|'));await c.close();}
 console.log('bad',bad);await b.close();})().catch(e=>{console.error(e);process.exit(1)});
