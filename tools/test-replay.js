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
  out.bad=bad.slice(0,5);return out;});
 console.log(JSON.stringify(res.five.adv),'\n',res.five.tip,'\n',res.five.more,res.tags.join());
 const f=res.bad.length||!res.same||!/7941/.test(res.five.tip+res.five.adv.txt)||res.five.tag==='bad';console.log(res.bad,f?'失敗':'全部通過');await b.close();process.exit(f?1:0);})().catch(e=>{console.error(e);process.exit(1)});
