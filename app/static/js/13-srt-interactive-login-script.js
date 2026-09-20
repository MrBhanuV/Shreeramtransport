// Presentation and form behavior use the existing administrator-managed accounts.
const SRT_REMEMBER_EMAIL_KEY = "srt_remembered_email_v1";
let srtLoginPendingTimer = null;

function srtLoginSetBusy(busy) {
  const form = document.getElementById("srt-login-form"),
    button = document.getElementById("lbtn");
  form.setAttribute("aria-busy", String(busy));
  button.disabled = busy;
  button.classList.toggle("is-loading", busy);
  document.getElementById("srt-login-button-text").textContent = busy
    ? "Signing in…"
    : "Sign in to dashboard";
  document.getElementById("lu").readOnly = busy;
  document.getElementById("lp").readOnly = busy;
  document.getElementById("srt-login-register").disabled = busy;
}
function srtLoginFieldError(id, message) {
  const input = document.getElementById(id),
    error = document.getElementById(
      id === "lu" ? "srt-login-email-error" : "srt-login-password-error",
    );
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  error.textContent = message || "";
  error.hidden = !message;
}
function srtLoginClearFeedback() {
  const error = document.getElementById("lerr");
  error.classList.remove("show");
  error.textContent = "";
  document.getElementById("srt-login-status").textContent = "";
}
function srtLoginShowError(message) {
  const error = document.getElementById("lerr");
  error.textContent = message;
  error.classList.add("show");
}
function togglePw() {
  const input = document.getElementById("lp"),
    button = document.getElementById("srt-login-password-toggle");
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute(
    "aria-label",
    visible ? "Hide password" : "Show password",
  );
  button.title = visible ? "Hide password" : "Show password";
}
function srtPrepareLogin() {
  clearTimeout(srtLoginPendingTimer);
  srtLoginPendingTimer = null;
  srtLoginSetBusy(false);
  srtLoginClearFeedback();
  ["lu", "lp"].forEach((id) => srtLoginFieldError(id, ""));
  let remembered = "";
  try {
    remembered = localStorage.getItem(SRT_REMEMBER_EMAIL_KEY) || "";
  } catch (e) {}
  document.getElementById("lu").value = remembered;
  document.getElementById("srt-login-remember").checked = !!remembered;
  const password = document.getElementById("lp");
  password.value = "";
  if (password.type !== "password") togglePw();
  document.getElementById("srt-login-caps").hidden = true;
  document.getElementById("srt-login-help").hidden = true;
  document
    .getElementById("srt-login-help-toggle")
    .setAttribute("aria-expanded", "false");
}
function srtSubmitLogin() {
  const page = document.getElementById("pg-login"),
    emailInput = document.getElementById("lu"),
    passwordInput = document.getElementById("lp");
  if (
    !page.classList.contains("active") ||
    document.getElementById("lbtn").disabled ||
    document
      .getElementById("srtRegistrationOverlay")
      ?.classList.contains("open")
  )
    return;
  srtLoginClearFeedback();
  const email = emailInput.value.trim().toLowerCase(),
    password = passwordInput.value;
  emailInput.value = email;
  const emailError = !email
    ? "Enter your email address."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? "Enter a valid email address."
      : "";
  const passwordError = !password ? "Enter your password." : "";
  srtLoginFieldError("lu", emailError);
  srtLoginFieldError("lp", passwordError);
  if (emailError || passwordError) {
    (emailError ? emailInput : passwordInput).focus();
    return;
  }
  let account;
  try {
    account = srtGetAccounts().find(
      (a) =>
        String(a.email || "").toLowerCase() === email &&
        a.password === password,
    );
  } catch (e) {
    srtLoginShowError(
      "Your account details could not be loaded. Please try again.",
    );
    return;
  }
  if (!account || account.status !== "Active") {
    srtLoginShowError(
      "We couldn’t sign you in. Check your email and password, or contact your administrator if your access is pending.",
    );
    passwordInput.focus();
    return;
  }
  srtLoginSetBusy(true);
  document.getElementById("srt-login-status").textContent =
    "Signing in. Please wait.";
  srtLoginPendingTimer = setTimeout(() => {
    srtLoginPendingTimer = null;
    if (!page.classList.contains("active")) {
      srtLoginSetBusy(false);
      return;
    }
    SRT_CURRENT_USER = account;
    try {
      sessionStorage.setItem(SRT_SESSION_KEY, account.email);
    } catch (e) {}
    try {
      showDashboardPage();
      try {
        if (document.getElementById("srt-login-remember").checked)
          localStorage.setItem(SRT_REMEMBER_EMAIL_KEY, email);
        else localStorage.removeItem(SRT_REMEMBER_EMAIL_KEY);
      } catch (e) {}
      passwordInput.value = "";
      if (passwordInput.type !== "password") togglePw();
      document.getElementById("srt-login-status").textContent = "Signed in.";
    } catch (e) {
      SRT_CURRENT_USER = null;
      try {
        sessionStorage.removeItem(SRT_SESSION_KEY);
      } catch (err) {}
      srtSwitchPage("pg-login");
      srtLoginShowError("The dashboard could not be opened. Please try again.");
    } finally {
      srtLoginSetBusy(false);
    }
  }, 450);
}

(function () {
  const form = document.getElementById("srt-login-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    doLogin();
  });
  ["lu", "lp"].forEach((id) =>
    document.getElementById(id).addEventListener("input", () => {
      srtLoginFieldError(id, "");
      srtLoginClearFeedback();
    }),
  );
  document
    .getElementById("srt-login-password-toggle")
    .addEventListener("click", togglePw);
  const password = document.getElementById("lp"),
    caps = document.getElementById("srt-login-caps");
  ["keydown", "keyup"].forEach((type) =>
    password.addEventListener(type, (event) => {
      caps.hidden = !event.getModifierState?.("CapsLock");
    }),
  );
  password.addEventListener("blur", () => {
    caps.hidden = true;
  });
  document
    .getElementById("srt-login-help-toggle")
    .addEventListener("click", (event) => {
      const button = event.currentTarget,
        open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      document.getElementById("srt-login-help").hidden = !open;
    });
  form.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !document.getElementById("srt-login-help").hidden
    ) {
      document.getElementById("srt-login-help").hidden = true;
      document
        .getElementById("srt-login-help-toggle")
        .setAttribute("aria-expanded", "false");
      document.getElementById("srt-login-help-toggle").focus();
    }
  });
  document
    .getElementById("srt-login-remember")
    .addEventListener("change", (event) => {
      if (!event.currentTarget.checked) {
        try {
          localStorage.removeItem(SRT_REMEMBER_EMAIL_KEY);
        } catch (e) {}
      }
    });
  const features = {
    freight: {
      eyebrow: "FREIGHT & INVOICES",
      title: "From dispatch to delivery.",
      description:
        "Keep freight rates, invoices and delivery updates connected.",
      steps: ["Freight rates", "Invoices", "Delivery status"],
      icon: "truck",
    },
    payments: {
      eyebrow: "PAYMENTS & EXPENSES",
      title: "Know where every rupee goes.",
      description:
        "Organize company payments, received payments and daily expenses.",
      steps: ["Company payments", "Received payments", "Expenses"],
      icon: "payments",
    },
    team: {
      eyebrow: "PEOPLE & FLEET",
      title: "Your people. Your vehicles.",
      description:
        "Keep vehicle details, GPS records and staff attendance together.",
      steps: ["Vehicle details", "GPS records", "Attendance"],
      icon: "team",
    },
  };
  const featureIcons = {
    truck:
      '<path d="M2 5h12v12H2zM14 9h4l4 5v3h-8M18 9v5h4"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    payments:
      '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-14a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
  };
  document.querySelectorAll("#pg-login .srt-login-feature").forEach((button) =>
    button.addEventListener("click", () => {
      const feature = features[button.dataset.feature];
      document
        .querySelectorAll("#pg-login .srt-login-feature")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      document.getElementById("srt-login-feature-eyebrow").textContent =
        feature.eyebrow;
      document.getElementById("srt-login-feature-title").textContent =
        feature.title;
      document.getElementById("srt-login-feature-description").textContent =
        feature.description;
      feature.steps.forEach((label, index) => {
        document.getElementById("srt-login-step-" + (index + 1)).textContent =
          label;
      });
      document.querySelector(
        "#pg-login .srt-login-preview-icon svg",
      ).innerHTML = featureIcons[feature.icon];
    }),
  );
  srtPrepareLogin();
})();
