/* Baatify motion.js — chat.js ko chhue bina DOM par animations lagata hai */
(function(){
  const $=id=>document.getElementById(id);
  const bd=document.body;

  /* ---------- Shared SVG art ---------- */
  // SVG files assets/ folder me hain (chat.html ke saath wale folder me)
  const BUB='<img class="mt-eimg" src="assets/empty-chat.svg" alt="" width="96" height="80" draggable="false">';
  const LOADER='<img class="mt-ld" src="assets/loading.svg" alt="Loading" width="68" height="68" draggable="false">';
  // Agar assets/ ki file na mile (galat folder / path), to wahi SVG andar se dikha do
  const FB_LD='<svg viewBox="0 0 60 60" width="68" height="68"><circle cx="30" cy="30" r="22" fill="none" stroke="#8696a0" stroke-opacity=".28" stroke-width="5"/><circle cx="30" cy="30" r="22" fill="none" stroke="#00a884" stroke-width="5" stroke-linecap="round" stroke-dasharray="38 100"><animateTransform attributeName="transform" type="rotate" from="0 30 30" to="360 30 30" dur="1.3s" repeatCount="indefinite"/></circle><circle cx="30" cy="30" r="13" fill="none" stroke="#00a884" stroke-opacity=".5" stroke-width="3" stroke-linecap="round" stroke-dasharray="22 65"><animateTransform attributeName="transform" type="rotate" from="0 30 30" to="360 30 30" dur="1.3s" repeatCount="indefinite"/></circle></svg>';
  const FB_EM='<svg viewBox="0 0 96 80" width="96" height="80"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" keyTimes="0;.5;1" dur="2.6s" repeatCount="indefinite"/><g transform="translate(2 2) scale(.8125)"><path d="M8 7Q8 2 14 2H51Q58 2 58 9V34Q58 40 51 40H27L13 51V40H14Q8 40 8 34Z" fill="#13A987"/><circle cx="22" cy="21" r="3" fill="#fff"/><circle cx="33" cy="21" r="3" fill="#fff"/><circle cx="44" cy="21" r="3" fill="#fff"/></g></g><g><animateTransform attributeName="transform" type="translate" values="0 -5;0 0;0 -5" keyTimes="0;.5;1" dur="2.6s" repeatCount="indefinite"/><g transform="translate(48 34) scale(.7188)"><path d="M6 7Q6 2 13 2H49Q57 2 57 9V34Q57 40 49 40H47V51L33 40H13Q6 40 6 34Z" fill="#7D6AE8"/><path d="M20 21H43" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g></g></svg>';
  addEventListener("error",e=>{
    const t=e.target;
    if(!t||t.tagName!=="IMG"||!(t.classList.contains("mt-ld")||t.classList.contains("mt-eimg")))return;
    const w=document.createElement("span");
    w.innerHTML=t.classList.contains("mt-ld")?FB_LD:FB_EM;
    const s=w.firstChild;s.setAttribute("class",t.className);
    t.replaceWith(s);
    console.warn("[motion] "+t.getAttribute("src")+" load nahi hui. assets/ folder chat.html ke saath wale folder me rakho.");
  },true);

  function emptyArt(title,sub){
    const d=document.createElement("div");d.className="mt-empty";
    d.innerHTML='<div class="mt-bub" aria-hidden="true">'+BUB+'</div><strong></strong><span></span>';
    d.querySelector("strong").textContent=title;d.querySelector("span").textContent=sub;
    return d;
  }

  /* ---------- 1) "Chat select nahi" screen: floating bubbles ---------- */
  const em=$("empty");
  if(em&&!em.querySelector(".mt-bub")){
    const d=document.createElement("div");d.className="mt-bub";d.setAttribute("aria-hidden","true");d.innerHTML=BUB;
    em.insertBefore(d,em.firstChild);
  }

  /* ---------- 2) Boot loader (chat.html me pehle se laga hai) + khali chat list ---------- */
  const list=$("list"),boot=$("mtBoot");
  const MIN=1300;
  let bootGone=false;
  function bootDone(){
    if(bootGone||!boot)return;bootGone=true;
    const t0=window.__mtT||0,left=Math.max(0,MIN-(performance.now()-t0));   // kam se kam 1 poora round
    setTimeout(()=>{boot.classList.add("out");setTimeout(()=>boot.remove(),300)},left);
  }
  if(list){
    const listSync=()=>{
      const real=[...list.children].some(e=>e.classList&&!e.classList.contains("sk")&&(e.classList.contains("row")||e.classList.contains("note")||e.classList.contains("mt-empty")));
      if(real)bootDone();
      const note=[...list.children].find(e=>e.classList&&e.classList.contains("note")&&/^No chats yet/.test(e.textContent));
      if(note&&!list.querySelector(".mt-empty")){
        note.classList.add("mt-hide");
        list.appendChild(emptyArt("No chats yet","Search a username above to start one"));
      }
    };
    new MutationObserver(listSync).observe(list,{childList:true});
    listSync();
  }else bootDone();

  const os=$("os"),oa=$("oa"),ms=$("msgs"),pane=$("pane");

  /* ---------- 3) Chat page: khali ho to Empty chat screen ---------- */
  let ce=null;
  if(ms&&pane){
    ce=document.createElement("div");ce.className="mt-ce";ce.appendChild(emptyArt("No messages yet","Say hello ✨"));
    pane.appendChild(ce);
  }
  function ceSync(){
    if(!ce)return;
    const confirmed=!!ms.querySelector(".ytl");           // chat.js ne pehli baar render kar liya
    const n=ms.querySelectorAll(".m:not(.mt-ty),.day").length;
    const on=confirmed&&n===0;
    if(on){ce.style.top=ms.offsetTop+"px";ce.style.height=ms.offsetHeight+"px"}
    ce.classList.toggle("on",on);
  }

  /* ---------- 4) Voice message waveform ---------- */
  const H=[9,15,24,13,31,19,27,12,34,17,25,10,30,15,22,12,28,18,33,12,23,16,29,10,19,27,13,31,17,24,11,20];
  function wfInit(vm,idx){
    const bar=vm.querySelector(".vbar"),fill=vm.querySelector(".vfill"),btn=vm.querySelector(".vp");
    vm.dataset.mt="1";
    if(!bar||!fill||!btn)return;
    const wf=document.createElement("div");wf.className="mt-wf";wf.setAttribute("aria-hidden","true");
    const bars=[];
    for(let i=0;i<H.length;i++){
      const s=document.createElement("span");
      s.style.height=Math.max(4,Math.round(H[(i+idx*7)%H.length]*.9))+"px";
      wf.appendChild(s);bars.push(s);
    }
    bar.appendChild(wf);vm.classList.add("mt-wfx");
    const upd=()=>{
      const p=parseFloat(fill.style.width)||0,n=Math.round(p/100*bars.length);
      bars.forEach((s,i)=>s.classList.toggle("on",i<n));
      vm.classList.toggle("mt-play",!!btn.querySelector('use[href="#i-pause"]'));
    };
    new MutationObserver(upd).observe(fill,{attributes:true,attributeFilter:["style"]});
    new MutationObserver(upd).observe(btn,{childList:true,subtree:true});
    upd();
  }
  function wfScan(){
    if(!ms)return;
    const all=[...ms.querySelectorAll(".vm")];
    all.forEach((v,i)=>{if(!v.dataset.mt)wfInit(v,i)});
  }

  /* ---------- 5) Typing bubble (chat ke andar): pop + smooth upar uthna ---------- */
  let tyEl=null;
  function follow(){
    const t0=performance.now();
    (function step(){
      ms.scrollTop=ms.scrollHeight;
      if(performance.now()-t0<480)requestAnimationFrame(step);
    })();
  }
  function tySync(){
    if(!ms||!os)return;
    if(!bd.classList.contains("mt-typing")||(pane&&pane.classList.contains("hide"))){if(tyEl&&tyEl.parentNode)tyEl.remove();return}
    if(!tyEl){
      tyEl=document.createElement("div");tyEl.className="m mt-ty";
      tyEl.setAttribute("role","img");tyEl.setAttribute("aria-label","typing");
      tyEl.innerHTML="<i></i><i></i><i></i>";
    }
    if(ms.lastElementChild!==tyEl){
      const near=ms.scrollHeight-ms.scrollTop-ms.clientHeight<140;
      ms.appendChild(tyEl);
      if(near)follow();                       // jhatka nahi: bubble ke saath chat dheere upar uthti hai
    }
  }
  // Naya message aate hi typing turant hat jaye
  let sup=0,seenLast=null;
  function hideTy(){sup=Date.now()+2500;bd.classList.remove("mt-typing");if(tyEl&&tyEl.parentNode)tyEl.remove()}
  function incoming(){
    if(!ms)return;
    const k=[...ms.children].filter(e=>e.classList.contains("m")&&!e.classList.contains("mt-ty"));
    const last=k[k.length-1];
    if(last&&last!==seenLast&&last.classList.contains("new")&&!last.classList.contains("me")){seenLast=last;hideTy()}
  }
  if(ms)new MutationObserver(()=>{incoming();tySync();ceSync();wfScan()}).observe(ms,{childList:true});
  new MutationObserver(()=>{
    if(Date.now()<sup&&bd.classList.contains("mt-typing")){bd.classList.remove("mt-typing");return}
    tySync();
  }).observe(bd,{attributes:true,attributeFilter:["class"]});
  addEventListener("resize",ceSync);

  /* ---------- 6) Online pulse (header avatar) ---------- */
  if(os&&oa){
    const f=()=>{oa.classList.toggle("on",os.textContent==="online"||bd.classList.contains("mt-typing"));tySync()};
    new MutationObserver(f).observe(os,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]});
    f();
  }

  /* ---------- 7) Send: plane ka ghost ud jata hai ---------- */
  const sd=$("send");
  if(sd){
    sd.addEventListener("click",()=>{
      const r=sd.getBoundingClientRect();
      if(!r.width)return;
      const g=sd.cloneNode(true);g.removeAttribute("id");g.className="mt-fly";g.setAttribute("aria-hidden","true");
      g.style.left=r.left+"px";g.style.top=r.top+"px";g.style.width=r.width+"px";g.style.height=r.height+"px";
      document.body.appendChild(g);setTimeout(()=>g.remove(),650);
    },true);
  }

  /* ---------- 8) Search: "Searching…" ke time icon pulse ---------- */
  const res=$("res"),sb=document.querySelector("#side .sbox");
  if(res&&sb){
    const f=()=>sb.classList.toggle("mtload",!res.classList.contains("hide")&&/Searching/.test(res.textContent));
    new MutationObserver(f).observe(res,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class"]});
  }

  ceSync();wfScan();
})();
