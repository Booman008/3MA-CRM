#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STAGE_COLORS = {
  New: '#1a2a47',
  Contacted: '#26416d',
  Qualified: '#c9a227',
  Proposal: '#a8841b',
  Won: '#2e8b57',
  Lost: '#b3261e',
  FireCraft: '#ff7043',
  'Not Pursuing': '#6b6b6b',
  'Closed/NA': '#616161',
  'Cannot Afford': '#795548',
};

function pill(stage) {
  const color = STAGE_COLORS[stage] || '#444';
  const dark = ['Qualified', 'Proposal', 'FireCraft'].includes(stage);
  const fg = dark ? '#1a2a47' : '#fff';
  return `<span class="pill" style="background:${color};color:${fg}">${esc(stage)}</span>`;
}

function renderStageBreakdown(breakdown) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([stage, n]) => {
      const pct = ((n / total) * 100).toFixed(1);
      return `
        <div class="stage-row">
          <div class="stage-label">${pill(stage)}</div>
          <div class="stage-bar"><div class="stage-fill" style="width:${pct}%;background:${STAGE_COLORS[stage] || '#444'}"></div></div>
          <div class="stage-count">${n} <span class="muted">(${pct}%)</span></div>
        </div>
      `;
    })
    .join('');
}

function renderGroupRow(group, idx) {
  const licenses = (group.licenseNumbers || []).map((n) => `<code>${esc(n)}</code>`).join(' ');
  const mixed = group.stageMixed
    ? `<span class="badge warn" title="CSV had mixed statuses: ${esc((group.stageOptions || []).join(' / '))}">mixed</span>`
    : '';
  const merged = group.licenseCount > 1
    ? `<span class="badge merged">${group.licenseCount}× merged</span>`
    : '';
  const reason = group.mergeReason && group.mergeReason !== 'individual'
    ? `<span class="muted small">via ${esc(group.mergeReason)}</span>`
    : '';
  const allNames = (group.businessNames || []).slice(0, 4).map(esc).join(', ');
  const moreNames = (group.businessNames || []).length > 4 ? `<span class="muted">+${group.businessNames.length - 4} more</span>` : '';
  return `
    <tr class="${idx % 2 ? 'odd' : ''}">
      <td>
        <div class="group-name">${esc(group.displayName)} ${merged} ${mixed}</div>
        <div class="muted small">${allNames}${moreNames ? ' ' + moreNames : ''}</div>
        ${reason}
      </td>
      <td>${pill(group.stage)}</td>
      <td class="center">${group.licenseCount}</td>
      <td>${licenses}</td>
      <td><span class="action ${esc(group.action)}">${esc(group.action)}</span></td>
    </tr>
  `;
}

function render(report) {
  const s = report.summary;
  const groups = [...report.groups].sort((a, b) => {
    if (b.licenseCount !== a.licenseCount) return b.licenseCount - a.licenseCount;
    return a.displayName.localeCompare(b.displayName);
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Lead Import Report — ${esc(report.generatedAt)}</title>
<style>
  :root {
    --navy:#1a2a47; --gold:#c9a227; --bg:#f7f7f8; --card:#fff;
    --border:#e3e5ea; --muted:#6b7280; --text:#1f2937;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.45}
  header{background:var(--navy);color:#fff;padding:24px 32px;border-bottom:4px solid var(--gold)}
  header h1{margin:0;font-size:22px;font-weight:600}
  header .sub{margin-top:6px;font-size:13px;opacity:.8}
  main{max-width:1200px;margin:0 auto;padding:24px 32px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:24px}
  .stat{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px 16px}
  .stat .label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
  .stat .value{font-size:24px;font-weight:600;margin-top:4px;color:var(--navy)}
  .stat.warn .value{color:#b3261e}
  .stat.ok .value{color:#2e8b57}
  .card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;margin-bottom:24px}
  .card h2{margin:0 0 16px;font-size:16px;color:var(--navy);border-bottom:1px solid var(--border);padding-bottom:10px}
  .stage-row{display:grid;grid-template-columns:140px 1fr 100px;gap:12px;align-items:center;margin-bottom:8px}
  .stage-bar{background:#eef0f4;border-radius:4px;height:10px;overflow:hidden}
  .stage-fill{height:100%}
  .stage-count{font-size:13px;text-align:right;font-variant-numeric:tabular-nums}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;padding:10px 12px;background:#f3f4f6;border-bottom:1px solid var(--border);color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0}
  td{padding:10px 12px;border-bottom:1px solid #eef0f4;vertical-align:top}
  tr.odd td{background:#fafbfc}
  td.center{text-align:center;font-variant-numeric:tabular-nums}
  code{background:#eef0f4;padding:1px 6px;border-radius:3px;font-size:11px;font-family:ui-monospace,Menlo,Consolas,monospace;margin:1px 2px;display:inline-block}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.02em}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-left:6px}
  .badge.merged{background:#fff4d6;color:#7a5a00;border:1px solid #ead9a0}
  .badge.warn{background:#fde2e1;color:#8a1f1c;border:1px solid #f2b8b6}
  .action{font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:4px}
  .action.create{background:#e6f3ec;color:#2e8b57}
  .action.update{background:#fff4d6;color:#7a5a00}
  .action.ambiguous{background:#fde2e1;color:#8a1f1c}
  .muted{color:var(--muted)}
  .small{font-size:11px}
  .group-name{font-weight:600;color:var(--navy)}
  .filter-bar{display:flex;gap:10px;margin-bottom:12px;align-items:center;flex-wrap:wrap}
  .filter-bar input{padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;min-width:240px}
  .filter-bar button{padding:6px 12px;border:1px solid var(--border);background:#fff;border-radius:6px;cursor:pointer;font-size:12px}
  .filter-bar button.active{background:var(--navy);color:#fff;border-color:var(--navy)}
  footer{text-align:center;color:var(--muted);font-size:11px;padding:20px}
</style>
</head>
<body>
<header>
  <h1>Lead Import Report</h1>
  <div class="sub">
    Mode: <strong>${esc(report.mode)}</strong> &middot;
    Source: <code>${esc(path.basename(report.file))}</code> &middot;
    Merge strategy: <strong>${esc(report.mergeBy)}</strong> &middot;
    Generated: ${esc(report.generatedAt)}
  </div>
</header>
<main>

<div class="grid">
  <div class="stat"><div class="label">CSV Rows</div><div class="value">${s.csvRowCount}</div></div>
  <div class="stat"><div class="label">Lead Groups</div><div class="value">${s.groupCount}</div></div>
  <div class="stat ok"><div class="label">Creates</div><div class="value">${s.creates}</div></div>
  <div class="stat"><div class="label">Updates</div><div class="value">${s.updates}</div></div>
  <div class="stat ${s.ambiguous ? 'warn' : ''}"><div class="label">Ambiguous</div><div class="value">${s.ambiguous}</div></div>
  <div class="stat"><div class="label">Multi-license</div><div class="value">${s.multiLicenseGroups}</div></div>
  <div class="stat ${s.mixedStageGroups ? 'warn' : ''}"><div class="label">Mixed Stage</div><div class="value">${s.mixedStageGroups}</div></div>
</div>

<div class="card">
  <h2>Stage Breakdown</h2>
  ${renderStageBreakdown(s.stageBreakdown)}
</div>

${s.unmappedStatuses && s.unmappedStatuses.length ? `
<div class="card" style="border-color:#f2b8b6;background:#fdf3f2">
  <h2>Unmapped Statuses</h2>
  <p class="small">These CSV statuses did not match any known mapping and defaulted to <strong>New</strong>:</p>
  <p>${s.unmappedStatuses.map((x) => `<code>${esc(x)}</code>`).join(' ')}</p>
</div>` : ''}

<div class="card">
  <h2>Groups (${groups.length}) — sorted by license count</h2>
  <div class="filter-bar">
    <input id="search" placeholder="Filter by name, license, county…" />
    <button data-stage="" class="active">All stages</button>
    ${Object.keys(s.stageBreakdown).map((stg) => `<button data-stage="${esc(stg)}">${esc(stg)}</button>`).join('')}
    <button id="only-merged">Multi-license only</button>
    <button id="only-mixed">Mixed-stage only</button>
  </div>
  <table id="groups">
    <thead>
      <tr><th>Group</th><th>Stage</th><th class="center">Licenses</th><th>License Numbers</th><th>Action</th></tr>
    </thead>
    <tbody>
      ${groups.map(renderGroupRow).join('')}
    </tbody>
  </table>
</div>

</main>
<footer>3MA CRM &middot; lead import report</footer>

<script>
(function(){
  const tbody = document.querySelector('#groups tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const search = document.getElementById('search');
  const stageButtons = document.querySelectorAll('button[data-stage]');
  const mergedBtn = document.getElementById('only-merged');
  const mixedBtn = document.getElementById('only-mixed');
  let stage = '';
  let mergedOnly = false;
  let mixedOnly = false;

  function apply() {
    const q = search.value.trim().toLowerCase();
    for (const row of rows) {
      const text = row.textContent.toLowerCase();
      const rowStage = row.querySelector('.pill')?.textContent || '';
      const isMerged = !!row.querySelector('.badge.merged');
      const isMixed = !!row.querySelector('.badge.warn');
      const match = (!q || text.includes(q))
        && (!stage || rowStage === stage)
        && (!mergedOnly || isMerged)
        && (!mixedOnly || isMixed);
      row.style.display = match ? '' : 'none';
    }
  }

  search.addEventListener('input', apply);
  stageButtons.forEach((b) => b.addEventListener('click', () => {
    stage = b.dataset.stage;
    stageButtons.forEach((x) => x.classList.toggle('active', x === b));
    apply();
  }));
  mergedBtn.addEventListener('click', () => { mergedOnly = !mergedOnly; mergedBtn.classList.toggle('active', mergedOnly); apply(); });
  mixedBtn.addEventListener('click', () => { mixedOnly = !mixedOnly; mixedBtn.classList.toggle('active', mixedOnly); apply(); });
})();
</script>
</body>
</html>`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    console.log('Usage: node scripts/render-lead-import-report.js <report.json> [output.html]');
    process.exit(argv.length === 0 ? 1 : 0);
  }
  const input = path.resolve(argv[0]);
  const output = argv[1] ? path.resolve(argv[1]) : input.replace(/\.json$/i, '.html');
  const report = JSON.parse(fs.readFileSync(input, 'utf8'));
  fs.writeFileSync(output, render(report), 'utf8');
  console.log(`HTML written to ${output}`);
}

main();
