
(function(){
  let revealObserver=null;

  function srtMarkRevealTargets(root=document){
    const selectors=[
      '#pg-home .home-section-inner > h2',
      '#pg-home .home-section-intro',
      '#pg-home .home-stat',
      '#pg-home .home-city-card',
      '#pg-home .home-gallery-wrap',
      '#pg-home .home-about-card',
      '#pg-home .home-about-grid > *',
      '#pg-home .home-contact-card',
      '#pg-home .home-footer-grid > *'
    ];
    let delayIndex=0;
    root.querySelectorAll?.(selectors.join(',')).forEach(el=>{
      if(el.dataset.srtMotionReady==='1') return;
      el.dataset.srtMotionReady='1';
      el.classList.add('srt-reveal');
      el.dataset.srtDelay=String((delayIndex%6)+1);
      delayIndex++;
      if(revealObserver) revealObserver.observe(el);
    });
  }

  function srtInitReveal(){
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      document.querySelectorAll('.srt-reveal').forEach(el=>el.classList.add('srt-visible'));
      return;
    }
    revealObserver=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('srt-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },{threshold:.12,rootMargin:'0px 0px -50px 0px'});
    srtMarkRevealTargets(document);
  }

  function srtUpdateHeaderMotion(){
    const header=document.querySelector('#pg-home .home-header');
    if(!header) return;
    const y=(document.getElementById('pg-home')?.scrollTop||window.scrollY||0);
    header.classList.toggle('srt-scrolled',y>18);
  }

  function srtRefreshMotion(){
    srtMarkRevealTargets(document);
    requestAnimationFrame(()=>{
      document.querySelectorAll('#pg-home .srt-reveal').forEach(el=>{
        const r=el.getBoundingClientRect();
        if(r.top < window.innerHeight*.92 && r.bottom>0) el.classList.add('srt-visible');
      });
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    srtInitReveal();
    const home=document.getElementById('pg-home');
    home?.addEventListener('scroll',srtUpdateHeaderMotion,{passive:true});
    window.addEventListener('scroll',srtUpdateHeaderMotion,{passive:true});
    srtUpdateHeaderMotion();

    const mo=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.addedNodes && m.addedNodes.length)) srtRefreshMotion();
    });
    mo.observe(document.body,{childList:true,subtree:true});

    document.addEventListener('click',e=>{
      const el=e.target.closest('#pg-home button,#pg-home .home-btn,#pg-home .home-btn-outline,#pg-home .home-gallery-btn,#pg-home .home-gallery-dot');
      if(!el) return;
      el.classList.remove('srt-click-pulse');
      void el.offsetWidth;
      el.classList.add('srt-click-pulse');
      setTimeout(()=>el.classList.remove('srt-click-pulse'),280);
    });
  });

  window.srtRefreshMotion=srtRefreshMotion;
})();
