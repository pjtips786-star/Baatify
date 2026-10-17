/* ===== status.js (Part 1+2+3): status banana, status row, viewer, reply, seen-by, delete =====
   Data: status/{id} = {uid,name,photo,type:"text"|"photo",text,bg,url,caption,viewers[],createdAt,expiresAt}
   viewers = post karte waqt jinse chat hai (unhi ko dikhega).  24 ghante baad expiresAt se gayab. */
import {doc,addDoc,setDoc,updateDoc,increment,deleteDoc,collection,query,where,onSnapshot,serverTimestamp,Timestamp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const {db}=await import("./firebase.js"+(window.V||""));

const CLOUD="dzbqkvysn",PRESET="Baatify";
const HOURS=24;
const BG=["linear-gradient(135deg,#00a884,#075e54)","linear-gradient(135deg,#ff6b81,#c2185b)","linear-gradient(135deg,#7f5af0,#2cb1ff)","linear-gradient(135deg,#ffb347,#ff5e62)","linear-gradient(135deg,#43cea2,#185a9d)","linear-gradient(135deg,#434343,#000000)"];
const $=id=>document.getElementById(id);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};

let me=null,getChats=()=>[],mine=[],others=[],subs=[],listeners=new Set();
const now=()=>Date.now();
const ms=t=>t&&t.toMillis?t.toMillis():0;

/* ---------- data layer (Part 2/3 me bhi yahi use hoga) ---------- */
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
  if(!v.length)throw new Error("You have no chats yet");
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
    x.ontimeout=()=>rej(new Error("Timed out"));x.onerror=()=>rej(new Error("Network error"));
    x.upload.onprogress=e=>{if(e.lengthComputable)say("Uploading "+Math.round(e.loaded/e.total*100)+"%")};
    x.onload=()=>{let j={};try{j=JSON.parse(x.responseText)}catch(e){}
      x.status<300&&j.secure_url?res(j.secure_url):rej(new Error((j.error&&j.error.message)||"Upload failed"))};
    x.send(fd);
  });
}

/* ---------- composer (New Status) ---------- */
function css(){
  if($("stcss"))return;
  const s=E("style");s.id="stcss";
  s.textContent=`
#stbtn{position:relative}
#stsh{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)}
#stsh .bx{width:min(100%,520px);max-height:92vh;overflow:auto;background:var(--panel,#202c33);color:var(--text,#e9edef);border-radius:18px 18px 0 0;padding:14px 14px 18px;display:grid;gap:12px}
#stsh .hd{display:flex;align-items:center;justify-content:space-between;font-weight:700}
#stsh .hd button{border:0;background:none;color:inherit;font-size:20px;cursor:pointer;padding:4px 8px}
#stsh .tb{display:flex;gap:8px}
#stsh .tb button,#stsh .go,#stsh .pk{border:0;border-radius:20px;padding:9px 18px;font:600 14px system-ui,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:inherit}
#stsh .tb button.on,#stsh .go{background:var(--g,#00a884);color:#fff}
#stsh .go[disabled]{opacity:.5}
#stsh .pv{aspect-ratio:9/12;max-height:46vh;border-radius:14px;display:grid;place-items:center;padding:18px;text-align:center;overflow:hidden;position:relative;background-size:cover;background-position:center}
#stsh textarea{width:100%;height:100%;background:none;border:0;outline:0;resize:none;color:#fff;text-align:center;font:600 24px/1.3 system-ui,sans-serif}
#stsh textarea::placeholder{color:rgba(255,255,255,.65)}
#stsh .pv img{width:100%;height:100%;object-fit:contain;background:#000}
#stsh .sw{display:flex;gap:8px;justify-content:center}
#stsh .sw i{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer}
#stsh .sw i.on{border-color:#fff}
#stsh input[type=text]{width:100%;padding:10px 12px;border-radius:10px;border:0;background:rgba(255,255,255,.1);color:inherit;font:15px system-ui,sans-serif}
#stsh .ms{display:grid;gap:6px;font-size:14px}
#stsh .ms>div{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border-radius:10px;padding:8px 10px}
#stsh .ms b{flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#stsh .ms button{border:0;background:none;color:#ff6b81;font-weight:700;cursor:pointer}
#stsh .nt{font-size:13px;opacity:.75;min-height:18px}`;
  document.head.appendChild(s);
}
const agoText=t=>{const m=Math.round((now()-ms(t))/6e4);return m<1?"Just now":m<60?m+" min ago":Math.floor(m/60)+" hours ago"};
function toast(t){const e=$("toast");if(!e){alert(t);return}e.textContent=t;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),3000)}

function openComposer(){
  if($("stsh"))return;css();
  let mode="text",bg=0,file=null,busy=false;
  const w=E("div");w.id="stsh";
  w.innerHTML='<div class="bx" role="dialog" aria-label="New Status"><div class="hd"><span>New Status</span><button type="button" id="st_x" aria-label="Close">✕</button></div>'
   +'<div class="tb"><button type="button" data-m="text" class="on">Text</button><button type="button" data-m="photo">Photo</button></div>'
   +'<div class="pv" id="st_pv"></div><div class="sw" id="st_sw"></div>'
   +'<input type="text" id="st_cap" maxlength="200" placeholder="Caption (optional)" style="display:none">'
   +'<input type="file" id="st_f" accept="image/*" style="display:none">'
   +'<div class="nt" id="st_nt"></div><button type="button" class="go" id="st_go">Post (24 hours)</button>'
   +'<div class="ms" id="st_ms"></div></div>';
  document.body.appendChild(w);
  const say=t=>{$("st_nt").textContent=t};
  const draw=()=>{
    const pv=$("st_pv");pv.textContent="";pv.style.background="";
    $("st_sw").style.display=mode==="text"?"":"none";$("st_cap").style.display=mode==="photo"?"":"none";
    if(mode==="text"){
      pv.style.background=BG[bg];
      const t=E("textarea");t.id="st_t";t.maxLength=700;t.placeholder="Write something…";pv.appendChild(t);
    }else if(file){
      const im=new Image();im.alt="";im.src=URL.createObjectURL(file);pv.appendChild(im);
    }else{
      const b=E("button","pk","Choose Photo");b.type="button";b.onclick=()=>$("st_f").click();pv.appendChild(b);
    }
  };
  const sw=$("st_sw");
  BG.forEach((g,i)=>{const d=E("i");d.style.background=g;d.onclick=()=>{bg=i;[...sw.children].forEach((x,j)=>x.classList.toggle("on",j===i));$("st_pv").style.background=g};sw.appendChild(d)});
  sw.firstChild.classList.add("on");
  w.querySelectorAll(".tb button").forEach(b=>b.onclick=()=>{
    mode=b.dataset.m;w.querySelectorAll(".tb button").forEach(x=>x.classList.toggle("on",x===b));draw();
  });
  $("st_f").onchange=()=>{file=$("st_f").files[0]||null;draw()};
  const close=()=>{if(busy)return;w.remove()};
  $("st_x").onclick=close;w.onclick=e=>{if(e.target===w)close()};
  $("st_go").onclick=async()=>{
    if(busy)return;
    try{
      busy=true;$("st_go").disabled=true;say("Posting…");
      if(mode==="text"){
        const t=($("st_t").value||"").trim();if(!t)throw new Error("Please enter some text");
        await postText(t,BG[bg]);
      }else{
        if(!file)throw new Error("Please choose a photo");
        const url=await upload(file,say);
        await postPhoto(url,$("st_cap").value);
      }
      busy=false;w.remove();toast("Status posted ✓");
    }catch(e){busy=false;$("st_go").disabled=false;say("");toast(e.message||"Error")}
  };
  /* mere active status: dekho aur hatao */
  const un=onStatus(({mine:m})=>{
    if(!document.body.contains(w)){un();return}
    const box=$("st_ms");box.textContent="";
    if(m.length)box.appendChild(E("div","nt","My Status ("+m.length+")"));
    m.slice().reverse().forEach(s=>{
      const r=E("div"),b=E("b",null,(s.type==="photo"?"🖼 ":"")+(s.type==="photo"?(s.caption||"Photo"):s.text)),a=E("small",null,agoText(s.createdAt)),x=E("button",null,"Delete");
      x.type="button";x.onclick=async()=>{x.disabled=true;try{await removeStatus(s.id)}catch(e){toast("Failed to delete");x.disabled=false}};
      r.append(b,a,x);box.appendChild(r);
    });
  });
  draw();
}

/* ---------- Part 2: seen (is phone me) ---------- */
const SEEN="bt_st_seen";
const seenSet=()=>{try{return new Set(JSON.parse(localStorage.getItem(SEEN)||"[]"))}catch(e){return new Set()}};
const markSeen=id=>{const a=[...seenSet(),id].slice(-300);try{localStorage.setItem(SEEN,JSON.stringify(a))}catch(e){}};

function css2(){
  if($("stcss2"))return;
  const s=E("style");s.id="stcss2";
  s.textContent=`
#strow{display:flex;gap:14px;overflow-x:auto;padding:10px 12px 8px;flex:none;scrollbar-width:none;border-bottom:1px solid var(--line,#222d34)}
#strow::-webkit-scrollbar{display:none}
#strow.hide{display:none}
.sti{flex:none;width:66px;display:grid;justify-items:center;gap:4px;background:none;border:0;padding:0;color:inherit;cursor:pointer;font:inherit}
.sti small{font-size:12px;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mute,#8696a0)}
.str{box-sizing:border-box;position:relative;width:60px;height:60px;border-radius:50%;padding:4px;background:var(--mute,#8696a0);display:grid;place-items:center}
.str.new{background:conic-gradient(var(--g,#00a884),#7ee8c7,var(--g,#00a884))}
.str.none{background:none;border:2px dashed var(--mute,#8696a0);padding:1px}
.stc{box-sizing:border-box;width:100%;height:100%;border-radius:50%;background:var(--g,#00a884) center/cover no-repeat;border:3px solid var(--side,#111b21);display:grid;place-items:center;color:#fff;font-weight:700;overflow:hidden}
.str.none .stc{border:0}
.stp{position:absolute;right:-2px;bottom:-2px;width:20px;height:20px;border-radius:50%;background:var(--g,#00a884);color:#fff;display:grid;place-items:center;font:700 15px/1 system-ui;border:2px solid var(--side,#111b21)}
#stv{position:fixed;inset:0;z-index:95;background:#000;color:#fff;display:flex;flex-direction:column;touch-action:pan-y;user-select:none;-webkit-user-select:none;animation:stin .22s ease}
@keyframes stin{from{opacity:0;transform:scale(.97)}}
#stv .pb{display:flex;gap:4px;padding:calc(8px + env(safe-area-inset-top,0px)) 10px 0;position:relative;z-index:3}
#stv .pb i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.35);overflow:hidden}
#stv .pb i b{display:block;height:100%;width:0;background:#fff}
#stv .hd2{display:flex;align-items:center;gap:10px;padding:10px 12px;position:relative;z-index:3;text-shadow:0 1px 4px rgba(0,0,0,.6)}
#stv .hd2 .stc{width:38px;height:38px;flex:none;border:0}
#stv .hd2 div{flex:1;min-width:0;line-height:1.25}
#stv .hd2 b{display:block;font-size:15px}
#stv .hd2 small{opacity:.85;font-size:12px}
#stv .hd2 button{border:0;background:none;color:#fff;font-size:22px;padding:6px 10px;cursor:pointer}
#stv .sg{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden}
#stv .sg img{width:100%;height:100%;object-fit:contain}
#stv .sg .tx{padding:28px;text-align:center;font:600 28px/1.35 system-ui,sans-serif;word-break:break-word;white-space:pre-wrap;max-height:100%;overflow:hidden}
#stv .cp{position:absolute;left:0;right:0;bottom:0;padding:40px 18px calc(22px + env(safe-area-inset-bottom,0px));text-align:center;background:linear-gradient(transparent,rgba(0,0,0,.7));font-size:16px;z-index:2}
#stv.rp .cp{padding-bottom:92px}
#stv .bar{position:absolute;left:0;right:0;bottom:0;z-index:4;padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;justify-content:center}
#stv .bar input{flex:1;min-width:0;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.35);color:#fff;border-radius:24px;padding:11px 16px;font:15px system-ui,sans-serif;outline:0}
#stv .bar input::placeholder{color:rgba(255,255,255,.7)}
#stv .bar button{border:0;border-radius:24px;padding:11px 18px;background:var(--g,#00a884);color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer}
#stv .bar .vw{background:rgba(0,0,0,.45);padding:10px 20px}
#stv .vl{position:absolute;left:0;right:0;bottom:0;z-index:6;max-height:60%;overflow:auto;background:var(--panel,#202c33);color:var(--text,#e9edef);border-radius:18px 18px 0 0;padding:14px;display:grid;gap:8px;animation:stfa .2s ease}
#stv .vl h4{margin:0 0 4px;font:700 15px system-ui,sans-serif;display:flex;justify-content:space-between}
#stv .vl h4 button{border:0;background:none;color:inherit;font-size:18px;cursor:pointer}
#stv .vl div.r{display:flex;align-items:center;gap:10px;font:14px system-ui,sans-serif}
#stv .vl .stc{width:36px;height:36px;border:0;flex:none}
#stv .vl small{margin-left:auto;opacity:.7}
#stv .vl p{margin:0;opacity:.7;font:14px system-ui,sans-serif}
#stv .fa{animation:stfa .3s ease}
@keyframes stfa{from{opacity:0}}`;
  document.head.appendChild(s);
}
const setAv=(el,name,photo)=>{
  if(photo){el.style.backgroundImage='url("'+photo.replace(/"/g,"%22")+'")';el.textContent=""}
  else{el.style.backgroundImage="";el.textContent=(name||"?")[0].toUpperCase()}
};

/* ---------- Part 3: seen-by record + reply ---------- */
const VW="bt_st_vw";
function recordView(s){
  let a=[];try{a=JSON.parse(localStorage.getItem(VW)||"[]")}catch(e){}
  if(a.includes(s.id))return;
  setDoc(doc(db,"status",s.id,"views",me.uid),{name:me.name,photo:me.photo||"",at:serverTimestamp()})
    .then(()=>{a.push(s.id);try{localStorage.setItem(VW,JSON.stringify(a.slice(-300)))}catch(e){}}).catch(()=>{});
}
async function sendReply(s,text){
  const id=[me.uid,s.uid].sort().join("_");
  const pv=s.type==="photo"?"\ud83d\udcf7 "+(s.caption||"Photo"):s.text;
  await addDoc(collection(db,"chats",id,"messages"),{sender:me.uid,t:serverTimestamp(),seen:false,text,reply:{n:"Status",t:pv.slice(0,80)}});
  await updateDoc(doc(db,"chats",id),{lastMsg:text,lastAt:serverTimestamp(),lastFrom:me.uid,lastDel:false,["unread."+s.uid]:increment(1)});
  try{window.__stPush&&window.__stPush(s.uid,text)}catch(e){}
}

/* ---------- full-screen viewer ---------- */
function openViewer(groups,gi,si){
  if($("stv")||!groups[gi])return;css2();
  const ovf=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";
  const el=E("div");el.id="stv";el.setAttribute("role","dialog");el.setAttribute("aria-label","Status");
  el.innerHTML='<div class="pb"></div><div class="hd2"><div class="stc"></div><div><b></b><small></small></div><button type="button" class="dl" aria-label="Delete status" hidden>\ud83d\uddd1</button><button type="button" class="cl" aria-label="Close">\u2715</button></div><div class="sg"></div><div class="bar"></div>';
  document.body.appendChild(el);
  const bar=el.querySelector(".bar"),dl=el.querySelector(".dl"),pb=el.querySelector(".pb"),sg=el.querySelector(".sg"),av=el.querySelector(".hd2 .stc"),nm=el.querySelector(".hd2 b"),tm=el.querySelector(".hd2 small");
  let raf=0,last=0,el_ms=0,dur=5000,paused=false,uiHold=false,unv=null,vdocs=[],run=false,gone=false;
  const close=()=>{if(gone)return;gone=true;unv&&unv();cancelAnimationFrame(raf);el.remove();document.documentElement.style.overflow=ovf;removeEventListener("keydown",key);renderStrip()};
  const key=e=>{if(e.target&&e.target.tagName==="INPUT"){if(e.key==="Escape")e.target.blur();return}
    if(e.key==="Escape")close();else if(e.key==="ArrowRight")next();else if(e.key==="ArrowLeft")prev()};
  addEventListener("keydown",key);
  el.querySelector(".hd2 .cl").onclick=close;
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
  const side=s=>{                                     // Part 3: reply / seen-by / delete
    unv&&unv();unv=null;vdocs=[];uiHold=false;
    const own=s.uid===me.uid;
    dl.hidden=!own;el.classList.toggle("rp",!own);bar.textContent="";
    const old=el.querySelector(".vl");old&&old.remove();
    if(own){
      const v=E("button","vw","\ud83d\udc41 0");v.type="button";bar.appendChild(v);
      unv=onSnapshot(collection(db,"status",s.id,"views"),q=>{
        vdocs=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>ms(b.at)-ms(a.at));
        v.textContent="\ud83d\udc41 "+vdocs.length;
        const p=el.querySelector(".vl");if(p)fillViews(p);
      },()=>{});
      v.onclick=()=>{
        if(el.querySelector(".vl"))return;
        uiHold=true;
        const p=E("div","vl");el.appendChild(p);fillViews(p);
      };
    }else{
      recordView(s);
      const inp=E("input");inp.type="text";inp.maxLength=500;inp.placeholder="Reply\u2026";inp.autocomplete="off";
      const b=E("button",null,"Send");b.type="button";
      inp.onfocus=()=>{uiHold=true};inp.onblur=()=>{uiHold=false};
      const go2=async()=>{
        const t=inp.value.trim();if(!t||b.disabled)return;
        b.disabled=true;
        try{await sendReply(s,t);inp.value="";inp.blur();toast("Reply sent \u2713")}
        catch(e){toast("Failed to send reply")}
        b.disabled=false;
      };
      b.onclick=go2;inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go2()}};
      bar.append(inp,b);
    }
  };
  const fillViews=p=>{
    p.textContent="";
    const h=E("h4",null,"Seen by "+vdocs.length),x=E("button",null,"\u2715");x.type="button";
    x.onclick=()=>{p.remove();uiHold=false};h.appendChild(x);p.appendChild(h);
    if(!vdocs.length)p.appendChild(E("p",null,"No views yet"));
    vdocs.forEach(d=>{
      const r=E("div","r"),a=E("div","stc");setAv(a,d.name,d.photo);
      r.append(a,E("span",null,d.name||"User"),E("small",null,agoText(d.at)));p.appendChild(r);
    });
  };
  dl.onclick=async()=>{
    const s=groups[gi][si];
    if(!confirm("Delete this status?"))return;
    uiHold=true;
    try{await removeStatus(s.id)}catch(e){toast("Failed to delete");uiHold=false;return}
    groups[gi].splice(si,1);uiHold=false;
    if(!groups[gi].length){close();return}
    if(si>=groups[gi].length)si=groups[gi].length-1;
    show();
  };
  const show=()=>{
    const g=groups[gi],s=g[si];
    run=false;cancelAnimationFrame(raf);bars();
    setAv(av,s.name,s.photo);nm.textContent=s.uid===me.uid?"My Status":s.name;tm.textContent=agoText(s.createdAt);
    sg.textContent="";sg.className="sg fa";sg.style.background="";
    markSeen(s.id);
    side(s);
    if(s.type==="photo"){
      sg.style.background="#000";dur=6000;
      const im=new Image();im.alt="";
      im.onload=go;im.onerror=go;im.src=s.url.replace("/upload/","/upload/w_1200,q_auto,f_auto/");
      sg.appendChild(im);
      if(s.caption)sg.appendChild(E("div","cp",s.caption));
    }else{
      sg.style.background=s.bg||BG[0];dur=Math.min(9000,3500+(s.text||"").length*45);
      sg.appendChild(E("div","tx",s.text));go();
    }
    void sg.offsetWidth;
  };
  function next(){
    if(si<groups[gi].length-1){si++;show();return}
    if(gi<groups.length-1&&groups[gi][0].uid!==me.uid){gi++;si=0;show();return}      // agle contact ka status
    close();
  }
  function prev(){
    if(si>0){si--;show();return}
    if(gi>0&&groups[gi][0].uid!==me.uid){gi--;si=0;show();return}
    show();
  }
  /* tap: aage/peeche · dabaye rakho: ruko · neeche kheencho: band */
  let dn=0,x0=0,y0=0;
  sg.addEventListener("pointerdown",e=>{dn=performance.now();x0=e.clientX;y0=e.clientY;paused=true});
  const up=e=>{
    if(!dn)return;paused=false;
    const dt=performance.now()-dn,dx=e.clientX-x0,dy=e.clientY-y0;dn=0;
    if(dy>90&&Math.abs(dx)<80){close();return}
    if(dt<260&&Math.abs(dx)<12&&Math.abs(dy)<12){(e.clientX<innerWidth*.35)?prev():next()}
  };
  sg.addEventListener("pointerup",up);
  sg.addEventListener("pointercancel",()=>{dn=0;paused=false});
  show();
}

/* ---------- Status row above the chat list ---------- */
let strip=null,snap={mine:[],groups:[]};
function renderStrip(){
  if(!strip)return;
  const seen=seenSet(),m=snap.mine;
  strip.textContent="";
  const item=(label,name,photo,cls,click,plus)=>{
    const b=E("button","sti");b.type="button";
    const r=E("div","str "+cls),c=E("div","stc");setAv(c,name,photo);r.appendChild(c);
    if(plus){const p=E("span","stp","+");p.onclick=e=>{e.stopPropagation();openComposer()};r.appendChild(p)}
    b.append(r,E("small",null,label));b.onclick=click;strip.appendChild(b);
  };
  item("My Status",me.name,me.photo,m.length?"":"none",
    ()=>{m.length?openViewer([m],0,0):openComposer()},true);
  snap.groups.forEach((g,gi)=>{
    const unseen=g.findIndex(s=>!seen.has(s.id)),l=g[g.length-1];
    item(l.name,l.name,l.photo,unseen>=0?"new":"",()=>openViewer(snap.groups,gi,unseen>=0?unseen:0));
  });
}

/* ---------- header me status button ---------- */
export function initStatus(user,chatsFn){
  me=user;getChats=chatsFn||getChats;
  watch();
  const head=document.querySelector("#side>header"),anchor=$("adm")||$("out");
  if(head&&!$("stbtn")){
    const b=E("button","ic");b.id="stbtn";b.type="button";b.setAttribute("aria-label","New Status");
    b.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/><path d="M12 8v8M8 12h8"/></svg>';
    b.onclick=openComposer;
    head.insertBefore(b,anchor);
  }
  const list=$("list");
  if(list&&!$("strow")){
    css2();
    strip=E("div");strip.id="strow";strip.setAttribute("aria-label","Status");
    list.parentNode.insertBefore(strip,list);
    const res=$("res");                                   // search chal raha ho to row chhupao
    if(res)new MutationObserver(()=>strip.classList.toggle("hide",!res.classList.contains("hide"))).observe(res,{attributes:true,attributeFilter:["class"]});
    onStatus(v=>{snap=v;renderStrip()});
  }
}
