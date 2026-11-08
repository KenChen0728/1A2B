// 試聽頁：第一版、chip-audio.js（第二、三版）每首和每個音效離線算一次；熱血爆發要比平時亮，檢查沒有錯誤、沒有 NaN、不爆音、新版和「現在」差不多大聲（比較才公平）
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8123/1A2B/';
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
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
 ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 console.log(fails?'失敗':'全部通過');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
