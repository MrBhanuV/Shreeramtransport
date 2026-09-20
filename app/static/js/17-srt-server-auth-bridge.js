/*
 * 17-srt-server-auth-bridge.js -- bridges the legacy client-side auth UI to
 * the real FastAPI + JWT + MySQL backend, without editing the dozens of
 * pre-existing call-sites of SRT_CURRENT_USER / srtGetAccounts() scattered
 * across 05-srt-account-management-script.js and other modules.
 *
 * The server is always the source of truth for permissions: every real data
 * API call re-validates the JWT and section grants on every request (see
 * app/deps.py::require_section). This file mirrors the server's answer into
 * the exact same SRT_CURRENT_USER shape the legacy UI already expects, so
 * all existing rendering logic keeps working unchanged.
 *
 * STALE-ADMIN-CREDENTIAL SAFEGUARD -- ROOT CAUSE, NOT WORKED AROUND HERE
 * ------------------------------------------------------------------------
 * srtLoadAccounts() (05-srt-account-management-script.js) contains a
 * "stale admin credential" safeguard: whenever it finds a locally-cached
 * admin account whose `credentialRevision` doesn't match the hardcoded
 * SRT_ADMIN_CREDENTIAL_REVISION constant, it force-clears SRT_CURRENT_USER
 * if the signed-in session belonged to that account. That is a reasonable
 * safeguard for the original 100%-client-side build ("your browser has an
 * outdated cached admin password after an app update"), but it no longer
 * applies to a session the server just authenticated with bcrypt. THE FIX
 * for that is a one-line, root-cause patch applied at decompose time (see
 * scripts/decompose.py, section 3d): the wipe condition itself is gated
 * behind `!window.SRT_SESSION_IS_SERVER_BACKED`, so it is unconditionally
 * skipped for any session this file established. This file's only
 * responsibility regarding that flag is to keep it accurate (true while a
 * server session is active, false once it ends) -- see
 * `srtAdoptServerSession` / `srtEndSession` below. (An earlier version of
 * this file also ran a client-side polling "defensive net" to catch the
 * wipe after the fact; that is no longer necessary now that the root cause
 * is patched, and has been removed. The regression is instead covered by
 * scripts/e2e/test_stale_credential_regression.py.)
 *
 * We also mirror the server-confirmed identity into the legacy accounts
 * store (`srtMirrorAccountLocally`) purely so the many pre-existing
 * *synchronous* lookups via srtGetAccounts().find(...) keep resolving (e.g.
 * the admin's own profile page). For an admin session we deliberately give
 * the mirrored copy id:'admin' and a matching credentialRevision, matching
 * what srtLoadAccounts() would stamp onto it anyway (it unconditionally
 * re-asserts admin.id='admin' whenever it finds an admin-role account
 * whose email matches SRT_ADMIN_EMAIL) -- this simply avoids one pointless
 * round of local-mirror mutation, it is not a security boundary.
 */

/** The account object last confirmed by the server (login or /me). Kept so
 * a fresh copy is always available to rebuild the mirrored account from,
 * without re-fetching, e.g. after the legacy local-accounts array is
 * reloaded/rewritten by unrelated legacy code. */
let SRT_SERVER_ACCOUNT = null;

/**
 * Converts a `{user, permissions}` pair (the exact shape returned by both
 * POST /api/auth/login+GET /api/auth/me together, and by GET /api/auth/me
 * alone) into the account object shape the legacy UI code expects on
 * SRT_CURRENT_USER / srtGetAccounts() entries.
 */
function srtBuildAccountFromServerUser(user, permissions) {
  const isAdmin = user.role === "admin";
  return {
    id: isAdmin ? "admin" : user.id,
    credentialRevision: isAdmin
      ? typeof SRT_ADMIN_CREDENTIAL_REVISION !== "undefined"
        ? SRT_ADMIN_CREDENTIAL_REVISION
        : undefined
      : undefined,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    canManageAccess: !!user.can_manage_access,
    photo: user.photo_url || "",
    modules: Object.keys(permissions),
    sections: permissions,
    personal: {
      fullName: user.name,
      phone: user.phone || "",
      designation: user.designation || "",
      department: user.department || "",
      location: user.location || "",
      employeeId: user.employee_id || "",
      personalEmail: user.personal_email || "",
      aadhaar: user.aadhaar || "",
      currentAddress: user.current_address || "",
      permanentAddress: user.permanent_address || "",
      address: user.current_address || "",
    },
    createdAt: "Server",
  };
}

/** Mirrors the account into the legacy local accounts store. Failures here
 * are non-fatal: SRT_CURRENT_USER is already the authoritative session, and
 * every real API call is independently re-validated server-side regardless
 * of what this local mirror contains. */
function srtMirrorAccountLocally(account) {
  try {
    const accounts = srtGetAccounts().filter(
      (a) =>
        String(a.email || "").toLowerCase() !== account.email.toLowerCase(),
    );
    accounts.push(account);
    srtSaveAccounts(accounts);
  } catch (e) {
    console.warn(
      "srtMirrorAccountLocally: non-fatal, local mirror skipped:",
      e,
    );
  }
}

/** Establishes a session from a successful /api/auth/login + /api/auth/me
 * response pair: stores the JWT, builds + mirrors the account object, and
 * makes it the active session. */
function srtAdoptServerSession(meResponse, token) {
  const account = srtBuildAccountFromServerUser(
    meResponse.user,
    meResponse.permissions,
  );

  SrtApi.setToken(token);
  SRT_SERVER_ACCOUNT = account;
  SRT_CURRENT_USER = account;
  // Deliberately a `window` property (unlike SRT_CURRENT_USER, a
  // script-scoped `let` binding) so both the decompose-time patch in
  // 05-srt-account-management-script.js and any external test/diagnostic
  // code can reliably read "is this session server-backed" without
  // depending on this file's internal bindings.
  window.SRT_SESSION_IS_SERVER_BACKED = true;
  try {
    sessionStorage.setItem(SRT_SESSION_KEY, account.email);
  } catch (e) {
    /* private-browsing storage errors are non-fatal */
  }
  srtMirrorAccountLocally(account);
  if (typeof window.srtSyncEmptyServerTables === "function") {
    window.srtSyncEmptyServerTables();
  }
  return account;
}

/**
 * Validates the login form's current values without touching the DOM
 * beyond reading it, so it can be unit-tested independently of a full
 * login submission. Returns `{ email, password, emailError, passwordError }`
 * -- both *Error fields are empty strings when that field is valid.
 */
function srtValidateLoginForm(rawEmail, rawPassword) {
  const email = String(rawEmail || "")
    .trim()
    .toLowerCase();
  const password = String(rawPassword || "");
  let emailError = "";
  if (!email) {
    emailError = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailError = "Enter a valid email address.";
  }
  const passwordError = password ? "" : "Enter your password.";
  return { email, password, emailError, passwordError };
}

/**
 * Performs the actual login round-trip against the server: authenticate,
 * then fetch the confirmed profile+permissions, then adopt the session.
 * Throws on any failure (invalid credentials, disabled account, network
 * error) -- the caller decides how to present that to the user.
 */
async function srtAuthenticateAndAdoptSession(email, password) {
  const { access_token: accessToken } = await SrtApi.login(email, password);
  SrtApi.setToken(accessToken);
  const me = await SrtApi.me();
  return srtAdoptServerSession(me, accessToken);
}

function srtRememberLoginEmail(email) {
  try {
    if (document.getElementById("srt-login-remember").checked) {
      localStorage.setItem(SRT_REMEMBER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SRT_REMEMBER_EMAIL_KEY);
    }
  } catch (e) {
    /* noop */
  }
}

/** Deliberately tears down the session (used by both a failed silent
 * restore on page load and by logout). */
function srtEndSession() {
  SRT_SERVER_ACCOUNT = null;
  SRT_CURRENT_USER = null;
  window.SRT_SESSION_IS_SERVER_BACKED = false;
  SrtApi.setToken("");
  try {
    sessionStorage.removeItem(SRT_SESSION_KEY);
  } catch (e) {
    /* noop */
  }
}

/** Orchestrates a login-button click: reads + validates the form, shows
 * inline field errors if invalid, otherwise authenticates against the
 * server and transitions to the dashboard on success. */
async function srtSubmitLogin() {
  const loginPage = document.getElementById("pg-login");
  const emailInput = document.getElementById("lu");
  const passwordInput = document.getElementById("lp");
  const isFormUsable =
    loginPage.classList.contains("active") &&
    !document.getElementById("lbtn").disabled &&
    !document
      .getElementById("srtRegistrationOverlay")
      ?.classList.contains("open");
  if (!isFormUsable) return;

  srtLoginClearFeedback();
  const { email, password, emailError, passwordError } = srtValidateLoginForm(
    emailInput.value,
    passwordInput.value,
  );
  emailInput.value = email;
  srtLoginFieldError("lu", emailError);
  srtLoginFieldError("lp", passwordError);
  if (emailError || passwordError) {
    (emailError ? emailInput : passwordInput).focus();
    return;
  }

  srtLoginSetBusy(true);
  document.getElementById("srt-login-status").textContent =
    "Signing in. Please wait.";
  try {
    await srtAuthenticateAndAdoptSession(email, password);
    showDashboardPage();
    srtRememberLoginEmail(email);
    passwordInput.value = "";
    if (passwordInput.type !== "password") togglePw();
    document.getElementById("srt-login-status").textContent = "Signed in.";
  } catch (err) {
    srtEndSession();
    srtLoginShowError(
      err && err.status === 401
        ? "We couldn\u2019t sign you in. Check your email and password, or contact your administrator if your access is pending."
        : "The server could not be reached. Please try again.",
    );
    passwordInput.focus();
  } finally {
    srtLoginSetBusy(false);
  }
}

window.doLogout = function () {
  if (confirm("Log out?")) {
    srtEndSession();
    const passwordInput = document.getElementById("lp");
    const emailInput = document.getElementById("lu");
    if (passwordInput) passwordInput.value = "";
    if (emailInput) emailInput.value = "";
    showHomePage();
  }
};

// The legacy account form used to save new users only in localStorage. Keep
// its existing fields and permission editor, but persist new accounts in the
// server database so the login endpoint can authenticate them.
window.saveUserAccount = async function () {
  if (!srtIsAdmin()) {
    toast("Administrator access required.", "var(--red)");
    return;
  }
  const value = (id) => document.getElementById(id)?.value.trim() || "";
  const name = value("uaName");
  const email = value("uaEmail").toLowerCase();
  const password = document.getElementById("uaPassword")?.value || "";
  const status = value("uaStatus") || "Active";
  const personalEmail = value("uaPersonalEmail").toLowerCase();
  const phone = value("uaPhone");
  const aadhaar = value("uaAadhaar").replace(/\D/g, "");
  if (!name || !email || !password || !personalEmail || !phone || !aadhaar) {
    toast(
      "Name, login email, password, personal email, phone and Aadhaar are required.",
      "var(--red)",
    );
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^\S+@\S+\.\S+$/.test(personalEmail)) {
    toast("Enter valid login and personal email addresses.", "var(--red)");
    return;
  }
  if (!/^\d{10}$/.test(phone) || !/^\d{12}$/.test(aadhaar)) {
    toast(
      "Phone must contain 10 digits and Aadhaar must contain 12 digits.",
      "var(--red)",
    );
    return;
  }
  if (
    password.length < 8 ||
    password.length > 15 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9\s]/.test(password) ||
    /\s/.test(password)
  ) {
    toast(
      "Password must be 8-15 characters with uppercase, lowercase, number and special character.",
      "var(--red)",
    );
    return;
  }
  const perms = srtCollectPermissions("uaModuleGrid", "uaSectionGrid");
  if (!srtValidatePermissions(perms)) return;
  const payload = {
    name,
    email,
    password,
    role: "staff",
    status,
    phone,
    personal_email: personalEmail,
    designation: value("uaDesignation"),
    department: value("uaDepartment"),
    employee_id: value("uaEmployeeId"),
    location: value("uaLocation"),
    aadhaar,
    current_address: value("uaCurrentAddress"),
    permanent_address: value("uaPermanentAddress"),
    can_manage_access: !!document.getElementById("uaCanManageAccess")?.checked,
    modules: perms.sections,
  };
  try {
    const created = await SrtApi.post("/api/users", payload);
    srtMirrorAccountLocally(
      srtBuildAccountFromServerUser(created, perms.sections),
    );
    closeUserAccountModal();
    renderProfilePage();
    toast("User account created. They can now sign in.", "var(--green)");
  } catch (err) {
    toast(err.message || "Could not create the user account.", "var(--red)");
  }
};

/** On page load, if a JWT is still stored, silently restore the session by
 * re-validating it against the server (never trust the stored token's
 * *contents* -- only trust what /api/auth/me confirms right now). */
async function srtRestoreSessionOnLoad() {
  const token = SrtApi.getToken();
  if (!token) return;
  try {
    const me = await SrtApi.me();
    srtAdoptServerSession(me, token);
  } catch (e) {
    srtEndSession();
  }
}

document.addEventListener("DOMContentLoaded", srtRestoreSessionOnLoad);
