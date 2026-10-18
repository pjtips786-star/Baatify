/* ===== listgame.js: mini game (flappy bird) in the empty space under a short chat list =====
   Uses your header bird (assets/header.svg). Tap anywhere on the game to flap.
   Appears only when there is enough free space, hides while searching or when the list is long.
   Use THIS file or listfill.js, not both.
   Hook (chat.js, after `me` is known):
     import("./listgame.js"+V).then(m=>m.initListGame()).catch(()=>{});                     */
const SRC="assets/header.svg";      // <-- bird picture (same as hdsvg.js)
const MIN_FREE=170;                 // px of free space needed before the game is shown
const MAX_H=340;                    // game never gets taller than this
const BEST="bt_flap_best";

const $=id=>document.getElementById(id);
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};

function css(){
  if($("lgcss"))return;
  const s=E("style");s.id="lgcss";
  s.textContent=
"#lgame{position:absolute;left:0;right:0;z-index:0;box-sizing:border-box;padding:10px 12px 12px;display:flex;flex-direction:column}"+
"#lgame.hide{display:none}"+
"#lgame canvas{display:block;width:100%;flex:1 1 auto;min-height:0;border-radius:16px;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;cursor:pointer;outline:0}";
  document.head.appendChild(s);
}

let box=null,cv=null,ctx=null,W=0,H=0,S=1,dpr=1,raf=0,last=0;
let st="idle",y=0,vy=0,pipes=[],score=0,best=0,t0=0,dead0=0,bird=null,col={bg:"#202c33",g:"#00a884",tx:"#e9edef"};
try{best=+localStorage.getItem(BEST)||0}catch(e){}

function colors(){
  const c=getComputedStyle(document.documentElement),v=(n,d)=>(c.getPropertyValue(n)||"").trim()||d;
  col={bg:v("--panel","#202c33"),g:v("--g","#00a884"),tx:v("--text","#e9edef"),mute:v("--mute","#8696a0"),deep:v("--bg","#0b141a")};
}
function size(){
  const r=cv.getBoundingClientRect();
  dpr=Math.min(2,devicePixelRatio||1);
  W=Math.max(1,Math.round(r.width));H=Math.max(1,Math.round(r.height));
  cv.width=W*dpr;cv.height=H*dpr;
  S=Math.max(.6,Math.min(1.5,H/230));
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
const BX=()=>W*.26,BR=()=>Math.max(11,13*S);      // bird x, radius
const GAP=()=>Math.max(BR()*4.2,H*.40),PW=()=>Math.max(34,44*S),DIST=()=>Math.max(150,W*.52);

function reset(){
  y=H/2;vy=0;pipes=[];score=0;t0=performance.now();
}
function spawn(x){
  const g=GAP(),min=H*.14,max=H-g-H*.14;
  pipes.push({x,top:min+Math.random()*Math.max(1,max-min),pass:false});
}
function flap(){
  if(st==="idle"){reset();st="play";spawn(W+20);spawn(W+20+DIST())}
  else if(st==="dead"){if(performance.now()-dead0>450){reset();st="idle";y=H/2}return}
  vy=-430*S;
}
function die(){
  st="dead";dead0=performance.now();
  if(score>best){best=score;try{localStorage.setItem(BEST,String(best))}catch(e){}}
}
function step(dt){
  if(st==="idle"){y=H/2+Math.sin(performance.now()/260)*5*S;return}
  if(st!=="play")return;
  vy+=1500*S*dt;y+=vy*dt;
  const sp=118*S+Math.min(60,score*4)*S;
  pipes.forEach(p=>p.x-=sp*dt);
  if(pipes.length&&pipes[0].x<-PW()-4)pipes.shift();
  const lp=pipes[pipes.length-1];
  if(lp&&lp.x<W-DIST())spawn(lp.x+DIST());
  const r=BR()*.78,bx=BX();
  if(y<r){y=r;vy=0}
  if(y>H-r){y=H-r;die();return}
  for(const p of pipes){
    if(!p.pass&&p.x+PW()<bx-r){p.pass=true;score++}
    if(bx+r>p.x&&bx-r<p.x+PW()&&(y-r<p.top||y+r>p.top+GAP())){die();return}
  }
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.save();rr(0,0,W,H,16);ctx.clip();
  ctx.fillStyle=col.bg;ctx.fillRect(0,0,W,H);
  // soft dots
  ctx.fillStyle="rgba(128,150,160,.12)";
  for(let i=0;i<14;i++){const x=(i*97+((performance.now()/40)%W*.0))%W,yy=(i*53)%H;ctx.beginPath();ctx.arc(x,yy,1.6,0,6.3);ctx.fill()}
  // pipes
  const pw=PW(),g=GAP();
  pipes.forEach(p=>{
    ctx.fillStyle=col.g;
    rr(p.x,-20,pw,p.top+20,8);ctx.fill();
    rr(p.x,p.top+g,pw,H-p.top-g+20,8);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.18)";
    ctx.fillRect(p.x+5,0,5,p.top-6);ctx.fillRect(p.x+5,p.top+g+6,5,H);
  });
  // bird
  const r=BR(),bx=BX();
  ctx.save();ctx.translate(bx,y);
  ctx.rotate(Math.max(-.5,Math.min(1.1,vy/(700*S))));
  if(bird&&bird.complete&&bird.naturalWidth){
    const k=bird.naturalWidth/bird.naturalHeight,h=r*2.5,w=h*k;
    ctx.drawImage(bird,-w/2,-h/2,w,h);
  }else{ctx.fillStyle="#ffd166";ctx.beginPath();ctx.arc(0,0,r,0,6.3);ctx.fill();ctx.fillStyle="#222";ctx.beginPath();ctx.arc(r*.35,-r*.25,r*.16,0,6.3);ctx.fill()}
  ctx.restore();
  // text
  ctx.textAlign="center";ctx.fillStyle=col.tx;
  if(st==="play"){ctx.font="700 "+Math.round(26*S)+"px system-ui,sans-serif";ctx.fillText(score,W/2,H*.2)}
  else{
    ctx.fillStyle="rgba(0,0,0,.28)";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";
    if(st==="idle"){
      ctx.font="700 "+Math.round(20*S)+"px system-ui,sans-serif";ctx.fillText("Tap to play",W/2,H*.52);
      ctx.font=Math.round(13*S)+"px system-ui,sans-serif";ctx.fillStyle="rgba(255,255,255,.8)";
      ctx.fillText(best?"Best "+best:"Fly through the gaps",W/2,H*.52+22*S);
    }else{
      ctx.font="700 "+Math.round(22*S)+"px system-ui,sans-serif";ctx.fillText("Score "+score,W/2,H*.44);
      ctx.font=Math.round(14*S)+"px system-ui,sans-serif";ctx.fillStyle="rgba(255,255,255,.85)";
      ctx.fillText("Best "+best+(score>=best&&score>0?" · New record":""),W/2,H*.44+24*S);
      ctx.fillText("Tap to try again",W/2,H*.44+48*S);
    }
  }
  ctx.restore();
}
function loop(now){
  raf=0;
  if(!box||box.classList.contains("hide")||document.hidden){last=0;return}
  const dt=last?Math.min(.034,(now-last)/1000):0;last=now;
  step(dt);draw();
  raf=requestAnimationFrame(loop);
}
const kick=()=>{if(!raf)raf=requestAnimationFrame(loop)};

function place(){
  if(!box)return;
  const side=$("side"),list=$("list"),res=$("res");
  const searching=res&&!res.classList.contains("hide");
  const sr=side?side.getBoundingClientRect():null;
  if(!sr||!list||sr.height<50||searching){box.classList.add("hide");return}
  let top=list.getBoundingClientRect().top;
  const k=list.children;
  if(k.length)top=Math.max(top,k[k.length-1].getBoundingClientRect().bottom);
  const free=Math.floor(sr.bottom-top);
  if(free<MIN_FREE){box.classList.add("hide");return}
  const was=box.classList.contains("hide"),h=Math.min(MAX_H,free);
  box.classList.remove("hide");
  box.style.top=Math.max(0,top-sr.top)+"px";box.style.height=h+"px";
  const r=cv.getBoundingClientRect();
  if(st!=="play"&&(was||Math.abs(r.width-W)>1||Math.abs(r.height-H)>1)){size();reset();y=H/2}
  kick();
}
let pend=0;const soon=()=>{if(!pend)pend=requestAnimationFrame(()=>{pend=0;place()})};

export async function initListGame(){
  for(let i=0;i<50&&!($("side")&&$("list"));i++)await new Promise(r=>setTimeout(r,100));
  const side=$("side"),list=$("list");
  if(!side||!list||$("lgame"))return;
  css();colors();
  if(getComputedStyle(side).position==="static")side.style.position="relative";
  box=E("div");box.id="lgame";box.className="hide";box.setAttribute("aria-label","Mini game");
  cv=E("canvas");cv.setAttribute("role","button");cv.setAttribute("aria-label","Tap to flap");cv.tabIndex=0;
  box.appendChild(cv);side.appendChild(box);
  ctx=cv.getContext("2d");
  bird=new Image();bird.src=SRC;
  cv.addEventListener("pointerdown",e=>{e.preventDefault();flap()});
  cv.addEventListener("keydown",e=>{if(e.code==="Space"||e.key===" "||e.key==="Enter"){e.preventDefault();flap()}});
  new MutationObserver(soon).observe(list,{childList:true,subtree:true});
  const res=$("res");if(res)new MutationObserver(soon).observe(res,{attributes:true,attributeFilter:["class"]});
  if(window.ResizeObserver)new ResizeObserver(soon).observe(side);
  addEventListener("resize",soon);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){colors();soon();kick()}});
  setInterval(soon,2000);
  matchMedia("(prefers-color-scheme:light)").addEventListener&&matchMedia("(prefers-color-scheme:light)").addEventListener("change",()=>setTimeout(colors,50));
  place();
}
