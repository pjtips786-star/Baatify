
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc,setDoc,updateDoc,addDoc,collection,query,where,orderBy,limit,startAt,startAfter,endAt,onSnapshot,getDocs,serverTimestamp,increment} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const V=window.V||"";
const {auth,db}=await import("./firebase.js"+V);
const {initCalls,startCall}=await import("./call.js"+V);

/* ====== CONFIG: apni Cloudinary values daalo ====== */
const CLOUD="dzbqkvysn", PRESET="Baatify";
/* ================================================== */

const $=id=>document.getElementById(id);
const show=(id,on)=>$(id).classList.toggle("hide",!on);
const ico=n=>'<svg class="i" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const SNAP={serverTimestamps:"estimate"};
let me=null,cur=null,chats=null,chatsAll=[],msgs=[],seen=new Set();
let first=false,force=false,selId=null,rep=null,editing=null,ou={},clr=0,vurl="",askRes,swiped=false;
let unsubL,unsubM,unsubU,st,hb,lt=0;
let inChat=false,vOpen=false,iOpen=false;
let all=new Map(),hasMore=true,loadingOld=false;
const PAGE=30;
let pinned=true,scAnim=null;
const uc=new Map();
const fmtDur=s=>{s=Math.floor(s||0);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
let rec=null,pl=null;
const sentSeen=new Set();

/* ---------- Keyboard / zoom fix ---------- */
const vv=window.visualViewport;
function fit(){
  const h=vv?vv.height:innerHeight;
  document.documentElement.style.setProperty("--vh",h+"px");
  $("app").style.top=(vv?vv.offsetTop:0)+"px";
  window.scrollTo(0,0);
}
if(vv){vv.addEventListener("resize",fit);vv.addEventListener("scroll",fit)}
addEventListener("resize",fit);fit();
document.addEventListener("gesturestart",e=>e.preventDefault());

/* ---------- Helpers ---------- */
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),2500)}
function fmt(d){return d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}
function dayLabel(d){
  const s=x=>x.toDateString();
  return s(d)===s(new Date())?"Today":s(d)===s(new Date(Date.now()-864e5))?"Yesterday":d.toLocaleDateString([], {day:"numeric",month:"short",year:"numeric"});
}
function short(ts){if(!ts)return"";const d=ts.toDate();return dayLabel(d)==="Today"?fmt(d):d.toLocaleDateString([], {day:"numeric",month:"short"})}
function setAv(el,name,photo){
  if(photo){el.style.backgroundImage='url("'+photo+'")';el.textContent=""}
  else{el.style.backgroundImage="";el.textContent=(name||"?")[0].toUpperCase()}
}
async function getU(uid){
  if(uc.has(uid))return uc.get(uid);
  const s=await getDoc(doc(db,"users",uid));
  const u=s.exists()?s.data():{};uc.set(uid,u);return u;
}
const tms=x=>x&&x.toMillis?x.toMillis():0;
const clrOf=c=>c&&c.cleared?tms(c.cleared[me.uid]):0;

// confirm sheet
function ask(t,y){return new Promise(r=>{$("st").textContent=t;$("syes").textContent=y;show("sheet",1);askRes=r})}
$("sno").onclick=()=>{show("sheet",0);askRes&&askRes(false)};
$("syes").onclick=()=>{show("sheet",0);askRes&&askRes(true)};
$("sheet").onclick=e=>{if(e.target===$("sheet"))$("sno").click()};

// header jaldi dikhane ke liye (pichli baar ka naam/photo)
try{const c=JSON.parse(localStorage.getItem("bt_me")||"null");if(c){$("mn").textContent=c.name;setAv($("me"),c.name,c.photo)}}catch(e){}

/* ---------- Auth + presence ---------- */
onAuthStateChanged(auth,u=>{
  if(!u){location.replace("login.html");return}
  boot(u);
});

async function logout(){
  await pres(false);
  try{localStorage.removeItem("bt_me")}catch(e){}
  signOut(auth);
}
$("out").onclick=logout;

function pres(on){
  if(!me)return Promise.resolve();
  return updateDoc(doc(db,"users",me.uid),{online:on,lastSeen:serverTimestamp()}).catch(()=>{});
}
document.addEventListener("visibilitychange",()=>{pres(!document.hidden);if(!document.hidden&&cur)markSeen()});
addEventListener("pagehide",()=>pres(false));

async function boot(u){
  try{
    const s=await getDoc(doc(db,"users",u.uid));
    if(!s.exists()){await signOut(auth);return}
    me={uid:u.uid,...s.data()};
  }catch(e){toast("Could not load profile");return}
  try{localStorage.setItem("bt_me",JSON.stringify({name:me.name,photo:me.photo||""}))}catch(e){}
  $("mn").textContent=me.name;setAv($("me"),me.name,me.photo);
  initCalls({uid:me.uid,name:me.name,photo:me.photo||""});
  pres(true);clearInterval(hb);hb=setInterval(()=>{if(!document.hidden)pres(true)},180000);
  unsubL&&unsubL();
  unsubL=onSnapshot(
    query(collection(db,"chats"),where("members","array-contains",u.uid)),
    s=>{
      chatsAll=s.docs.map(d=>({id:d.id,...d.data(SNAP)}));
      const hid=c=>c.hidden&&tms(c.hidden[me.uid])&&c.lastAt.toMillis()<=tms(c.hidden[me.uid]);
      chats=chatsAll.filter(c=>c.lastAt&&!hid(c)).sort((a,b)=>b.lastAt.toMillis()-a.lastAt.toMillis());
      if(cur){
        const c=chatsAll.find(x=>x.id===cur.id),cl=clrOf(c);
        if(cl!==clr){clr=cl;renderMsgs()}
        // chat khuli hai to naya unread turant 0
        if(c&&c.unread&&c.unread[me.uid]>0&&!document.hidden)
          updateDoc(doc(db,"chats",cur.id),{["unread."+me.uid]:0}).catch(()=>{});
      }
      renderList();status();
    },
    ()=>toast("Cannot load chats")
  );
}

$("me").onclick=()=>{location.href="profile.html"};

/* ---------- Chat list + search ---------- */
function row(name,sub,time,fn,active,badge,uid,photo,lp){
  const r=document.createElement("div");r.className="row"+(active?" act":"");r.tabIndex=0;
  const a=document.createElement("div");a.className="av";setAv(a,name,photo);
  if(uid&&!photo)getU(uid).then(u=>{if(u.photo)setAv(a,name,u.photo)}).catch(()=>{});
  const t=document.createElement("div");t.className="tx";
  const b=document.createElement("b");b.textContent=name;
  const p=document.createElement("span");p.textContent=sub;
  t.append(b,p);r.append(a,t);
  if(time||badge){
    const c=document.createElement("div");c.className="rt";
    if(time){const tm=document.createElement("small");tm.textContent=time;c.append(tm)}
    if(badge){const bd=document.createElement("span");bd.className="bd";bd.textContent=badge>99?"99+":badge;c.append(bd)}
    r.append(c);
  }
  let tm=null,fired=false;
  if(lp){
    r.addEventListener("pointerdown",()=>{fired=false;tm=setTimeout(()=>{fired=true;lp()},550)});
    ["pointerup","pointerleave","pointercancel"].forEach(ev=>r.addEventListener(ev,()=>clearTimeout(tm)));
    r.addEventListener("contextmenu",e=>e.preventDefault());
  }
  r.onclick=()=>{if(fired){fired=false;return}fn()};
  r.onkeydown=e=>{if(e.key==="Enter")fn()};
  return r;
}

function renderList(){
  const box=$("list"),keep=box.scrollTop;box.textContent="";
  if(!chats){
    for(let i=0;i<7;i++){
      const s=document.createElement("div");s.className="row sk";
      s.innerHTML='<div class="av"></div><div class="tx"><i></i><i></i></div>';
      box.appendChild(s);
    }
    return;
  }
  if(!chats.length){
    box.innerHTML='<p class="note">No chats yet. Search a username above to start one.</p>';
    return;
  }
  chats.forEach(c=>{
    const o=c.members.find(x=>x!==me.uid),nm=(c.names&&c.names[o])||"User";
    const open=cur&&cur.id===c.id,un=(c.unread&&c.unread[me.uid])||0;
    // chat clear ho to kuch nahi, delete ho to "deleted", warna aakhri message
    const cleared=clrOf(c)>=c.lastAt.toMillis();
    let sub="";
    if(!cleared){
      if(c.lastDel)sub=c.lastFrom===me.uid?"You deleted this message":"This message was deleted";
      else sub=(c.lastFrom===me.uid?"You: ":"")+(c.lastMsg||"");
    }
    box.appendChild(row(
      nm,sub,cleared?"":short(c.lastAt),
      ()=>openChat({uid:o,name:nm}),open,open?0:un,o,"",()=>delChat(c.id,nm)
    ));
  });
  box.scrollTop=keep;
}

async function delChat(id,name){
  if(!await ask("Delete chat with "+name+"? Messages will be removed for you only.","Delete"))return;
  try{
    await updateDoc(doc(db,"chats",id),{["hidden."+me.uid]:serverTimestamp(),["cleared."+me.uid]:serverTimestamp(),["unread."+me.uid]:0});
    if(cur&&cur.id===id)closeChat(false);
    toast("Chat deleted");
  }catch(e){toast("Could not delete chat")}
}

$("q").oninput=()=>{
  clearTimeout(st);
  const v=$("q").value.trim().toLowerCase().replace(/^@/,"");
  if(!v){show("res",0);show("list",1);return}
  if(v.length<3){show("list",0);show("res",1);$("res").innerHTML='<p class="note">Type at least 3 letters</p>';return}
  st=setTimeout(()=>search(v),300);
};

async function search(v){
  show("list",0);show("res",1);
  const box=$("res");box.innerHTML='<p class="note">Searching…</p>';
  try{
    const s=await getDocs(query(collection(db,"users"),orderBy("username"),startAt(v),endAt(v+"\uf8ff"),limit(10)));
    box.textContent="";let n=0;
    s.forEach(d=>{
      if(d.id===me.uid)return;n++;
      const u=d.data();
      box.appendChild(row(u.name,"@"+u.username,"",()=>{
        $("q").value="";show("res",0);show("list",1);
        openChat({uid:d.id,name:u.name});
      },false,0,d.id,u.photo||""));
    });
    if(!n)box.innerHTML='<p class="note">No user found.</p>';
  }catch(e){box.innerHTML='<p class="note">Search failed.</p>'}
}

/* ---------- Chat screen ---------- */
async function openChat(o){
  const id=[me.uid,o.uid].sort().join("_");
  cur={id,o};seen=new Set();vcache.clear();first=true;force=false;selId=null;editing=null;ou={};
  all=new Map();hasMore=true;loadingOld=false;
  clr=clrOf(chatsAll.find(x=>x.id===id));
  unsubM&&unsubM();unsubU&&unsubU();clearRep();
  if(iOpen){iOpen=false;show("pinfo",0)}
  show("emo",0);show("menu",0);show("selbar",0);show("phead",1);
  $("on").textContent=o.name;setAv($("oa"),o.name,"");$("os").textContent="";
  show("empty",0);show("pane",1);
  if(!inChat){history.pushState({bt:"chat"},"");inChat=true}
  $("app").classList.add("open");$("msgs").textContent="";
  try{
    if(!chatsAll.some(c=>c.id===id))
      await setDoc(doc(db,"chats",id),{members:[me.uid,o.uid].sort(),names:{[me.uid]:me.name,[o.uid]:o.name}},{merge:true});
  }catch(e){toast("Could not open chat");return}
  unsubU=onSnapshot(doc(db,"users",o.uid),s=>{
    ou=s.data(SNAP)||{};setAv($("oa"),o.name,ou.photo);status();
    if(iOpen)fillInfo();
  });
let firstSnap=true;
  unsubM=onSnapshot(
    query(collection(db,"chats",id,"messages"),orderBy("t","desc"),limit(PAGE)),
    {includeMetadataChanges:true},
    s=>{
      if(firstSnap){hasMore=s.docs.length>=PAGE;firstSnap=false}
      mergeMsgs(s.docs.map(d=>({id:d.id,...d.data(SNAP),pending:d.metadata.hasPendingWrites})));
      renderMsgs();markSeen();
    },
    ()=>toast("Cannot load messages")
  );
  renderList();
}

function closeChat(resetUnread){
if(iOpen){iOpen=false;show("pinfo",0)}
if(rec)recStop(true);
  if(pl){pl.a.pause();pl=null}
  if(resetUnread&&cur)updateDoc(doc(db,"chats",cur.id),{["unread."+me.uid]:0}).catch(()=>{});
  $("app").classList.remove("open");
  unsubM&&unsubM();unsubU&&unsubU();cur=null;selId=null;
  show("pane",0);show("empty",1);renderList();
  if(inChat){inChat=false;history.back()}
}
$("back").onclick=()=>closeChat(true);

// phone ka back button
addEventListener("popstate",()=>{
  if(vOpen){vOpen=false;show("view",0);return}
  if(iOpen){iOpen=false;show("pinfo",0);return}
  if(inChat){inChat=false;closeChat(true)}
});

/* ---------- Typing + online / last seen ---------- */
function status(){
  if(!cur)return;
  const el=$("os");el.classList.remove("ty");
  const c=chatsAll.find(x=>x.id===cur.id);
  const tm=c&&c.typing?tms(c.typing[cur.o.uid]):0;
  if(tm&&Date.now()-tm<8000){el.textContent="typing…";el.classList.add("ty");return}
  const ls=tms(ou.lastSeen);
  if(ou.online&&Date.now()-ls<240000){el.textContent="online";return}
  if(!ls){el.textContent="";return}
  const dl=dayLabel(new Date(ls));
  el.textContent="last seen "+(dl==="Today"?"today":dl==="Yesterday"?"yesterday":dl)+" at "+fmt(new Date(ls));
}
setInterval(status,2000);

/* ---------- Messages ---------- */
const sel=()=>msgs.find(x=>x.id===selId);

function syncSel(){
  const m=sel();
  show("selbar",!!m);show("phead",!m);
  if(!m)return;
  const mine=m.sender===me.uid;
  $("sr").classList.toggle("hide",!!m.deleted);
  $("scp").classList.toggle("hide",!m.text||!!m.deleted);
  $("se").classList.toggle("hide",!(mine&&m.text&&!m.deleted));
  $("sd").classList.toggle("hide",!mine||!!m.deleted);
}

function renderMsgs(){
  const box=$("msgs"),top=box.scrollTop,prevH=box.scrollHeight;
  const stickNow=first||force||pinned;
  box.textContent="";let day="",prev=null;
  const vis=msgs.filter(m=>!clr||tms(m.t)>clr);
  if(selId&&!vis.some(m=>m.id===selId))selId=null;

  vis.forEach(m=>{
    const d=m.t&&m.t.toDate?m.t.toDate():new Date();
    const dl=dayLabel(d);
    if(dl!==day){
      day=dl;prev=null;
      const x=document.createElement("div");x.className="day";x.textContent=dl;box.appendChild(x);
    }
    const mine=m.sender===me.uid,el=document.createElement("div");
    el.className="m"+(mine?" me":"")+(m.sender!==prev?" tail":"")+(m.deleted?" del":"")
      +(selId===m.id?" sel":"")+(seen.has(m.id)?"":" new");
    prev=m.sender;seen.add(m.id);

    if(m.deleted){
      const t=document.createElement("div");t.className="tx2";
      t.innerHTML=ico("ban")+"<span>This message was deleted</span>";el.appendChild(t);
    }else{
      if(m.reply){
        const r=document.createElement("div");r.className="rp";
        const rb=document.createElement("b");rb.textContent=m.reply.n;
        const rs=document.createElement("span");rs.textContent=m.reply.t;
        r.append(rb,rs);el.appendChild(r);
      }
      if(m.audio){el.appendChild(voiceEl(m))}
      else if(m.video){el.appendChild(videoEl(m))}
      else if(m.img){
        const im=document.createElement("img");
        im.src=m.img;im.alt="Photo";im.loading="lazy";
        im.onload=()=>{if(stickNow)box.scrollTop=box.scrollHeight};
        im.onclick=e=>{e.stopPropagation();vurl=m.img;$("vimg").src=m.img;show("view",1);history.pushState({bt:"view"},"");vOpen=true};
        el.appendChild(im);
      }else{
        const t=document.createElement("div");t.textContent=m.text;el.appendChild(t);
      }
    }
    const meta=document.createElement("div");meta.className="meta";
    const tt=document.createElement("span");tt.textContent=(m.edited&&!m.deleted?"edited ":"")+fmt(d);meta.appendChild(tt);
   if(mine){
      const k=document.createElement("span");
      k.className="tk"+(m.pending?" wait":"")+(!m.pending&&m.seen?" seen":"");
      k.innerHTML=ico(m.pending?"clock":"check2");
      meta.appendChild(k);
    }
    el.appendChild(meta);

    // left swipe = reply
    if(!m.deleted){
      let sx=0,sy=0,dx=0;
      el.addEventListener("touchstart",e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;el.style.transition="none"},{passive:true});
      el.addEventListener("touchmove",e=>{
        const x=e.touches[0].clientX-sx,y=e.touches[0].clientY-sy;
        if(Math.abs(y)>Math.abs(x)&&!dx)return;
        dx=Math.max(-90,Math.min(0,x));el.style.transform="translateX("+dx+"px)";
      },{passive:true});
      el.addEventListener("touchend",()=>{
        el.style.transition="";el.style.transform="";
        if(dx<-8){swiped=true;setTimeout(()=>{swiped=false},400)}
        if(dx<-60)setRep(m);
        dx=0;
      });
    }
    el.onclick=()=>{
      if(swiped){swiped=false;return}
      selId=selId===m.id?null:m.id;renderMsgs();
    };
    box.appendChild(el);
  });

  // pehli baar seedha neeche, baad mein naram
  if(first){box.scrollTop=box.scrollHeight;first=false;pinned=true}
  else if(stickNow){
    box.scrollTop=top;
    if(!scAnim&&(force||box.scrollHeight>prevH))smoothBottom();
    force=false;
  }else box.scrollTop=top;
  syncSel();
}

$("msgs").onclick=e=>{if(e.target===$("msgs")&&selId){selId=null;renderMsgs()}};
/* ---------- Smooth scroll (list dobara bane tab bhi na ruke) ---------- */
function smoothBottom(){
  const box=$("msgs"),t0=performance.now(),from=box.scrollTop,dur=380;
  (function step(now){
    const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);
    const target=box.scrollHeight-box.clientHeight;      // har frame naya target
    box.scrollTop=from+(target-from)*e;
    if(k<1)scAnim=requestAnimationFrame(step);
    else{scAnim=null;pinned=true}
  })(t0);
}
function stopAnim(){if(scAnim){cancelAnimationFrame(scAnim);scAnim=null}}
["touchstart","wheel","pointerdown"].forEach(ev=>$("msgs").addEventListener(ev,stopAnim,{passive:true}));
$("msgs").addEventListener("scroll",()=>{
  if(scAnim)return;                                       // apne animation ko ignore karo
  const b=$("msgs");pinned=b.scrollHeight-b.scrollTop-b.clientHeight<140;
  if(b.scrollTop<60)loadOlder();
});

function mergeMsgs(list){
  list.forEach(m=>all.set(m.id,m));
  msgs=[...all.values()].sort((a,b)=>tms(a.t)-tms(b.t));
}

async function loadOlder(){
  if(loadingOld||!hasMore||!cur||!msgs.length)return;
  const first=msgs[0];
  if(!first.t)return;
  if(clr&&tms(first.t)<=clr){hasMore=false;return}       // clear ki hui chat ke purane messages mat padho
  loadingOld=true;
  const box=$("msgs"),prevH=box.scrollHeight,prevTop=box.scrollTop;
  try{
    const s=await getDocs(query(collection(db,"chats",cur.id,"messages"),orderBy("t","desc"),startAfter(first.t),limit(PAGE)));
    hasMore=s.docs.length>=PAGE;
    mergeMsgs(s.docs.map(d=>({id:d.id,...d.data(SNAP)})));
    renderMsgs();
    box.scrollTop=box.scrollHeight-prevH+prevTop;           // jagah wahi rahe, jump na kare
  }catch(e){toast("Could not load older messages")}
  loadingOld=false;
}
function markSeen(){
  if(!cur||document.hidden)return;
  msgs.forEach(m=>{
    if(m.sender!==me.uid&&!m.seen&&!sentSeen.has(m.id)){
      sentSeen.add(m.id);
      updateDoc(doc(db,"chats",cur.id,"messages",m.id),{seen:true}).catch(()=>sentSeen.delete(m.id));
    }
  });
  const c=chatsAll.find(x=>x.id===cur.id);
  if(c&&c.unread&&c.unread[me.uid]>0)
    updateDoc(doc(db,"chats",cur.id),{["unread."+me.uid]:0}).catch(()=>{});
}

/* selection bar actions */
$("sx").onclick=()=>{selId=null;renderMsgs()};
$("sr").onclick=()=>{const m=sel();if(m){selId=null;setRep(m);renderMsgs()}};
$("scp").onclick=()=>{
  const m=sel();
  if(m&&navigator.clipboard)navigator.clipboard.writeText(m.text).then(()=>toast("Copied")).catch(()=>toast("Could not copy"));
  selId=null;renderMsgs();
};
$("se").onclick=()=>{
  const m=sel();if(!m)return;
  clearRep();editing=m.id;selId=null;renderMsgs();
  $("in").value=m.text;grow();
  $("rn").textContent="Editing message";$("rt").textContent=m.text.slice(0,80);show("rbar",1);$("in").focus();
};
$("sd").onclick=async()=>{
  const m=sel();if(!m)return;
  if(await ask("Delete this message for everyone?","Delete")){
    const isLast=msgs.length&&msgs[msgs.length-1].id===m.id;
    updateDoc(doc(db,"chats",cur.id,"messages",m.id),{deleted:true,text:"",img:"",audio:"",video:""}).catch(()=>toast("Could not delete"));
    if(isLast)updateDoc(doc(db,"chats",cur.id),{lastDel:true,lastMsg:""}).catch(()=>{});
  }
  selId=null;renderMsgs();
};

/* three-dot menu */
$("mm").onclick=e=>{e.stopPropagation();$("menu").classList.toggle("hide")};
document.addEventListener("click",()=>show("menu",0));
$("m1").onclick=async()=>{
  if(!cur)return;
  if(await ask("Clear all messages in this chat? Only for you.","Clear"))
    updateDoc(doc(db,"chats",cur.id),{["cleared."+me.uid]:serverTimestamp()}).catch(()=>toast("Could not clear"));
};
$("m2").onclick=()=>{if(cur)delChat(cur.id,cur.o.name)};
$("m3").onclick=logout;

/* ---------- Reply / edit bar ---------- */
function setRep(m){
  clearRep();
  rep={n:m.sender===me.uid?"You":cur.o.name,t:(m.text||(m.audio?"Voice message":m.video?"Video":"Photo")).slice(0,80)};
  $("rn").textContent=rep.n;$("rt").textContent=rep.t;show("rbar",1);$("in").focus();
}
function clearRep(){rep=null;editing=null;show("rbar",0)}
$("rx").onclick=()=>{if(editing){$("in").value="";grow()}clearRep()};

/* ---------- Sending ---------- */
async function send(c){
  await addDoc(collection(db,"chats",cur.id,"messages"),{sender:me.uid,t:serverTimestamp(),seen:false,...c});
  await updateDoc(doc(db,"chats",cur.id),{
    lastMsg:c.text||(c.audio?"Voice message":c.video?"Video":"Photo"),lastAt:serverTimestamp(),lastFrom:me.uid,lastDel:false,
    ["unread."+cur.o.uid]:increment(1),["typing."+me.uid]:0
  });
}

async function doSend(){
  const t=$("in").value.trim();if(!t||!cur)return;
  $("in").value="";grow();
  if(editing){
    const id=editing,isLast=msgs.length&&msgs[msgs.length-1].id===id;
    clearRep();
    try{
      await updateDoc(doc(db,"chats",cur.id,"messages",id),{text:t,edited:true});
      if(isLast)updateDoc(doc(db,"chats",cur.id),{lastMsg:t}).catch(()=>{});
    }catch(x){toast("Could not edit")}
    $("in").focus();return;
  }
  force=true;
  const r=rep;clearRep();
  try{await send(r?{text:t,reply:r}:{text:t})}catch(x){toast("Message not sent")}
  $("in").focus();
}

// In buttons par focus mat chhodo, taaki keyboard band na ho
["send","eb","clip","mic"].forEach(id=>["pointerdown","mousedown"].forEach(ev=>$(id).addEventListener(ev,e=>e.preventDefault())));
$("send").onclick=doSend;

function sync(){const has=$("in").value.trim().length>0;show("send",has);show("mic",!has)}
function grow(){const t=$("in");t.style.height="auto";t.style.height=Math.min(t.scrollHeight,120)+"px";sync()}
$("in").oninput=()=>{
  grow();if(!cur)return;
  const n=Date.now();
  if(n-lt>5000){lt=n;updateDoc(doc(db,"chats",cur.id),{["typing."+me.uid]:serverTimestamp()}).catch(()=>{})}
};
// Enter = nayi line. Message sirf send button se jayega.

/* ---------- Emoji ---------- */
Array.from("😀😃😄😁😆😅😂🤣😊😇🙂😉😍🥰😘😋😛😜🤪😎🤩🥳😏😒😞😔😟😕😣😖😫😭😢😤😡🤯😳🥺😱🤗🤔🤭🤫🙄😴👍👎👏🙌🙏💪👋🤞💗💛💚💙💜🖤💔💕💖🔥✨🎉🎂🌸🌹🌙⭐").forEach(e=>{
  const b=document.createElement("button");b.type="button";b.textContent=e;
  b.addEventListener("pointerdown",x=>x.preventDefault());
  b.onclick=()=>{
    const t=$("in"),a=t.selectionStart,z=t.selectionEnd;
    t.value=t.value.slice(0,a)+e+t.value.slice(z);
    t.selectionStart=t.selectionEnd=a+e.length;grow();t.focus();
  };
  $("emo").appendChild(b);
});
$("eb").onclick=()=>$("emo").classList.toggle("hide");

/* ---------- Calls ---------- */
$("ca").onclick=()=>cur&&startCall({...cur.o,photo:ou.photo||""},"audio");
$("cv").onclick=()=>cur&&startCall({...cur.o,photo:ou.photo||""},"video");

/* ---------- Ping: DP par tap = owner ko Telegram notification (background) ---------- */
const OWNER_UID="NDtG5NFf2khO0w2zGvBiltDhuKk2";   // tumhara Firebase User UID
let lastPing=0;
$("oa").onclick=()=>{
  if(!cur||cur.o.uid!==OWNER_UID)return;                 // sirf tumhari DP par chalega
  if(Date.now()-lastPing<15000)return toast("Already pinged, please wait");
  lastPing=Date.now();
  fetch("notify.php",{cache:"no-store"})
    .then(r=>r.text())
    .then(t=>toast(t.startsWith("Sent")?"Ping sent":t.startsWith("Wait")?"Please wait a few seconds":"Ping failed"))
    .catch(()=>toast("Ping failed"));
};

/* ---------- Photos (Cloudinary) ---------- */
const noCloud=()=>{if(CLOUD.startsWith("YOUR")){toast("Add Cloudinary details in js/chat.js");return true}return false};

function shrink(file,max){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>{
      const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement("canvas");
      c.width=i.width*s;c.height=i.height*s;
      c.getContext("2d").drawImage(i,0,0,c.width,c.height);
      c.toBlob(res,"image/jpeg",.8);
    };
    i.onerror=rej;i.src=URL.createObjectURL(file);
  });
}
function upload(f,max,onp){
  return new Promise(async(res,rej)=>{
    try{
      const fd=new FormData();
      fd.append("file",await shrink(f,max),"photo.jpg");
      fd.append("upload_preset",PRESET);
      const x=new XMLHttpRequest();
      x.open("POST","https://api.cloudinary.com/v1_1/"+CLOUD+"/image/upload");
      if(onp)x.upload.onprogress=e=>{if(e.lengthComputable)onp(Math.round(e.loaded/e.total*100))};
      x.onload=()=>{try{const j=JSON.parse(x.responseText);j.secure_url?res(j.secure_url):rej(0)}catch(e){rej(e)}};
      x.onerror=()=>rej(0);
      x.send(fd);
    }catch(e){rej(e)}
  });
}

$("clip").onclick=()=>$("file").click();
function closeView(){if(vOpen)history.back();else show("view",0)}
$("view").onclick=closeView;
$("vx").onclick=e=>{e.stopPropagation();closeView()};
$("dl").onclick=async e=>{
  e.stopPropagation();
  try{
    const b=await (await fetch(vurl)).blob(),a=document.createElement("a");
    a.href=URL.createObjectURL(b);a.download="baatify-"+Date.now()+".jpg";a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);toast("Downloaded");
  }catch(x){toast("Download failed")}
};

$("file").onchange=async()=>{
  const f=$("file").files[0];$("file").value="";
  if(f.type.startsWith("video/")){sendVideo(f);return}
  const box=$("msgs"),tmp=document.createElement("div"),pv=URL.createObjectURL(f);
  tmp.className="m me new upl";
  tmp.innerHTML='<div class="up"><img src="'+pv+'" alt=""><div class="ring"><svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" cx="22" cy="22" r="19"/></svg><b>0%</b></div></div>';
  box.appendChild(tmp);box.scrollTo({top:box.scrollHeight,behavior:"smooth"});
  const fg=tmp.querySelector(".fg"),pc=tmp.querySelector("b");
  try{
    const url=await upload(f,1280,p=>{fg.style.strokeDashoffset=119.4*(1-p/100);pc.textContent=p+"%"});
    force=true;await send({img:url});
  }catch(x){toast("Photo upload failed")}
  tmp.remove();URL.revokeObjectURL(pv);
};

renderList();   // pehli screen par hi placeholders dikhao
/* ---------- Voice messages (max 1 minute) ---------- */
function uploadAudio(blob,ext,onp){
  return new Promise((res,rej)=>{
    const fd=new FormData();
    fd.append("file",blob,"voice."+ext);fd.append("upload_preset",PRESET);
    const x=new XMLHttpRequest();
    x.open("POST","https://api.cloudinary.com/v1_1/"+CLOUD+"/video/upload");
    x.upload.onprogress=e=>{if(e.lengthComputable)onp(Math.round(e.loaded/e.total*100))};
    x.onload=()=>{try{const j=JSON.parse(x.responseText);j.secure_url?res(j.secure_url):rej((j.error&&j.error.message)||0)}catch(e){rej(e)}};
    x.onerror=()=>rej(0);
    x.send(fd);
  });
}

async function recStart(){
  if(!cur||rec)return;
  if(!navigator.mediaDevices||!window.MediaRecorder)return toast("Voice needs HTTPS and a modern browser");
  if(noCloud())return;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    const mime=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"].find(m=>MediaRecorder.isTypeSupported(m))||"";
    const mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
    rec={mr,stream,chunks:[],t0:Date.now(),cancel:false,lim:false,mime:mr.mimeType||mime||"audio/webm",chat:cur.id};
    mr.ondataavailable=e=>{if(e.data&&e.data.size)rec.chunks.push(e.data)};
    mr.onstop=recDone;
    mr.start();
    show("f",0);show("rec",1);
    recTick();rec.timer=setInterval(recTick,200);
  }catch(e){
    toast(e&&e.name==="NotAllowedError"?"Allow microphone permission":e&&e.name==="NotReadableError"?"Microphone is in use by another app":"Could not start recording");
  }
}

function recTick(){
  if(!rec)return;
  const s=(Date.now()-rec.t0)/1000;
  $("rtime").textContent=fmtDur(Math.min(s,60))+" / 1:00";
  if(s>=60&&!rec.lim){rec.lim=true;toast("1 minute limit reached");recStop(false)}
}

function recStop(cancel){
  if(!rec)return;
  rec.cancel=cancel;clearInterval(rec.timer);
  if(rec.mr.state!=="inactive")rec.mr.stop();       // iske baad recDone chalta hai
  rec.stream.getTracks().forEach(t=>t.stop());
}

async function recDone(){
  const r=rec;rec=null;
  show("rec",0);show("f",1);
  if(!r||r.cancel)return;
  const ms=Date.now()-r.t0;
  if(ms<800)return toast("Hold a bit longer to record");
  const dur=Math.min(60,Math.max(1,Math.round(ms/1000)));
  const ext=/mp4/.test(r.mime)?"m4a":/ogg/.test(r.mime)?"ogg":"webm";
  const box=$("msgs"),tmp=document.createElement("div");
  tmp.className="m me new";tmp.textContent="Sending voice message… 0%";
  box.appendChild(tmp);box.scrollTop=box.scrollHeight;
  try{
    const url=await uploadAudio(new Blob(r.chunks,{type:r.mime}),ext,p=>{tmp.textContent="Sending voice message… "+p+"%"});
    if(!cur||cur.id!==r.chat){tmp.remove();return toast("Chat changed, voice message not sent")}
    force=true;await send({audio:url,dur});
  }catch(e){toast("Voice upload failed"+(typeof e==="string"?": "+e:""))}
  tmp.remove();
}

$("mic").onclick=recStart;
$("rcx").onclick=()=>recStop(true);
$("rsend").onclick=()=>recStop(false);

/* player */
const mp3=u=>u.replace(/\.[a-z0-9]+$/i,".mp3");   // mp3 mein badla, taaki iPhone par bhi chale

function paint(){
  if(!pl)return;
  const a=pl.a,ui=pl.ui,d=a.duration&&isFinite(a.duration)?a.duration:ui.dur;
  ui.btn.innerHTML=ico(a.paused?"play":"pause");
  ui.fill.style.width=(d?Math.min(100,a.currentTime/d*100):0)+"%";
  ui.lbl.textContent=fmtDur(a.paused&&a.currentTime===0?d:a.currentTime);
}
function resetUI(ui){ui.btn.innerHTML=ico("play");ui.fill.style.width="0%";ui.lbl.textContent=fmtDur(ui.dur)}

function toggleVoice(m,ui){
  if(pl&&pl.id===m.id){pl.a.paused?pl.a.play().catch(()=>{}):pl.a.pause();return}
  if(pl){pl.a.pause();resetUI(pl.ui)}
  const a=new Audio(mp3(m.audio));
  pl={id:m.id,a,ui};
  a.ontimeupdate=paint;a.onplay=paint;a.onpause=paint;
  a.onended=()=>{a.currentTime=0;paint()};
  a.onerror=()=>{
    if(!a.dataset.fb){a.dataset.fb="1";a.src=m.audio;a.play().catch(()=>{});return}   // mp3 na chale to asli file
    toast("Could not play voice message");pl=null;resetUI(ui);
  };
  a.play().catch(()=>toast("Could not play voice message"));
}

function voiceEl(m){
  const w=document.createElement("div");w.className="vm";
  const b=document.createElement("button");b.type="button";b.className="vp";b.setAttribute("aria-label","Play");b.innerHTML=ico("play");
  const bar=document.createElement("div");bar.className="vbar";
  const fill=document.createElement("div");fill.className="vfill";bar.appendChild(fill);
  const lbl=document.createElement("span");lbl.className="vt";lbl.textContent=fmtDur(m.dur||0);
  w.append(b,bar,lbl);
  const ui={btn:b,fill,lbl,dur:m.dur||0};
  if(pl&&pl.id===m.id){pl.ui=ui;paint()}          // list dobara bani to bhi chalta rahe
  b.onclick=e=>{e.stopPropagation();toggleVoice(m,ui)};
  bar.onclick=e=>{
    e.stopPropagation();
    if(pl&&pl.id===m.id&&pl.a.duration&&isFinite(pl.a.duration)){
      const r=bar.getBoundingClientRect();
      pl.a.currentTime=pl.a.duration*Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
    }
  };
  return w;
}
/* ---------- Contact info (header ke naam par tap) ---------- */
function syncInfo(){if(iOpen)$("pis").textContent=$("os").textContent}

function fillInfo(){
  if(!cur)return;
  const n=ou.name||cur.o.name;
  setAv($("pia"),n,ou.photo);
  $("pin").textContent=n;
  $("piu").textContent=ou.username?"@"+ou.username:"";
  const j=tms(ou.createdAt);
  $("pij").textContent=j?new Date(j).toLocaleDateString([], {day:"numeric",month:"long",year:"numeric"}):"-";
  syncInfo();
}

function openInfo(){
  if(!cur||iOpen)return;
  fillInfo();show("pinfo",1);
  history.pushState({bt:"info"},"");iOpen=true;
}
function closeInfo(){if(iOpen)history.back();else show("pinfo",0)}

const who=$("on").parentElement;
who.style.cursor="pointer";who.tabIndex=0;who.setAttribute("role","button");
who.onclick=openInfo;
who.onkeydown=e=>{if(e.key==="Enter")openInfo()};

$("pibk").onclick=closeInfo;
$("pica").onclick=()=>$("ca").click();
$("picv").onclick=()=>$("cv").click();
$("pia").onclick=()=>{
  if(!ou.photo)return;
  vurl=ou.photo;$("vimg").src=ou.photo;show("view",1);
  history.pushState({bt:"view"},"");vOpen=true;
};

/* ---------- Video messages (compress + upload, max 15 MB) ---------- */
const VID_MAX_MB=15, VID_SRC_MAX_MB=200, VID_MAX_SEC=180, VID_SKIP_MB=2.5;
const vcache=new Map();

function pickVMime(){
  return ["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"]
    .find(m=>MediaRecorder.isTypeSupported(m))||"";
}

function compressVideo(file,onp,ctl){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),v=document.createElement("video");
    v.src=url;v.playsInline=true;v.preload="auto";
    let ac=null,rec=null,raf=0,done=false,thumbed=false;
    const cleanup=()=>{
      if(done)return;done=true;cancelAnimationFrame(raf);
      try{rec&&rec.state!=="inactive"&&rec.stop()}catch(e){}
      try{ac&&ac.close()}catch(e){}
      v.pause();v.removeAttribute("src");v.load();URL.revokeObjectURL(url);
    };
    ctl.cancel=()=>{if(done)return;cleanup();reject("cancel")};
    v.onerror=()=>{if(done)return;cleanup();reject("This video format is not supported")};
    v.onloadedmetadata=()=>{
      const dur=v.duration;
      if(!isFinite(dur)||dur<=0){cleanup();return reject("Could not read this video")}
      if(dur>VID_MAX_SEC){cleanup();return reject("Video is too long (max "+Math.round(VID_MAX_SEC/60)+" minutes)")}
      const maxSide=dur<=60?720:dur<=120?640:540;
      const sc=Math.min(1,maxSide/Math.max(v.videoWidth,v.videoHeight));
      const w=Math.round(v.videoWidth*sc/2)*2,h=Math.round(v.videoHeight*sc/2)*2;
      const cv=document.createElement("canvas");cv.width=w;cv.height=h;
      const cx=cv.getContext("2d");
      const abr=64000,vbr=Math.max(250000,Math.min(2200000,(VID_MAX_MB*0.85)*8e6/dur-abr));
      const mime=pickVMime();
      let astream=null;
      try{
        ac=new (window.AudioContext||window.webkitAudioContext)();
        const src=ac.createMediaElementSource(v),dest=ac.createMediaStreamDestination();
        src.connect(dest);astream=dest.stream;         // speaker se nahi bajega
        if(ac.state==="suspended")ac.resume();
      }catch(e){astream=null}
      const out=cv.captureStream(30);
      if(astream)astream.getAudioTracks().forEach(t=>out.addTrack(t));
      const chunks=[];
      rec=new MediaRecorder(out,{mimeType:mime||undefined,videoBitsPerSecond:vbr,audioBitsPerSecond:abr});
      rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
      rec.onstop=()=>{
        if(done)return;
        const type=(rec.mimeType||mime||"video/webm").split(";")[0];
        const blob=new Blob(chunks,{type});
        cleanup();resolve({blob,ext:/mp4/.test(type)?"mp4":"webm"});
      };
      const draw=()=>{
        if(done)return;
        cx.drawImage(v,0,0,w,h);
        if(!thumbed){thumbed=true;try{ctl.thumb&&ctl.thumb(cv.toDataURL("image/jpeg",.6))}catch(e){}}
        onp(Math.min(99,Math.round(v.currentTime/dur*100)));
        if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(draw);else raf=requestAnimationFrame(draw);
      };
      v.onended=()=>{if(!done&&rec.state!=="inactive")setTimeout(()=>rec.stop(),200)};
      rec.start(1000);
      v.play().then(draw).catch(()=>{cleanup();reject("Browser blocked video processing. Try again")});
    };
  });
}

function uploadVideo(blob,ext,onp,ctl){
  return new Promise((res,rej)=>{
    const fd=new FormData();
    fd.append("file",blob,"video."+ext);fd.append("upload_preset",PRESET);
    const x=new XMLHttpRequest();
    x.open("POST","https://api.cloudinary.com/v1_1/"+CLOUD+"/video/upload");
    x.upload.onprogress=e=>{if(e.lengthComputable)onp(Math.round(e.loaded/e.total*100))};
    x.onload=()=>{try{const j=JSON.parse(x.responseText);j.secure_url?res(j.secure_url):rej((j.error&&j.error.message)||"Video upload failed")}catch(e){rej("Video upload failed")}};
    x.onerror=()=>rej("Video upload failed");
    x.onabort=()=>rej("cancel");
    ctl.abort=()=>x.abort();
    x.send(fd);
  });
}

async function sendVideo(f){
  const mb=f.size/1048576;
  if(mb>VID_SRC_MAX_MB)return toast("Video is too large (max "+VID_SRC_MAX_MB+" MB)");
  const canComp=!!(window.MediaRecorder&&HTMLCanvasElement.prototype.captureStream);
  if(!canComp&&mb>VID_MAX_MB)return toast("This browser cannot compress. Video must be under "+VID_MAX_MB+" MB");
  const chatId=cur.id,box=$("msgs"),tmp=document.createElement("div"),ctl={};
  let stopped=false;
  tmp.className="m me new upl";
  tmp.innerHTML='<div class="up"><img alt="" style="visibility:hidden;min-height:140px"><div class="ring"><svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" cx="22" cy="22" r="19"/></svg><b>0%</b></div></div><div class="vst">Preparing…</div><button class="vcx" type="button" aria-label="Cancel">✕</button>';
  box.appendChild(tmp);box.scrollTop=box.scrollHeight;
  const fg=tmp.querySelector(".fg"),pc=tmp.querySelector("b"),st=tmp.querySelector(".vst"),im=tmp.querySelector("img");
  const setP=(p,t)=>{fg.style.strokeDashoffset=119.4*(1-p/100);pc.textContent=p+"%";if(t)st.textContent=t};
  ctl.thumb=u=>{im.src=u;im.style.visibility="visible"};
  tmp.querySelector(".vcx").onclick=()=>{stopped=true;ctl.cancel&&ctl.cancel();ctl.abort&&ctl.abort();tmp.remove()};
  try{
    let blob=f,ext=(f.name.split(".").pop()||"mp4").toLowerCase();
    if(canComp&&mb>VID_SKIP_MB){
      setP(0,"Compressing… keep the app open");
      const r=await compressVideo(f,p=>setP(p),ctl);
      blob=r.blob;ext=r.ext;
    }
    if(stopped)return;
    if(blob.size>VID_MAX_MB*1048576)throw "Video is still above "+VID_MAX_MB+" MB. Send a shorter video";
    setP(0,"Uploading…");
    const url=await uploadVideo(blob,ext,p=>setP(p),ctl);
    if(!cur||cur.id!==chatId)return toast("Chat changed, video not sent");
    force=true;await send({video:url});
  }catch(e){if(e!=="cancel")toast(typeof e==="string"?e:"Video upload failed")}
  finally{tmp.remove()}
}

const vposter=u=>u.replace(/\.[a-z0-9]+$/i,".jpg");
const vsrc=u=>(/\.webm$/i.test(u)&&!document.createElement("video").canPlayType("video/webm"))?u.replace(/\.webm$/i,".mp4"):u;

function videoEl(m){
  let w=vcache.get(m.id);
  if(w)return w;                       // list dobara bane tab bhi video chalta rahe
  w=document.createElement("div");w.className="vid";
  const v=document.createElement("video");
  v.controls=true;v.playsInline=true;v.preload="metadata";
  v.poster=vposter(m.video);v.src=vsrc(m.video);
  v.onerror=()=>{if(!v.dataset.fb){v.dataset.fb="1";v.src=m.video.replace(/\.[a-z0-9]+$/i,".mp4")}};
  v.onclick=e=>e.stopPropagation();
  w.appendChild(v);vcache.set(m.id,w);
  return w;
}
sync();