/* Baatify motion.js — chat.js ko chhue bina DOM par animations lagata hai */
(function(){
  const $=id=>document.getElementById(id);

  // 1) Empty chat: floating bubbles
  const em=$("empty");
  if(em&&!em.querySelector(".mt-bub")){
    const d=document.createElement("div");d.className="mt-bub";d.setAttribute("aria-hidden","true");
    d.innerHTML=
      '<svg class="mt-b1" viewBox="0 0 64 54" fill="none"><path d="M8 7Q8 2 14 2H51Q58 2 58 9V34Q58 40 51 40H27L13 51V40H14Q8 40 8 34Z" fill="#13A987"/><circle cx="22" cy="21" r="3" fill="#fff"/><circle cx="33" cy="21" r="3" fill="#fff"/><circle cx="44" cy="21" r="3" fill="#fff"/></svg>'+
      '<svg class="mt-b2" viewBox="0 0 64 54" fill="none"><path d="M6 7Q6 2 13 2H49Q57 2 57 9V34Q57 40 49 40H47V51L33 40H13Q6 40 6 34Z" fill="#7D6AE8"/><path d="M20 21H43" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>';
    em.insertBefore(d,em.firstChild);
  }

  const os=$("os"),oa=$("oa");

  // 2a) Chat ke andar typing bubble (samne wala type kare tab, aakhri message ke neeche)
  const ms=$("msgs");let tyEl=null;
  function tySync(){
    if(!ms||!os)return;
    if(!os.classList.contains("ty")){if(tyEl&&tyEl.parentNode)tyEl.remove();return}
    if(!tyEl){
      tyEl=document.createElement("div");tyEl.className="m tail mt-ty";
      tyEl.setAttribute("role","img");tyEl.setAttribute("aria-label","typing");
      tyEl.innerHTML="<i></i><i></i><i></i>";
    }
    if(ms.lastElementChild!==tyEl){
      const near=ms.scrollHeight-ms.scrollTop-ms.clientHeight<140;
      ms.appendChild(tyEl);
      if(near)ms.scrollTop=ms.scrollHeight;
    }
  }
  if(ms)new MutationObserver(tySync).observe(ms,{childList:true});

  // 2) Online pulse: header ke avatar par (status "online" ya "typing" ho tab)
  if(os&&oa){
    const f=()=>{oa.classList.toggle("on",os.textContent==="online"||os.classList.contains("ty"));tySync()};
    new MutationObserver(f).observe(os,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["class"]});
    f();
  }

  // 3) Send: plane ka ghost ud jata hai (button khud to turant chhup jata hai)
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

  // 4) Search: "Searching…" ke time icon pulse
  const res=$("res"),sb=document.querySelector("#side .sbox");
  if(res&&sb){
    const f=()=>sb.classList.toggle("mtload",!res.classList.contains("hide")&&/Searching/.test(res.textContent));
    new MutationObserver(f).observe(res,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class"]});
  }
})();
