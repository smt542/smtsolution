/* 관리비 부과 세팅 총 관리비 계산 (부과 세팅 / 서류 발행 공용)
   - 부과 세팅 화면의 gen() + rowTotal() 과 동일한 규칙
   - mf_vals(저장값)이 있으면 그 값을 우선 사용 */
(function () {
  if (window.ERP_MF) return;

  var UNITS = { '001': 24, '002': 36, '003': 48, '004': 30, '005': 42, '006': 18, '007': 54, '008': 16 };
  var BT = { '001': 'villa', '002': 'villa', '003': 'building', '004': 'villa', '005': 'building', '006': 'villa', '007': 'building', '008': 'villa' };
  var ROOM = ['원룸', '1.5룸', '투룸', '쓰리룸'];
  var NMS = ['한월웅', '강형찬', '김여진', '편상수', '전준한', '최영', '곽유진', '이다원', '황일순', '신유진'];
  var DEFAULT_ITEMS = [
    { name: '일반관리비', carry: 'yes' }, { name: '승강기유지비', carry: 'yes' },
    { name: '정화조', carry: 'yes' }, { name: '수리비', carry: 'no' }
  ];

  function ls(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }

  function items(code) {
    var cfg = ls('mf_config'), bt = BT[code] || 'villa';
    var list = (cfg && cfg.items && (cfg.items[bt] || cfg.items.villa || cfg.items[Object.keys(cfg.items)[0]])) || DEFAULT_ITEMS;
    return list.map(function (it, i) {
      return { k: 'i' + i, n: it.name, c: it.carry === 'yes' };
    });
  }

  function isFuture(y, m) { return (y * 12 + (m - 1)) >= (2026 * 12 + 7); }

  /* 부과 세팅 gen(b,false) 과 동일 */
  function gen(code, y, m) {
    var fut = isFuture(y, m);
    var base = parseInt(code, 10) || 1;
    var n = Math.min(UNITS[code] || 12, 14);
    var IT = items(code), out = [];
    for (var i = 0; i < n; i++) {
      var fl = 1 + Math.floor(i / 4), no = (fl * 100 + (i % 4) + 1) + '호';
      var s = base * 37 + i * 911;
      var recent = (s % 7 === 0), vac = (s % 13 === 0);
      var inDay = 1 + (s % 28);
      var vals = {};
      IT.forEach(function (it, k) { vals[it.k] = { on: !(s % 11 === 0 && k % 4 === 3), v: 0 }; });
      var zero = (vac && (s % 3 !== 0));
      out.push({
        no: no, nm: vac ? '' : NMS[(base + i) % NMS.length], vac: vac, room: ROOM[s % 4],
        uw: fut ? 0 : (zero ? 0 : 15000 + ((s * 7) % 9000)),
        ue: fut ? 0 : (zero ? 0 : 3000 + ((s * 11) % 20000)),
        ug: fut ? 0 : (zero ? 0 : 1000 + ((s * 5) % 4000)),
        inDate: recent ? '2026-07-' + String(inDay).padStart(2, '0')
          : '20' + (23 + (s % 3)) + '-' + String(1 + (s % 12)).padStart(2, '0') + '-' + String(1 + (s % 28)).padStart(2, '0'),
        recent: recent, vals: vals
      });
    }
    return out;
  }

  function parseD(v) {
    if (!v) return null;
    var p = String(v).replace(/-/g, '.').split('.');
    if (p.length < 3) return null;
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  /* 일자계산 기준(mf_basis) 기반 일할 */
  function proRate(code, y, m, row, it, val) {
    if (it.n !== '일반관리비' || !val) return val;
    var B = ls('mf_basis') || {}, v = B[code + '|' + y + '-' + m];
    if (!v || !v.a || !v.b) return val;
    var a = parseD(v.a), b = parseD(v.b);
    if (!a || !b || b < a) return val;
    var total = Math.round((b - a) / 86400000) + 1;
    var inD = parseD(row.inDate);
    if (!inD || inD <= a) return val;
    if (inD > b) return 0;
    var stay = Math.round((b - inD) / 86400000) + 1;
    return Math.round(val / total * stay / 10) * 10;
  }

  function rowTotal(code, y, m, row, IT) {
    var t = (row.uw || 0) + (row.ue || 0) + (row.ug || 0);
    IT.forEach(function (it) {
      var v = row.vals && row.vals[it.k];
      if (v && v.on) t += proRate(code, y, m, row, it, v.v || 0) || 0;
    });
    return t;
  }

  window.ERP_MF = {
    unitCount: function (code) { return UNITS[code] || 12; },
    /* 해당 건물·년월분 세대별 총 관리비 */
    units: function (code, y, m) {
      var IT = items(code);
      var rows = gen(code, y, m);
      var saved = (ls('mf_vals') || {})[code + '|' + y + '-' + m];
      if (Array.isArray(saved)) {
        var by = {};
        saved.forEach(function (x) { by[x.no] = x; });
        rows.forEach(function (r) {
          var x = by[r.no];
          if (!x) return;
          if (x.vals) r.vals = x.vals;
          if (x.nm) r.nm = x.nm;
          if (typeof x.tot === 'number') r.__tot = x.tot;
        });
      }
      return rows.map(function (r, i) {
        return {
          idx: i + 1, no: r.no, nm: r.nm || '', vac: !!r.vac,
          tot: (typeof r.__tot === 'number') ? r.__tot : rowTotal(code, y, m, r, IT)
        };
      });
    }
  };
})();
