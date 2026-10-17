/* ===== celebrate.js: anniversary / monthsary / birthday surprise ===== */
import {doc,getDoc} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const {db}=await import("./firebase.js"+(window.V||""));

const IST=19800000;
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ---------- TEMPLATES: har type ka apna rang, effect, heading ---------- */
const T={
anniversary:{
  title:"Happy Anniversary",btn:"Aage \u2665",lbl:"saath",emoji:"\u2764",glyph:"\u2665",
  fx:["fireworks","confetti","petals"],
  col:["#ff4f8b","#ff8fb3","#ffc2d6","#fff0f5","#f6d28a","#ff6fa3"],
  v:{sky:"radial-gradient(120% 70% at 50% 105%,#ff8db4 0%,#d63b7c 26%,#6b1647 58%,#1f0718 100%)",petal:"#ffb3cf",acc1:"#ff8fb3",acc2:"#ff4f8b",deep:"#c43a74",glow:"rgba(255,79,139,.85)",soft:"#ffd1e1",name:"#ffe3ee",btnc:"#fff",card1:"#ffd9e6",card2:"#ff8fb3",card3:"#d63b7c",ink:"#4a0f35"},
  th:{g:"#ff4f8b",bar:"linear-gradient(90deg,#ff4f8b,#ff8fb3)",
    d:["#190812","#2b1020","#3d1a2d","#8f2456","#2f1424","#1d0a15","rgba(255,120,170,.10)"],
    l:["#fff7fa","#ffe6ef","#f6cfdc","#ffc9dc","#fff","#ffeaf2","rgba(214,59,124,.08)"]}},
birthday:{
  title:"Happy Birthday",btn:"Aage \ud83c\udf82",lbl:"ki zindagi",emoji:"\ud83c\udf82",glyph:"\ud83c\udf88",
  fx:["fireworks","confetti","balloons"],
  col:["#ffd166","#ff7a45","#4cc9f0","#7bf1a8","#ff5e8a","#c77dff"],
  v:{sky:"radial-gradient(120% 70% at 50% 110%,#ffb347 0%,#ff5e8a 28%,#6a2c91 60%,#150a2e 100%)",petal:"#ffd166",acc1:"#ffd166",acc2:"#ff9f45",deep:"#a63d8f",glow:"rgba(255,209,102,.85)",soft:"#ffe8b8",name:"#fff3d6",btnc:"#3a1230",card1:"#fff1c9",card2:"#ffc15e",card3:"#ff7a8a",ink:"#4a1a3a"},
  th:{g:"#ffb347",bar:"linear-gradient(90deg,#ff9f45,#ff5e8a)",
    d:["#1a1024","#2a1a38","#3f2955","#a2561f","#2c1a3a","#170d22","rgba(255,190,90,.10)"],
    l:["#fffaf0","#fff0d4","#f5deb0","#ffe0a3","#fff","#fff4df","rgba(255,150,40,.10)"]}},
monthsary:{
  title:"Happy Monthsary",btn:"Aage \u2661",lbl:"saath",emoji:"\ud83d\udc9c",glyph:"\u2665",
  fx:["petals","hearts"],
  col:["#cdb4ff","#ffc2e2","#bde0fe","#ffffff"],
  v:{sky:"radial-gradient(120% 70% at 50% 105%,#cdb4ff 0%,#8f7bd8 30%,#3b2f7a 62%,#150f33 100%)",petal:"#d9c8ff",acc1:"#cdb4ff",acc2:"#8f7bd8",deep:"#6b57c4",glow:"rgba(205,180,255,.85)",soft:"#e6dcff",name:"#f3edff",btnc:"#1d1245",card1:"#efe7ff",card2:"#cdb4ff",card3:"#9a86e0",ink:"#2a1c5c"},
  th:{g:"#b69cff",bar:"linear-gradient(90deg,#8f7bd8,#cdb4ff)",
    d:["#14102a","#211a42","#322a5c","#5a46a8","#241c44","#110d26","rgba(190,170,255,.10)"],
    l:["#faf7ff","#ece4ff","#dcd0f8","#d9ccff","#fff","#f1ebff","rgba(120,90,210,.08)"]}},
custom:{
  title:"Surprise",btn:"Aage \u2192",lbl:"",emoji:"\u2728",glyph:"\u2726",
  fx:["confetti"],
  col:["#7fd1ff","#3f8cff","#ffffff","#ffd166"],
  v:{sky:"radial-gradient(120% 70% at 50% 105%,#3a4b6b 0%,#1f2a44 45%,#0b0f1c 100%)",petal:"#9cc8ff",acc1:"#7fd1ff",acc2:"#3f8cff",deep:"#2d5fb8",glow:"rgba(127,209,255,.7)",soft:"#cfe6ff",name:"#eaf4ff",btnc:"#08183a",card1:"#e5f1ff",card2:"#9cc8ff",card3:"#4f86e0",ink:"#12264a"},
  th:{g:"#5aa9ff",bar:"linear-gradient(90deg,#2d6cdf,#5aa9ff)",
    d:["#0f1624","#19243a","#27344f","#2a5aa8","#1b2740","#0c121e","rgba(120,170,255,.08)"],
    l:["#f6f9ff","#e3edff","#cfdcf4","#cfe2ff","#fff","#edf3ff","rgba(60,120,220,.08)"]}}
};
function tplKey(ev){
  if(ev&&T[ev.template])return ev.template;                 // admin ne chuna
  if(ev&&ev.repeat==="monthly")return "monthsary";          // purane events: andaza
  if(ev&&/birth/i.test((ev.title||"")+" "+(ev.name||"")))return "birthday";
  return "anniversary";
}
const tplOf=ev=>T[tplKey(ev)];
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
  const s=since(ev.start,n),k=tplKey(ev),p=[];
  let main;
  if(k==="birthday")main=s.y?s.y+" saal":(s.m?s.m+" mahine":"Aaj janam din");      // umar
  else if(k==="monthsary")main=s.months?s.months+" mahine":"Aaj se shuru";
  else{
    if(s.y)p.push(s.y+" saal");
    if(s.m)p.push(s.m+" mahine");
    if(s.d)p.push(s.d+" din");
    main=p.length?p.join(" \u00b7 "):"Aaj se shuru";
  }
  const lbl=ev.counterLabel!=null&&ev.counterLabel!==""?ev.counterLabel:T[k].lbl;
  return{main,lbl,total:s.total+" din"+(lbl?" "+lbl:"")};
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
  const d=s.data();
  if(d.themeOn===false)return [];                     // admin ne apne liye theme band kiya
  let j=[];
  if(d.by&&typeof d.by==="object"){                   // admin ka mirror: har chat ka alag hissa
    for(const k of Object.keys(d.by)){
      try{const a=JSON.parse(d.by[k]||"[]");if(Array.isArray(a))j=j.concat(a)}catch(e){}
    }
  }else{try{j=JSON.parse(d.json||"[]")}catch(e){j=[]}}
  return Array.isArray(j)?j:[];
}

const TH="bt_cel_th";
function note(t){
  const e=document.getElementById("toast");if(!e)return;
  e.textContent=t;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),4000);
}
const FRESH=10*60*1000;                              // cache 10 minute: admin ka badlav jaldi dikhe

function themeOf(t,n){
  const c=counter(t,n),k=tplKey(t),tp=T[k];
  return{id:t.id||t.title,theme:k,glyph:tp.glyph,banner:t.banner||((t.title||tp.title)+" "+tp.emoji),sub:c?c.main+(c.lbl?" "+c.lbl:""):""};
}
function themeFor(evs,n){
  const t=evs.filter(e=>matches(e,n)&&e.chatTheme!==false)
             .sort((a,b)=>(a.priority||5)-(b.priority||5))[0];
  return t?themeOf(t,n):null;
}
function readTh(uid,day){
  try{const o=JSON.parse(localStorage.getItem(TH)||"null");if(o&&o.day===day&&o.uid===uid)return o.th}catch(e){}
  return null;
}
function armMidnight(uid){
  if(window.__celMid)return;
  const t=new Date(Date.now()+IST);
  const next=Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()+1)-IST;
  window.__celMid=setTimeout(()=>{window.__celMid=0;showTheme(null);check(uid)},next-Date.now()+4000);
}

export async function check(uid){
  const q=new URLSearchParams(location.search),pv=q.get("cel");
  if(pv){                                   // admin preview: ?cel=<uid>&n=0  (&theme=1 se theme bhi)
    try{
      const evs=await load(pv),ev=evs[+(q.get("n")||0)];
      if(ev){
        if(q.get("theme"))showTheme(themeOf(ev,ist()));
        if(ev.surprise!==false||q.get("force"))await play(ev,true,ist());
        else note("Surprise screen is OFF for this event (theme only)");
      }
    }catch(e){}
    return;
  }
  const n=ist(),day=ymd(n);
  showTheme(readTh(uid,day));                // pehle cache se: koi read nahi
  armMidnight(uid);
  let ch=null;try{ch=JSON.parse(localStorage.getItem("bt_cel")||"null")}catch(e){}
  if(ch&&ch.day===day&&ch.uid===uid&&!ch.pending&&ch.th&&Date.now()-(ch.at||0)<FRESH)return;      // aaj ka kaam ho chuka
  let evs;try{evs=await load(uid)}catch(e){return}                     // offline: baad mein
  const th=themeFor(evs,n);
  try{localStorage.setItem(TH,JSON.stringify({day,uid,th}))}catch(e){}
  showTheme(th);
  const seen=seenSet();
  const due=evs.filter(e=>e.surprise!==false&&matches(e,n)&&!seen.has((e.id||e.title)+"|"+day))
               .sort((a,b)=>(a.priority||5)-(b.priority||5));
  try{localStorage.setItem("bt_cel",JSON.stringify({day,uid,pending:due.length>0,th:1,at:Date.now()}))}catch(e){}
  for(const ev of due)await play(ev,false,n);
  try{localStorage.setItem("bt_cel",JSON.stringify({day,uid,pending:false,th:1,at:Date.now()}))}catch(e){}
}

/* ---------- effects: aatishbaazi, confetti, hearts, patiyan, gubbare ---------- */
function startFx(cv,pt,list,tp){
  const COL=tp.col,c=cv.getContext("2d");
  let W=0,H=0,ps=[],next=0,raf=0,iv=0,iv2=0,run=true;
  const size=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight};
  size();addEventListener("resize",size);
  const pick=()=>COL[Math.random()*COL.length|0];
  const burst=(x,y)=>{
    const col=pick();
    for(let i=0;i<46;i++){const a=6.283*i/46,s=1.5+Math.random()*3.2;ps.push({t:"f",x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,c:col})}
  };
  const conf=k=>{
    for(let i=0;i<k;i++)ps.push({t:(tp.glyph&&tp.glyph.length===1&&Math.random()<.5)?"h":"r",x:Math.random()*W,y:-12,vx:(Math.random()-.5)*2,vy:1+Math.random()*2.5,l:1,c:pick(),r:Math.random()*6,s:10+Math.random()*10});
  };
  const heart=k=>{
    for(let i=0;i<k;i++)ps.push({t:"h",x:Math.random()*W,y:H+10,vx:(Math.random()-.5)*.8,vy:-(.8+Math.random()*1.2),l:1,c:pick(),r:0,s:12+Math.random()*10,up:1});
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
        p.x+=p.vx;p.y+=p.vy;p.r+=.05;
        if(p.up){p.l-=.004;c.globalAlpha=Math.max(Math.min(p.l,.8),0)}else{c.globalAlpha=1;if(p.y>H+20)p.l=0}
        c.fillStyle=p.c;
        if(p.t==="h"){c.font=p.s+"px serif";c.fillText("\u2665",p.x,p.y)}
        else{c.save();c.translate(p.x,p.y);c.rotate(p.r);c.fillRect(-3,-2,6,4);c.restore()}
      }
    }
    c.globalAlpha=1;raf=requestAnimationFrame(loop);
  };
  if(!RM){
    if(list.includes("confetti")){conf(70);iv=setInterval(()=>conf(5),700)}
    if(list.includes("hearts")){heart(6);iv2=setInterval(()=>heart(1),900)}
    if(list.includes("petals"))for(let i=0;i<16;i++){
      const e=document.createElement("i"),s=8+Math.random()*9;
      e.style.cssText="left:"+Math.random()*100+"%;width:"+s+"px;height:"+s*1.35+"px;--x:"+(Math.random()*80-40)+"px;animation-duration:"+(9+Math.random()*8)+"s;animation-delay:-"+Math.random()*12+"s";
      pt.appendChild(e);
    }
    if(list.includes("balloons"))for(let i=0;i<11;i++){
      const e=document.createElement("i"),w=26+Math.random()*20;
      e.className="b";
      e.style.cssText="left:"+(Math.random()*92)+"%;width:"+w+"px;height:"+w*1.22+"px;background:"+pick()+";--x:"+(Math.random()*70-35)+"px;--r:"+(Math.random()*30-15)+"deg;animation-duration:"+(8+Math.random()*7)+"s;animation-delay:-"+Math.random()*12+"s";
      pt.appendChild(e);
    }
    raf=requestAnimationFrame(loop);
  }
  return()=>{run=false;cancelAnimationFrame(raf);clearInterval(iv);clearInterval(iv2);removeEventListener("resize",size)};
}

/* ---------- steps ---------- */
const CAKE='<svg class="cake" viewBox="0 0 120 110" width="150" height="138" aria-hidden="true">'
 +'<ellipse cx="60" cy="102" rx="52" ry="6" fill="rgba(0,0,0,.25)"/>'
 +'<rect x="12" y="62" width="96" height="38" rx="9" fill="#ff7aa8"/>'
 +'<rect x="22" y="38" width="76" height="30" rx="8" fill="#ffd0e0"/>'
 +'<path d="M12 72q8 10 16 0t16 0 16 0 16 0 16 0 16 0v-6H12z" fill="#fff6e8"/>'
 +'<path d="M22 46q7 9 14 0t14 0 14 0 14 0 14 0v-8H22z" fill="#fff6e8"/>'
 +[38,60,82].map((x,i)=>'<rect x="'+(x-3)+'" y="20" width="6" height="18" rx="2" fill="'+["#4cc9f0","#ffd166","#7bf1a8"][i]+'"/><path class="fl" style="animation-delay:-'+i*.3+'s" d="M'+x+' 7c5 5 5 10 0 12c-5-2-5-7 0-12z" fill="#ffb02e"/>').join("")
 +'</svg>';

function hero(ev,n,b,next,last){
  const c=counter(ev,n),k=tplKey(ev),tp=T[k];
  b.innerHTML=(k==="birthday"?'<div class="ckw"><div class="ckx">'+CAKE+'</div><div class="ckh">Candles par tap karo \ud83d\udd6f</div></div>':'')
    +'<div class="h1"></div><div class="hn"></div>'+(c?'<div class="hc"><b></b><span></span></div>':'')+'<button class="cbn" type="button"></button>';
  b.querySelector(".h1").textContent=ev.title||tp.title;
  b.querySelector(".hn").textContent=ev.name||"";
  if(c){b.querySelector(".hc b").textContent=c.main;b.querySelector(".hc span").textContent=c.total}
  const btn=b.querySelector(".cbn");btn.textContent=last?"Close":tp.btn;btn.onclick=next;
  const cw=b.querySelector(".ckx");
  if(cw)cw.onclick=()=>{                                  // phoonk maaro
    const out=cw.classList.toggle("out");
    b.querySelector(".ckh").textContent=out?"Wish maang li? \u2728":"Candles par tap karo \ud83d\udd6f";
  };
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
  btn.textContent=last?"Close":tplOf(ev).btn;btn.onclick=next;
  return()=>clearInterval(t);
}

function letterStep(ev,n,b,next,last){
  const text=textOf(ev,n),chars=Array.from(text);
  b.innerHTML='<div class="lt"><p class="lp"></p></div><button class="cbn" type="button"></button>';
  const lt=b.querySelector(".lt"),p=b.querySelector(".lp"),btn=b.querySelector(".cbn");
  btn.textContent=last?"Close":tplOf(ev).btn;btn.onclick=next;
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
.csky{position:absolute;inset:0;background:var(--sky)}
.cfx,.cpt{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.cpt{overflow:hidden}
.cpt i{position:absolute;top:-6vh;border-radius:100% 0 100% 0;background:var(--petal);opacity:.7;animation:celfall linear infinite}
.cpt i.b{top:auto;bottom:-16vh;border-radius:50% 50% 46% 46%/58% 58% 42% 42%;opacity:.88;animation-name:celrise}
.cpt i.b::after{content:"";position:absolute;left:50%;top:100%;width:1px;height:40px;background:rgba(255,255,255,.5)}
@keyframes celrise{to{transform:translate(var(--x),-130vh) rotate(var(--r))}}
.ckw{display:grid;gap:6px;justify-items:center}
.ckx{cursor:pointer;-webkit-tap-highlight-color:transparent}
.cake{overflow:visible;filter:drop-shadow(0 6px 14px rgba(0,0,0,.35))}
.cake .fl{transform-box:fill-box;transform-origin:50% 100%;animation:celfl2 .5s ease-in-out infinite alternate;transition:opacity .35s}
@keyframes celfl2{from{transform:scale(1,.88) skewX(-4deg)}to{transform:scale(.92,1.08) skewX(4deg)}}
.ckx.out .fl{opacity:0}
.ckh{font-style:italic;font-size:15px;color:var(--soft)}
@keyframes celfall{to{transform:translate(var(--x),112vh) rotate(480deg)}}
.cx{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));right:12px;z-index:5;width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.3);color:#fff;font-size:17px;cursor:pointer}
.cbody{position:relative;z-index:3;flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:56px 22px 26px;text-align:center;opacity:0;transform:translateY(10px);transition:opacity .6s,transform .6s}
.cbody.in{opacity:1;transform:none}
.h1{letter-spacing:.14em;text-transform:uppercase;font-size:15px;color:var(--soft)}
.hn{font-family:"Great Vibes","Brush Script MT",cursive;font-size:clamp(46px,16vw,84px);line-height:1.15;color:var(--name);text-shadow:0 0 18px var(--glow),0 2px 8px rgba(0,0,0,.35)}
.hc{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:18px;padding:12px 22px}
.hc b{display:block;font-size:24px}
.hc span{font-size:15px;color:var(--soft)}
.cbn{border:0;border-radius:40px;padding:13px 38px;font:600 19px "Cormorant Garamond",Georgia,serif;color:var(--btnc);background:linear-gradient(180deg,var(--acc1),var(--acc2));box-shadow:0 8px 26px var(--glow);cursor:pointer}
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
    const tp=tplOf(ev);
    const el=document.createElement("div");el.className="cel";
    for(const k in tp.v)el.style.setProperty("--"+k,tp.v[k]);
    el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","Surprise");
    el.innerHTML='<div class="csky"></div><div class="cpt"></div><canvas class="cfx"></canvas><button class="cx" type="button" aria-label="Close">\u2715</button><div class="cbody"></div>';
    document.body.appendChild(el);
    const ovf=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";
    const body=el.querySelector(".cbody");
    const stop=startFx(el.querySelector(".cfx"),el.querySelector(".cpt"),(Array.isArray(ev.effects)&&ev.effects.length?ev.effects:tp.fx),tp);
    const steps=[hero];
    if(Array.isArray(ev.photos)&&ev.photos.length)steps.push(photosStep);
    if(textOf(ev,n))steps.push(letterStep);
    if(ev.gift)steps.push(giftStep);
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
/* ---------- Part 2: band lifafa (digital tohfa) ---------- */
function gcss(){
  if(document.getElementById("celcss2"))return;
  const s=document.createElement("style");s.id="celcss2";
  s.textContent=`
.gh{font-family:"Great Vibes","Brush Script MT",cursive;font-size:clamp(34px,11vw,52px);color:var(--name);text-shadow:0 0 16px var(--glow)}
.gt{font-style:italic;font-size:18px;color:var(--soft);animation:celp 1.6s ease-in-out infinite}
@keyframes celp{50%{opacity:.45}}
.env{position:relative;width:min(80vw,320px);height:min(52vw,210px);border:0;padding:0;background:none;cursor:pointer;perspective:700px;animation:celfl 3s ease-in-out infinite;transition:opacity .4s .6s}
@keyframes celfl{50%{transform:translateY(-8px)}}
.env i{position:absolute;display:block}
.eb{inset:0;background:var(--deep);border-radius:8px}
.ef{inset:0;z-index:2;background:linear-gradient(135deg,var(--card2),var(--acc2));clip-path:polygon(0 0,50% 52%,100% 0,100% 100%,0 100%);border-radius:8px}
.eflap{left:0;right:0;top:0;height:58%;z-index:3;background:linear-gradient(var(--acc1),var(--acc2));clip-path:polygon(0 0,100% 0,50% 100%);transform-origin:top;transition:transform .6s ease,z-index 0s .3s}
.seal{left:50%;top:44%;width:44px;height:44px;margin:-22px 0 0 -22px;z-index:4;border-radius:50%;background:#f6d28a;color:var(--deep);font-style:normal;font-size:24px;line-height:44px;text-align:center;box-shadow:0 3px 8px rgba(0,0,0,.35);transition:opacity .3s}
.env.open{animation:none;opacity:0}
.env.open .eflap{transform:rotateX(180deg);z-index:1}
.env.open .seal{opacity:0}
.gcard{width:min(86vw,360px);border-radius:18px;padding:22px 20px;text-align:center;background:linear-gradient(145deg,var(--card1),var(--card2) 55%,var(--card3));color:var(--ink);box-shadow:0 14px 40px rgba(0,0,0,.45);display:grid;gap:10px;animation:celpop .6s cubic-bezier(.2,1.3,.4,1)}
@keyframes celpop{from{opacity:0;transform:scale(.7) translateY(30px)}}
.gcard.cp{border:2px dashed rgba(74,15,53,.5)}
.gb{font-size:26px;font-weight:700}
.ga{font-size:44px;font-weight:700;line-height:1}
.gn{font-size:18px;line-height:1.4}
.gx{font-size:14px;opacity:.8}
.gcode{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(255,255,255,.55);border-radius:12px;padding:10px 12px}
.gcode b{font:700 18px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;word-break:break-all;user-select:all;-webkit-user-select:all;text-align:left}
.gcode button{flex:none;border:0;border-radius:18px;padding:7px 14px;background:var(--deep);color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer}
.gl{display:inline-block;justify-self:center;border-radius:24px;padding:10px 26px;background:var(--ink);color:#fff;text-decoration:none;font-weight:700}`;
  document.head.appendChild(s);
}

async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}
  catch(e){
    const a=document.createElement("textarea");a.value=t;a.style.cssText="position:fixed;opacity:0";
    document.body.appendChild(a);a.select();
    let ok=false;try{ok=document.execCommand("copy")}catch(x){}
    a.remove();return ok;
  }
}

function giftStep(ev,n,b,next,last){
  gcss();
  const g=ev.gift||{};
  b.innerHTML='<div class="gh"></div><button class="env" type="button" aria-label="Open the envelope"><i class="eb"></i><i class="eflap"></i><i class="ef"></i><i class="seal">\u2665</i></button><div class="gt">Tap karke kholo</div>';
  const gh=b.querySelector(".gh"),env=b.querySelector(".env"),gt=b.querySelector(".gt");
  gh.textContent=g.envelopeText||"Ek chhota sa tohfa";
  let tm=0,opened=false;

  const showCard=()=>{
    gh.textContent=g.heading||"Tumhare liye";
    env.remove();gt.remove();
    const c=document.createElement("div");c.className="gcard"+(g.type==="coupon"?" cp":"");
    const add=(cls,txt)=>{const d=document.createElement("div");d.className=cls;d.textContent=txt;c.appendChild(d)};
    if(g.type==="coupon"){
      add("gb",g.title||"Coupon");
      if(g.note)add("gn",g.note);
      if(g.terms)add("gx",g.terms);
    }else{
      add("gb",g.brand||"Gift Card");
      if(g.amount)add("ga",g.amount);
      if(g.note)add("gn",g.note);
      if(g.code){
        const row=document.createElement("div");row.className="gcode";
        const code=document.createElement("b");code.textContent=g.code;
        const cb=document.createElement("button");cb.type="button";cb.textContent="Copy";
        cb.onclick=async()=>{cb.textContent=(await copyText(g.code))?"Copied \u2713":"Select & copy";setTimeout(()=>{cb.textContent="Copy"},2000)};
        row.append(code,cb);c.appendChild(row);
      }
      if(g.pin)add("gx","PIN: "+g.pin);
      if(g.expires)add("gx","Valid till "+g.expires);
      if(g.link&&/^https?:\/\//i.test(g.link)){
        const a=document.createElement("a");a.className="gl";a.href=g.link;a.target="_blank";a.rel="noopener noreferrer";
        a.textContent=g.linkText||"Redeem";c.appendChild(a);
      }
    }
    b.insertBefore(c,gh.nextSibling);
    const btn=document.createElement("button");btn.className="cbn";btn.type="button";
    btn.textContent=last?"Close":tplOf(ev).btn;btn.onclick=next;b.appendChild(btn);
  };

  env.onclick=()=>{
    if(opened)return;opened=true;
    env.classList.add("open");gt.textContent="";
    if(navigator.vibrate)navigator.vibrate(30);
    tm=setTimeout(showCard,1000);
  };
  return()=>clearTimeout(tm);
}
/* ---------- chat theme: har template ka apna rang ---------- */
const HEART_BG="url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='%23ff6fa3' fill-opacity='.13'%3E%3Cpath d='M30 26c-6-9-20-4-15 7 3 7 15 14 15 14s12-7 15-14c5-11-9-16-15-7z'/%3E%3Cpath transform='translate(62 58) rotate(14 20 20) scale(.8)' d='M30 26c-6-9-20-4-15 7 3 7 15 14 15 14s12-7 15-14c5-11-9-16-15-7z'/%3E%3C/g%3E%3C/svg%3E\")";
function tcss(){
  if(document.getElementById("celcss3"))return;
  const s=document.createElement("style");s.id="celcss3";
  const N=["side","panel","line","out","in","chat","dot"];
  const vars=(th,a)=>N.map((k,i)=>"--"+k+":"+a[i]).join(";");
  let css="";
  for(const k in T){
    const h=T[k].th,sel='html[data-cel="'+k+'"]';
    css+=sel+"{--g:"+h.g+";--bar:"+h.bar+";"+vars(h,h.d)+"}\n";
    css+="@media(prefers-color-scheme:light){"+sel+"{"+vars(h,h.l)+"}}\n";
    css+=sel+" #chat{background-image:"+(k==="anniversary"?HEART_BG:"radial-gradient(var(--dot) 2px,transparent 2.5px)")+";background-size:"+(k==="anniversary"?"120px 120px":"26px 26px")+"}\n";
  }
  css+=`#celbar,#celbar2{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 10px;background:var(--bar);color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:7px 12px;text-align:center;flex:none}
#celbar small{font-weight:400;opacity:.92}
#celhearts{position:fixed;inset:0;z-index:6;pointer-events:none;overflow:hidden}
#celhearts i{position:absolute;bottom:-8vh;font-style:normal;color:var(--g);opacity:0;animation:celh linear infinite}
@keyframes celh{0%{transform:translateY(0) scale(.8);opacity:0}12%{opacity:.55}100%{transform:translateY(-112vh) translateX(var(--x)) scale(1.1);opacity:0}}
@media(prefers-reduced-motion:reduce){#celhearts{display:none}}`;
  s.textContent=css;
  document.head.appendChild(s);
}

function showTheme(th){
  const root=document.documentElement;
  ["celbar","celbar2","celhearts"].forEach(id=>{const e=document.getElementById(id);if(e)e.remove()});
  if(!th){delete root.dataset.cel;return}
  tcss();root.dataset.cel=T[th.theme]?th.theme:"anniversary";

  const mk=id=>{
    const d=document.createElement("div");d.id=id;
    const b=document.createElement("b");b.textContent=th.banner;d.appendChild(b);
    if(th.sub){const s=document.createElement("small");s.textContent=th.sub;d.appendChild(s)}
    return d;
  };
  const side=document.getElementById("side"),sb=side&&side.querySelector(".sbox");
  if(sb)side.insertBefore(mk("celbar"),sb);                         // chat list: header ke neeche
  const m=document.getElementById("msgs");
  if(m&&m.parentNode)m.parentNode.insertBefore(mk("celbar2"),m);    // chat ke andar: bubbles ke upar

  if(!RM){                                                         // halke ud-te hearts
    const h=document.createElement("div");h.id="celhearts";
    for(let i=0;i<9;i++){
      const e=document.createElement("i");e.textContent=th.glyph||"\u2665";
      e.style.cssText="left:"+(Math.random()*96)+"%;font-size:"+(14+Math.random()*16)+"px;--x:"+(Math.random()*60-30)+"px;animation-duration:"+(10+Math.random()*8)+"s;animation-delay:-"+(Math.random()*14)+"s";
      h.appendChild(e);
    }
    document.body.appendChild(h);
  }
}