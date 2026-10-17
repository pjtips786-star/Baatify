/* ===== pageload.js: admin / profile page par bhi loading.svg (page khulne se pehle, loop me) =====
   Lagao: <body> ke bilkul shuru me:
   <script>document.write('<script src="js/pageload.js'+(window.V||"")+'"><\/script>')</script>
   Zyada der data aata ho to: <script ... data-wait="#kuchh"> (us element me content aate hi hatega) */
(()=>{
  const SRC="assets/loading.svg";   // <-- loading svg ka path
  const SIZE=250;                    // <-- size (px) yahan se badlo
  const MIN=800;                   // <-- kam se kam itni der (ms) dikhegi (1 poora round)
  const MAX=;                  // <-- kuch bhi ho to 10 sec baad hata do
  if(document.getElementById("mtBoot"))return;
  const me=document.currentScript,wait=me&&me.dataset&&me.dataset.wait;
  const t0=performance.now();
  const st=document.createElement("style");
  st.textContent="#mtBoot{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#111b21;transition:opacity .25s}@media(prefers-color-scheme:light){#mtBoot{background:#fff}}#mtBoot.out{opacity:0;pointer-events:none}#mtBoot img{width:"+SIZE+"px;height:"+SIZE+"px}";
  const b=document.createElement("div");b.id="mtBoot";b.setAttribute("role","status");b.setAttribute("aria-label","Loading");
  const im=new Image();im.alt="";im.width=im.height=SIZE;im.src=SRC;b.appendChild(im);
  (document.head||document.documentElement).appendChild(st);
  document.documentElement.appendChild(b);
  let gone=false;
  const hide=()=>{
    if(gone)return;gone=true;
    setTimeout(()=>{b.classList.add("out");setTimeout(()=>b.remove(),300)},Math.max(0,MIN-(performance.now()-t0)));
  };
  window.btReady=hide;                                   // page chahe to khud bhi bula sakta hai
  setTimeout(hide,MAX);
  const ready=()=>{
    if(!wait){hide();return}
    const chk=()=>{const e=document.querySelector(wait);if(e&&(e.children.length||e.textContent.trim())){hide();return true}};
    if(chk())return;
    const mo=new MutationObserver(()=>{if(chk())mo.disconnect()});
    mo.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  };
  if(document.readyState==="complete")ready();else addEventListener("load",ready);
})();
