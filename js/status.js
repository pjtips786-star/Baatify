/* ===== status.js: 24-hour status (text / photo), status row, viewer, replies, views, delete =====
   Data: status/{id} = {uid,name,photo,type:"text"|"photo",text,bg,url,caption,viewers[],createdAt,expiresAt}
   status/{id}/views/{uid} = {name,photo,at}
   viewers = people you had a chat with when you posted; only they can see the status. */
import {doc,getDoc,addDoc,setDoc,updateDoc,increment,deleteDoc,collection,query,where,onSnapshot,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const {db}=await import("./firebase.js"+(window.V||""));

const CLOUD="dzbqkvysn",PRESET="Baatify";
const HOURS=24;
const HOLD_MS=220;                                       // long-press duration to pause
const BG=["linear-gradient(135deg,#00a884,#075e54)","linear-gradient(135deg,#ff6b81,#c2185b)","linear-gradient(135deg,#7f5af0,#2cb1ff)","linear-gradient(135deg,#ffb347,#ff5e62)","linear-gradient(135deg,#43cea2,#185a9d)","linear-gradient(135deg,#434343,#000000)"];
const $=id=>document.getElementById(id);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};

/* ---------- icons (inline SVG) ---------- */
const IC={
  close:'<path d="M18 6L6 18M6 6l12 12"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  eye:'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  type:'<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  up:'<path d="M6 15l6-6 6 6"/>',
  ring:'<circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><path d="M12 8v8M8 12h8"/>'
};
const icon=(n,s)=>'<svg class="sic" viewBox="0 0 24 24" width="'+(s||20)+'" height="'+(s||20)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[n]+'</svg>';

let me=null,getChats=()=>[],mine=[],others=[],subs=[],listeners=new Set();
const now=()=>Date.now();
const ms=t=>t&&t.toMillis?t.toMillis():0;
const agoText=t=>{const m=Math.round((now()-ms(t))/6e4);return m<1?"Just now":m<60?m+" min ago":Math.floor(m/60)+" h ago"};
function toast(t){const e=$("toast");if(!e){alert(t);return}e.textContent=t;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),3000)}

/* ---------- Back button support: overlays form a stack, Back closes the top one ---------- */
const layers=[];let ign=0;
function pushLayer(fn){
  const L={fn,done:false};layers.push(L);
  try{history.pushState({bt:"st"},"")}catch(e){}
  return()=>{                                            // call when closed from the UI
    if(L.done)return;L.done=true;
    const i=layers.indexOf(L);if(i>=0)layers.splice(i,1);
    ign++;history.back();
    setTimeout(()=>{if(ign>0)ign--},900);
  };
}
addEventListener("popstate",e=>{
  if(ign>0){ign--;e.stopImmediatePropagation();return}
  if(layers.length){const L=layers.pop();L.done=true;e.stopImmediatePropagation();L.fn()}
},true);

/* ---------- data layer ---------- */
function emit(){
  const live=a=>a.filter(s=>ms(s.expiresAt)>now()).sort((a,b)=>ms(a.createdAt)-ms(b.createdAt));
  const m=live(mine),o=live(others),by={};
  o.forEach(s=>{(by[s.uid]=by[s.uid]||[]).push(s)});
  const groups=Object.values(by).sort((a,b)=>ms(b[b.length-1].createdAt)-ms(a[a.length-1].createdAt));
  listeners.forEach(f=>{try{f({mine:m,groups})}catch(e){}});
}
export function onStatus(f){listeners.add(f);emit();return()=>listeners.delete(f)}
function watch(){
  subs.forEach(u=>u());subs=[];
  const mk=(q,set)=>onSnapshot(q,s=>{set(s.docs.map(d=>({id:d.id,...d.data()})));emit()},()=>{});
  subs.push(mk(query(collection(db,"status"),where("uid","==",me.uid)),a=>{mine=a}));
  subs.push(mk(query(collection(db,"status"),where("viewers","array-contains",me.uid)),a=>{others=a}));
}
const viewersNow=()=>{
  const s=new Set();
  (getChats()||[]).forEach(c=>(c.members||[]).forEach(u=>{if(u!==me.uid)s.add(u)}));
  return [...s].slice(0,400);
};
async function post(o){
  const v=viewersNow();
  if(!v.length)throw new Error("You have no chats yet. Start a conversation first.");
  await addDoc(collection(db,"status"),{
    uid:me.uid,name:me.name,photo:me.photo||"",viewers:v,
    createdAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(now()+HOURS*36e5),...o});
}
export const postText=(text,bg)=>post({type:"text",text:text.trim().slice(0,700),bg});
export const postPhoto=(url,caption)=>post({type:"photo",url,caption:(caption||"").trim().slice(0,200)});
export const removeStatus=id=>deleteDoc(doc(db,"status",id));

/* ---------- photo upload (Cloudinary, WebView-safe) ---------- */
function shrink(f,max){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>{const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*s;c.height=i.height*s;c.getContext("2d").drawImage(i,0,0,c.width,c.height);c.toBlob(b=>b?res(b):rej(new Error("shrink")),"image/jpeg",.85)};
    i.onerror=rej;i.src=URL.createObjectURL(f);
  });
}
async function upload(file,say){
  const copy=new Blob([await file.arrayBuffer()],{type:file.type||"image/jpeg"});
  let blob=copy;try{blob=await shrink(copy,1280)}catch(e){}
  const fd=new FormData();fd.append("file",blob,"s.jpg");fd.append("upload_preset",PRESET);
  return new Promise((res,rej)=>{
    const x=new XMLHttpRequest();
    x.open("POST","https://api.cloudinary.com/v1_1/"+CLOUD+"/image/upload");x.timeout=90000;
    x.ontimeout=()=>rej(new Error("Upload timed out"));x.onerror=()=>rej(new Error("Network error"));
    x.upload.onprogress=e=>{if(e.lengthComputable)say("Uploading "+Math.round(e.loaded/e.total*100)+"%")};
    x.onload=()=>{let j={};try{j=JSON.parse(x.responseText)}catch(e){}
      x.status<300&&j.secure_url?res(j.secure_url):rej(new Error((j.error&&j.error.message)||"Upload failed"))};
    x.send(fd);
  });
}

/* ---------- styles ---------- */
function css(){
  if($("stcss"))return;
  const s=E("style");s.id="stcss";
  s.textContent=`
.sic{display:block;flex:none}
/* composer */
#stsh{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55);animation:stfa .2s ease}
#stsh .bx{width:min(100%,520px);max-height:92vh;overflow:auto;background:var(--panel,#202c33);color:var(--text,#e9edef);border-radius:18px 18px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px));display:grid;gap:12px}
#stsh .hd{display:flex;align-items:center;justify-content:space-between;font-weight:700;font-size:16px}
#stsh .hd button{border:0;background:none;color:inherit;cursor:pointer;padding:6px;border-radius:50%}
#stsh .tb{display:flex;gap:8px}
#stsh .tb button,#stsh .pk{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:20px;padding:9px 16px;font:600 14px system-ui,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:inherit}
#stsh .tb button.on{background:var(--g,#00a884);color:#fff}
#stsh .go{border:0;border-radius:24px;padding:12px 18px;font:600 15px system-ui,sans-serif;cursor:pointer;background:var(--g,#00a884);color:#fff}
#stsh .go[disabled]{opacity:.5}
#stsh .pv{aspect-ratio:9/12;max-height:46vh;border-radius:14px;display:grid;place-items:center;padding:18px;text-align:center;overflow:hidden;position:relative;background-size:cover;background-position:center}
#stsh textarea{width:100%;height:100%;background:none;border:0;outline:0;resize:none;color:#fff;text-align:center;font:600 24px/1.3 system-ui,sans-serif}
#stsh textarea::placeholder{color:rgba(255,255,255,.65)}
#stsh .pv img{width:100%;height:100%;object-fit:contain;background:#000}
#stsh .sw{display:flex;gap:10px;justify-content:center}
#stsh .sw i{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer}
#stsh .sw i.on{border-color:#fff}
#stsh input[type=text]{width:100%;box-sizing:border-box;padding:11px 14px;border-radius:12px;border:0;background:rgba(255,255,255,.1);color:inherit;font:15px system-ui,sans-serif;outline:0}
#stsh .nt{font-size:13px;opacity:.75;min-height:18px;text-align:center}
#stsh .ms{display:grid;gap:6px;font-size:14px}
#stsh .ms>div{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border-radius:10px;padding:8px 10px}
#stsh .ms b{flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#stsh .ms small{opacity:.7}
#stsh .ms button{border:0;background:none;color:#ff6b81;cursor:pointer;padding:4px;display:grid}
/* status row */
#strow{display:flex;gap:14px;overflow-x:auto;padding:10px 12px 8px;flex:none;scrollbar-width:none;border-bottom:1px solid var(--line,#222d34)}
#strow::-webkit-scrollbar{display:none}
#strow.hide{display:none}
.sti{flex:none;width:66px;display:grid;justify-items:center;gap:4px;background:none;border:0;padding:0;color:inherit;cursor:pointer;font:inherit}
.sti small{font-size:12px;max-width:66px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mute,#8696a0)}
.str{box-sizing:border-box;position:relative;width:60px;height:60px;border-radius:50%;padding:4px;background:var(--mute,#8696a0);display:grid;place-items:center}
.str.new{background:conic-gradient(var(--g,#00a884),#7ee8c7,var(--g,#00a884))}
.str.none{background:none;border:2px dashed var(--mute,#8696a0);padding:2px}
.stc{box-sizing:border-box;width:100%;height:100%;border-radius:50%;background:var(--g,#00a884) center/cover no-repeat;border:3px solid var(--side,#111b21);display:grid;place-items:center;color:#fff;font-weight:700;overflow:hidden}
.str.none .stc{border:0}
.stp{position:absolute;right:-3px;bottom:-3px;width:22px;height:22px;border-radius:50%;background:var(--g,#00a884);color:#fff;display:grid;place-items:center;border:2px solid var(--side,#111b21)}
/* viewer */
#stv{position:fixed;inset:0;z-index:95;background:#000;color:#fff;display:flex;flex-direction:column;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;animation:stin .22s ease;transition:opacity .2s}
#stv.out{opacity:0}
@keyframes stin{from{opacity:0;transform:scale(.97)}}
@keyframes stfa{from{opacity:0}}
#stv .pb,#stv .hd2,#stv .bar{transition:opacity .18s}
#stv.hold .pb,#stv.hold .hd2,#stv.hold .bar,#stv.hold .cp{opacity:0}
#stv .pb{display:flex;gap:4px;padding:calc(8px + env(safe-area-inset-top,0px)) 10px 0;position:relative;z-index:3}
#stv .pb i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.35);overflow:hidden}
#stv .pb i b{display:block;height:100%;width:0;background:#fff}
#stv .hd2{display:flex;flex-direction:row;justify-content:flex-start;align-items:center;gap:10px;padding:10px 12px;text-align:left;position:relative;z-index:3;text-shadow:0 1px 4px rgba(0,0,0,.6)}
#stv .hd2 .stc{width:40px;height:40px;flex:none;border:0;order:0}
#stv .hd2 .meta{order:1;flex:1 1 auto;min-width:0;line-height:1.25;display:flex;flex-direction:column;align-items:flex-start;text-align:left;margin:0 auto 0 0}
#stv .hd2 b{display:block;flex:none;max-width:100%;margin:0;text-align:left;font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#stv .hd2 small{display:block;margin:0;text-align:left;opacity:.85;font-size:12px}
#stv .hd2 button{order:2;flex:none;border:0;background:none;color:#fff;padding:8px;border-radius:50%;cursor:pointer;display:grid}
#stv .hd2 button[hidden]{display:none}
#stv .sg{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;touch-action:none}
#stv .sg img{width:100%;height:100%;object-fit:contain;pointer-events:none;-webkit-user-drag:none}
#stv .sg .tx{padding:28px;text-align:center;font:600 28px/1.35 system-ui,sans-serif;word-break:break-word;white-space:pre-wrap;max-height:100%;overflow:hidden;pointer-events:none}
#stv .cp{position:absolute;left:0;right:0;bottom:0;padding:40px 18px calc(24px + env(safe-area-inset-bottom,0px));text-align:center;background:linear-gradient(transparent,rgba(0,0,0,.7));font-size:16px;z-index:2;pointer-events:none;transition:opacity .18s}
#stv.rp .cp{padding-bottom:92px}
#stv.ow .cp{padding-bottom:80px}
#stv .bar{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center}
#stv .bar input{flex:1;min-width:0;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.35);color:#fff;border-radius:24px;padding:11px 16px;font:15px system-ui,sans-serif;outline:0;-webkit-user-select:text;user-select:text}
#stv .bar input::placeholder{color:rgba(255,255,255,.7)}
#stv .bar .sd{border:0;border-radius:50%;width:44px;height:44px;background:var(--g,#00a884);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}
#stv .bar .sd[disabled]{opacity:.5}
#stv .vw{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:24px;padding:10px 16px;background:rgba(0,0,0,.45);color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer}
#stv .vl{position:absolute;left:0;right:0;bottom:0;z-index:6;max-height:62%;overflow:auto;background:var(--panel,#202c33);color:var(--text,#e9edef);border-radius:18px 18px 0 0;padding:8px 14px calc(16px + env(safe-area-inset-bottom,0px));display:grid;gap:8px;animation:stfa .2s ease;touch-action:pan-y}
#stv .vl .gr{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.3);margin:0 auto 4px}
#stv .vl h4{margin:0 0 4px;font:700 15px system-ui,sans-serif;display:flex;align-items:center;justify-content:space-between}
#stv .vl h4 button{border:0;background:none;color:inherit;cursor:pointer;padding:4px;display:grid}
#stv .vl .r{display:flex;align-items:center;gap:10px;font:14px system-ui,sans-serif}
#stv .vl .stc{width:42px;height:42px;border:0;flex:none}
#stv .vl .nm{font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#stv .vl small{margin-left:auto;opacity:.7}
#stv .vl p{margin:0;opacity:.7;font:14px system-ui,sans-serif}`;
  document.head.appendChild(s);
}
/* latest name + photo of a user (cached), so lists never show a stale name or picture */
const uc=new Map();
function userOf(uid){
  if(!uc.has(uid))uc.set(uid,getDoc(doc(db,"users",uid)).then(s=>s.exists()?s.data():{}).catch(()=>({})));
  return uc.get(uid);
}
const setAv=(el,name,photo)=>{
  if(photo){el.style.backgroundImage='url("'+photo.replace(/"/g,"%22")+'")';el.textContent=""}
  else{el.style.backgroundImage="";el.textContent=(name||"?")[0].toUpperCase()}
};

/* ---------- composer ---------- */
function openComposer(){
  if($("stsh"))return;css();
  let mode="text",bg=0,file=null,busy=false,rel=null,gone=false;
  const w=E("div");w.id="stsh";
  w.innerHTML='<div class="bx" role="dialog" aria-label="New status"><div class="hd"><span>New status</span><button type="button" id="st_x" aria-label="Close">'+icon("close")+'</button></div>'
   +'<div class="tb"><button type="button" data-m="text" class="on">'+icon("type",18)+'Text</button><button type="button" data-m="photo">'+icon("image",18)+'Photo</button></div>'
   +'<div class="pv" id="st_pv"></div><div class="sw" id="st_sw"></div>'
   +'<input type="text" id="st_cap" maxlength="200" placeholder="Add a caption (optional)" style="display:none">'
   +'<input type="file" id="st_f" accept="image/*" style="display:none">'
   +'<div class="nt" id="st_nt">Visible to your chats for 24 hours</div><button type="button" class="go" id="st_go">Post status</button>'
   +'<div class="ms" id="st_ms"></div></div>';
  document.body.appendChild(w);
  const say=t=>{$("st_nt").textContent=t};
  const draw=()=>{
    const pv=$("st_pv");pv.textContent="";pv.style.background="";
    $("st_sw").style.display=mode==="text"?"":"none";$("st_cap").style.display=mode==="photo"?"":"none";
    if(mode==="text"){
      pv.style.background=BG[bg];
      const t=E("textarea");t.id="st_t";t.maxLength=700;t.placeholder="Type a status";pv.appendChild(t);
    }else if(file){
      const im=new Image();im.alt="";im.src=URL.createObjectURL(file);pv.appendChild(im);
    }else{
      const b=E("button","pk");b.type="button";b.innerHTML=icon("image",18)+"Choose a photo";b.onclick=()=>$("st_f").click();pv.appendChild(b);
    }
  };
  const sw=$("st_sw");
  BG.forEach((g,i)=>{const d=E("i");d.style.background=g;d.onclick=()=>{bg=i;[...sw.children].forEach((x,j)=>x.classList.toggle("on",j===i));$("st_pv").style.background=g};sw.appendChild(d)});
  sw.firstChild.classList.add("on");
  w.querySelectorAll(".tb button").forEach(b=>b.onclick=()=>{
    mode=b.dataset.m;w.querySelectorAll(".tb button").forEach(x=>x.classList.toggle("on",x===b));draw();
  });
  $("st_f").onchange=()=>{file=$("st_f").files[0]||null;draw()};
  const close=()=>{if(gone)return;gone=true;un();w.remove()};
  rel=pushLayer(()=>{if(!busy)close();else gone=false});            // Back button
  const ui=()=>{if(busy)return;rel();close()};
  $("st_x").onclick=ui;w.onclick=e=>{if(e.target===w)ui()};
  $("st_go").onclick=async()=>{
    if(busy)return;
    try{
      busy=true;$("st_go").disabled=true;say("Posting…");
      if(mode==="text"){
        const t=($("st_t").value||"").trim();if(!t)throw new Error("Type something first");
        await postText(t,BG[bg]);
      }else{
        if(!file)throw new Error("Choose a photo first");
        const url=await upload(file,say);
        await postPhoto(url,$("st_cap").value);
      }
      busy=false;rel();close();toast("Status posted");
    }catch(e){busy=false;$("st_go").disabled=false;say("Visible to your chats for 24 hours");toast(e.message||"Could not post status")}
  };
  const un=onStatus(({mine:m})=>{
    const box=$("st_ms");if(!box)return;box.textContent="";
    if(m.length)box.appendChild(E("div","nt","My status ("+m.length+")"));
    m.slice().reverse().forEach(s=>{
      const r=E("div"),b=E("b",null,s.type==="photo"?(s.caption||"Photo"):s.text),a=E("small",null,agoText(s.createdAt)),x=E("button");
      x.type="button";x.innerHTML=icon("trash",18);x.setAttribute("aria-label","Delete status");
      x.onclick=async()=>{x.disabled=true;try{await removeStatus(s.id)}catch(e){toast("Could not delete status");x.disabled=false}};
      r.append(b,a,x);box.appendChild(r);
    });
  });
  draw();
}

/* ---------- seen (this device) and view records ---------- */
const SEEN="bt_st_seen",VW="bt_st_vw";
const seenSet=()=>{try{return new Set(JSON.parse(localStorage.getItem(SEEN)||"[]"))}catch(e){return new Set()}};
const markSeen=id=>{const a=[...seenSet(),id].slice(-300);try{localStorage.setItem(SEEN,JSON.stringify(a))}catch(e){}};
function recordView(s){
  let a=[];try{a=JSON.parse(localStorage.getItem(VW)||"[]")}catch(e){}
  if(a.includes(s.id))return;
  setDoc(doc(db,"status",s.id,"views",me.uid),{name:me.name,photo:me.photo||"",at:serverTimestamp()})
    .then(()=>{a.push(s.id);try{localStorage.setItem(VW,JSON.stringify(a.slice(-300)))}catch(e){}}).catch(()=>{});
}
async function sendReply(s,text){
  const id=[me.uid,s.uid].sort().join("_");
  const pv=s.type==="photo"?"Photo"+(s.caption?": "+s.caption:""):s.text;
  await addDoc(collection(db,"chats",id,"messages"),{sender:me.uid,t:serverTimestamp(),seen:false,text,reply:{n:"Status",t:pv.slice(0,80)}});
  await updateDoc(doc(db,"chats",id),{lastMsg:text,lastAt:serverTimestamp(),lastFrom:me.uid,lastDel:false,["unread."+s.uid]:increment(1)});
  try{window.__stPush&&window.__stPush(s.uid,text)}catch(e){}
}

/* ---------- full-screen viewer ---------- */
function openViewer(groups,gi,si){
  if($("stv")||!groups[gi])return;css();
  const ovf=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";
  const el=E("div");el.id="stv";el.setAttribute("role","dialog");el.setAttribute("aria-label","Status");
  el.innerHTML='<div class="pb"></div><div class="hd2"><div class="stc"></div><div class="meta"><b></b><small></small></div>'
    +'<button type="button" class="dl" aria-label="Delete status" hidden>'+icon("trash",22)+'</button>'
    +'<button type="button" class="cl" aria-label="Close">'+icon("close",24)+'</button></div><div class="sg"></div><div class="bar"></div>';
  document.body.appendChild(el);
  const bar=el.querySelector(".bar"),dl=el.querySelector(".dl"),pb=el.querySelector(".pb"),sg=el.querySelector(".sg"),
        av=el.querySelector(".hd2 .stc"),nm=el.querySelector(".meta b"),tm=el.querySelector(".meta small");
  let raf=0,last=0,el_ms=0,dur=5000,paused=false,uiHold=false,unv=null,vdocs=[],run=false,gone=false,relV=null,relS=null,inp=null;

  const fin=()=>{                                          // actual teardown
    if(gone)return;gone=true;unv&&unv();cancelAnimationFrame(raf);
    removeEventListener("keydown",key);
    el.classList.add("out");                                // stay for a moment so the closing tap
    setTimeout(()=>{el.remove();document.documentElement.style.overflow=ovf;renderStrip()},320);   // cannot hit the chat list below
  };
  const close=()=>{                                         // closed from the UI
    if(gone)return;
    if(relS){relS();relS=null}
    relV&&relV();fin();
  };
  relV=pushLayer(()=>fin());                                // Back button
  el.addEventListener("click",e=>{if(gone){e.preventDefault();e.stopPropagation()}},true);   // only while closing: swallow the ghost click
  el.addEventListener("contextmenu",e=>e.preventDefault());
  const key=e=>{
    if(e.target&&e.target.tagName==="INPUT"){if(e.key==="Escape")e.target.blur();return}
    if(e.key==="Escape")close();else if(e.key==="ArrowRight")next();else if(e.key==="ArrowLeft")prev();
  };
  addEventListener("keydown",key);
  el.querySelector(".cl").onclick=close;

  const bars=()=>{
    pb.textContent="";
    groups[gi].forEach((_,j)=>{const i=E("i"),b=E("b");b.style.width=j<si?"100%":"0";i.appendChild(b);pb.appendChild(i)});
  };
  const fill=p=>{const b=pb.children[si]&&pb.children[si].firstChild;if(b)b.style.width=Math.min(p,1)*100+"%"};
  const tick=t=>{
    if(gone)return;
    if(run&&!paused&&!uiHold){el_ms+=t-last;fill(el_ms/dur);if(el_ms>=dur){next();return}}
    last=t;raf=requestAnimationFrame(tick);
  };
  const go=()=>{run=true;el_ms=0;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(tick)};

  /* viewers sheet (own status) */
  const fillViews=p=>{
    p.textContent="";p.appendChild(E("div","gr"));
    const h=E("h4",null,"Viewed by "+vdocs.length),x=E("button");x.type="button";x.innerHTML=icon("close",20);x.setAttribute("aria-label","Close");
    x.onclick=closeSheet;h.appendChild(x);p.appendChild(h);
    if(!vdocs.length)p.appendChild(E("p",null,"No views yet"));
    vdocs.forEach(d=>{
      const r=E("div","r"),a=E("div","stc"),n=E("span","nm",d.name||"User");setAv(a,d.name,d.photo);
      r.append(a,n,E("small",null,agoText(d.at)));p.appendChild(r);
      userOf(d.id).then(u=>{if(u.name)n.textContent=u.name;if(u.name||u.photo)setAv(a,u.name||d.name,u.photo||d.photo)});
    });
  };
  const closeSheet=()=>{
    const p=el.querySelector(".vl");if(p)p.remove();
    uiHold=false;if(relS){const r=relS;relS=null;r()}
  };
  const openSheet=()=>{
    if(el.querySelector(".vl"))return;
    uiHold=true;
    const p=E("div","vl");el.appendChild(p);fillViews(p);
    let y0=null;                                           // swipe down to dismiss
    p.addEventListener("pointerdown",e=>{y0=e.clientY});
    p.addEventListener("pointerup",e=>{if(y0!=null&&e.clientY-y0>60&&p.scrollTop<=0)closeSheet();y0=null});
    relS=pushLayer(()=>{const q=el.querySelector(".vl");if(q)q.remove();uiHold=false;relS=null});
  };

  const side=s=>{                                          // bottom bar per status
    unv&&unv();unv=null;vdocs=[];uiHold=false;inp=null;
    const own=s.uid===me.uid;
    dl.hidden=!own;el.classList.toggle("rp",!own);el.classList.toggle("ow",own);bar.textContent="";
    const old=el.querySelector(".vl");if(old){old.remove();if(relS){const r=relS;relS=null;r()}}
    if(own){
      const v=E("button","vw");v.type="button";v.setAttribute("aria-label","Viewed by");
      v.innerHTML=icon("eye",22)+'<span>0</span>';bar.appendChild(v);
      unv=onSnapshot(collection(db,"status",s.id,"views"),q=>{
        vdocs=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>ms(b.at)-ms(a.at));
        v.lastChild.textContent=vdocs.length;
        const p=el.querySelector(".vl");if(p)fillViews(p);
      },()=>{});
      v.onclick=openSheet;
    }else{
      recordView(s);
      inp=E("input");inp.type="text";inp.maxLength=500;inp.placeholder="Reply…";inp.autocomplete="off";inp.setAttribute("aria-label","Reply to status");
      const b=E("button","sd");b.type="button";b.innerHTML=icon("send",20);b.setAttribute("aria-label","Send reply");
      inp.onfocus=()=>{uiHold=true};inp.onblur=()=>{uiHold=false};
      const go2=async()=>{
        const t=inp.value.trim();if(!t||b.disabled)return;
        b.disabled=true;
        try{await sendReply(s,t);inp.value="";inp.blur();toast("Reply sent")}
        catch(e){toast("Could not send reply")}
        b.disabled=false;
      };
      b.onclick=go2;inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go2()}};
      bar.append(inp,b);
    }
  };
  dl.onclick=async()=>{
    const s=groups[gi][si];
    if(!confirm("Delete this status?"))return;
    uiHold=true;
    try{await removeStatus(s.id)}catch(e){toast("Could not delete status");uiHold=false;return}
    groups[gi].splice(si,1);uiHold=false;
    if(!groups[gi].length){close();return}
    if(si>=groups[gi].length)si=groups[gi].length-1;
    show();
  };

  const show=()=>{
    const g=groups[gi],s=g[si];
    run=false;cancelAnimationFrame(raf);bars();
    setAv(av,s.name,s.photo);nm.textContent=s.uid===me.uid?"My status":s.name;tm.textContent=agoText(s.createdAt);
    userOf(s.uid).then(u=>{if(gone||groups[gi][si]!==s)return;if(u.name||u.photo)setAv(av,u.name||s.name,u.photo||s.photo);if(u.name&&s.uid!==me.uid)nm.textContent=u.name});
    sg.textContent="";sg.style.background="";
    markSeen(s.id);side(s);
    if(s.type==="photo"){
      sg.style.background="#000";dur=6000;
      const im=new Image();im.alt="";im.draggable=false;
      im.onload=go;im.onerror=go;im.src=s.url.replace("/upload/","/upload/w_1200,q_auto,f_auto/");
      sg.appendChild(im);
      if(s.caption)sg.appendChild(E("div","cp",s.caption));
    }else{
      sg.style.background=s.bg||BG[0];dur=Math.min(9000,3500+(s.text||"").length*45);
      sg.appendChild(E("div","tx",s.text));go();
    }
  };
  function next(){
    if(si<groups[gi].length-1){si++;show();return}
    nextGroup();
  }
  function nextGroup(){
    if(gi<groups.length-1&&groups[gi][0].uid!==me.uid){gi++;si=0;show();return}
    close();
  }
  function prev(){
    if(si>0){si--;show();return}
    prevGroup();
  }
  function prevGroup(){
    if(gi>0&&groups[gi][0].uid!==me.uid){gi--;si=0;show();return}
    show();
  }

  /* Gestures:
     tap = next / previous · press and hold = pause (release = resume)
     swipe up = viewers (own) or reply (others) · swipe down = close · swipe left/right = next/previous person */
  let dn=false,x0=0,y0=0,hold=false,moved=false,ht=0;
  sg.addEventListener("pointerdown",e=>{
    if(e.button>0)return;
    const ae=document.activeElement;
    if(ae&&ae.tagName==="INPUT"){ae.blur();dn=false;return}
    if(el.querySelector(".vl")){closeSheet();dn=false;return}
    dn=true;x0=e.clientX;y0=e.clientY;hold=false;moved=false;
    clearTimeout(ht);
    ht=setTimeout(()=>{if(dn&&!moved){hold=true;paused=true;el.classList.add("hold")}},HOLD_MS);
    try{sg.setPointerCapture(e.pointerId)}catch(_){}
  });
  sg.addEventListener("pointermove",e=>{
    if(!dn)return;
    if(Math.abs(e.clientX-x0)>14||Math.abs(e.clientY-y0)>14){moved=true;clearTimeout(ht)}
  });
  const end=(e,cancel)=>{
    if(!dn)return;dn=false;clearTimeout(ht);
    const wasHold=hold;hold=false;paused=false;el.classList.remove("hold");
    if(cancel)return;
    const dx=e.clientX-x0,dy=e.clientY-y0;
    if(moved){
      if(Math.abs(dy)>=Math.abs(dx)){
        if(dy<-70){const o=groups[gi][si].uid===me.uid;if(o)openSheet();else if(inp)inp.focus()}
        else if(dy>90)close();
      }else{
        if(dx<-70)nextGroup();else if(dx>70)prevGroup();
      }
      return;
    }
    if(wasHold)return;                                      // long-press release only resumes
    (e.clientX<innerWidth*.35)?prev():next();
  };
  sg.addEventListener("pointerup",e=>end(e,false));
  sg.addEventListener("pointercancel",e=>end(e,true));
  show();
}

/* ---------- status row above the chat list ---------- */
let strip=null,snap={mine:[],groups:[]};
function renderStrip(){
  if(!strip)return;
  const seen=seenSet(),m=snap.mine;
  strip.textContent="";
  const item=(label,name,photo,cls,click,plus)=>{
    const b=E("button","sti");b.type="button";
    const r=E("div","str "+cls),c=E("div","stc");setAv(c,name,photo);r.appendChild(c);
    if(plus){const p=E("span","stp");p.innerHTML=icon("plus",14);p.onclick=e=>{e.stopPropagation();openComposer()};r.appendChild(p)}
    const lb=E("small",null,label);
    b.append(r,lb);b.onclick=click;strip.appendChild(b);
    return {c,lb};
  };
  item(m.length?"My status":"Add status",me.name,me.photo,m.length?"":"none",
    ()=>{m.length?openViewer([m],0,0):openComposer()},true);
  snap.groups.forEach((g,gi)=>{
    const unseen=g.findIndex(s=>!seen.has(s.id)),l=g[g.length-1];
    const it=item(l.name,l.name,l.photo,unseen>=0?"new":"",()=>openViewer(snap.groups,gi,unseen>=0?unseen:0));
    userOf(l.uid).then(u=>{if(u.name)it.lb.textContent=u.name;if(u.name||u.photo)setAv(it.c,u.name||l.name,u.photo||l.photo)});
  });
}

/* ---------- init: header button + status row ---------- */
export function initStatus(user,chatsFn){
  me=user;getChats=chatsFn||getChats;
  watch();css();
  const head=document.querySelector("#side>header"),anchor=$("adm")||$("out");
  if(head&&!$("stbtn")){
    const b=E("button","ic");b.id="stbtn";b.type="button";b.setAttribute("aria-label","Add status");
    b.innerHTML=icon("ring",22);
    b.onclick=openComposer;
    head.insertBefore(b,anchor);
  }
  const list=$("list");
  if(list&&!$("strow")){
    strip=E("div");strip.id="strow";strip.setAttribute("aria-label","Status");
    list.parentNode.insertBefore(strip,list);
    const res=$("res");
    if(res)new MutationObserver(()=>strip.classList.toggle("hide",!res.classList.contains("hide"))).observe(res,{attributes:true,attributeFilter:["class"]});
    onStatus(v=>{snap=v;renderStrip()});
  }
}
