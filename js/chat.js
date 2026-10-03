import {auth,db} from "./firebase.js";
import {initCalls,startCall} from "./call.js";
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc,setDoc,updateDoc,addDoc,collection,query,where,orderBy,limit,startAt,endAt,onSnapshot,getDocs,serverTimestamp,increment} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* ====== CONFIG: apni Cloudinary values daalo ====== */
const CLOUD="dzbqkvysn", PRESET="Baatify";
/* ================================================== */

const $=id=>document.getElementById(id);
const show=(id,on)=>$(id).classList.toggle("hide",!on);
const ico=n=>'<svg class="i" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const SNAP={serverTimestamps:"estimate"};
let me=null,cur=null,chats=null,msgs=[],seen=new Set(),stick=false,selId=null,rep=null,ou={};
let unsubL,unsubM,unsubU,st,hb,lt=0;
const uc=new Map();

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

/* ---------- Auth guard + presence ---------- */
onAuthStateChanged(auth,u=>{
  if(!u){location.replace("login.html");return}
  boot(u);
});

$("out").onclick=async()=>{await pres(false);signOut(auth)};

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
  $("mn").textContent=me.name;setAv($("me"),me.name,me.photo);
  chats=null;renderList();
  show("splash",0);show("app",1);fit();
  initCalls({uid:me.uid,name:me.name});
  pres(true);clearInterval(hb);hb=setInterval(()=>{if(!document.hidden)pres(true)},30000);
  unsubL&&unsubL();
  unsubL=onSnapshot(
    query(collection(db,"chats"),where("members","array-contains",u.uid)),
    s=>{
      chats=s.docs.map(d=>({id:d.id,...d.data(SNAP)}))
        .filter(c=>c.lastAt)
        .sort((a,b)=>b.lastAt.toMillis()-a.lastAt.toMillis());
      renderList();status();
    },
    ()=>toast("Cannot load chats")
  );
}

/* ---------- Profile photo ---------- */
$("me").onclick=()=>{location.href="profile.html"};
$("pfile").onchange=async()=>{
  const f=$("pfile").files[0];$("pfile").value="";
  if(!f||noCloud())return;
  toast("Uploading photo…");
  try{
    const url=await upload(f,400);
    await updateDoc(doc(db,"users",me.uid),{photo:url});
    me.photo=url;setAv($("me"),me.name,url);toast("Profile photo updated");
  }catch(x){toast("Upload failed")}
};

/* ---------- Chat list + search ---------- */
function row(name,sub,time,fn,active,badge,uid,photo){
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
  r.onclick=fn;r.onkeydown=e=>{if(e.key==="Enter")fn()};
  return r;
}

function renderList(){
  const box=$("list"),keep=box.scrollTop;box.textContent="";
  if(!chats){
    for(let i=0;i<6;i++){
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
    box.appendChild(row(
      nm,(c.lastFrom===me.uid?"You: ":"")+(c.lastMsg||""),short(c.lastAt),
      ()=>openChat({uid:o,name:nm}),open,open?0:un,o,""
    ));
  });
  box.scrollTop=keep;
}

$("q").oninput=()=>{
  clearTimeout(st);
  const v=$("q").value.trim().toLowerCase().replace(/^@/,"");
  if(!v){show("res",0);show("list",1);return}
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
  cur={id,o};seen=new Set();stick=true;selId=null;ou={};
  unsubM&&unsubM();unsubU&&unsubU();clearRep();show("emo",0);
  $("on").textContent=o.name;setAv($("oa"),o.name,"");$("os").textContent="";
  show("empty",0);show("pane",1);
  $("app").classList.add("open");$("msgs").textContent="";
  try{
    if(!(chats||[]).some(c=>c.id===id))
      await setDoc(doc(db,"chats",id),{members:[me.uid,o.uid].sort(),names:{[me.uid]:me.name,[o.uid]:o.name}},{merge:true});
  }catch(e){toast("Could not open chat");return}
  unsubU=onSnapshot(doc(db,"users",o.uid),s=>{
    ou=s.data(SNAP)||{};setAv($("oa"),o.name,ou.photo);status();
  });
  unsubM=onSnapshot(
    query(collection(db,"chats",id,"messages"),orderBy("t")),
    s=>{
      msgs=s.docs.map(d=>({id:d.id,...d.data(SNAP)}));
      renderMsgs();markSeen();
    },
    ()=>toast("Cannot load messages")
  );
  renderList();
}

$("back").onclick=()=>{
  $("app").classList.remove("open");
  unsubM&&unsubM();unsubU&&unsubU();cur=null;
  show("pane",0);show("empty",1);renderList();
};

/* ---------- Typing + online / last seen ---------- */
function status(){
  if(!cur)return;
  const el=$("os");el.classList.remove("ty");
  const c=(chats||[]).find(x=>x.id===cur.id);
  const ty=c&&c.typing&&c.typing[cur.o.uid];
  const tm=ty&&ty.toMillis?ty.toMillis():0;
  if(tm&&Date.now()-tm<5000){el.textContent="typing…";el.classList.add("ty");return}
  const ls=ou.lastSeen&&ou.lastSeen.toMillis?ou.lastSeen.toMillis():0;
  if(ou.online&&Date.now()-ls<75000){el.textContent="online";return}
  if(!ls){el.textContent="";return}
  const dl=dayLabel(new Date(ls));
  el.textContent="last seen "+(dl==="Today"?"today":dl==="Yesterday"?"yesterday":dl)+" at "+fmt(new Date(ls));
}
setInterval(status,2000);

/* ---------- Messages ---------- */
function renderMsgs(){
  const box=$("msgs"),top=box.scrollTop;
  const near=box.scrollHeight-box.scrollTop-box.clientHeight<120;
  box.textContent="";let day="",prev=null;
  msgs.forEach(m=>{
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
      if(m.img){
        const im=document.createElement("img");
        im.src=m.img;im.alt="Photo";im.loading="lazy";
        im.onload=()=>{if(stick||near)box.scrollTop=box.scrollHeight};
        im.onclick=e=>{e.stopPropagation();$("vimg").src=m.img;show("view",1)};
        el.appendChild(im);
      }else{
        const t=document.createElement("div");t.textContent=m.text;el.appendChild(t);
      }
    }
    const meta=document.createElement("div");meta.className="meta";
    const tt=document.createElement("span");tt.textContent=fmt(d);meta.appendChild(tt);
    if(mine){
      const k=document.createElement("span");
      k.className="tk"+(m.seen?" seen":"");
      k.innerHTML=ico(m.seen?"check2":"check");
      meta.appendChild(k);
    }
    el.appendChild(meta);

    if(!m.deleted){
      const a=document.createElement("div");a.className="acts";
      const b1=document.createElement("button");b1.type="button";b1.innerHTML=ico("reply")+"<span>Reply</span>";
      b1.onclick=e=>{e.stopPropagation();selId=null;setRep(m);renderMsgs()};
      a.appendChild(b1);
      if(mine){
        const b2=document.createElement("button");b2.type="button";b2.innerHTML=ico("trash")+"<span>Delete</span>";
        b2.onclick=e=>{
          e.stopPropagation();selId=null;
          updateDoc(doc(db,"chats",cur.id,"messages",m.id),{deleted:true,text:"",img:""}).catch(()=>toast("Could not delete"));
        };
        a.appendChild(b2);
      }
      el.appendChild(a);
    }
    el.onclick=()=>{selId=selId===m.id?null:m.id;renderMsgs()};
    box.appendChild(el);
  });
  if(stick||near){box.scrollTop=box.scrollHeight;stick=false}else box.scrollTop=top;
}

function markSeen(){
  if(!cur||document.hidden)return;
  msgs.forEach(m=>{
    if(m.sender!==me.uid&&!m.seen)
      updateDoc(doc(db,"chats",cur.id,"messages",m.id),{seen:true}).catch(()=>{});
  });
  const c=(chats||[]).find(x=>x.id===cur.id);
  if(c&&c.unread&&c.unread[me.uid]>0)
    updateDoc(doc(db,"chats",cur.id),{["unread."+me.uid]:0}).catch(()=>{});
}

/* ---------- Reply ---------- */
function setRep(m){
  rep={n:m.sender===me.uid?"You":cur.o.name,t:(m.text||"Photo").slice(0,80)};
  $("rn").textContent=rep.n;$("rt").textContent=rep.t;show("rbar",1);$("in").focus();
}
function clearRep(){rep=null;show("rbar",0)}
$("rx").onclick=clearRep;

/* ---------- Sending ---------- */
async function send(c){
  await addDoc(collection(db,"chats",cur.id,"messages"),{sender:me.uid,t:serverTimestamp(),seen:false,...c});
  await updateDoc(doc(db,"chats",cur.id),{
    lastMsg:c.text||"Photo",lastAt:serverTimestamp(),lastFrom:me.uid,
    ["unread."+cur.o.uid]:increment(1),["typing."+me.uid]:0
  });
}

async function doSend(){
  const t=$("in").value.trim();if(!t||!cur)return;
  $("in").value="";grow();stick=true;
  const r=rep;clearRep();
  try{await send(r?{text:t,reply:r}:{text:t})}catch(x){toast("Message not sent")}
  $("in").focus();
}

// In buttons par focus mat chhodo, taaki keyboard band na ho
["send","eb","clip"].forEach(id=>["pointerdown","mousedown"].forEach(ev=>$(id).addEventListener(ev,e=>e.preventDefault())));
$("send").onclick=doSend;

function grow(){const t=$("in");t.style.height="auto";t.style.height=Math.min(t.scrollHeight,120)+"px"}
$("in").oninput=()=>{
  grow();if(!cur)return;
  const n=Date.now();
  if(n-lt>2500){lt=n;updateDoc(doc(db,"chats",cur.id),{["typing."+me.uid]:serverTimestamp()}).catch(()=>{})}
};
// Enter = nayi line (default). Message sirf send button se jayega.

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

/* ---------- Calls: agle round mein ---------- */
$("ca").onclick=()=>cur&&startCall(cur.o,"audio");
$("cv").onclick=()=>cur&&startCall(cur.o,"video");

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

async function upload(f,max){
  const fd=new FormData();
  fd.append("file",await shrink(f,max),"photo.jpg");
  fd.append("upload_preset",PRESET);
  const r=await fetch("https://api.cloudinary.com/v1_1/"+CLOUD+"/image/upload",{method:"POST",body:fd});
  const j=await r.json();
  if(!j.secure_url)throw 0;
  return j.secure_url;
}

$("clip").onclick=()=>$("file").click();
$("view").onclick=()=>show("view",0);

$("file").onchange=async()=>{
  const f=$("file").files[0];$("file").value="";
  if(!f||!cur||noCloud())return;
  const box=$("msgs"),tmp=document.createElement("div");
  tmp.className="m me new";tmp.textContent="Uploading photo…";
  box.appendChild(tmp);box.scrollTop=box.scrollHeight;
  try{const url=await upload(f,1280);stick=true;await send({img:url})}
  catch(x){toast("Photo upload failed")}
  tmp.remove();
};
