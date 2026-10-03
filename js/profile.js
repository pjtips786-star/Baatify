import {auth,db} from "./firebase.js";
import {onAuthStateChanged,EmailAuthProvider,reauthenticateWithCredential,updatePassword} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc,updateDoc,writeBatch,collection,query,where,getDocs} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* ====== CONFIG: chat.js wali same Cloudinary values ====== */
const CLOUD="dzbqkvysn", PRESET="Baatify";
/* ========================================================= */

const $=id=>document.getElementById(id);
const valid=u=>/^[a-z0-9_]{3,20}$/.test(u);
let me=null,timer;

function toast(t){const e=$("toast");e.textContent=t;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),2800)}
function setAv(el,name,photo){
  if(photo){el.style.backgroundImage='url("'+photo+'")';el.textContent=""}
  else{el.style.backgroundImage="";el.textContent=(name||"?")[0].toUpperCase()}
}
async function run(btn,fn){btn.disabled=true;try{await fn()}finally{btn.disabled=false}}

onAuthStateChanged(auth,async u=>{
  if(!u){location.replace("login.html");return}
  const s=await getDoc(doc(db,"users",u.uid));
  if(!s.exists()){location.replace("login.html");return}
  me={uid:u.uid,...s.data()};
  $("n").value=me.name;$("u").value=me.username;setAv($("av"),me.name,me.photo);
  $("load").classList.add("hide");$("page").classList.remove("hide");
});

/* ---------- Photo ---------- */
function shrink(file,max){
  return new Promise((res,rej)=>{
    const i=new Image();
    i.onload=()=>{
      const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement("canvas");
      c.width=i.width*s;c.height=i.height*s;
      c.getContext("2d").drawImage(i,0,0,c.width,c.height);
      c.toBlob(res,"image/jpeg",.85);
    };
    i.onerror=rej;i.src=URL.createObjectURL(file);
  });
}
async function upload(f,max){
  const fd=new FormData();
  fd.append("file",await shrink(f,max),"photo.jpg");fd.append("upload_preset",PRESET);
  const r=await fetch("https://api.cloudinary.com/v1_1/"+CLOUD+"/image/upload",{method:"POST",body:fd});
  const j=await r.json();if(!j.secure_url)throw 0;return j.secure_url;
}
$("cam").onclick=()=>$("pf").click();
$("pf").onchange=async()=>{
  const f=$("pf").files[0];$("pf").value="";if(!f)return;
  if(CLOUD.startsWith("YOUR"))return toast("Add Cloudinary details in js/profile.js");
  toast("Uploading photo…");
  try{
    const url=await upload(f,400);
    await updateDoc(doc(db,"users",me.uid),{photo:url});
    me.photo=url;setAv($("av"),me.name,url);toast("Photo updated");
  }catch(x){toast("Upload failed")}
};

/* ---------- Name ---------- */
$("sn").onclick=()=>run($("sn"),async()=>{
  const name=$("n").value.trim();
  if(!name)return toast("Enter a name");
  if(name===me.name)return toast("No change");
  try{
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
    toast(x.code==="auth/invalid-credential"||x.code==="auth/wrong-password"?"Current password is wrong":"Could not change password")
  }
});