
function renderHomeDispatchCities(){
  const grid=document.getElementById('homeDispatchCities');
  if(!grid||typeof STATE==='undefined'||!Array.isArray(STATE.inv)) return;
  const cityMap={};
  STATE.inv.forEach(r=>{
    const raw=String(r['Destination City']||'').trim();
    const mt=parseFloat(r['MT'])||0;
    if(!raw||raw==='-'||!mt) return;
    const key=raw.toLowerCase().replace(/\s+/g,' ');
    if(!cityMap[key]) cityMap[key]={name:key.replace(/\b\w/g,ch=>ch.toUpperCase()),value:0};
    cityMap[key].value+=mt;
  });
  const topCities=Object.values(cityMap).sort((a,b)=>b.value-a.value).slice(0,14);
  const cityIcons=['🚛','🚚','🛻','🚐','🏭','📦','🛣️','📍','🏗️','🏢','🧭','🗺️','🚧','🏬'];
  grid.innerHTML=topCities.length?topCities.map((city,index)=>`<div class="home-city-card"><span class="city-icon"><span class="animated-truck">${cityIcons[index%cityIcons.length]}</span></span><strong>${city.name}</strong></div>`).join(''):'<div class="home-city-card"><span class="city-icon"><span class="animated-truck">🚛</span></span><strong>No dispatch city data</strong></div>'; if(typeof srtRefreshMotion==='function')setTimeout(srtRefreshMotion,0);
}

function srtSwitchPage(pageId){
  ['pg-home','pg-login','pg-dash'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
  document.getElementById(pageId)?.classList.add('active');
  if(pageId==='pg-dash'){
    if(typeof initDash==='function') initDash();
    if(typeof srtApplyUserUI==='function') srtApplyUserUI();
  }
  if(pageId!=='pg-dash'){
    const home=document.getElementById('pg-home');
    if(home) home.scrollTop=0;
    window.scrollTo({top:0,left:0,behavior:'auto'});
  }
}
function showHomePage(){renderHomeDispatchCities();if(typeof renderHomeGallery==='function')renderHomeGallery();srtSwitchPage('pg-home');}
function showLoginPage(){srtSwitchPage('pg-login');srtPrepareLogin();setTimeout(()=>{if(document.getElementById('pg-login')?.classList.contains('active'))document.getElementById(document.getElementById('lu').value?'lp':'lu')?.focus({preventScroll:true});},60);}
function showDashboardPage(){srtSwitchPage('pg-dash');}
window.showHomePage=showHomePage;
window.showLoginPage=showLoginPage;
window.showDashboardPage=showDashboardPage;

document.addEventListener('DOMContentLoaded',()=>{
  renderHomeDispatchCities();
  if(typeof renderHomeGallery==='function')renderHomeGallery();
  const loggedIn=typeof srtGetCurrentUser==='function' ? srtGetCurrentUser() : null;
  if(loggedIn){
    showDashboardPage();
  }else{
    showHomePage();
  }
  document.querySelectorAll('.home-nav a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const id=a.getAttribute('href');
      if(!id||id==='#') return;
      const target=document.querySelector(id);
      if(target){e.preventDefault();target.scrollIntoView({behavior:'smooth',block:'start'});}
    });
  });
});
