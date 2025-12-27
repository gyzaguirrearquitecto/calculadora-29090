/* Calculadora 29090 – MVP (PWA). Catálogos y reglas editables en /catalog y /rules. */

const state = {
  catalogs: {},
  rules: {},
  licencias: [],
  filtered: []
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

function setTabs(){
  $all(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const tab = btn.dataset.tab;
      $all(".tab").forEach(b=>{ b.classList.toggle("active", b===btn); b.setAttribute("aria-selected", b===btn ? "true":"false"); });
      $all(".panel").forEach(p=>p.classList.remove("active"));
      $("#tab-"+tab).classList.add("active");
    });
  });
}

async function loadJSON(path){
  const res = await fetch(path, {cache:"no-cache"});
  if(!res.ok) throw new Error("No se pudo cargar: "+path);
  return await res.json();
}

function fillSelect(selectEl, items, {includeAll=false, allLabel="(Todos)"} = {}){
  selectEl.innerHTML = "";
  if(includeAll){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = allLabel;
    selectEl.appendChild(opt);
  }
  items.forEach(it=>{
    const opt = document.createElement("option");
    opt.value = it.code;
    opt.textContent = it.label;
    selectEl.appendChild(opt);
  });
}

function labelFrom(code, items){
  const it = items.find(x=>x.code===code);
  return it ? it.label : code || "";
}

function show(el, on){ el.classList.toggle("hidden", !on); }

function parseNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n){
  if(n===null || n===undefined) return "–";
  return new Intl.NumberFormat("es-PE", {style:"currency", currency:"PEN"}).format(n);
}

function calc(){
  const proc = $("#proc").value;
  const area = parseNum($("#area").value);
  const pisos = parseNum($("#pisos").value);
  const pres = parseNum($("#pres").value);

  let detail = {
    procedimiento: proc,
    procedimiento_label: labelFrom(proc, state.catalogs.procedimientos),
    tipo: null,
    tipo_label: null,
    valor_metodo: "–",
    warnings: [],
    outputs: []
  };

  if(proc==="ED-LIC"){
    const obra = $("#ed-obra").value;
    detail.tipo = obra;
    detail.tipo_label = labelFrom(obra, state.catalogs.edificacion_tipos_obra);
    detail.valor_metodo = state.rules.edificacion?.[obra]?.valor_metodo || "–";

    // Validaciones suaves
    if(["ED-REM","ED-REF","ED-ACO","ED-PUV"].includes(obra) && !pres){
      detail.warnings.push("Para este tipo de obra, el valor se sustenta en presupuesto estimado. Ingrese un presupuesto referencial.");
    }
    if(["ED-NUE","ED-AMP","ED-DEM"].includes(obra) && !area){
      detail.warnings.push("Para este tipo de obra, se recomienda ingresar un área estimada para análisis preliminar.");
    }

    // Salidas (plantilla)
    detail.outputs.push({k:"Método de valor de obra (según FUE)", v: detail.valor_metodo});
    detail.outputs.push({k:"Parámetros faltantes para modalidad", v:"El MVP no infiere modalidad A–D sin datos adicionales (uso, ubicación, condiciones normativas, etc.)."});
  }
  else if(proc==="HU-LIC"){
    const tipoHU = $("#hu-tipo").value;
    detail.tipo = tipoHU;
    detail.tipo_label = labelFrom(tipoHU, state.catalogs.habilitacion_tipos);
    detail.valor_metodo = "No aplica (HU: dependerá del proyecto y costos de obras)";

    detail.outputs.push({k:"Tipo de HU", v: detail.tipo_label});
    detail.outputs.push({k:"Modalidad (plantilla)", v:"Requiere condiciones (área, afectaciones, plan vial, etc.). Completar en rules/rules.json."});
  }
  else{
    detail.outputs.push({k:"Estado", v:"Este procedimiento está incluido como categoría en el MVP. Completar reglas y checklist en la matriz de reglas."});
  }

  // Aporte de reporte
  const html = renderResult(detail, area, pisos, pres);
  $("#result").innerHTML = html;
  $("#btn-export").disabled = false;
  $("#btn-export").dataset.report = buildReportHTML(detail, area, pisos, pres);
}

function renderResult(detail, area, pisos, pres){
  const pills = [
    {k:"Procedimiento", v: detail.procedimiento_label},
    ...(detail.tipo_label ? [{k:"Tipo", v: detail.tipo_label}] : []),
    ...(area!==null ? [{k:"Área (m²)", v: area.toFixed(1)}] : []),
    ...(pisos!==null ? [{k:"Pisos", v: String(pisos)}] : []),
    ...(pres!==null ? [{k:"Presupuesto", v: formatMoney(pres)}] : [])
  ].map(p=>`<span class="pill"><strong>${p.k}:</strong> ${p.v}</span>`).join("");

  const warnings = (detail.warnings||[]).map(w=>`<div class="pill" style="border-color: rgba(255,107,107,0.55); background: rgba(255,107,107,0.12);"><strong>Atención:</strong> ${w}</div>`).join("");

  const outs = (detail.outputs||[]).map(o=>`<tr><td style="width: 44%; color: var(--muted)">${o.k}</td><td>${o.v}</td></tr>`).join("");

  return `
    <h3>Resultado preliminar</h3>
    <div>${pills}</div>
    ${warnings ? `<div style="margin-top:10px">${warnings}</div>` : ""}
    <div style="margin-top:12px" class="table-wrap">
      <table style="min-width: unset">
        <tbody>${outs}</tbody>
      </table>
    </div>
    <div class="muted" style="margin-top:10px; font-size:12px">
      Recomendación: completa la matriz de reglas (modalidad, evaluador, checklist) y enlaza a documentos oficiales.
    </div>
  `;
}

function buildReportHTML(detail, area, pisos, pres){
  const now = new Date();
  const safe = (s)=>String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const rows = [
    ["Procedimiento", detail.procedimiento_label],
    ...(detail.tipo_label ? [["Tipo", detail.tipo_label]] : []),
    ...(area!==null ? [["Área (m²)", area.toFixed(1)]] : []),
    ...(pisos!==null ? [["Pisos", String(pisos)]] : []),
    ...(pres!==null ? [["Presupuesto", formatMoney(pres)]] : []),
    ["Método (si aplica)", safe(detail.valor_metodo)]
  ];
  const outRows = (detail.outputs||[]).map(o=>`<tr><th>${safe(o.k)}</th><td>${safe(o.v)}</td></tr>`).join("");
  const warnRows = (detail.warnings||[]).map(w=>`<li>${safe(w)}</li>`).join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Reporte – Calculadora 29090</title>
<style>
  body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:24px; color:#0b1320}
  h1{margin:0 0 8px}
  .muted{color:#555}
  table{border-collapse:collapse; width:100%; margin-top:14px}
  th,td{border:1px solid #ddd; padding:10px; text-align:left; font-size:14px}
  th{background:#f6f8fb; width:40%}
  .box{border:1px solid #ddd; padding:12px; border-radius:12px; margin-top:12px}
</style>
</head>
<body>
  <h1>Reporte preliminar – Calculadora 29090 (MVP)</h1>
  <div class="muted">Generado: ${now.toLocaleString("es-PE")}</div>

  <div class="box">
    <strong>Entradas</strong>
    <table>
      <tbody>
        ${rows.map(r=>`<tr><th>${safe(r[0])}</th><td>${safe(r[1])}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>

  <div class="box">
    <strong>Salidas</strong>
    <table><tbody>${outRows}</tbody></table>
  </div>

  ${warnRows ? `<div class="box"><strong>Observaciones</strong><ul>${warnRows}</ul></div>` : ""}

  <div class="muted" style="margin-top:14px">
    Este reporte es una salida de apoyo. La determinación normativa final requiere verificación con el Reglamento vigente y el TUPA aplicable.
  </div>
</body></html>`;
}

function downloadText(filename, content, mime="text/plain"){
  const blob = new Blob([content], {type: mime});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function resetCalc(){
  $("#area").value = "";
  $("#pisos").value = "";
  $("#pres").value = "";
  $("#result").innerHTML = `<div class="muted">Selecciona un procedimiento y calcula para ver resultados.</div>`;
  $("#btn-export").disabled = true;
  $("#btn-export").dataset.report = "";
}

function onProcChange(){
  const proc = $("#proc").value;
  show($("#ed-block"), proc==="ED-LIC");
  show($("#hu-block"), proc==="HU-LIC");
}

async function loadLicenciasCSV(path){
  const res = await fetch(path, {cache:"no-cache"});
  if(!res.ok) throw new Error("No se pudo cargar CSV: "+path);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text){
  // CSV simple (sin comillas complejas) para MVP
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(",");
    const o = {};
    header.forEach((h,idx)=>o[h]=cols[idx] ?? "");
    rows.push(o);
  }
  return rows;
}

function unique(arr){ return [...new Set(arr.filter(x=>x!==undefined && x!==null))]; }

function setupFilters(){
  const ds = unique(state.licencias.map(r=>r.distrito)).sort();
  fillSelect($("#f-distrito"), ds.map(d=>({code:d,label:d})), {includeAll:true});
  const years = unique(state.licencias.map(r=>String(r.fecha||"").slice(0,4))).sort();
  fillSelect($("#f-anio"), years.map(y=>({code:y,label:y})), {includeAll:true});
  fillSelect($("#f-proc"), state.catalogs.procedimientos, {includeAll:true});
  fillSelect($("#f-modal"), state.catalogs.modalidades, {includeAll:true});
  const est = unique(state.licencias.map(r=>r.estado)).sort();
  fillSelect($("#f-estado"), est.map(e=>({code:e,label:e})), {includeAll:true});
}

function applyFilters(){
  const distrito = $("#f-distrito").value;
  const anio = $("#f-anio").value;
  const proc = $("#f-proc").value;
  const mod = $("#f-modal").value;
  const est = $("#f-estado").value;

  const filtered = state.licencias.filter(r=>{
    if(distrito && r.distrito!==distrito) return false;
    if(anio && String(r.fecha).slice(0,4)!==anio) return false;
    if(proc && r.procedimiento!==proc) return false;
    if(mod && r.modalidad!==mod) return false;
    if(est && r.estado!==est) return false;
    return true;
  });

  state.filtered = filtered;
  renderTable(filtered);
  renderKPIs(filtered);
  renderChart(filtered);
}

function renderKPIs(rows){
  $("#kpi-n").textContent = rows.length.toLocaleString("es-PE");
  const count = (s)=>rows.filter(r=>r.estado===s).length;
  $("#kpi-ap").textContent = count("Aprobada").toLocaleString("es-PE");
  $("#kpi-ev").textContent = count("En evaluación").toLocaleString("es-PE");
  $("#kpi-ob").textContent = count("Observada").toLocaleString("es-PE");
}

function renderTable(rows){
  const tbody = $("#tbl tbody");
  tbody.innerHTML = "";
  const max = 200; // límite visual
  rows.slice(0,max).forEach(r=>{
    const tr = document.createElement("tr");
    const tipo = r.procedimiento==="ED-LIC" ? labelFrom(r.tipo_obra_ed, state.catalogs.edificacion_tipos_obra) :
                 r.procedimiento==="HU-LIC" ? labelFrom(r.tipo_hu, state.catalogs.habilitacion_tipos) : "";
    const cells = [
      r.id, r.distrito, r.fecha, labelFrom(r.procedimiento, state.catalogs.procedimientos),
      tipo, r.modalidad, r.estado, r.area_m2, r.presupuesto_soles
    ];
    cells.forEach(c=>{
      const td = document.createElement("td");
      td.textContent = c ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function groupByMonth(rows){
  const map = new Map();
  rows.forEach(r=>{
    const m = String(r.fecha||"").slice(0,7); // YYYY-MM
    if(!m) return;
    map.set(m, (map.get(m)||0) + 1);
  });
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}

function renderChart(rows){
  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.parentElement.clientWidth - 4;
  const H = canvas.height = 140;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0,0,W,H);

  const data = groupByMonth(rows);
  if(data.length===0){
    ctx.fillStyle = "rgba(238,243,255,0.75)";
    ctx.font = "12px system-ui";
    ctx.fillText("Sin datos para graficar", 12, 22);
    return;
  }
  const values = data.map(d=>d[1]);
  const maxV = Math.max(...values, 1);
  const pad = 26;
  const bw = (W - pad*2) / data.length;
  const barW = Math.max(6, bw*0.70);

  // axes
  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.beginPath();
  ctx.moveTo(pad, H-pad);
  ctx.lineTo(W-pad, H-pad);
  ctx.stroke();

  data.forEach((d, i)=>{
    const v = d[1];
    const x = pad + i*bw + (bw-barW)/2;
    const h = (H - pad*2) * (v/maxV);
    const y = (H-pad) - h;

    ctx.fillStyle = "rgba(91,188,255,0.75)";
    ctx.fillRect(x, y, barW, h);

    // label (every 2-3 to reduce clutter)
    if(i % Math.ceil(data.length/10) === 0 || i===data.length-1){
      ctx.fillStyle = "rgba(238,243,255,0.75)";
      ctx.font = "10px system-ui";
      ctx.fillText(d[0].slice(2), x, H-10); // YY-MM
    }
  });

  ctx.fillStyle = "rgba(238,243,255,0.85)";
  ctx.font = "12px system-ui";
  ctx.fillText("Registros por mes", 12, 18);
}

function handleCSVUpload(){
  $("#file").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    const text = await f.text();
    try{
      state.licencias = parseCSV(text);
      setupFilters();
      applyFilters();
    }catch(err){
      alert("No se pudo leer el CSV. Verifica el formato y encabezados.");
      console.error(err);
    }
  });
}

function downloadTemplate(){
  const headers = ["id","distrito","fecha","procedimiento","tipo_obra_ed","tipo_hu","modalidad","estado","area_m2","presupuesto_soles"];
  const example = [
    ["LIM-202501-001","Lima Metropolitana","2025-01-01","ED-LIC","ED-NUE","","B","Aprobada","240.0","180000.00"],
    ["MIR-202501-002","Miraflores","2025-01-15","ED-LIC","ED-REM","","C","En evaluación","95.0","65000.00"],
    ["IND-202501-003","Independencia","2025-01-20","HU-LIC","","HU-VIV-CONV","B","Aprobada","",""]
  ];
  const csv = [headers.join(","), ...example.map(r=>r.join(","))].join("\n");
  downloadText("plantilla_licencias.csv", csv, "text/csv");
}

async function init(){
  setTabs();

  // Load catalogs + rules
  const [procedimientos, edObra, huTipos, modalidades, rules] = await Promise.all([
    loadJSON("catalog/procedimientos.json"),
    loadJSON("catalog/edificacion_tipos_obra.json"),
    loadJSON("catalog/habilitacion_tipos.json"),
    loadJSON("catalog/modalidades.json"),
    loadJSON("rules/rules.json")
  ]);
  state.catalogs = {procedimientos, edificacion_tipos_obra: edObra, habilitacion_tipos: huTipos, modalidades};
  state.rules = rules;

  fillSelect($("#proc"), procedimientos);
  fillSelect($("#ed-obra"), edObra);
  fillSelect($("#hu-tipo"), huTipos);

  $("#proc").addEventListener("change", onProcChange);
  onProcChange();

  $("#btn-calc").addEventListener("click", calc);
  $("#btn-reset").addEventListener("click", resetCalc);
  $("#btn-export").addEventListener("click", ()=>{
    const report = $("#btn-export").dataset.report;
    if(!report) return;
    downloadText("reporte_calculadora_29090.html", report, "text/html");
  });

  // Admin viewer
  $("#cat-proc").textContent = JSON.stringify(procedimientos, null, 2);
  $("#cat-ed").textContent = JSON.stringify(edObra, null, 2);
  $("#cat-hu").textContent = JSON.stringify(huTipos, null, 2);
  $("#cat-rules").textContent = JSON.stringify(rules, null, 2);

  // Observatorio
  state.licencias = await loadLicenciasCSV("data/licencias_sample.csv");
  setupFilters();
  ["#f-distrito","#f-anio","#f-proc","#f-modal","#f-estado"].forEach(id=>{
    $(id).addEventListener("change", applyFilters);
  });
  applyFilters();
  handleCSVUpload();

  $("#btn-download-template").addEventListener("click", downloadTemplate);

  // Service worker
  if("serviceWorker" in navigator){
    try{
      await navigator.serviceWorker.register("sw.js");
      $("#sw-status").textContent = "Listo para uso offline (PWA)";
    }catch(e){
      $("#sw-status").textContent = "No se pudo registrar modo offline";
      console.warn(e);
    }
  }
}

window.addEventListener("load", init);