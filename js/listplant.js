/* ===== listplant.js (v5): a flower plant that grows over 30 days in the empty space under the chat list =====
   - A glowing night garden: teal flowers, fireflies, grass and plant all sway in the wind.
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
/* Each finished plant stays in the garden for life; the next plant is a different kind. */
/* 8 kinds of plants, each in several colours. Plant number n (0,1,2...) is kind n%8 in colour variant floor(n/8), so a new plant never repeats the last ones. */
const TYPES=[
  {id:"moon",name:"Moon flower",stem:"#1aa3a0",leafA:"#0b6a76",leafB:"#5ae3d9",glow:"120,255,235",bg:"60,235,215",speck:"#6fe9de",hues:[0,55,-55,110]},
  {id:"rose",name:"Rose",stem:"#2f9b68",leafA:"#0d5a46",leafB:"#58d79c",glow:"255,125,175",bg:"255,100,160",speck:"#ff9cc4",hues:[0,28,62,-62]},
  {id:"sun",name:"Sunflower",stem:"#3aa84a",leafA:"#1d6b2c",leafB:"#86e45c",glow:"255,214,90",bg:"255,200,70",speck:"#ffe58a",hues:[0,-22,35,-45]},
  {id:"lav",name:"Lavender",stem:"#4f9c88",leafA:"#2d6a5a",leafB:"#a5dcc2",glow:"190,150,255",bg:"170,130,255",speck:"#cdb2ff",hues:[0,55,-55,-110]},
  {id:"tulip",name:"Tulip",stem:"#3aa84a",leafA:"#1d6b2c",leafB:"#7fdc6a",glow:"255,110,135",bg:"255,100,130",speck:"#ffa0b4",hues:[0,45,-70,100]},
  {id:"daisy",name:"Daisy",stem:"#3aa84a",leafA:"#1d6b2c",leafB:"#86e45c",glow:"210,230,255",bg:"170,200,255",speck:"#dfeaff",hues:[0,150,-150,60]},
  {id:"lotus",name:"Lotus",stem:"#2f9b8a",leafA:"#0d5a56",leafB:"#58d7c0",glow:"255,150,205",bg:"255,130,190",speck:"#ffb4d8",hues:[0,-60,40,100]},
  {id:"poppy",name:"Poppy",stem:"#3aa84a",leafA:"#1d6b2c",leafB:"#86e45c",glow:"255,115,75",bg:"255,100,60",speck:"#ffb08a",hues:[0,40,-50,-100]}
];

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
function hueShift(a,deg){
  if(!deg)return a;
  const r=a[0]/255,g=a[1]/255,b=a[2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,l=(mx+mn)/2;
  const sat=d===0?0:d/(1-Math.abs(2*l-1));let h=0;
  if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}
  h=(h+deg+720)%360;
  const c=(1-Math.abs(2*l-1))*sat,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const q=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return q.map(v=>Math.round((v+m)*255));
}
const shiftStr=(str,deg)=>hueShift(str.split(",").map(Number),deg).join(",");
const tOf=(type,v)=>{
  const b=TYPES[tclamp(type)],h=b.hues[(v|0)%b.hues.length]||0;
  return h===0?b:Object.assign({},b,{hue:h,glow:shiftStr(b.glow,h),bg:shiftStr(b.bg,h),speck:"#"+hueShift(hex(b.speck),h).map(v=>v.toString(16).padStart(2,"0")).join("")});
};
const pad=n=>String(n).padStart(2,"0");
function istNow(){return new Date(Date.now()+IST)}
function todayStr(){const t=istNow();return t.getUTCFullYear()+"-"+pad(t.getUTCMonth()+1)+"-"+pad(t.getUTCDate())}
const dayNum=s=>{const [y,m,d]=s.split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/864e5)};
let data=null,UID="",LKEY="bt_plant",ref=null,fs=null,synced=false;
const fresh=(seed,type,done)=>({start:todayStr(),cared:[],last:0,seed:seed||0,type:type||0,v:0,done:done||[]});   // seed 0 = first plant of this account; later plants get newer seeds
const tclamp=v=>clamp((+v||0)|0,0,TYPES.length-1);
function normDone(a){return Array.isArray(a)?a.filter(x=>x&&typeof x.start==="string").map(x=>({type:tclamp(x.type),v:(+x.v||0)|0,seed:+x.seed||0,start:x.start,bloom:typeof x.bloom==="string"?x.bloom:x.start})).slice(-60):[]}
function norm(d){
  if(!d||typeof d.start!=="string"||!Array.isArray(d.cared))return null;
  return {start:d.start,cared:d.cared.filter(x=>typeof x==="string").slice(0,DAYS+5),last:+d.last||0,seed:+d.seed||dayNum(d.start)*864e5,type:tclamp(d.type),v:(+d.v||0)|0,done:normDone(d.done)};
}
function loadLocal(){
  try{const a=norm(JSON.parse(localStorage.getItem(LKEY)||"null"));if(a)return a}catch(e){}
  try{const a=norm(JSON.parse(localStorage.getItem("bt_plant")||"null"));if(a)return a}catch(e){}   // older version
  return null;
}
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify(data))}catch(e){}}
/* same seed = same plant: join the care days. A newer seed (a new plant was started) wins. Finished plants are joined too. */
function merge(a,b){
  if(!a)return b;if(!b)return a;
  const seen={},done=[];
  a.done.concat(b.done).forEach(x=>{if(!seen[x.seed]){seen[x.seed]=1;done.push(x)}});
  done.sort((p,q)=>p.seed-q.seed);
  let w;
  if(a.seed!==b.seed)w=a.seed>b.seed?a:b;
  else w={start:a.start,type:a.type,v:a.v,cared:Array.from(new Set(a.cared.concat(b.cared))).sort().slice(0,DAYS),last:Math.max(a.last,b.last),seed:a.seed};
  return {start:w.start,cared:w.cared,last:w.last,seed:w.seed,type:w.type,v:w.v,done:done.filter(x=>x.seed!==w.seed).slice(-60)};
}
function push(){
  saveLocal();
  if(ref&&fs)fs.setDoc(ref,data).catch(()=>{});
}
const careDays=()=>Math.min(DAYS,data.cared.length);
const calDay=()=>Math.max(1,dayNum(todayStr())-dayNum(data.start)+1);
const wateredToday=()=>data.cared.includes(todayStr());
/* 1 = fresh soil, 0 = bone dry. Falls to 0 about 40 hours after the last watering. After full bloom it stays 1 (no more wilting). */
const moisture=()=>careDays()>=DAYS?1:data.last?clamp(1-(Date.now()-data.last)/(40*36e5),0,1):.55;

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
"#lplant .card{position:relative;height:100%;border-radius:22px;overflow:hidden;background:#03100f;box-shadow:0 6px 18px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.06) inset;-webkit-tap-highlight-color:transparent}"+
"#lplant canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:manipulation}"+
"#lplant .chip{position:absolute;left:10px;top:10px;max-width:40%;padding:7px 12px 8px;border-radius:14px;background:rgba(14,22,28,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;font:12.5px/1.3 system-ui,sans-serif;pointer-events:none;box-shadow:0 0 0 1px rgba(255,255,255,.08) inset}"+
"#lplant .chip b{display:block;font-size:17px;font-weight:700;letter-spacing:.01em}"+
"#lplant .chip span{display:block;margin-top:1px;color:rgba(255,255,255,.82);transition:opacity .2s}"+
"#lplant .pw{position:absolute;right:14px;bottom:12px;width:56px;height:56px;border:0;padding:0;border-radius:50%;cursor:pointer;background:conic-gradient(#3de0cf calc(var(--m,0)*1%),rgba(0,0,0,.35) 0);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.35);-webkit-tap-highlight-color:transparent;transition:transform .12s}"+
"#lplant .pw:active{transform:scale(.94)}"+
"#lplant .pw i{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#22d3c0,#0c8f9f);color:#fff}"+
"#lplant .pw.done i{background:linear-gradient(160deg,#4cc46a,#2c9a4c)}"+
"#lplant .pw.seed i{background:linear-gradient(160deg,#ff8fb3,#e0558a)}"+
"#lplant .pw.ask i{animation:lpask 1.6s ease-in-out infinite}"+
"#lplant .pw svg{width:24px;height:24px}"+
"#lplant .chip small{display:block;font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.62);margin-bottom:2px}"+
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
let shownC=0,shownM=1,wAnim=0,drops=[],petals=[],sparks=[],fly={t:0},sayT=0,resetT=0,tr=null,advT=0;
let DR={c:0,m:1,t:tOf(0,0)};

function say(t){els.sub.textContent=t;clearTimeout(sayT);sayT=setTimeout(refreshText,2800)}

function refreshText(){
  if(!data||!els.day)return;
  const c=careDays(),m=moisture(),wt=wateredToday();
  els.kind.textContent=TYPES[data.type].name;
  els.day.textContent="Day "+Math.min(DAYS,calDay());
  els.sub.textContent=c>=DAYS?stageOf(c):(wt?stageOf(c):(m<.3?"Thirsty":"Needs water"));
  let ic=IC.drop,cls="pw",label="Water the plant";
  if(c>=DAYS||wt){ic=IC.check;cls+=" done";label="Watered today"}
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
  wAnim=.0001;pulse=1;
  if(careDays()>=DAYS)setTimeout(()=>{for(let i=0;i<30;i++)sparks.push({x:px(),y:H*.35+rnd(-30,30)*S,vx:rnd(-70,70)*S,vy:rnd(-100,-20)*S,l:rnd(.8,1.6)});say("It bloomed. Day "+DAYS+" done.");refreshText();planAdvance(5500)},2300);
  else say(careDays()<=1?"Thank you. Growing already.":"Nice. A little taller today.");
  refreshText();kick();
}
/* When a plant is fully bloomed it moves to the side (kept for life) and a new pot with a different plant starts, by itself. */
function planAdvance(ms){
  if(advT||tr||!data||careDays()<DAYS)return;
  advT=setTimeout(()=>{advT=0;advance()},ms);
}
function advance(){
  if(!data||tr||careDays()<DAYS)return;
  const d=data,fx=d.done.length?.66:.5;
  const done=d.done.some(x=>x.seed===d.seed)?d.done:d.done.concat([{type:d.type,v:d.v,seed:d.seed,start:d.start,bloom:d.cared.slice().sort().pop()||d.start}]);
  const nn=done.length,ty=nn%TYPES.length;
  data={start:todayStr(),cared:[],last:0,seed:Date.now(),type:ty,v:Math.floor(nn/TYPES.length)%TYPES[ty].hues.length,done:done.slice(-60)};
  tr={s:0,fx};shownC=0;shownM=1;petals=[];sparks=[];
  push();refreshText();kick();
}
function onBtn(){water()}

/* ---------- scene: night garden with glowing flowers, everything sways in the wind ---------- */
/* finished plants stand in a row left of the active pot; the more there are, the smaller and closer they get */
const slotX=(j,n)=>.36-j*Math.min(.16,.31/Math.max(1,n-1));
const kN=n=>clamp(.42*Math.min(1,(.31/Math.max(1,n-1))/.16),.2,.42);
const mainX=()=>data&&data.done.length?.66:.5;
const px=()=>W*mainX();
const soilY=()=>H-50*S;
const hMax=()=>Math.min(soilY()-64*S,150*S);
const rgba=(a,al)=>"rgba("+a.join(",")+","+al+")";
let specks=[],flies=[],blades=[],pulse=0,WD=0;
function windNow(){
  if(RM)return 0;
  const g=Math.max(0,Math.sin(T*.23));
  return Math.sin(T*.8)*.55+Math.sin(T*1.9+1.3)*.25+g*g*g*.7;
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function seedScene(){
  specks=[];flies=[];blades=[];
  for(let i=0;i<70;i++)specks.push({x:Math.random(),y:Math.random(),v:rnd(2,7),a:rnd(.15,.5),p:rnd(0,6)});
  for(let i=0;i<18;i++)flies.push({x:rnd(.2,.8),y:rnd(.4,1),sp:rnd(.5,1.3),p:rnd(0,6),y2:rnd(0,1),c:i%3?0:1});
  for(let i=0;i<38;i++){
    const edge=i<14?rnd(0,.3):i<28?rnd(.7,1):rnd(.3,.7);
    const mid=edge>.3&&edge<.7;
    blades.push({x:edge,h:mid?rnd(.08,.2):rnd(.16,.42),w:rnd(1.6,3.4),lean:rnd(-.35,.35)+(edge<.3?-.15:edge>.7?.15:0),ph:rnd(0,6),back:mid||i%2===0});
  }
}
function drawBg(dt){
  let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#02100f");g.addColorStop(.7,"#041c1b");g.addColorStop(1,"#06302c");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // glow under the plant
  const gl=ctx.createRadialGradient(px(),soilY(),4,px(),soilY()-20*S,150*S);
  const ga=.16+.1*pulse+.06*clamp(DR.c/DAYS,0,1);
  gl.addColorStop(0,"rgba("+DR.t.bg+","+ga+")");gl.addColorStop(1,"rgba("+DR.t.bg+",0)");
  ctx.globalCompositeOperation="lighter";ctx.fillStyle=gl;ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation="source-over";
  // floating specks
  ctx.fillStyle=DR.t.speck;
  specks.forEach(s=>{
    s.y+=s.v*dt/H*S;s.x+=WD*4*dt/W;if(s.y>1)s.y=0;if(s.x>1)s.x=0;if(s.x<0)s.x=1;
    ctx.globalAlpha=s.a*(.6+.4*Math.sin(T*1.2+s.p));
    ctx.save();ctx.translate(s.x*W,s.y*H);ctx.rotate(.5+Math.sin(s.p)*.4);ctx.fillRect(-1.6*S,-.5*S,3.2*S,1*S);ctx.restore();
  });
  ctx.globalAlpha=1;
}
function drawGrass(back){
  blades.forEach(b=>{
    if(b.back!==back)return;
    const bx=b.x*W,hh=b.h*H*(back?1.05:1),sw=WD*hh*.2+(RM?0:Math.sin(T*1.3+b.ph)*hh*.06);
    const tx=bx+b.lean*hh+sw,ty=H-hh,cx=bx+b.lean*hh*.25+sw*.35,cy=H-hh*.55,w=b.w*S;
    const g=ctx.createLinearGradient(0,H,0,ty);
    if(back){g.addColorStop(0,"#07381a");g.addColorStop(1,"#17893a")}else{g.addColorStop(0,"#0a5a1f");g.addColorStop(1,"#35d93f")}
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(bx-w,H+2);ctx.quadraticCurveTo(cx-w*.5,cy,tx,ty);ctx.quadraticCurveTo(cx+w*.7,cy,bx+w,H+2);ctx.fill();
  });
}
function drawPot(wet){
  const x=px(),y=soilY(),b=H-8*S;
  // soft glow on the ground under the pot
  ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.ellipse(x,b+1*S,46*S,5*S,0,0,6.28);ctx.fill();
  const g=ctx.createLinearGradient(x-36*S,0,x+36*S,0);g.addColorStop(0,"#0a2a2e");g.addColorStop(.4,"#1d6c6c");g.addColorStop(.7,"#124a4d");g.addColorStop(1,"#082226");
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-34*S,y);ctx.lineTo(x+34*S,y);ctx.lineTo(x+24*S,b);ctx.lineTo(x-24*S,b);ctx.closePath();ctx.fill();
  ctx.fillStyle="rgba(160,255,240,.16)";ctx.beginPath();ctx.moveTo(x-28*S,y+7*S);ctx.lineTo(x-20*S,y+7*S);ctx.lineTo(x-15*S,b-4*S);ctx.lineTo(x-20*S,b-4*S);ctx.fill();
  ctx.fillStyle="rgba(120,255,235,.22)";ctx.fillRect(x-31*S,y+13*S,62*S,2*S);   // glowing band
  // soil
  ctx.fillStyle=mix("#6b5a45","#241a14",wet);ctx.beginPath();ctx.ellipse(x,y,35*S,7*S,0,0,6.28);ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.25)";for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(x-26*S+i*8.5*S,y+(i%2?2:-1)*S,1.2*S,0,6.28);ctx.fill()}
  // rim
  const rg=ctx.createLinearGradient(x-38*S,0,x+38*S,0);rg.addColorStop(0,"#13474a");rg.addColorStop(.5,"#2fa7a2");rg.addColorStop(1,"#0f3d40");
  ctx.fillStyle=rg;rr(x-38*S,y-4*S,76*S,10*S,4.5*S);ctx.fill();
  ctx.fillStyle="rgba(200,255,248,.3)";rr(x-35*S,y-3*S,70*S,2.2*S,2*S);ctx.fill();
}
function tealLeaf(x,y,ang,L,dim,al){
  if(L<1)return;
  const w=L*.42;
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  const g=ctx.createLinearGradient(0,0,L,0);
  g.addColorStop(0,rgba(mixA(DR.t.leafA,"#3a5558",dim),al));g.addColorStop(1,rgba(mixA(DR.t.leafB,"#728f8b",dim),al*.9));
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(L*.38,-w*1.35,L,0);ctx.quadraticCurveTo(L*.38,w*.95,0,0);ctx.fill();
  ctx.strokeStyle="rgba(200,255,248,.28)";ctx.lineWidth=Math.max(.6,L*.03);ctx.beginPath();ctx.moveTo(L*.05,0);ctx.lineTo(L*.85,0);ctx.stroke();
  ctx.restore();
}
function petal(a,L,Wd,dim){
  ctx.save();ctx.rotate(a);
  const g=ctx.createLinearGradient(0,0,0,-L);g.addColorStop(0,hx("#2fb8b4",dim,.95));g.addColorStop(1,hx("#c4fff5",dim,.92));
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(Wd,-L*.15,Wd*1.15,-L*.85,0,-L);ctx.bezierCurveTo(-Wd*1.15,-L*.85,-Wd,-L*.15,0,0);ctx.fill();
  ctx.restore();
}
/* f: 0 = closed bud .. 1 = open flower, b: size of the bud, rot: tilt */
function headMoon(x,y,f,b,rot,dim){
  const R=(6+17*b)*S*(1+.3*f);
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  const ga=(.1+.3*f+.12*pulse)*(1-dim*.75)*(DR.k||1);
  const gl=ctx.createRadialGradient(0,-R*.4,1,0,-R*.4,R*3);gl.addColorStop(0,"rgba("+DR.t.glow+","+ga+")");gl.addColorStop(1,"rgba("+DR.t.glow+",0)");
  ctx.globalCompositeOperation="lighter";ctx.fillStyle=gl;ctx.fillRect(-R*3.2,-R*3.6,R*6.4,R*6.4);ctx.globalCompositeOperation="source-over";
  ctx.globalAlpha=1-dim*.3;
  if(f<.03){
    const bg=ctx.createLinearGradient(0,0,0,-R*1.3);bg.addColorStop(0,hx("#27a9a6",dim,1));bg.addColorStop(1,hx("#b6fff3",dim,1));
    ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(R*.75,-R*.2,R*.6,-R*1.0,0,-R*1.4);ctx.bezierCurveTo(-R*.6,-R*1.0,-R*.75,-R*.2,0,0);ctx.fill();
    ctx.fillStyle=hx("#127f86",dim,.95);
    [-1,1].forEach(d=>{ctx.save();ctx.rotate(d*.5);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(d*R*.5,-R*.3,0,-R*.7);ctx.quadraticCurveTo(-d*R*.1,-R*.3,0,0);ctx.fill();ctx.restore()});
  }else{
    const sp=.12+.88*f;
    petal(0,R*1.0,R*.52,dim);
    petal(-.95*sp,R*1.02,R*.56,dim);
    petal(.95*sp,R*1.02,R*.56,dim);
    // front lip with a yellow centre
    const lg=ctx.createLinearGradient(0,-R*.3,0,R*.08);lg.addColorStop(0,"rgba(255,255,255,.97)");lg.addColorStop(1,"rgba(170,245,236,.95)");
    ctx.fillStyle=lg;ctx.beginPath();ctx.ellipse(0,-R*.08,R*.52,R*.2*(.4+.6*f),0,0,6.28);ctx.fill();
    ctx.fillStyle="#ffd23f";ctx.beginPath();ctx.ellipse(0,-R*.1,R*.34,R*.095*(.4+.6*f),0,0,6.28);ctx.fill();
    ctx.fillStyle="rgba(255,236,120,.9)";[-.2,0,.2].forEach((d,i)=>{ctx.beginPath();ctx.arc(d*R,-R*(.34+(i===1?.06:0)),R*.04,0,6.28);ctx.fill()});
  }
  ctx.restore();ctx.globalAlpha=1;
}

const hx=(c,dim,al)=>rgba(mixA(DR.t.hue?"#"+hueShift(hex(c),DR.t.hue).map(v=>v.toString(16).padStart(2,"0")).join(""):c,"#5a6f6c",dim),al==null?1:al);
function dRose(R,f,dim){
  const cy=-R*.62,s=.5+.5*f;
  ctx.fillStyle=hx("#1f7a4a",dim,.95);
  [-1,0,1].forEach(d=>{ctx.save();ctx.rotate(d*.7);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(d*R*.35,-R*.35,d*R*.1,-R*.62);ctx.quadraticCurveTo(-d*R*.05,-R*.3,0,0);ctx.fill();ctx.restore()});
  if(f<.03){
    const g=ctx.createLinearGradient(0,0,0,-R*1.3);g.addColorStop(0,hx("#a82255",dim));g.addColorStop(1,hx("#ff9fc2",dim));
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,cy,R*.5,R*.72,0,0,6.28);ctx.fill();
    ctx.strokeStyle="rgba(120,10,60,.35)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-R*.3,cy-R*.1);ctx.quadraticCurveTo(0,cy+R*.25,R*.3,cy-R*.2);ctx.stroke();return;
  }
  const rings=[{n:7,r:.66,rx:.42,ry:.36,a:"#ff5a93",b:"#ff9ec0",o:0},{n:6,r:.43,rx:.36,ry:.31,a:"#ff77a6",b:"#ffb4cd",o:.5},{n:5,r:.22,rx:.28,ry:.25,a:"#ff91b6",b:"#ffd0df",o:.2}];
  rings.forEach(rg=>{
    for(let i=0;i<rg.n;i++){
      const a=i*6.2832/rg.n+rg.o,x=Math.cos(a)*R*rg.r*s,y=cy+Math.sin(a)*R*rg.r*s*.78;
      const g=ctx.createRadialGradient(x,y,1,x,y,R*rg.rx);g.addColorStop(0,hx(rg.b,dim));g.addColorStop(1,hx(rg.a,dim));
      ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,R*rg.rx*(.55+.45*s),R*rg.ry*(.55+.45*s),a+1.57,0,6.28);ctx.fill();
      ctx.strokeStyle="rgba(150,20,70,.28)";ctx.lineWidth=.9;ctx.stroke();
    }
  });
  ctx.fillStyle=hx("#ff5a93",dim);ctx.beginPath();ctx.arc(0,cy,R*.13*s,0,6.28);ctx.fill();
  ctx.strokeStyle="rgba(130,10,60,.45)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,cy,R*.09*s,0,4.5);ctx.stroke();
}
function budBall(R,dim,tip){
  const cy=-R*.8;
  ctx.fillStyle=hx("#3f9a3a",dim);
  for(let i=0;i<8;i++){ctx.save();ctx.translate(0,cy);ctx.rotate(i*.785);ctx.beginPath();ctx.moveTo(-R*.14,-R*.4);ctx.lineTo(0,-R*.8);ctx.lineTo(R*.14,-R*.4);ctx.fill();ctx.restore()}
  const g=ctx.createRadialGradient(-R*.15,cy-R*.15,1,0,cy,R*.6);g.addColorStop(0,hx("#7fd35a",dim));g.addColorStop(1,hx("#2f7d32",dim));
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,cy,R*.52,0,6.28);ctx.fill();
  ctx.fillStyle=hx(tip,dim,.95);ctx.beginPath();ctx.ellipse(0,cy-R*.46,R*.2,R*.11,0,0,6.28);ctx.fill();
}
function ptl(a,L,w,c0,c1,dim,ox,oy){
  ctx.save();if(ox||oy)ctx.translate(ox||0,oy||0);ctx.rotate(a);
  const g=ctx.createLinearGradient(0,0,0,-L);g.addColorStop(0,hx(c0,dim));g.addColorStop(1,hx(c1,dim));
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(w*1.2,-L*.1,w*1.1,-L*.8,0,-L);ctx.bezierCurveTo(-w*1.1,-L*.8,-w*1.2,-L*.1,0,0);ctx.fill();
  ctx.restore();
}
function dTulip(R,f,dim){
  const sp=.08+.5*f,L=R*1.35;
  ptl(-sp*1.3,L,R*.42,"#c21f48","#ff8aa0",dim);
  ptl(sp*1.3,L,R*.42,"#c21f48","#ff8aa0",dim);
  ptl(0,L*1.02,R*.5,"#ff3f66","#ffb6c4",dim);
  ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,-L*.2);ctx.quadraticCurveTo(R*.08,-L*.6,0,-L*.9);ctx.stroke();
}
function dDaisy(R,f,dim){
  if(f<.03){budBall(R,dim,"#e6f0ff");return}
  const cy=-R*.75,s=.35+.65*f;
  [[0,"#b8d4f6","#eef5ff"],[.2,"#cfe2fb","#ffffff"]].forEach(([off,c0,c1])=>{
    for(let i=0;i<16;i++){
      ctx.save();ctx.translate(0,cy);ctx.rotate(i*6.2832/16+off);
      const L=R*1.05*s,w=R*.1*(.6+.4*s),g=ctx.createLinearGradient(0,-L*.3,0,-L);g.addColorStop(0,hx(c0,dim));g.addColorStop(1,hx(c1,dim));
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-L*.25);ctx.bezierCurveTo(w*1.4,-L*.5,w*1.2,-L*.9,0,-L);ctx.bezierCurveTo(-w*1.2,-L*.9,-w*1.4,-L*.5,0,-L*.25);ctx.fill();
      ctx.restore();
    }
  });
  const cr=R*.3*(.7+.3*s),g=ctx.createRadialGradient(-cr*.3,cy-cr*.3,1,0,cy,cr);g.addColorStop(0,"#ffe566");g.addColorStop(1,"#e8a400");
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,cy,cr,0,6.28);ctx.fill();
  ctx.fillStyle="rgba(150,90,0,.55)";for(let k=0;k<10;k++){const a=k*2.4,r=cr*.7*Math.sqrt(k/10);ctx.beginPath();ctx.arc(Math.cos(a)*r,cy+Math.sin(a)*r,R*.02,0,6.28);ctx.fill()}
}
function dLotus(R,f,dim){
  const sp=.1+.9*f,L=R*1.15;
  if(f<.03){
    ptl(0,L*.95,R*.42,"#c0407f","#ffc2dd",dim);
    ctx.fillStyle=hx("#2f8a6a",dim,.95);[-1,1].forEach(d=>{ctx.save();ctx.rotate(d*.6);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(d*R*.4,-R*.3,0,-R*.6);ctx.quadraticCurveTo(-d*R*.1,-R*.3,0,0);ctx.fill();ctx.restore()});return;
  }
  [-1.25,-.62,0,.62,1.25].forEach(a=>ptl(a*sp,L*(1-Math.abs(a)*.08),R*.34,"#d2528d","#ff9fc7",dim));
  [-.92,-.3,.3,.92].forEach(a=>ptl(a*sp,L*.9,R*.32,"#e0679e","#ffb8d6",dim));
  [-.5,0,.5].forEach(a=>ptl(a*sp,L*.7,R*.3,"#ee86b2","#ffd2e4",dim));
  ctx.fillStyle="#ffd23f";ctx.beginPath();ctx.ellipse(0,-R*.1,R*.22,R*.1,0,0,6.28);ctx.fill();
}
function dPoppy(R,f,dim){
  if(f<.03){budBall(R,dim,"#ff4a2a");return}
  const cy=-R*.7,s=.4+.6*f;
  [[0,.45],[1.57,.45],[3.14,.45],[4.71,.45]].forEach(([a,r],i)=>{
    const x=Math.cos(a+.4)*R*r*s,y=cy+Math.sin(a+.4)*R*r*s*.85;
    const g=ctx.createRadialGradient(x,y,1,x,y,R*.65*s);g.addColorStop(0,hx("#ff8a5c",dim));g.addColorStop(1,hx(i%2?"#e8321a":"#ff4a2a",dim));
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y,R*.6*(.5+.5*s),R*.55*(.5+.5*s),a,0,6.28);ctx.fill();
    ctx.strokeStyle="rgba(120,10,10,.25)";ctx.lineWidth=.9;ctx.stroke();
  });
  ctx.fillStyle="#2a1020";ctx.beginPath();ctx.arc(0,cy,R*.16*s,0,6.28);ctx.fill();
  ctx.fillStyle="#6a3a58";for(let k=0;k<10;k++){const a=k*.628;ctx.beginPath();ctx.arc(Math.cos(a)*R*.24*s,cy+Math.sin(a)*R*.24*s,R*.025,0,6.28);ctx.fill()}
}
function dSun(R,f,dim){
  const cy=-R*.8,s=.35+.65*f;
  if(f<.03){
    ctx.fillStyle=hx("#3f9a3a",dim);
    for(let i=0;i<9;i++){ctx.save();ctx.translate(0,cy);ctx.rotate(i*.698);ctx.beginPath();ctx.moveTo(-R*.14,-R*.4);ctx.lineTo(0,-R*.82);ctx.lineTo(R*.14,-R*.4);ctx.fill();ctx.restore()}
    const g=ctx.createRadialGradient(-R*.15,cy-R*.15,1,0,cy,R*.6);g.addColorStop(0,hx("#7fd35a",dim));g.addColorStop(1,hx("#2f7d32",dim));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,cy,R*.52,0,6.28);ctx.fill();
    ctx.fillStyle=hx("#ffd23f",dim,.9);ctx.beginPath();ctx.ellipse(0,cy-R*.46,R*.18,R*.1,0,0,6.28);ctx.fill();return;
  }
  [[.1,"#e69500","#ffcc33"],[0,"#ffb000","#ffe566"]].forEach(([off,c0,c1],layer)=>{
    for(let i=0;i<17;i++){
      ctx.save();ctx.translate(0,cy);ctx.rotate(i*6.2832/17+off+layer*.18);
      const L=R*1.2*s,w=R*.17*(.6+.4*s),g=ctx.createLinearGradient(0,-L*.3,0,-L);g.addColorStop(0,hx(c0,dim));g.addColorStop(1,hx(c1,dim));
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-L*.28);ctx.bezierCurveTo(w,-L*.55,w*.9,-L*.88,0,-L);ctx.bezierCurveTo(-w*.9,-L*.88,-w,-L*.55,0,-L*.28);ctx.fill();
      ctx.restore();
    }
  });
  const cr=R*.46*(.7+.3*s),g=ctx.createRadialGradient(0,cy,1,0,cy,cr);g.addColorStop(0,hx("#7a4a1c",dim));g.addColorStop(1,hx("#2b1608",dim));
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,cy,cr,0,6.28);ctx.fill();
  ctx.fillStyle=hx("#c98a3c",dim,.8);
  for(let k=1;k<=38;k++){const a=k*2.399,r=cr*.92*Math.sqrt(k/38);ctx.beginPath();ctx.arc(Math.cos(a)*r,cy+Math.sin(a)*r,R*.022,0,6.28);ctx.fill()}
}
function dLav(R,f,dim){
  const n=12,Ls=R*(.55+.65*f);
  for(let i=n-1;i>=0;i--){
    const t=i/(n-1),y=-R*.2-t*Ls,o=clamp(f*1.5-t*.5,0,1),r=R*(.24-.13*t)*(.5+.5*o);
    const c=mixA(rgbHex(mixA("#5f8f66","#8a5ce0",o)),"#d6c0ff",o*.3*(1-t));
    ctx.fillStyle=hx(rgbHex(c),dim,.95);
    [-1,1].forEach(d=>{ctx.beginPath();ctx.ellipse(d*r*.75,y,r*.8,r*.6,d*.6,0,6.28);ctx.fill()});
    ctx.beginPath();ctx.ellipse(0,y-r*.3,r*.72,r*.62,0,0,6.28);ctx.fill();
  }
}
const rgbHex=a=>"#"+a.map(v=>v.toString(16).padStart(2,"0")).join("");
const DRAW={rose:dRose,sun:dSun,lav:dLav,tulip:dTulip,daisy:dDaisy,lotus:dLotus,poppy:dPoppy};
function head(x,y,f,b,rot,dim){
  const id=DR.t.id;
  if(id==="moon"||!DRAW[id])return headMoon(x,y,f,b,rot,dim);
  const R=(6+17*b)*S*(1+.3*f);
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);
  const ga=(.1+.3*f+.12*pulse)*(1-dim*.75)*(DR.k||1);
  const gl=ctx.createRadialGradient(0,-R*.5,1,0,-R*.5,R*3);gl.addColorStop(0,"rgba("+DR.t.glow+","+ga+")");gl.addColorStop(1,"rgba("+DR.t.glow+",0)");
  ctx.globalCompositeOperation="lighter";ctx.fillStyle=gl;ctx.fillRect(-R*3.2,-R*3.6,R*6.4,R*6.4);ctx.globalCompositeOperation="source-over";
  ctx.globalAlpha=1-dim*.3;
  DRAW[id](R,f,dim);
  ctx.restore();ctx.globalAlpha=1;
}
const SIDES=[{dir:-1,t0:.3,c0:11,len:48,hs:.5,bs:14,os:24},{dir:1,t0:.4,c0:15,len:52,hs:.42,bs:17,os:26.5}];
function drawPlant(){
  const c=DR.c,m=clamp((.45-DR.m)/.45,0,1),dim=m*.9;
  const bx=px(),by=soilY(),hm=hMax();
  const h=lerp(14*S,hm,Math.pow(clamp(c/24,0,1),.85)),hr=h/hm;
  const off=(WD*13*S+m*34*S)*(hr+.12);
  const tipX=bx+off,tipY=by-h*(1-.12*m);
  const cx=bx+off*.25-4*S,cy=by-h*.55;
  const P=t=>{const u=1-t;return {x:u*u*bx+2*u*t*cx+t*t*tipX,y:u*u*by+2*u*t*cy+t*t*tipY}};
  const stemC=rgb(mixA(DR.t.stem,"#5b7d78",dim)),stemW=(2.2+2.6*clamp(c/18,0,1))*S;
  const wet=1-dim*.4;
  // basal fronds
  [[-1.2,44],[-.72,56],[-.32,48],[.3,52],[.74,58],[1.2,44]].forEach((fr,i)=>{
    const g=clamp((c-1.5-i*.7)/9,0,1);if(g<=0)return;
    const a=fr[0],Lf=fr[1]*S*ease(g);
    const tx=bx+Math.sin(a)*Lf*.95+WD*Lf*.2+m*Math.sign(a)*Lf*.25,ty=by-Math.cos(a)*Lf*.8+m*Lf*.3;
    const qx=bx+Math.sin(a)*Lf*.25+WD*Lf*.05,qy=by-Lf*.62;
    ctx.strokeStyle=stemC;ctx.lineWidth=1.8*S;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(qx,qy,tx,ty);ctx.stroke();
    for(let k=1;k<=6;k++){
      const t=k/7,u=1-t,x=u*u*bx+2*u*t*qx+t*t*tx,y=u*u*by+2*u*t*qy+t*t*ty;
      const dx=2*u*(qx-bx)+2*t*(tx-qx),dy=2*u*(qy-by)+2*t*(ty-qy),ang=Math.atan2(dy,dx),L=(11-k*.9)*S*ease(g);
      tealLeaf(x,y,ang-.95,L,dim,.9);tealLeaf(x,y,ang+.95,L,dim,.9);
    }
    tealLeaf(tx,ty,Math.atan2(ty-qy,tx-qx),9*S*ease(g),dim,.9);
  });
  // side stems with their own flowers
  const heads=[];
  SIDES.forEach(sd=>{
    const g=clamp((c-sd.c0)/12,0,1);if(g<=0)return;
    const o=P(sd.t0);
    const sx=o.x+sd.dir*sd.len*S*g*(1-.3*m)+WD*10*S*g+m*sd.dir*8*S,sy=o.y-hm*sd.hs*g*(1-.18*m);
    const qx=o.x+sd.dir*sd.len*S*g*.1,qy=o.y-(o.y-sy)*.72;
    ctx.strokeStyle=stemC;ctx.lineWidth=stemW*.75;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.quadraticCurveTo(qx,qy,sx,sy);ctx.stroke();
    const mx=(o.x+2*qx+sx)/4,my=(o.y+2*qy+sy)/4;
    tealLeaf(mx,my,-Math.PI/2+sd.dir*(1.1+m*.5),14*S*ease(g),dim,.9);
    tealLeaf(mx,my,-Math.PI/2-sd.dir*.35+m*sd.dir*.3,11*S*ease(g),dim,.9);
    if(c>=sd.bs)heads.push({x:sx,y:sy,f:clamp((c-sd.os)/3.5,0,1),b:clamp((c-sd.bs)/8,0,1),r:WD*.1+sd.dir*.12+m*sd.dir*.9});
  });
  // main stem and its leaf pairs
  ctx.strokeStyle=stemC;ctx.lineWidth=stemW;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(cx,cy,tipX,tipY);ctx.stroke();
  ctx.strokeStyle="rgba(190,255,248,.2)";ctx.lineWidth=stemW*.28;ctx.beginPath();ctx.moveTo(bx-stemW*.2,by);ctx.quadraticCurveTo(cx-stemW*.2,cy,tipX-stemW*.2,tipY);ctx.stroke();
  const K=6;
  for(let k=0;k<K;k++){
    const born=2+k*3.6,a=clamp((c-born)/6,0,1);if(a<=0)continue;
    const nh=(20+k*21)*S;if(nh>h-6*S)continue;
    const o=P(clamp(nh/h,0,1)),L=(15+13*(1-k/K*.5))*S*ease(a);
    const base=(1.1-k*.06)+m*.5,w=RM?0:Math.sin(T*1.7+k)*.06+WD*.07;
    tealLeaf(o.x,o.y,-Math.PI/2+base+w,L,dim,.92);
    tealLeaf(o.x,o.y,-Math.PI/2-base+w,L,dim,.92);
  }
  if(c<20){const L=(6+Math.min(c,18)*.5)*S;tealLeaf(tipX,tipY,-Math.PI/2+.5+m*.8,L,dim,.95);tealLeaf(tipX,tipY,-Math.PI/2-.5-m*.8,L,dim,.95)}
  if(c>=19)heads.push({x:tipX,y:tipY-2*S,f:clamp((c-27)/3,0,1),b:clamp((c-19)/8,0,1),r:WD*.09+m*.9});
  heads.forEach(hd=>head(hd.x,hd.y,hd.f,hd.b,hd.r,dim));
  return {bx,by,h,hm,tipX,tipY,cx,cy,P,wet};
}
function drawAt(xf,k){
  const pv=H-8*S;
  ctx.save();ctx.translate(xf*W,pv);ctx.scale(k,k);ctx.translate(-px(),-pv);
  drawPot(DR.m);const p=drawPlant();
  ctx.restore();return p;
}
function drawThirst(p){
  if(wateredToday()||careDays()>=DAYS||shownM>.3)return;
  const k=1+(RM?0:Math.sin(T*3)*.08),x=p.tipX+36*S,y=Math.max(30*S,p.tipY-26*S);
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  ctx.fillStyle="rgba(255,255,255,.94)";ctx.beginPath();ctx.arc(0,0,14*S,0,6.28);ctx.fill();
  ctx.beginPath();ctx.moveTo(-9*S,10*S);ctx.lineTo(-15*S,17*S);ctx.lineTo(-3*S,13*S);ctx.fill();
  ctx.fillStyle="#2f9be6";ctx.beginPath();ctx.moveTo(0,-8*S);ctx.bezierCurveTo(6*S,-1*S,7*S,2*S,7*S,3.5*S);ctx.arc(0,3.5*S,7*S,0,Math.PI);ctx.bezierCurveTo(-7*S,2*S,-6*S,-1*S,0,-8*S);ctx.fill();
  ctx.restore();
}
function drawCan(p){
  if(wAnim<=0)return;
  const t=wAnim,tilt=ease(Math.min(1,t/.5))*(t>1.7?clamp(1-(t-1.7)/.4,0,1):1);
  const x=p.bx+66*S,y=clamp(p.tipY-46*S,40*S,soilY()-72*S);
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
function drawFlies(dt){
  const n=7+Math.round(11*clamp(DR.c/DAYS,0,1)),bright=.55+.45*clamp(DR.c/DAYS,0,1);
  ctx.globalCompositeOperation="lighter";
  for(let i=0;i<n&&i<flies.length;i++){
    const f=flies[i];
    f.y2-=f.sp*.02*dt*(RM?0:1)*20/ (H/245);f.x+=(Math.sin(T*f.sp+f.p)*5+WD*4)*dt/W;
    if(f.y2<-.1){f.y2=1;f.x=rnd(.15,.85)}
    const x=f.x*W,y=H*.32+f.y2*H*.62,tw=.5+.5*Math.sin(T*2.2*f.sp+f.p);
    const col=f.c?DR.t.glow:"255,220,80";
    const g=ctx.createRadialGradient(x,y,0,x,y,7*S);g.addColorStop(0,"rgba("+col+","+(.8*tw*bright)+")");g.addColorStop(1,"rgba("+col+",0)");
    ctx.fillStyle=g;ctx.fillRect(x-8*S,y-8*S,16*S,16*S);
  }
  ctx.globalCompositeOperation="source-over";
}
function frame(now){
  raf=0;
  if(!box||box.classList.contains("hide")||document.hidden){last=0;return}
  const dt=last?Math.min(.05,(now-last)/1000):0;last=now;T+=dt;
  WD+=(windNow()-WD)*Math.min(1,dt*2.5);
  pulse=Math.max(0,pulse-dt*.35);
  const wet=moisture();
  if(wAnim>0){wAnim+=dt;if(wAnim>2.2)wAnim=0}
  const target=careDays();
  if(wAnim===0||wAnim>1.4)shownC+=(target-shownC)*Math.min(1,dt*1.1);
  if(Math.abs(target-shownC)<.002)shownC=target;
  const wetTarget=wAnim>.9||wAnim===0?wet:shownM;
  shownM+=(wetTarget-shownM)*Math.min(1,dt*1.6);
  const MAINDR={c:shownC,m:shownM,t:tOf(data.type,data.v)};
  DR=MAINDR;
  if(tr){tr.s+=dt/2.2;if(tr.s>=1)tr=null}
  ctx.clearRect(0,0,W,H);
  drawBg(dt);
  drawGrass(true);
  const nd=data.done.length;
  for(let j=Math.min(nd,14)-1;j>=0;j--){
    const e=data.done[nd-1-j];let xf,k;
    if(tr){const s=ease(tr.s),fx=j===0?tr.fx:slotX(j-1,nd-1),fk=j===0?1:kN(nd-1);xf=lerp(fx,slotX(j,nd),s);k=lerp(fk,kN(nd),s)}
    else{xf=slotX(j,nd);k=kN(nd)}
    DR={c:DAYS,m:1,t:tOf(e.type,e.v),k:k*.9};drawAt(xf,k);
  }
  DR=MAINDR;
  const mk=tr?ease(clamp((tr.s-.3)/.7,0,1)):1;
  let p=null;
  if(mk>.01){ctx.globalAlpha=mk;p=drawAt(mainX(),mk);ctx.globalAlpha=1}
  if(!tr&&p){drawThirst(p);drawCan(p)}
  drops.forEach(d=>{d.vy+=520*S*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;if(d.y>=soilY()){d.dead=1;pulse=Math.min(1,pulse+.03);for(let i=0;i<2;i++)sparks.push({x:d.x,y:soilY(),vx:rnd(-30,30)*S,vy:rnd(-50,-15)*S,l:.4,w:1})}});
  drops=drops.filter(d=>!d.dead&&d.y<H);
  ctx.fillStyle="#8ccbff";drops.forEach(d=>{ctx.beginPath();ctx.ellipse(d.x,d.y,1.6*S,2.6*S,0,0,6.28);ctx.fill()});
  drawFlies(dt);
  drawGrass(false);
  sparks.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=(s.w?260:60)*S*dt;s.l-=dt});
  sparks=sparks.filter(s=>s.l>0);
  sparks.forEach(s=>{ctx.globalAlpha=clamp(s.l*1.5,0,1);ctx.fillStyle=s.w?"#8ccbff":"#aefff3";ctx.beginPath();ctx.arc(s.x,s.y,(s.w?1.4:2)*S,0,6.28);ctx.fill()});ctx.globalAlpha=1;
  if(p&&!tr&&DR.c>=DAYS-.05&&Math.random()<.025)petals.push({x:p.tipX+rnd(-18,18)*S,y:p.tipY,vx:rnd(-8,8)*S,vy:rnd(14,26)*S,r:rnd(0,6)});
  petals.forEach(q=>{q.x+=q.vx*dt+Math.sin(T*2+q.r)*.4*S+WD*6*dt;q.y+=q.vy*dt;q.r+=dt});
  petals=petals.filter(q=>q.y<soilY()+4*S);
  ctx.fillStyle="rgb("+DR.t.glow+")";petals.forEach(q=>{ctx.beginPath();ctx.ellipse(q.x,q.y,3.2*S,1.8*S,q.r,0,6.28);ctx.fill()});
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
  if(changed){if(careDays()<shownC)shownC=careDays();refreshText();kick();planAdvance(1500)}
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
  seedScene();
  if(getComputedStyle(side).position==="static")side.style.position="relative";
  box=E("div");box.id="lplant";box.className="hide";box.setAttribute("aria-label","Flower plant");
  card=E("div","card");cv=E("canvas");cv.setAttribute("aria-hidden","true");ctx=cv.getContext("2d");
  const chip=E("div","chip");els.kind=E("small");els.day=E("b");els.sub=E("span");chip.append(els.kind,els.day,els.sub);
  els.btn=E("button","pw");els.btn.type="button";els.ic=E("i");els.btn.appendChild(els.ic);
  card.append(cv,chip,els.btn);box.appendChild(card);side.appendChild(box);
  cv.addEventListener("pointerdown",e=>{e.preventDefault();if(!wateredToday()&&careDays()<DAYS)water();else say(careDays()>=DAYS?"Your flower is in full bloom.":"Still moist. Once a day is enough.")});
  els.btn.addEventListener("click",e=>{e.stopPropagation();onBtn()});
  new MutationObserver(soon).observe(list,{childList:true,subtree:true});
  const res=$("res");if(res)new MutationObserver(soon).observe(res,{attributes:true,attributeFilter:["class"]});
  if(window.ResizeObserver)new ResizeObserver(soon).observe(side);
  addEventListener("resize",soon);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){refreshText();soon();kick()}});
  setInterval(()=>{refreshText();soon()},60000);
  place();startSync();planAdvance(1500);
  window.__plant={get:()=>data,set:d=>{data=d;saveLocal();refreshText()},water,show:c=>{shownC=c},get c(){return shownC}};
}
