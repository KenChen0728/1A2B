// 產生所有圖示：node tools/make-icons.js（只用 Node 內建功能）
// 圖案是遊戲名字的四顆像素鍵帽 1 A / 2 B。每個尺寸都用整數倍放大，邊緣才銳利；小圖示另外排版，不是縮圖。
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const OUT=path.resolve(__dirname,'..');
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16),255];
const NAVY=hex('#1d3a6b'),GRID=hex('#2a4a82'),EDGE=hex('#44659f'),DARK=hex('#0f1f3f');
const G={
 '1':['...##..','..###..','.####..','...##..','...##..','...##..','...##..','...##..','.######'],
 'A':['..###..','.##.##.','##...##','##...##','#######','##...##','##...##','##...##','##...##'],
 '2':['.#####.','##...##','.....##','....##.','...##..','..##...','.##....','##.....','#######'],
 'B':['######.','##...##','##...##','##...##','######.','##...##','##...##','##...##','######.']};
// 16px 用的 3×5 小字
const G3={'1':['.#.','##.','.#.','.#.','###'],'A':['.#.','#.#','###','#.#','#.#'],'2':['##.','..#','.#.','#..','###'],'B':['##.','#.#','##.','#.#','##.']};
const KEY={ // 鍵帽：面、亮邊、暗邊、字
 '1':['#f4f6fb','#ffffff','#b9c6dc','#1d3a6b'],
 'A':['#d9503e','#ee7a66','#a53427','#ffffff'],
 '2':['#f4f6fb','#ffffff','#b9c6dc','#1d3a6b'],
 'B':['#f2b544','#fad98f','#b98319','#3a2a06']};
class Pic{constructor(w,h,fill){this.w=w;this.h=h;this.d=new Uint8Array(w*h*4);if(fill)this.rect(0,0,w,h,fill);}
 set(x,y,c){if(x<0||y<0||x>=this.w||y>=this.h)return;this.d.set(c,(y*this.w+x)*4);}
 rect(x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.set(i,j,c);}
 clear(x,y){this.d.fill(0,(y*this.w+x)*4,(y*this.w+x)*4+4);}
 scaled(k){const o=new Pic(this.w*k,this.h*k);for(let y=0;y<this.h;y++)for(let x=0;x<this.w;x++){const p=(y*this.w+x)*4,c=this.d.subarray(p,p+4);for(let j=0;j<k;j++)for(let i=0;i<k;i++)o.d.set(c,((y*k+j)*o.w+x*k+i)*4);}return o;}
 pad(n,c){const o=new Pic(this.w+n*2,this.h+n*2,c);for(let y=0;y<this.h;y++)o.d.set(this.d.subarray(y*this.w*4,(y+1)*this.w*4),((y+n)*o.w+n)*4);return o;}}
function paper(p,step){for(let i=step;i<p.w;i+=step)p.rect(i,0,1,p.h,GRID);for(let j=step;j<p.h;j+=step)p.rect(0,j,p.w,1,GRID);}
function tile(p,x,y,T,ch,s){const [face,hi,lo,ink]=KEY[ch].map(hex);
 p.rect(x+1,y,T-2,T,DARK);p.rect(x,y+1,T,T-2,DARK);        // 外框（切角）
 p.rect(x+2,y+1,T-4,T-2,face);p.rect(x+1,y+2,T-2,T-4,face);// 鍵面
 p.rect(x+2,y+1,T-4,1,hi);p.rect(x+1,y+T-3,T-2,1,lo);p.rect(x+2,y+T-2,T-4,1,lo);if(s>1)p.rect(x+1,y+T-4,T-2,1,lo); // 亮邊、暗邊
 const g=G[ch],w=7*s,h=9*s,ox=x+Math.floor((T-w)/2),oy=y+Math.floor((T-h)/2)-(s>1?1:0);
 g.forEach((r,j)=>{for(let i=0;i<7;i++)if(r[i]==='#')p.rect(ox+i*s,oy+j*s,s,s,ink);});}
function board(C,m,T,gap,step,s){const p=new Pic(C,C,NAVY);paper(p,step);const a=m,b=m+T+gap;tile(p,a,a,T,'1',s);tile(p,b,a,T,'A',s);tile(p,a,b,T,'2',s);tile(p,b,b,T,'B',s);return p;}
// 給電腦、安卓一般圖示用：切成圓角，多一圈亮邊，放在深色桌面也看得清楚
function rounded(p,r){const o=new Pic(p.w,p.h);o.d.set(p.d);const R=r,inC=(x,y)=>{const dx=x<R?R-x-.5:x>=p.w-R?x-(p.w-R)+.5:0,dy=y<R?R-y-.5:y>=p.h-R?y-(p.h-R)+.5:0;return dx*dx+dy*dy<=R*R;};
 for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){if(!inC(x,y)){o.clear(x,y);continue;}if(!inC(x-1,y)||!inC(x+1,y)||!inC(x,y-1)||!inC(x,y+1))o.set(x,y,EDGE);}return o;}
function png(p){const crc=(()=>{const t=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});return b=>{let c=~0;for(const x of b)c=t[(c^x)&255]^(c>>>8);return(~c)>>>0;};})();
 const chunk=(n,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const b=Buffer.concat([Buffer.from(n),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(b));return Buffer.concat([l,b,c]);};
 const ih=Buffer.alloc(13);ih.writeUInt32BE(p.w,0);ih.writeUInt32BE(p.h,4);ih[8]=8;ih[9]=6;
 const raw=Buffer.alloc((p.w*4+1)*p.h);for(let y=0;y<p.h;y++){raw[y*(p.w*4+1)]=0;raw.set(p.d.subarray(y*p.w*4,(y+1)*p.w*4),y*(p.w*4+1)+1);}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
const save=(n,p)=>{fs.writeFileSync(path.join(OUT,n),png(p));console.log(n,p.w+'x'+p.h);};
// 大圖：64 格 × 8 = 512、× 3 = 192
const big=board(64,6,25,2,8,2);
save('icon-512.png',rounded(big.scaled(8),112));
save('icon-192.png',rounded(big.scaled(3),42));
// Apple 180：60 格 × 3，不留透明，圓角交給 iPhone
save('icon-180.png',board(60,6,23,2,8,2).scaled(3));
// maskable：主體要在正中央 80% 的圓裡，安卓裁成圓形也不會切到（96 格 × 5 + 四周 16px）
save('icon-maskable-512.png',board(96,22,25,2,12,2).scaled(5).pad(16,NAVY));
// 小圖示：直接用小格子排
save('favicon-48.png',rounded(board(48,4,19,2,12,1),8));
save('favicon-32.png',rounded(board(32,1,14,2,99,1),5));
{const p=new Pic(16,16,NAVY),put=(x,y,ch)=>{const [f,,,k]=KEY[ch].map(hex);p.rect(x,y,7,7,f);G3[ch].forEach((r,j)=>{for(let i=0;i<3;i++)if(r[i]==='#')p.set(x+2+i,y+1+j,k);});};put(0,0,'1');put(9,0,'A');put(0,9,'2');put(9,9,'B');save('favicon-16.png',p);}
