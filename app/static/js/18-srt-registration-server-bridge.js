/*
 * 18-srt-registration-server-bridge.js -- bridges the legacy registration
 * request / admin approval UI (06-srt-registration-workflow-script.js) to
 * the real FastAPI backend, the same way 17-srt-server-auth-bridge.js does
 * for login. Overrides (by redeclaring the same global names, since this
 * file loads last): submitRegistrationRequest, renderRegistrationRequests,
 * approveRegistrationRequest, rejectRegistrationRequest.
 *
 * openRegistrationApprovalModal() and the permission-editor UI
 * (srtRenderPermissionEditor/srtCollectPermissions/srtValidatePermissions,
 * all defined in file 05) are reused completely unchanged -- only where
 * the *data* comes from and where the final decision is *submitted to*
 * changes, exactly mirroring the design of the login bridge.
 */

// Keeps the currently-open approval request's server data (the legacy
// SRT_APPROVE_REQUEST_ID only stored an id; we also need the fetched
// request object on hand for approveRegistrationRequest()).
let SRT_APPROVE_REQUEST_SERVER_DATA = null;

async function submitRegistrationRequest() {
  const ids = [
    'rgName', 'rgLoginEmail', 'rgPersonalEmail', 'rgPhone', 'rgAadhaar',
    'rgDesignation', 'rgDepartment', 'rgEmployeeId', 'rgLocation',
    'rgPassword', 'rgConfirmPassword', 'rgCurrentAddress', 'rgPermanentAddress',
  ];
  ids.forEach((id) => document.getElementById(id)?.classList.remove('srt-field-error'));
  const v = Object.fromEntries(ids.map((id) => [id, (document.getElementById(id)?.value || '').trim()]));

  const empty = ids.find((id) => !v[id]);
  if (empty) {
    document.getElementById(empty)?.classList.add('srt-field-error');
    document.getElementById(empty)?.focus();
    toast('All registration fields are required.', 'var(--red)');
    return;
  }
  v.rgLoginEmail = v.rgLoginEmail.toLowerCase();
  v.rgPersonalEmail = v.rgPersonalEmail.toLowerCase();
  v.rgAadhaar = v.rgAadhaar.replace(/\D/g, '');

  if (!/^\S+@\S+\.\S+$/.test(v.rgLoginEmail)) {
    document.getElementById('rgLoginEmail')?.classList.add('srt-field-error');
    toast('Enter a valid login email.', 'var(--red)');
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(v.rgPersonalEmail)) {
    document.getElementById('rgPersonalEmail')?.classList.add('srt-field-error');
    toast('Enter a valid personal email ID.', 'var(--red)');
    return;
  }
  if (!/^\d{12}$/.test(v.rgAadhaar)) {
    document.getElementById('rgAadhaar')?.classList.add('srt-field-error');
    toast('Aadhaar number must contain exactly 12 digits.', 'var(--red)');
    return;
  }
  if (!/^\d{10}$/.test(v.rgPhone)) {
    document.getElementById('rgPhone')?.classList.add('srt-field-error');
    document.getElementById('rgPhone')?.focus();
    toast('Phone number must contain exactly 10 numeric digits.', 'var(--red)');
    return;
  }
  if (!srtPasswordValid(v.rgPassword)) {
    document.getElementById('rgPassword')?.classList.add('srt-field-error');
    toast('Password must be 8\u201315 characters with uppercase, lowercase, number and special character.', 'var(--red)');
    return;
  }
  if (v.rgPassword !== v.rgConfirmPassword) {
    document.getElementById('rgConfirmPassword')?.classList.add('srt-field-error');
    toast('Confirm password does not match.', 'var(--red)');
    return;
  }

  try {
    await SrtApi.post('/api/auth/register-request', {
      name: v.rgName,
      login_email: v.rgLoginEmail,
      personal_email: v.rgPersonalEmail,
      phone: v.rgPhone,
      aadhaar: v.rgAadhaar,
      designation: v.rgDesignation,
      department: v.rgDepartment,
      employee_id: v.rgEmployeeId,
      location: v.rgLocation,
      password: v.rgPassword,
      current_address: v.rgCurrentAddress,
      permanent_address: v.rgPermanentAddress,
    });
    closeRegistrationModal();
    toast('Registration request submitted. Wait for Administrator approval.', 'var(--green)');
  } catch (err) {
    toast(err.message || 'Could not submit the registration request.', 'var(--red)');
  }
}

async function renderRegistrationRequests() {
  if (!srtIsAdmin()) return;
  const body = document.getElementById('registrationRequestBody');
  const label = document.getElementById('registrationRequestCount');
  if (!body) return;

  let requests;
  try {
    requests = await SrtApi.get('/api/auth/registration-requests?status_filter=Pending');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="srt-no-access">Could not load registration requests: ${srtEscape(err.message)}</td></tr>`;
    return;
  }

  if (label) label.textContent = `${requests.length} pending request${requests.length === 1 ? '' : 's'}`;
  body.innerHTML = requests.length
    ? requests.map((r) => `<tr><td><div class="srt-request-name">${srtEscape(r.name)}</div><div class="srt-request-meta">Login: ${srtEscape(r.login_email)}<br>Personal: ${srtEscape(r.personal_email)}<br><span class="srt-request-aadhaar">Aadhaar: ${srtEscape(srtMaskAadhaar(r.aadhaar))}</span></div></td><td>${srtEscape(r.phone)}<div class="srt-request-meta">${srtEscape(r.location)}</div></td><td>${srtEscape(r.designation)}<div class="srt-request-meta">${srtEscape(r.department)}<br>EMP ID: ${srtEscape(r.employee_id || '\u2014')}</div></td><td><strong>Current:</strong> ${srtEscape(r.current_address)}<div class="srt-request-meta"><strong>Permanent:</strong> ${srtEscape(r.permanent_address)}</div></td><td>${srtEscape(srtFormatDateTime(r.created_at))}</td><td><div class="srt-request-actions"><button class="srt-request-accept" onclick="openRegistrationApprovalModal(${r.id})">\u2713 Accept</button><button class="srt-request-reject" onclick="rejectRegistrationRequest(${r.id})">\u2715 Reject</button></div></td></tr>`).join('')
    : '<tr><td colspan="6" class="srt-no-access">No pending registration requests.</td></tr>';
  if (typeof scheduleAdaptiveLightThemeText === 'function') scheduleAdaptiveLightThemeText();

  // Cache the fetched list so openRegistrationApprovalModal(id) below can
  // find the right request without a second round-trip.
  window.__srtPendingRegistrationRequests = requests;
}

function openRegistrationApprovalModal(id) {
  if (!srtIsAdmin()) {
    toast('Administrator access required.', 'var(--red)');
    return;
  }
  const r = (window.__srtPendingRegistrationRequests || []).find((x) => x.id === id);
  if (!r) {
    toast('This request is no longer available. Refreshing the list.', 'var(--yellow)');
    renderRegistrationRequests();
    return;
  }
  SRT_APPROVE_REQUEST_ID = id;
  SRT_APPROVE_REQUEST_SERVER_DATA = r;
  const summary = document.getElementById('registrationApprovalSummary');
  if (summary) {
    summary.innerHTML = `<strong>${srtEscape(r.name)}</strong> \u00b7 ${srtEscape(r.login_email)}<br>${srtEscape(r.designation)} \u00b7 ${srtEscape(r.department)} \u00b7 ${srtEscape(r.location)}<br>EMP ID: ${srtEscape(r.employee_id || '\u2014')}<br>Personal email: ${srtEscape(r.personal_email)} \u00b7 Aadhaar: ${srtEscape(srtMaskAadhaar(r.aadhaar))}`;
  }
  srtRenderPermissionEditor('raModuleGrid', 'raSectionGrid', { modules: [], sections: {} });
  document.getElementById('srtRegistrationApprovalOverlay')?.classList.add('open');
  if (typeof scheduleAdaptiveLightThemeText === 'function') scheduleAdaptiveLightThemeText();
}

async function approveRegistrationRequest() {
  if (!srtIsAdmin()) {
    toast('Administrator access required.', 'var(--red)');
    return;
  }
  if (!SRT_APPROVE_REQUEST_ID) return;
  const perms = srtCollectPermissions('raModuleGrid', 'raSectionGrid');
  if (!srtValidatePermissions(perms)) return;

  try {
    await SrtApi.post(`/api/auth/registration-requests/${SRT_APPROVE_REQUEST_ID}/approve`, {
      modules: perms.sections,
    });
    closeRegistrationApprovalModal();
    renderProfilePage();
    toast('Registration accepted and login account created.', 'var(--green)');
  } catch (err) {
    toast(err.message || 'Could not approve this registration request.', 'var(--red)');
  }
}

async function rejectRegistrationRequest(id) {
  if (!srtIsAdmin()) {
    toast('Administrator access required.', 'var(--red)');
    return;
  }
  const r = (window.__srtPendingRegistrationRequests || []).find((x) => x.id === id);
  if (!confirm(`Reject registration request from ${r ? r.name : 'this applicant'}?`)) return;
  try {
    await SrtApi.post(`/api/auth/registration-requests/${id}/reject`);
    renderRegistrationRequests();
    toast('Registration request rejected.', 'var(--red)');
  } catch (err) {
    toast(err.message || 'Could not reject this registration request.', 'var(--red)');
  }
}
