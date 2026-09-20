
/* Dark / Light theme */
const SRT_THEME_KEY = 'srt_theme';
function srtParseCssColor(value){
  if(!value || value === 'transparent') return null;
  const m = value.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
  if(!m) return null;
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if(a <= 0.05) return null;
  return {r:Number(m[1]), g:Number(m[2]), b:Number(m[3]), a};
}
function srtEffectiveBackground(el){
  let node = el;
  while(node && node.nodeType === 1){
    const c = srtParseCssColor(getComputedStyle(node).backgroundColor);
    if(c) return c;
    node = node.parentElement;
  }
  return {r:255,g:255,b:255,a:1};
}
function srtRelativeLuminance(c){
  const chan = v => {
    v /= 255;
    return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  };
  return 0.2126*chan(c.r) + 0.7152*chan(c.g) + 0.0722*chan(c.b);
}
function applyAdaptiveLightThemeText(root=document.body){
  if(!root) return;
  // Theme colors are now handled explicitly in CSS. The old automatic
  // detector could misread gradients and translucent backgrounds and
  // turn text black on dark surfaces (for example the Profile banner).
  const nodes = root.querySelectorAll ? [root, ...root.querySelectorAll('*')] : [];
  nodes.forEach(el => {
    if(el.classList) el.classList.remove('srt-auto-white','srt-auto-black');
  });
}
let srtContrastTimers = [];
function scheduleAdaptiveLightThemeText(){
  srtContrastTimers.forEach(t => clearTimeout(t));
  srtContrastTimers = [];
  // Recalculate once immediately and again after CSS theme transitions finish.
  // This prevents light cards from being classified while they are still fading from dark.
  [0, 80, 280, 520].forEach(delay => {
    srtContrastTimers.push(setTimeout(() => applyAdaptiveLightThemeText(document.body), delay));
  });
}
function applyTheme(theme){
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  const btn = document.getElementById('themeToggle');
  const icon = document.getElementById('themeToggleIcon');
  if (icon) icon.textContent = next === 'light' ? '🌙' : '☀️';
  if (btn) {
    const label = next === 'light' ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  const profileThemeValue = document.getElementById('profileThemeValue');
  if(profileThemeValue) profileThemeValue.textContent = next === 'light' ? 'Light' : 'Dark';
  scheduleAdaptiveLightThemeText();
}
function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem(SRT_THEME_KEY, next); } catch(e) {}
}
(function initThemeButton(){
  let saved = 'dark';
  try { saved = localStorage.getItem(SRT_THEME_KEY) === 'light' ? 'light' : 'dark'; } catch(e) {}
  applyTheme(saved);
  // Re-check contrast whenever dashboard/table/treemap content is rebuilt dynamically.
  const observer = new MutationObserver(mutations => {
    if(document.documentElement.getAttribute('data-theme') !== 'light') return;
    if(mutations.some(m => m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length))) {
      scheduleAdaptiveLightThemeText();
    }
  });
  observer.observe(document.body, {subtree:true, childList:true});
})();
