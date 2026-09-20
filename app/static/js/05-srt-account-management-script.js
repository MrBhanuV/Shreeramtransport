// ══════════════════════════════════════════════════════════════
// SRT LOCAL ACCOUNT / MODULE ACCESS MANAGEMENT
// Note: this standalone HTML stores accounts in browser localStorage.
// For production-grade security, authentication/authorization must be server-side.
// ══════════════════════════════════════════════════════════════
const SRT_ACCOUNT_KEY = "srt_login_accounts_v1";
const SRT_SESSION_KEY = "srt_current_account_v1";
const SRT_REG_REQUEST_KEY = "srt_registration_requests_v1";
const SRT_ADMIN_EMAIL = "srt.jspl@gmail.com";
const SRT_ADMIN_CREDENTIAL_REVISION = "2026-09-13-admin-1";
const SRT_MODULES = [
  { id: "inv", label: "Daily Entry", icon: "📋" },
  { id: "pay", label: "Payment", icon: "💳" },
  { id: "cp", label: "Company Payment", icon: "🏦" },
  { id: "rp", label: "Received Payment", icon: "💰" },
  { id: "gps", label: "GPS", icon: "🛰️" },
  { id: "att", label: "Attendance", icon: "📅" },
  { id: "exp", label: "Expense", icon: "💸" },
  { id: "fr", label: "Rate & Owner", icon: "🚛" },
];
const SRT_MODULE_SECTIONS = {
  inv: [
    { id: "view", label: "View Records" },
    { id: "manage", label: "Add / Edit / Delete" },
    { id: "transfer", label: "Export / Import" },
  ],
  pay: [
    { id: "view", label: "View Records" },
    { id: "manage", label: "Add / Edit / Delete" },
    { id: "transfer", label: "Export / Import" },
  ],
  cp: [
    { id: "view", label: "View Records" },
    { id: "manage", label: "Add / Edit / Delete" },
    { id: "transfer", label: "Export / Import" },
  ],
  rp: [
    { id: "view", label: "View Records" },
    { id: "manage", label: "Add / Edit / Delete" },
    { id: "transfer", label: "Export / Import" },
  ],
  gps: [
    { id: "view", label: "View GPS Records" },
    { id: "manage", label: "Add / Edit / Delete" },
    { id: "transfer", label: "Export / Import" },
  ],
  att: [
    { id: "attendance", label: "Mark Attendance" },
    { id: "staff", label: "Staff Directory" },
    { id: "calendar", label: "Calendar History" },
    { id: "salary", label: "Monthly Attendance & Salary" },
  ],
  exp: [
    { id: "view", label: "View Expenses" },
    { id: "manage", label: "Add / Edit / Delete" },
    { id: "transfer", label: "Export / Import" },
  ],
  fr: [
    { id: "view", label: "View Freight Rates" },
    { id: "manage", label: "Add / Edit / Delete" },
    { id: "transfer", label: "Export / Import" },
  ],
};
const SRT_ALL_MODULE_IDS = SRT_MODULES.map((m) => m.id);
let SRT_CURRENT_USER = null;
let SRT_EDIT_ACCOUNT_ID = null;
let SRT_ACCESS_EDIT_ACCOUNT_ID = null;

function srtSeedAdmin() {
  return {
    id: "admin",
    name: "SRT Admin",
    email: SRT_ADMIN_EMAIL,
    password: "Srt@jspl2026",
    credentialRevision: SRT_ADMIN_CREDENTIAL_REVISION,
    role: "admin",
    status: "Active",
    modules: [...SRT_ALL_MODULE_IDS],
    sections: Object.fromEntries(
      SRT_MODULES.map((m) => [
        m.id,
        (SRT_MODULE_SECTIONS[m.id] || []).map((x) => x.id),
      ]),
    ),
    canManageAccess: true,
    photo: "",
    personal: {
      fullName: "",
      phone: "",
      designation: "Administrator",
      department: "Administration",
      location: "",
      employeeId: "",
      personalEmail: "",
      aadhaar: "",
      currentAddress: "",
      permanentAddress: "",
      address: "",
    },
    createdAt: "System",
  };
}
function srtLoadAccounts() {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(SRT_ACCOUNT_KEY) || "[]");
  } catch (e) {
    arr = [];
  }
  if (!Array.isArray(arr)) arr = [];
  const adminEmails = [SRT_ADMIN_EMAIL, "admin@shreeramtransport.in"];
  let admin =
    arr.find((a) => a.id === "admin") ||
    arr.find(
      (a) =>
        a.role === "admin" &&
        adminEmails.includes(String(a.email || "").toLowerCase()),
    );
  if (!admin) {
    admin = srtSeedAdmin();
    arr.unshift(admin);
  } else {
    // Apply this credential update once to the saved primary admin account.
    // Preserve its profile and allow later intentional credential changes.
    if (admin.credentialRevision !== SRT_ADMIN_CREDENTIAL_REVISION) {
      const previousEmail = String(admin.email || "").toLowerCase();
      admin.email = SRT_ADMIN_EMAIL;
      admin.password = srtSeedAdmin().password;
      admin.credentialRevision = SRT_ADMIN_CREDENTIAL_REVISION;
      const previousAdminEmails = [previousEmail, ...adminEmails].filter(
        Boolean,
      );
      try {
        const sessionEmail = String(
          localStorage.getItem(SRT_SESSION_KEY) || "",
        ).toLowerCase();
        if (previousAdminEmails.includes(sessionEmail))
          localStorage.removeItem(SRT_SESSION_KEY);
        const remembered = String(
          localStorage.getItem("srt_remembered_email_v1") || "",
        ).toLowerCase();
        if (previousAdminEmails.includes(remembered))
          localStorage.setItem("srt_remembered_email_v1", SRT_ADMIN_EMAIL);
      } catch (e) {}
      if (
        !window.SRT_SESSION_IS_SERVER_BACKED &&
        SRT_CURRENT_USER &&
        (SRT_CURRENT_USER.id === admin.id ||
          previousAdminEmails.includes(
            String(SRT_CURRENT_USER.email || "").toLowerCase(),
          ))
      )
        SRT_CURRENT_USER = null;
    }
    admin.id = "admin";
    admin.role = "admin";
    admin.name = admin.name || "SRT Admin";
    admin.status = "Active";
    admin.modules = [...SRT_ALL_MODULE_IDS];
    admin.personal = Object.assign(
      srtSeedAdmin().personal,
      admin.personal || {},
    );
    admin.photo = admin.photo || "";
    admin.password = admin.password || srtSeedAdmin().password;
    admin.canManageAccess = true;
    admin.sections = Object.fromEntries(
      SRT_MODULES.map((m) => [
        m.id,
        (SRT_MODULE_SECTIONS[m.id] || []).map((x) => x.id),
      ]),
    );
  }
  // Consolidate only copies of the primary administrator, never unrelated admins.
  const primaryEmails = new Set([
    ...adminEmails,
    String(admin.email || "")
      .trim()
      .toLowerCase(),
  ]);
  const duplicates = arr.filter(
    (a) =>
      a !== admin &&
      (a.id === "admin" ||
        (a.role === "admin" &&
          primaryEmails.has(
            String(a.email || "")
              .trim()
              .toLowerCase(),
          ))),
  );
  if (duplicates.length) {
    // Keep a recoverable copy before removing duplicate login identities.
    let archived = false;
    try {
      const key = "srt_primary_admin_duplicates_v1";
      const prior = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(
        key,
        JSON.stringify((Array.isArray(prior) ? prior : []).concat(duplicates)),
      );
      archived = true;
    } catch (e) {}
    if (archived) {
      duplicates.forEach((old) => {
        Object.entries(old.personal || {}).forEach(([key, value]) => {
          if (!admin.personal[key] && value) admin.personal[key] = value;
        });
        if (!admin.photo && old.photo) admin.photo = old.photo;
        const oldEmail = String(old.email || "")
          .trim()
          .toLowerCase();
        try {
          if (
            String(localStorage.getItem(SRT_SESSION_KEY) || "")
              .trim()
              .toLowerCase() === oldEmail
          )
            localStorage.setItem(SRT_SESSION_KEY, admin.email);
          if (
            String(localStorage.getItem("srt_remembered_email_v1") || "")
              .trim()
              .toLowerCase() === oldEmail
          )
            localStorage.setItem("srt_remembered_email_v1", admin.email);
        } catch (e) {}
        if (
          SRT_CURRENT_USER &&
          (SRT_CURRENT_USER.id === old.id ||
            String(SRT_CURRENT_USER.email || "")
              .trim()
              .toLowerCase() === oldEmail)
        )
          SRT_CURRENT_USER = admin;
      });
      arr = arr.filter((a) => !duplicates.includes(a));
    }
  }
  arr.forEach((a) => {
    if (a.role === "admin") return;
    a.canManageAccess = !!a.canManageAccess;
    if (!a.sections || typeof a.sections !== "object") a.sections = {};
    (a.modules || []).forEach((mid) => {
      if (!Array.isArray(a.sections[mid]))
        a.sections[mid] = (SRT_MODULE_SECTIONS[mid] || []).map((x) => x.id);
    });
  });
  srtSaveAccounts(arr);
  return arr;
}
function srtSaveAccounts(arr) {
  try {
    localStorage.setItem(SRT_ACCOUNT_KEY, JSON.stringify(arr));
  } catch (e) {}
}
function srtGetAccounts() {
  return srtLoadAccounts();
}
function srtGetCurrentUser() {
  if (SRT_CURRENT_USER) return SRT_CURRENT_USER;
  const accounts = srtGetAccounts();
  let email = "";
  try {
    email = sessionStorage.getItem(SRT_SESSION_KEY) || "";
  } catch (e) {}
  if (email)
    SRT_CURRENT_USER =
      accounts.find((a) => a.email.toLowerCase() === email.toLowerCase()) ||
      null;
  return SRT_CURRENT_USER;
}
function srtIsAdmin() {
  return srtGetCurrentUser()?.role === "admin";
}
function srtCanManageAccess() {
  const u = srtGetCurrentUser();
  return !!u && (u.role === "admin" || u.canManageAccess === true);
}
function srtCanSection(moduleId, sectionId) {
  const u = srtGetCurrentUser();
  if (!u) return false;
  if (u.role === "admin") return true;
  if (!Array.isArray(u.modules) || !u.modules.includes(moduleId)) return false;
  const configured =
    u.sections && Array.isArray(u.sections[moduleId])
      ? u.sections[moduleId]
      : null;
  if (!configured) return true; // backward compatibility
  return configured.includes(sectionId);
}
function srtCanAccess(pg) {
  if (pg === "home" || pg === "profile") return true;
  const u = srtGetCurrentUser();
  if (!u) return false;
  if (u.role === "admin") return true;
  return Array.isArray(u.modules) && u.modules.includes(pg);
}
function srtInitials(name) {
  return (
    String(name || "U")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] || "")
      .join("")
      .toUpperCase() || "U"
  );
}
function srtEscape(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}
function srtDisplay(v) {
  const x = String(v ?? "").trim();
  return x ? srtEscape(x) : '<span class="srt-muted-value">Not set</span>';
}

function srtApplyProfilePhoto(u) {
  if (!u) return;
  document.querySelectorAll(".sb-av img,.tb-av img").forEach((img) => {
    if (!img.dataset.srtDefaultSrc)
      img.dataset.srtDefaultSrc = img.getAttribute("src") || "";
    if (u.photo) {
      img.src = u.photo;
      img.style.objectFit = "cover";
    } else {
      img.src = img.dataset.srtDefaultSrc;
      img.style.objectFit = "contain";
    }
  });
}

function srtSaveProfilePhoto(dataUrl) {
  const u = srtGetCurrentUser();
  if (!u) return;
  const accounts = srtGetAccounts();
  const a = accounts.find((x) => x.id === u.id);
  if (!a) return;
  a.photo = dataUrl || "";
  srtSaveAccounts(accounts);
  SRT_CURRENT_USER = a;
  renderProfilePage();
}

function changeProfilePhoto(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type || "")) {
    toast("Please choose a PNG, JPG or WebP image.", "var(--red)");
    input.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast("Profile photo must be 5 MB or smaller.", "var(--red)");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onerror = () => {
    toast("Could not read this image.", "var(--red)");
    input.value = "";
  };
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => {
      toast("This image could not be processed.", "var(--red)");
      input.value = "";
    };
    image.onload = () => {
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sx = (image.naturalWidth - side) / 2;
      const sy = (image.naturalHeight - side) / 2;
      const size = Math.min(512, side);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
      const data = canvas.toDataURL("image/jpeg", 0.88);
      srtSaveProfilePhoto(data);
      toast("Profile photo updated.", "var(--green)");
      input.value = "";
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function removeProfilePhoto() {
  const u = srtGetCurrentUser();
  if (!u || !u.photo) return;
  if (!confirm("Remove your profile photo?")) return;
  srtSaveProfilePhoto("");
  toast("Profile photo removed.", "var(--yellow)");
}

function srtSectionDefaults(moduleId) {
  return (SRT_MODULE_SECTIONS[moduleId] || []).map((x) => x.id);
}
function srtRenderPermissionEditor(moduleGridId, sectionGridId, account) {
  const mg = document.getElementById(moduleGridId),
    sg = document.getElementById(sectionGridId);
  if (!mg || !sg) return;
  const selected = new Set(account?.modules || []);
  const sectionMap = account?.sections || {};
  mg.innerHTML = SRT_MODULES.map(
    (m) =>
      `<label class="srt-module-option"><input type="checkbox" value="${m.id}" ${selected.has(m.id) ? "checked" : ""}> <span>${m.icon} ${m.label}</span></label>`,
  ).join("");
  const rebuild = () => {
    const liveSelections = {};
    sg.querySelectorAll(".srt-section-card[data-module]").forEach((card) => {
      liveSelections[card.dataset.module] = [
        ...card.querySelectorAll("input:checked"),
      ].map((i) => i.value);
    });
    const mids = [...mg.querySelectorAll("input:checked")].map((i) => i.value);
    sg.innerHTML =
      mids
        .map((mid) => {
          const m = SRT_MODULES.find((x) => x.id === mid);
          const defs = SRT_MODULE_SECTIONS[mid] || [];
          const chosen = new Set(
            Array.isArray(liveSelections[mid])
              ? liveSelections[mid]
              : Array.isArray(sectionMap[mid])
                ? sectionMap[mid]
                : srtSectionDefaults(mid),
          );
          return `<div class="srt-section-card" data-module="${mid}"><div class="srt-section-card-hdr"><span>${m?.icon || ""} ${srtEscape(m?.label || mid)}</span><span>${defs.length} sections</span></div><div class="srt-section-options">${defs.map((sec) => `<label class="srt-section-option"><input type="checkbox" value="${sec.id}" ${chosen.has(sec.id) ? "checked" : ""}> ${srtEscape(sec.label)}</label>`).join("")}</div></div>`;
        })
        .join("") ||
      '<div class="srt-no-access">Select a module to configure its sections.</div>';
    if (typeof scheduleAdaptiveLightThemeText === "function")
      scheduleAdaptiveLightThemeText();
  };
  mg.querySelectorAll("input").forEach((cb) =>
    cb.addEventListener("change", rebuild),
  );
  rebuild();
}
function srtCollectPermissions(moduleGridId, sectionGridId) {
  const mg = document.getElementById(moduleGridId),
    sg = document.getElementById(sectionGridId);
  const modules = [...(mg?.querySelectorAll("input:checked") || [])].map(
    (i) => i.value,
  );
  const sections = {};
  modules.forEach((mid) => {
    const card = sg?.querySelector(`.srt-section-card[data-module="${mid}"]`);
    sections[mid] = card
      ? [...card.querySelectorAll("input:checked")].map((i) => i.value)
      : [];
  });
  return { modules, sections };
}
function srtValidatePermissions(perms) {
  if (!perms.modules.length) {
    toast("Select at least one module for this user.", "var(--red)");
    return false;
  }
  for (const mid of perms.modules) {
    if (!(perms.sections[mid] || []).length) {
      const m = SRT_MODULES.find((x) => x.id === mid);
      toast(
        `Select at least one section for ${m?.label || mid}.`,
        "var(--red)",
      );
      return false;
    }
  }
  return true;
}
function srtApplySectionUI() {
  const u = srtGetCurrentUser();
  if (!u) return;
  ["inv", "pay", "cp", "rp", "exp", "fr", "gps"].forEach((mid) => {
    const pg = document.getElementById("cp-" + mid);
    if (!pg) return;
    pg.classList.toggle("srt-sec-no-view", !srtCanSection(mid, "view"));
    pg.classList.toggle("srt-sec-no-manage", !srtCanSection(mid, "manage"));
    pg.classList.toggle("srt-sec-no-transfer", !srtCanSection(mid, "transfer"));
  });
  const attMap = {
    attendance: "attendance",
    staff: "staff",
    calendar: "calendar",
    salary: "salary",
  };
  const buttons = [...document.querySelectorAll("#cp-att .att-tab-btn")];
  let firstAllowed = null;
  buttons.forEach((btn) => {
    const m = (btn.getAttribute("onclick") || "").match(/attTab\('([^']+)'/);
    const key = m?.[1];
    if (!key) return;
    const ok = srtCanSection("att", attMap[key]);
    btn.style.display = ok ? "" : "none";
    const pane = document.getElementById("att-tab-" + key);
    if (pane && !ok) pane.classList.remove("active");
    if (ok && !firstAllowed) firstAllowed = { btn, key };
  });
  const activeVisible = buttons.some(
    (b) => b.classList.contains("active") && b.style.display !== "none",
  );
  if (!activeVisible && firstAllowed) {
    buttons.forEach((b) => b.classList.remove("active"));
    firstAllowed.btn.classList.add("active");
    document
      .querySelectorAll("#cp-att .att-tab-pane")
      .forEach((p) => p.classList.remove("active"));
    document
      .getElementById("att-tab-" + firstAllowed.key)
      ?.classList.add("active");
  }
}

function srtApplyUserUI() {
  const u = srtGetCurrentUser();
  if (!u) return;
  document.querySelectorAll(".ni[data-pg]").forEach((el) => {
    const pg = el.dataset.pg;
    el.style.display = srtCanAccess(pg) ? "" : "none";
  });
  document.querySelectorAll(".sb-nm").forEach((box) => {
    const strong = box.querySelector("strong"),
      span = box.querySelector("span");
    if (strong) strong.textContent = u.name || "User";
    if (span) span.textContent = u.email || "";
  });
  srtApplyProfilePhoto(u);
  srtApplySectionUI();
  renderProfilePage();
}

function renderProfilePage() {
  const u = srtGetCurrentUser();
  if (!u) return;
  const admin = u.role === "admin";
  const p = Object.assign(
    {
      fullName: "",
      phone: "",
      designation: "",
      department: "",
      location: "",
      employeeId: "",
      personalEmail: "",
      aadhaar: "",
      currentAddress: "",
      permanentAddress: "",
      address: "",
    },
    u.personal || {},
  );
  const $ = (id) => document.getElementById(id);
  const avatarImg = $("profileAvatarImg"),
    avatarInitials = $("profileAvatarInitials"),
    removePhoto = $("profilePhotoRemove");
  if (avatarInitials) avatarInitials.textContent = srtInitials(u.name);
  if (avatarImg) {
    if (u.photo) {
      avatarImg.src = u.photo;
      avatarImg.hidden = false;
      if (avatarInitials) avatarInitials.hidden = true;
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.hidden = true;
      if (avatarInitials) avatarInitials.hidden = false;
    }
  }
  if (removePhoto) removePhoto.hidden = !u.photo;
  srtApplyProfilePhoto(u);
  if ($("profileDisplayName"))
    $("profileDisplayName").textContent = u.name || "User";
  if ($("profileRoleLine"))
    $("profileRoleLine").textContent =
      (admin ? "Administrator" : "User") + " · Shree Ram Transport Pvt. Ltd.";
  if ($("profileStatus"))
    $("profileStatus").textContent = (u.status || "Active") + " account";
  if ($("profileAccountName"))
    $("profileAccountName").textContent = u.name || "—";
  if ($("profileAccountRole"))
    $("profileAccountRole").textContent = admin ? "Administrator" : "User";
  if ($("profileAccountEmail"))
    $("profileAccountEmail").textContent = u.email || "—";
  if ($("profileAccountStatus"))
    $("profileAccountStatus").textContent = u.status || "—";
  if ($("profileLoginType"))
    $("profileLoginType").textContent = admin
      ? "Admin account"
      : "User account";
  if ($("profileAccessLevel"))
    $("profileAccessLevel").textContent = admin
      ? "Full administrator access"
      : u.canManageAccess
        ? `Access Manager · ${(u.modules || []).length} modules`
        : `${(u.modules || []).length} assigned modules`;
  const personal = [
    ["Full Name", p.fullName],
    ["Phone", p.phone],
    ["Personal Email ID", p.personalEmail],
    ["Aadhaar Number", p.aadhaar],
    ["Designation", p.designation],
    ["Department", p.department],
    ["Work Location", p.location],
    ["Employee ID", p.employeeId],
    ["Current Address", p.currentAddress || p.address],
    ["Permanent Address", p.permanentAddress],
    ["Company", "Shree Ram Transport Pvt. Ltd."],
    ["Login Email", u.email],
  ];
  if ($("profilePersonalGrid"))
    $("profilePersonalGrid").innerHTML = personal
      .map(
        ([l, v]) =>
          `<div class="srt-personal-item"><div class="srt-personal-label">${l}</div><div class="srt-personal-value">${srtDisplay(v)}</div></div>`,
      )
      .join("");
  const mods = admin
    ? SRT_MODULES
    : SRT_MODULES.filter((m) => (u.modules || []).includes(m.id));
  if ($("profileModuleChips"))
    $("profileModuleChips").innerHTML = mods.length
      ? mods
          .map(
            (m) => `<span class="srt-profile-chip">${m.icon} ${m.label}</span>`,
          )
          .join("")
      : '<div class="srt-no-access">No operational modules have been assigned.</div>';
  document
    .querySelectorAll(".srt-admin-only")
    .forEach((el) => (el.hidden = !admin));
  const canManage = srtCanManageAccess();
  document
    .querySelectorAll(".srt-access-manager-only")
    .forEach((el) => (el.hidden = !(canManage && !admin)));
  const actionHead = document.querySelector(
    "#cp-profile .srt-admin-action-col",
  );
  if (actionHead) actionHead.style.display = admin ? "" : "none";
  const note = $("accountAdminNote");
  if (note)
    note.textContent =
      "Only the Administrator can view, export, add, edit or delete Login Accounts.";
  if (admin) {
    renderAccountList();
    renderRegistrationRequests();
    if (typeof renderGalleryAdminManagement === "function")
      renderGalleryAdminManagement();
  }
  if (canManage && !admin) renderDelegatedAccessList();
  if (typeof scheduleAdaptiveLightThemeText === "function")
    scheduleAdaptiveLightThemeText();
}

function renderAccountList() {
  const body = document.getElementById("accountListBody");
  if (!body) return;
  if (!srtIsAdmin()) {
    body.innerHTML = "";
    return;
  }
  const accounts = srtGetAccounts();
  const admin = true;
  const canManage = true;
  const me = srtGetCurrentUser();
  const label = document.getElementById("accountCountLabel");
  if (label)
    label.textContent = `${accounts.length} account${accounts.length === 1 ? "" : "s"} allowed to sign in`;
  body.innerHTML = accounts
    .map((a) => {
      const mods =
        a.role === "admin"
          ? SRT_MODULES
          : SRT_MODULES.filter((m) => (a.modules || []).includes(m.id));
      const modText =
        a.role === "admin"
          ? "All modules + all sections"
          : mods.length
            ? mods
                .map((m) => {
                  const count = (a.sections?.[m.id] || srtSectionDefaults(m.id))
                    .length;
                  return `${m.label} (${count}/${(SRT_MODULE_SECTIONS[m.id] || []).length})`;
                })
                .join(", ")
            : "No modules assigned";
      const managerText =
        a.role === "admin"
          ? "Administrator"
          : a.canManageAccess
            ? "Enabled"
            : "No";
      let actions = "";
      if (canManage) {
        if (a.role === "admin")
          actions =
            '<span style="font-size:.7rem;opacity:.42">Protected admin</span>';
        else if (admin)
          actions = `<div class="srt-account-actions"><button class="srt-btn-access" onclick="openUserAccountModal('${srtEscape(a.id)}')">Access / Edit</button><button class="srt-btn-delete" onclick="deleteUserAccount('${srtEscape(a.id)}')">Delete</button></div>`;
        else if (a.id === me?.id)
          actions =
            '<span style="font-size:.7rem;opacity:.42">Your account</span>';
        else
          actions = `<div class="srt-account-actions"><button class="srt-btn-access" onclick="openAccessManagerModal('${srtEscape(a.id)}')">Manage Access</button></div>`;
      }
      return `<tr><td><div class="srt-account-name">${srtEscape(a.name || "User")}</div><div class="srt-account-email">${srtEscape(a.email)}</div>${a.canManageAccess && a.role !== "admin" ? '<span class="srt-access-manager-badge">ACCESS MANAGER</span>' : ""}</td><td><span class="srt-role-badge ${a.role === "admin" ? "srt-role-admin" : "srt-role-user"}">${a.role === "admin" ? "Administrator" : "User"}</span></td><td><span class="srt-status-badge ${(a.status || "Active") === "Active" ? "srt-status-active" : "srt-status-disabled"}">${srtEscape(a.status || "Active")}</span></td><td><div class="srt-access-summary">${srtEscape(modText)}</div></td><td>${srtEscape(managerText)}</td><td class="srt-admin-action-cell" style="${canManage ? "" : "display:none"}">${actions}</td></tr>`;
    })
    .join("");
  if (typeof scheduleAdaptiveLightThemeText === "function")
    scheduleAdaptiveLightThemeText();
}

function openUserAccountModal(id = null) {
  if (!srtIsAdmin()) {
    toast("Administrator access required.", "var(--red)");
    return;
  }
  SRT_EDIT_ACCOUNT_ID = id;
  const account = id ? srtGetAccounts().find((a) => a.id === id) : null;
  if (account?.role === "admin") {
    toast("The primary administrator account is protected.", "var(--yellow)");
    return;
  }
  document.getElementById("srtUserModalTitle").textContent = account
    ? "Edit User Account"
    : "Add User Account";
  document.getElementById("uaName").value = account?.name || "";
  document.getElementById("uaEmail").value = account?.email || "";
  document.getElementById("uaEmail").disabled = !!account;
  document.getElementById("uaPassword").value = account?.password || "";
  document.getElementById("uaStatus").value = account?.status || "Active";
  document.getElementById("uaPhone").value = account?.personal?.phone || "";
  document.getElementById("uaDesignation").value =
    account?.personal?.designation || "";
  document.getElementById("uaDepartment").value =
    account?.personal?.department || "";
  document.getElementById("uaEmployeeId").value =
    account?.personal?.employeeId || "";
  document.getElementById("uaLocation").value =
    account?.personal?.location || "";
  document.getElementById("uaPersonalEmail").value =
    account?.personal?.personalEmail || "";
  document.getElementById("uaAadhaar").value = account?.personal?.aadhaar || "";
  document.getElementById("uaCurrentAddress").value =
    account?.personal?.currentAddress || account?.personal?.address || "";
  document.getElementById("uaPermanentAddress").value =
    account?.personal?.permanentAddress || "";
  const delegate = document.getElementById("uaCanManageAccess");
  if (delegate) delegate.checked = !!account?.canManageAccess;
  srtRenderPermissionEditor("uaModuleGrid", "uaSectionGrid", account);
  document.getElementById("srtUserOverlay").classList.add("open");
  if (typeof scheduleAdaptiveLightThemeText === "function")
    scheduleAdaptiveLightThemeText();
}
function closeUserAccountModal() {
  document.getElementById("srtUserOverlay")?.classList.remove("open");
  SRT_EDIT_ACCOUNT_ID = null;
}
function saveUserAccount() {
  if (!srtIsAdmin()) {
    toast("Administrator access required.", "var(--red)");
    return;
  }

  const fieldIds = [
    "uaName",
    "uaEmail",
    "uaPassword",
    "uaStatus",
    "uaPhone",
    "uaDesignation",
    "uaDepartment",
    "uaEmployeeId",
    "uaLocation",
    "uaPersonalEmail",
    "uaAadhaar",
    "uaCurrentAddress",
    "uaPermanentAddress",
  ];
  fieldIds.forEach((id) =>
    document.getElementById(id)?.classList.remove("srt-field-error"),
  );

  const name = document.getElementById("uaName").value.trim();
  const email = document.getElementById("uaEmail").value.trim().toLowerCase();
  const password = document.getElementById("uaPassword").value;
  const status = document.getElementById("uaStatus").value.trim();
  const phone = document.getElementById("uaPhone").value.trim();
  const designation = document.getElementById("uaDesignation").value.trim();
  const department = document.getElementById("uaDepartment").value.trim();
  const employeeId = document.getElementById("uaEmployeeId").value.trim();
  const location = document.getElementById("uaLocation").value.trim();
  const personalEmail = document
    .getElementById("uaPersonalEmail")
    .value.trim()
    .toLowerCase();
  const aadhaar = document.getElementById("uaAadhaar").value.replace(/\D/g, "");
  const currentAddress = document
    .getElementById("uaCurrentAddress")
    .value.trim();
  const permanentAddress = document
    .getElementById("uaPermanentAddress")
    .value.trim();

  const values = {
    uaName: name,
    uaEmail: email,
    uaPassword: password,
    uaStatus: status,
    uaPhone: phone,
    uaDesignation: designation,
    uaDepartment: department,
    uaEmployeeId: employeeId,
    uaLocation: location,
    uaPersonalEmail: personalEmail,
    uaAadhaar: aadhaar,
    uaCurrentAddress: currentAddress,
    uaPermanentAddress: permanentAddress,
  };
  const firstEmpty = fieldIds.find((id) => !values[id]);
  if (firstEmpty) {
    const el = document.getElementById(firstEmpty);
    el?.classList.add("srt-field-error");
    el?.focus();
    toast("All user account fields are required.", "var(--red)");
    return;
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    const el = document.getElementById("uaEmail");
    el.classList.add("srt-field-error");
    el.focus();
    toast("Enter a valid login email.", "var(--red)");
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(personalEmail)) {
    const el = document.getElementById("uaPersonalEmail");
    el.classList.add("srt-field-error");
    el.focus();
    toast("Enter a valid personal email ID.", "var(--red)");
    return;
  }
  if (!/^\d{12}$/.test(aadhaar)) {
    const el = document.getElementById("uaAadhaar");
    el.classList.add("srt-field-error");
    el.focus();
    toast("Aadhaar number must contain exactly 12 digits.", "var(--red)");
    return;
  }
  if (!/^\d{10}$/.test(phone)) {
    const el = document.getElementById("uaPhone");
    el.classList.add("srt-field-error");
    el.focus();
    toast("Phone number must contain exactly 10 numeric digits.", "var(--red)");
    return;
  }

  // 8–15 characters; uppercase, lowercase, number and at least one non-alphanumeric special character.
  const passwordValid =
    password.length >= 8 &&
    password.length <= 15 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password) &&
    !/\s/.test(password);
  if (!passwordValid) {
    const el = document.getElementById("uaPassword");
    el.classList.add("srt-field-error");
    el.focus();
    toast(
      "Password must be 8–15 characters and include uppercase, lowercase, number and special character.",
      "var(--red)",
    );
    return;
  }

  const perms = srtCollectPermissions("uaModuleGrid", "uaSectionGrid");
  if (!srtValidatePermissions(perms)) return;
  const modules = perms.modules,
    sections = perms.sections;
  const canManageAccess =
    !!document.getElementById("uaCanManageAccess")?.checked;

  let accounts = srtGetAccounts();
  const dupe = accounts.find(
    (a) => a.email.toLowerCase() === email && a.id !== SRT_EDIT_ACCOUNT_ID,
  );
  if (dupe) {
    toast("This email already has an account.", "var(--red)");
    return;
  }
  const personal = {
    phone,
    designation,
    department,
    employeeId,
    location,
    personalEmail,
    aadhaar,
    currentAddress,
    permanentAddress,
    address: currentAddress,
  };
  if (SRT_EDIT_ACCOUNT_ID) {
    const a = accounts.find((x) => x.id === SRT_EDIT_ACCOUNT_ID);
    if (!a) return;
    a.name = name;
    a.password = password;
    a.status = status;
    a.modules = modules;
    a.sections = sections;
    a.canManageAccess = canManageAccess;
    a.personal = Object.assign({}, a.personal || {}, personal);
  } else {
    accounts.push({
      id: "usr_" + Date.now().toString(36),
      name,
      email,
      password,
      role: "user",
      status,
      modules,
      sections,
      canManageAccess,
      photo: "",
      personal: Object.assign(
        {
          fullName: name,
          employeeId: "",
          personalEmail: "",
          aadhaar: "",
          currentAddress: "",
          permanentAddress: "",
          address: "",
        },
        personal,
      ),
      createdAt: new Date().toISOString(),
    });
  }
  const wasEdit = !!SRT_EDIT_ACCOUNT_ID;
  srtSaveAccounts(accounts);
  closeUserAccountModal();
  renderProfilePage();
  toast(wasEdit ? "User updated." : "User account created.", "var(--green)");
}
function openAccessManagerModal(id) {
  if (!srtCanManageAccess()) {
    toast("Access management permission required.", "var(--red)");
    return;
  }
  const me = srtGetCurrentUser();
  const a = srtGetAccounts().find((x) => x.id === id);
  if (!a) return;
  if (a.role === "admin") {
    toast("Administrator access is protected.", "var(--yellow)");
    return;
  }
  if (!srtIsAdmin() && a.id === me?.id) {
    toast(
      "Access Managers cannot change their own permissions.",
      "var(--yellow)",
    );
    return;
  }
  SRT_ACCESS_EDIT_ACCOUNT_ID = id;
  const t = document.getElementById("srtAccessTargetName");
  if (t) t.textContent = `${a.name} · ${a.email}`;
  srtRenderPermissionEditor("amModuleGrid", "amSectionGrid", a);
  document.getElementById("srtAccessOverlay")?.classList.add("open");
  if (typeof scheduleAdaptiveLightThemeText === "function")
    scheduleAdaptiveLightThemeText();
}
function closeAccessManagerModal() {
  document.getElementById("srtAccessOverlay")?.classList.remove("open");
  SRT_ACCESS_EDIT_ACCOUNT_ID = null;
}
function saveAccessManagerPermissions() {
  if (!srtCanManageAccess()) {
    toast("Access management permission required.", "var(--red)");
    return;
  }
  const me = srtGetCurrentUser();
  let accounts = srtGetAccounts();
  const a = accounts.find((x) => x.id === SRT_ACCESS_EDIT_ACCOUNT_ID);
  if (!a) return;
  if (a.role === "admin" || (!srtIsAdmin() && a.id === me?.id)) {
    toast("This account cannot be changed by you.", "var(--red)");
    return;
  }
  const perms = srtCollectPermissions("amModuleGrid", "amSectionGrid");
  if (!srtValidatePermissions(perms)) return;
  a.modules = perms.modules;
  a.sections = perms.sections;
  srtSaveAccounts(accounts);
  closeAccessManagerModal();
  renderProfilePage();
  toast("Module and section access updated.", "var(--green)");
}

function exportLoginAccountsCSV() {
  if (!srtIsAdmin()) {
    toast("Administrator access required.", "var(--red)");
    return;
  }
  const accounts = srtGetAccounts();
  if (!accounts.length) {
    toast("No login accounts to export.", "var(--yellow)");
    return;
  }
  const rows = accounts.map((a) => {
    const p = a.personal || {};
    return {
      "Full Name": p.fullName || a.name || "",
      "Login ID": a.email || "",
      Password: a.password || "",
      Role: a.role === "admin" ? "Administrator" : "User",
      Status: a.status || "Active",
      "Phone Number": p.phone || "",
      "Personal Email ID": p.personalEmail || "",
      "Aadhaar Number": p.aadhaar || "",
      Designation: p.designation || "",
      Department: p.department || "",
      "Work Location": p.location || "",
      "Employee ID": p.employeeId || "",
      "Current Address": p.currentAddress || p.address || "",
      "Permanent Address": p.permanentAddress || "",
      Company: "Shree Ram Transport Pvt. Ltd.",
      "Access Manager": a.canManageAccess ? "Yes" : "No",
      "Created At": a.createdAt || "",
    };
  });
  const headers = Object.keys(rows[0]);
  const csvCell = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const csv =
    "\ufeff" +
    [
      headers.map(csvCell).join(","),
      ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
    ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download =
    "SRT_Login_Account_Data_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(
    `Exported ${rows.length} login account${rows.length === 1 ? "" : "s"} to CSV.`,
    "var(--green)",
  );
}

function deleteUserAccount(id) {
  if (!srtIsAdmin()) {
    toast("Administrator access required.", "var(--red)");
    return;
  }
  let accounts = srtGetAccounts();
  const a = accounts.find((x) => x.id === id);
  if (!a) return;
  if (a.role === "admin") {
    toast("The Administrator account cannot be deleted.", "var(--red)");
    return;
  }
  if (!confirm(`Delete login account for ${a.name} (${a.email})?`)) return;
  accounts = accounts.filter((x) => x.id !== id);
  srtSaveAccounts(accounts);
  renderProfilePage();
  toast("User account deleted.", "var(--red)");
}

function openPersonalInfoModal() {
  const u = srtGetCurrentUser();
  if (!u) return;
  const p = u.personal || {};
  [
    "FullName",
    "Phone",
    "Designation",
    "Department",
    "Location",
    "EmployeeId",
    "PersonalEmail",
    "Aadhaar",
    "CurrentAddress",
    "PermanentAddress",
  ].forEach((k) => {
    const el = document.getElementById("pi" + k);
    if (el) el.value = p[k.charAt(0).toLowerCase() + k.slice(1)] || "";
  });
  const ca = document.getElementById("piCurrentAddress");
  if (ca && !ca.value) ca.value = p.address || "";
  document.getElementById("srtPersonalOverlay").classList.add("open");
  if (typeof scheduleAdaptiveLightThemeText === "function")
    scheduleAdaptiveLightThemeText();
}
function closePersonalInfoModal() {
  document.getElementById("srtPersonalOverlay")?.classList.remove("open");
}
function savePersonalInfo() {
  const u = srtGetCurrentUser();
  if (!u) return;
  const personal = {
    fullName: document.getElementById("piFullName").value.trim(),
    phone: document
      .getElementById("piPhone")
      .value.replace(/\D/g, "")
      .slice(0, 10),
    designation: document.getElementById("piDesignation").value.trim(),
    department: document.getElementById("piDepartment").value.trim(),
    location: document.getElementById("piLocation").value.trim(),
    employeeId: document.getElementById("piEmployeeId").value.trim(),
    personalEmail: document
      .getElementById("piPersonalEmail")
      .value.trim()
      .toLowerCase(),
    aadhaar: document.getElementById("piAadhaar").value.replace(/\D/g, ""),
    currentAddress: document.getElementById("piCurrentAddress").value.trim(),
    permanentAddress: document
      .getElementById("piPermanentAddress")
      .value.trim(),
  };
  if (personal.phone && !/^\d{10}$/.test(personal.phone)) {
    const el = document.getElementById("piPhone");
    if (el) {
      el.classList.add("srt-field-error");
      el.focus();
    }
    toast("Phone number must contain exactly 10 numeric digits.", "var(--red)");
    return;
  }
  if (personal.aadhaar && !/^\d{12}$/.test(personal.aadhaar)) {
    const el = document.getElementById("piAadhaar");
    if (el) {
      el.classList.add("srt-field-error");
      el.focus();
    }
    toast(
      "Aadhaar number must contain exactly 12 numeric digits.",
      "var(--red)",
    );
    return;
  }
  personal.address = personal.currentAddress;
  let accounts = srtGetAccounts();
  const a = accounts.find((x) => x.id === u.id);
  if (!a) return;
  a.personal = Object.assign({}, a.personal || {}, personal);
  srtSaveAccounts(accounts);
  SRT_CURRENT_USER = a;
  closePersonalInfoModal();
  renderProfilePage();
  toast("Personal information saved.", "var(--green)");
}

// Override login to support all accounts created by Administrator.
window.doLogin = function () {
  return srtSubmitLogin();
};
window.doLogout = function () {
  if (confirm("Log out?")) {
    SRT_CURRENT_USER = null;
    try {
      sessionStorage.removeItem(SRT_SESSION_KEY);
    } catch (e) {}
    const lp = document.getElementById("lp");
    const lu = document.getElementById("lu");
    if (lp) lp.value = "";
    if (lu) lu.value = "";
    showHomePage();
  }
};

// Override navigation so assigned module permissions are enforced in the UI.
window.nav = function (el) {
  if (!el) return;
  const pg = el.dataset?.pg;
  if (!pg) return;
  if (!srtCanAccess(pg)) {
    toast("You do not have access to this module.", "var(--red)");
    return;
  }
  document.querySelectorAll(".ni").forEach((n) => n.classList.remove("active"));
  el.classList.add("active");
  document.querySelectorAll(".cp").forEach((p) => p.classList.remove("active"));
  document.getElementById("cp-" + pg)?.classList.add("active");
  if (pg === "att" && typeof initAtt === "function") initAtt();
  if (pg === "gps" && typeof initGPS === "function") initGPS();
  if (pg === "fr") {
    renderFr();
    renderTable("trader");
    renderTable("vehicle");
  }
  if (pg === "profile") renderProfilePage();
  srtApplySectionUI();
  if (
    typeof isMobile === "function" &&
    isMobile() &&
    typeof sidebarClose === "function"
  )
    sidebarClose();
};

// Keep account/profile display synchronized after theme changes.
const srtPreviousApplyTheme = window.applyTheme;
if (typeof srtPreviousApplyTheme === "function") {
  window.applyTheme = function (theme) {
    srtPreviousApplyTheme(theme);
    const el = document.getElementById("profileThemeValue");
    if (el) el.textContent = theme === "light" ? "Light" : "Dark";
  };
}

document.addEventListener("DOMContentLoaded", () => {
  srtLoadAccounts();
  renderAccountList();
});
