// 房間清理：放一天沒動靜的房間，下次打開遊戲要收掉；還有人在的不能動。首頁的編輯角色要能改名字。
const {chromium,ctx,page,name,reset,BASE}=require('./lib');
(async()=>{await reset();const b=await chromium.launch(),c=await ctx(b),p=await page(c);await name(p,'阿明');
 const mk=(code,hb)=>p.evaluate(async([code,hb])=>{await db.doc('rooms/'+code).set({ver:ROOM_VER,code,host:'other',createdAt:hb,phase:'lobby',seats:{[me]:{name:'阿明',hb},other:{name:'小美',hb}}});rememberRoom(code,me);},[code,hb]);
 const now=Date.now();await mk('OLD1',now-2*864e5);await mk('NEW1',now-36e5);
 await p.evaluate(()=>rememberRoom('GONE',me));
 await p.reload();await p.waitForTimeout(900);
 const r=await p.evaluate(async()=>({old:(await db.doc('rooms/OLD1').get()).exists,fresh:(await db.doc('rooms/NEW1').get()).exists,list:myRooms().map(x=>x.c)}));
 const ok1=!r.old&&r.fresh&&r.list.join()==='NEW1';console.log(ok1?'OK':'FAIL','清理',JSON.stringify(r));
 await p.click('#lookBtn');await p.fill('#lookName','新名字');await p.click('[data-tab="acc"]').catch(()=>{});
 const kept=await p.inputValue('#lookName');await p.click('[data-lk="ok"]');await p.waitForTimeout(200);
 const nm=await p.evaluate(()=>[nick,localStorage.getItem('ab_nick')]);
 const ok2=kept==='新名字'&&nm[0]==='新名字'&&nm[1]==='新名字'&&!(await p.$('#nameBtn'));console.log(ok2?'OK':'FAIL','改名',JSON.stringify(nm));
 await p.click('#lookBtn');await p.fill('#lookName','不要存');await p.click('[data-lk="x"]');
 const nm2=await p.evaluate(()=>nick);console.log(nm2==='新名字'?'OK':'FAIL','取消不存',nm2,p.__errs.join());
 await b.close();process.exit(ok1&&ok2&&nm2==='新名字'?0:1);})();
