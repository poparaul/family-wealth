/* merge.js — îmbinare în 3 direcții (bază / local / Drive), ca modificările făcute pe dispozitive
   diferite să se combine în loc să se suprascrie.
   - bază   = cum arăta fișierul la ultima sincronizare a acestui dispozitiv
   - local  = datele de pe acest dispozitiv
   - remote = fișierul din Google Drive
   Conturile se potrivesc după `id`; în cadrul unui cont se îmbină câmp cu câmp. Un conflict apare
   doar când același câmp al aceluiași cont a fost schimbat diferit pe ambele părți: câștigă varianta
   mai recentă (updated_at al contului, altfel data ultimei salvări a fișierului). */
(function (global) {
  'use strict';

  const COLLECTIONS = ['family_members', 'investment_accounts', 'grandparents_accounts', 'real_estate', 'children_savings', 'vehicles', 'goals', 'history', 'changelog'];
  // Colecții tehnice: fără updated_at și fără mesaj de conflict (istoricul lunar, jurnalul).
  const QUIET = ['history', 'changelog'];
  const STAMPED = COLLECTIONS.filter((c) => !QUIET.includes(c));

  /** JSON cu chei sortate — pentru comparații independente de ordinea cheilor. */
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  const eq = (a, b) => stable(a) === stable(b);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const time = (s) => Date.parse(s || '') || 0;

  /** Îmbină câmp cu câmp un obiect (cont, metadate). `localNewer` decide conflictele. */
  function mergeFields(b, l, r, localNewer, onConflict) {
    const out = {};
    const keys = new Set([...Object.keys(l || {}), ...Object.keys(r || {}), ...Object.keys(b || {})]);
    keys.forEach((k) => {
      if (k === 'updated_at') return;
      const bv = b ? b[k] : undefined, lv = l ? l[k] : undefined, rv = r ? r[k] : undefined;
      let v;
      if (eq(lv, rv)) v = lv;
      else if (b && eq(lv, bv)) v = rv;      // doar Drive-ul a schimbat câmpul
      else if (b && eq(rv, bv)) v = lv;      // doar local s-a schimbat
      else { v = localNewer ? lv : rv; if (onConflict) onConflict(k); }
      if (v !== undefined) out[k] = clone(v);
    });
    const ut = [l && l.updated_at, r && r.updated_at].filter(Boolean).sort().pop();
    if (ut) out.updated_at = ut;
    return out;
  }

  /** Îmbină o colecție de conturi după id. */
  function mergeList(name, bList, lList, rList, ctx) {
    const byId = (list) => new Map((list || []).filter((x) => x && x.id).map((x) => [x.id, x]));
    const B = byId(bList), L = byId(lList), R = byId(rList);
    const order = [];
    (rList || []).forEach((x) => x && x.id && order.push(x.id));
    (lList || []).forEach((x) => x && x.id && !R.has(x.id) && order.push(x.id));
    const out = [];
    order.forEach((id) => {
      const b = B.get(id), l = L.get(id), r = R.get(id);
      if (l && r) {
        if (eq(l, r)) { out.push(clone(l)); return; }
        if (b && eq(l, b)) { out.push(clone(r)); return; }
        if (b && eq(r, b)) { out.push(clone(l)); return; }
        const localNewer = recordNewer(l, r, ctx);
        const fields = [];
        out.push(mergeFields(ctx.hasBase ? b : null, l, r, localNewer, (k) => fields.push(k)));
        if (fields.length && !QUIET.includes(name)) ctx.conflicts.push({ collection: name, id, fields, kept: localNewer ? 'local' : 'remote' });
        return;
      }
      if (l) {               // lipsește din Drive
        if (!b) out.push(clone(l));                       // adăugat pe acest dispozitiv
        else if (!eq(l, b)) { out.push(clone(l)); if (!QUIET.includes(name)) ctx.conflicts.push({ collection: name, id, fields: ['(șters pe alt dispozitiv, modificat aici)'], kept: 'local' }); }
        // altfel: șters pe alt dispozitiv și neatins aici → rămâne șters
        return;
      }
      if (r) {               // lipsește local
        if (!b) out.push(clone(r));                       // adăugat pe alt dispozitiv
        else if (!eq(r, b)) { out.push(clone(r)); if (!QUIET.includes(name)) ctx.conflicts.push({ collection: name, id, fields: ['(șters aici, modificat pe alt dispozitiv)'], kept: 'remote' }); }
        // altfel: șters aici → rămâne șters
      }
    });
    return out;
  }

  function recordNewer(l, r, ctx) {
    const lt = time(l.updated_at), rt = time(r.updated_at);
    if (lt !== rt) return lt > rt;
    return ctx.localTime > ctx.remoteTime;
  }

  /**
   * @returns {{ data: object, conflicts: Array, changedLocal: boolean, changedRemote: boolean }}
   * Fără bază (prima sincronizare pe acest dispozitiv), se face reuniune: nimic nu se șterge.
   */
  function merge(base, local, remote) {
    const ctx = {
      hasBase: !!base,
      conflicts: [],
      localTime: time(local && local.metadata && local.metadata.last_updated),
      remoteTime: time(remote && remote.metadata && remote.metadata.last_updated)
    };
    const b = base || {};
    const out = {};
    COLLECTIONS.forEach((c) => {
      if (!(c in local) && !(c in remote)) return; // colecție inexistentă pe ambele părți (ex. date vechi)
      out[c] = mergeList(c, base ? b[c] : null, local[c], remote[c], ctx);
    });

    // metadate: cursuri valutare pe monedă, restul câmp cu câmp
    const bm = b.metadata || null, lm = local.metadata || {}, rm = remote.metadata || {};
    const localNewer = ctx.localTime > ctx.remoteTime;
    const meta = mergeFields(bm ? omit(bm, ['last_updated', 'exchange_rates']) : null, omit(lm, ['last_updated', 'exchange_rates']), omit(rm, ['last_updated', 'exchange_rates']), localNewer);
    meta.exchange_rates = mergeFields(bm ? bm.exchange_rates || {} : null, lm.exchange_rates || {}, rm.exchange_rates || {}, localNewer,
      (k) => ctx.conflicts.push({ collection: 'exchange_rates', id: k, fields: [k], kept: localNewer ? 'local' : 'remote' }));
    out.metadata = meta;

    // ghidul de urgență: instrucțiunile și lista de contacte, fiecare ca întreg
    const bg = b.emergency_guide || null, lg = local.emergency_guide || {}, rg = remote.emergency_guide || {};
    out.emergency_guide = mergeFields(base ? bg || {} : null, lg, rg, localNewer,
      (k) => ctx.conflicts.push({ collection: 'emergency_guide', id: k, fields: [k], kept: localNewer ? 'local' : 'remote' }));

    // alte chei de nivel superior necunoscute: păstrează-le
    Object.keys(remote).concat(Object.keys(local)).forEach((k) => {
      if (!(k in out)) out[k] = clone(k in local ? local[k] : remote[k]);
    });

    const changedRemote = !eq(stripTime(out), stripTime(remote));
    const changedLocal = !eq(stripTime(out), stripTime(local));
    const lastTimes = [lm.last_updated, rm.last_updated].filter(Boolean).sort();
    out.metadata.last_updated = changedRemote && changedLocal ? new Date().toISOString() : (changedRemote ? lm.last_updated : rm.last_updated) || lastTimes.pop() || new Date().toISOString();
    return { data: out, conflicts: ctx.conflicts, changedLocal, changedRemote };
  }

  function omit(o, keys) { const c = Object.assign({}, o); keys.forEach((k) => delete c[k]); return c; }
  function stripTime(d) { const c = Object.assign({}, d); c.metadata = omit(d.metadata || {}, ['last_updated']); return c; }

  /** Marchează cu updated_at conturile adăugate sau modificate între două stări (folosit la fiecare salvare). */
  function stampChanges(before, after, now) {
    const idx = new Map();
    STAMPED.forEach((c) => (before[c] || []).forEach((x) => x && x.id && idx.set(c + ':' + x.id, stable(omit(x, ['updated_at'])))));
    STAMPED.forEach((c) => (after[c] || []).forEach((x) => {
      if (!x || !x.id) return;
      if (idx.get(c + ':' + x.id) !== stable(omit(x, ['updated_at']))) x.updated_at = now;
    }));
  }

  global.FWMerge = { merge, stampChanges, stable, eq, COLLECTIONS };
})(typeof window !== 'undefined' ? window : globalThis);
