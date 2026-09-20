
// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS + LOCAL INTERNAL CHAT
// This standalone HTML persists data in browser localStorage.
// ══════════════════════════════════════════════════════════════
const SRT_NOTIFICATION_KEY='srt_notifications_v1';
const SRT_CHAT_KEY='srt_chat_messages_v1';
let SRT_NOTIFICATION_FILTER='all';
let SRT_CHAT_TARGET='group';
let SRT_NOTIFY_CAPTURE=true;
let SRT_SYNC_CHANNEL=null;
try{SRT_SYNC_CHANNEL=new BroadcastChannel('srt_internal_sync_v1');SRT_SYNC_CHANNEL.onmessage=()=>srtRefreshCommunicationUI();}catch(e){}

function srtCommUser(){try{return typeof srtGetCurrentUser==='function'?srtGetCurrentUser():null}catch(e){return null}}
function srtCommAccounts(){try{return typeof srtGetAccounts==='function'?srtGetAccounts().filter(a=>a&&a.status==='Active'):[]}catch(e){return []}}
function srtSafeParse(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}}
function srtSaveArray(key,arr){try{localStorage.setItem(key,JSON.stringify(arr));if(SRT_SYNC_CHANNEL)SRT_SYNC_CHANNEL.postMessage({key,at:Date.now()})}catch(e){}}
function srtEsc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function srtTimeAgo(ts){const d=new Date(ts),sec=Math.max(0,(Date.now()-d.getTime())/1000);if(sec<60)return 'now';if(sec<3600)return Math.floor(sec/60)+'m';if(sec<86400)return Math.floor(sec/3600)+'h';if(sec<604800)return Math.floor(sec/86400)+'d';return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});}
function srtChatClock(ts){try{return new Date(ts).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
function srtUserLabel(a){return a?.personal?.fullName||a?.name||a?.email||'User'}
function srtInitialsLocal(name){return String(name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'U'}
function srtNotifyIcon(type){return ({invoice:'📋',payment:'💳',company:'🏢',gps:'📡',attendance:'📅',expense:'💰',freight:'🚛',chat:'💬',account:'👤',gallery:'🖼️',system:'ℹ️'}[type]||'🔔')}
function srtNotifyGroup(type){if(type==='chat')return'chat';if(type==='account')return'account';if(['invoice','payment','company','gps','attendance','expense','freight','gallery'].includes(type))return'records';return'system'}
function srtClassifyMessage(msg){const m=String(msg||'').toLowerCase();if(m.includes('registration')||m.includes('account')||m.includes('user'))return'account';if(m.includes('invoice'))return'invoice';if(m.includes('payment'))return'payment';if(m.includes('gps'))return'gps';if(m.includes('attendance')||m.includes('staff')||m.includes('salary')||m.includes('holiday'))return'attendance';if(m.includes('expense'))return'expense';if(m.includes('freight'))return'freight';if(m.includes('gallery')||m.includes('image'))return'gallery';return'system'}
function srtTypeTitle(type){return ({invoice:'Invoice update',payment:'Payment update',company:'Company payment update',gps:'GPS update',attendance:'Attendance update',expense:'Expense update',freight:'Freight update',gallery:'Gallery update',account:'Account update',chat:'New chat message',system:'System update'}[type]||'Notification')}
function srtTargetVisible(n,u){if(!u)return false;if(!n.target||n.target==='all')return true;if(n.target==='all_except_sender')return n.actorId!==u.id;return n.target===u.id||n.target===u.email;}
function srtAddNotification(type,title,message,target='all',actorId=''){
  if(!message)return;const u=srtCommUser();let arr=srtSafeParse(SRT_NOTIFICATION_KEY);
  const fingerprint=`${type}|${title}|${message}|${target}`;const recent=arr.find(x=>x.fingerprint===fingerprint&&Date.now()-new Date(x.at).getTime()<2500);if(recent)return;
  arr.unshift({id:'n_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:type||'system',title:title||srtTypeTitle(type),message:String(message),target:target||'all',actorId:actorId||u?.id||'',at:new Date().toISOString(),readBy:[],fingerprint});
  arr=arr.slice(0,250);srtSaveArray(SRT_NOTIFICATION_KEY,arr);srtRefreshCommunicationUI();
}
function srtLiveAlerts(){
  const out=[],u=srtCommUser();if(!u)return out;
  try{const p=(STATE?.pay||[]).filter(r=>String(r['Payment Status']||'').toLowerCase().includes('pending'));if(p.length)out.push({id:'live_pay',type:'payment',title:'Pending payments',message:`${p.length} payment record${p.length===1?' is':'s are'} pending.`,at:new Date().toISOString(),readBy:[u.id],live:true});}catch(e){}
  try{const rec=Array.isArray(GPSD?.records)?GPSD.records:[];const pending=rec.filter(r=>String(r.gpsReturn||'').toLowerCase()!=='yes');if(pending.length)out.push({id:'live_gps',type:'gps',title:'GPS returns pending',message:`${pending.length} GPS device${pending.length===1?'':'s'} currently marked as not returned.`,at:new Date().toISOString(),readBy:[u.id],live:true});}catch(e){}
  try{if(typeof ATT!=='undefined'&&ATT.staff?.length){const day=ATT.records?.[ATT.date]||{};const marked=Object.keys(day).length;const unmarked=Math.max(0,ATT.staff.length-marked);if(unmarked)out.push({id:'live_att',type:'attendance',title:'Attendance pending',message:`${unmarked} staff attendance entr${unmarked===1?'y':'ies'} not marked for selected date.`,at:new Date().toISOString(),readBy:[u.id],live:true});}}catch(e){}
  try{if(typeof srtLoadRegistrationRequests==='function'&&typeof srtIsAdmin==='function'&&srtIsAdmin()){const n=srtLoadRegistrationRequests().length;if(n)out.push({id:'live_reg',type:'account',title:'Registration requests',message:`${n} new user registration request${n===1?'':'s'} awaiting approval.`,at:new Date().toISOString(),readBy:[u.id],live:true});}}catch(e){}
  return out;
}
function srtNotificationDismissals(){const u=srtCommUser();return srtSafeParse('srt_notification_dismissals_v1').find(x=>x.userId===u?.id)||{ids:[],live:[]};}
function srtLiveAlertSignature(n){return JSON.stringify([n.id,n.title,n.message,n.id==='live_att'&&typeof ATT!=='undefined'?ATT.date:'']);}
function srtStoredNotifications(){const u=srtCommUser();if(!u)return[];const dismissed=srtNotificationDismissals();return srtSafeParse(SRT_NOTIFICATION_KEY).filter(n=>srtTargetVisible(n,u)&&!dismissed.ids.includes(n.id));}
function srtClearNotifications(){
  const u=srtCommUser();if(!u)return;
  const settings=srtSafeParse('srt_notification_dismissals_v1').filter(x=>x.userId!==u.id);
  settings.push({userId:u.id,ids:srtSafeParse(SRT_NOTIFICATION_KEY).filter(n=>srtTargetVisible(n,u)).map(n=>n.id),live:srtLiveAlerts().map(srtLiveAlertSignature)});
  try{localStorage.setItem('srt_notification_dismissals_v1',JSON.stringify(settings));}
  catch(e){toast('Unable to clear notifications. Browser storage is unavailable.','var(--red)');return;}
  if(SRT_SYNC_CHANNEL)SRT_SYNC_CHANNEL.postMessage({key:'srt_notification_dismissals_v1',at:Date.now()});
  srtRenderNotifications();srtUpdateTopBadges();
  toast('Notifications cleared.','var(--green)');
}
function srtUnreadNotifCount(){const u=srtCommUser();if(!u)return 0;return srtStoredNotifications().filter(n=>!(n.readBy||[]).includes(u.id)).length+srtUnreadChatCount();}
function srtSetNotificationFilter(f,btn){SRT_NOTIFICATION_FILTER=f;document.querySelectorAll('#srtNotifFilters button').forEach(b=>b.classList.toggle('active',b===btn));srtRenderNotifications();}
function srtRenderNotifications(){
  const list=document.getElementById('srtNotificationList'),u=srtCommUser();if(!list)return;if(!u){list.innerHTML='<div class="srt-notif-empty">Sign in to view notifications.</div>';return;}
  const dismissed=srtNotificationDismissals();const live=srtLiveAlerts().filter(n=>!dismissed.live.includes(srtLiveAlertSignature(n)));let stored=srtStoredNotifications();
  if(SRT_NOTIFICATION_FILTER!=='all'){stored=stored.filter(n=>srtNotifyGroup(n.type)===SRT_NOTIFICATION_FILTER);}
  const liveFiltered=SRT_NOTIFICATION_FILTER==='all'||SRT_NOTIFICATION_FILTER==='records'||SRT_NOTIFICATION_FILTER==='account'?live.filter(n=>SRT_NOTIFICATION_FILTER==='all'||srtNotifyGroup(n.type)===SRT_NOTIFICATION_FILTER):[];
  let parts=[];
  if(liveFiltered.length){parts.push('<div class="srt-notif-section-label">Current alerts</div>');parts.push(liveFiltered.map(n=>srtNotificationHTML(n,true)).join(''));}
  if(stored.length){parts.push('<div class="srt-notif-section-label">Recent activity</div>');parts.push(stored.slice(0,80).map(n=>srtNotificationHTML(n,false)).join(''));}
  if(!parts.length)parts.push('<div class="srt-notif-empty">No notifications in this category.</div>');list.innerHTML=parts.join('');
}
function srtNotificationHTML(n,live){const u=srtCommUser(),unread=!live&&!(n.readBy||[]).includes(u?.id);return `<div class="srt-notif-item ${unread?'unread':''}" onclick="srtReadNotification('${srtEsc(n.id)}')"><div class="srt-notif-icon">${srtNotifyIcon(n.type)}</div><div><div class="srt-notif-title">${srtEsc(n.title||srtTypeTitle(n.type))}</div><div class="srt-notif-msg">${srtEsc(n.message||'')}</div></div><div class="srt-notif-time">${live?'Live':srtTimeAgo(n.at)}</div></div>`;}
function srtReadNotification(id){const u=srtCommUser();if(!u)return;let arr=srtSafeParse(SRT_NOTIFICATION_KEY),n=arr.find(x=>x.id===id);if(n&&!n.readBy?.includes(u.id)){n.readBy=[...(n.readBy||[]),u.id];srtSaveArray(SRT_NOTIFICATION_KEY,arr);}srtRenderNotifications();srtUpdateTopBadges();}
function srtMarkAllNotificationsRead(){const u=srtCommUser();if(!u)return;let arr=srtSafeParse(SRT_NOTIFICATION_KEY),changed=false;arr.forEach(n=>{if(srtTargetVisible(n,u)&&!(n.readBy||[]).includes(u.id)){n.readBy=[...(n.readBy||[]),u.id];changed=true;}});if(changed)srtSaveArray(SRT_NOTIFICATION_KEY,arr);srtMarkAllChatsRead();srtRenderNotifications();srtUpdateTopBadges();}
function srtToggleNotifications(ev){if(ev)ev.stopPropagation();const p=document.getElementById('srtNotificationPanel');if(!p)return;p.classList.toggle('open');if(p.classList.contains('open')){srtRenderNotifications();document.getElementById('srtChatOverlay')?.classList.remove('open');}}
function srtCloseNotifications(){document.getElementById('srtNotificationPanel')?.classList.remove('open')}

// Chat storage and rendering
function srtChatMessages(){return srtSafeParse(SRT_CHAT_KEY)}
function srtSaveChatMessages(arr){srtSaveArray(SRT_CHAT_KEY,arr.slice(-1200));}
function srtChatVisible(m,u){if(!u)return false;if(m.to==='group')return true;return m.from===u.id||m.to===u.id;}
function srtChatConversationMessages(target){const u=srtCommUser();if(!u)return[];const all=srtChatMessages();if(target==='group')return all.filter(m=>m.to==='group');return all.filter(m=>(m.from===u.id&&m.to===target)||(m.from===target&&m.to===u.id));}
function srtUnreadForTarget(target){const u=srtCommUser();if(!u)return 0;return srtChatConversationMessages(target).filter(m=>m.from!==u.id&&!(m.readBy||[]).includes(u.id)).length;}
function srtUnreadChatCount(){const u=srtCommUser();if(!u)return 0;return srtChatMessages().filter(m=>srtChatVisible(m,u)&&m.from!==u.id&&!(m.readBy||[]).includes(u.id)).length;}
function srtAccountById(id){return srtCommAccounts().find(a=>a.id===id)||null}
function srtAvatarHTML(a){if(a?.photo)return `<img src="${srtEsc(a.photo)}" alt="">`;return srtEsc(srtInitialsLocal(srtUserLabel(a)));}
function srtRenderChatConversations(){
  const box=document.getElementById('srtChatConversations'),u=srtCommUser();if(!box)return;if(!u){box.innerHTML='';return;}
  const q=String(document.getElementById('srtChatSearch')?.value||'').trim().toLowerCase();
  const accounts=srtCommAccounts().filter(a=>a.id!==u.id&&(!q||`${srtUserLabel(a)} ${a.email||''}`.toLowerCase().includes(q)));
  const groupUnread=srtUnreadForTarget('group');
  const group=`<button type="button" class="srt-chat-convo ${SRT_CHAT_TARGET==='group'?'active':''}" onclick="srtSelectChat('group')"><span class="srt-chat-avatar">👥</span><span class="srt-chat-convo-info"><span class="srt-chat-convo-name">SRT Group Chat</span><span class="srt-chat-convo-sub">All active users</span></span>${groupUnread?`<span class="srt-chat-unread">${groupUnread>99?'99+':groupUnread}</span>`:''}</button>`;
  const users=accounts.map(a=>{const unread=srtUnreadForTarget(a.id);return `<button type="button" class="srt-chat-convo ${SRT_CHAT_TARGET===a.id?'active':''}" onclick="srtSelectChat('${srtEsc(a.id)}')"><span class="srt-chat-avatar">${srtAvatarHTML(a)}</span><span class="srt-chat-convo-info"><span class="srt-chat-convo-name">${srtEsc(srtUserLabel(a))}</span><span class="srt-chat-convo-sub">${srtEsc(a.role==='admin'?'Administrator':(a.personal?.designation||a.email||'User'))}</span></span>${unread?`<span class="srt-chat-unread">${unread>99?'99+':unread}</span>`:''}</button>`}).join('');
  box.innerHTML=group+users;
}
function srtSelectChat(target){SRT_CHAT_TARGET=target||'group';srtMarkConversationRead(SRT_CHAT_TARGET);srtRenderChatConversations();srtRenderChatMessages();srtUpdateTopBadges();}
function srtRenderChatMessages(){
  const box=document.getElementById('srtChatMessages'),u=srtCommUser(),title=document.getElementById('srtChatHeadTitle'),status=document.getElementById('srtChatHeadStatus'),avatar=document.getElementById('srtChatHeadAvatar');if(!box||!u)return;
  let targetAccount=SRT_CHAT_TARGET==='group'?null:srtAccountById(SRT_CHAT_TARGET);
  if(SRT_CHAT_TARGET!=='group'&&!targetAccount){SRT_CHAT_TARGET='group';}
  if(SRT_CHAT_TARGET==='group'){if(title)title.textContent='SRT Group Chat';if(status)status.textContent='All active SRT users';if(avatar)avatar.innerHTML='👥';}
  else{targetAccount=srtAccountById(SRT_CHAT_TARGET);if(title)title.textContent=srtUserLabel(targetAccount);if(status)status.textContent=targetAccount?.role==='admin'?'Administrator':(targetAccount?.personal?.designation||targetAccount?.email||'User');if(avatar)avatar.innerHTML=srtAvatarHTML(targetAccount);}
  const msgs=srtChatConversationMessages(SRT_CHAT_TARGET);if(!msgs.length){box.innerHTML=`<div class="srt-chat-empty">No messages yet.<br>Start ${SRT_CHAT_TARGET==='group'?'the group conversation':'a private conversation'}.</div>`;return;}
  const accounts=srtCommAccounts();box.innerHTML=msgs.map(m=>{const mine=m.from===u.id,sender=accounts.find(a=>a.id===m.from),name=sender?srtUserLabel(sender):(m.fromName||'User');return `<div class="srt-chat-msg ${mine?'mine':'theirs'}"><div class="srt-chat-bubble">${SRT_CHAT_TARGET==='group'?`<div class="srt-chat-sender">${srtEsc(name)}</div>`:''}<div class="srt-chat-text">${srtEsc(m.text)}</div><div class="srt-chat-time">${srtChatClock(m.at)}</div></div></div>`}).join('');requestAnimationFrame(()=>{box.scrollTop=box.scrollHeight});
}
function srtSendChatMessage(){const u=srtCommUser(),input=document.getElementById('srtChatInput');if(!u||!input)return;const text=input.value.trim();if(!text)return;let arr=srtChatMessages();const msg={id:'m_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),from:u.id,fromName:srtUserLabel(u),to:SRT_CHAT_TARGET||'group',text,at:new Date().toISOString(),readBy:[u.id]};arr.push(msg);srtSaveChatMessages(arr);input.value='';
  if(msg.to==='group')srtAddNotification('chat','New group message',`${srtUserLabel(u)}: ${text.slice(0,140)}`,'all_except_sender',u.id);else srtAddNotification('chat',`Message from ${srtUserLabel(u)}`,text.slice(0,160),msg.to,u.id);
  srtRenderChatMessages();srtRenderChatConversations();srtUpdateTopBadges();}
function srtChatKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();srtSendChatMessage();}}
function srtMarkConversationRead(target){const u=srtCommUser();if(!u)return;let arr=srtChatMessages(),changed=false;arr.forEach(m=>{const match=target==='group'?m.to==='group':((m.from===u.id&&m.to===target)||(m.from===target&&m.to===u.id));if(match&&m.from!==u.id&&!(m.readBy||[]).includes(u.id)){m.readBy=[...(m.readBy||[]),u.id];changed=true;}});if(changed)srtSaveChatMessages(arr);}
function srtMarkAllChatsRead(){const u=srtCommUser();if(!u)return;let arr=srtChatMessages(),changed=false;arr.forEach(m=>{if(srtChatVisible(m,u)&&m.from!==u.id&&!(m.readBy||[]).includes(u.id)){m.readBy=[...(m.readBy||[]),u.id];changed=true;}});if(changed)srtSaveChatMessages(arr);}
function srtOpenChat(){const u=srtCommUser();if(!u){if(typeof toast==='function')toast('Please sign in to use chat.','var(--yellow)');return;}srtCloseNotifications();const overlay=document.getElementById('srtChatOverlay');if(!overlay)return;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');srtMarkConversationRead(SRT_CHAT_TARGET);srtRenderChatConversations();srtRenderChatMessages();srtUpdateTopBadges();setTimeout(()=>document.getElementById('srtChatInput')?.focus(),80);}
function srtCloseChat(){const o=document.getElementById('srtChatOverlay');if(o){o.classList.remove('open');o.setAttribute('aria-hidden','true');}}
function srtUpdateTopBadges(){const u=srtCommUser(),nb=document.getElementById('srtNotifBadge'),cb=document.getElementById('srtChatBadge');if(!u){if(nb)nb.hidden=true;if(cb)cb.hidden=true;return;}const chat=srtUnreadChatCount(),notif=srtStoredNotifications().filter(n=>!(n.readBy||[]).includes(u.id)).length;if(nb){nb.textContent=notif>99?'99+':notif;nb.hidden=notif===0;}if(cb){cb.textContent=chat>99?'99+':chat;cb.hidden=chat===0;}}
function srtRefreshCommunicationUI(){srtUpdateTopBadges();if(document.getElementById('srtNotificationPanel')?.classList.contains('open'))srtRenderNotifications();if(document.getElementById('srtChatOverlay')?.classList.contains('open')){srtRenderChatConversations();srtRenderChatMessages();}}

// Capture meaningful app activity so record/account updates also appear in Notifications.
(function(){
  const original=window.toast;if(typeof original!=='function')return;
  window.toast=function(message,color){const result=original.apply(this,arguments);try{const text=String(message||'');const low=text.toLowerCase();const meaningful=/(saved|added|created|updated|deleted|removed|accepted|rejected|approved|exported|uploaded|marked|changed|returned|issued|submitted)/i.test(text);const ignore=/(administrator access required|do not have access|please fill|enter a valid|no .* to export)/i.test(text);if(SRT_NOTIFY_CAPTURE&&meaningful&&!ignore){const type=srtClassifyMessage(text);srtAddNotification(type,srtTypeTitle(type),text,'all',srtCommUser()?.id||'');}}catch(e){}return result;};
})();

// Refresh when app user/session changes.
(function(){
  const prev=window.srtApplyUserUI;if(typeof prev==='function'){window.srtApplyUserUI=function(){const r=prev.apply(this,arguments);setTimeout(srtRefreshCommunicationUI,0);return r;};}
  const oldLogout=window.doLogout;if(typeof oldLogout==='function'){window.doLogout=function(){srtCloseNotifications();srtCloseChat();const r=oldLogout.apply(this,arguments);setTimeout(srtRefreshCommunicationUI,0);return r;};}
})();

document.addEventListener('click',e=>{const p=document.getElementById('srtNotificationPanel'),bell=document.getElementById('srtNotificationBell');if(p?.classList.contains('open')&&!p.contains(e.target)&&!bell?.contains(e.target))srtCloseNotifications();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){srtCloseNotifications();srtCloseChat();}});
window.addEventListener('storage',e=>{if([SRT_NOTIFICATION_KEY,SRT_CHAT_KEY,SRT_ACCOUNT_KEY,SRT_SESSION_KEY].includes(e.key))srtRefreshCommunicationUI();});
document.getElementById('srtChatOverlay')?.addEventListener('click',e=>{if(e.target.id==='srtChatOverlay')srtCloseChat();});
document.addEventListener('DOMContentLoaded',()=>{setTimeout(srtRefreshCommunicationUI,120);setInterval(srtUpdateTopBadges,5000);});
