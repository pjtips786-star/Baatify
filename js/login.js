const {auth,db,mail}=await import("./firebase.js"+(window.V||""));
import {signInWithEmailAndPassword,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {doc,getDoc} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $=id=>document.getElementById(id);

onAuthStateChanged(auth,u=>{ if(u) location.replace("chat.html"); });

$("eye").onclick=()=>{
  const show=$("p").type==="password";
  $("p").type=show?"text":"password";
  $("eye").textContent=show?"Hide":"Show";
};

$("form").onsubmit=async e=>{
  e.preventDefault();
  const u=$("u").value.trim().toLowerCase(), p=$("p").value;
  if(!u||!p) return $("err").textContent="Enter username and password";
  $("err").textContent=""; $("go").disabled=true;
  try{
    // username se asli login email dhoondo (purane accounts ke liye fallback)
    const s=await getDoc(doc(db,"usernames",u));
    const email=(s.exists()&&s.data().email)||mail(u);
    await signInWithEmailAndPassword(auth,email,p);
    location.replace("chat.html");
  }catch(x){
    $("err").textContent = x.code==="auth/network-request-failed"
      ? "No internet" : "Wrong username or password";
  }
  $("go").disabled=false;
};