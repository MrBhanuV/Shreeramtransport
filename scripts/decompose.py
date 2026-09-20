"""
Phase 2 decomposition script.
Reads the original monolithic HTML file and splits it into:
  - app/static/css/*.css      (one file per <style> block, in original cascade order)
  - app/static/js/*.js        (one file per <script> block, in original order)
  - app/static/media/*.png    (decoded base64 images, de-duplicated by content hash)
  - app/static/legacy/tax_invoice_app.html  (the embedded secondary HTML app, decoded)
  - app/templates/legacy_full.html          (the *entire* original body, with inline
        style/script blocks replaced by <link>/<script src> tags and base64 images
        replaced by /static/media/ references) -- used as the app shell template.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "original.html"
CSS_DIR = ROOT / "app/static/css"
JS_DIR = ROOT / "app/static/js"
MEDIA_DIR = ROOT / "app/static/media"
LEGACY_DIR = ROOT / "app/static/legacy"
TEMPLATES_DIR = ROOT / "app/templates"

for d in (CSS_DIR, JS_DIR, MEDIA_DIR, LEGACY_DIR, TEMPLATES_DIR):
    d.mkdir(parents=True, exist_ok=True)

content = SRC.read_text(encoding="utf-8")

# 1. Decode base64 images -> real files, de-duplicated by sha1 of the bytes
img_pattern = re.compile(r'data:image/(?P<ext>png|jpe?g|gif|webp);base64,(?P<data>[A-Za-z0-9+/=]+)')
hash_to_filename = {}
replacements = []

media_manifest = []
for m in img_pattern.finditer(content):
    ext = m.group("ext")
    b64 = m.group("data")
    raw = __import__("base64").b64decode(b64)
    sha1 = hashlib.sha1(raw).hexdigest()[:12]
    if sha1 not in hash_to_filename:
        fname = f"logo-{sha1}.{ 'jpg' if ext in ('jpg','jpeg') else ext }"
        (MEDIA_DIR / fname).write_bytes(raw)
        hash_to_filename[sha1] = fname
        media_manifest.append({"file": fname, "bytes": len(raw), "ext": ext})
    fname = hash_to_filename[sha1]
    replacements.append((m.start(), m.end(), f"/static/media/{fname}"))

print(f"[media] decoded {len(hash_to_filename)} unique image(s) from "
      f"{len(list(img_pattern.finditer(content)))} occurrences")
for entry in media_manifest:
    print("   -", entry)


def apply_replacements(text, repls):
    repls = sorted(repls, key=lambda r: r[0])
    out = []
    last = 0
    for start, end, rep in repls:
        out.append(text[last:start])
        out.append(rep)
        last = end
    out.append(text[last:])
    return "".join(out)


content_after_media = apply_replacements(content, replacements)

# 2. Extract <style ...>...</style> blocks (in document order)
style_pattern = re.compile(r'<style(?P<attrs>[^>]*)>(?P<body>.*?)</style>', re.S)
manifest_css = []
idx = 0


def style_repl(m):
    global idx
    idx += 1
    attrs = m.group("attrs")
    body = m.group("body")
    id_match = re.search(r'id="([^"]+)"', attrs)
    name = id_match.group(1) if id_match else f"base-{idx:02d}"
    fname = f"{idx:02d}-{name}.css"
    (CSS_DIR / fname).write_text(body, encoding="utf-8")
    manifest_css.append({"order": idx, "name": name, "file": fname, "chars": len(body)})
    return f'<link rel="stylesheet" href="/static/css/{fname}">'


content_after_css = style_pattern.sub(style_repl, content_after_media)
print(f"[css] extracted {idx} <style> block(s)")

# 3. Extract inline <script>...</script> blocks (skip ones with src=)
script_pattern = re.compile(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', re.S)
manifest_js = []
jidx = 0


def script_repl(m):
    global jidx
    attrs = m.group("attrs")
    body = m.group("body")
    if re.search(r'\bsrc=', attrs):
        return m.group(0)
    jidx += 1
    id_match = re.search(r'id="([^"]+)"', attrs)
    name = id_match.group(1) if id_match else f"core-{jidx:02d}"
    fname = f"{jidx:02d}-{name}.js"
    (JS_DIR / fname).write_text(body, encoding="utf-8")
    manifest_js.append({"order": jidx, "name": name, "file": fname, "chars": len(body)})
    return f'<script src="/static/js/{fname}"></script>'


content_final = script_pattern.sub(script_repl, content_after_css)
print(f"[js] extracted {jidx} inline <script> block(s)")

# 3b. Inject the new API bridge scripts right before </body>, AFTER all
# extracted legacy scripts so they can override the functions those define.
bridge_tags = (
    '<script src="/static/js/api-client.js"></script>\n'
    '<script src="/static/js/17-srt-server-auth-bridge.js"></script>\n'
    '<script src="/static/js/18-srt-registration-server-bridge.js"></script>\n'
)
content_final = content_final.replace("</body>", bridge_tags + "</body>", 1)

# 3c. The original file never declared a favicon (confirmed: no <link
# rel="icon"> anywhere in original.html), so every browser silently
# auto-requests /favicon.ico and gets a 404 -- pre-existing, harmless
# behavior. Since we already have the SRT logo decoded to a real file,
# adding an explicit favicon is a small, purely-additive improvement (does
# not alter any existing visible behavior) that avoids that noisy 404.
if hash_to_filename:
    first_logo = next(iter(hash_to_filename.values()))
    favicon_tag = f'<link rel="icon" type="image/png" href="/static/media/{first_logo}">\n'
    content_final = content_final.replace("<head>", "<head>\n" + favicon_tag, 1)

# 3d. Root-cause fix for the "stale admin credential" safeguard in the
# legacy account-management script (srtLoadAccounts()). That function
# force-clears SRT_CURRENT_USER whenever the locally-cached admin account's
# `credentialRevision` doesn't match the current `SRT_ADMIN_CREDENTIAL_
# REVISION` constant -- a legitimate safety net in the original 100%
# client-side app (it detects "your browser has an outdated cached admin
# password after an app update"). Now that authentication is server-backed
# (every login re-verifies the real password with bcrypt, and every API
# call re-validates the JWT), that entire local-staleness concept no longer
# applies to a session that originated from the server -- the server LITERALLY
# just confirmed the credentials were correct. We patch the one line that
# performs the force-logout so it is skipped for server-backed sessions
# (flagged via `window.SRT_SESSION_IS_SERVER_BACKED`, set by
# 17-srt-server-auth-bridge.js immediately after a successful server login),
# while leaving 100% of the original behavior intact for any legacy,
# purely-local session (there are none anymore, but this keeps the change
# minimal and reversible).
_ACCOUNT_MGMT_JS = None
for _f in JS_DIR.glob("*account-management-script.js"):
    _ACCOUNT_MGMT_JS = _f
if _ACCOUNT_MGMT_JS:
    _src = _ACCOUNT_MGMT_JS.read_text(encoding="utf-8")
    _old = (
        "if(SRT_CURRENT_USER&&(SRT_CURRENT_USER.id===admin.id||"
        "previousAdminEmails.includes(String(SRT_CURRENT_USER.email||'')"
        ".toLowerCase())))SRT_CURRENT_USER=null;"
    )
    _occurrences = _src.count(_old)
    if _occurrences != 1:
        raise RuntimeError(
            f"[patch] expected exactly 1 occurrence of the stale-credential "
            f"reset line in {_ACCOUNT_MGMT_JS.name}, found {_occurrences}. "
            f"The upstream source has changed -- update the patch in "
            f"scripts/decompose.py before re-running."
        )
    _new = (
        "if(!window.SRT_SESSION_IS_SERVER_BACKED&&SRT_CURRENT_USER&&"
        "(SRT_CURRENT_USER.id===admin.id||"
        "previousAdminEmails.includes(String(SRT_CURRENT_USER.email||'')"
        ".toLowerCase())))SRT_CURRENT_USER=null;"
    )
    _ACCOUNT_MGMT_JS.write_text(_src.replace(_old, _new, 1), encoding="utf-8")
    print(f"[patch] applied stale-credential-check guard to {_ACCOUNT_MGMT_JS.name}")
else:
    raise RuntimeError("[patch] account-management script not found (unexpected)")

(TEMPLATES_DIR / "legacy_full.html").write_text(content_final, encoding="utf-8")

# 5. Decode the embedded Tax-Invoice sub-application (srtTaxInvoiceDocument)
tax_js_file = None
for f in JS_DIR.glob("*tax-invoice-module.js"):
    tax_js_file = f
if tax_js_file:
    js_src = tax_js_file.read_text(encoding="utf-8")
    m = re.search(r'const\s+srtTaxInvoiceDocument\s*=\s*"(?P<body>.*?)";\s*\n', js_src, re.S)
    if m:
        raw_js_string = '"' + m.group("body") + '"'
        try:
            decoded_html = json.loads(raw_js_string)
            (LEGACY_DIR / "tax_invoice_app.html").write_text(decoded_html, encoding="utf-8")
            print(f"[tax-invoice] decoded embedded sub-app ({len(decoded_html)} chars)")
        except json.JSONDecodeError as e:
            print("[tax-invoice] JSON decode failed:", e)
else:
    print("[tax-invoice] source js file not found (unexpected)")

manifest = {"media": media_manifest, "css_blocks": manifest_css, "js_blocks": manifest_js}
(ROOT / "docs/decomposition_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("\n[done] wrote docs/decomposition_manifest.json")
print(f"[done] original size: {len(content):,} chars -> legacy_full.html size: {len(content_final):,} chars")
