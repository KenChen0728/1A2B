// 假 Firestore：和 index.html 用到的 API 一樣
const call=async q=>{ if(window.__offline) await new Promise(()=>{}); const r=await fetch('/__fs',{method:'POST',body:JSON.stringify(q)});return r.json();};
const clean=o=>JSON.parse(JSON.stringify(o));
let es=null;const lis=new Set();
const hub=()=>{if(es)return;es=new EventSource('/__sse');es.onmessage=e=>{const {path}=JSON.parse(e.data);for(const l of lis)l(path);};};
export const getFirestore=()=>({});
export const doc=(fs,p,...rest)=>{if(p&&p.__col){const id='d'+Math.random().toString(36).slice(2,12);return{__doc:1,path:p.path+'/'+id,id};}return{__doc:1,path:p,id:p.split('/').pop()};};
export const collection=(fs,p)=>({__col:1,path:p});
const snapDoc=(path,x)=>({id:path.split('/').pop(),exists:()=>!!x.exists,data:()=>x.data==null?undefined:x.data,metadata:{}});
export const getDoc=async r=>snapDoc(r.path,await call({op:'get',path:r.path}));
export const setDoc=async(r,d,o)=>{await call({op:'set',path:r.path,data:clean(d),merge:!!(o&&o.merge)});};
export const deleteDoc=async r=>{await call({op:'del',path:r.path});};
export const addDoc=async(c,d)=>{const x=await call({op:'add',path:c.path,data:clean(d)});return{path:x.path,id:x.id};};
export const orderBy=(f,dir)=>({f,dir:dir||'asc'});
export const limit=n=>({n});
export const query=(c,...q)=>({...c,q});
const list=async c=>{const x=await call({op:'list',path:c.path});let D=x.docs;for(const q of c.q||[]){if(q.f){D=D.slice().sort((a,b)=>{const s=(a.data[q.f]>b.data[q.f]?1:a.data[q.f]<b.data[q.f]?-1:0);return q.dir==='desc'?-s:s;});}if(q.n)D=D.slice(0,q.n);}
  const docs=D.map(d=>snapDoc(d.path,{exists:true,data:d.data}));return{docs,size:docs.length,empty:!docs.length};};
export const getDocs=list;
export const onSnapshot=(t,fn,err)=>{hub();let on=true;
  const pull=async()=>{if(!on)return;try{fn(t.__doc?await getDoc(t):await list(t));}catch(e){err&&err(e);}};
  const l=p=>{if(window.__offline)return;if(t.__doc?p===t.path:p.startsWith(t.path+'/'))pull();};lis.add(l);pull();return()=>{on=false;lis.delete(l);};};
