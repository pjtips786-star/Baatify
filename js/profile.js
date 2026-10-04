import {onAuthStateChanged,EmailAuthProvider,reauthenticateWithCredential,updatePassword} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc,updateDoc,writeBatch,collection,query,where,getDocs} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const {auth,db}=await import("./firebase.js"+(window.V||""));

/* ====== CONFIG: chat.js wali same Cloudinary values ====== */
const CLOUD="dzbqkvysn", PRESET="Baatify";
/* ========================================================= */

const $=id=>document.getElementById(id);
const valid=u=>/^[a-z0-9_]{3,20}$/.test(u);
let me=null,timer;

let tt;
function toast(t,ms){const e=$("toast");e.textContent=t;e.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>e.classList.remove("on"),ms||3000)}
function setAv(el,name,photo){
  if(photo){el.style.backgroundImage='url("'+photo+'")';el.textContent=""}
  else{el.style.backgroundImage="";el.textContent=(name||"?")[0].toUpperCase()}
}
async function run(btn,fn){btn.disabled=true;try{await fn()}finally{btn.disabled=false}}

/* ---------- Load profile ---------- */
onAuthStateChanged(auth,async u=>{
  if(!u){location.replace("login.html");return}
  const s=await getDoc(doc(db,"users",u.uid));
  if(!s.exists()){location.replace("login.html");return}
  me={uid:u.uid,...s.data()};
  $("n").value=me.name;$("u").value=me.username;setAv($("av"),me.name,me.photo);
  $("load").classList.add("hide");$("page").classList.remove("hide");
});

/* ---------- Photo crop (1:1 manual) ---------- */
let cr=null,drag=null;
const MINS=60;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

function crPlace(){
  const b=$("cb");
  b.style.left=cr.x+"px";b.style.top=cr.y+"px";
  b.style.width=b.style.height=cr.s+"px";
}

$("cam").onclick=()=>$("pf").click();

$("pf").onchange=()=>{
  const f=$("pf").files[0];$("pf").value="";if(!f)return;
  if(CLOUD.startsWith("YOUR"))return toast("Add Cloudinary details in js/profile.js");
  const i=$("ci");
  i.onload=()=>{
    const w=i.naturalWidth,h=i.naturalHeight;
    const k=Math.min(320/w,380/h),dw=Math.round(w*k),dh=Math.round(h*k);
    i.style.width=dw+"px";i.style.height=dh+"px";
    $("cf").style.width=dw+"px";$("cf").style.height=dh+"px";
    const s=Math.round(Math.min(dw,dh)*0.8);
    cr={img:i,k,dw,dh,s,x:Math.round((dw-s)/2),y:Math.round((dh-s)/2)};
    crPlace();$("crop").classList.remove("hide");
  };
  i.src=URL.createObjectURL(f);
};

$("cb").addEventListener("pointerdown",e=>{
  if(!cr)return;
  e.preventDefault();
  const r=$("cf").getBoundingClientRect();
  drag={m:e.target.dataset.h||"move",px:e.clientX-r.left,py:e.clientY-r.top,x:cr.x,y:cr.y,s:cr.s};
  $("cb").setPointerCapture(e.pointerId);
});

$("cb").addEventListener("pointermove",e=>{
  if(!drag||!cr)return;
  const r=$("cf").getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
  const d=drag,W=cr.dw,H=cr.dh;
  if(d.m==="move"){
    cr.x=clamp(d.x+px-d.px,0,W-d.s);
    cr.y=clamp(d.y+py-d.py,0,H-d.s);
  }else{
    const left=d.m==="tl"||d.m==="bl",top=d.m==="tl"||d.m==="tr";
    const ax=left?d.x+d.s:d.x, ay=top?d.y+d.s:d.y;     // jo kona fixed rehta hai
    let s=Math.min(Math.abs(px-ax),Math.abs(py-ay));
    s=clamp(s,MINS,Math.min(left?ax:W-ax,top?ay:H-ay));
    cr.s=s;cr.x=left?ax-s:ax;cr.y=top?ay-s:ay;
  }
  crPlace();
});
["pointerup","pointercancel"].forEach(ev=>$("cb").addEventListener(ev,()=>{drag=null}));

$("cno").onclick=()=>{$("crop").classList.add("hide");cr=null};

$("cok").onclick=()=>{
  if(!cr)return;
  const c=cr,N=Math.min(800,Math.round(c.s/c.k)),out=document.createElement("canvas");
  out.width=out.height=N;
  out.getContext("2d").drawImage(c.img,c.x/c.k,c.y/c.k,c.s/c.k,c.s/c.k,0,0,N,N);
  $("crop").classList.add("hide");cr=null;toast("Uploading photo… 0%",30000);
  out.toBlob(blob=>{
    const x=new XMLHttpRequest(),fd=new FormData();
    fd.append("file",blob,"photo.jpg");fd.append("upload_preset",PRESET);
    x.open("POST","https://api.cloudinary.com/v1_1/"+CLOUD+"/image/upload");
    x.upload.onprogress=e=>{if(e.lengthComputable)toast("Uploading photo… "+Math.round(e.loaded/e.total*100)+"%",30000)};
    x.onload=async()=>{
      try{
        const j=JSON.parse(x.responseText);if(!j.secure_url)throw 0;
        await updateDoc(doc(db,"users",me.uid),{photo:j.secure_url});
        me.photo=j.secure_url;setAv($("av"),me.name,j.secure_url);toast("Photo updated");
      }catch(e){toast("Upload failed")}
    };
    x.onerror=()=>toast("Upload failed");
    x.send(fd);
  },"image/jpeg",.9);
};

/* ---------- Name ---------- */
$("sn").onclick=()=>run($("sn"),async()=>{
  const name=$("n").value.trim();
  if(!name)return toast("Enter a name");
  if(name===me.name)return toast("No change");
  try{
    // naam saari chats mein bhi update hota hai
    const cs=await getDocs(query(collection(db,"chats"),where("members","array-contains",me.uid)));
    const b=writeBatch(db);
    b.update(doc(db,"users",me.uid),{name});
    cs.forEach(c=>b.update(c.ref,{["names."+me.uid]:name}));
    await b.commit();
    me.name=name;setAv($("av"),name,me.photo);toast("Name updated");
  }catch(x){toast("Could not update name")}
});

/* ---------- Username ---------- */
$("u").oninput=()=>{
  clearTimeout(timer);
  const v=$("u").value.trim().toLowerCase(),h=$("hint");
  h.className="hint";
  if(!v||v===me.username){h.textContent=v===me.username?"This is your current username":"";return}
  if(!valid(v)){h.textContent="3-20 letters, numbers or _";h.classList.add("bad");return}
  h.textContent="Checking...";
  timer=setTimeout(async()=>{
    try{
      const s=await getDoc(doc(db,"usernames",v));
      if($("u").value.trim().toLowerCase()!==v)return;
      h.textContent=s.exists()?"Username taken":"Username available";
      h.className="hint "+(s.exists()?"bad":"ok");
    }catch(e){h.textContent=""}
  },400);
};

$("su").onclick=()=>run($("su"),async()=>{
  const nu=$("u").value.trim().toLowerCase();
  if(!valid(nu))return toast("Username: 3-20 letters, numbers or _");
  if(nu===me.username)return toast("No change");
  try{
    if((await getDoc(doc(db,"usernames",nu))).exists())return toast("Username already taken");
    const b=writeBatch(db);
    b.set(doc(db,"usernames",nu),{uid:me.uid,email:auth.currentUser.email});
    b.delete(doc(db,"usernames",me.username));
    b.update(doc(db,"users",me.uid),{username:nu});
    await b.commit();
    me.username=nu;$("hint").textContent="";toast("Username updated. Ab naye username se login hoga");
  }catch(x){toast("Username not available")}
});

/* ---------- Password ---------- */
$("sp").onchange=()=>["pc","pn","pr"].forEach(id=>$(id).type=$("sp").checked?"text":"password");

$("spw").onclick=()=>run($("spw"),async()=>{
  const cur=$("pc").value,np=$("pn").value,rp=$("pr").value;
  if(!cur)return toast("Enter current password");
  if(np.length<6)return toast("New password needs 6+ characters");
  if(np!==rp)return toast("New passwords do not match");
  try{
    const u=auth.currentUser;
    await reauthenticateWithCredential(u,EmailAuthProvider.credential(u.email,cur));
    await updatePassword(u,np);
    ["pc","pn","pr"].forEach(id=>$(id).value="");toast("Password changed");
  }catch(x){
    toast(x.code==="auth/invalid-credential"||x.code==="auth/wrong-password"?"Current password is wrong":"Could not change password");
  }
});