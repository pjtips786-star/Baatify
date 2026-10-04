const {auth,db,mail}=await import("./firebase.js"+(window.V||""));
import {createUserWithEmailAndPassword,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc,setDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
const valid=u=>/^[a-z0-9_]{3,20}$/.test(u);
let working=false, timer;

onAuthStateChanged(auth,u=>{ if(u&&!working) location.replace("chat.html"); });

$("eye").onclick=()=>{
  const show=$("p").type==="password";
  $("p").type=show?"text":"password";
  $("eye").textContent=show?"Hide":"Show";
};

// live username check
$("u").oninput=()=>{
  clearTimeout(timer);
  const u=$("u").value.trim().toLowerCase(), h=$("hint");
  h.className="hint";
  if(!u){ h.textContent=""; return; }
  if(!valid(u)){ h.textContent="3-20 letters, numbers or _"; h.classList.add("bad"); return; }
  h.textContent="Checking...";
  timer=setTimeout(async()=>{
    try{
      const s=await getDoc(doc(db,"usernames",u));
      if($("u").value.trim().toLowerCase()!==u) return;
      h.textContent = s.exists() ? "Username taken" : "Username available";
      h.className = "hint " + (s.exists() ? "bad" : "ok");
    }catch(e){ h.textContent=""; }
  },400);
};

$("form").onsubmit=async e=>{
  e.preventDefault();
  const name=$("n").value.trim(), u=$("u").value.trim().toLowerCase(), p=$("p").value;
  const err=t=>$("err").textContent=t;
  if(!name) return err("Enter your name");
  if(!valid(u)) return err("Username: 3-20 letters, numbers or _");
  if(p.length<6) return err("Password needs 6+ characters");
  err(""); $("go").disabled=true; working=true;
  try{
    if((await getDoc(doc(db,"usernames",u))).exists()) throw {code:"taken"};
    const c=await createUserWithEmailAndPassword(auth,mail(u),p);
    // email bhi store hota hai, taaki baad mein username badalne par login chalta rahe
    await setDoc(doc(db,"usernames",u),{uid:c.user.uid,email:mail(u)});
    await setDoc(doc(db,"users",c.user.uid),{name,username:u,createdAt:serverTimestamp()});
    location.replace("chat.html");
    return;
  }catch(x){
    err(x.code==="taken"||x.code==="auth/email-already-in-use"
      ? "Username already taken" : "Sign up failed: "+(x.code||x.message));
  }
  working=false; $("go").disabled=false;
};