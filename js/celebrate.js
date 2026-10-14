/* ===== celebrate.js: anniversary / monthsary / birthday surprise ===== */
import {doc,getDoc} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const {db}=await import("./firebase.js"+(window.V||""));

const IST=19800000;
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;
const COL=["#ff4f8b","#ff8fb3","#ffc2d6","#fff0f5","#f6d28a","#ff6fa3"];
const pad=n=>String(n).padStart(2,"0");
const ist=()=>{const t=new Date(Date.now()+IST);return{y:t.getUTCFullYear(),m:t.getUTCMonth()+1,d:t.getUTCDate()}};
const ymd=n=>n.y+"-"+pad(n.m)+"-"+pad(n.d);
const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();

function matches(ev,n){
  if(ev.active===false)return false;
  if(ev.skipMonths&&ev.skipMonths.includes(n.m))return false;
  if(ev.repeat==="yearly")return n.m===ev.month&&n.d===Math.min(ev.day,dim(n.y,ev.month));
  if(ev.repeat==="monthly")return n.d===Math.min(ev.day,dim(n.y,n.m));
  if(ev.repeat==="none")return n.y===ev.year&&n.m===ev.month&&n.d===ev.day;
  return false;
}

function since(start,n){
  const [sy,sm,sd]=start.split("-").map(Number);
  let y=n.y-sy,m=n.m-sm,d=n.d-sd;
  if(d<0){m--;d+=dim(n.m===1?n.y-1:n.y,n.m===1?12:n.m-1)}
  if(m<0){y--;m+=12}
  const total=Math.floor((Date.UTC(n.y,n.m-1,n.d)-Date.UTC(sy,sm-1,sd))/864e5);
  return{y,m,d,total,months:y*12+m};
}

function counter(ev,n){
  if(!ev.start)return null;
  const s=since(ev.start,n),p=[];
  if(s.y)p.push(s.y+" saal");
  if(s.m)p.push(s.m+" mahine");
  if(s.d)p.push(s.d+" din");
  return{main:p.length?p.join(" \u00b7 "):"Aaj se shuru",total:s.total+" din "+(ev.counterLabel||"saath")};
}

function textOf(ev,n){
  if(ev.letter)return ev.letter;
  const a=ev.messages;
  if(a&&a.length){const k=ev.start?since(ev.start,n).months:n.m;return a[k%a.length]}
  return "";
}

const opt=u=>/\/upload\//.test(u)?u.replace("/upload/","/upload/w_1000,q_auto,f_auto/"):u;

/* ---------- ek baar dikhane ka hisaab ---------- */
const SEEN="bt_cel_seen";
const seenSet=()=>{try{return new Set(JSON.parse(localStorage.getItem(SEEN)||"[]"))}catch(e){return new Set()}};
function markSeen(id,day){
  const s=[...seenSet(),id+"|"+day].slice(-80);
  try{localStorage.setItem(SEEN,JSON.stringify(s))}catch(e){}
}

async function load(uid){
  const s=await getDoc(doc(db,"celebrations",uid));
  if(!s.exists())return [];
  const j=JSON.parse(s.data().json||"[]");
  return Array.isArray(j)?j:[];
}

export async function check(uid){
  const q=new URLSearchParams(location.search),pv=q.get("cel");
  if(pv){                                   // admin preview: ?cel=<uid>&n=0
    try{
      const evs=await load(pv),ev=evs[+(q.get("n")||0)];
      if(ev)await play(ev,true,ist());
    }catch(e){}
    return;
  }
  const n=ist(),day=ymd(n);
  let ch=null;try{ch=JSON.parse(localStorage.getItem("bt_cel")||"null")}catch(e){}
  if(ch&&ch.day===day&&ch.uid===uid&&!ch.pending)return;      // aaj kuch nahi: koi read nahi
  let evs;try{evs=await load(uid)}catch(e){return}              // offline: baad mein
  const seen=seenSet();
  const due=evs.filter(e=>matches(e,n)&&!seen.has((e.id||e.title)+"|"+day))
               .sort((a,b)=>(a.priority||5)-(b.priority||5));
  try{localStorage.setItem("bt_cel",JSON.stringify({day,uid,pending:due.length>0}))}catch(e){}
  for(const ev of due)await play(ev,false,n);
  try{localStorage.setItem("bt_cel",JSON.stringify({day,uid,pending:false}))}catch(e){}
}

/* ---------- effects: aatishbaazi, confetti, hearts, patiyan ---------- */
function startFx(cv,pt,list){
  const c=cv.getContext("2d");
  let W=0,H=0,ps=[],next=0,raf=0,iv=0,run=true;
  const size=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight};
  size();addEventListener("resize",size);
  const burst=(x,y)=>{
    const col=COL[Math.random()*COL.length|0];
    for(let i=0;i<46;i++){const a=6.283*i/46,s=1.5+Math.random()*3.2;ps.push({t:"f",x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,c:col})}
  };
  const conf=k=>{
    for(let i=0;i<k;i++)ps.push({t:Math.random()<.5?"h":"r",x:Math.random()*W,y:-12,vx:(Math.random()-.5)*2,vy:1+Math.random()*2.5,l:1,c:COL[Math.random()*COL.length|0],r:Math.random()*6,s:10+Math.random()*10});
  };
  const loop=t=>{
    if(!run)return;
    c.clearRect(0,0,W,H);
    if(list.includes("fireworks")&&t>next){burst(W*(.15+Math.random()*.7),H*(.1+Math.random()*.35));next=t+800+Math.random()*900}
    ps=ps.filter(p=>p.l>0);
    for(const p of ps){
      if(p.t==="f"){
        p.vy+=.03;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.l-=.012;
        c.globalAlpha=Math.max(p.l,0);c.fillStyle=p.c;c.beginPath();c.arc(p.x,p.y,2.2,0,6.3);c.fill();
      }else{
        p.x+=p.vx;p.y+=p.vy;p.r+=.05;if(p.y>H+20)p.l=0;
        c.globalAlpha=1;c.fillStyle=p.c;
        if(p.t==="h"){c.font=p.s+"px serif";c.fillText("\u2665",p.x,p.y)}
        else{c.save();c.translate(p.x,p.y);c.rotate(p.r);c.fillRect(-3,-2,6,4);c.restore()}
      }
    }
    c.globalAlpha=1;raf=requestAnimationFrame(loop);
  };
  if(!RM){
    if(list.includes("confetti")){conf(70);iv=setInterval(()=>conf(5),700)}
    if(list.includes("petals"))for(let i=0;i<16;i++){
      const e=document.createElement("i"),s=8+Math.random()*9;
      e.style.cssText="left:"+Math.random()*100+"%;width:"+s+"px;height:"+s*1.35+"px;--x:"+(Math.random()*80-40)+"px;animation-duration:"+(9+Math.random()*8)+"s;animation-delay:-"+Math.random()*12+"s";
      pt.appendChild(e);
    }
    raf=requestAnimationFrame(loop);
  }
  return()=>{run=false;cancelAnimationFrame(raf);clearInterval(iv);removeEventListener("resize",size)};
}

/* ---------- steps ---------- */
function hero(ev,n,b,next,last){
  const c=counter(ev,n);
  b.innerHTML='<div class="h1"></div><div class="hn"></div>'+(c?'<div class="hc"><b></b><span></span></div>':'')+'<button class="cbn" type="button"></button>';
  b.querySelector(".h1").textContent=ev.title||"Happy Anniversary";
  b.querySelector(".hn").textContent=ev.name||"";
  if(c){b.querySelector(".hc b").textContent=c.main;b.querySelector(".hc span").textContent=c.total}
  const btn=b.querySelector(".cbn");btn.textContent=last?"Close":"Aage \u2665";btn.onclick=next;
}

function photosStep(ev,n,b,next,last){
  const ph=ev.photos;
  let k=0,t=0,sx=0;
  b.innerHTML='<div class="ps"><img alt=""><div class="pc"></div></div><div class="pd"></div><button class="cbn" type="button"></button>';
  const img=b.querySelector("img"),cap=b.querySelector(".pc"),dots=b.querySelector(".pd"),btn=b.querySelector(".cbn"),box=b.querySelector(".ps");
  ph.forEach(()=>dots.appendChild(document.createElement("i")));
  const show=j=>{
    k=(j+ph.length)%ph.length;
    const p=ph[k],im=new Image();
    img.style.opacity=0;
    im.onload=()=>{img.src=im.src;img.style.opacity=1};
    im.src=opt(p.url);
    cap.textContent=[p.date,p.caption].filter(Boolean).join(" \u00b7 ");
    [...dots.children].forEach((d,x)=>d.classList.toggle("on",x===k));
  };
  const auto=()=>{clearInterval(t);t=setInterval(()=>show(k+1),4200)};
  show(0);if(ph.length>1)auto();
  box.addEventListener("touchstart",e=>{sx=e.touches[0].clientX},{passive:true});
  box.addEventListener("touchend",e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){show(k+(dx<0?1:-1));auto()}});
  btn.textContent=last?"Close":"Aage \u2665";btn.onclick=next;
  return()=>clearInterval(t);
}

function letterStep(ev,n,b,next,last){
  const text=textOf(ev,n),chars=Array.from(text);
  b.innerHTML='<div class="lt"><p class="lp"></p></div><button class="cbn" type="button"></button>';
  const lt=b.querySelector(".lt"),p=b.querySelector(".lp"),btn=b.querySelector(".cbn");
  btn.textContent=last?"Close":"Aage \u2665";btn.onclick=next;
  let i=0,tm=0;
  const tick=()=>{
    i++;p.textContent=chars.slice(0,i).join("");lt.scrollTop=lt.scrollHeight;
    if(i<chars.length)tm=setTimeout(tick,chars[i-1]==="\n"?260:26);
  };
  if(RM)p.textContent=text;else tick();
  lt.onclick=()=>{clearTimeout(tm);i=chars.length;p.textContent=text};      // tap: poora dikhao
  return()=>clearTimeout(tm);
}

/* ---------- screen ---------- */
function css(){
  if(document.getElementById("celcss"))return;
  const s=document.createElement("style");s.id="celcss";
  s.textContent=`
.cel{position:fixed;inset:0;z-index:80;color:#fff;font-family:"Cormorant Garamond",Georgia,serif;overflow:hidden;display:flex;flex-direction:column;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);animation:celin .6s ease}
.cel *{box-sizing:border-box}
@keyframes celin{from{opacity:0}}
.csky{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 105%,#ff8db4 0%,#d63b7c 26%,#6b1647 58%,#1f0718 100%)}
.cfx,.cpt{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.cpt{overflow:hidden}
.cpt i{position:absolute;top:-6vh;border-radius:100% 0 100% 0;background:#ffb3cf;opacity:.7;animation:celfall linear infinite}
@keyframes celfall{to{transform:translate(var(--x),112vh) rotate(480deg)}}
.cx{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:12px;z-index:5;width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.3);color:#fff;font-size:17px;cursor:pointer}
.cbody{position:relative;z-index:3;flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:56px 22px 26px;text-align:center;opacity:0;transform:translateY(10px);transition:opacity .6s,transform .6s}
.cbody.in{opacity:1;transform:none}
.h1{letter-spacing:.14em;text-transform:uppercase;font-size:15px;color:#ffd1e1}
.hn{font-family:"Great Vibes","Brush Script MT",cursive;font-size:clamp(46px,16vw,84px);line-height:1.15;color:#ffe3ee;text-shadow:0 0 18px rgba(255,79,139,.85),0 2px 8px rgba(0,0,0,.35)}
.hc{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:18px;padding:12px 22px}
.hc b{display:block;font-size:24px}
.hc span{font-size:15px;color:#ffd1e1}
.cbn{border:0;border-radius:40px;padding:13px 38px;font:600 19px "Cormorant Garamond",Georgia,serif;color:#fff;background:linear-gradient(180deg,#ff8fb3,#ff4f8b);box-shadow:0 8px 26px rgba(255,79,139,.55);cursor:pointer}
.cbn:focus-visible,.cx:focus-visible{outline:3px solid #fff;outline-offset:3px}
.ps{position:relative;width:min(88vw,380px);aspect-ratio:3/4;max-height:62vh;border-radius:16px;overflow:hidden;background:rgba(0,0,0,.35);box-shadow:0 10px 36px rgba(0,0,0,.45)}
.ps img{width:100%;height:100%;object-fit:cover;display:block;transition:opacity .5s}
.pc{position:absolute;left:0;right:0;bottom:0;padding:26px 14px 12px;background:linear-gradient(transparent,rgba(0,0,0,.65));font-size:17px}
.pd{display:flex;gap:6px;justify-content:center}
.pd i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.35)}
.pd i.on{background:#fff}
.lt{width:min(90vw,420px);max-height:64vh;overflow-y:auto;text-align:left;font-size:20px;line-height:1.6;background:rgba(0,0,0,.22);border-radius:16px;padding:16px 18px;text-shadow:0 1px 8px rgba(60,0,30,.6)}
.lp{margin:0;white-space:pre-line}`;
  document.head.appendChild(s);
  const l=document.createElement("link");l.rel="stylesheet";
  l.href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,600;1,500&display=swap";
  document.head.appendChild(l);
}

function play(ev,preview,n){
  return new Promise(done=>{
    css();
    const el=document.createElement("div");el.className="cel";
    el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","Surprise");
    el.innerHTML='<div class="csky"></div><div class="cpt"></div><canvas class="cfx"></canvas><button class="cx" type="button" aria-label="Close">\u2715</button><div class="cbody"></div>';
    document.body.appendChild(el);
    const ovf=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";
    const body=el.querySelector(".cbody");
    const stop=startFx(el.querySelector(".cfx"),el.querySelector(".cpt"),ev.effects||["fireworks","confetti","petals"]);
    const steps=[hero];
    if(Array.isArray(ev.photos)&&ev.photos.length)steps.push(photosStep);
    if(textOf(ev,n))steps.push(letterStep);
    if(ev.gift&&window.__celGift)steps.push(window.__celGift);      // Part 2: band lifafa
    let i=0,clean=()=>{},closed=false;
    const finish=()=>{
      if(closed)return;closed=true;clean();stop();el.remove();
      document.documentElement.style.overflow=ovf;
      if(!preview)markSeen(ev.id||ev.title,ymd(n));
      done();
    };
    const go=()=>{
      clean();body.classList.remove("in");
      const last=i===steps.length-1;
      clean=steps[i](ev,n,body,()=>{if(last)finish();else{i++;go()}},last)||(()=>{});
      void body.offsetWidth;body.classList.add("in");
    };
    el.querySelector(".cx").onclick=finish;
    go();
  });
}