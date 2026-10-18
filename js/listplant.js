/* ===== listplant.js: a flower plant that grows over 30 days in the empty space under the chat list =====
   Day 1: a tiny seedling. Water it once a day. After 30 days of care it blooms.
   Real-nature behaviour: it only grows on days you water it, droops and turns pale when it gets thirsty
   (about 1-2 days without water), recovers after watering, and does not like extra water the same day.
   Shows only when there is enough free space; hides while searching or when the chat list is long.
   Use this file INSTEAD of listfill.js / listgame.js / listcat.js (they use the same spot).
   Hook (chat.js, after `me` is known):
     import("./listplant.js"+V).then(m=>m.initListPlant()).catch(()=>{});                       */
const TITLE="Our flower plant";
const DAYS=30;                 // care days needed to bloom
const MIN_FREE=190;            // px of free space needed before it is shown
const MAX_H=300;               // never taller than this
const KEY="bt_plant";
const IST=19800000;

const $=id=>document.getElementById(id);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>1-Math.pow(1-clamp(t,0,1),3);
const rnd=(a,b)=>a+Math.random()*(b-a);

/* ---------- saved data ---------- */
const pad=n=>String(n).padStart(2,"0");
function todayStr(){const t=new Date(Date.now()+IST);return t.getUTCFullYear()+"-"+pad(t.getUTCMonth()+1)+"-"+pad(t.getUTCDate())}
const dayNum=s=>{const [y,m,d]=s.split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/864e5)};
let data=null;
function load(){
  try{const d=JSON.parse(localStorage.getItem(KEY)||"null");if(d&&d.start&&Array.isArray(d.cared))return d}catch(e){}
  return {start:todayStr(),cared:[],last:0};
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}}
const careDays=()=>Math.min(DAYS,data.cared.length);
const calDay=()=>Math.max(1,dayNum(todayStr())-dayNum(data.start)+1);
const wateredToday=()=>data.cared.includes(todayStr());
/* 1 = fresh soil, 0 = bone dry. Falls to 0 about 40 hours after the last watering. */
const moisture=()=>data.last?clamp(1-(Date.now()-data.last)/(40*36e5),0,1):.55;

/* ---------- text for each growth stage ---------- */
function stageOf(c){
  if(c>=DAYS)return ["In full bloom","The flower has opened. Butterflies are visiting."];
  if(c>=27)return ["Almost there","The bud is swelling and showing its colour."];
  if(c>=23)return ["Budding","A flower bud has formed at the top."];
  if(c>=18)return ["Leafy plant","It is storing energy to make flowers."];
  if(c>=13)return ["Growing","New shoots are appearing along the stem."];
  if(c>=8)return ["Young plant","Roots are spreading, leaves reach for the light."];
  if(c>=4)return ["Sprout","The stem gets stronger every day."];
  if(c>=1)return ["Seedling","The first true leaves are forming."];
  return ["Seedling","Tiny roots are reaching into the soil."];
}

/* ---------- ui ---------- */
function css(){
  if($("lpcss"))return;
  const s=E("style");s.id="lpcss";
  s.textContent=
"#lplant{position:absolute;left:0;right:0;z-index:0;box-sizing:border-box;padding:10px 12px 12px}"+
"#lplant.hide{display:none}"+
"#lplant .card{position:relative;height:100%;border-radius:20px;overflow:hidden;background:var(--panel,#202c33);box-shadow:0 1px 0 rgba(255,255,255,.04) inset}"+
"#lplant canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:manipulation;cursor:pointer}"+
"#lplant .inf{position:absolute;right:14px;top:12px;bottom:12px;width:50%;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;color:var(--text,#e9edef);font:14px system-ui,sans-serif}"+
"#lplant .inf small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute,#8696a0)}"+
"#lplant .inf b{display:block;font-size:20px;font-weight:700;margin:2px 0 2px}"+
"#lplant .inf em{display:block;font-style:normal;font-size:13.5px;font-weight:600;color:var(--g,#00a884)}"+
"#lplant .inf p{margin:6px 0 0;font-size:12.5px;line-height:1.4;color:var(--mute,#8696a0)}"+
"#lplant .bar{height:6px;border-radius:3px;background:rgba(128,150,160,.25);overflow:hidden;margin-bottom:5px}"+
"#lplant .bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#4caf50,#ff8fb3);transition:width .8s}"+
"#lplant .cnt{font-size:11.5px;color:var(--mute,#8696a0);margin-bottom:8px}"+
"#lplant .pw{pointer-events:auto;display:flex;align-items:center;justify-content:center;gap:7px;width:100%;border:0;border-radius:22px;padding:10px 12px;font:600 14px system-ui,sans-serif;color:#fff;background:var(--g,#00a884);cursor:pointer}"+
"#lplant .pw svg{width:20px;height:20px}"+
"#lplant .pw.off{background:rgba(128,150,160,.28);color:var(--mute,#8696a0)}"+
"#lplant .pw:active{transform:scale(.98)}"+
"#lplant .say{position:absolute;left:14px;top:12px;max-width:46%;padding:7px 11px;border-radius:12px;background:rgba(0,0,0,.55);color:#fff;font:500 12.5px/1.35 system-ui,sans-serif;opacity:0;transform:translateY(4px);transition:opacity .25s,transform .25s;pointer-events:none}"+
"#lplant .say.on{opacity:1;transform:none}";
  document.head.appendChild(s);
}
const CAN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9h10v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 12l5-4"/><path d="M5 11H3.5a1.5 1.5 0 0 0 0 3H5"/><path d="M20 8l1.5-1.5M18 15v2M21 14v2" /></svg>';

let box=null,card=null,cv=null,ctx=null,W=0,H=0,S=1,dpr=1,raf=0,last=0,T=0;
let els={};
let shownC=0,shownM=1,wAnim=0,drops=[],petals=[],sparks=[],fly={x:0,y:0,t:0},bloomPop=0,sayT=0,resetT=0,wantC=0,grow=0;

function say(t){els.say.textContent=t;els.say.classList.add("on");clearTimeout(sayT);sayT=setTimeout(()=>els.say.classList.remove("on"),2800)}

function refreshText(){
  const c=careDays(),[st,note]=stageOf(c);
  const m=moisture(),wt=wateredToday();
  els.day.textContent="Day "+Math.min(DAYS,calDay());
  els.stage.textContent=st;
  els.note.textContent=note;
  els.bar.style.width=Math.round(c/DAYS*100)+"%";
  els.cnt.textContent="Care days "+c+" of "+DAYS;
  let btn="Water",off=false,status="";
  if(c>=DAYS){btn="Plant a new seed";status=""}
  else if(wt){btn="Watered today";off=true;status="Come back tomorrow."}
  else if(m<.3)status="Thirsty. Please water me.";
  else status="Needs water today.";
  els.btnT.textContent=btn;els.btn.classList.toggle("off",off);
  els.em.textContent=status;
}

function water(){
  const c=careDays();
  if(c>=DAYS){say("In full bloom. Enjoy the flowers.");fly.t=0;return}
  if(wateredToday()){say("The soil is still moist. Once a day is enough.");return}
  data.cared.push(todayStr());data.last=Date.now();save();
  wAnim=.0001;wantC=careDays();
  if(wantC>=DAYS)setTimeout(()=>{bloomPop=1;for(let i=0;i<26;i++)sparks.push({x:px()+rnd(-40,40)*S,y:H*.35+rnd(-30,30)*S,vx:rnd(-60,60)*S,vy:rnd(-90,-20)*S,l:rnd(.8,1.6)});say("Day "+DAYS+". Your flower has bloomed!")},2300);
  else say(careDays()<=1?"Thank you. Growing already.":"Nice. A little taller today.");
  refreshText();kick();
}
function onBtn(){
  if(careDays()>=DAYS){
    if(resetT){clearTimeout(resetT);resetT=0;data={start:todayStr(),cared:[],last:0};save();shownC=0;wantC=0;shownM=1;refreshText();say("A new seed is planted.");return}
    els.btnT.textContent="Tap again to confirm";resetT=setTimeout(()=>{resetT=0;refreshText()},3200);return;
  }
  water();
}

/* ---------- geometry ---------- */
const px=()=>W*.27;
const soilY=()=>H-40*S;
const hMax=()=>Math.min(soilY()-34*S,158*S);
function mix(a,b,t){const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));const A=p(a),B=p(b);return "rgb("+A.map((v,i)=>Math.round(lerp(v,B[i],t))).join(",")+")"}

/* ---------- drawing ---------- */
function plantPose(c,m,sway){
  const bx=px(),by=soilY(),hm=hMax();
  const h=lerp(14*S,hm,Math.pow(clamp(c/24,0,1),.85));
  const droop=m;                                         // 0 healthy .. 1 wilted
  const tipX=bx+5*S+sway*(h/hm)*2.2*S+droop*30*S*(h/hm+.15);
  const tipY=by-h*(1-.14*droop);
  const cx=bx-7*S+droop*8*S,cy=by-h*.55;
  const P=t=>{const u=1-t;return {x:u*u*bx+2*u*t*cx+t*t*tipX,y:u*u*by+2*u*t*cy+t*t*tipY}};
  return {bx,by,h,hm,tipX,tipY,cx,cy,P};
}
function leaf(x,y,ang,L,col,vein){
  const w=L*.42;
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(L*.5,-w,L,0);ctx.quadraticCurveTo(L*.5,w,0,0);ctx.fill();
  ctx.strokeStyle=vein;ctx.lineWidth=Math.max(.8,L*.04);ctx.beginPath();ctx.moveTo(L*.05,0);ctx.lineTo(L*.9,0);ctx.stroke();
  ctx.restore();
}
function drawPot(wet){
  const x=px(),y=soilY();
  // shadow
  ctx.fillStyle="rgba(0,0,0,.18)";ctx.beginPath();ctx.ellipse(x,H-6*S,44*S,5*S,0,0,6.28);ctx.fill();
  // pot body
  ctx.fillStyle="#c9714f";ctx.beginPath();ctx.moveTo(x-34*S,y);ctx.lineTo(x+34*S,y);ctx.lineTo(x+25*S,H-8*S);ctx.lineTo(x-25*S,H-8*S);ctx.closePath();ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.12)";ctx.beginPath();ctx.moveTo(x-30*S,y+4*S);ctx.lineTo(x-22*S,y+4*S);ctx.lineTo(x-17*S,H-12*S);ctx.lineTo(x-23*S,H-12*S);ctx.fill();
  // soil
  ctx.fillStyle=mix("#a67c52","#4a3224",wet);ctx.beginPath();ctx.ellipse(x,y,36*S,8*S,0,0,6.28);ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.18)";for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(x-26*S+i*8.5*S,y+(i%2?2:-1)*S,1.2*S,0,6.28);ctx.fill()}
  // rim
  ctx.fillStyle="#d98560";rr(x-38*S,y-5*S,76*S,10*S,4*S);ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.18)";rr(x-36*S,y-4*S,72*S,2.5*S,2*S);ctx.fill();
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}

function flower(x,y,f){
  const R=26*S*(.3+.7*f),n=10;
  // sepals
  ctx.fillStyle="#3f9a4a";for(let i=0;i<5;i++){ctx.save();ctx.translate(x,y);ctx.rotate(i*1.2566+Math.PI/2);ctx.beginPath();ctx.ellipse(0,R*.35,R*.12,R*.3,0,0,6.28);ctx.fill();ctx.restore()}
  const rot=Math.sin(T*.3)*.06;
  [[1,0],[.82,Math.PI/n]].forEach(([k,off],layer)=>{
    for(let i=0;i<n;i++){
      ctx.save();ctx.translate(x,y);ctx.rotate(i*(6.2832/n)+off+rot);
      const len=R*k,wid=R*.26*k*(.55+.45*f);
      const g=ctx.createLinearGradient(0,0,0,-len);g.addColorStop(0,layer?"#ffd5e3":"#ffe9f0");g.addColorStop(.55,layer?"#ffa9c6":"#ffc2d6");g.addColorStop(1,layer?"#ff7fa9":"#ff8fb3");
      ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-R*.1);ctx.bezierCurveTo(wid*1.3,-len*.35,wid*1.1,-len*.85,0,-len);ctx.bezierCurveTo(-wid*1.1,-len*.85,-wid*1.3,-len*.35,0,-R*.1);ctx.fill();
      ctx.strokeStyle="rgba(190,60,110,.28)";ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,-R*.15);ctx.lineTo(0,-len*.8);ctx.stroke();
      ctx.restore();
    }
  });
  // centre
  const cr=R*.26*(.6+.4*f);
  ctx.fillStyle="#ffcf3d";ctx.beginPath();ctx.arc(x,y,cr,0,6.28);ctx.fill();
  ctx.fillStyle="#e39a12";for(let i=0;i<9;i++){const a=i*.7;ctx.beginPath();ctx.arc(x+Math.cos(a)*cr*.55*(i%3?1:.4),y+Math.sin(a)*cr*.55*(i%3?1:.4),cr*.14,0,6.28);ctx.fill()}
}

function drawPlant(){
  const c=shownC,m=clamp((.45-shownM)/.45,0,1),sway=Math.sin(T*1.25)+Math.sin(T*.7)*.5;
  const p=plantPose(c,m,RM?0:sway);
  const yel=clamp(m*.85+(data.last&&Date.now()-data.last>60*36e5?.25:0),0,1);
  const stemCol=mix("#3f9a4a","#9aa34a",yel),stemW=(2.4+3.4*clamp(c/20,0,1))*S;
  // side shoots
  [[-1,56,12],[1,84,15]].forEach(([dir,nh,c0])=>{
    const g=clamp((c-c0)/9,0,1);if(g<=0||nh*S>p.h-8*S)return;
    const t=clamp(nh*S/p.h,0,1),o=p.P(t);
    const ang=dir*(.95+m*.5),len=34*S*ease(g);
    const ex=o.x+Math.sin(ang)*len,ey=o.y-Math.cos(ang)*len*(1-.5*m);
    ctx.strokeStyle=stemCol;ctx.lineWidth=stemW*.55;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.quadraticCurveTo((o.x+ex)/2,o.y-6*S,ex,ey);ctx.stroke();
    const lc=mix("#49a652","#b3b24f",yel*.9);
    leaf(ex,ey,-Math.PI/2+dir*.9+m*dir*.9,13*S*ease(g),lc,"rgba(255,255,255,.35)");
    leaf(ex,ey,-Math.PI/2-dir*.1+dir*.3+m*dir*.8,11*S*ease(g),lc,"rgba(255,255,255,.35)");
  });
  // stem
  ctx.strokeStyle=stemCol;ctx.lineWidth=stemW;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(p.bx,p.by);ctx.quadraticCurveTo(p.cx,p.cy,p.tipX,p.tipY);ctx.stroke();
  // leaf pairs along the stem
  const K=7;
  for(let k=0;k<K;k++){
    const born=1.5+k*3.4,a=clamp((c-born)/6,0,1);if(a<=0)continue;
    const nh=(18+k*19)*S;if(nh>p.h-5*S)continue;
    const o=p.P(clamp(nh/p.h,0,1)),L=(13+14*(1-k/K*.45))*S*ease(a)*(.8+.2*clamp(c/20,0,1));
    const lc=mix(k%2?"#49a652":"#3f9a4a","#b3b24f",yel*.9);
    const base=(1.05-k*.045)+m*.55;
    const w=Math.sin(T*1.7+k)*.045*(RM?0:1);
    leaf(o.x,o.y,-Math.PI/2+base+w,L,lc,"rgba(255,255,255,.35)");
    leaf(o.x,o.y,-Math.PI/2-base-w+Math.PI*0,L,lc,"rgba(255,255,255,.35)");
  }
  // seed leaves (cotyledons) at the very start
  if(c<10){
    const a=1-clamp((c-5)/5,0,1),L=11*S*a;
    if(a>0){const lc=mix("#6cc070","#c1c56a",yel);ctx.fillStyle=lc;
      [-1,1].forEach(d=>{ctx.beginPath();ctx.ellipse(p.P(.5).x+d*8*S*(1+m*.3),p.P(.5).y+m*4*S,L*.8,L*.45,d*(.3+m*.6),0,6.28);ctx.fill()})}
  }
  // growing tip pair until the bud forms
  if(c<20){
    const L=(6+Math.min(c,18)*.55)*S;
    const lc=mix("#6cc070","#c1c56a",yel);
    leaf(p.tipX,p.tipY,-Math.PI/2+.45+m*.9,L,lc,"rgba(255,255,255,.35)");
    leaf(p.tipX,p.tipY,-Math.PI/2-.45-m*.9,L,lc,"rgba(255,255,255,.35)");
  }
  // bud, then flower
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

function drawCan(p){
  // watering can tilts over the plant while watering
  if(wAnim<=0)return;
  const t=wAnim,tilt=ease(Math.min(1,t/.5))*(t>1.7?clamp(1-(t-1.7)/.4,0,1):1);
  const x=p.bx+60*S,y=clamp(p.tipY-50*S,34*S,soilY()-70*S);
  ctx.save();ctx.translate(x,y);ctx.rotate(-.55*tilt);ctx.globalAlpha=clamp(Math.min(t/.25,(2.1-t)/.3),0,1);
  ctx.fillStyle="#6fa8d8";rr(-4*S,-14*S,34*S,28*S,6*S);ctx.fill();
  ctx.fillStyle="#8cc0ee";rr(-4*S,-14*S,34*S,7*S,4*S);ctx.fill();
  ctx.strokeStyle="#6fa8d8";ctx.lineWidth=4.5*S;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-3*S,6*S);ctx.lineTo(-24*S,-6*S);ctx.stroke();
  ctx.fillStyle="#5b93c4";ctx.beginPath();ctx.ellipse(-26*S,-7*S,5*S,3*S,-.5,0,6.28);ctx.fill();
  ctx.strokeStyle="#5b93c4";ctx.lineWidth=3.2*S;ctx.beginPath();ctx.arc(30*S,0,10*S,-1.4,1.4);ctx.stroke();
  ctx.restore();ctx.globalAlpha=1;
  // droplets from the spout
  if(t>.35&&t<1.9){
    const ax=Math.cos(-.55*tilt),ay=Math.sin(-.55*tilt);
    const sx=x+(-26*S)*ax-(-7*S)*ay,sy=y+(-26*S)*ay+(-7*S)*ax;
    if(Math.random()<.8)drops.push({x:sx+rnd(-3,3)*S,y:sy,vx:rnd(-30,-6)*S,vy:rnd(20,60)*S});
    if(Math.random()<.5)drops.push({x:sx+rnd(-3,3)*S,y:sy,vx:rnd(-30,-6)*S,vy:rnd(20,60)*S});
  }
}

function frame(now){
  raf=0;
  if(!box||box.classList.contains("hide")||document.hidden){last=0;return}
  const dt=last?Math.min(.05,(now-last)/1000):0;last=now;T+=dt;
  const wet=moisture();
  // data -> shown values (growth is animated after the water lands)
  if(wAnim>0){wAnim+=dt;if(wAnim>2.2)wAnim=0}
  const target=careDays();
  if(wAnim===0||wAnim>1.4)shownC+=(target-shownC)*Math.min(1,dt*1.1);
  if(Math.abs(target-shownC)<.002)shownC=target;
  const wetTarget=wAnim>.9||wAnim===0?wet:shownM;
  shownM+=(wetTarget-shownM)*Math.min(1,dt*1.6);
  // draw
  ctx.clearRect(0,0,W,H);
  const g=ctx.createRadialGradient(px(),H*.55,10,px(),H*.55,W*.55);g.addColorStop(0,"rgba(255,255,255,.07)");g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  drawPot(shownM);
  const p=drawPlant();
  drawCan(p);
  // droplets
  drops.forEach(d=>{d.vy+=520*S*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;if(d.y>=soilY()){d.dead=1;for(let i=0;i<2;i++)sparks.push({x:d.x,y:soilY(),vx:rnd(-30,30)*S,vy:rnd(-50,-15)*S,l:.4,w:1})}});
  drops=drops.filter(d=>!d.dead&&d.y<H);
  ctx.fillStyle="#8ccbff";drops.forEach(d=>{ctx.beginPath();ctx.ellipse(d.x,d.y,1.6*S,2.6*S,0,0,6.28);ctx.fill()});
  sparks.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt;s.vy+=(s.w?260:60)*S*dt;s.l-=dt});
  sparks=sparks.filter(s=>s.l>0);
  sparks.forEach(s=>{ctx.globalAlpha=clamp(s.l*1.5,0,1);ctx.fillStyle=s.w?"#8ccbff":"#ffe38a";ctx.beginPath();ctx.arc(s.x,s.y,(s.w?1.4:2)*S,0,6.28);ctx.fill()});ctx.globalAlpha=1;
  // after full bloom: butterfly and falling petals
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
  if(was){refreshText()}
  kick();
}
let pend=0;const soon=()=>{if(!pend)pend=requestAnimationFrame(()=>{pend=0;place()})};

export async function initListPlant(){
  for(let i=0;i<50&&!($("side")&&$("list"));i++)await new Promise(r=>setTimeout(r,100));
  const side=$("side"),list=$("list");
  if(!side||!list||$("lplant"))return;
  css();data=load();save();
  shownC=careDays();wantC=shownC;shownM=moisture();
  if(getComputedStyle(side).position==="static")side.style.position="relative";
  box=E("div");box.id="lplant";box.className="hide";box.setAttribute("aria-label","Flower plant");
  card=E("div","card");cv=E("canvas");cv.setAttribute("role","button");cv.setAttribute("aria-label","Tap to water the plant");
  ctx=cv.getContext("2d");
  const inf=E("div","inf"),top=E("div"),bot=E("div");
  els.title=E("small",null,TITLE);els.day=E("b");els.stage=E("em");els.em=E("p");els.note=E("p");
  top.append(els.title,els.day,els.stage,els.note);
  els.bar=E("i");const bar=E("div","bar");bar.appendChild(els.bar);
  els.cnt=E("div","cnt");
  els.btn=E("button","pw");els.btn.type="button";els.btn.innerHTML=CAN;els.btnT=E("span");els.btn.appendChild(els.btnT);
  bot.append(bar,els.cnt,els.em,els.btn);
  inf.append(top,bot);
  els.say=E("div","say");
  card.append(cv,inf,els.say);box.appendChild(card);side.appendChild(box);
  cv.addEventListener("pointerdown",e=>{e.preventDefault();water()});
  els.btn.addEventListener("click",e=>{e.stopPropagation();onBtn()});
  new MutationObserver(soon).observe(list,{childList:true,subtree:true});
  const res=$("res");if(res)new MutationObserver(soon).observe(res,{attributes:true,attributeFilter:["class"]});
  if(window.ResizeObserver)new ResizeObserver(soon).observe(side);
  addEventListener("resize",soon);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){refreshText();soon();kick()}});
  setInterval(()=>{refreshText();soon()},60000);
  place();
  window.__plant={get:()=>data,set:(d)=>{data=d;save();refreshText()},water,show:(c)=>{shownC=c},get c(){return shownC}};
}
