const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fix = s => { s = String(s == null ? '' : s); try { return decodeURIComponent(escape(s)) } catch(e) { return s } };

const toSec = t => {
  if (t == null || t === '') return null;
  if (typeof t === 'number') return t < 1 ? Math.round(t * 86400) : null;
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = +m[1];
  const ap = m[4] && m[4].toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 3600 + +m[2] * 60 + +(m[3] || 0);
};

const T = (s, sec) => {
  if (s == null) return '';
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (sec ? ':' + String(Math.floor(x)).padStart(2, '0') : '') + ' ' + (h >= 12 ? 'PM' : 'AM');
};

const n1 = v => v == null || isNaN(v) ? '' : (Math.round(v * 10) / 10).toFixed(1);

// Formats minutes into "Xh Ym"
const fmtDuration = mins => {
  if (mins == null || isNaN(mins)) return '-';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

function hav(a, b, c, d) {
  const r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const skip = new Set('the and shop unit level cnr corner road rd street st drive dr avenue ave boulevard blvd highway hwy lane ln court ct place pl vic australia centre shopping'.split(' '));
const toks = s => fix(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !skip.has(w));

function addr(j, st) {
  const str = (fix(j['Street Address']) + ' ' + fix(j['POD address']) + ' ' + fix(j['Deliver To / Collect From Name'])).toLowerCase();
  const jt = new Set(toks(str));
  if (!jt.size) return 0;
  
  let h = 0;
  jt.forEach(w => { if (st.words.has(w)) h++; });
  
  let bonus = 0;
  if (str.includes('hospital') && st.loc.toLowerCase().includes('hospital')) bonus += 0.5;
  if (str.includes('coles') && st.loc.toLowerCase().includes('coles')) bonus += 0.5;
  if (str.includes('bunnings') && st.loc.toLowerCase().includes('bunnings')) bonus += 0.5;
  
  return (h / jt.size) + bonus;
}

function stops(P) {
  const out = [];
  let i = 0;
  while (i < P.length) {
    if (P[i].sp > 10) { i++; continue; }
    let s = i, e = i, miss = 0;
    for (let j = i + 1; j < P.length; j++) {
      if (P[j].sp <= 10 && hav(P[s].lat, P[s].lng, P[j].lat, P[j].lng) <= .3) { e = j; miss = 0; }
      else if (++miss > 1) break;
    }
    if (e > s) out.push({ s, e, a: P[s].t, d: P[e].t, lat: P[s].lat, lng: P[s].lng, dlat: P[e].lat, dlng: P[e].lng });
    i = e + 1;
  }
  const m = [];
  for (const st of out) {
    const p = m[m.length - 1];
    if (p && st.a - p.d <= 180 && hav(p.dlat, p.dlng, st.lat, st.lng) <= .35) {
      p.e = st.e; p.d = st.d; p.dlat = st.dlat; p.dlng = st.dlng;
    } else m.push(st);
  }
  m.forEach(st => {
    const L = P.slice(st.s, st.e + 1).map(p => p.loc).filter(Boolean);
    st.words = new Set(L.flatMap(toks));
    const c = {};
    L.forEach(x => c[x] = (c[x] || 0) + 1);
    st.loc = Object.keys(c).sort((a, b) => c[b] - c[a])[0] || '';
  });
  return m;
}
