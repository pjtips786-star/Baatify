/* ===== together.js: next-event card above the messages =====
   Shows the NEAREST upcoming event from the admin's Events (celebrations/{me.uid}):
   date tile + event name + "In N days" / "Today", and "N days together" on the right.
   Tap the card to switch the right side between "879 days" and "2y 4m 26d".
   Hook (chat.js, after `me` is known):
     import("./together.js"+V).then(m=>m.initTogether(me.uid)).catch(()=>{});            */
import {doc,getDoc} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const {db}=await import("./firebase.js"+(window.V||""));

const IST=19800000;
const CACHE="bt_tg";                    // localStorage cache of the events
const FRESH=10*60*1000;                 // re-read Firestore at most every 10 min
const FALLBACK={start:"2024-05-22",title:"Anniversary",month:5,day:22};   // used only if the admin has no event yet; set start:"" to turn off
const ONLY_UIDS=["sOxXSasa0ANEiATQhIMPi1HXT7l1"];          // <-- put the person's UID here (Firebase console > Authentication > Users > "User UID"). Names are looked up from users/{uid}, so a renamed profile still works
const ONLY_NAMES=[];           // optional fallback when ONLY_UIDS is empty: header-name words, e.g. ["Baby"]
const WHO=ONLY_UIDS.filter(Boolean);
let wnames=[];                 // current names of those UIDs (filled at start)
const MODE="bt_tg_mode";                // "d" (days) or "ymd"
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const $=id=>document.getElementById(id);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const ist=()=>{const t=new Date(Date.now()+IST);return{y:t.getUTCFullYear(),m:t.getUTCMonth()+1,d:t.getUTCDate()}};
const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
const DAY=864e5;
const plural=(n,w)=>n+" "+w+(n===1?"":"s");

function tpl(ev){
  if(ev.template)return ev.template;
  if(ev.repeat==="monthly")return "monthsary";
  if(/birth/i.test((ev.title||"")+" "+(ev.name||"")))return "birthday";
  return "anniversary";
}

function since(start,n){
  const [sy,sm,sd]=start.split("-").map(Number);
  let y=n.y-sy,m=n.m-sm,d=n.d-sd;
  if(d<0){m--;d+=dim(n.m===1?n.y-1:n.y,n.m===1?12:n.m-1)}
  if(m<0){y--;m+=12}
  const total=Math.floor((Date.UTC(n.y,n.m-1,n.d)-Date.UTC(sy,sm-1,sd))/DAY);
  return{y,m,d,total};
}

/* days until the next time this event happens (0 = today); null = never again */
function daysTo(ev,n){
  if(ev.active===false)return null;
  const T=Date.UTC(n.y,n.m-1,n.d),cand=(y,m,d)=>Date.UTC(y,m-1,Math.min(d,dim(y,m)));
  let best=null;
  if(ev.repeat==="yearly"){best=cand(n.y,ev.month,ev.day);if(best<T)best=cand(n.y+1,ev.month,ev.day)}
  else if(ev.repeat==="monthly"){
    for(let k=0;k<26&&best===null;k++){
      const y=n.y+Math.floor((n.m-1+k)/12),m=(n.m-1+k)%12+1,t=cand(y,m,ev.day);
      if(t>=T&&!(ev.skipMonths||[]).includes(m))best=t;
    }
  }else{const t=Date.UTC(ev.year||n.y,(ev.month||1)-1,ev.day||1);if(t>=T)best=t}
  return best===null?null:Math.round((best-T)/DAY);
}

/* ---------- data ---------- */
function parseDoc(d){
  let j=[];
  if(d.by&&typeof d.by==="object"){
    for(const k of Object.keys(d.by)){try{const a=JSON.parse(d.by[k]||"[]");if(Array.isArray(a))j=j.concat(a)}catch(e){}}
  }else{try{j=JSON.parse(d.json||"[]")}catch(e){j=[]}}
  return Array.isArray(j)?j:[];
}
async function events(uid){
  try{
    const c=JSON.parse(localStorage.getItem(CACHE)||"null");
    if(c&&c.uid===uid&&Date.now()-c.at<FRESH)return c.evs;
  }catch(e){}
  const s=await getDoc(doc(db,"celebrations",uid));
  const evs=s.exists()?parseDoc(s.data()):[];
  if(!evs.length)return evs;                                  // never cache an empty answer
  try{localStorage.setItem(CACHE,JSON.stringify({uid,at:Date.now(),evs:evs.map(e=>({id:e.id,title:e.title,name:e.name,template:e.template,repeat:e.repeat,day:e.day,month:e.month,year:e.year,start:e.start,active:e.active,skipMonths:e.skipMonths}))}))}catch(e){}
  return evs;
}

/* ---------- ui ---------- */
let bar=null,uidNow="",evs=[],mode="d",timer=0;
function css(){
  if($("tgcss"))return;
  const s=E("style");s.id="tgcss";
  s.textContent=
"#tgbar{flex:none;display:flex;align-items:center;gap:12px;margin:8px 10px 2px;padding:8px 12px 8px 8px;border-radius:16px;background:var(--panel,#202c33);box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 2px 10px rgba(0,0,0,.18);color:var(--text,#e9edef);cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;font:14px system-ui,sans-serif;position:relative;overflow:hidden}"+
"#tgbar.hide{display:none}"+
"#tgbar .tgd{flex:none;width:46px;border-radius:12px;overflow:hidden;text-align:center;background:var(--bg,#0b141a);border:1px solid var(--line,#222d34)}"+
"#tgbar .tgd i{display:block;font-style:normal;font-size:10px;font-weight:700;letter-spacing:.08em;padding:3px 0;background:var(--g,#00a884);color:#fff}"+
"#tgbar .tgd b{display:block;font-size:20px;line-height:1.35;font-weight:700}"+
"#tgbar .tgm{flex:1;min-width:0;display:grid;gap:2px;line-height:1.25}"+
"#tgbar .tgm small{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute,#8696a0)}"+
"#tgbar .tgm b{font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
"#tgbar .tgm span{font-size:12.5px;color:var(--g,#00a884);font-weight:600}"+
"#tgbar .tgr{flex:none;text-align:right;line-height:1.2;max-width:34%}"+
"#tgbar .tgr b{display:block;font-size:15px;font-weight:700;white-space:nowrap}"+
"#tgbar .tgr small{display:block;font-size:11px;color:var(--mute,#8696a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"+
"#tgbar.now .tgd{border-color:var(--g,#00a884)}"+
"#tgbar.now .tgm span{background:var(--g,#00a884);color:#fff;padding:1px 8px;border-radius:10px;justify-self:start}";
  document.head.appendChild(s);
}

/* is the open chat one of the selected people? (looks at the chat header text) */
let lastKey="";
function peerOk(){
  const list=WHO.length?wnames:ONLY_NAMES;
  if(!WHO.length&&!ONLY_NAMES.length)return true;
  if(!list.length)return false;
  const h=$("pane")&&$("pane").querySelector("header");
  const t=((h&&h.textContent)||"").toLowerCase();
  return list.some(n=>n&&t.includes(String(n).toLowerCase()));
}
const WD=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function render(){
  if(!bar)return;
  if(!peerOk()){bar.classList.add("hide");return}
  const n=ist();
  let nxt=null;                                              // nearest upcoming event
  evs.forEach(e=>{const d=daysTo(e,n);if(d!==null&&(!nxt||d<nxt.d))nxt={e,d}});
  if(!nxt){console.warn("[together] no upcoming event found for this account");bar.classList.add("hide");return}
  bar.classList.remove("hide");
  const when=new Date(Date.UTC(n.y,n.m-1,n.d)+nxt.d*DAY);
  const q=s=>bar.querySelector(s);
  q(".tgd i").textContent=MON[when.getUTCMonth()].toUpperCase();
  q(".tgd b").textContent=when.getUTCDate();
  q(".tgm small").textContent="Next event";
  q(".tgm b").textContent=nxt.e.title||nxt.e.name||"Special day";
  q(".tgm span").textContent=nxt.d===0?"Today":nxt.d===1?"Tomorrow":"In "+nxt.d+" days";
  bar.classList.toggle("now",nxt.d===0);
  const main=evs.filter(e=>e.active!==false&&e.start&&tpl(e)!=="birthday")
    .sort((a,b)=>(tpl(a)==="anniversary"?0:1)-(tpl(b)==="anniversary"?0:1))[0];
  const r=q(".tgr");
  if(main){
    const s=since(main.start,n),p=[];
    if(s.y)p.push(s.y+"y");if(s.m)p.push(s.m+"m");if(s.d)p.push(s.d+"d");
    r.hidden=false;
    r.firstChild.textContent=mode==="d"?s.total+" days":(p.join(" ")||"Today");
    r.lastChild.textContent="together";
  }else r.hidden=true;
  q(".tgm span").title=WD[when.getUTCDay()];
}

function schedule(){
  clearTimeout(timer);
  const t=new Date(Date.now()+IST);
  const next=Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()+1)-IST;
  timer=setTimeout(()=>{render();schedule()},next-Date.now()+3000);      // refresh at IST midnight
}

const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function initTogether(uid){
  uidNow=uid;
  for(let k=0;k<50&&!($("pane")&&$("msgs"));k++)await wait(100);   // chat.html may not be ready yet
  const pane=$("pane"),msgs=$("msgs");
  if(!pane||!msgs){console.warn("[together] #pane / #msgs not found");return}
  if($("tgbar"))return;
  css();
  try{mode=localStorage.getItem(MODE)==="ymd"?"ymd":"d"}catch(e){}
  bar=E("div");bar.id="tgbar";bar.className="hide";bar.setAttribute("role","button");bar.setAttribute("aria-label","Days together");
  const d=E("div","tgd");d.append(E("i"),E("b"));
  const m=E("div","tgm");m.append(E("small"),E("b"),E("span"));
  const r=E("div","tgr");r.append(E("b"),E("small"));
  bar.append(d,m,r);
  bar.onclick=()=>{mode=mode==="d"?"ymd":"d";try{localStorage.setItem(MODE,mode)}catch(e){}render()};
  const put=()=>{if(bar.parentNode!==pane||bar.nextSibling!==$("msgs"))pane.insertBefore(bar,$("msgs")||null)};
  put();
  new MutationObserver(()=>{if(!bar.isConnected||bar.parentNode!==pane)put()}).observe(pane,{childList:true});   // survive re-renders
  if(WHO.length){
    const got=await Promise.all(WHO.map(u=>getDoc(doc(db,"users",u)).then(x=>x.exists()?x.data():{}).catch(()=>({}))));
    wnames=[];got.forEach(d=>{if(d.name)wnames.push(d.name);if(d.username)wnames.push(d.username)});
    if(!wnames.length)console.warn("[together] could not find a user for ONLY_UIDS");
  }
  try{evs=await events(uid)}catch(e){console.warn("[together] could not read celebrations:",e&&e.message);evs=[]}
  if(!evs.some(e=>e.start)&&FALLBACK.start)evs=evs.concat([{title:FALLBACK.title,template:"anniversary",repeat:"yearly",day:FALLBACK.day,month:FALLBACK.month,start:FALLBACK.start,active:true}]);
  render();schedule();
  setInterval(()=>{                                   // chat switched? header text changes
    const h=$("pane")&&$("pane").querySelector("header"),k=h?h.textContent:"";
    if(k!==lastKey){lastKey=k;render()}
  },700);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)render()});
}
