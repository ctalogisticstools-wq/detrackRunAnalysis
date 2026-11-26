// SINGLE GLOBAL STATE OBJECT
const AppState = {
  jobs: {},
  tracks: {},
  res: {},
  cur: null,
  manualLinks: {},
  claimsData: {},
  sortCol: 'd',
  sortAsc: true
};

// Hardcoded Depot Information
const DEPOT_INFO = {
  name: 'CTA Logistics',
  address: '13/20 Blomberg Rd, Altona North VIC 3025',
  lat: -37.8347,
  lng: 144.8455
};

function analyse(d, f, v) {
  let trackKey = Object.keys(AppState.tracks).find(k => k === d || k.replace(/_/g, ' ').toUpperCase() === d.replace(/_/g, ' ').toUpperCase());
  if (AppState.manualLinks[d]) trackKey = AppState.manualLinks[d];
  
  const P = trackKey ? AppState.tracks[trackKey] : [];
  const S = P.length ? stops(P) : [];
  
  const js = Object.values(AppState.jobs).filter(j => String(j['Assign to'] || '').trim().toUpperCase() === d.toUpperCase());

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

  let pd = null, pl = 0, pg = 0, prev = -1;
  
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
      
      if (o.by != null) {
        o.outsideWindow = o.a > o.by;
      } else {
        o.outsideWindow = false;
      }

      if (it.si === prev) {
        o.shared = 1; o.act = 0; o.est = 0;
      } else {
        if (prev === -1) {
          o.estKm = hav(DEPOT_INFO.lat, DEPOT_INFO.lng, st.lat, st.lng) * f;
          o.act = null; 
        } else {
          o.act = pd == null ? null : (st.a - pd) / 60;
          o.estKm = pd == null ? null : hav(pl, pg, st.lat, st.lng) * f;
        }
        prev = it.si; pd = st.d; pl = st.dlat; pg = st.dlng;
      }
    }
    return o;
  });

  const J = rows.filter(r => r.k === 'job');
  const firstJob = J.length > 0 ? J[0] : null;
  const lastJobWithGps = [...J].reverse().find(r => r.st !== null);

  // EST START TIME
  let estStartTime = null;
  if (firstJob && firstJob.pod && firstJob.estKm) {
    const estTravelMins = (firstJob.estKm / v) * 60;
    estStartTime = firstJob.pod - (estTravelMins * 60);
  }

  // ACTUAL FINISH TIME
  let actualFinishTime = null;
  let endedAtCta = false;
  if (P.length > 0 && lastJobWithGps && lastJobWithGps.st) {
    const lastPing = P[P.length - 1];
    const distToDepot = hav(DEPOT_INFO.lat, DEPOT_INFO.lng, lastPing.lat, lastPing.lng);
    
    if (distToDepot <= 1.0) {
      endedAtCta = true;
      actualFinishTime = lastPing.t; 
    } else {
      for (let i = P.length - 1; i >= 0; i--) {
        if (P[i].t < lastJobWithGps.st.d) break;
        if (hav(DEPOT_INFO.lat, DEPOT_INFO.lng, P[i].lat, P[i].lng) <= 1.0) {
          endedAtCta = true;
          actualFinishTime = P[i].t;
          break;
        }
      }
    }
  }

  // EST FINISH TIME
  let estFinishTime = null;
  if (lastJobWithGps && lastJobWithGps.st) {
    const estReturnKm = hav(lastJobWithGps.st.dlat, lastJobWithGps.st.dlng, DEPOT_INFO.lat, DEPOT_INFO.lng) * f;
    const estReturnMins = (estReturnKm / v) * 60;
    estFinishTime = lastJobWithGps.st.d + (estReturnMins * 60);
  }

  // LAST DELIVERY POD
  let lastPodTime = null;
  if (J.length > 0) {
    if (endedAtCta && J.length > 1) {
      lastPodTime = J[J.length - 2].pod;
    } else {
      lastPodTime = J[J.length - 1].pod;
    }
  }

  // INSERT DEPOT ROW AT THE TOP
  if (P.length > 0) {
    const depotRow = {
      k: 'depot',
      ref: 'DEPOT',
      name: DEPOT_INFO.name,
      addr: DEPOT_INFO.address,
      status: 'Start',
      a: estStartTime ? estStartTime : P[0].t,
      d: estStartTime ? estStartTime : P[0].t, 
      stay: null,
      act: null,
      estKm: null,
      shared: false,
      outsideWindow: false
    };
    rows.unshift(depotRow);
  }

  const deliveredJobs = J.filter(r => r.status === 'Delivered');
  const outsideWindowCount = deliveredJobs.filter(r => r.outsideWindow).length;
  
  const uniqueStops = J.filter(r => r.st && !r.shared);
  let totalStayMins = 0;
  uniqueStops.forEach(r => { totalStayMins += r.stay; });
  const avgStopTime = uniqueStops.length > 0 ? (totalStayMins / uniqueStops.length) : 0;
  
  const driverHours = (P.length > 0) ? ((P[P.length-1].t - P[0].t) / 3600) : 0;
  const outputPerHour = driverHours > 0 ? (deliveredJobs.length / driverHours) : 0;

  let totalEstTravel = 0;
  let totalActTravel = 0;
  
  rows.forEach(r => { 
    if (r.act) totalActTravel += r.act;
  });
  
  // Est total hours now uses travel based on KM / Speed
  let totalEstKm = 0;
  rows.forEach(r => { if (r.estKm) totalEstKm += r.estKm; });
  totalEstTravel = (totalEstKm / v) * 60;
  
  const estTotalHours = (totalEstTravel / 60) + (totalStayMins / 60);
  const estOutputPerHour = estTotalHours > 0 ? (deliveredJobs.length / estTotalHours) : 0;

  return {
    d, rows,
    t0: P.length ? P[0].t : null, 
    t1: P.length ? P[P.length - 1].t : null,
    estStartTime, estFinishTime, actualFinishTime, lastPodTime,
    hasGps: !!P.length,
    jobs: J.length, del: deliveredJobs.length, nd: J.filter(r => r.status !== 'Delivered').length,
    km: P.reduce((x, p) => x + p.km, 0),
    nomatch: J.filter(r => !r.st).length,
    avgStopTime: avgStopTime,
    outsideWindow: outsideWindowCount,
    driverHours: driverHours,
    outputPerHour: outputPerHour,
    estOutputPerHour: estOutputPerHour,
    totalActTravel: totalActTravel
  };
}

function run() {
  const f = +$('#fac').value || 1.3, v = +$('#spd').value || 45;
  AppState.res = {};
  
  const jobDrivers = Object.values(AppState.jobs).map(j => String(j['Assign to'] || '').trim()).filter(Boolean);
  const uniqueDs = [...new Set(jobDrivers)];
  
  uniqueDs.forEach(d => { AppState.res[d] = analyse(d, f, v); });
  
  if (!Object.keys(AppState.res).length) { $('#out').classList.add('hide'); return; }
  if (!AppState.res[AppState.cur]) AppState.cur = Object.keys(AppState.res)[0];
  
  $('#out').classList.remove('hide');
  drawSum();
  drawDriver();
}
