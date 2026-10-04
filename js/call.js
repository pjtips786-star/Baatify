const {db}=await import("./firebase.js"+(window.V||""));
import {doc,setDoc,updateDoc,addDoc,collection,query,where,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// STUN free hai. Kuch networks par TURN bhi chahiye:
// {urls:"turn:HOST:80",username:"USER",credential:"PASS"}
const ICE=[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}];

const $=id=>document.getElementById(id);
const ico=n=>'<svg class="i" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
let me=null,inited=false,call=null,pc=null,stream=null,mir=null,unsubs=[],pend=[],tick=null,ringT=null,t0=0;

function toast(t){const e=$("toast");if(!e)return;e.textContent=t;e.classList.add("on");setTimeout(()=>e.classList.remove("on"),5000)}
function setStatus(t){$("cs").textContent=t}
function dur(){const s=Math.floor((Date.now()-t0)/1000);return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}

function errMsg(e){
  console.error("CALL ERROR:",e);
  const n=(e&&typeof e.code==="string"&&e.code)||(e&&e.name)||"";
  if(n==="NotAllowedError")return "Mic/camera permission blocked. Allow it in site settings";
  if(n==="NotFoundError")return "No microphone/camera found";
  if(n==="NotReadableError")return "Mic/camera is in use by another app or tab";
  if(n==="SecurityError")return "Calls need a secure (HTTPS) site";
  if(n==="permission-denied")return "Firestore rules: publish the calls block";
  if(n==="unavailable")return "No internet / Firestore unreachable";
  return "Call error: "+(n||(e&&e.message)||"unknown");
}

function build(){
  const b=document.createElement("div");b.id="call";b.className="hide";
  b.innerHTML=
    '<video id="rv" autoplay playsinline></video><video id="lv" autoplay playsinline muted></video>'+
    '<div class="cinfo"><div class="av" id="cav"></div><b id="cn"></b><span id="cs"></span></div>'+
    '<div class="cbtns">'+
    '<button class="cb hide" id="cm" type="button" aria-label="Mute">'+ico("mic")+'</button>'+
    '<button class="cb hide" id="cc" type="button" aria-label="Camera">'+ico("video")+'</button>'+
    '<button class="cb red" id="ce" type="button" aria-label="End call">'+ico("phone")+'</button>'+
    '<button class="cb green hide" id="ck" type="button" aria-label="Accept">'+ico("phone")+'</button>'+
    '</div>';
  document.body.appendChild(b);
  $("ce").onclick=hang;
  $("ck").onclick=accept;
  $("cm").onclick=()=>{
    const t=stream&&stream.getAudioTracks()[0];if(!t)return;
    t.enabled=!t.enabled;$("cm").classList.toggle("off",!t.enabled);$("cm").innerHTML=ico(t.enabled?"mic":"micoff");
  };
  $("cc").onclick=()=>{
    const t=stream&&stream.getVideoTracks()[0];if(!t)return;
    t.enabled=!t.enabled;$("cc").classList.toggle("off",!t.enabled);$("cc").innerHTML=ico(t.enabled?"video":"videooff");
  };
}

function showUI(name,st,inc,photo){
  $("call").className=call.type==="audio"?"audio":"video";
  const av=$("cav");
  av.style.backgroundImage=photo?'url("'+photo+'")':"";
  av.textContent=photo?"":name[0].toUpperCase();
  $("cn").textContent=name;setStatus(st);
  $("ck").classList.toggle("hide",!inc);
  controls(false);
}
function controls(on){
  $("cm").classList.toggle("hide",!on);
  $("cc").classList.toggle("hide",!on||call.type==="audio");
  $("cm").classList.remove("off");$("cm").innerHTML=ico("mic");
  $("cc").classList.remove("off");$("cc").innerHTML=ico("video");
}

async function media(type){
  const a={echoCancellation:true,noiseSuppression:true},md=navigator.mediaDevices;
  if(type!=="video")return md.getUserMedia({audio:a});
  try{return await md.getUserMedia({audio:a,video:{facingMode:"user"}})}
  catch(e){
    if(e&&(e.name==="OverconstrainedError"||e.name==="NotFoundError"))
      return md.getUserMedia({audio:a,video:true});
    throw e;
  }
}

/* Video ko bhejne se pehle ulta (mirror) karo, taaki samne wale ko bhi mirror dikhe */
function mirror(src){
  const vt=src.getVideoTracks()[0];
  if(!vt)return null;
  const v=document.createElement("video");
  v.srcObject=new MediaStream([vt]);v.muted=true;v.playsInline=true;
  v.play().catch(()=>{});
  const c=document.createElement("canvas"),x=c.getContext("2d");
  let run=true;
  const draw=()=>{
    if(!run)return;
    if(v.videoWidth){
      if(c.width!==v.videoWidth||c.height!==v.videoHeight){c.width=v.videoWidth;c.height=v.videoHeight}
      x.setTransform(-1,0,0,1,c.width,0);
      x.drawImage(v,0,0,c.width,c.height);
    }
    if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  };
  draw();
  const out=c.captureStream(30);
  src.getAudioTracks().forEach(t=>out.addTrack(t));   // awaz wahi track, mute button kaam karega
  return {out,stop(){run=false;v.srcObject=null}};
}

// call ke liye jo stream pc ko dena hai: video ho to mirror wali, warna asli
function outStream(type){
  if(type==="video"){mir=mirror(stream);if(mir)return mir.out}
  return stream;
}

function mkpc(id,side,ready){
  const p=new RTCPeerConnection({iceServers:ICE});
  p.q=[];p.ready=ready;
  p.send=c=>addDoc(collection(db,"calls",id,side),c).catch(()=>{});
  p.onicecandidate=e=>{
    if(!e.candidate)return;
    const c=e.candidate.toJSON();
    p.ready?p.send(c):p.q.push(c);
  };
  p.ontrack=e=>{$("rv").srcObject=e.streams[0]};
  p.onconnectionstatechange=()=>{
    if(p.connectionState==="connected"){
    $("call").classList.add("live");
      clearTimeout(ringT);t0=Date.now();clearInterval(tick);
      tick=setInterval(()=>setStatus(dur()),1000);setStatus("00:00");
    }
    if(p.connectionState==="failed")end("Call failed (network problem)",true);
  };
  return p;
}
function cand(c){pc&&pc.remoteDescription?pc.addIceCandidate(c).catch(()=>{}):pend.push(c)}
function flush(){const a=pend;pend=[];a.forEach(cand)}
function listenCands(id,side){
  unsubs.push(onSnapshot(collection(db,"calls",id,side),s=>{
    s.docChanges().forEach(ch=>{if(ch.type==="added")cand(ch.doc.data())});
  }));
}

/* ---------- Caller ---------- */
export async function startCall(o,type){
  if(call)return toast("Already in a call");
  if(!me)return toast("Please wait, app is still loading");
  if(!window.RTCPeerConnection||!navigator.mediaDevices)return toast("Calls need HTTPS and a modern browser");
  call={role:"caller",type,peer:o};
  showUI(o.name,"Calling…",false,o.photo);
  try{
    stream=await media(type);
    if(type==="video")$("lv").srcObject=stream;
    const send=outStream(type);
    const ref=doc(collection(db,"calls"));call.id=ref.id;
    pc=mkpc(ref.id,"callerCandidates",false);
    send.getTracks().forEach(t=>pc.addTrack(t,send));
    const off=await pc.createOffer();await pc.setLocalDescription(off);
    await setDoc(ref,{from:me.uid,to:o.uid,fromName:me.name,fromPhoto:me.photo||"",type,status:"ringing",
      offer:{type:off.type,sdp:off.sdp},createdAt:serverTimestamp()});
    pc.ready=true;pc.q.forEach(pc.send);pc.q=[];
    unsubs.push(onSnapshot(ref,async s=>{
      const d=s.data();if(!d||!call)return;
      if(d.answer&&!call.gotAns){
        call.gotAns=true;
        await pc.setRemoteDescription(d.answer);flush();
        setStatus("Connecting…");controls(true);clearTimeout(ringT);
      }
      if(d.status==="declined")end("Call declined",false);
      if(d.status==="ended")end("Call ended",false);
    }));
    listenCands(ref.id,"calleeCandidates");
    ringT=setTimeout(()=>{
      if(call&&pc&&pc.connectionState!=="connected"){
        updateDoc(ref,{status:"missed"}).catch(()=>{});end("No answer",false);
      }
    },45000);
  }catch(e){end(errMsg(e),true)}
}

/* ---------- Callee ---------- */
export function initCalls(user){
  if(inited)return;inited=true;me=user;build();
  onSnapshot(
    query(collection(db,"calls"),where("to","==",me.uid),where("status","==","ringing")),
    s=>s.docChanges().forEach(ch=>{
      if(ch.type!=="added")return;
      const d=ch.doc.data({serverTimestamps:"estimate"});
      const ts=d.createdAt&&d.createdAt.toMillis?d.createdAt.toMillis():Date.now();
      if(Date.now()-ts>45000)return;                       // purani call ignore
      if(call){updateDoc(ch.doc.ref,{status:"declined"}).catch(()=>{});return} // busy
      incoming(ch.doc.id,d);
    }),
    e=>console.error("CALL LISTEN ERROR:",e)
  );
}

function incoming(id,d){
  call={id,role:"callee",type:d.type,offer:d.offer};
  showUI(d.fromName,"Incoming "+d.type+" call…",true,d.fromPhoto);
  if(navigator.vibrate)navigator.vibrate([300,200,300]);
  unsubs.push(onSnapshot(doc(db,"calls",id),s=>{
    const x=s.data();if(!x||!call)return;
    if(x.status==="ended"||x.status==="missed")end("Call ended",false);
    else if(x.status!=="ringing"&&!pc)end("Call cancelled",false);
  }));
  ringT=setTimeout(()=>{if(call&&!pc)end("Missed call",false)},45000);
}

async function accept(){
  const c=call;if(!c||pc)return;
  clearTimeout(ringT);$("ck").classList.add("hide");setStatus("Connecting…");
  try{
    stream=await media(c.type);
    if(c.type==="video")$("lv").srcObject=stream;
    const send=outStream(c.type);
    pc=mkpc(c.id,"calleeCandidates",true);
    send.getTracks().forEach(t=>pc.addTrack(t,send));
    await pc.setRemoteDescription(c.offer);flush();
    const a=await pc.createAnswer();await pc.setLocalDescription(a);
    await updateDoc(doc(db,"calls",c.id),{answer:{type:a.type,sdp:a.sdp},status:"accepted"});
    listenCands(c.id,"callerCandidates");
    controls(true);
  }catch(e){
    updateDoc(doc(db,"calls",c.id),{status:"declined"}).catch(()=>{});
    end(errMsg(e),false);
  }
}

/* ---------- End ---------- */
function hang(){
  if(!call)return;
  if(call.role==="callee"&&!pc){
    updateDoc(doc(db,"calls",call.id),{status:"declined"}).catch(()=>{});
    end("",false);
  }else end("Call ended",true);
}

function end(msg,notify){
  if(!call)return;
  const id=call.id;
  clearTimeout(ringT);clearInterval(tick);
  unsubs.forEach(u=>u());unsubs=[];
  if(pc){pc.close();pc=null}
  if(mir){mir.stop();mir=null}
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  $("rv").srcObject=null;$("lv").srcObject=null;
  if(notify&&id)updateDoc(doc(db,"calls",id),{status:"ended"}).catch(()=>{});
  call=null;pend=[];$("call").className="hide";
  if(msg)toast(msg);
}