const pct = v => v == null ? '-' : Math.round(v * 100) + '%';
const cls = t => t === 'On time' ? 'c-ok' : t === 'Late' ? 'c-late' : t === 'Not Delivered' || t === 'In Progress' ? 'c-late' : 'c-none';

function drawSum() {
  const sortIcon = (col) => {
    if (AppState.sortCol === col) return AppState.sortAsc ? ' ▲' : ' ▼';
    return '';
  };

  // Renamed 'Total Act. Travel' to 'Total Travel Time'
  let h = `<tr>
    <th style="cursor:pointer;" onclick="sortSum('d')">Driver${sortIcon('d')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('jobs')">Jobs${sortIcon('jobs')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('del')">Delivered${sortIcon('del')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('nd')">Not delivered${sortIcon('nd')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('km')">Km driven${sortIcon('km')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('nomatch')">No GPS match${sortIcon('nomatch')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('estOutputPerHour')">Est. Output / hr${sortIcon('estOutputPerHour')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('outsideWindow')">Outside window${sortIcon('outsideWindow')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('avgStopTime')">Avg stop (min)${sortIcon('avgStopTime')}</th>
    <th class="n" style="cursor:pointer;" onclick="sortSum('totalActTravel')">Total Travel Time${sortIcon('totalActTravel')}</th>
  </tr>`;
  
  const sortedRes = Object.values(AppState.res).sort((a, b) => {
    let valA = a[AppState.sortCol];
    let valB = b[AppState.sortCol];
    
    if (valA == null) return 1;
    if (valB == null) return -1;

    if (typeof valA === 'string') {
      return AppState.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return AppState.sortAsc ? valA - valB : valB - valA;
    }
  });

  for (const r of sortedRes) {
    h += `<tr class="pick${r.d === AppState.cur ? ' sel' : ''}" tabindex="0" data-d="${esc(r.d)}">
      <td><b>${esc(r.d)}</b>${r.hasGps ? '' : ' <span class="chip c-none">no GPS</span>'}</td>
      <td class="n">${r.jobs}</td>
      <td class="n">${r.del}</td>
      <td class="n">${r.nd}</td>
      <td class="n">${r.hasGps ? n1(r.km) : '-'}</td>
      <td class="n">${r.hasGps ? r.nomatch : r.jobs}</td>
      <td class="n">${n1(r.estOutputPerHour)}</td>
      <td class="n">${r.outsideWindow}</td>
      <td class="n">${n1(r.avgStopTime)}</td>
      <td class="n">${fmtDuration(r.totalActTravel)}</td>
    </tr>`;
  }
  $('#sum').innerHTML = h;
  
  $('#sum').querySelectorAll('tr.pick').forEach(tr => {
    const go = () => { AppState.cur = tr.dataset.d; drawSum(); drawDriver(); };
    tr.onclick = go;
    tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
}

function sortSum(col) {
  if (AppState.sortCol === col) {
    AppState.sortAsc = !AppState.sortAsc;
  } else {
    AppState.sortCol = col;
    AppState.sortAsc = true;
  }
  drawSum();
}

function drawDriver() {
  const r = AppState.res[AppState.cur];
  $('#dh').textContent = 'Run detail: ' + r.d;
  
  if (AppState.claimsData[AppState.cur] === undefined) AppState.claimsData[AppState.cur] = 0;

  // Changed Total Act. Travel to Total Travel Time and used fmtDuration
  $('#kp').innerHTML = `
    <div><b>${r.estStartTime ? T(r.estStartTime) : '-'}</b><span>Est. Start Time</span></div>
    <div><b>${r.estFinishTime ? T(r.estFinishTime) : '-'}</b><span>Est. Finish Time (CTA)</span></div>
    <div><b>${r.actualFinishTime ? T(r.actualFinishTime) : 'N/A'}</b><span>Actual Finish Time (CTA)</span></div>
    <div><b>${r.lastPodTime ? T(r.lastPodTime) : '-'}</b><span>Last Delivery POD</span></div>
    <div><b>${r.del}</b><span>Delivered</span></div>
    <div><b>${n1(r.estOutputPerHour)}</b><span>Est. Output / hr</span></div>
    <div><b>${r.outsideWindow}</b><span>Outside window</span></div>
    <div><b>${n1(r.avgStopTime)}</b><span>Avg stop (min)</span></div>
    <div><b>${fmtDuration(r.totalActTravel)}</b><span>Total Travel Time</span></div>
    <div style="background:var(--bg); padding:4px 8px; border-radius:4px; border:1px solid var(--line); display:flex; flex-direction:column; gap:4px;">
      <span>Claims/Damages</span>
      <input type="number" id="claimsInput" value="${AppState.claimsData[AppState.cur]}" style="width:100%; padding:4px; border-radius:4px; border:1px solid var(--line); background:var(--panel); color:var(--ink);" onchange="updateClaims(this.value)">
    </div>
  `;

  const span = (r.t1 - r.t0) || 1;
  $('#tl').innerHTML = (r.hasGps && r.t1 && r.t0) ? '<div class="tl">' + r.rows.filter(x => x.st && !x.shared && x.k !== 'depot').map(x => {
    const c = x.k === 'oth' ? 'none' : (x.outsideWindow ? 'late' : (x.status === 'Delivered' ? 'ok' : 'none'));
    return `<i class="${c}" style="left:${(x.a - r.t0) / span * 100}%;width:${Math.max(.3, (x.d - x.a) / span * 100)}%" title="${esc(x.name)} ${T(x.a)}-${T(x.d)}"></i>`;
  }).join('') + '</div>' : '<p class="msg">No valid GPS timeline for this driver.</p>';
  
  $('#t0').textContent = (r.hasGps && r.t0) ? T(r.t0) : '';
  $('#t1').textContent = (r.hasGps && r.t1) ? T(r.t1) : '';
  
  // Changed 'Act. travel (min)' to 'Travel time'
  let h = '<tr><th>Ref</th><th>Cafe name</th><th>Address</th><th>Arrival</th><th>Departure</th><th class="n">Stay (min)</th><th>POD</th><th class="n">Travel time</th><th class="n">Dist (km)</th><th>Status</th><th>Deliver by</th></tr>';
  
  for (const x of r.rows) {
    if (x.k === 'oth' && !x.st) continue; 

    let rowStyle = '';
    if (x.outsideWindow) rowStyle = 'background-color: rgba(248, 81, 73, 0.1);';
    if (x.k === 'depot') rowStyle = 'background-color: var(--bg); font-weight: bold;';

    h += `<tr class="${x.k === 'oth' ? 'oth' : ''}${x.shared ? ' sh' : ''}" style="${rowStyle}">
      <td>${esc(x.ref)}</td>
      <td class="w">${esc(x.name)}</td>
      <td class="w">${esc(x.addr)}</td>
      <td>${x.a ? T(x.a, 1) : (x.k === 'depot' ? '' : '<span class="chip c-amb">no match</span>')}</td>
      <td>${x.d ? T(x.d, 1) : ''}</td>
      <td class="n">${x.stay !== undefined ? n1(x.stay) : ''}</td>
      <td>${T(x.pod)}</td>
      <td class="n">${fmtDuration(x.act)}</td>
      <td class="n">${x.estKm ? n1(x.estKm) : ''}</td>
      <td>${x.k === 'job' ? `<span class="chip ${x.status === 'Delivered' ? 'c-ok' : 'c-late'}">${esc(x.status)}</span>` : `<span class="chip c-none">${esc(x.status)}</span>`}</td>
      <td>${T(x.by)}</td>
    </tr>`;
  }
  $('#runt').innerHTML = h;
}

function updateClaims(val) {
  AppState.claimsData[AppState.cur] = parseInt(val) || 0;
}

// --- Ingest ---
async function ingest(list) {
  const m = $('#loaded');
  m.className = 'msg';
  try {
    for (const f of list) {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      
      for (const n of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '' });
        if (!rows.length) continue;
        const k = Object.keys(rows[0]);
        
        if (k.includes('Reference') && k.includes('Assign to')) {
          rows.forEach(r => { AppState.jobs[r.Reference] = r; });
        } 
        else if (k.includes('Lat') && k.includes('Lng') && k.includes('Time')) {
          let nm = n.trim().toUpperCase();
          if (/^sheet\d*$/i.test(nm) || nm === '') {
            nm = f.name.replace(/\.[^.]+$/, '').toUpperCase();
          }
          
          AppState.tracks[nm] = (() => {
            const mk = k.find(x => /mileage|distance|odometer/i.test(x)), sk = k.find(x => /speed/i.test(x));
            const P = rows.map(r => ({
              loc: fix(r.Location), t: toSec(r.Time), lat: +r.Lat, lng: +r.Lng,
              sp: sk ? +r[sk] || 0 : 0, km: mk ? +r[mk] || 0 : 0
            })).filter(p => p.t != null && !isNaN(p.lat));
            
            const ks = P.map(p => p.km);
            if (P.length > 10 && ks.every((x, i) => i === 0 || x >= ks[i - 1]) && ks[ks.length - 1] > ks[0]) {
              P.forEach((p, i) => { p.km = i ? ks[i] - ks[i - 1] : 0; });
            }
            if (!P.some(p => p.km > 0)) {
              P.forEach((p, i) => { p.km = i ? hav(P[i - 1].lat, P[i - 1].lng, p.lat, p.lng) : 0; });
            }
            return P;
          })();
        }
      }
    }
    
    const sel = $('#linkRoute');
    const jobDrivers = [...new Set(Object.values(AppState.jobs).map(j => String(j['Assign to']).trim()).filter(Boolean))];
    const routeFiles = Object.keys(AppState.tracks);
    
    sel.innerHTML = '<option value="">Auto-match by name</option>';
    jobDrivers.forEach(d => {
      sel.innerHTML += `<option value="link-${esc(d)}">Link route to: ${esc(d)}</option>`;
    });
    
    const nj = Object.keys(AppState.jobs).length;
    m.textContent = `${nj} jobs loaded. ${routeFiles.length} GPS route(s) loaded.`;
    run();
  } catch (e) {
    m.className = 'msg err';
    m.textContent = 'Could not read a file: ' + e.message;
  }
}

$('#linkRoute').onchange = (e) => {
  const val = e.target.value;
  if (!val) return run();
  
  const driver = val.replace('link-', '');
  const routeFiles = Object.keys(AppState.tracks);
  if (routeFiles.length === 0) return;

  AppState.manualLinks[driver] = routeFiles[routeFiles.length - 1];
  run();
};

// --- Event Listeners ---
const drop = $('#drop'), inp = $('#file');
drop.onclick = () => inp.click();
drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } };
inp.onchange = () => ingest([...inp.files]);
['dragover', 'dragenter'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => ingest([...e.dataTransfer.files]));
$('#fac').onchange = $('#spd').onchange = run;

// --- Export ---
$('#exp').onclick = () => {
  const x = $('#xmsg');
  x.className = 'msg';
  
  const H = ['Ref Number', 'Cafe Name', 'Address', 'Arrival Time', 'Departure Time', 'Stay (min)', 'POD Time', 'Travel Time', 'Drive Dist (km)', 'Delivery Status', 'Deliver By', 'Outside Window'];
  const wb = XLSX.utils.book_new();
  
  const S = [['Driver', 'Est. Start Time', 'Est. Finish Time', 'Actual Finish Time', 'Last Delivery POD', 'Jobs', 'Delivered', 'Not delivered', 'Km driven', 'No GPS match', 'Est. Output per hr', 'Outside window', 'Avg stop time (min)', 'Total Travel Time', 'Claims/Damages']];
  Object.values(AppState.res).forEach(r => {
    S.push([
      r.d, 
      r.estStartTime ? T(r.estStartTime) : '',
      r.estFinishTime ? T(r.estFinishTime) : '',
      r.actualFinishTime ? T(r.actualFinishTime) : '',
      r.lastPodTime ? T(r.lastPodTime) : '',
      r.jobs, 
      r.del, 
      r.nd, 
      r.hasGps ? +n1(r.km) : '', 
      r.hasGps ? r.nomatch : r.jobs,
      +n1(r.estOutputPerHour),
      r.outsideWindow,
      +n1(r.avgStopTime),
      fmtDuration(r.totalActTravel),
      AppState.claimsData[r.d] || 0
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(S), 'Summary');
  
  Object.values(AppState.res).forEach(r => {
    const A = [H];
    r.rows.forEach(o => {
      if (o.k === 'oth' && !o.st) return;
      A.push([o.ref, o.name, o.addr, (o.a ? T(o.a, 1) : ''), (o.d ? T(o.d, 1) : ''), (o.stay !== undefined && o.stay !== null ? +n1(o.stay) : ''), T(o.pod), fmtDuration(o.act), o.estKm ? +n1(o.estKm) : '', o.status || '', T(o.by), o.outsideWindow ? 'Yes' : 'No']);
    });
    const ws = XLSX.utils.aoa_to_sheet(A);
    ws['!cols'] = [16, 34, 40, 12, 12, 9, 10, 10, 10, 14, 10, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, ('Run ' + r.d).slice(0, 31));
  });
  
  try {
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fleet-run-analysis.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    x.textContent = 'All drivers exported to one Excel file successfully.';
  } catch(e) {
    x.className = 'msg err';
    x.textContent = 'Export failed: ' + e.message;
  }
};
