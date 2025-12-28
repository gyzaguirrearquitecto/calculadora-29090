/* global fmtMoney, fmtNum, clamp, safeNumber, groupBy */
const STORAGE_KEY = "cvu_honorarios_app_v1";

const state = {
  datasets: null,
  cvu: null,
  honorarios: null,
  fases: null,
  tipos: null,
  cimentacion: null,
  selections: {}, // column -> category key
  phasesChecked: new Set(), // phase ids
};

async function loadJSON(path){
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return await res.json();
}

function buildTipoObraSelect(){
  const sel = document.getElementById("tipoObra");
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— Seleccionar —";
  sel.appendChild(opt0);

  for(const g of state.tipos.groups){
    const og = document.createElement("optgroup");
    og.label = `${g.group_code} ${g.group_name}`;
    for(const it of g.items){
      const o = document.createElement("option");
      o.value = it.code;
      o.textContent = `${it.code} ${it.name}`;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
}

function buildCimentacionSelects(){
  const soil = document.getElementById("soilProfile");
  const sys = document.getElementById("foundationSystem");
  soil.innerHTML = "";
  sys.innerHTML = "";

  for(const s of state.cimentacion.soil_profiles){
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name;
    soil.appendChild(o);
  }
  for(const s of state.cimentacion.foundation_systems){
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name;
    sys.appendChild(o);
  }
  soil.value = "S2";
  sys.value = "superficial";
  applyDefaultFoundationFactor();
}

function applyDefaultFoundationFactor(){
  const soil = document.getElementById("soilProfile").value;
  const sys = document.getElementById("foundationSystem").value;
  const row = state.cimentacion.default_matrix.find(r => r.soil === soil && r.system === sys);
  if(row){
    document.getElementById("foundationFactor").value = row.factor.toFixed(2);
  }
}

function setPreset(letter){
  if(letter === "custom") return;
  for(const col of state.cvu.columns){
    state.selections[col.id] = letter;
  }
}

function buildCVUTable(){
  const container = document.getElementById("cvuTable");
  container.innerHTML = "";

  const head1 = document.createElement("div");
  head1.className = "cvu-head";
  head1.textContent = "Partida";
  const head2 = document.createElement("div");
  head2.className = "cvu-head";
  head2.textContent = "Clase";
  const head3 = document.createElement("div");
  head3.className = "cvu-head";
  head3.textContent = "Detalle / Valor";
  container.appendChild(head1);
  container.appendChild(head2);
  container.appendChild(head3);

  for(const col of state.cvu.columns){
    const row = document.createElement("div");
    row.className = "cvu-row";

    const c1 = document.createElement("div");
    c1.className = "cvu-cell";
    c1.innerHTML = `<div class="top"><strong>${col.name}</strong><span class="badge">${col.group}</span></div>`;

    const c2 = document.createElement("div");
    c2.className = "cvu-cell";

    const select = document.createElement("select");
    select.dataset.col = col.id;
    for(const cat of state.cvu.categories){
      const o = document.createElement("option");
      o.value = cat.key;
      o.textContent = cat.key;
      select.appendChild(o);
    }
    select.value = state.selections[col.id] || "C";
    select.addEventListener("change", () => {
      state.selections[col.id] = select.value;
      document.getElementById("presetClase").value = "custom";
      recalcAll();
      autosave();
    });
    c2.appendChild(select);

    const c3 = document.createElement("div");
    c3.className = "cvu-cell";
    c3.id = `detail_${col.id}`;

    container.appendChild(c1);
    container.appendChild(c2);
    container.appendChild(c3);
  }
}

function getCategory(key){
  return state.cvu.categories.find(c => c.key === key) || null;
}

function computeVUBase(){
  // Sum selected values by column, applying official rule for A-in-c1 excluding c2.
  const selections = state.selections;
  let sum = 0;
  let details = [];
  const c1Key = selections["c1"];

  for(const col of state.cvu.columns){
    const key = selections[col.id] || "C";
    const cat = getCategory(key);
    if(!cat) continue;

    // rule: if c1 is A and we're at c2, ignore c2.
    if(col.id === "c2" && c1Key === "A"){
      details.push({col:col.id, ignored:true, value:0, reason:"Regla: A en c1 incluye techo (no sumar c2)."});
      continue;
    }

    const val = cat.values[col.id];
    const v = (val === null || val === undefined) ? 0 : Number(val);
    sum += v;
    details.push({col:col.id, ignored:false, value:v, desc:cat.descriptions[col.id] || "—", key});
  }
  return { vu: sum, details };
}

function computeVUFinal(){
  const base = computeVUBase();

  // Ajuste por cimentación (sobre c1, solo una porción)
  const factor = safeNumber(document.getElementById("foundationFactor").value, 1);
  const sharePct = clamp(safeNumber(document.getElementById("foundationShare").value, 35), 0, 100) / 100;

  // extraemos c1 value real de base.details
  const dC1 = base.details.find(d => d.col === "c1");
  const c1v = dC1 ? dC1.value : 0;

  const portion = c1v * sharePct;
  const c1Adjusted = (c1v - portion) + (portion * factor);
  const delta = c1Adjusted - c1v;

  let vuAdj = base.vu + delta;

  // Regla 5% desde 5to piso
  const pisos = safeNumber(document.getElementById("pisos").value, 1);
  const apply = document.getElementById("applyPiso5").value;
  const applyP5 = (apply === "on") ? true : (apply === "off" ? false : (pisos >= 5));
  if(applyP5){
    vuAdj *= 1.05;
  }

  return { vuFinal: vuAdj, vuBase: base.vu, baseDetails: base.details, deltaCimentacion: delta, applyP5 };
}

function updateDetailCells(baseDetails){
  for(const col of state.cvu.columns){
    const el = document.getElementById(`detail_${col.id}`);
    const key = state.selections[col.id] || "C";
    const cat = getCategory(key);
    const desc = cat?.descriptions?.[col.id] ?? "—";
    let val = cat?.values?.[col.id];
    if(val === null || val === undefined) val = 0;

    // show if ignored by rule
    const det = baseDetails.find(d => d.col === col.id);
    const ignored = det?.ignored;
    const reason = det?.reason;

    el.innerHTML = `
      <div class="top">
        <div><strong>${ignored ? "No se suma" : "Seleccionado"}</strong></div>
        <div class="badge">${key}</div>
      </div>
      <div class="desc">${ignored ? reason : desc}</div>
      <div class="value">${ignored ? fmtMoney(0) : fmtMoney(val)} / m²</div>
    `;
  }
}

function findHonorarioBand(area){
  const a = safeNumber(area, 0);
  for(const b of state.honorarios.bands){
    if(b.max_m2 === null){
      if(a >= b.min_m2) return b;
    }else{
      if(a >= b.min_m2 && a < b.max_m2) return b;
    }
  }
  // edge-case: if equals upper bound of a band, fall to the next band
  const last = state.honorarios.bands[state.honorarios.bands.length - 1];
  return last;
}

function buildPhaseList(){
  const list = document.getElementById("phaseList");
  list.innerHTML = "";

  const groups = groupBy(state.fases.phases, p => p.group);
  for(const [groupName, items] of groups.entries()){
    const wrap = document.createElement("div");
    wrap.className = "phase-group";
    const h = document.createElement("div");
    h.className = "phase-title";
    h.textContent = groupName;
    wrap.appendChild(h);

    for(const p of items){
      const row = document.createElement("div");
      row.className = "phase-item";
      const left = document.createElement("div");
      left.className = "phase-left";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.phasesChecked.has(p.id);
      cb.addEventListener("change", () => {
        if(cb.checked) state.phasesChecked.add(p.id);
        else state.phasesChecked.delete(p.id);
        recalcAll();
        autosave();
      });

      const name = document.createElement("div");
      name.className = "phase-name";
      name.textContent = p.name;

      left.appendChild(cb);
      left.appendChild(name);

      const right = document.createElement("div");
      right.className = "phase-pct";
      right.textContent = `${p.pct}%`;

      row.appendChild(left);
      row.appendChild(right);
      wrap.appendChild(row);
    }
    list.appendChild(wrap);
  }
}

function getInputs(){
  return {
    projectName: document.getElementById("projectName").value.trim(),
    tipoObra: document.getElementById("tipoObra").value,
    areaM2: safeNumber(document.getElementById("areaM2").value, 0),
    pisos: safeNumber(document.getElementById("pisos").value, 1),
    soilProfile: document.getElementById("soilProfile").value,
    foundationSystem: document.getElementById("foundationSystem").value,
    foundationFactor: safeNumber(document.getElementById("foundationFactor").value, 1),
    foundationShare: safeNumber(document.getElementById("foundationShare").value, 35),
    applyPiso5: document.getElementById("applyPiso5").value,
    complexityFactor: safeNumber(document.getElementById("complexityFactor").value, 1),
    costoBaseManual: safeNumber(document.getElementById("costoBaseManual").value, NaN),
    presetClase: document.getElementById("presetClase").value,
  };
}

function recalcAll(){
  const inputs = getInputs();

  const { vuBase, vuFinal, baseDetails, applyP5 } = computeVUFinal();

  updateDetailCells(baseDetails);

  document.getElementById("vuBase").textContent = `${fmtMoney(vuBase)} / m²`;
  document.getElementById("vuFinal").textContent = `${fmtMoney(vuFinal)} / m²${applyP5 ? "  (incluye +5%)" : ""}`;

  const costo = vuFinal * inputs.areaM2;
  document.getElementById("costoObra").textContent = fmtMoney(costo);

  // costo base para honorarios
  const costoBase = Number.isFinite(inputs.costoBaseManual) ? inputs.costoBaseManual : costo;
  document.getElementById("costoBaseManual").value = Number.isFinite(inputs.costoBaseManual) ? inputs.costoBaseManual : costo.toFixed(2);

  // honorarios
  const band = findHonorarioBand(inputs.areaM2);
  document.getElementById("honPct").value = `${fmtNum(band.pct, 2)}%`;
  document.getElementById("honBand").textContent = band.max_m2 === null
    ? `Más de ${fmtNum(band.min_m2,0)} m²`
    : `De ${fmtNum(band.min_m2,0)} a ${fmtNum(band.max_m2,0)} m²`;

  const hon = costoBase * (band.pct/100) * inputs.complexityFactor;
  document.getElementById("honTotal").textContent = fmtMoney(hon);

  // fases
  let pctSel = 0;
  for(const p of state.fases.phases){
    if(state.phasesChecked.has(p.id)) pctSel += p.pct;
  }
  const honSel = hon * (pctSel/100);
  document.getElementById("honSelected").textContent = fmtMoney(honSel);
  document.getElementById("pctSelected").textContent = `(${fmtNum(pctSel,0)}% del honorario total)`;
}

function makeProjectSnapshot(){
  const inputs = getInputs();
  return {
    app_version: "1.0.0",
    saved_at: new Date().toISOString(),
    inputs,
    selections: state.selections,
    phasesChecked: Array.from(state.phasesChecked),
  };
}

function loadSnapshot(snapshot){
  if(!snapshot) return;
  document.getElementById("projectName").value = snapshot.inputs?.projectName ?? "";
  document.getElementById("tipoObra").value = snapshot.inputs?.tipoObra ?? "";
  document.getElementById("areaM2").value = snapshot.inputs?.areaM2 ?? 100;
  document.getElementById("pisos").value = snapshot.inputs?.pisos ?? 2;
  document.getElementById("applyPiso5").value = snapshot.inputs?.applyPiso5 ?? "auto";
  document.getElementById("complexityFactor").value = snapshot.inputs?.complexityFactor ?? 1.0;
  document.getElementById("soilProfile").value = snapshot.inputs?.soilProfile ?? "S2";
  document.getElementById("foundationSystem").value = snapshot.inputs?.foundationSystem ?? "superficial";
  applyDefaultFoundationFactor();
  if(Number.isFinite(snapshot.inputs?.foundationFactor)) document.getElementById("foundationFactor").value = snapshot.inputs.foundationFactor;
  if(Number.isFinite(snapshot.inputs?.foundationShare)) document.getElementById("foundationShare").value = snapshot.inputs.foundationShare;
  if(snapshot.inputs?.costoBaseManual) document.getElementById("costoBaseManual").value = snapshot.inputs.costoBaseManual;

  state.selections = snapshot.selections || state.selections;
  state.phasesChecked = new Set(snapshot.phasesChecked || []);
}

function autosave(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeProjectSnapshot()));
    document.getElementById("saveStatus").textContent = `Guardado: ${new Date().toLocaleString('es-PE')}`;
  }catch(err){
    document.getElementById("saveStatus").textContent = "No se pudo guardar (storage).";
  }
}

function exportProject(){
  const data = makeProjectSnapshot();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proyecto_cvu_honorarios_${(data.inputs.projectName || "sin_nombre").replace(/\s+/g,"_").slice(0,40)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importProject(file){
  const txt = await file.text();
  const snap = JSON.parse(txt);
  loadSnapshot(snap);
  buildCVUTable();
  buildPhaseList();
  recalcAll();
  autosave();
}

function buildPrintableProposal(){
  const inputs = getInputs();
  const { vuBase, vuFinal } = computeVUFinal();
  const costo = vuFinal * inputs.areaM2;
  const band = findHonorarioBand(inputs.areaM2);
  const hon = safeNumber(document.getElementById("costoBaseManual").value, costo) * (band.pct/100) * inputs.complexityFactor;

  const tipoText = document.querySelector(`#tipoObra option[value="${inputs.tipoObra}"]`)?.textContent || "—";

  const selectedPhases = state.fases.phases.filter(p => state.phasesChecked.has(p.id));
  const pctSel = selectedPhases.reduce((a,p)=>a+p.pct,0);

  const rows = selectedPhases.map(p => `
    <tr>
      <td>${p.group}</td>
      <td>${p.name}</td>
      <td style="text-align:right">${p.pct}%</td>
      <td style="text-align:right">${fmtMoney(hon*(p.pct/100))}</td>
    </tr>
  `).join("");

  return `
  <html><head><meta charset="utf-8" />
  <title>Propuesta - Honorarios</title>
  <style>
    body{font-family: Arial, sans-serif; padding:24px; color:#111}
    h1{margin:0 0 6px 0}
    .muted{color:#555}
    .box{border:1px solid #ddd; border-radius:12px; padding:14px; margin:12px 0}
    table{width:100%; border-collapse:collapse}
    th,td{border-bottom:1px solid #eee; padding:8px; font-size:13px}
    th{text-align:left; background:#fafafa}
    .kpi{display:flex; gap:12px; flex-wrap:wrap}
    .kpi>div{flex:1; min-width:210px}
    .kpi .v{font-size:18px; font-weight:800}
  </style></head><body>
    <h1>Propuesta de Honorarios</h1>
    <div class="muted">Generada por la app CVU + Honorarios</div>

    <div class="box">
      <div><strong>Proyecto:</strong> ${inputs.projectName || "—"}</div>
      <div><strong>Tipo de obra:</strong> ${tipoText}</div>
      <div><strong>Área techada:</strong> ${fmtNum(inputs.areaM2,2)} m² · <strong>Pisos:</strong> ${fmtNum(inputs.pisos,0)}</div>
    </div>

    <div class="box kpi">
      <div>
        <div class="muted">VU base</div>
        <div class="v">${fmtMoney(vuBase)} / m²</div>
      </div>
      <div>
        <div class="muted">VU final</div>
        <div class="v">${fmtMoney(vuFinal)} / m²</div>
      </div>
      <div>
        <div class="muted">Costo estimado de obra</div>
        <div class="v">${fmtMoney(costo)}</div>
      </div>
    </div>

    <div class="box kpi">
      <div>
        <div class="muted">% honorarios (por área)</div>
        <div class="v">${fmtNum(band.pct,2)}%</div>
        <div class="muted" style="font-size:12px">${band.max_m2 === null ? `Más de ${fmtNum(band.min_m2,0)} m²` : `De ${fmtNum(band.min_m2,0)} a ${fmtNum(band.max_m2,0)} m²`}</div>
      </div>
      <div>
        <div class="muted">Factor complejidad</div>
        <div class="v">${fmtNum(inputs.complexityFactor,2)}</div>
      </div>
      <div>
        <div class="muted">Honorario total</div>
        <div class="v">${fmtMoney(hon)}</div>
      </div>
    </div>

    <div class="box">
      <h2 style="margin:0 0 8px 0; font-size:16px">Cobro por fases seleccionadas</h2>
      <div class="muted" style="margin-bottom:10px">Total seleccionado: ${fmtNum(pctSel,0)}% · ${fmtMoney(hon*(pctSel/100))}</div>
      <table>
        <thead>
          <tr><th>Fase</th><th>Entregable</th><th style="text-align:right">%</th><th style="text-align:right">Monto</th></tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4" class="muted">No hay fases seleccionadas.</td></tr>`}
        </tbody>
      </table>
      <p class="muted" style="font-size:12px; margin-top:10px">
        Nota: Los montos son referenciales. Ajusta con el alcance real (licencias, especialidades, supervisión, etc.).
      </p>
    </div>

    <script>window.print();</script>
  </body></html>
  `;
}

function printProposal(){
  const html = buildPrintableProposal();
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function attachListeners(){
  const ids = ["projectName","tipoObra","areaM2","pisos","applyPiso5","foundationFactor","foundationShare","costoBaseManual","complexityFactor"];
  for(const id of ids){
    document.getElementById(id).addEventListener("input", () => { recalcAll(); autosave(); });
    document.getElementById(id).addEventListener("change", () => { recalcAll(); autosave(); });
  }

  document.getElementById("soilProfile").addEventListener("change", () => { applyDefaultFoundationFactor(); recalcAll(); autosave(); });
  document.getElementById("foundationSystem").addEventListener("change", () => { applyDefaultFoundationFactor(); recalcAll(); autosave(); });

  document.getElementById("presetClase").addEventListener("change", (e) => {
    const v = e.target.value;
    if(v !== "custom"){
      setPreset(v);
      buildCVUTable();
      recalcAll();
      autosave();
    }
  });

  document.getElementById("btnSave").addEventListener("click", () => autosave());
  document.getElementById("btnReset").addEventListener("click", () => {
    if(!confirm("¿Restablecer el proyecto? Se perderán datos guardados en este navegador.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  document.getElementById("btnExport").addEventListener("click", exportProject);
  document.getElementById("fileImport").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    await importProject(f);
    e.target.value = "";
  });

  document.getElementById("btnPrint").addEventListener("click", printProposal);
  document.getElementById("btnProposal").addEventListener("click", printProposal);
}

async function init(){
  // Load data
  state.cvu = await loadJSON("./data/cvu_lima_callao_2025_12.json");
  state.honorarios = await loadJSON("./data/honorarios_por_area.json");
  state.fases = await loadJSON("./data/fases_cobro.json");
  state.tipos = await loadJSON("./data/tipos_obra.json");
  state.cimentacion = await loadJSON("./data/cimentacion_defaults.json");

  // dataset badge
  const badge = document.getElementById("datasetBadge");
  badge.textContent = `${state.cvu.title} · Vigencia ${state.cvu.valid_from} a ${state.cvu.valid_to}`;

  buildTipoObraSelect();
  buildCimentacionSelects();

  // default selections (preset C)
  setPreset("C");

  // load localStorage snapshot if present
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const snap = JSON.parse(raw);
      loadSnapshot(snap);
    }else{
      // default: selecciona todas las fases (100%)
      for(const p of state.fases.phases) state.phasesChecked.add(p.id);
    }
  }catch(_e){/* ignore */}

  buildCVUTable();
  buildPhaseList();
  attachListeners();

  // register SW (optional)
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }

  recalcAll();
  autosave();
}

init().catch(err => {
  console.error(err);
  alert("Error cargando datos de la app. Revisa que esté corriendo en un servidor (GitHub Pages o http.server).");
});
