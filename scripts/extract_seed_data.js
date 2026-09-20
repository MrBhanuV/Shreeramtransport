const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'app', 'static', 'js', '02-core-02.js');
const src = fs.readFileSync(srcPath, 'utf-8');

const sandbox = {
  console,
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => ({ style: {}, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, setAttribute(){}, appendChild(){} }),
    body: { classList: { add(){}, remove(){} }, appendChild(){} },
    documentElement: { setAttribute(){}, style:{} },
  },
  window: { addEventListener: () => {}, localStorage: { getItem: () => null, setItem: () => {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  setTimeout, setInterval, clearInterval, clearTimeout,
  XLSX: {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
  vm.runInContext(src, sandbox, { filename: '02-core-02.js', timeout: 5000 });
} catch (e) {
  console.error('Execution stopped (expected once it hits DOM-heavy code):', e.message);
}

const wanted = ['INIT_INV', 'INIT_PAY', 'INIT_CP', 'INIT_RP', 'INIT_GPS', 'INIT_ATT', 'INIT_EXP', 'INIT_FR', 'MONTHLY', 'KPI'];
const outDir = path.join(__dirname, '..', 'db', 'seed');
fs.mkdirSync(outDir, { recursive: true });

const summary = {};
for (const name of wanted) {
  let json;
  try {
    json = vm.runInContext(`JSON.stringify(${name})`, sandbox);
  } catch (e) {
    summary[name] = 'MISSING (' + e.message + ')';
    continue;
  }
  if (json === undefined) {
    summary[name] = 'UNDEFINED';
    continue;
  }
  const value = JSON.parse(json);
  fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(value, null, 2), 'utf-8');
  summary[name] = Array.isArray(value) ? value.length : 'object';
}
console.log(JSON.stringify(summary, null, 2));
