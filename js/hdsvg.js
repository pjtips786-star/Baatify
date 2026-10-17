/* ===== hdsvg.js: header me svg profile icon se admin icon tak left-right chalta rahe ===== */
const SRC="assets/bird.svg";      // <-- yahan apni svg ka naam likho (assets folder me)
const SIZE=30;                      // <-- svg ka size (px) yahan se chhota-bada karo
const SECS=7;                       // <-- ek taraf se doosri taraf aur wapas aane ka time (sec)

const head=document.querySelector("#side>header");
const av=document.getElementById("me");
if(head&&av&&!matchMedia("(prefers-reduced-motion:reduce)").matches){
  const st=document.createElement("style");
  st.textContent=`
#side>header{position:relative}
#side>header>:not(#hdw){position:relative;z-index:1}
#hdw{position:absolute;top:0;bottom:0;left:0;width:0;z-index:0;pointer-events:none;display:flex;align-items:center}
#hdv{width:${SIZE}px;height:${SIZE}px;flex:none;animation:hdmv ${SECS}s linear infinite;will-change:transform}
@keyframes hdmv{
 0%{transform:translateX(0) scaleX(1);animation-timing-function:ease-in-out}
 49.5%{transform:translateX(var(--d)) scaleX(1)}
 50%{transform:translateX(var(--d)) scaleX(-1);animation-timing-function:ease-in-out}
 99.5%{transform:translateX(0) scaleX(-1)}
 100%{transform:translateX(0) scaleX(1)}}`;
  document.head.appendChild(st);
  const w=document.createElement("div");w.id="hdw";w.setAttribute("aria-hidden","true");
  const im=new Image();im.id="hdv";im.alt="";im.src=SRC;im.draggable=false;
  w.appendChild(im);head.appendChild(w);

  const place=()=>{                           // profile icon ke baad se admin icon (na ho to logout) tak
    const adm=document.getElementById("adm"),out=document.getElementById("out");
    const end=(adm&&!adm.classList.contains("hide")&&adm.offsetWidth)?adm:out;
    const hb=head.getBoundingClientRect(),a=av.getBoundingClientRect();
    const l=a.right-hb.left+6;
    const r=end?end.getBoundingClientRect().left-hb.left-6:hb.width-l;
    w.style.left=l+"px";w.style.width=Math.max(r-l,0)+"px";
    w.style.setProperty("--d",Math.max(r-l-SIZE,0)+"px");
    w.style.display=r-l>SIZE?"flex":"none";
  };
  place();
  new ResizeObserver(place).observe(head);
  new MutationObserver(place).observe(head,{subtree:true,attributes:true,attributeFilter:["class"],childList:true});
  addEventListener("load",place);
}
