
const SRT_GALLERY_KEY='srt_home_gallery_v1';
let SRT_GALLERY_INDEX=0;
let SRT_GALLERY_TIMER=null;
let SRT_GALLERY_REPLACE_ID=null;

function srtGallerySvg(title,subtitle,variant){
  const scenes={
    truck:`<rect width="1600" height="900" fill="#071b36"/><circle cx="1320" cy="150" r="230" fill="#10376b" opacity=".55"/><path d="M0 690 L1600 570 L1600 900 L0 900Z" fill="#122a48"/><path d="M0 735 L1600 615" stroke="#ff6a13" stroke-width="12" stroke-dasharray="42 30" opacity=".85"/><g transform="translate(430 350)"><rect x="0" y="95" width="500" height="190" rx="26" fill="#f4f7fb"/><rect x="500" y="145" width="205" height="140" rx="24" fill="#ff5a0a"/><rect x="545" y="165" width="110" height="62" rx="10" fill="#7dd9ff"/><circle cx="125" cy="305" r="62" fill="#06101d"/><circle cx="125" cy="305" r="29" fill="#aebdcd"/><circle cx="560" cy="305" r="62" fill="#06101d"/><circle cx="560" cy="305" r="29" fill="#aebdcd"/></g>`,
    plant:`<rect width="1600" height="900" fill="#0a2448"/><rect y="650" width="1600" height="250" fill="#112841"/><g fill="#dfe8f2"><rect x="220" y="280" width="250" height="370"/><rect x="520" y="190" width="190" height="460"/><rect x="760" y="330" width="340" height="320"/></g><g fill="#ff6410"><rect x="285" y="175" width="55" height="105"/><rect x="585" y="80" width="60" height="110"/><rect x="850" y="210" width="70" height="120"/></g><path d="M0 735 H1600" stroke="#f4f7fb" stroke-width="7" stroke-dasharray="38 28" opacity=".6"/><g transform="translate(980 510)"><rect width="260" height="90" rx="18" fill="#f4f7fb"/><rect x="255" y="25" width="105" height="65" rx="14" fill="#ff5a0a"/><circle cx="70" cy="105" r="32" fill="#06101d"/><circle cx="285" cy="105" r="32" fill="#06101d"/></g>`,
    route:`<rect width="1600" height="900" fill="#071b36"/><g opacity=".45" stroke="#1b467b" stroke-width="3"><path d="M0 180 H1600"/><path d="M0 360 H1600"/><path d="M0 540 H1600"/><path d="M0 720 H1600"/><path d="M320 0 V900"/><path d="M640 0 V900"/><path d="M960 0 V900"/><path d="M1280 0 V900"/></g><path d="M120 690 C420 120 920 800 1470 220" fill="none" stroke="#ff6410" stroke-width="20" stroke-linecap="round" stroke-dasharray="24 28"/><circle cx="120" cy="690" r="28" fill="#22c55e"/><circle cx="1470" cy="220" r="28" fill="#00c8ff"/><g transform="translate(735 430)"><rect width="235" height="90" rx="18" fill="#f4f7fb"/><rect x="230" y="27" width="95" height="63" rx="14" fill="#ff5a0a"/><circle cx="65" cy="104" r="29" fill="#06101d"/><circle cx="255" cy="104" r="29" fill="#06101d"/></g>`
  };
  const body=scenes[variant]||scenes.truck;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">${body}<text x="100" y="115" fill="#fff" font-family="Arial,sans-serif" font-size="68" font-weight="700">${title}</text><text x="104" y="175" fill="#c6d5e7" font-family="Arial,sans-serif" font-size="30">${subtitle}</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
function srtDefaultGallery(){
  return [
    {id:'gal_default_1',src:srtGallerySvg('Shree Ram Transport','Reliable truck transportation services','truck'),caption:'Reliable truck transportation services across major routes'},
    {id:'gal_default_2',src:srtGallerySvg('Loading & Dispatch','Coordinated cement movement and vehicle operations','plant'),caption:'Loading and dispatch coordination for cement transportation'},
    {id:'gal_default_3',src:srtGallerySvg('Route Network','Freight movement with operational visibility','route'),caption:'Freight route network and transportation operations'}
  ];
}
function srtGalleryLoad(){
  try{
    const raw=localStorage.getItem(SRT_GALLERY_KEY);
    if(raw){const arr=JSON.parse(raw);if(Array.isArray(arr))return arr;}
  }catch(e){}
  const defaults=srtDefaultGallery();
  try{localStorage.setItem(SRT_GALLERY_KEY,JSON.stringify(defaults));}catch(e){}
  return defaults;
}
function srtGallerySave(items){
  try{localStorage.setItem(SRT_GALLERY_KEY,JSON.stringify(items));return true;}
  catch(e){toast('Gallery storage is full. Delete an older image or upload a smaller image.','var(--red)');return false;}
}
function srtGalleryEscape(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function renderHomeGallery(){
  const stage=document.getElementById('homeGalleryStage'),dots=document.getElementById('homeGalleryDots');
  if(!stage||!dots)return;
  const items=srtGalleryLoad();
  if(!items.length){stage.innerHTML='<div class="home-gallery-empty">No gallery images available.</div>';dots.innerHTML='';return;}
  if(SRT_GALLERY_INDEX>=items.length)SRT_GALLERY_INDEX=0;
  stage.innerHTML=items.map((item,i)=>`<div class="home-gallery-slide ${i===SRT_GALLERY_INDEX?'active':''}"><img src="${item.src}" alt="${srtGalleryEscape(item.caption||'Shree Ram Transport gallery image')}"><div class="home-gallery-caption"><strong>Shree Ram Transport</strong><span>${srtGalleryEscape(item.caption||'Transport operations')}</span></div></div>`).join('');
  dots.innerHTML=items.map((_,i)=>`<button class="home-gallery-dot ${i===SRT_GALLERY_INDEX?'active':''}" type="button" onclick="srtGalleryGo(${i})" aria-label="Gallery image ${i+1}"></button>`).join('');
  srtGalleryRestartTimer();
  if(typeof srtRefreshMotion==='function')setTimeout(srtRefreshMotion,0);
}
function srtGalleryGo(index){const items=srtGalleryLoad();if(!items.length)return;SRT_GALLERY_INDEX=(index+items.length)%items.length;renderHomeGallery();}
function srtGalleryMove(step){srtGalleryGo(SRT_GALLERY_INDEX+step);}
function srtGalleryRestartTimer(){clearInterval(SRT_GALLERY_TIMER);if(srtGalleryLoad().length>1)SRT_GALLERY_TIMER=setInterval(()=>srtGalleryMove(1),5000);}

function srtGalleryResizeFile(file){
  return new Promise((resolve,reject)=>{
    if(!file||!/^image\/(png|jpeg|webp)$/i.test(file.type||'')){reject(new Error('Please select a PNG, JPG or WebP image.'));return;}
    if(file.size>5*1024*1024){reject(new Error('Image must be 5 MB or smaller.'));return;}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Unable to read image.'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('Invalid image file.'));
      img.onload=()=>{
        const maxW=1600,maxH=900,scale=Math.min(1,maxW/img.width,maxH/img.height);
        const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',.8));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function renderGalleryAdminManagement(){
  const grid=document.getElementById('galleryAdminGrid');if(!grid)return;
  if(typeof srtIsAdmin==='function'&&!srtIsAdmin()){grid.innerHTML='';return;}
  const items=srtGalleryLoad();
  grid.innerHTML=items.length?items.map((item,i)=>`<div class="srt-gallery-admin-card"><img class="srt-gallery-admin-thumb" src="${item.src}" alt="Gallery image ${i+1}"><input class="srt-gallery-admin-caption" id="galleryCaption_${item.id}" maxlength="100" value="${srtGalleryEscape(item.caption||'')}"><div class="srt-gallery-admin-actions"><button type="button" onclick="srtGallerySaveCaption('${item.id}')">Save Caption</button><button type="button" onclick="srtGalleryChooseReplace('${item.id}')">Replace Image</button><button class="danger" type="button" onclick="srtGalleryDelete('${item.id}')">Delete</button></div><div class="srt-gallery-admin-meta">Slide ${i+1}</div></div>`).join(''):'<div class="srt-no-access">No gallery images. Add an image above.</div>';
}
async function srtGalleryAddFromAdmin(){
  if(!srtIsAdmin()){toast('Administrator access required.','var(--red)');return;}
  const fileEl=document.getElementById('galleryAddFile'),capEl=document.getElementById('galleryAddCaption');const file=fileEl?.files?.[0];
  if(!file){toast('Select an image first.','var(--yellow)');return;}
  const items=srtGalleryLoad();if(items.length>=10){toast('Gallery supports up to 10 images. Delete one before adding another.','var(--yellow)');return;}
  try{const src=await srtGalleryResizeFile(file);items.push({id:'gal_'+Date.now().toString(36),src,caption:(capEl?.value||'').trim()||'Shree Ram Transport operations'});if(!srtGallerySave(items))return;if(fileEl)fileEl.value='';if(capEl)capEl.value='';renderGalleryAdminManagement();renderHomeGallery();toast('Gallery image added.','var(--green)');}catch(err){toast(err.message||'Could not add image.','var(--red)');}
}
function srtGallerySaveCaption(id){
  if(!srtIsAdmin())return;const items=srtGalleryLoad(),item=items.find(x=>x.id===id);if(!item)return;const el=document.getElementById('galleryCaption_'+id);item.caption=(el?.value||'').trim()||'Shree Ram Transport operations';if(!srtGallerySave(items))return;renderGalleryAdminManagement();renderHomeGallery();toast('Gallery caption updated.','var(--green)');
}
function srtGalleryChooseReplace(id){if(!srtIsAdmin())return;SRT_GALLERY_REPLACE_ID=id;const input=document.getElementById('galleryReplaceFile');if(input){input.value='';input.click();}}
async function srtGalleryReplaceSelected(input){
  if(!srtIsAdmin()||!SRT_GALLERY_REPLACE_ID)return;const file=input?.files?.[0];if(!file)return;
  try{const src=await srtGalleryResizeFile(file);const items=srtGalleryLoad(),item=items.find(x=>x.id===SRT_GALLERY_REPLACE_ID);if(!item)return;item.src=src;if(!srtGallerySave(items))return;renderGalleryAdminManagement();renderHomeGallery();toast('Gallery image replaced.','var(--green)');}catch(err){toast(err.message||'Could not replace image.','var(--red)');}finally{SRT_GALLERY_REPLACE_ID=null;if(input)input.value='';}
}
function srtGalleryDelete(id){
  if(!srtIsAdmin())return;const items=srtGalleryLoad(),item=items.find(x=>x.id===id);if(!item)return;if(!confirm('Delete this gallery image?'))return;const next=items.filter(x=>x.id!==id);if(!srtGallerySave(next))return;SRT_GALLERY_INDEX=0;renderGalleryAdminManagement();renderHomeGallery();toast('Gallery image deleted.','var(--red)');
}
window.renderHomeGallery=renderHomeGallery;
window.renderGalleryAdminManagement=renderGalleryAdminManagement;
window.srtGalleryGo=srtGalleryGo;window.srtGalleryMove=srtGalleryMove;window.srtGalleryAddFromAdmin=srtGalleryAddFromAdmin;window.srtGallerySaveCaption=srtGallerySaveCaption;window.srtGalleryChooseReplace=srtGalleryChooseReplace;window.srtGalleryReplaceSelected=srtGalleryReplaceSelected;window.srtGalleryDelete=srtGalleryDelete;
document.addEventListener('DOMContentLoaded',()=>{renderHomeGallery();});
