/* ===== listplant.js (v2): a flower plant that grows over 30 days in the empty space under the chat list =====
   - A small garden scene (sky changes with the time of day, hills, grass, clay pot).
   - Water it once a day. After 30 days of care it blooms. It droops when thirsty and recovers after watering.
   - Saved in Firestore at  users/{uid}/plant/main  (works across phones). A local copy keeps it instant/offline.
   Use this file INSTEAD of listfill.js / listgame.js / listcat.js (same spot).
   Hook (chat.js, after `me` is known):
     import("./listplant.js"+V).then(m=>m.initListPlant(me.uid)).catch(()=>{});                       */
const DAYS=30;                 // care days needed to bloom
const MIN_FREE=190;            // px of free space needed before it is shown
const MAX_H=300;               // never taller than this
const IST=19800000;
const FS="https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const rnd=(a,b)=>a+Math.random()*(b-a);
const hex=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
const mixA=(a,b,t)=>{const A=hex(a),B=hex(b);return A.map((v,i)=>Math.round(lerp(v,B[i],t)))};
const rgb=(a,k=0)=>"rgb("+a.map(v=>clamp(Math.round(k>=0?v+(255-v)*k:v*(1+k)),0,255)).join(",")+")";
const mix=(a,b,t)=>rgb(mixA(a,b,t));

/* ---------- data ---------- */
const pad=n=>String(n).padStart(2,"0");
function istNow(){return new Date(Date.now()+IST)}
function todayStr(){const t=istNow();return t.getUTCFullYear()+"-"+pad(t.getUTCMonth()+1)+"-"+pad(t.getUTCDate())}
const dayNum=s=>{const [y,m,d]=s.split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/864e5)};
let data=null,UID="",LKEY="bt_plant",ref=null,fs=null,synced=false;
const fresh=seed=>({start:todayStr(),cared:[],last:0,seed:seed||0});   // seed 0 = first plant of this account; a restart gets a newer seed
function norm(d){
  if(!d||typeof d.start!=="string"||!Array.isArray(d.cared))return null;
  return {start:d.start,cared:d.cared.filter(x=>typeof x==="string").slice(0,DAYS+5),last:+d.last||0,seed:+d.seed||dayNum(d.start)*864e5};
}
function loadLocal(){
  try{const a=norm(JSON.parse(localStorage.getItem(LKEY)||"null"));if(a)return a}catch(e){}
  try{const a=norm(JSON.parse(localStorage.getItem("bt_plant")||"null"));if(a)return a}catch(e){}   // older version
  return null;
}
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify(data))}catch(e){}}
/* same seed = same plant: join the care days. A newer seed (the plant was restarted) wins. */
function merge(a,b){
  if(!a)return b;if(!b)return a;
  if(a.seed!==b.seed)return a.seed>b.seed?a:b;
  const cared=Array.from(new Set(a.cared.concat(b.cared))).sort().slice(0,DAYS);
  return {start:a.start,cared,last:Math.max(a.last,b.last),seed:a.seed};
}
function push(){
  saveLocal();
  if(ref&&fs)fs.setDoc(ref,data).catch(()=>{});
}
const careDays=()=>Math.min(DAYS,data.cared.length);
const calDay=()=>Math.max(1,dayNum(todayStr())-dayNum(data.start)+1);
const wateredToday=()=>data.cared.includes(todayStr());
/* 1 = fresh soil, 0 = bone dry. Falls to 0 about 40 hours after the last watering. */
const moisture=()=>data.last?clamp(1-(Date.now()-data.last)/(40*36e5),0,1):.55;

function stageOf(c){
  if(c>=DAYS)return "In full bloom";
  if(c>=27)return "Almost blooming";
  if(c>=23)return "Budding";
  if(c>=18)return "Leafy plant";
  if(c>=13)return "Growing";
  if(c>=8)return "Young plant";
  if(c>=4)return "Sprout";
  return "Seedling";
}

/* ---------- ui ---------- */
function css(){
  if($("lpcss"))return;
  const s=E("style");s.id="lpcss";
  s.textContent=
"#lplant{position:absolute;left:0;right:0;z-index:0;box-sizing:border-box;padding:10px 12px 12px}"+
"#lplant.hide{display:none}"+
"#lplant .card{position:relative;height:100%;border-radius:22px;overflow:hidden;background:#1b2a33;box-shadow:0 6px 18px rgba(0,0,0,.28),0 0 0 1px rgba(255,255,255,.06) inset;-webkit-tap-highlight-color:transparent}"+
"#lplant canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:manipulation}"+
"#lplant .chip{position:absolute;left:10px;top:10px;max-width:40%;padding:7px 12px 8px;border-radius:14px;background:rgba(14,22,28,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;font:12.5px/1.3 system-ui,sans-serif;pointer-events:none;box-shadow:0 0 0 1px rgba(255,255,255,.08) inset}"+
"#lplant .chip b{display:block;font-size:17px;font-weight:700;letter-spacing:.01em}"+
"#lplant .chip span{display:block;margin-top:1px;color:rgba(255,255,255,.82);transition:opacity .2s}"+
"#lplant .prog{position:absolute;left:12px;bottom:14px;width:30%;max-width:126px;pointer-events:none;color:#fff;font:600 11.5px system-ui,sans-serif;text-shadow:0 1px 3px rgba(0,0,0,.55)}"+
"#lplant .prog .bar{height:7px;margin-top:5px;border-radius:4px;background:rgba(0,0,0,.35);overflow:hidden}"+
"#lplant .prog .bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#7ad26b,#ff8fb3);transition:width .8s}"+
"#lplant .pw{position:absolute;right:14px;bottom:12px;width:56px;height:56px;border:0;padding:0;border-radius:50%;cursor:pointer;background:conic-gradient(#58c4ff calc(var(--m,0)*1%),rgba(0,0,0,.35) 0);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent;transition:transform .12s}"+
"#lplant .pw:active{transform:scale(.94)}"+
"#lplant .pw i{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#35b6ff,#1f86d9);color:#fff}"+
"#lplant .pw.done i{background:linear-gradient(160deg,#4cc46a,#2c9a4c)}"+
"#lplant .pw.seed i{background:linear-gradient(160deg,#ff8fb3,#e0558a)}"+
"#lplant .pw.ask i{animation:lpask 1.6s ease-in-out infinite}"+
"#lplant .pw svg{width:24px;height:24px}"+
"@keyframes lpask{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}";
  document.head.appendChild(s);
}
const IC={
  drop:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6c3.6 4.2 6.4 7.4 6.4 11a6.4 6.4 0 0 1-12.8 0c0-3.6 2.8-6.8 6.4-11z"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  seed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20v-8"/><path d="M12 12c0-4 2.5-6 6-6 0 4-2.4 6-6 6z"/><path d="M12 14.5c0-3-2-4.5-5-4.5 0 3 1.9 4.5 5 4.5z"/></svg>'
};

let box=null,card=null,cv=null,ctx=null,W=0,H=0,S=1,dpr=1,raf=0,last=0,T=0;
let els={};
let shownC=0,shownM=1,wAnim=0,drops=[],petals=[],sparks=[],fly={t:0},sayT=0,resetT=0,stars=[],clouds=[];

function say(t){els.sub.textContent=t;clearTimeout(sayT);sayT=setTimeout(refreshText,2800)}

function refreshText(){
  if(!data||!els.day)return;
  const c=careDays(),m=moisture(),wt=wateredToday();
  els.day.textContent="Day "+Math.min(DAYS,calDay());
  els.sub.textContent=c>=DAYS?stageOf(c):(wt?stageOf(c):(m<.3?"Thirsty":"Needs water"));
  els.pc.textContent=c+" / "+DAYS+" days";
  els.bar.style.width=Math.round(c/DAYS*100)+"%";
  let ic=IC.drop,cls="pw",label="Water the plant";
  if(c>=DAYS){ic=IC.seed;cls+=" seed";label="Plant a new seed"}
  else if(wt){ic=IC.check;cls+=" done";label="Watered today"}
  else cls+=" ask";
  if(els.btn.className!==cls){els.btn.className=cls;els.ic.innerHTML=ic}
  els.btn.setAttribute("aria-label",label);
  els.btn.style.setProperty("--m",Math.round(c>=DAYS?100:m*100));
}

function water(){
  const c=careDays();
  if(c>=DAYS){say("Your flower is in full bloom.");fly.t=0;return}
  if(wateredToday()){say("Still moist. Once a day is enough.");return}
  data.cared.push(todayStr());data.last=Date.now();push();
  wAnim=.0001;
  if(careDays()>=DAYS)setTimeout(()=>{for(let i=0;i<30;i++)sparks.push({x:px(),y:H*.35+rnd(-30,30)*S,vx:rnd(-70,70)*S,vy:rnd(-100,-20)*S,l:rnd(.8,1.6)});say("It bloomed. Day "+DAYS+" done.");refreshText()},2300);
  else say(careDays()<=1?"Thank you. Growing already.":"Nice. A little taller today.");
  refreshText();kick();
}
function onBtn(){
  if(careDays()>=DAYS){
    if(resetT){clearTimeout(resetT);resetT=0;data=fresh(Date.now());push();shownC=0;shownM=1;petals=[];refreshText();say("A new seed is planted.");return}
    els.sub.textContent="Tap again to confirm";resetT=setTimeout(()=>{resetT=0;refreshText()},3200);return;
  }
  water();
}

/* ---------- scene ---------- */
const px=()=>W*.55;
const groundY=()=>H-42*S;
const soilY=()=>H-52*S;
const hMax=()=>Math.min(soilY()-44*S,160*S);
function phase(){
  const t=istNow(),h=t.getUTCHours()+t.getUTCMinutes()/60;
  if(h>=6&&h<9)return {k:"dawn",sky:["#7fb7ee","#ffd9b5"],hill:["#7fbf7a","#5fa466"],grass:["#58a85e","#3f8a4a"],sun:.15,glow:"#ffe2a8"};
  if(h>=9&&h<17)return {k:"day",sky:["#5fb6f5","#d9f1ff"],hill:["#8ccf86","#69b673"],grass:["#5cb264","#439550"],sun:.45,glow:"#fff6c2"};
  if(h>=17&&h<19.5)return {k:"dusk",sky:["#6b6fc0","#ffb98a"],hill:["#6ea56f","#4f8559"],grass:["#4d9456","#37763f"],sun:.82,glow:"#ffd29a"};
  return {k:"night",sky:["#0f1a3d","#2a3f73"],hill:["#2d5a4a","#22463a"],grass:["#2a5f46","#1d4633"],sun:0,glow:"#cfe0ff"};
}
function drawScene(dt){
  const P=phase();
  let g=ctx.createLinearGradient(0,0,0,groundY());g.addColorStop(0,P.sky[0]);g.addColorStop(1,P.sky[1]);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // sun or moon
  const sx=W-38*S,sy=34*S;
  if(P.k==="night"){
    stars.forEach(s=>{ctx.globalAlpha=.45+.45*Math.sin(T*1.4+s.p);ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(s.x*W,s.y*H*.5,s.r*S,0,6.28);ctx.fill()});ctx.globalAlpha=1;
    ctx.fillStyle="#f4f1de";ctx.beginPath();ctx.arc(sx,sy,13*S,0,6.28);ctx.fill();
    ctx.fillStyle="#2a3f73";ctx.beginPath();ctx.arc(sx+6*S,sy-3*S,11*S,0,6.28);ctx.fill();
  }else{
    const sy2=sy+(P.sun>.6?18*S:0);
    const rg=ctx.createRadialGradient(sx,sy2,2,sx,sy2,46*S);rg.addColorStop(0,P.glow);rg.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=rg;ctx.fillRect(sx-50*S,sy2-50*S,100*S,100*S);
    ctx.fillStyle=P.k==="dusk"?"#ffb36b":"#fff3b0";ctx.beginPath();ctx.arc(sx,sy2,12*S,0,6.28);ctx.fill();
  }
  // clouds
  const cc=P.k==="night"?"rgba(150,170,220,.25)":P.k==="dusk"?"rgba(255,225,205,.7)":"rgba(255,255,255,.85)";
  clouds.forEach(c=>{
    if(!RM)c.x+=c.v*dt/W;if(c.x>1.25)c.x=-.25;
    const x=c.x*W,y=c.y*H;ctx.fillStyle=cc;
    const el=(ex,ey,rx,ry)=>{ctx.moveTo(ex+rx,ey);ctx.ellipse(ex,ey,rx,ry,0,0,6.28)};
    ctx.beginPath();el(x,y,22*S*c.s,7*S*c.s);el(x-12*S*c.s,y+2*S,14*S*c.s,6*S*c.s);el(x+14*S*c.s,y+2*S,15*S*c.s,6*S*c.s);el(x+2*S,y-6*S*c.s,11*S*c.s,7*S*c.s);ctx.fill();
  });
  // hills
  ctx.fillStyle=P.hill[0];ctx.beginPath();ctx.moveTo(0,groundY());
  for(let x=0;x<=W;x+=8)ctx.lineTo(x,groundY()-30*S-Math.sin(x/W*3.1+.6)*14*S-Math.sin(x/W*7)*4*S);
  ctx.lineTo(W,groundY());ctx.fill();
  ctx.fillStyle=P.hill[1];ctx.beginPath();ctx.moveTo(0,groundY());
  for(let x=0;x<=W;x+=8)ctx.lineTo(x,groundY()-12*S-Math.sin(x/W*4.4+2)*9*S);
  ctx.lineTo(W,groundY());ctx.fill();
  // grass
  g=ctx.createLinearGradient(0,groundY(),0,H);g.addColorStop(0,P.grass[0]);g.addColorStop(1,P.grass[1]);
  ctx.fillStyle=g;ctx.fillRect(0,groundY(),W,H-groundY());
  ctx.strokeStyle="rgba(255,255,255,.1)";ctx.lineWidth=1.3*S;ctx.lineCap="round";
  for(let i=0;i<34;i++){const x=(i*37.7%W),y=groundY()+6*S+((i*53)%(H-groundY()-10*S));ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1.5*S,y-5*S);ctx.stroke()}
  // night tint
  if(P.k==="night"){ctx.fillStyle="rgba(8,14,40,.18)";ctx.fillRect(0,0,W,H)}
}

function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawPot(wet){
  const x=px(),y=soilY(),b=H-10*S;
  ctx.fillStyle="rgba(0,0,0,.22)";ctx.beginPath();ctx.ellipse(x,b+1*S,46*S,5*S,0,0,6.28);ctx.fill();
  const g=ctx.createLinearGradient(x-36*S,0,x+36*S,0);g.addColorStop(0,"#b8603f");g.addColorStop(.45,"#d9835d");g.addColorStop(1,"#a2512f");
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-33*S,y);ctx.lineTo(x+33*S,y);ctx.lineTo(x+24*S,b);ctx.lineTo(x-24*S,b);ctx.closePath();ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.14)";ctx.beginPath();ctx.moveTo(x-28*S,y+6*S);ctx.lineTo(x-20*S,y+6*S);ctx.lineTo(x-15*S,b-4*S);ctx.lineTo(x-20*S,b-4*S);ctx.fill();
  ctx.fillStyle="rgba(120,40,20,.25)";ctx.fillRect(x-31*S,y+13*S,62*S,3*S);   // band
  // soil
  ctx.fillStyle=mix("#a67c52","#4a3224",wet);ctx.beginPath();ctx.ellipse(x,y,35*S,7*S,0,0,6.28);ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.2)";for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(x-26*S+i*8.5*S,y+(i%2?2:-1)*S,1.2*S,0,6.28);ctx.fill()}
  // rim
  const rg=ctx.createLinearGradient(x-38*S,0,x+38*S,0);rg.addColorStop(0,"#c26b48");rg.addColorStop(.5,"#e69669");rg.addColorStop(1,"#b05a38");
  ctx.fillStyle=rg;rr(x-38*S,y-4*S,76*S,10*S,4.5*S);ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.2)";rr(x-35*S,y-3*S,70*S,2.4*S,2*S);ctx.fill();
}
function leaf(x,y,ang,L,col,k){
  const w=L*.4;
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  const g=ctx.createLinearGradient(0,0,L,0);g.addColorStop(0,rgb(col,-.16));g.addColorStop(1,rgb(col,.1+(k||0)));
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(L*.45,-w*1.15,L,0);ctx.quadraticCurveTo(L*.45,w*.85,0,0);ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.32)";ctx.lineWidth=Math.max(.7,L*.035);ctx.beginPath();ctx.moveTo(L*.04,0);ctx.lineTo(L*.88,0);ctx.stroke();
  ctx.restore();
}
function plantPose(c,m,sway){
  const bx=px(),by=soilY(),hm=hMax();
  const h=lerp(14*S,hm,Math.pow(clamp(c/24,0,1),.85));
  const tipX=bx+4*S+sway*(h/hm)*2.2*S+m*30*S*(h/hm+.15);
  const tipY=by-h*(1-.14*m);
  const cx=bx-6*S+m*8*S,cy=by-h*.55;
  const P=t=>{const u=1-t;return {x:u*u*bx+2*u*t*cx+t*t*tipX,y:u*u*by+2*u*t*cy+t*t*tipY}};
  return {bx,by,h,hm,tipX,tipY,cx,cy,P};
}
function flower(x,y,f){
  const R=27*S*(.3+.7*f),n=11;
  ctx.fillStyle="#3f9a4a";for(let i=0;i<5;i++){ctx.save();ctx.translate(x,y);ctx.rotate(i*1.2566+Math.PI/2);ctx.beginPath();ctx.ellipse(0,R*.35,R*.12,R*.3,0,0,6.28);ctx.fill();ctx.restore()}
  const rot=RM?0:Math.sin(T*.3)*.06;
  [[1,0],[.8,Math.PI/n]].forEach(([k,off],layer)=>{
    for(let i=0;i<n;i++){
      ctx.save();ctx.translate(x,y);ctx.rotate(i*(6.2832/n)+off+rot);
      const len=R*k,wid=R*.27*k*(.55+.45*f);
      const g=ctx.createLinearGradient(0,0,0,-len);g.addColorStop(0,layer?"#ffd2e2":"#fff0f5");g.addColorStop(.5,layer?"#ffa3c3":"#ffc0d5");g.addColorStop(1,layer?"#ff74a2":"#ff86ae");
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-R*.1);ctx.bezierCurveTo(wid*1.3,-len*.35,wid*1.1,-len*.85,0,-len);ctx.bezierCurveTo(-wid*1.1,-len*.85,-wid*1.3,-len*.35,0,-R*.1);ctx.fill();
      ctx.strokeStyle="rgba(190,60,110,.26)";ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,-R*.15);ctx.lineTo(0,-len*.8);ctx.stroke();
      ctx.restore();
    }
  });
  const cr=R*.27*(.6+.4*f);
  const cg=ctx.createRadialGradient(x-cr*.3,y-cr*.3,1,x,y,cr);cg.addColorStop(0,"#ffe27a");cg.addColorStop(1,"#e9a416");
  ctx.fillStyle=cg;ctx.beginPath();ctx.arc(x,y,cr,0,6.28);ctx.fill();
  ctx.fillStyle="#c97d0c";for(let i=0;i<9;i++){const a=i*.7,d=cr*.55*(i%3?1:.4);ctx.beginPath();ctx.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,cr*.13,0,6.28);ctx.fill()}
}
function drawPlant(){
  const c=shownC,m=clamp((.45-shownM)/.45,0,1),sway=RM?0:Math.sin(T*1.25)+Math.sin(T*.7)*.5;
  const p=plantPose(c,m,sway);
  const yel=clamp(m*.85+(data.last&&Date.now()-data.last>60*36e5?.25:0),0,1);
  const stem=mixA("#3f9a4a","#9aa34a",yel),stemW=(2.6+3.6*clamp(c/20,0,1))*S;
  [[-1,56,12],[1,84,15]].forEach(([dir,nh,c0])=>{
    const g=clamp((c-c0)/9,0,1);if(g<=0||nh*S>p.h-8*S)return;
    const t=clamp(nh*S/p.h,0,1),o=p.P(t);
    const ang=dir*(.95+m*.5),len=34*S*ease(g);
    const ex=o.x+Math.sin(ang)*len,ey=o.y-Math.cos(ang)*len*(1-.5*m);
    ctx.strokeStyle=rgb(stem);ctx.lineWidth=stemW*.55;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.quadraticCurveTo((o.x+ex)/2,o.y-6*S,ex,ey);ctx.stroke();
    const lc=mixA("#49a652","#b3b24f",yel*.9);
    leaf(ex,ey,-Math.PI/2+dir*.9+m*dir*.9,14*S*ease(g),lc);
    leaf(ex,ey,-Math.PI/2+dir*.3+m*dir*.8,12*S*ease(g),lc);
  });
  ctx.strokeStyle=rgb(stem);ctx.lineWidth=stemW;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(p.bx,p.by);ctx.quadraticCurveTo(p.cx,p.cy,p.tipX,p.tipY);ctx.stroke();
  ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=stemW*.3;ctx.beginPath();ctx.moveTo(p.bx-stemW*.2,p.by);ctx.quadraticCurveTo(p.cx-stemW*.2,p.cy,p.tipX-stemW*.2,p.tipY);ctx.stroke();
  const K=7;
  for(let k=0;k<K;k++){
    const born=1.5+k*3.4,a=clamp((c-born)/6,0,1);if(a<=0)continue;
    const nh=(18+k*19)*S;if(nh>p.h-5*S)continue;
    const o=p.P(clamp(nh/p.h,0,1)),L=(14+14*(1-k/K*.45))*S*ease(a)*(.8+.2*clamp(c/20,0,1));
    const lc=mixA(k%2?"#49a652":"#3f9a4a","#b3b24f",yel*.9);
    const base=(1.05-k*.045)+m*.55,w=RM?0:Math.sin(T*1.7+k)*.045;
    leaf(o.x,o.y,-Math.PI/2+base+w,L,lc);
    leaf(o.x,o.y,-Math.PI/2-base-w,L,lc);
  }
  if(c<10){
    const a=1-clamp((c-5)/5,0,1),L=11*S*a;
    if(a>0){ctx.fillStyle=mix("#6cc070","#c1c56a",yel);
      [-1,1].forEach(d=>{ctx.beginPath();ctx.ellipse(p.P(.5).x+d*8*S*(1+m*.3),p.P(.5).y+m*4*S,L*.8,L*.45,d*(.3+m*.6),0,6.28);ctx.fill()})}
  }
  if(c<20){
    const L=(6+Math.min(c,18)*.55)*S,lc=mixA("#6cc070","#c1c56a",yel);
    leaf(p.tipX,p.tipY,-Math.PI/2+.45+m*.9,L,lc);
    leaf(p.tipX,p.tipY,-Math.PI/2-.45-m*.9,L,lc);
  }
  if(c>=19){
    const b=clamp((c-19)/8,0,1),f=clamp((c-27)/3,0,1);
    if(f<=0){
      const bs=lerp(3,12,b)*S,pink=clamp((c-23)/4,0,1);
      ctx.fillStyle=mix("#4aa356","#ff8fb3",pink*.8);ctx.beginPath();ctx.ellipse(p.tipX,p.tipY-bs*.9,bs*.7,bs*1.15,0,0,6.28);ctx.fill();
      ctx.fillStyle="#3f9a4a";ctx.beginPath();ctx.moveTo(p.tipX-bs*.8,p.tipY-bs*.5);ctx.quadraticCurveTo(p.tipX,p.tipY+bs*.2,p.tipX+bs*.8,p.tipY-bs*.5);ctx.quadraticCurveTo(p.tipX,p.tipY-bs*.9,p.tipX-bs*.8,p.tipY-bs*.5);ctx.fill();
    }else flower(p.tipX,p.tipY-8*S*f,f);
  }
  return p;
}
function drawThirst(p){
  if(wateredToday()||careDays()>=DAYS||shownM>.3)return;
  const k=1+(RM?0:Math.sin(T*3)*.08),x=p.tipX+34*S,y=Math.max(30*S,p.tipY-26*S);
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  ctx.fillStyle="rgba(255,255,255,.94)";ctx.beginPath();ctx.arc(0,0,14*S,0,6.28);ctx.fill();
  ctx.beginPath();ctx.moveTo(-9*S,10*S);ctx.lineTo(-15*S,17*S);ctx.lineTo(-3*S,13*S);ctx.fill();
  ctx.fillStyle="#2f9be6";ctx.beginPath();ctx.moveTo(0,-8*S);ctx.bezierCurveTo(6*S,-1*S,7*S,2*S,7*S,3.5*S);ctx.arc(0,3.5*S,7*S,0,Math.PI);ctx.bezierCurveTo(-7*S,2*S,-6*S,-1*S,0,-8*S);ctx.fill();
  ctx.restore();
}
function drawCan(p){
  if(wAnim<=0)return;
  const t=wAnim,tilt=ease(Math.min(1,t/.5))*(t>1.7?clamp(1-(t-1.7)/.4,0,1):1);
  const x=p.bx+62*S,y=clamp(p.tipY-46*S,40*S,soilY()-72*S);
  ctx.save();ctx.translate(x,y);ctx.rotate(-.55*tilt);ctx.globalAlpha=clamp(Math.min(t/.25,(2.1-t)/.3),0,1);
  const g=ctx.createLinearGradient(0,-14*S,0,14*S);g.addColorStop(0,"#8cc0ee");g.addColorStop(1,"#5b93c4");
  ctx.fillStyle=g;rr(-4*S,-14*S,34*S,28*S,6*S);ctx.fill();
  ctx.strokeStyle="#6fa8d8";ctx.lineWidth=4.5*S;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-3*S,6*S);ctx.lineTo(-24*S,-6*S);ctx.stroke();
  ctx.fillStyle="#4f86b8";ctx.beginPath();ctx.ellipse(-26*S,-7*S,5*S,3*S,-.5,0,6.28);ctx.fill();
  ctx.strokeStyle="#5b93c4";ctx.lineWidth=3.2*S;ctx.beginPath();ctx.arc(30*S,0,10*S,-1.4,1.4);ctx.stroke();
  ctx.restore();ctx.globalAlpha=1;
  if(t>.35&&t<1.9){
    const ax=Math.cos(-.55*tilt),ay=Math.sin(-.55*tilt);
    const sx=x+(-26*S)*ax-(-7*S)*ay,sy=y+(-26*S)*ay+(-7*S)*ax;
    for(let i=0;i<2;i++)if(Math.random()<.8)drops.push({x:sx+rnd(-3,3)*S,y:sy,vx:rnd(-30,-6)*S,vy:rnd(20,60)*S});
  }
}
function frame(now){
  raf=0;
  if(!box||box.classList.contains("hide")||document.hidden){last=0;return}
  const dt=last?Math.min(.05,(now-last)/1000):0;last=now;T+=dt;
  const wet=moisture();
  if(wAnim>0){wAnim+=dt;if(wAnim>2.2)wAnim=0}
  const target=careDays();
  if(wAnim===0||wAnim>1.4)shownC+=(target-shownC)*Math.min(1,dt*1.1);
  if(Math.abs(target-shownC)<.002)shownC=target;
  const wetTarget=wAnim>.9||wAnim===0?wet:shownM;
  shownM+=(wetTarget-shownM)*Math.min(1,dt*1.6);
  ctx.clearRect(0,0,W,H);
  drawScene(dt);
  drawPot(shownM);
  const p=drawPlant();
  drawThirst(p);
  drawCan(p);
  drops.forEach(d=>{d.vy+=520*S*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;if(d.y>=soilY()){d.dead=1;for(let i=0;i<2;i++)sparks.push({x:d.x,y:soilY(),vx:rnd(-30,30)*S,vy:rnd(-50,-15)*S,l:.4,w:1})}});
  drops=drops.filter(d=>!d.dead&&d.y<H);
  ctx.fillStyle="#8ccbff";drops.forEach(d=>{ctx.beginPath();ctx.ellipse(d.x,d.y,1.6*S,2.6*S,0,0,6.28);ctx.fill()});
  sparks.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=(s.w?260:60)*S*dt;s.l-=dt});
  sparks=sparks.filter(s=>s.l>0);
  sparks.forEach(s=>{ctx.globalAlpha=clamp(s.l*1.5,0,1);ctx.fillStyle=s.w?"#8ccbff":"#ffe38a";ctx.beginPath();ctx.arc(s.x,s.y,(s.w?1.4:2)*S,0,6.28);ctx.fill()});ctx.globalAlpha=1;
  if(careDays()>=DAYS&&shownC>=DAYS-.05){
    fly.t+=dt;
    const cx=p.tipX+Math.cos(fly.t*.8)*58*S,cy=p.tipY-14*S+Math.sin(fly.t*1.6)*22*S,fl=Math.sin(fly.t*18);
    ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.cos(fly.t*.8)*-.4);
    ctx.fillStyle="#ffb347";ctx.beginPath();ctx.ellipse(-4*S,-1*S,5.5*S,Math.max(1,6*S*Math.abs(fl)),-.5,0,6.28);ctx.fill();
    ctx.beginPath();ctx.ellipse(4*S,-1*S,5.5*S,Math.max(1,6*S*Math.abs(fl)),.5,0,6.28);ctx.fill();
    ctx.fillStyle="#3b2a3a";ctx.fillRect(-.9*S,-5*S,1.8*S,10*S);
    ctx.restore();
    if(Math.random()<.02)petals.push({x:p.tipX+rnd(-16,16)*S,y:p.tipY,vx:rnd(-8,8)*S,vy:rnd(14,26)*S,r:rnd(0,6)});
  }
  petals.forEach(q=>{q.x+=q.vx*dt+Math.sin(T*2+q.r)*.4*S;q.y+=q.vy*dt;q.r+=dt});
  petals=petals.filter(q=>q.y<soilY()+4*S);
  ctx.fillStyle="#ffb3cf";petals.forEach(q=>{ctx.beginPath();ctx.ellipse(q.x,q.y,3.2*S,1.8*S,q.r,0,6.28);ctx.fill()});
  raf=requestAnimationFrame(frame);
}
const kick=()=>{if(!raf)raf=requestAnimationFrame(frame)};

/* ---------- placement ---------- */
function place(){
  if(!box)return;
  const side=$("side"),list=$("list"),res=$("res");
  const searching=res&&!res.classList.contains("hide");
  const sr=side?side.getBoundingClientRect():null;
  if(!sr||!list||sr.height<50||searching){box.classList.add("hide");return}
  let top=list.getBoundingClientRect().top;
  const k=list.children;
  if(k.length)top=Math.max(top,k[k.length-1].getBoundingClientRect().bottom);
  const free=Math.floor(sr.bottom-top);
  if(free<MIN_FREE){box.classList.add("hide");return}
  const h=Math.min(MAX_H,free),was=box.classList.contains("hide");
  box.classList.remove("hide");
  box.style.top=Math.max(0,top-sr.top)+"px";box.style.height=h+"px";
  const r=card.getBoundingClientRect();
  if(was||Math.abs(r.width-W)>1||Math.abs(r.height-H)>1){
    dpr=Math.min(2,devicePixelRatio||1);W=Math.round(r.width);H=Math.round(r.height);
    cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);S=clamp(H/245,.7,1.3);
  }
  if(was)refreshText();
  kick();
}
let pend=0;const soon=()=>{if(!pend)pend=requestAnimationFrame(()=>{pend=0;place()})};

/* ---------- cloud sync ---------- */
function applyRemote(d){
  const merged=merge(data,d);
  const changed=JSON.stringify(merged)!==JSON.stringify(data);
  data=merged;saveLocal();
  if(changed){if(careDays()<shownC)shownC=careDays();refreshText();kick()}
  return JSON.stringify(merged)!==JSON.stringify(d);   // true = cloud copy is behind
}
async function startSync(){
  if(!UID)return;
  try{
    const V=window.V||"";
    const {db}=await import("./firebase.js"+V);
    fs=await import(FS);
    ref=fs.doc(db,"users",UID,"plant","main");
    fs.onSnapshot(ref,snap=>{
      if(snap.metadata.hasPendingWrites)return;
      if(snap.exists()){
        const behind=applyRemote(norm(snap.data()));
        if(behind)fs.setDoc(ref,data).catch(()=>{});
        synced=true;
      }else if(!snap.metadata.fromCache){
        if(!data)data=fresh();
        fs.setDoc(ref,data).catch(()=>{});synced=true;refreshText();kick();
      }
    },()=>{/* no access or offline: the local copy keeps working */});
  }catch(e){}
}

export async function initListPlant(uid){
  for(let i=0;i<50&&!($("side")&&$("list"));i++)await new Promise(r=>setTimeout(r,100));
  const side=$("side"),list=$("list");
  if(!side||!list||$("lplant"))return;
  UID=uid||"";LKEY="bt_plant_"+(UID||"x");
  css();
  data=loadLocal()||fresh();saveLocal();
  shownC=careDays();shownM=moisture();
  for(let i=0;i<40;i++)stars.push({x:Math.random(),y:Math.random(),r:rnd(.6,1.5),p:rnd(0,6)});
  for(let i=0;i<3;i++)clouds.push({x:Math.random(),y:rnd(.1,.3),s:rnd(.8,1.3),v:rnd(5,10)});
  if(getComputedStyle(side).position==="static")side.style.position="relative";
  box=E("div");box.id="lplant";box.className="hide";box.setAttribute("aria-label","Flower plant");
  card=E("div","card");cv=E("canvas");cv.setAttribute("aria-hidden","true");ctx=cv.getContext("2d");
  const chip=E("div","chip");els.day=E("b");els.sub=E("span");chip.append(els.day,els.sub);
  const pr=E("div","prog");els.pc=E("div");const bar=E("div","bar");els.bar=E("i");bar.appendChild(els.bar);pr.append(els.pc,bar);
  els.btn=E("button","pw");els.btn.type="button";els.ic=E("i");els.btn.appendChild(els.ic);
  card.append(cv,chip,pr,els.btn);box.appendChild(card);side.appendChild(box);
  cv.addEventListener("pointerdown",e=>{e.preventDefault();if(!wateredToday()&&careDays()<DAYS)water();else say(careDays()>=DAYS?"Your flower is in full bloom.":"Still moist. Once a day is enough.")});
  els.btn.addEventListener("click",e=>{e.stopPropagation();onBtn()});
  new MutationObserver(soon).observe(list,{childList:true,subtree:true});
  const res=$("res");if(res)new MutationObserver(soon).observe(res,{attributes:true,attributeFilter:["class"]});
  if(window.ResizeObserver)new ResizeObserver(soon).observe(side);
  addEventListener("resize",soon);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){refreshText();soon();kick()}});
  setInterval(()=>{refreshText();soon()},60000);
  place();startSync();
  window.__plant={get:()=>data,set:d=>{data=d;saveLocal();refreshText()},water,show:c=>{shownC=c},get c(){return shownC}};
}
