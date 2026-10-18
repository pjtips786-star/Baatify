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
  check:'<path d="M20 6L9 17l-5-5"/>',
  ring:'<circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><path d="M12 8v8M8 12h8"/>'
};
const icon=(n,s)=>'<svg class="sic" viewBox="0 0 24 24" width="'+(s||20)+'" height="'+(s||20)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[n]+'</svg>';

let me=null,getChats=()=>[],mine=[],others=[],subs=[],listeners=new Set();
const now=()=>Date.now();
const ms=t=>t&&t.toMillis?t.toMillis():0;
const agoText=t=>{const m=Math.round((now()-ms(t))/6e4);return m<1?"Just now":m<60?m+" min ago":Math.floor(m/60)+" h ago"};
let tt=0;
function toast(t,ok){                                    // own toast: always above the viewer and composer
  css();
  let e=$("sttoast");
  if(!e){e=E("div");e.id="sttoast";e.setAttribute("role","status");document.body.appendChild(e)}
  e.innerHTML=(ok?icon("check",18):"")+"<span></span>";e.lastChild.textContent=t;
  e.classList.remove("on");void e.offsetWidth;e.classList.add("on");
  clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),2600);
}

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

/* ---------- styles (all class names are prefixed "st" so nothing clashes with chat.css) ---------- */
function css(){
  if($("stcss"))return;
  const s=E("style");s.id="stcss";
  s.textContent=`
.sic{display:block;flex:none}
/* ===== composer (full screen) ===== */
#stsh{position:fixed;left:0;top:0;right:0;bottom:0;z-index:90;display:flex;flex-direction:column;color:#fff;background:#111;animation:stfa .2s ease;overflow:hidden}
#stsh .stcbg{position:absolute;inset:0;background:#111 center/cover no-repeat;transition:background .25s}
#stsh .stctop{position:relative;z-index:2;display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px}
#stsh .stcx{border:0;background:rgba(0,0,0,.35);color:#fff;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;cursor:pointer}
#stsh .stcmode{display:flex;gap:4px;margin:0 auto;background:rgba(0,0,0,.35);border-radius:24px;padding:4px}
#stsh .stcmode button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:#fff;padding:8px 16px;border-radius:20px;font:600 14px system-ui,sans-serif;cursor:pointer;opacity:.75}
#stsh .stcmode button.on{background:#fff;color:#111;opacity:1}
#stsh .stcsp{width:42px}
#stsh .stcmid{position:relative;z-index:1;flex:1;min-height:0;display:grid;place-items:center;padding:8px 24px}
#stsh textarea{width:100%;max-height:100%;background:none;border:0;outline:0;resize:none;color:#fff;text-align:center;font:600 30px/1.3 system-ui,sans-serif;overflow:auto}
#stsh textarea::placeholder{color:rgba(255,255,255,.6)}
#stsh .stcimg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
#stsh .stcpick{display:grid;justify-items:center;gap:10px;border:2px dashed rgba(255,255,255,.55);background:rgba(0,0,0,.25);color:#fff;border-radius:20px;padding:30px 34px;font:600 15px system-ui,sans-serif;cursor:pointer}
#stsh .stcnote{position:relative;z-index:2;text-align:center;font-size:12px;opacity:.8;padding:0 16px 6px;text-shadow:0 1px 3px rgba(0,0,0,.6)}
#stsh .stcbot{position:relative;z-index:2;display:flex;align-items:center;gap:12px;padding:6px 14px calc(14px + env(safe-area-inset-bottom,0px))}
#stsh .stcsw{flex:1;min-width:0;display:flex;gap:12px;align-items:center;overflow-x:auto;padding:6px 2px;scrollbar-width:none}
#stsh .stcsw::-webkit-scrollbar{display:none}
#stsh .stcsw i{flex:none;width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.4);cursor:pointer;transition:transform .15s}
#stsh .stcsw i.on{border-color:#fff;transform:scale(1.15)}
#stsh .stccap{flex:1;min-width:0;box-sizing:border-box;border:0;outline:0;border-radius:24px;padding:13px 18px;background:rgba(0,0,0,.45);color:#fff;font:15px system-ui,sans-serif}
#stsh .stccap::placeholder{color:rgba(255,255,255,.65)}
#stsh .stcgo{flex:none;border:0;width:54px;height:54px;border-radius:50%;background:var(--g,#00a884);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4)}
#stsh .stcgo[disabled]{opacity:.55}
/* ===== toast ===== */
#sttoast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));transform:translate(-50%,12px);z-index:300;display:flex;align-items:center;gap:8px;max-width:calc(100% - 40px);background:rgba(32,44,51,.96);color:#fff;border-radius:24px;padding:11px 18px;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
#sttoast.on{opacity:1;transform:translate(-50%,0)}
#sttoast svg{color:#2fe09a}
/* ===== status row =====
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
/* ===== viewer (full screen) ===== */
#stv{position:fixed;left:0;top:0;right:0;bottom:0;width:100%;height:100%;min-height:100dvh;margin:0;padding:0;box-sizing:border-box;z-index:95;background:#000;color:#fff;display:flex;flex-direction:column;overflow:hidden;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;animation:stin .22s ease;transition:opacity .2s}
#stv.st-out{opacity:0}
@keyframes stin{from{opacity:0}}
@keyframes stfa{from{opacity:0}}
#stv .stpb,#stv .sthd,#stv .stbar,#stv .stcp{transition:opacity .18s}
#stv.st-hold .stpb,#stv.st-hold .sthd,#stv.st-hold .stbar,#stv.st-hold .stcp{opacity:0}
#stv .stpb{display:flex;gap:4px;padding:calc(8px + env(safe-area-inset-top,0px)) 10px 0;position:relative;z-index:3}
#stv .stpb i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.35);overflow:hidden}
#stv .stpb i b{display:block;height:100%;width:0;background:#fff}
#stv .sthd{display:flex;flex-direction:row;justify-content:flex-start;align-items:center;gap:10px;padding:10px 12px;text-align:left;position:relative;z-index:3;text-shadow:0 1px 4px rgba(0,0,0,.6)}
#stv .sthd .stc{width:40px;height:40px;flex:none;border:0;order:0}
#stv .stmeta{order:1;flex:1 1 auto;min-width:0;line-height:1.25;display:flex;flex-direction:column;align-items:flex-start;text-align:left;margin:0 auto 0 0}
#stv .stmeta b{display:block;flex:none;max-width:100%;margin:0;text-align:left;font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#stv .stmeta small{display:block;margin:0;text-align:left;opacity:.85;font-size:12px}
#stv .sthd button{order:2;flex:none;border:0;background:none;color:#fff;padding:8px;border-radius:50%;cursor:pointer;display:grid}
#stv .sthd button[hidden]{display:none}
#stv .stsg{position:absolute;left:0;top:0;right:0;bottom:0;display:grid;place-items:center;overflow:hidden;touch-action:none}
#stv .stblur{position:absolute;inset:-30px;background:center/cover no-repeat;filter:blur(26px) brightness(.55);transform:scale(1.1)}
#stv .stsg img{position:relative;width:100%;height:100%;object-fit:contain;pointer-events:none;-webkit-user-drag:none}
#stv .sttx{padding:28px;text-align:center;font:600 28px/1.35 system-ui,sans-serif;word-break:break-word;white-space:pre-wrap;max-height:100%;overflow:hidden;pointer-events:none}
#stv .stcp{position:absolute;left:0;right:0;bottom:0;padding:40px 18px calc(24px + env(safe-area-inset-bottom,0px));text-align:center;background:linear-gradient(transparent,rgba(0,0,0,.7));font-size:16px;z-index:2;pointer-events:none}
#stv.st-rp .stcp{padding-bottom:92px}
#stv.st-ow .stcp{padding-bottom:80px}
#stv .stbar{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;justify-content:flex-start}
#stv .stbar input{flex:1;min-width:0;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.35);color:#fff;border-radius:24px;padding:11px 16px;font:15px system-ui,sans-serif;outline:0;-webkit-user-select:text;user-select:text}
#stv .stbar input::placeholder{color:rgba(255,255,255,.7)}
#stv .stsd{border:0;border-radius:50%;width:44px;height:44px;background:var(--g,#00a884);color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}
#stv .stsd[disabled]{opacity:.5}
#stv .stvw{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:24px;padding:10px 16px;background:rgba(0,0,0,.45);color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer}
#stv .stvl{position:absolute;left:0;right:0;bottom:0;z-index:6;max-height:62%;overflow:auto;background:var(--panel,#202c33);color:var(--text,#e9edef);border-radius:18px 18px 0 0;padding:8px 14px calc(16px + env(safe-area-inset-bottom,0px));display:grid;gap:8px;animation:stfa .2s ease;touch-action:pan-y}
#stv .stgr{width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,.3);margin:0 auto 4px}
#stv .stvl h4{margin:0 0 4px;font:700 15px system-ui,sans-serif;display:flex;align-items:center;justify-content:space-between}
#stv .stvl h4 button{border:0;background:none;color:inherit;cursor:pointer;padding:4px;display:grid}
#stv .strw{display:flex;align-items:center;gap:10px;font:14px system-ui,sans-serif}
#stv .stvl .stc{width:42px;height:42px;border:0;flex:none}
#stv .stnm{font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#stv .stvl small{margin-left:auto;opacity:.7}
#stv .stvl p{margin:0;opacity:.7;font:14px system-ui,sans-serif}`;
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

/* ---------- composer (full screen) ---------- */
function openComposer(){
  if($("stsh"))return;css();
  let mode="text",bg=0,file=null,busy=false,rel=null,gone=false;
  const w=E("div");w.id="stsh";w.setAttribute("role","dialog");w.setAttribute("aria-label","New status");
  w.innerHTML='<div class="stcbg" id="st_bg"></div>'
   +'<div class="stctop"><button type="button" class="stcx" id="st_x" aria-label="Close">'+icon("close",22)+'</button>'
   +'<div class="stcmode"><button type="button" data-m="text" class="on">'+icon("type",18)+'Text</button><button type="button" data-m="photo">'+icon("image",18)+'Photo</button></div><span class="stcsp"></span></div>'
   +'<div class="stcmid" id="st_mid"></div>'
   +'<div class="stcnote" id="st_nt">Visible to your chats for 24 hours</div>'
   +'<div class="stcbot" id="st_bot"></div>'
   +'<input type="file" id="st_f" accept="image/*" style="display:none">';
  document.body.appendChild(w);
  const say=t=>{$("st_nt").textContent=t};
  const NOTE="Visible to your chats for 24 hours";
  const goBtn=E("button","stcgo");goBtn.type="button";goBtn.innerHTML=icon("send",24);goBtn.setAttribute("aria-label","Post status");
  const draw=()=>{
    const mid=$("st_mid"),bot=$("st_bot"),bgEl=$("st_bg");
    mid.textContent="";bot.textContent="";
    if(mode==="text"){
      bgEl.style.background=BG[bg];
      const t=E("textarea");t.id="st_t";t.maxLength=700;t.rows=3;t.placeholder="Type a status";
      t.addEventListener("input",()=>{const n=t.value.length;t.style.fontSize=(n>220?20:n>110?24:30)+"px"});
      mid.appendChild(t);
      const sw=E("div","stcsw");
      BG.forEach((g,i)=>{const d=E("i");d.style.background=g;if(i===bg)d.classList.add("on");d.onclick=()=>{bg=i;bgEl.style.background=g;[...sw.children].forEach((x,j)=>x.classList.toggle("on",j===i))};sw.appendChild(d)});
      bot.append(sw,goBtn);
      setTimeout(()=>t.focus(),50);
    }else{
      bgEl.style.background="#111";
      if(file){
        const u=URL.createObjectURL(file);
        bgEl.style.background="#111 url("+u+") center/cover no-repeat";
        const im=new Image();im.className="stcimg";im.alt="";im.src=u;
        const veil=E("div");veil.style.cssText="position:absolute;inset:0;backdrop-filter:blur(22px) brightness(.55);-webkit-backdrop-filter:blur(22px) brightness(.55)";
        w.querySelector(".stcmid").append(veil,im);
        const cap=E("input","stccap");cap.type="text";cap.id="st_cap";cap.maxLength=200;cap.placeholder="Add a caption…";
        bot.append(cap,goBtn);
      }else{
        const b=E("button","stcpick");b.type="button";b.innerHTML=icon("image",40)+"<span>Choose a photo</span>";b.onclick=()=>$("st_f").click();mid.appendChild(b);
      }
    }
  };
  w.querySelectorAll(".stcmode button").forEach(b=>b.onclick=()=>{
    mode=b.dataset.m;w.querySelectorAll(".stcmode button").forEach(x=>x.classList.toggle("on",x===b));draw();
  });
  $("st_f").onchange=()=>{file=$("st_f").files[0]||null;draw()};
  const close=()=>{if(gone)return;gone=true;w.remove()};
  rel=pushLayer(()=>{if(!busy)close()});                              // Back button
  const ui=()=>{if(busy)return;rel();close()};
  $("st_x").onclick=ui;
  goBtn.onclick=async()=>{
    if(busy)return;
    try{
      busy=true;goBtn.disabled=true;say("Posting…");
      if(mode==="text"){
        const t=($("st_t").value||"").trim();if(!t)throw new Error("Type something first");
        await postText(t,BG[bg]);
      }else{
        if(!file)throw new Error("Choose a photo first");
        const url=await upload(file,say);
        await postPhoto(url,($("st_cap")||{}).value);
      }
      busy=false;rel();close();toast("Status posted",true);
    }catch(e){busy=false;goBtn.disabled=false;say(NOTE);toast(e.message||"Could not post status")}
  };
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
  el.innerHTML='<div class="stpb"></div><div class="sthd"><div class="stc"></div><div class="stmeta"><b></b><small></small></div>'
    +'<button type="button" class="stdl" aria-label="Delete status" hidden>'+icon("trash",22)+'</button>'
    +'<button type="button" class="stcl" aria-label="Close">'+icon("close",24)+'</button></div><div class="stsg"></div><div class="stbar"></div>';
  document.body.appendChild(el);
  const bar=el.querySelector(".stbar"),dl=el.querySelector(".stdl"),pb=el.querySelector(".stpb"),sg=el.querySelector(".stsg"),
        av=el.querySelector(".sthd .stc"),nm=el.querySelector(".stmeta b"),tm=el.querySelector(".stmeta small");
  let raf=0,last=0,el_ms=0,dur=5000,paused=false,uiHold=false,unv=null,vdocs=[],run=false,gone=false,relV=null,relS=null,inp=null;

  const fin=()=>{                                          // actual teardown
    if(gone)return;gone=true;unv&&unv();cancelAnimationFrame(raf);
    removeEventListener("keydown",key);
    el.classList.add("st-out");                                // stay for a moment so the closing tap
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
  el.querySelector(".stcl").onclick=close;

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
    p.textContent="";p.appendChild(E("div","stgr"));
    const h=E("h4",null,"Viewed by "+vdocs.length),x=E("button");x.type="button";x.innerHTML=icon("close",20);x.setAttribute("aria-label","Close");
    x.onclick=closeSheet;h.appendChild(x);p.appendChild(h);
    if(!vdocs.length)p.appendChild(E("p",null,"No views yet"));
    vdocs.forEach(d=>{
      const r=E("div","strw"),a=E("div","stc"),n=E("span","stnm",d.name||"User");setAv(a,d.name,d.photo);
      r.append(a,n,E("small",null,agoText(d.at)));p.appendChild(r);
      userOf(d.id).then(u=>{if(u.name)n.textContent=u.name;if(u.name||u.photo)setAv(a,u.name||d.name,u.photo||d.photo)});
    });
  };
  const closeSheet=()=>{
    const p=el.querySelector(".stvl");if(p)p.remove();
    uiHold=false;if(relS){const r=relS;relS=null;r()}
  };
  const openSheet=()=>{
    if(el.querySelector(".stvl"))return;
    uiHold=true;
    const p=E("div","stvl");el.appendChild(p);fillViews(p);
    let y0=null;                                           // swipe down to dismiss
    p.addEventListener("pointerdown",e=>{y0=e.clientY});
    p.addEventListener("pointerup",e=>{if(y0!=null&&e.clientY-y0>60&&p.scrollTop<=0)closeSheet();y0=null});
    relS=pushLayer(()=>{const q=el.querySelector(".stvl");if(q)q.remove();uiHold=false;relS=null});
  };

  const side=s=>{                                          // bottom bar per status
    unv&&unv();unv=null;vdocs=[];uiHold=false;inp=null;
    const own=s.uid===me.uid;
    dl.hidden=!own;el.classList.toggle("st-rp",!own);el.classList.toggle("st-ow",own);bar.textContent="";
    const old=el.querySelector(".stvl");if(old){old.remove();if(relS){const r=relS;relS=null;r()}}
    if(own){
      const v=E("button","stvw");v.type="button";v.setAttribute("aria-label","Viewed by");
      v.innerHTML=icon("eye",22)+'<span>0</span>';bar.appendChild(v);
      unv=onSnapshot(collection(db,"status",s.id,"views"),q=>{
        vdocs=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>ms(b.at)-ms(a.at));
        v.lastChild.textContent=vdocs.length;
        const p=el.querySelector(".stvl");if(p)fillViews(p);
      },()=>{});
      v.onclick=openSheet;
    }else{
      recordView(s);
      inp=E("input");inp.type="text";inp.maxLength=500;inp.placeholder="Reply…";inp.autocomplete="off";inp.setAttribute("aria-label","Reply to status");
      const b=E("button","stsd");b.type="button";b.innerHTML=icon("send",20);b.setAttribute("aria-label","Send reply");
      inp.onfocus=()=>{uiHold=true};inp.onblur=()=>{uiHold=false};
      const go2=async()=>{
        const t=inp.value.trim();if(!t||b.disabled)return;
        b.disabled=true;
        try{await sendReply(s,t);inp.value="";inp.blur();toast("Reply sent",true)}
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
      const src=s.url.replace("/upload/","/upload/w_1200,q_auto,f_auto/");
      const bl=E("div","stblur");bl.style.backgroundImage='url("'+src+'")';sg.appendChild(bl);   // blurred fill, no empty bars
      const im=new Image();im.alt="";im.draggable=false;
      im.onload=go;im.onerror=go;im.src=src;
      sg.appendChild(im);
      if(s.caption)sg.appendChild(E("div","stcp",s.caption));
    }else{
      sg.style.background=s.bg||BG[0];dur=Math.min(9000,3500+(s.text||"").length*45);
      sg.appendChild(E("div","sttx",s.text));go();
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
    if(el.querySelector(".stvl")){closeSheet();dn=false;return}
    dn=true;x0=e.clientX;y0=e.clientY;hold=false;moved=false;
    clearTimeout(ht);
    ht=setTimeout(()=>{if(dn&&!moved){hold=true;paused=true;el.classList.add("st-hold")}},HOLD_MS);
    try{sg.setPointerCapture(e.pointerId)}catch(_){}
  });
  sg.addEventListener("pointermove",e=>{
    if(!dn)return;
    if(Math.abs(e.clientX-x0)>14||Math.abs(e.clientY-y0)>14){moved=true;clearTimeout(ht)}
  });
  const end=(e,cancel)=>{
    if(!dn)return;dn=false;clearTimeout(ht);
    const wasHold=hold;hold=false;paused=false;el.classList.remove("st-hold");
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
