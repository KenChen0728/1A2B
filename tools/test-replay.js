// 復盤建議：每一手都有、一定符合前面所有線索、打開幾次都一樣
const {chromium,ctx,page,name,reset}=require('./lib');
(async()=>{await reset();const b=await chromium.launch(),c=await ctx(b,{vp:{width:402,height:810}}),p=await page(c);await name(p,'小明');
 const res=await p.evaluate(()=>{const mk=(a,L)=>L.map((g,i)=>{const r=score(a,g);return{n:i+1,g,A:r.A,B:r.B};});
  const H=mk('7941',['1234','5678','6129','7302','7914','7941']),S=rpMine(H,4,false,'7941'),S2=rpMine(H,4,false,'7941');
  const bad=[];const out={five:S.steps[4],same:JSON.stringify(S)===JSON.stringify(S2),tags:S.steps.map(x=>x.tag)};
  S.steps.slice(1,5).forEach((x,i)=>{if(!x.adv)bad.push('沒有建議 '+i);});
  const R=()=>{const d='0123456789'.split('').sort(()=>Math.random()-.5);return d.slice(0,4).join('');};
  for(let t=0;t<120;t++){const a=R(),L=[];for(let i=0;i<7;i++)L.push(R());L.push(a);const H2=mk(a,[...new Set(L)]),St=rpMine(H2,4,false,a).steps;
   St.forEach((st,k)=>{if(!st.adv)return;const m=/猜 (\d{4})/.exec(st.adv.title);if(!m)return;if(!fits(m[1],H2.slice(0,k)))bad.push(`建議 ${m[1]} 和前面矛盾`);if(/undefined|NaN/.test(st.adv.txt+st.tip+st.more))bad.push(st.tip);});}
  /* 建議是猜這手之前的判斷：結果讓它不成立時要講清楚，第一手也要有「現在知道」 */
  const U=rpMine(mk('5617',['1234','5678']),4,false,'5617').steps;out.u=U[1].adv;out.first=U[0].more;
  if(!/猜這手之前/.test(U[1].adv.title)||!/才知道/.test(U[1].adv.txt)||!/當時/.test(U[1].adv.txt))bad.push('沒講清楚建議是猜之前的');
  if(!/裡有 1 個/.test(U[0].more))bad.push('第一手現在知道是空的');
  /* 人跟得上的理由（11/08）：每條「沒有／有」都要是真的；重複測已知沒有的數字要點出來；小天使提醒上一手確定了什麼，但不講第幾位是誰 */
  const UH=mk('1962',['1234','5678','1945','1054','1053','1963','1983','1962']),US=rpMine(UH,4,false,'1962').steps;
  if(!US[3].why.some(w=>/沒有 4、5：.*0B/.test(w)))bad.push('1054 沒說 4、5 為什麼沒有：'+US[3].why.join(' | '));
  if(!/0、5 前面已經確定沒有.*只測了 3/.test(US[4].tip))bad.push('1053 沒點出重複測 0、5：'+US[4].tip);
  if(!/8、3 前面已經確定沒有/.test(US[6].tip))bad.push('1983 沒點出重複測：'+US[6].tip);
  if(!US[5].why.some(w=>/^沒有 7、8：5678 只有 1 個對，已經確定是 6/.test(w)))bad.push('1963 沒說 7、8：'+US[5].why.join(' | '));
  const chkWhy=(st,a)=>{const K=st.know;(st.why||[]).forEach(w=>{if(/undefined|NaN|§/.test(w))bad.push('理由有怪字 '+w);
    const m=/^(沒有|有) ([\d、]+)：/.exec(w);if(!m){bad.push('理由格式 '+w);return;}
    m[2].split('、').forEach(d=>{if(m[1]==='沒有'?!K.no.includes(d):!K.yes.includes(d))bad.push(`理由說${m[1]} ${d} 但不對（答案 ${a}）：${w}`);});});};
  for(let t=0;t<150;t++){const a=R(),L=[];for(let i=0;i<7;i++)L.push(R());L.push(a);const H3=mk(a,[...new Set(L)]);rpMine(H3,4,false,a).steps.forEach(st=>{chkWhy(st,a);if(/undefined|NaN/.test(st.tip||''))bad.push(st.tip);});}
  input='';const ang=[4,5,6].map(k=>angelHelp(UH.slice(0,k),4,false).replace(/<[^>]+>/g,' '));out.ang=ang[0];
  if(!/上一手 1054（1A0B）讓你確定了/.test(ang[0])||!/沒有 4、5/.test(ang[0]))bad.push('小天使沒提醒上一手：'+ang[0]);
  if(ang.some(x=>/已經是 \d|原本的位置|第 \d 位是/.test(x)))bad.push('小天使講了位置：'+ang.join(' / '));
  out.bad=bad.slice(0,5);return out;});
 console.log(JSON.stringify(res.u),res.first);console.log('小天使：',res.ang);
 console.log(JSON.stringify(res.five.adv),'\n',res.five.tip,'\n',res.five.more,res.tags.join());
 const f=res.bad.length||!res.same||!/7941/.test(res.five.tip+res.five.adv.txt)||res.five.tag==='bad';console.log(res.bad,f?'失敗':'全部通過');await b.close();process.exit(f?1:0);})().catch(e=>{console.error(e);process.exit(1)});
