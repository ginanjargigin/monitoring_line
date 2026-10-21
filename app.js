(() => {
  "use strict";
  const STORAGE_KEY = "lineMonitorData_v1";
  const $ = (id) => document.getElementById(id);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const initialState = () => ({
    lines: [
      {id:uid(), name:"D03B", model:"All", ctMin:2.55, standardTime:450},
      {id:uid(), name:"RR 1", model:"Manual", ctMin:1.117, standardTime:450}
    ],
    entries: {}
  });
  let state;
  let activeTable = "efficiency";
  let toastTimer;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.lines) || !parsed.entries || typeof parsed.entries !== "object") return initialState();
      parsed.lines = parsed.lines.filter(l => l && l.id && l.name).map(l => ({
        id:String(l.id), name:String(l.name), model:String(l.model || ""),
        ctMin:positive(l.ctMin, 1), standardTime:positive(l.standardTime, 450)
      }));
      if (!parsed.lines.length) parsed.lines = initialState().lines;
      return parsed;
    } catch (_) { return initialState(); }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch (_) { showToast("Penyimpanan gagal. Ruang browser mungkin penuh."); return false; }
  }
  function positive(value, fallback=0) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  function number(id) {
    const n = Number($(id).value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  function fmt(n, digits=1) {
    return Number(n || 0).toLocaleString("id-ID", {minimumFractionDigits:digits, maximumFractionDigits:digits});
  }
  function pct(n) { return `${fmt(n,1)}%`; }
  function currentLine(id) { return state.lines.find(l => l.id === id) || state.lines[0]; }
  function entryKey(date, lineId) { return `${date}__${lineId}`; }
  function getEntry(date, lineId) {
    return state.entries[entryKey(date,lineId)] || {workMinutes:450, actualPcs:0, targetPcs:0, downtimeMinutes:0, repairPcs:0};
  }
  function calc(line, entry) {
    const standardPcs = line && line.ctMin > 0 ? entry.workMinutes / line.ctMin : 0;
    const target = entry.targetPcs > 0 ? entry.targetPcs : standardPcs;
    return {
      standardPcs,
      target,
      efficiency: target > 0 ? entry.actualPcs / target * 100 : 0,
      downtime: line && line.standardTime > 0 ? entry.downtimeMinutes / line.standardTime * 100 : 0,
      repair: entry.actualPcs > 0 ? entry.repairPcs / entry.actualPcs * 100 : 0,
      ctSeconds: line && line.ctMin > 0 ? 60 / line.ctMin : 0
    };
  }
  function showToast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function renderLineSelects() {
    const options = state.lines.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join("");
    ["inputLine","dashboardLine"].forEach(id => {
      const el = $(id), previous = el.value;
      el.innerHTML = options || `<option value="">Belum ada line</option>`;
      if (state.lines.some(l => l.id === previous)) el.value = previous;
    });
  }
  function readForm() {
    return {
      workMinutes:number("workMinutes"), actualPcs:number("actualPcs"), targetPcs:number("targetPcs"),
      downtimeMinutes:number("downtimeMinutes"), repairPcs:number("repairPcs")
    };
  }
  function loadDailyForm() {
    const line = currentLine($("inputLine").value);
    if (!line) return;
    const entry = getEntry($("inputDate").value || today(), line.id);
    $("workMinutes").value = entry.workMinutes ?? 450;
    $("actualPcs").value = entry.actualPcs ?? 0;
    $("targetPcs").value = entry.targetPcs ?? 0;
    $("downtimeMinutes").value = entry.downtimeMinutes ?? 0;
    $("repairPcs").value = entry.repairPcs ?? 0;
    $("dateHint").textContent = state.entries[entryKey($("inputDate").value || today(), line.id)]
      ? "Data tersimpan ditemukan untuk tanggal dan line ini."
      : "Belum ada data tersimpan untuk tanggal dan line ini.";
    updatePreviews();
  }
  function updatePreviews() {
    const line = currentLine($("inputLine").value);
    if (!line) return;
    const e = readForm(), c = calc(line,e);
    $("standardPreview").textContent = `${fmt(c.standardPcs,1)} PCS`;
    $("efficiencyPreview").textContent = pct(c.efficiency);
    $("downtimePreview").textContent = pct(c.downtime);
    $("repairPreview").textContent = pct(c.repair);
  }
  function saveDaily(event) {
    event.preventDefault();
    const line = currentLine($("inputLine").value);
    const date = $("inputDate").value;
    if (!line || !date) return showToast("Pilih tanggal dan line terlebih dahulu.");
    const e = readForm();
    if (e.repairPcs > e.actualPcs) return showToast("PCS repair tidak boleh melebihi aktual produksi.");
    state.entries[entryKey(date,line.id)] = {...e, updatedAt:new Date().toISOString()};
    if (saveState()) {
      $("dateHint").textContent = "Data tersimpan untuk tanggal dan line ini.";
      renderDashboard(); showToast("Data berhasil disimpan.");
    }
  }
  function showView(name) {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active",v.id === `view-${name}`));
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active",b.dataset.view === name));
    if (name === "dashboard") renderDashboard();
    if (name === "settings") renderLineList();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function entriesForLine(lineId) {
    return Object.entries(state.entries)
      .filter(([key]) => key.endsWith(`__${lineId}`))
      .map(([key,e]) => ({date:key.slice(0,10), entry:e}))
      .sort((a,b) => b.date.localeCompare(a.date));
  }
  function renderDashboard() {
    const date = $("dashboardDate").value || today(), line = currentLine($("dashboardLine").value);
    if (!line) return;
    const e = getEntry(date,line.id), c = calc(line,e);
    $("kpiEfficiency").textContent = pct(c.efficiency);
    $("kpiProduction").textContent = `Aktual ${fmt(e.actualPcs,0)} / Standar ${fmt(c.target,1)}`;
    $("kpiDowntime").textContent = pct(c.downtime);
    $("kpiDowntimeDetail").textContent = `${fmt(e.downtimeMinutes,0)} menit`;
    $("kpiRepair").textContent = pct(c.repair);
    $("kpiRepairDetail").textContent = `${fmt(e.repairPcs,0)} PCS repair`;
    renderTable(line);
  }
  function renderTable(line) {
    const rows = entriesForLine(line.id);
    const heads = {
      efficiency:["Tanggal","Waktu (mnt)","Standard PCS","Aktual PCS","Efisiensi"],
      downtime:["Tanggal","Standar (mnt)","Downtime (mnt)","Downtime (%)"],
      repair:["Tanggal","Aktual PCS","Repair PCS","Repair Ratio"]
    };
    const title = {efficiency:"Tabel Efisiensi",downtime:"Tabel Downtime",repair:"Tabel Repair Ratio"};
    $("tableHeading").textContent = title[activeTable];
    $("tableCount").textContent = `${rows.length} data`;
    $("tableHead").innerHTML = `<tr>${heads[activeTable].map(h=>`<th>${h}</th>`).join("")}</tr>`;
    if (!rows.length) {
      $("tableBody").innerHTML = `<tr><td class="empty-cell" colspan="${heads[activeTable].length}">Belum ada data. Silakan isi menu Input.</td></tr>`;
      return;
    }
    $("tableBody").innerHTML = rows.map(({date,entry}) => {
      const c = calc(line,entry);
      let cells;
      if (activeTable === "efficiency") cells = [date,fmt(entry.workMinutes,0),fmt(c.target,1),fmt(entry.actualPcs,0),pct(c.efficiency)];
      else if (activeTable === "downtime") cells = [date,fmt(line.standardTime,0),fmt(entry.downtimeMinutes,0),pct(c.downtime)];
      else cells = [date,fmt(entry.actualPcs,0),fmt(entry.repairPcs,0),pct(c.repair)];
      return `<tr>${cells.map(v=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`;
    }).join("");
  }
  function renderLineList() {
    $("lineList").innerHTML = state.lines.map(l => `
      <div class="line-row">
        <div class="line-main"><strong>${escapeHtml(l.name)}${l.model ? ` · ${escapeHtml(l.model)}` : ""}</strong>
        <small>CT ${fmt(l.ctMin,3)} menit/PCS · ${fmt(60/l.ctMin,1)} detik/PCS · standar DT ${fmt(l.standardTime,0)} menit</small></div>
        <div class="line-actions"><button class="small-action" data-edit-line="${escapeHtml(l.id)}" type="button">Edit</button><button class="small-action delete" data-delete-line="${escapeHtml(l.id)}" type="button">Hapus</button></div>
      </div>`).join("") || `<p class="hint">Belum ada line. Tambahkan line menggunakan form di atas.</p>`;
  }
  function resetLineForm() {
    $("lineForm").reset(); $("lineId").value = ""; $("lineStandardTime").value = 450;
    $("saveLineBtn").textContent = "＋ Tambah Line"; $("cancelEditBtn").classList.add("hidden");
    $("ctSecondsPreview").textContent = "—";
  }
  function editLine(id) {
    const line = currentLine(id); if (!line) return;
    $("lineId").value = line.id; $("lineName").value = line.name; $("lineModel").value = line.model;
    $("lineCtMin").value = line.ctMin; $("lineStandardTime").value = line.standardTime;
    $("saveLineBtn").textContent = "Simpan Perubahan"; $("cancelEditBtn").classList.remove("hidden");
    updateCtPreview(); $("lineName").focus(); window.scrollTo({top:0,behavior:"smooth"});
  }
  function updateCtPreview() {
    const ct = Number($("lineCtMin").value);
    $("ctSecondsPreview").textContent = ct > 0 ? `${fmt(60/ct,2)} detik/PCS` : "—";
  }
  function saveLine(event) {
    event.preventDefault();
    const id = $("lineId").value;
    const name = $("lineName").value.trim();
    const model = $("lineModel").value.trim();
    const ctMin = Number($("lineCtMin").value);
    const standardTime = Number($("lineStandardTime").value);
    if (!name || !Number.isFinite(ctMin) || ctMin <= 0 || !Number.isFinite(standardTime) || standardTime <= 0) {
      return showToast("Isi nama line, CT, dan waktu standar dengan benar.");
    }
    if (state.lines.some(l => l.name.toLowerCase() === name.toLowerCase() && l.id !== id)) {
      return showToast("Nama line sudah digunakan.");
    }
    if (id) {
      const line = state.lines.find(l => l.id === id);
      if (line) Object.assign(line,{name,model,ctMin,standardTime});
    } else state.lines.push({id:uid(),name,model,ctMin,standardTime});
    saveState(); renderLineSelects(); renderLineList(); loadDailyForm(); renderDashboard(); resetLineForm();
    showToast(id ? "Line berhasil diperbarui." : "Line berhasil ditambahkan.");
  }
  function deleteLine(id) {
    const line = currentLine(id); if (!line) return;
    if (state.lines.length === 1) return showToast("Minimal harus ada satu line.");
    if (!confirm(`Hapus line "${line.name}" beserta semua data harian line ini?`)) return;
    state.lines = state.lines.filter(l => l.id !== id);
    Object.keys(state.entries).forEach(key => { if (key.endsWith(`__${id}`)) delete state.entries[key]; });
    saveState(); renderLineSelects(); renderLineList(); loadDailyForm(); renderDashboard();
    showToast("Line dan data terkait berhasil dihapus.");
  }
  function downloadFile(name, content, type) {
    const blob = new Blob([content],{type}), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function exportJson() {
    downloadFile(`line-monitor-backup-${today()}.json`,JSON.stringify(state,null,2),"application/json");
    showToast("Cadangan JSON dibuat.");
  }
  function exportCsv() {
    const rows = [["Tanggal","Line","Model","CT menit/PCS","CT detik/PCS","Waktu input menit","Standard PCS","Target PCS","Aktual PCS","Efisiensi %","Downtime menit","Downtime %","PCS repair","Repair ratio %"]];
    Object.entries(state.entries).forEach(([key,e]) => {
      const [date,lineId] = key.split("__"), line = currentLine(lineId);
      if (!line) return;
      const c = calc(line,e);
      rows.push([date,line.name,line.model,line.ctMin,c.ctSeconds,e.workMinutes,c.standardPcs,c.target,e.actualPcs,c.efficiency,e.downtimeMinutes,c.downtime,e.repairPcs,c.repair]);
    });
    const csv = rows.map(row=>row.map(v=>`"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    downloadFile(`line-monitor-${today()}.csv`,"\uFEFF"+csv,"text/csv;charset=utf-8");
    showToast("CSV berhasil diekspor.");
  }

  function init() {
    state = loadState();
    $("inputDate").value = today(); $("dashboardDate").value = today();
    renderLineSelects();
    $("inputLine").addEventListener("change",loadDailyForm);
    $("inputDate").addEventListener("change",loadDailyForm);
    $("dailyForm").addEventListener("submit",saveDaily);
    ["workMinutes","actualPcs","targetPcs","downtimeMinutes","repairPcs"].forEach(id => $(id).addEventListener("input",updatePreviews));
    $("clearFormBtn").addEventListener("click",() => {
      $("workMinutes").value = 450; $("actualPcs").value = 0; $("targetPcs").value = 0;
      $("downtimeMinutes").value = 0; $("repairPcs").value = 0; updatePreviews();
    });
    $("dashboardDate").addEventListener("change",renderDashboard);
    $("dashboardLine").addEventListener("change",renderDashboard);
    document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click",()=>showView(btn.dataset.view)));
    document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click",()=>{
      activeTable = btn.dataset.table;
      document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===btn));
      renderDashboard();
    }));
    $("lineForm").addEventListener("submit",saveLine);
    $("lineCtMin").addEventListener("input",updateCtPreview);
    $("cancelEditBtn").addEventListener("click",resetLineForm);
    $("lineList").addEventListener("click",event=>{
      const edit = event.target.closest("[data-edit-line]"), del = event.target.closest("[data-delete-line]");
      if (edit) editLine(edit.dataset.editLine);
      if (del) deleteLine(del.dataset.deleteLine);
    });
    $("downloadBackupBtn").addEventListener("click",exportJson);
    $("exportBtn").addEventListener("click",exportCsv);
    $("importFile").addEventListener("change",async event=>{
      const file = event.target.files?.[0]; if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed.lines) || !parsed.entries || typeof parsed.entries !== "object") throw new Error("Format tidak cocok");
        if (!confirm("Impor cadangan akan mengganti seluruh data lokal saat ini. Lanjutkan?")) return;
        state = parsed; saveState(); renderLineSelects(); renderLineList(); loadDailyForm(); renderDashboard(); showToast("Cadangan berhasil diimpor.");
      } catch (_) { showToast("File cadangan tidak valid."); }
      finally { event.target.value = ""; }
    });
    $("clearAllBtn").addEventListener("click",()=>{
      if (!confirm("Hapus semua data harian dan pengaturan line dari browser ini? Tindakan ini tidak bisa dibatalkan.")) return;
      state = {lines:[],entries:{}};
      // Keep the app usable after clearing: restore a blank default line for fresh entry.
      state.lines = [{id:uid(),name:"Line Baru",model:"",ctMin:1,standardTime:450}];
      saveState(); renderLineSelects(); renderLineList(); loadDailyForm(); renderDashboard(); showToast("Data lokal telah direset.");
    });
    loadDailyForm(); renderDashboard(); renderLineList();
  }
  init();
})();