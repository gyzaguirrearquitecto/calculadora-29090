// Small utilities, no dependencies.
function fmtMoney(n){
  if(n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat('es-PE', { style:'currency', currency:'PEN', maximumFractionDigits:2 }).format(n);
}
function fmtNum(n, digits=2){
  if(n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits:digits, maximumFractionDigits:digits }).format(n);
}
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function safeNumber(x, fallback=0){
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}
function groupBy(arr, keyFn){
  const out = new Map();
  for(const it of arr){
    const k = keyFn(it);
    if(!out.has(k)) out.set(k, []);
    out.get(k).push(it);
  }
  return out;
}
