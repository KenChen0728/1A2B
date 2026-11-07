// 換了瀏覽器的人接回原本的位子、合作中途進來排進輪流、輪到離線的人自動到場邊、
// 觀眾重新整理還是觀眾、場邊改成觀眾、觀眾派的天使全隊都看得到、玩家都離線時觀眾看得到說明、
// 舊邀請連結：Firebase 慢的時候改打的代碼不會被換回舊的
const {chromium,ctx,page,name,reset,room,guess,BASE}=require('./lib');
const fs=require('fs'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
const opt={vp:{width:402,height:810}};
const both=async(p,id)=>{await p.click(id);await p.waitForTimeout(80);await p.click(id);};
const fsq=q=>fetch(new URL('/__fs',BASE),{method:'POST',body:JSON.stringify(q)}).then(r=>r.json());
const coopGo=async(h,rest)=>{await h.click('[data-gmode="coop"]');await h.waitForTimeout(250);for(const q of rest)await q.click('#ready');await h.waitForTimeout(300);await h.click('#start');
  await h.waitForFunction(()=>{const C=coopState();return C&&!C.countdown&&C.guesser;},null,{timeout:15000});};
const ids=ps=>Promise.all(ps.map(p=>p.evaluate(()=>me)));
/* 讓目前輪到的人猜一手（猜不中的數字），等魔王回完 */
async function turn(h,ps){const g=await h.evaluate(()=>coopState().guesser),I=await ids(ps),p=ps[I.indexOf(g)];if(!p)return false;
  await p.waitForSelector('.pad',{timeout:8000});const n=await h.evaluate(()=>coopState().T.length);const boss=await h.evaluate(()=>coopState().bossSecret);
  const cand=['1234','5678','9012','3456','7890','2468','1357'].find(x=>x!==boss);await guess(p,cand);
  await h.waitForFunction(n=>{const C=coopState();return C.T.length>n&&!C.waitingBoss;},n,{timeout:15000});return true;}
(async()=>{const b=await chromium.launch();
 /* ---------- 合作：中途進來排進輪流，輪到誰不變 ---------- */
 await reset();let r=await room(b,2,opt);let [h,a]=r.ps;await coopGo(h,[a]);
 const g0=await h.evaluate(()=>coopState().guesser);
 const cn=await ctx(b,opt);const n1=await page(cn,BASE+'#'+r.code);await name(n1,'路人','#joinBtn');await n1.click('#joinBtn');
 await h.waitForFunction(()=>coopState().order.length===3,null,{timeout:9000}).catch(()=>{});
 ok(await h.evaluate(()=>coopState().order.length===3),'合作開局後才加入的人自動排進輪流');
 ok(await h.evaluate(g0=>coopState().guesser===g0,g0),'排進來不會改變現在輪到誰');
 let reached=false;for(let i=0;i<4&&!reached;i++){reached=await n1.evaluate(()=>coopState().guesser===me);if(!reached)await turn(h,[h,a,n1]);}
 ok(reached&&!!(await n1.$('.pad')),'輪到中途加入的人時有鍵盤可以猜');
 /* ---------- 輪到離線的人：房主自動請他到場邊 ---------- */
 const aid=await a.evaluate(()=>me);await r.cs[1].close();
 await h.evaluate(aid=>{if(hbSeen[aid])hbSeen[aid].t=Date.now()-HB_DEAD-5000;},aid);
 for(let i=0;i<4;i++){const gg=await h.evaluate(()=>coopState().guesser);if(gg===aid)break;await turn(h,[h,n1]);}
 await h.waitForFunction(aid=>!isSeated(aid)&&benchOf(aid),aid,{timeout:9000}).catch(()=>{});
 ok(await h.evaluate(aid=>!isSeated(aid)&&benchOf(aid),aid),'輪到離線的人時，房主自動請他到場邊');
 ok(await h.evaluate(aid=>coopState().guesser!==aid,aid),'離線的人到場邊後換下一位猜');
 /* ---------- 換了瀏覽器（名字也不一樣）：加入時可以接回原本的位子 ---------- */
 const c2=await ctx(b,opt);const z=await page(c2,BASE+'#'+r.code);await name(z,'好','#joinBtn');await z.click('#joinBtn');
 await z.waitForSelector('#seatM:not([hidden]) .seatb',{timeout:6000}).catch(()=>{});
 ok(await z.evaluate(()=>/小美/.test(document.getElementById('seatM')?.innerText||'')),'加入時列出離線或在場邊的人，名字不同也問');
 await z.click('#seatM .seatb');await z.waitForSelector('#backIn',{timeout:6000}).catch(()=>{});
 ok(await z.evaluate(aid=>me===aid,aid),'點名字接回原本的身分');
 await z.click('#backIn');await h.waitForFunction(aid=>isSeated(aid)&&coopState().order.includes(aid),aid,{timeout:6000}).catch(()=>{});
 ok(await h.evaluate(aid=>isSeated(aid)&&coopState().order.includes(aid),aid),'接回後按「我回來了」重新排進輪流');
 /* 一般離線（還坐著、在線訊號很久沒動）也能接回；選「新加入」就用新身分 */
 const nid=await n1.evaluate(()=>me);await cn.close();
 await fsq({op:'set',path:'rooms/'+r.code,data:{seats:{[nid]:{hb:Date.now()-300000}}},merge:true});
 const c3=await ctx(b,opt);const y=await page(c3,BASE+'#'+r.code);await name(y,'阿華','#joinBtn');await y.click('#joinBtn');
 await y.waitForSelector('#seatM:not([hidden]) .seatb',{timeout:6000}).catch(()=>{});
 ok(await y.evaluate(()=>/路人/.test(document.getElementById('seatM')?.innerText||'')&&/離線/.test(document.getElementById('seatM')?.innerText||'')),'列出還坐著但離線的人');
 await y.click('#seatM [data-x="new"]');await y.waitForFunction(()=>isSeated(me),null,{timeout:6000}).catch(()=>{});
 ok(await y.evaluate(nid=>isSeated(me)&&me!==nid&&nameOf(me)==='阿華',nid),'選「我是新加入的」用自己的名字加入');
 const c4=await ctx(b,opt);const y2=await page(c4,BASE+'#'+r.code);await name(y2,'阿德','#joinBtn');await y2.click('#joinBtn');
 await y2.waitForSelector('#seatM:not([hidden])',{timeout:6000}).catch(()=>{});await y2.keyboard.press('Escape');await y2.waitForTimeout(300);
 ok(await y2.evaluate(()=>!code&&!!document.getElementById('joinBtn')),'關掉詢問就不加入，留在加入頁');
 const errs1=[...h.__errs,...z.__errs,...y.__errs,...y2.__errs];ok(!errs1.length,'沒有錯誤 '+errs1.join(' | '));
 for(const c of [r.cs[0],c2,c3,c4])await c.close().catch(()=>{});

 /* ---------- 觀眾：手機的記錄不見也還是觀眾；場邊可以改成觀眾，下一局不會被拉回玩家 ---------- */
 await reset();r=await room(b,3,opt);[h,a]=r.ps;let x=r.ps[2];
 await x.click('#toWatch');await x.waitForSelector('.ghostcard',{timeout:6000});
 await x.evaluate(()=>localStorage.removeItem('ab_watch'));await x.reload();await x.waitForSelector('.ghostcard',{timeout:8000}).catch(()=>{});
 ok(await x.evaluate(()=>isWatcher(me)&&!isSeated(me)),'觀眾重新整理（記錄不見）還是觀眾');
 await x.click('#becomePlayer');await x.waitForSelector('#ready',{timeout:6000});ok(await x.evaluate(()=>isSeated(me)&&!isWatcher(me)),'大廳按「我也要玩」還是能改回玩家');
 await a.click('#ready');await h.waitForTimeout(300);await both(h,'#forceStart');await x.waitForSelector('#backIn',{timeout:8000});
 ok(await x.evaluate(()=>!!document.getElementById('toFan')),'場邊有「只想看，改成觀眾」');
 await both(x,'#toFan');await x.waitForSelector('.ghostcard',{timeout:6000}).catch(()=>{});
 ok(await x.evaluate(()=>isWatcher(me)&&!benchOf(me)&&!!document.querySelector('.ghostcard')),'改成觀眾：有幽靈天使、上帝視角');
 await h.waitForTimeout(300);await both(h,'#again');await h.waitForFunction(()=>g().phase==='lobby',null,{timeout:8000});await x.waitForTimeout(600);
 ok(await x.evaluate(()=>isWatcher(me)&&!isSeated(me)),'回到大廳不會被拉回玩家');
 const errs2=[...h.__errs,...a.__errs,...x.__errs];ok(!errs2.length,'沒有錯誤 '+errs2.join(' | '));
 for(const c of r.cs)await c.close();

 /* ---------- 觀眾派的天使：合作時全隊都看得到；玩家都離線時觀眾看得到說明 ---------- */
 await reset();r=await room(b,3,opt);[h,a,x]=r.ps;await x.click('#toWatch');await x.waitForSelector('.ghostcard',{timeout:6000});
 await coopGo(h,[a]);await turn(h,[h,a]);
 const tgt=await a.evaluate(()=>me);await x.waitForSelector('#angelBtn:not([disabled])',{timeout:6000});await x.click('#angelBtn');await x.click(`[data-angel="${tgt}"]`);
 const sawA=await a.waitForSelector('.angelcard',{timeout:6000}).then(()=>true).catch(()=>false),sawH=await h.waitForSelector('.angelcard',{timeout:6000}).then(()=>true).catch(()=>false);
 ok(sawA&&sawH,'觀眾派天使給一位隊友，全隊都跳出卡片');
 ok(await h.evaluate(()=>/全隊一起看/.test(document.querySelector('.angelcard .lbl')?.textContent||'')),'卡片寫明全隊一起看');
 await turn(h,[h,a]);await h.waitForTimeout(400);ok(await h.evaluate(()=>!document.querySelector('.angelcard')),'全隊再猜一次就一起消失');
 const H=await ids([h,a]);await r.cs[0].close();await r.cs[1].close();
 await x.evaluate(H=>{H.forEach(id=>{if(hbSeen[id])hbSeen[id].t=Date.now()-HB_DEAD-5000;});render();},H);await x.waitForTimeout(300);
 ok(await x.evaluate(()=>/玩家都離線了/.test(document.getElementById('app').innerText)&&!!document.getElementById('leave2')),'玩家都離線時觀眾看到說明和離開按鈕');
 await x.click('#leave2');await x.waitForSelector('#create',{timeout:6000}).catch(()=>{});ok(await x.evaluate(()=>!code),'按離開觀戰回到首頁');
 await r.cs[2].close();

 /* ---------- 舊邀請連結：Firebase 慢，改打的代碼不會被換回舊代碼 ---------- */
 await reset();r=await room(b,1,opt);
 const cs=await ctx(b,opt);const q=await page(cs,BASE);await name(q,'周文');
 await cs.route('https://www.gstatic.com/firebasejs/**',async rt=>{await new Promise(r=>setTimeout(r,3000));const f=rt.request().url().split('/').pop();rt.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'fake',f),'utf8'),headers:{'access-control-allow-origin':'*'}});});
 await q.goto(BASE+'?openExternalBrowser=1&room=OLD9');await q.waitForSelector('#codeIn');
 ok((await q.inputValue('#codeIn'))==='OLD9','邀請連結帶入代碼');ok(!/room=/.test(q.url()),'帶入後網址的代碼清掉');
 await q.fill('#codeIn',r.code);await q.click('#joinBtn',{force:true}).catch(()=>{});
 await q.waitForFunction(()=>!!db,null,{timeout:15000});await q.waitForTimeout(300);
 ok((await q.inputValue('#codeIn'))===r.code,'連上 Firebase 重畫後還是自己打的代碼');
 await q.click('#joinBtn');await q.waitForSelector('#ready',{timeout:8000}).catch(()=>{});ok(await q.evaluate(c=>code===c,r.code),'用新代碼加入成功');
 ok(!q.__errs.length,'沒有錯誤 '+q.__errs.join(' | '));
 await b.close();console.log(fails?'失敗 '+fails:'全部通過');process.exit(fails?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(1);});
