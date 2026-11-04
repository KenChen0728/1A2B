const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const BASE=process.env.BASE||'http://localhost:8123/1A2B/', SHOTS=process.env.SHOTS||__dirname+'/shots';
fs.mkdirSync(SHOTS,{recursive:true});
const fake=f=>fs.readFileSync(path.join(__dirname,'fake',f),'utf8');
async function ctx(browser,opt={}){
  const c=await browser.newContext({viewport:opt.vp||{width:390,height:844},deviceScaleFactor:opt.dsf||1,hasTouch:opt.touch!==false,isMobile:opt.mobile!==false,colorScheme:opt.dark?'dark':'light',locale:'zh-TW',reducedMotion:opt.rm?'reduce':'no-preference'});
  await c.route('https://www.gstatic.com/firebasejs/**',r=>{const f=r.request().url().split('/').pop();r.fulfill({contentType:'text/javascript',body:fake(f),headers:{'access-control-allow-origin':'*'}});});
  await c.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await c.route('https://fonts.gstatic.com/**',r=>r.abort());
  return c;
}
async function page(c,url,seen){const p=await c.newPage();p.__errs=[];p.on('pageerror',e=>p.__errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/net::|Failed to load resource/.test(m.text()))p.__errs.push('console: '+m.text());});p.on('dialog',d=>{(p.__dlg=p.__dlg||[]).push(d.message());d.accept();});
  if(seen!==false)await p.addInitScript(()=>{try{localStorage.setItem('ab_help_seen','1');}catch(e){}});
  await p.goto(url||BASE);await p.waitForTimeout(300);return p;}
const shot=(p,n,full)=>p.screenshot({path:`${SHOTS}/${n}.png`,fullPage:!!full});
async function name(p,n,sel){await p.fill('#nick',n);await p.click('#nickOk');await p.waitForSelector(sel||'#create');}
async function typeNum(p,s){for(const d of s){await p.click(`.pad [data-k="${d}"]`);}}
const reset=()=>fetch('http://localhost:8123/__reset');
// 版面檢查：有沒有超出畫面、被切掉
const layout=p=>p.evaluate(()=>{const W=innerWidth,bad=[];const de=document.documentElement;if(de.scrollWidth>W+1)bad.push('pageW '+de.scrollWidth+'>'+W);
  document.querySelectorAll('#app *, .upd:not([hidden]) *').forEach(e=>{if(e.closest('svg'))return;const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.position==='fixed')return;if(r.right>W+1||r.left<-1)bad.push((e.id||e.className||e.tagName)+' x['+Math.round(r.left)+','+Math.round(r.right)+']');});
  return [...new Set(bad)].slice(0,8);});
module.exports={chromium,BASE,ctx,page,shot,name,typeNum,reset,layout,SHOTS};
async function room(b,n,opt={}){const cs=[],ps=[];for(let i=0;i<n;i++){cs.push(await ctx(b,opt));}
 const p0=await page(cs[0]);await name(p0,'房主阿明');await p0.click('#create');await p0.waitForSelector('#copyCode');
 const code=await p0.textContent('.codebox b');ps.push(p0);
 for(let i=1;i<n;i++){const p=await page(cs[i],BASE+'#'+code);await name(p,['小美','大雄','胖虎'][i-1],'#joinBtn');await p.click('#joinBtn');await p.waitForSelector('#ready');ps.push(p);}
 return{code,ps,cs};}
const guess=async(p,s)=>{await typeNum(p,s);await p.click('.pad [data-k="ok"]');await p.waitForTimeout(120);};
module.exports.room=room;module.exports.guess=guess;
