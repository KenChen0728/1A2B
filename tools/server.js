// 本機測試伺服器：放遊戲檔案 + 假 Firestore（記憶體，支援 merge 與即時推播）
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.env.ROOT||path.resolve(__dirname,'..'), PORT=+process.env.PORT||8123;
const docs=new Map(); // path -> data
const subs=new Set();
let auto=0;
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
function deep(a,b){const o=isObj(a)?{...a}:{};for(const k in b){o[k]=isObj(b[k])?deep(o[k],b[k]):b[k];}return o;}
function notify(p){const m='data: '+JSON.stringify({path:p})+'\n\n';for(const r of subs)r.write(m);}
const types={'.js':'text/javascript','.html':'text/html; charset=utf-8','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.json':'application/json'};
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/__sse'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.write(':ok\n\n');subs.add(res);req.on('close',()=>subs.delete(res));return;}
  if(u.pathname==='/__reset'){docs.clear();res.end('ok');return;}
  if(u.pathname==='/__dump'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify([...docs]));return;}
  if(u.pathname==='/__fs'){let b='';req.on('data',d=>b+=d);req.on('end',()=>{
    const q=JSON.parse(b||'{}');let out=null;
    if(q.op==='get')out={exists:docs.has(q.path),data:docs.get(q.path)||null};
    else if(q.op==='set'){docs.set(q.path,q.merge?deep(docs.get(q.path)||{},q.data):q.data);notify(q.path);out={ok:1};}
    else if(q.op==='del'){docs.delete(q.path);notify(q.path);out={ok:1};}
    else if(q.op==='add'){const id='auto'+(++auto);const p=q.path+'/'+id;docs.set(p,q.data);notify(p);out={path:p,id};}
    else if(q.op==='list'){const pre=q.path+'/';out={docs:[...docs].filter(([k])=>k.startsWith(pre)&&!k.slice(pre.length).includes('/')).map(([k,v])=>({path:k,id:k.slice(pre.length),data:v}))};}
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(out));});return;}
  let p=u.pathname.replace(/^\/1A2B\/?/,'/'); if(p==='/')p='/index.html';
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end('nf');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);
}).listen(PORT,()=>console.log('up',PORT));
