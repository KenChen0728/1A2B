// 試聽頁：第一版、chip-audio.js（第二、三版音樂，第三、四版音效）每首和每個音效離線算一次；第四版音效要和第三版一樣大聲、手機喇叭模擬下大鐵盆 B 要聽得到；熱血爆發要比平時亮，檢查沒有錯誤、沒有 NaN、不爆音、新版和「現在」差不多大聲（比較才公平）
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8123/1A2B/';
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
/* 遊戲 index.html 裡內嵌的聲音程式要和 tools/chip-audio.js 一模一樣（試聽頁聽到的就是遊戲裡的） */
{const fs=require('fs'),path=require('path'),h=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),c=fs.readFileSync(path.join(__dirname,'chip-audio.js'),'utf8');
 const m=/\/\* ===== chip-audio\.js 開始 ===== \*\/\n([\s\S]*?)\n\/\* ===== chip-audio\.js 結束 ===== \*\//.exec(h);ok(!!m&&m[1]===c.replace(/\n+$/,''),'index.html 裡的聲音程式和 tools/chip-audio.js 一樣');}
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'tools/sound-lab.html');await p.waitForTimeout(300);
 const r=await p.evaluate(async()=>{const rms=async w=>{const bf=await LAB.renderOffline(w,w.sec);let s=0,pk=0,nan=0,n=0;for(let ch=0;ch<2;ch++){const d=bf.getChannelData(ch);for(let i=0;i<d.length;i++){const v=d[i];if(!isFinite(v)){nan++;continue;}s+=v*v;n++;const a=Math.abs(v);if(a>pk)pk=a;}}return{db:10*Math.log10(s/n+1e-12),pk,nan};};
  const o={songs:{},fx:{}};for(const [s,sec] of [['calm',12],['battle',8],['win',8],['lose',9]]){o.songs[s]={old:await rms({song:s,ver:'old',sec}),new:await rms({song:s,ver:'new',sec})};if(s==='calm')o.songs.calmLong=await rms({song:s,ver:'long',sec});}
  /* 第二版（chip-audio.js）：大廳、戰鬥、猜中 4A；殘響和回音是反饋迴路，要確認不會越來越大聲 */
  const st2=b=>{let s=0,pk=0,nan=0,n=0;for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<d.length;i++){const v=d[i];if(!isFinite(v)){nan++;continue;}s+=v*v;n++;const a=Math.abs(v);if(a>pk)pk=a;}}return{db:10*Math.log10(s/n+1e-12),pk,nan};};
  const late=b=>{const d=b.getChannelData(0),h=d.length>>1;let a=0,z=0;for(let i=0;i<h;i++)a+=d[i]*d[i];for(let i=h;i<d.length;i++)z+=d[i]*d[i];return 10*Math.log10((z+1e-12)/(a+1e-12));};
  /* 2kHz 以上的能量（熱血爆發要明顯比平時亮） */
  const hi=b=>{const d=b.getChannelData(0),sr=b.sampleRate,w=2*Math.PI*2000/sr,cs=Math.cos(w),al=Math.sin(w)/(2*.707),a0=1+al,b0=(1+cs)/2/a0,b1=-(1+cs)/a0,a1=-2*cs/a0,a2=(1-al)/a0;let x1=0,x2=0,y1=0,y2=0,e=0;for(let i=0;i<d.length;i++){const x=d[i],y=b0*x+b1*x1+b0*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;e+=y*y;}return 10*Math.log10(e/d.length+1e-12);};
  o.v2={};for(const [n,sec] of [['lobby',40],['battle',30],['lobby2',40],['battle2',30],['battleHot',30]]){const bf=await ChipAudio.render(n,sec);o.v2[n]=Object.assign(st2(bf),{late:late(bf),hi:hi(bf)});}
  for(const n of ['slipper','pot','evade','shield','knock','dizzy','lose','win']){const bf=await ChipAudio.render(n,n==='pot'?3:1.6);o.v2[n]=Object.assign(st2(bf),{late:0,hi:0});}
  /* 第四版音效：50 毫秒最大音量要和第三版一樣（比較才公平）；手機喇叭模擬（500Hz、300Hz 兩個高通，大約是手機小喇叭的低頻衰減）；400Hz 以下占多少；15Hz 發抖；嗡嗡尾巴會停 */
  const mono=b=>{const L=b.getChannelData(0),R=b.getChannelData(1),m=new Float64Array(L.length);for(let i=0;i<m.length;i++)m[i]=(L[i]+R[i])/2;return m;};
  const bq=(d,lp,f0)=>{const w=2*Math.PI*f0/44100,cs=Math.cos(w),al=Math.sin(w)/(2*.7071),a0=1+al,a1=-2*cs,a2=1-al,b0=(lp?1-cs:1+cs)/2,b1=lp?1-cs:-(1+cs),y=new Float64Array(d.length);let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<d.length;i++){const x=d[i],v=(b0*x+b1*x1+b0*x2-a1*y1-a2*y2)/a0;x2=x1;x1=x;y2=y1;y1=v;y[i]=v;}return y;};
  const stm=(d,win)=>{const w=Math.round(win*44100),cs=new Float64Array(d.length+1);for(let i=0;i<d.length;i++)cs[i+1]=cs[i]+d[i]*d[i];let best=0;for(let i=0;i+w<=d.length;i+=441)best=Math.max(best,(cs[i+w]-cs[i])/w);return 10*Math.log10(best+1e-15);};
  const en=d=>{let s=0;for(const v of d)s+=v*v;return s;};
  const trem=(d,t0,t1,f)=>{const h=88,env=[];for(let i=Math.round(t0*44100);i+h<=Math.round(t1*44100);i+=h){let s=0;for(let j=i;j<i+h;j++)s+=d[j]*d[j];env.push(Math.sqrt(s/h));}const mu=env.reduce((x,y)=>x+y,0)/env.length;let re=0,im=0;env.forEach((v,k)=>{const ph=2*Math.PI*f*k*h/44100;re+=(v-mu)*Math.cos(ph);im+=(v-mu)*Math.sin(ph);});return 2*Math.hypot(re,im)/env.length/mu;};
  o.v4={};for(const n of ['slipper','slipper4','pot','pot4','pot4g','shield','shield4','knock','knock4','dizzy','dizzy4','lose','lose4']){const bf=await ChipAudio.render(n,/^pot/.test(n)?3:/^lose/.test(n)?2.2:1),m=mono(bf),tail=m.subarray(m.length-13230);
   o.v4[n]=Object.assign(st2(bf),{stm:stm(m,.05),phone:stm(bq(bq(m,0,500),0,300),.3),low:100*en(bq(bq(m,1,400),1,400))/en(m),tail:10*Math.log10(en(tail)/tail.length+1e-15)});
   if(/^lose/.test(n)){const tl=.05+3*(n==='lose4'?60/140/2:.15);o.v4[n].trem=trem(m,tl+.25,tl+.85,15);}}
  {const bf=await ChipAudio.render('battle',1.6,44100,1.0),L=bf.getChannelData(0),sr=44100;let after=0,jump=0,normal=0;
   for(let i=Math.round(1.035*sr);i<L.length;i++)after=Math.max(after,Math.abs(L[i]));
   for(let i=Math.round(1.0*sr);i<Math.round(1.035*sr);i++)jump=Math.max(jump,Math.abs(L[i]-L[i-1]));
   for(let i=Math.round(0.5*sr);i<Math.round(0.95*sr);i++)normal=Math.max(normal,Math.abs(L[i]-L[i-1]));o.hush={after,jump,normal};}
  for(const k of ['tomato','egg','bomb','slipper','hammer','flower','heart'])o.fx[k]=await rms({fx:'both',item:k,sec:3});for(const k of ['dodge','block','knock','stars'])o.fx[k]=await rms({fx:k,sec:2.2});return o;});
 for(const [s,v] of Object.entries(r.songs)){if(s==='calmLong'){ok(!v.nan&&v.pk<.99,`大廳長音版：沒有 NaN、不爆音（最大 ${v.pk.toFixed(2)}）`);continue;}
   ok(!v.new.nan&&v.new.pk<.99,`${s} 新版：沒有 NaN、不爆音（最大 ${v.new.pk.toFixed(2)}）`);ok(Math.abs(v.new.db-v.old.db)<3,`${s} 新版和現在差不多大聲（${v.new.db.toFixed(1)} / ${v.old.db.toFixed(1)} dB）`);}
 for(const [k,v] of Object.entries(r.fx))ok(!v.nan&&v.pk<.99&&v.pk>.1,`音效 ${k}：有聲音、不爆音（最大 ${v.pk.toFixed(2)}）`);
 for(const [k,v] of Object.entries(r.v2))ok(!v.nan&&v.pk<.99&&v.pk>.08,`chip-audio ${k}：有聲音、不爆音（最大 ${v.pk.toFixed(2)}）`);
 for(const k of ['lobby','lobby2'])ok(Math.abs(r.v2[k].db-r.songs.calm.old.db)<3,`${k} 和現在的大廳差不多大聲（${r.v2[k].db.toFixed(1)} / ${r.songs.calm.old.db.toFixed(1)} dB）`);
 for(const k of ['battle','battle2','battleHot'])ok(Math.abs(r.v2[k].db-r.songs.battle.old.db)<3,`${k} 和現在的遊戲中差不多大聲（${r.v2[k].db.toFixed(1)} / ${r.songs.battle.old.db.toFixed(1)} dB）`);
 for(const k of ['lobby','battle','lobby2','battle2','battleHot'])ok(Math.abs(r.v2[k].late)<3,`${k} 回音殘響不會越積越大聲（後半段比前半段 ${r.v2[k].late.toFixed(1)} dB）`);
 ok(r.v2.battleHot.hi-r.v2.battle.hi>4,`熱血爆發比平時亮（2kHz 以上多 ${(r.v2.battleHot.hi-r.v2.battle.hi).toFixed(1)} dB）`);
 ok(r.v2.battle.hi<r.v2.battle2.hi,`第三版平時比第二版暗，不搶思考（2kHz 以上 ${r.v2.battle.hi.toFixed(1)} / ${r.v2.battle2.hi.toFixed(1)} dB）`);
 const v4=r.v4,f1=x=>x.toFixed(1);
 for(const k of ['slipper4','pot4','pot4g','shield4','knock4','dizzy4','lose4'])ok(!v4[k].nan&&v4[k].pk<.99&&v4[k].pk>.08,`第四版 ${k}：有聲音、不爆音（最大 ${v4[k].pk.toFixed(2)}）`);
 for(const [k,o3] of [['slipper4','slipper'],['pot4','pot'],['pot4g','pot'],['shield4','shield'],['knock4','knock'],['dizzy4','dizzy'],['lose4','lose']])ok(Math.abs(v4[k].stm-v4[o3].stm)<2,`第四版 ${k} 和第三版一樣大聲（${f1(v4[k].stm)} / ${f1(v4[o3].stm)} dB）`);
 ok(v4.pot4.low>v4.pot.low+15&&v4.pot4g.low>v4.pot4.low,`大鐵盆第四版比較低沉：400Hz 以下占 第三版 ${f1(v4.pot.low)}%、B ${f1(v4.pot4.low)}%、A ${f1(v4.pot4g.low)}%`);
 ok(v4.pot4.phone>v4.pot4g.phone+8,`手機喇叭模擬：大鐵盆 B 比 A 大聲 ${f1(v4.pot4.phone-v4.pot4g.phone)} dB（A 的聲音大多在手機放不出來的低頻）`);
 ok(v4.pot4.phone>v4.pot.phone-4,`手機喇叭模擬：大鐵盆 B 和第三版差不多大聲（${f1(v4.pot4.phone)} / ${f1(v4.pot.phone)} dB）`);
 ok(v4.slipper4.phone>v4.slipper.phone+1,`手機喇叭模擬：拖鞋第四版比第三版有聲音（${f1(v4.slipper4.phone)} / ${f1(v4.slipper.phone)} dB）`);
 ok(v4.lose4.trem>.4&&v4.lose.trem<.3,`輸了第四版最後一個音有 15Hz 發抖（調變 ${v4.lose4.trem.toFixed(2)}，第三版 ${v4.lose.trem.toFixed(2)}）`);
 for(const k of ['pot4','pot4g'])ok(v4[k].tail<-60,`${k} 的嗡嗡尾巴和殘響會停（最後 0.3 秒 ${v4[k].tail.toFixed(0)} dB）`);
 const hu=r.hush;ok(hu.after<1e-4&&hu.jump<=hu.normal*1.05+1e-4,`切到背景時 0.03 秒內收到 0，沒有突然斷掉的跳動（收完後最大 ${hu.after.toExponential(1)}，收的時候每一格最大跳 ${hu.jump.toFixed(3)}，平常 ${hu.normal.toFixed(3)}）`);
 ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 console.log(fails?'失敗':'全部通過');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
