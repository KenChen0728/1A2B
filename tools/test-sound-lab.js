// 試聽頁：第一版、第二版（chip-audio.js）每首和每個音效離線算一次，檢查沒有錯誤、沒有 NaN、不爆音、新版和「現在」差不多大聲（比較才公平）
const {chromium}=require('playwright');const BASE=process.env.BASE||'http://localhost:8123/1A2B/';
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(BASE+'tools/sound-lab.html');await p.waitForTimeout(300);
 const r=await p.evaluate(async()=>{const rms=async w=>{const bf=await LAB.renderOffline(w,w.sec);let s=0,pk=0,nan=0,n=0;for(let ch=0;ch<2;ch++){const d=bf.getChannelData(ch);for(let i=0;i<d.length;i++){const v=d[i];if(!isFinite(v)){nan++;continue;}s+=v*v;n++;const a=Math.abs(v);if(a>pk)pk=a;}}return{db:10*Math.log10(s/n+1e-12),pk,nan};};
  const o={songs:{},fx:{}};for(const [s,sec] of [['calm',12],['battle',8],['win',8],['lose',9]]){o.songs[s]={old:await rms({song:s,ver:'old',sec}),new:await rms({song:s,ver:'new',sec})};if(s==='calm')o.songs.calmLong=await rms({song:s,ver:'long',sec});}
  /* 第二版（chip-audio.js）：大廳、戰鬥、猜中 4A；殘響和回音是反饋迴路，要確認不會越來越大聲 */
  const st2=b=>{let s=0,pk=0,nan=0,n=0;for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<d.length;i++){const v=d[i];if(!isFinite(v)){nan++;continue;}s+=v*v;n++;const a=Math.abs(v);if(a>pk)pk=a;}}return{db:10*Math.log10(s/n+1e-12),pk,nan};};
  const late=b=>{const d=b.getChannelData(0),h=d.length>>1;let a=0,z=0;for(let i=0;i<h;i++)a+=d[i]*d[i];for(let i=h;i<d.length;i++)z+=d[i]*d[i];return 10*Math.log10((z+1e-12)/(a+1e-12));};
  o.v2={};for(const [n,sec] of [['lobby',40],['battle',30],['win',2.5]]){const bf=await ChipAudio.render(n,sec);o.v2[n]=Object.assign(st2(bf),{late:late(bf)});}
  for(const k of ['tomato','egg','bomb','slipper','hammer','flower','heart'])o.fx[k]=await rms({fx:'both',item:k,sec:3});for(const k of ['dodge','block','knock','stars'])o.fx[k]=await rms({fx:k,sec:2.2});return o;});
 for(const [s,v] of Object.entries(r.songs)){if(s==='calmLong'){ok(!v.nan&&v.pk<.99,`大廳長音版：沒有 NaN、不爆音（最大 ${v.pk.toFixed(2)}）`);continue;}
   ok(!v.new.nan&&v.new.pk<.99,`${s} 新版：沒有 NaN、不爆音（最大 ${v.new.pk.toFixed(2)}）`);ok(Math.abs(v.new.db-v.old.db)<3,`${s} 新版和現在差不多大聲（${v.new.db.toFixed(1)} / ${v.old.db.toFixed(1)} dB）`);}
 for(const [k,v] of Object.entries(r.fx))ok(!v.nan&&v.pk<.99&&v.pk>.1,`音效 ${k}：有聲音、不爆音（最大 ${v.pk.toFixed(2)}）`);
 for(const [k,v] of Object.entries(r.v2))ok(!v.nan&&v.pk<.99&&v.pk>.1,`第二版 ${k}：有聲音、不爆音（最大 ${v.pk.toFixed(2)}）`);
 ok(Math.abs(r.v2.lobby.db-r.songs.calm.old.db)<3&&Math.abs(r.v2.battle.db-r.songs.battle.old.db)<3,`第二版和現在差不多大聲（大廳 ${r.v2.lobby.db.toFixed(1)} / ${r.songs.calm.old.db.toFixed(1)}、戰鬥 ${r.v2.battle.db.toFixed(1)} / ${r.songs.battle.old.db.toFixed(1)} dB）`);
 ok(Math.abs(r.v2.lobby.late)<3&&Math.abs(r.v2.battle.late)<3,`第二版回音殘響不會越積越大聲（後半段比前半段 大廳 ${r.v2.lobby.late.toFixed(1)}、戰鬥 ${r.v2.battle.late.toFixed(1)} dB）`);
 ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 console.log(fails?'失敗':'全部通過');await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
