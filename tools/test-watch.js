// 大廳改觀戰：不用離開再進來；房主改觀戰交給下一位；重新整理還是觀眾；可以再改回玩家
const {chromium,reset,room,shot,layout}=require('./lib');
let fails=0;const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();
 await reset();let r=await room(b,3,{vp:{width:402,height:776}});let [h,a,x]=r.ps;
 ok(!!(await a.$('#toWatch'))&&!!(await a.$('#leave')),'大廳有改觀戰和離開房間');ok((await layout(a)).length===0,'標題列沒有超出');
 await shot(a,'watch-lobby');
 await a.click('#toWatch');await a.waitForSelector('.ghostcard',{timeout:5000});
 ok(await a.evaluate(()=>isWatcher(me)&&!isSeated(me)),'改成觀眾');await h.waitForTimeout(300);
 ok(await h.evaluate(()=>players().length===2&&watchersList().length===1),'房主那邊看到少一位玩家、多一位觀眾');
 await a.reload();await a.waitForSelector('.ghostcard',{timeout:6000});ok(true,'重新整理還是觀眾');
 await a.click('#becomePlayer');await a.waitForSelector('#ready',{timeout:5000});ok(await a.evaluate(()=>isSeated(me)&&!isWatcher(me)),'可以改回玩家');
 await h.click('#toWatch');await h.waitForSelector('.ghostcard',{timeout:5000});await a.waitForTimeout(400);
 ok(await a.evaluate(()=>g().host!==null&&g().host!==undefined&&isSeated(g().host)),'房主改觀戰後房主交給還在的玩家');
 await reset();r=await room(b,1);const [s]=r.ps;await s.click('#toWatch');await s.waitForTimeout(300);
 ok(await s.evaluate(()=>isSeated(me)&&g().host===me),'只剩自己一個時不能改觀戰');
 const errs=[...h.__errs,...a.__errs,...x.__errs,...s.__errs];ok(!errs.length,'沒有錯誤 '+errs.join(' | '));
 await b.close();console.log(fails?'失敗 '+fails:'全部通過');process.exit(fails?1:0);})();
