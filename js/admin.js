import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc,setDoc,updateDoc,collection,query,where,orderBy,limit,startAfter,getDocs,getCountFromServer,writeBatch,Timestamp,deleteField} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const {auth,db}=await import("./firebase.js"+(window.V||""));

const $=id=>document.getElementById(id);
document.addEventListener("gesturestart",e=>e.preventDefault());
const show=(id,on)=>$(id).classList.toggle("hide",!on);
const ico=n=>'<svg class="i" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const ms=t=>t&&t.toMillis?t.toMillis():(typeof t==="number"?t:0);
const pad=n=>(n<10?"0":"")+n;
const fmtDur=s=>{s=Math.floor(s||0);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
function fdt(t){const d=new Date(t);return pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear()+", "+pad(d.getHours())+":"+pad(d.getMinutes())}
let tt;
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),3500)}

let me=null,chats=[],cur="",tab="ov",seg="img";
let cache={id:"",msgs:[],complete:false};
let gal={chat:"",img:null,video:null,audio:null};
const other=c=>c.members.find(x=>x!==me.uid);
const pname=c=>(c.names&&c.names[other(c)])||"User";
const curChat=()=>chats.find(x=>x.id===cur);
const msgCol=()=>collection(db,"chats",cur,"messages");
const who=m=>m.sender===me.uid?"You":pname(curChat());

async function busy(btn,fn){
  btn.disabled=true;
  try{await fn()}catch(e){toast("Error: "+((e&&(e.code||e.message))||e))}
  btn.disabled=false;
}

/* ---------- Access: only admin accounts ---------- */
onAuthStateChanged(auth,async u=>{
  if(!u){location.replace("login.html");return}
  try{
    const a=await getDoc(doc(db,"admins",u.uid));
    if(!a.exists()){location.replace("chat.html");return}
  }catch(e){location.replace("chat.html");return}
  me=u;show("load",0);show("app",1);
  await init();
});

async function init(){
  const s=await getDocs(query(collection(db,"chats"),where("members","array-contains",me.uid)));
  chats=s.docs.map(d=>({id:d.id,...d.data()}));
  const sel=$("chatSel");sel.textContent="";
  chats.forEach(c=>{const o=document.createElement("option");o.value=c.id;o.textContent="Chat with "+pname(c);sel.appendChild(o)});
  if(!chats.length){toast("No chats found");return}
  cur=chats[0].id;sel.value=cur;
  resetCaches();refresh();
}

function resetCaches(){
  cache={id:"",msgs:[],complete:false};
  gal={chat:"",img:null,video:null,audio:null};
  $("sr").textContent="";$("ls").textContent="";
}
$("chatSel").onchange=()=>{cur=$("chatSel").value;resetCaches();refresh()};

document.querySelectorAll(".tb").forEach(b=>b.onclick=()=>{
  tab=b.dataset.t;
  document.querySelectorAll(".tb").forEach(x=>x.classList.toggle("on",x===b));
  ["ov","ct","gl"].forEach(t=>show("t-"+t,t===tab));
  refresh();
});
function refresh(){if(tab==="ov")overview();else if(tab==="gl")gallery()}

/* ---------- Overview ---------- */
async function overview(){
  if(!cur)return;
  const box=$("ovs");box.textContent="Loading…";
  const cnt=async q=>{try{return (await getCountFromServer(q)).data().count}catch(e){return "-"}};
  const mc=msgCol();
  const r=await Promise.all([
    cnt(mc),cnt(query(mc,where("img","!=",""))),cnt(query(mc,where("video","!=",""))),cnt(query(mc,where("audio","!=","")))
  ]);
  box.textContent="";
  [[r[0],"Messages"],[r[1],"Photos"],[r[2],"Videos"],[r[3],"Voice"]].forEach(x=>{
    const d=document.createElement("div");d.className="stat";
    const b=document.createElement("b");b.textContent=x[0];
    const s=document.createElement("span");s.textContent=x[1];
    d.append(b,s);box.appendChild(d);
  });
  const pb=$("ovp");pb.textContent="Loading…";
  try{
    const u=(await getDoc(doc(db,"users",other(curChat())))).data()||{};
    const ls=ms(u.lastSeen),on=u.online&&Date.now()-ls<240000;
    pb.textContent="";
    [["Name",u.name||"-"],["Username",u.username?"@"+u.username:"-"],["Status",on?"Online":(ls?"Last seen "+fdt(ls):"-")]].forEach(x=>{
      const row=document.createElement("div");row.className="kv";
      const a=document.createElement("span");a.textContent=x[0];
      const b=document.createElement("b");b.textContent=x[1];
      row.append(a,b);pb.appendChild(row);
    });
  }catch(e){pb.textContent="Could not load"}
}
$("ovr").onclick=overview;

/* ---------- Load messages + search ---------- */
async function loadMsgs(max){
  const out=[];let last=null;
  for(;;){
    const need=max==="all"?500:Math.min(500,max-out.length);
    if(need<=0)break;
    const q=last?query(msgCol(),orderBy("t","desc"),startAfter(last),limit(need)):query(msgCol(),orderBy("t","desc"),limit(need));
    const s=await getDocs(q);
    s.docs.forEach(d=>out.push({id:d.id,...d.data()}));
    $("ls").textContent=out.length+" messages read…";
    if(s.docs.length<need)break;
    last=s.docs[s.docs.length-1];
  }
  return out.reverse();
}

$("lb").onclick=()=>busy($("lb"),async()=>{
  const v=$("lm").value,arr=await loadMsgs(v==="all"?"all":+v);
  cache={id:cur,msgs:arr,complete:v==="all"||arr.length<+v};
  $("ls").textContent=arr.length+" messages loaded";
  doSearch();
});

function mark(text,q){
  const f=document.createDocumentFragment(),low=text.toLowerCase();let i=0,j;
  while((j=low.indexOf(q,i))>=0){
    if(j>i)f.append(text.slice(i,j));
    const m=document.createElement("mark");m.textContent=text.slice(j,j+q.length);f.append(m);i=j+q.length;
  }
  f.append(text.slice(i));return f;
}

function doSearch(){
  const q=$("sq").value.trim().toLowerCase(),box=$("sr");box.textContent="";
  if(!q)return;
  if(cache.id!==cur||!cache.msgs.length){box.textContent="Load messages first";return}
  const hits=cache.msgs.filter(m=>m.text&&m.text.toLowerCase().includes(q)).slice(-100).reverse();
  if(!hits.length){box.textContent="No results";return}
  hits.forEach(m=>{
    const d=document.createElement("div");d.className="hit";
    const s=document.createElement("small");s.textContent=who(m)+" · "+fdt(ms(m.t));
    const t=document.createElement("div");t.appendChild(mark(m.text,q));
    d.append(s,t);box.appendChild(d);
  });
}
$("sq").oninput=doSearch;

/* ---------- Backup ---------- */
async function allMsgs(){
  if(cache.id===cur&&cache.complete)return cache.msgs;
  const n=(await getCountFromServer(msgCol())).data().count;
  if(!confirm("This chat has "+n+" messages. Reading them will use about "+n+" reads. Continue?"))return null;
  const arr=await loadMsgs("all");
  cache={id:cur,msgs:arr,complete:true};
  $("ls").textContent=arr.length+" messages loaded";
  return arr;
}

function pack(m){
  const o={id:m.id,sender:m.sender,t:ms(m.t),seen:!!m.seen};
  ["text","img","audio","video","dur","edited","deleted"].forEach(k=>{
    if(m[k]!==undefined&&m[k]!==""&&m[k]!==false)o[k]=m[k];
  });
  if(m.reply)o.reply=m.reply;
  return o;
}
function unpack(m){
  const o={sender:m.sender,t:Timestamp.fromMillis(m.t||Date.now()),seen:!!m.seen};
  ["text","img","audio","video","dur","edited","deleted","reply"].forEach(k=>{if(m[k]!==undefined)o[k]=m[k]});
  return o;
}

function save(name,text,type){
  const b=new Blob([text],{type}),a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),8000);
}
const dateTag=()=>{const d=new Date();return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())};
const safe=s=>String(s).replace(/[^\w\-]+/g,"_").slice(0,20)||"chat";

$("bj").onclick=()=>busy($("bj"),async()=>{
  const arr=await allMsgs();if(!arr)return;
  const c=curChat();
  const data={app:"baatify",version:1,exportedAt:Date.now(),
    chat:{id:c.id,members:c.members,names:c.names||{}},messages:arr.map(pack)};
  save("baatify-backup-"+safe(pname(c))+"-"+dateTag()+".json",JSON.stringify(data),"application/json");
  toast("Backup ready ("+arr.length+" messages)");
});

$("bt").onclick=()=>busy($("bt"),async()=>{
  const arr=await allMsgs();if(!arr)return;
  const lines=arr.map(m=>{
    const body=m.deleted?"[deleted]":m.text?m.text:m.img?"[Photo] "+m.img:m.video?"[Video] "+m.video:m.audio?"[Voice "+fmtDur(m.dur)+"] "+m.audio:"";
    return "["+fdt(ms(m.t))+"] "+who(m)+": "+body;
  });
  save("baatify-chat-"+safe(pname(curChat()))+"-"+dateTag()+".txt",lines.join("\n"),"text/plain");
  toast("TXT ready ("+arr.length+" messages)");
});

/* ---------- Restore (import) ---------- */
$("rb").onclick=()=>busy($("rb"),async()=>{
  const f=$("rf").files[0];if(!f)return toast("Choose a backup file first");
  let d;try{d=JSON.parse(await f.text())}catch(e){return toast("This file is not valid")}
  if(d.app!=="baatify"||!d.chat||!Array.isArray(d.messages))return toast("This is not a Baatify backup");
  const ch=d.chat;
  if(!ch.id||!Array.isArray(ch.members)||ch.members.length!==2||!ch.members.includes(me.uid))return toast("You are not a member of the chat in this backup");
  if(ch.id!==[...ch.members].sort().join("_"))return toast("The chat id in this backup is invalid");
  const msgs=d.messages.filter(m=>m&&typeof m.id==="string"&&m.id&&ch.members.includes(m.sender));
  if(!msgs.length)return toast("No messages found in this backup");
  if(!confirm("Import "+msgs.length+" messages back into this chat?"))return;

  $("rs").textContent="Preparing chat…";
  let old=null;try{old=(await getDoc(doc(db,"chats",ch.id))).data()}catch(e){old=null}
  const last=msgs.reduce((x,y)=>(y.t||0)>(x.t||0)?y:x,msgs[0]);
  const gone=x=>({[x]:deleteField()});
  const upd={members:ch.members,names:ch.names||{},
    cleared:Object.assign({},gone(ch.members[0]),gone(ch.members[1])),
    hidden:Object.assign({},gone(ch.members[0]),gone(ch.members[1]))};
  if(!old||!old.lastAt||ms(old.lastAt)<(last.t||0)){
    upd.lastAt=Timestamp.fromMillis(last.t||Date.now());upd.lastFrom=last.sender;upd.lastDel=!!last.deleted;
    upd.lastMsg=last.deleted?"":(last.text||(last.audio?"Voice message":last.video?"Video":last.img?"Photo":""));
  }
  await setDoc(doc(db,"chats",ch.id),upd,{merge:true});

  let n=0;
  for(let i=0;i<msgs.length;i+=400){
    const b=writeBatch(db);
    msgs.slice(i,i+400).forEach(m=>b.set(doc(db,"chats",ch.id,"messages",m.id),unpack(m)));
    await b.commit();n+=Math.min(400,msgs.length-i);
    $("rs").textContent=n+" / "+msgs.length+" messages imported…";
  }
  $("rs").textContent="Done: "+n+" messages imported";
  toast("Import complete");
  const keep=ch.id;await init();
  if(chats.some(c=>c.id===keep)){cur=keep;$("chatSel").value=keep}
  resetCaches();refresh();
});

/* ---------- Clear chat (for both) ---------- */
$("cc").oninput=()=>{$("cb").disabled=$("cc").value.trim()!=="DELETE"};
$("cb").onclick=async()=>{
  if($("cc").value.trim()!=="DELETE")return;
  if(!confirm("Are you sure? All messages will be deleted permanently (only a backup can bring them back)."))return;
  $("cb").disabled=true;
  try{
    let n=0;
    for(;;){
      const s=await getDocs(query(msgCol(),limit(400)));
      if(s.empty)break;
      const b=writeBatch(db);s.docs.forEach(d=>b.delete(d.ref));await b.commit();
      n+=s.size;$("cs").textContent=n+" messages deleted…";
    }
    await updateDoc(doc(db,"chats",cur),{lastMsg:deleteField(),lastAt:deleteField(),lastFrom:deleteField(),lastDel:deleteField()});
    resetCaches();$("cc").value="";
    $("cs").textContent="Chat cleared ("+n+" messages)";toast("Chat cleared");
  }catch(e){toast("Error: "+((e&&(e.code||e.message))||e))}
  $("cb").disabled=$("cc").value.trim()!=="DELETE";
};

/* ---------- Gallery ---------- */
const mp3=u=>u.replace(/\.[a-z0-9]+$/i,".mp3");
function thumb(u,kind){
  let t=u.replace("/upload/","/upload/w_300,h_300,c_fill,q_auto"+(kind==="video"?",so_0":"")+"/");
  if(kind==="video")t=t.replace(/\.[a-z0-9]+$/i,".jpg");
  return t;
}

document.querySelectorAll(".sg").forEach(b=>b.onclick=()=>{
  seg=b.dataset.g;
  document.querySelectorAll(".sg").forEach(x=>x.classList.toggle("on",x===b));
  gallery();
});

async function gallery(){
  if(!cur)return;
  if(gal.chat!==cur)gal={chat:cur,img:null,video:null,audio:null};
  const k=seg;
  if(!gal[k]){
    $("gg").textContent="";$("gs").textContent="Loading…";
    try{
      const s=await getDocs(query(msgCol(),where(k,"!=","")));
      gal[k]=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>ms(b.t)-ms(a.t));
    }catch(e){$("gs").textContent="Could not load";return}
  }
  renderGal();
}

function renderGal(){
  const k=seg,arr=gal[k]||[],box=$("gg");
  box.textContent="";box.className=k==="audio"?"list":"gal";
  $("gs").textContent=arr.length?arr.length+" "+(k==="img"?"photos":k==="video"?"videos":"voice messages"):"Nothing here yet";
  arr.forEach(m=>{
    if(k==="audio"){
      const r=document.createElement("div");r.className="vr";
      const h=document.createElement("small");h.textContent=who(m)+" · "+fdt(ms(m.t))+" · "+fmtDur(m.dur);
      const a=document.createElement("audio");a.controls=true;a.preload="none";a.src=mp3(m.audio);
      a.onerror=()=>{if(!a.dataset.fb){a.dataset.fb="1";a.src=m.audio}};
      r.append(h,a);box.appendChild(r);return;
    }
    const b=document.createElement("button");b.type="button";b.className="gi";
    const im=new Image();im.loading="lazy";im.alt="";im.src=thumb(m[k],k);b.appendChild(im);
    if(k==="video"){const p=document.createElement("span");p.className="pl";p.innerHTML=ico("play");b.appendChild(p)}
    b.onclick=()=>openViewer(k,m);
    box.appendChild(b);
  });
}

/* ---------- Viewer (swipe) + download ---------- */
let vlist=[],vk="",vi=0,vPush=false;
let vsx=0,vsy=0,vdx=0,vtrack=false,vlock=null;

function openViewer(k,m){
  vk=k;vlist=gal[k]||[];
  vi=Math.max(0,vlist.findIndex(x=>x.id===m.id));
  show("viewer",1);showItem(0);
  history.pushState({adm:"v"},"");vPush=true;       // phone ka back pehle viewer band kare
}

function showItem(dir){
  const b=$("vbody"),m=vlist[vi];if(!m)return;
  const old=b.querySelector("video");if(old)old.pause();
  b.textContent="";
  let el;
  if(vk==="img"){el=new Image();el.alt="";el.draggable=false;el.src=m.img}
  else{el=document.createElement("video");el.controls=true;el.playsInline=true;el.autoplay=true;el.src=m.video}
  el.className="vit";
  if(dir){                                           // halka sa slide-in
    el.style.transform="translateX("+(dir*60)+"px)";el.style.opacity="0";
    requestAnimationFrame(()=>{el.style.transition="transform .2s,opacity .2s";el.style.transform="";el.style.opacity=""});
  }
  b.appendChild(el);
  $("vct").textContent=(vi+1)+" / "+vlist.length;
  $("vpv").classList.toggle("hide",vi===0);
  $("vnx").classList.toggle("hide",vi>=vlist.length-1);
  if(vk==="img")[vi-1,vi+1].forEach(j=>{if(vlist[j]){const p=new Image();p.src=vlist[j].img}});   // aas-paas ki photos pehle se
}

function go(d){
  const n=vi+d;
  if(n<0||n>=vlist.length)return false;
  vi=n;showItem(d);return true;
}

function closeViewer(fromPop){
  const v=$("vbody").querySelector("video");if(v)v.pause();
  $("vbody").textContent="";vlist=[];show("viewer",0);
  if(vPush&&!fromPop){vPush=false;history.back()}
  vPush=false;
}
addEventListener("popstate",()=>{if(!$("viewer").classList.contains("hide")){vPush=false;closeViewer(true)}});

$("vx").onclick=()=>closeViewer(false);
$("vpv").onclick=()=>go(-1);
$("vnx").onclick=()=>go(1);
$("viewer").addEventListener("click",e=>{if(e.target===$("viewer")||e.target===$("vbody"))closeViewer(false)});
addEventListener("keydown",e=>{
  if($("viewer").classList.contains("hide"))return;
  if(e.key==="ArrowRight")go(1);
  else if(e.key==="ArrowLeft")go(-1);
  else if(e.key==="Escape")closeViewer(false);
});

// swipe
const V=$("viewer");
V.addEventListener("touchstart",e=>{
  if(e.touches.length!==1){vtrack=false;return}
  const t=e.touches[0];vsx=t.clientX;vsy=t.clientY;vdx=0;vtrack=true;vlock=null;
  const v=e.target.closest&&e.target.closest("video");
  if(v){const r=v.getBoundingClientRect();if(t.clientY>r.bottom-80)vtrack=false}    // video ke controls par swipe nahi
},{passive:true});
V.addEventListener("touchmove",e=>{
  if(!vtrack)return;
  const t=e.touches[0],dx=t.clientX-vsx,dy=t.clientY-vsy;
  if(vlock===null&&(Math.abs(dx)>10||Math.abs(dy)>10))vlock=Math.abs(dx)>Math.abs(dy)?"x":"y";
  if(vlock==="x"){
    vdx=dx;const el=$("vbody").firstChild;
    if(el){el.style.transition="none";el.style.transform="translateX("+dx+"px)"}
  }
},{passive:true});
V.addEventListener("touchend",()=>{
  if(!vtrack)return;vtrack=false;
  if(vlock==="x"&&Math.abs(vdx)>60&&go(vdx<0?1:-1)){vdx=0;return}
  const el=$("vbody").firstChild;
  if(el){el.style.transition="transform .2s";el.style.transform=""}                  // wapas apni jagah
  vdx=0;
});

$("vdl").onclick=async()=>{
  const m=vlist[vi];if(!m)return;
  const url=vk==="img"?m.img:m.video;
  try{
    const r=await fetch(url),b=await r.blob(),a=document.createElement("a");
    const ext=(b.type.split("/")[1]||"bin").split(";")[0];
    a.href=URL.createObjectURL(b);a.download="baatify-"+Date.now()+"."+ext;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),8000);toast("Download started");
  }catch(e){toast("Download failed")}
};