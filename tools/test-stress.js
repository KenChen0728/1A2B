const {chromium,BASE,ctx,page,shot,name,typeNum,reset,layout,room,guess}=require('./lib');
(async()=>{await reset();const b=await chromium.launch();
 for(const vp of [{width:360,height:640},{width:1024,height:768}]){
 const c=await ctx(b,{vp,mobile:false});const p=await page(c);await name(p,'WWWWWWWW');await p.click('#create');await p.waitForSelector('#copyCode');
 await p.evaluate(async()=>{const S={};const names=['你還要猜多久啦','MMMMMMMM','阿明','小美','超長名字八個字元','abcdefgh','路人甲'];names.forEach((n,i)=>S['f'+i]={name:n,ready:true,joinedAt:Date.now()+i+1,look:'1.'+(i%10)+'.'+(i%14)+'.'+(i%7)+'.'+(i%11)+'.'+(i%9)+'.0'});await roomRef().update({seats:S});});
 await p.waitForTimeout(400);console.log(vp.width,'lobby',await layout(p));await shot(p,`b-${vp.width}-lobby8`,true);
 // 開始、直接灌資料到結算
 await p.click('#start');await p.waitForSelector('.pad');await p.click('#randSecret');await p.click('.pad [data-k="ok"]');await p.waitForTimeout(200);
 await p.evaluate(async()=>{const s=g(),D=derive();for(const id of D.parts){if(id===me)continue;await db.collection(`rooms/${code}/secrets`).doc(`r${s.round}_${id}`).set({round:s.round,pid:id,c:enc('1234',s.round,id)});}
   const S={};D.parts.forEach(id=>{if(id!==me)S[id]={ack:s.round};});await roomRef().update({seats:S});});
 await p.waitForSelector('.pad',{timeout:9000});await p.waitForTimeout(300);
 await p.evaluate(async()=>{const s=g(),D=derive();let i=0;for(const id of D.parts){if(id===me)continue;const n=4+(i++);for(let k=1;k<=n;k++){const hit=k===n;const G=hit?secretOf(D.A[id]):'5678';const r=score(secretOf(D.A[id]),G);await db.collection(`rooms/${code}/guesses`).doc(`r${s.round}_${id}_${k}`).set({round:s.round,pid:id,target:D.A[id],n:k,g:G,A:r.A,B:r.B,at:Date.now()});}}});
 for(let k=0;k<25;k++){const a=await p.evaluate(()=>secretOf(derive().A[me]));const gs=(k+'').padStart(2,'0')+'89';await p.evaluate(v=>{input=v;render();},'1'+'0'.repeat(0)+'987'.slice(0,3));await p.click('.pad [data-k="ok"]');await p.waitForTimeout(70);}
 await p.waitForTimeout(300);console.log(vp.width,'play',await layout(p));await shot(p,`b-${vp.width}-play8`,true);
 await p.click('#giveUp');await p.click('#giveUp');await p.waitForTimeout(500);console.log(vp.width,'over',await layout(p));await shot(p,`b-${vp.width}-over8`,true);
 console.log(p.__errs);await c.close();}
 await b.close();})().catch(e=>{console.error(e);process.exit(1)});
