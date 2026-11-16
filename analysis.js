let jobs = {}, tracks = {}, res = {}, cur = null, manualLinks = {};

function analyse(d, f, v) {
  let trackKey = Object.keys(tracks).find(k => k === d || k.replace(/_/g, ' ').toUpperCase() === d.replace(/_/g, ' ').toUpperCase());
  if (manualLinks[d]) trackKey = manualLinks[d];
  
  const P = trackKey ? tracks[trackKey] : [];
  const S = P.length ? stops(P) : [];
  
  const js = Object.values(jobs).filter(j => String(j['Assign to'] || '').trim().toUpperCase() === d.toUpperCase());

  const items = js.map(j => {
    const p = toSec(j['POD Time']);
    let best = null, bs = 1e9;
    
    if (S.length > 0) {
      S.forEach((st, i) => {
        const ad = addr(j, st);
        if (ad > 0) {
          const gap = (p != null) ? ((p > st.a && p < st.d) ? 0 : Math.min(Math.abs(p - st.a), Math.abs(p - st.d))) : 0;
          const sc = (gap / 60) - (ad * 30);
          if (sc < bs) { bs = sc; best = i; }
        }
      });
    }
    return { j, p, si: best, k: 'job' };
  });

  const used = new Set(items.map(x => x.si));
  S.forEach((st, i) => { if (!used.has(i) && st.d - st.a >= 300) items.push({ si: i, k: 'oth', p: null }); });
  
  items.sort((x, y) => (x.si == null) - (y.si == null) || (x.si - y.si) || (x.k === 'oth') - (y.k === 'oth') || ((x.p || 0) - (y.p || 0)));

  let pd = P.length ? P[0].t : null, pl = P.length ? P[0].lat : 0, pg = P.length ? P[0].lng : 0, prev = -1;
  
  const rows = items.map(it => {
    const st = it.si != null ? S[it.si] : null, o = { k: it.k, st, pod: it.p };
    if (it.k === 'job') {
      const j = it.j;
      o.ref = j.Reference;
      o.name = fix(j['Deliver To / Collect From Name']).trim();
      o.addr = fix(j['Street Address']).replace(/\s+/g, ' ').trim();
      o.status = j.Status;
      o.by = toSec(j['Deliver By']);
    } else {
      o.ref = '-'; o.name = 'Stop with no matching job'; o.addr = st ? st.loc : ''; o.status = ''; o.by = null;
    }

    if (st) {
      o.a = st.a; o.d = st.d; o.stay = (st.d - st.a) / 60; o.gps = st.loc;
      if (it.si === prev) {
        o.shared = 1; o.act = 0; o.est = 0;
      } else {
        o.act = pd == null ? null : (st.a - pd) / 60;
        o.est = pd == null ? null : hav(pl, pg, st.lat, st.lng) * f / v * 60;
        o.estKm = pd == null ? null : hav(pl, pg, st.lat, st.lng) * f;
        prev = it.si; pd = st.d; pl = st.dlat; pg = st.dlng;
      }
    }
    return o;
  });

  const J = rows.filter(r => r.k === 'job');
  const M = J.filter(r => r.st && !r.shared);

  return {
    d, rows,
    t0: P.length ? P[0].t : null, t1: P.length ? P[P.length - 1].t : null,
    hasGps: !!P.length,
    jobs: J.length, del: J.filter(r => r.status === 'Delivered').length, nd: J.filter(r => r.status !== 'Delivered').length,
    km: P.reduce((x, p) => x + p.km, 0),
    nomatch: J.filter(r => !r.st).length
  };
}

function run() {
  const f = +$('#fac').value || 1.3, v = +$('#spd').value || 45;
  res = {};
  
  const jobDrivers = Object.values(jobs).map(j => String(j['Assign to'] || '').trim()).filter(Boolean);
  const uniqueDs = [...new Set(jobDrivers)];
  
  uniqueDs.forEach(d => { res[d] = analyse(d, f, v); });
  
  if (!Object.keys(res).length) { $('#out').classList.add('hide'); return; }
  if (!res[cur]) cur = Object.keys(res)[0];
  
  $('#out').classList.remove('hide');
  drawSum();
  drawDriver();
}