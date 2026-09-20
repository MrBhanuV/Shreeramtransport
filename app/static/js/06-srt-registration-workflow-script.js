
let SRT_APPROVE_REQUEST_ID=null;
function srtLoadRegistrationRequests(){let arr=[];try{arr=JSON.parse(localStorage.getItem(SRT_REG_REQUEST_KEY)||'[]')}catch(e){arr=[]}return Array.isArray(arr)?arr:[]}
function srtSaveRegistrationRequests(arr){try{localStorage.setItem(SRT_REG_REQUEST_KEY,JSON.stringify(arr))}catch(e){}}
function srtPasswordValid(password){return password.length>=8&&password.length<=15&&/[A-Z]/.test(password)&&/[a-z]/.test(password)&&/[0-9]/.test(password)&&/[^A-Za-z0-9\s]/.test(password)&&!(/\s/.test(password));}

function openRegistrationModal(){
  ['rgName','rgLoginEmail','rgPersonalEmail','rgPhone','rgAadhaar','rgDesignation','rgDepartment','rgEmployeeId','rgLocation','rgPassword','rgConfirmPassword','rgCurrentAddress','rgPermanentAddress'].forEach(id=>{const el=document.getElementById(id);if(el){el.value='';el.classList.remove('srt-field-error')}});
  document.getElementById('srtRegistrationOverlay')?.classList.add('open');
  if(typeof scheduleAdaptiveLightThemeText==='function')scheduleAdaptiveLightThemeText();
}
function closeRegistrationModal(){document.getElementById('srtRegistrationOverlay')?.classList.remove('open')}
function submitRegistrationRequest(){
  const ids=['rgName','rgLoginEmail','rgPersonalEmail','rgPhone','rgAadhaar','rgDesignation','rgDepartment','rgEmployeeId','rgLocation','rgPassword','rgConfirmPassword','rgCurrentAddress','rgPermanentAddress'];
  ids.forEach(id=>document.getElementById(id)?.classList.remove('srt-field-error'));
  const v=Object.fromEntries(ids.map(id=>[id,(document.getElementById(id)?.value||'').trim()]));
  const empty=ids.find(id=>!v[id]);if(empty){document.getElementById(empty)?.classList.add('srt-field-error');document.getElementById(empty)?.focus();toast('All registration fields are required.','var(--red)');return;}
  v.rgLoginEmail=v.rgLoginEmail.toLowerCase();v.rgPersonalEmail=v.rgPersonalEmail.toLowerCase();v.rgAadhaar=v.rgAadhaar.replace(/\D/g,'');
  if(!/^\S+@\S+\.\S+$/.test(v.rgLoginEmail)){document.getElementById('rgLoginEmail')?.classList.add('srt-field-error');toast('Enter a valid login email.','var(--red)');return;}
  if(!/^\S+@\S+\.\S+$/.test(v.rgPersonalEmail)){document.getElementById('rgPersonalEmail')?.classList.add('srt-field-error');toast('Enter a valid personal email ID.','var(--red)');return;}
  if(!/^\d{12}$/.test(v.rgAadhaar)){document.getElementById('rgAadhaar')?.classList.add('srt-field-error');toast('Aadhaar number must contain exactly 12 digits.','var(--red)');return;}
  if(!/^\d{10}$/.test(v.rgPhone)){document.getElementById('rgPhone')?.classList.add('srt-field-error');document.getElementById('rgPhone')?.focus();toast('Phone number must contain exactly 10 numeric digits.','var(--red)');return;}
  if(!srtPasswordValid(v.rgPassword)){document.getElementById('rgPassword')?.classList.add('srt-field-error');toast('Password must be 8–15 characters with uppercase, lowercase, number and special character.','var(--red)');return;}
  if(v.rgPassword!==v.rgConfirmPassword){document.getElementById('rgConfirmPassword')?.classList.add('srt-field-error');toast('Confirm password does not match.','var(--red)');return;}
  if(srtGetAccounts().some(a=>String(a.email||'').toLowerCase()===v.rgLoginEmail)){toast('An account already exists for this login email.','var(--red)');return;}
  let req=srtLoadRegistrationRequests();if(req.some(r=>String(r.loginEmail||'').toLowerCase()===v.rgLoginEmail)){toast('A registration request for this login email is already pending.','var(--yellow)');return;}
  req.push({id:'req_'+Date.now().toString(36),name:v.rgName,loginEmail:v.rgLoginEmail,personalEmail:v.rgPersonalEmail,phone:v.rgPhone,aadhaar:v.rgAadhaar,designation:v.rgDesignation,department:v.rgDepartment,employeeId:v.rgEmployeeId,location:v.rgLocation,password:v.rgPassword,currentAddress:v.rgCurrentAddress,permanentAddress:v.rgPermanentAddress,submittedAt:new Date().toISOString()});
  srtSaveRegistrationRequests(req);closeRegistrationModal();toast('Registration request submitted. Wait for Administrator approval.','var(--green)');
}
function srtFormatDateTime(v){try{return new Date(v).toLocaleString()}catch(e){return String(v||'—')}}
function srtMaskAadhaar(v){const x=String(v||'');return x.length===12?'XXXX XXXX '+x.slice(-4):x}
function renderRegistrationRequests(){
  if(!srtIsAdmin())return;const body=document.getElementById('registrationRequestBody'),label=document.getElementById('registrationRequestCount');if(!body)return;
  const req=srtLoadRegistrationRequests();if(label)label.textContent=`${req.length} pending request${req.length===1?'':'s'}`;
  body.innerHTML=req.length?req.map(r=>`<tr><td><div class="srt-request-name">${srtEscape(r.name)}</div><div class="srt-request-meta">Login: ${srtEscape(r.loginEmail)}<br>Personal: ${srtEscape(r.personalEmail)}<br><span class="srt-request-aadhaar">Aadhaar: ${srtEscape(srtMaskAadhaar(r.aadhaar))}</span></div></td><td>${srtEscape(r.phone)}<div class="srt-request-meta">${srtEscape(r.location)}</div></td><td>${srtEscape(r.designation)}<div class="srt-request-meta">${srtEscape(r.department)}<br>EMP ID: ${srtEscape(r.employeeId||'—')}</div></td><td><strong>Current:</strong> ${srtEscape(r.currentAddress)}<div class="srt-request-meta"><strong>Permanent:</strong> ${srtEscape(r.permanentAddress)}</div></td><td>${srtEscape(srtFormatDateTime(r.submittedAt))}</td><td><div class="srt-request-actions"><button class="srt-request-accept" onclick="openRegistrationApprovalModal('${srtEscape(r.id)}')">✓ Accept</button><button class="srt-request-reject" onclick="rejectRegistrationRequest('${srtEscape(r.id)}')">✕ Reject</button></div></td></tr>`).join(''):'<tr><td colspan="6" class="srt-no-access">No pending registration requests.</td></tr>';
  if(typeof scheduleAdaptiveLightThemeText==='function')scheduleAdaptiveLightThemeText();
}
function openRegistrationApprovalModal(id){
  if(!srtIsAdmin()){toast('Administrator access required.','var(--red)');return;}const r=srtLoadRegistrationRequests().find(x=>x.id===id);if(!r)return;SRT_APPROVE_REQUEST_ID=id;
  const summary=document.getElementById('registrationApprovalSummary');if(summary)summary.innerHTML=`<strong>${srtEscape(r.name)}</strong> · ${srtEscape(r.loginEmail)}<br>${srtEscape(r.designation)} · ${srtEscape(r.department)} · ${srtEscape(r.location)}<br>EMP ID: ${srtEscape(r.employeeId||'—')}<br>Personal email: ${srtEscape(r.personalEmail)} · Aadhaar: ${srtEscape(srtMaskAadhaar(r.aadhaar))}`;
  srtRenderPermissionEditor('raModuleGrid','raSectionGrid',{modules:[],sections:{}});document.getElementById('srtRegistrationApprovalOverlay')?.classList.add('open');if(typeof scheduleAdaptiveLightThemeText==='function')scheduleAdaptiveLightThemeText();
}
function closeRegistrationApprovalModal(){document.getElementById('srtRegistrationApprovalOverlay')?.classList.remove('open');SRT_APPROVE_REQUEST_ID=null}
function approveRegistrationRequest(){
  if(!srtIsAdmin()){toast('Administrator access required.','var(--red)');return;}let requests=srtLoadRegistrationRequests();const r=requests.find(x=>x.id===SRT_APPROVE_REQUEST_ID);if(!r)return;const perms=srtCollectPermissions('raModuleGrid','raSectionGrid');if(!srtValidatePermissions(perms))return;
  let accounts=srtGetAccounts();if(accounts.some(a=>String(a.email||'').toLowerCase()===r.loginEmail.toLowerCase())){toast('An account with this login email already exists.','var(--red)');return;}
  accounts.push({id:'usr_'+Date.now().toString(36),name:r.name,email:r.loginEmail,password:r.password,role:'user',status:'Active',modules:perms.modules,sections:perms.sections,canManageAccess:false,photo:'',personal:{fullName:r.name,phone:r.phone,designation:r.designation,department:r.department,location:r.location,employeeId:r.employeeId||'',personalEmail:r.personalEmail,aadhaar:r.aadhaar,currentAddress:r.currentAddress,permanentAddress:r.permanentAddress,address:r.currentAddress},createdAt:new Date().toISOString()});
  srtSaveAccounts(accounts);requests=requests.filter(x=>x.id!==r.id);srtSaveRegistrationRequests(requests);closeRegistrationApprovalModal();renderProfilePage();toast('Registration accepted and login account created.','var(--green)');
}
function rejectRegistrationRequest(id){
  if(!srtIsAdmin()){toast('Administrator access required.','var(--red)');return;}const r=srtLoadRegistrationRequests().find(x=>x.id===id);if(!r)return;if(!confirm(`Reject registration request from ${r.name}?`))return;srtSaveRegistrationRequests(srtLoadRegistrationRequests().filter(x=>x.id!==id));renderRegistrationRequests();toast('Registration request rejected.','var(--red)');
}
function renderDelegatedAccessList(){
  const body=document.getElementById('delegatedAccessBody');if(!body||srtIsAdmin()||!srtCanManageAccess())return;const me=srtGetCurrentUser();const accounts=srtGetAccounts().filter(a=>a.role!=='admin'&&a.id!==me?.id);
  body.innerHTML=accounts.length?accounts.map(a=>{const mods=SRT_MODULES.filter(m=>(a.modules||[]).includes(m.id));const txt=mods.length?mods.map(m=>m.label).join(', '):'No modules';return `<tr><td><div class="srt-account-name">${srtEscape(a.name||'User')}</div></td><td><div class="srt-access-summary">${srtEscape(txt)}</div></td><td><button class="srt-btn-access" onclick="openAccessManagerModal('${srtEscape(a.id)}')">Manage Access</button></td></tr>`}).join(''):'<tr><td colspan="3" class="srt-no-access">No other user accounts available.</td></tr>';
}

// Keep registration requests synchronized when Profile is opened or admin logs in.
const srtRegistrationPrevApplyUI=window.srtApplyUserUI||srtApplyUserUI;
window.srtApplyUserUI=function(){srtRegistrationPrevApplyUI();if(srtIsAdmin())renderRegistrationRequests();};

// Improve login error copy for user/admin accounts.
// The login form supplies contextual validation and account feedback.
document.addEventListener('DOMContentLoaded',()=>{if(srtIsAdmin())renderRegistrationRequests();});
