(function(){
  if(window.ErpBulk) return;

  var D = null; // no example → 빈 칸

  var BUILDING = {
    id:'building', label:'건물 기본', file:'건물기본_일괄등록_양식', keyLabel:'건물 코드',
    cols:[
      {k:'건물 코드', req:true, uniq:true, ex:['001','002']},
      {k:'건물명', req:true, ex:['그린빌라','한빛상가']},
      {k:'건물 유형', ex:['빌딩','빌딩']},
      {k:'공동현관', ex:['*1234','']},
      {k:'주소', req:true, ex:['대전 유성구 봉명동 123-4','대전 중구 대흥동 200']},
      {k:'상세주소', ex:['','2층']},
      {k:'고지서 부과 그룹 유형', enm:['1','2','3','4','5'], ex:['1','1']},
      {k:'수도 고객번호 보유', enm:['1','2','3','4','5','6','7','8','10'], ex:['1','2']},
      {k:'계약일', date:true, ex:['2024-01-01','2023-05-01']},
      {k:'해지일', date:true, ex:['','']},
      {k:'사무 담당자', ex:['김관리','김관리']},
      {k:'현장 관리자', ex:['박검침','박검침']},
      {k:'적립금 유형', enm:['장기수선충당금','기타','없음'], ex:['장기수선충당금','없음']},
      {k:'적립금 메모', ex:['','']},
      {k:'건물주명', ex:['박상숙','유병옥']},
      {k:'건물주 전화번호(주)', tel:true, ex:['010-1234-5678','010-2222-3333']},
      {k:'건물주 전화번호(부)', tel:true, ex:['','042-822-4410']},
      {k:'건물주 주소', ex:['','']},
      {k:'건물주 비고', ex:['','']},
      {k:'가스회사', ex:['충남도시가스','']},
      {k:'가스전화', tel:true, ex:['042-330-1000','']},
      {k:'가스 계좌번호', ex:['','']},
      {k:'부과시 참조사항', ex:['','']},
      {k:'건물 메모', ex:['','']}
    ]
  };

  var VCAT = {
    '청소 업체':'cleaning', '정화조 업체':'septic', '인터넷 업체':'internet', '전기안전업체':'electric',
    '승강기보수업체':'elevfix', '승강기정기검사업체':'elevinsp',
    '소방검사업체':'fire', 'CCTV 업체':'cctv'
  };
  function vendorMaster(){
    var cfg = null; try{ cfg = JSON.parse(localStorage.getItem('vendor_cfg4')||'null'); }catch(_){}
    var out = {};
    ((cfg && cfg.vendors) || []).forEach(function(v){
      var nm = v.data && v.data['업체명']; if(!nm) return;
      (out[v.cat] = out[v.cat] || []).push(String(nm).trim());
    });
    return out;
  }

  var VENDOR = {
    id:'vendor', label:'협력업체', file:'건물협력업체_일괄등록_양식', keyLabel:'건물 코드 + 업체 구분',
    uniqBy:['건물 코드','업체 구분'],
    note:'업체명은 거래처 관리에 등록된 업체 중에서 골라 적어 주세요. 전화번호·계좌번호는 거래처 정보에서 자동으로 가져옵니다. 해당 구분에 없는 열은 비워 두세요.',
    xref: function(rec){
      var cat = VCAT[rec['업체 구분']]; if(!cat) return null;
      var nm = rec['업체명']; if(!nm) return null;
      var list = vendorMaster()[cat] || [];
      if(list.indexOf(nm) < 0) return { col:'업체명', msg:'거래처 관리에 없는 업체' };
      return null;
    },
    cols:[
      {k:'건물 코드', req:true, ex:['001','001']},
      {k:'업체 구분', req:true, enm:['청소 업체','승강기보수업체','CCTV 업체','인터넷 업체','소방검사업체','정화조 업체','전기안전업체','승강기정기검사업체'], ex:['청소 업체','정화조 업체']},
      {k:'업체명', req:true, ex:['깨끗한청소','맑음환경']},
      {k:'청소 횟수', num:true, ex:['4','']},
      {k:'청소 요일', ex:['월,목','']},
      {k:'청소 금액', num:true, ex:['180000','']},
      {k:'정화조 구분', ex:['','분할']},
      {k:'정화조 날짜', date:true, ex:['','2026-04-10']},
      {k:'정화조 금액', num:true, ex:['','57260']},
      {k:'정화조 용량', ex:['','30인용']},
      {k:'고객번호', ex:['','']},
      {k:'인터넷 전화', ex:['','']},
      {k:'인터넷 금액', num:true, ex:['','']},
      {k:'출력', ex:['','']},
      {k:'납부일', ex:['','']},
      {k:'만료일', date:true, ex:['','']},
      {k:'관리 금액', num:true, ex:['','']},
      {k:'안전 구분', ex:['','']},
      {k:'승강기 금액', num:true, ex:['','']},
      {k:'승강기 구분', ex:['','']},
      {k:'설치일', date:true, ex:['','']},
      {k:'계약일', date:true, ex:['','']},
      {k:'계약일자', date:true, ex:['','']},
      {k:'검사일', date:true, ex:['','']},
      {k:'검사 금액', num:true, ex:['','']},
      {k:'안전관리', ex:['','']},
      {k:'선임일', date:true, ex:['','']},
      {k:'선임일자', date:true, ex:['','']},
      {k:'일련번호', ex:['','']},
      {k:'고유번호', ex:['','']},
      {k:'운행층', ex:['','']},
      {k:'비상통화', ex:['','']},
      {k:'담당자', ex:['','']},
      {k:'담당', ex:['','']},
      {k:'보고일자', date:true, ex:['','']},
      {k:'카메라 대수', num:true, ex:['','']},
      {k:'녹화 보관일수', num:true, ex:['','']},
      {k:'비고', ex:['','']}
    ]
  };

  var UTIL = {
    id:'util', label:'공과금 정보', file:'건물공과금정보_일괄등록_양식', keyLabel:'건물 코드 + 구분 + 고객번호',
    uniqBy:['건물 코드','구분','고객번호'],
    note:'수도·공용 전기·전기·가스 정보를 한 행씩 작성해요. 고객번호가 여러 개면 행을 나눠 주세요.',
    cols:[
      {k:'건물 코드', req:true, ex:['001','001']},
      {k:'구분', req:true, enm:['수도 정보','공용 전기정보','전기 정보','가스 정보'], ex:['수도 정보','공용 전기정보']},
      {k:'고객번호', req:true, ex:['0002-1116','06-1446-1689']},
      {k:'성명/계약명', ex:['박상숙','유병옥']},
      {k:'입금', ex:['','']},
      {k:'월분', enm:['입금','보류'], ex:['입금','입금']},
      {k:'계산', ex:['전월','']},
      {k:'계산법', ex:['시조례','']},
      {k:'계산1', ex:['','전월']},
      {k:'계산2', ex:['','']},
      {k:'이체', ex:['','']},
      {k:'조회', ex:['','']},
      {k:'검침일', ex:['25일','20일']},
      {k:'고지기간', enm:['전월','전전월'], ex:['전월','전월']},
      {k:'고지기간 출력', enm:['Y','N'], ex:['N','N']},
      {k:'메모', ex:['','']}
    ]
  };

  var TENANT = {
    id:'tenant', label:'입주자', file:'입주자_일괄등록_양식', keyLabel:'건물 코드 + 호실',
    uniqBy:['건물 코드','호실'],
    cols:[
      {k:'건물 코드', req:true, ex:['001','001']},
      {k:'호실', req:true, ex:['101','102']},
      {k:'입주자명', req:true, ex:['홍길동','김수민']},
      {k:'입금자명', ex:['홍길동','']},
      {k:'룸', enm:['1.5룸','투룸','쓰리룸','기타'], ex:['투룸','1.5룸']},
      {k:'인원', num:true, ex:['2','1']},
      {k:'평형', ex:['18평','12평']},
      {k:'입주일', date:true, ex:['2024-03-01','2025-06-15']},
      {k:'입주예정일', date:true, ex:['','']},
      {k:'할인 유형', enm:['수급자할인','다자녀할인','기타할인'], ex:['','']},
      {k:'할인 금액', num:true, ex:['','']},
      {k:'기타적요', ex:['','']},
      {k:'이사정산시적요', ex:['','']},
      {k:'전화번호', req:true, tel:true, ex:['010-1234-5678','010-8888-1234']},
      {k:'차량번호', ex:['12가 3456','']},
      {k:'문자 수신', ex:['','거부']},
      {k:'알림톡 수신', ex:['','']},
      {k:'홈피 비번', ex:['','']},
      {k:'관리비', num:true, ex:['120000','70000']},
      {k:'이사청소', num:true, ex:['70000','']},
      {k:'인상액', num:true, ex:['0','0']},
      {k:'부과금 여부', ex:['','']},
      {k:'부과일', ex:['매월 1일','매월 1일']},
      {k:'이체 방식', enm:['이체','자동이체','입금','없음'], ex:['자동이체','입금']},
      {k:'효성 회원번호', ex:['00000000','']},
      {k:'계약번호', ex:['001','']},
      {k:'연체료 부과 여부', ex:['','']},
      {k:'단수 출력 여부', ex:['','']},
      {k:'부과시 참조사항', ex:['','']},
      {k:'수도 고객번호', ex:['0002-1116','0002-3345']},
      {k:'수도 계량기 번호', ex:['','']},
      {k:'전기 고객번호', ex:['0910-2234','']},
      {k:'전기 계량기 번호', ex:['','']},
      {k:'공용 전기 고객번호', ex:['','']},
      {k:'공용 전기 계량기 번호', ex:['','']},
      {k:'가스 고객번호', ex:['0530-1123','']},
      {k:'가스 계량기 번호', ex:['','']},
      {k:'한전고객번호', ex:['','']},
      {k:'한전계기번호', ex:['','']},
      {k:'고지서 출력 여부', ex:['','']},
      {k:'고지서 이름 출력 유형', enm:['이름 출력','코드번호 출력'], ex:['이름 출력','']},
      {k:'고지서 발송', ex:['우편','']},
      {k:'고지서 인증', ex:['','']},
      {k:'임대구분', ex:['전세','']},
      {k:'임대 개시일', date:true, ex:['2024-03-01','']},
      {k:'임대 만료일', date:true, ex:['2026-03-01','']},
      {k:'보증금', num:true, ex:['5000000','3000000']},
      {k:'보증금일', date:true, ex:['','']},
      {k:'임대료', num:true, ex:['450000','380000']},
      {k:'전세금', num:true, ex:['','']},
      {k:'은행/계좌', ex:['국민 123456-00-7890','']},
      {k:'물건명', ex:['','']},
      {k:'물건 주소', ex:['','']},
      {k:'물건구분', enm:['1.5룸','투룸','쓰리룸','기타'], ex:['','']},
      {k:'거래형태', enm:['중개거래','전세','전·월세'], ex:['','']},
      {k:'부동산 구분', ex:['','']},
      {k:'면적(㎡)', num:true, ex:['42.5','']},
      {k:'부동산 보증금', num:true, ex:['','']},
      {k:'부동산 전세금', num:true, ex:['','']},
      {k:'부동산 월세', num:true, ex:['','']},
      {k:'관리비 내용', ex:['','']},
      {k:'입주가능일', date:true, ex:['','']},
      {k:'위치', ex:['','']}
    ]
  };

  var VENDOR_MASTER = {
    id:'vendorMaster', label:'거래처', file:'거래처_일괄등록_양식', keyLabel:'구분 + 업체명',
    uniqBy:['구분','업체명'],
    note:'협력업체 매핑보다 먼저 올려야 해요. 여기 등록된 업체만 건물에 연결할 수 있습니다.',
    cols:[
      {k:'구분', req:true, enm:['청소 업체','승강기보수업체','CCTV 업체','인터넷 업체','소방검사업체','정화조 업체','전기안전업체','승강기정기검사업체'], ex:['청소 업체','정화조 업체']},
      {k:'업체명', req:true, ex:['깨끗한청소','맑음환경']},
      {k:'담당자', ex:['','']},
      {k:'전화번호', tel:true, ex:['02-700-1111','031-222-3333']},
      {k:'계좌번호', ex:['국민 111-111111','농협 222-222222']},
      {k:'비고', ex:['','']}
    ]
  };

  var FEEITEM = {
    id:'feeitem', label:'관리비 항목 단가', file:'관리비항목단가_일괄등록_양식', keyLabel:'건물 코드 + 호실 + 항목 명칭',
    uniqBy:['건물 코드','호실','항목 명칭'],
    note:'한 행이 세대 하나의 항목 하나예요. 항목 명칭은 관리비 항목 설정에 등록된 이름과 같아야 합니다.',
    cols:[
      {k:'건물 코드', req:true, ex:['001','001']},
      {k:'호실', req:true, ex:['101','101']},
      {k:'항목 명칭', req:true, ex:['일반관리비','승강기유지비']},
      {k:'금액', req:true, num:true, ex:['60000','5000']},
      {k:'반올림', ex:['','']},
      {k:'일자계산', ex:['','']},
      {k:'이월', ex:['','']},
      {k:'비고', ex:['','']}
    ]
  };

  var METER = {
    id:'meter', label:'검침 시작지침', file:'검침시작지침_일괄등록_양식', keyLabel:'건물 코드 + 호실 + 기준 년월',
    uniqBy:['건물 코드','호실','기준 년월'],
    note:'이관 직전 달의 지침만 넣으면 돼요. 금월 지침과 사용량은 서비스가 계산합니다.',
    cols:[
      {k:'건물 코드', req:true, ex:['001','001']},
      {k:'호실', req:true, ex:['101','102']},
      {k:'기준 년월', req:true, ym:true, ex:['2026-07','2026-07']},
      {k:'수도 전월지침', num:true, ex:['1284','980']},
      {k:'전기 전월지침', num:true, ex:['8842','7710']},
      {k:'가스 전월지침', num:true, ex:['452','388']},
      {k:'비고', ex:['','']}
    ]
  };

  var UNPAID = {
    id:'unpaid', label:'미납 잔액', file:'미납잔액_일괄등록_양식', keyLabel:'건물 코드 + 호실 + 기준 년월',
    uniqBy:['건물 코드','호실','기준 년월'],
    note:'이관 시점까지 밀려 있는 금액이에요. 월별로 나눠 적으면 미납대장에 그대로 반영됩니다.',
    cols:[
      {k:'건물 코드', req:true, ex:['001','001']},
      {k:'호실', req:true, ex:['103','205']},
      {k:'기준 년월', req:true, ym:true, ex:['2026-06','2026-07']},
      {k:'미납액', req:true, num:true, ex:['120000','86000']},
      {k:'연체료', num:true, ex:['3600','0']},
      {k:'비고', ex:['','']}
    ]
  };

  var GROUP = {
    vendorMaster: { title:'거래처 엑셀 일괄등록', kinds:[VENDOR_MASTER] },
    feeitem: { title:'관리비 항목 단가 엑셀 일괄등록', kinds:[FEEITEM] },
    meter: { title:'검침 시작지침 엑셀 일괄등록', kinds:[METER] },
    unpaid: { title:'미납 잔액 엑셀 일괄등록', kinds:[UNPAID] },
    building: { title:'건물 엑셀 일괄등록', kinds:[BUILDING, VENDOR, UTIL] },
    tenant:   { title:'입주자 엑셀 일괄등록', kinds:[TENANT] }
  };

  function csvCell(v){ v = v==null ? '' : String(v);
    return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }

  function download(name, rows){
    var csv = rows.map(function(r){ return r.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 300);
  }

  function parseCSV(text){
    text = String(text).replace(/^\ufeff/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    var rows=[], row=[], cell='', q=false;
    for(var i=0;i<text.length;i++){
      var c=text[i];
      if(q){ if(c==='"'){ if(text[i+1]==='"'){cell+='"';i++;} else q=false; } else cell+=c; }
      else if(c==='"') q=true;
      else if(c===','){ row.push(cell); cell=''; }
      else if(c==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
      else cell+=c;
    }
    if(cell!=='' || row.length){ row.push(cell); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(c){ return String(c).trim()!==''; }); });
  }

  var DATE = /^\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}$/;

  function validate(schema, rows){
    var head = rows[0].map(function(h){ return String(h).trim(); });
    var idx = {}; schema.cols.forEach(function(c){ idx[c.k] = head.indexOf(c.k); });
    var missing = schema.cols.filter(function(c){ return c.req && idx[c.k] < 0; }).map(function(c){ return c.k; });
    var body = rows.slice(1), seen = {}, out = [];
    body.forEach(function(r, n){
      var rec = {}, errs = [], bad = {};
      schema.cols.forEach(function(c){
        var v = idx[c.k] >= 0 ? String(r[idx[c.k]] == null ? '' : r[idx[c.k]]).trim() : '';
        rec[c.k] = v;
        if(c.req && !v){ errs.push(c.k+' 없음'); bad[c.k]=1; return; }
        if(!v) return;
        if(c.num && !/^-?[\d,]+(\.\d+)?$/.test(v)){ errs.push(c.k+' 숫자 아님'); bad[c.k]=1; }
        if(c.ym && !/^\d{4}[-.\/](0?[1-9]|1[0-2])$/.test(v)){ errs.push(c.k+' 년월형식(YYYY-MM)'); bad[c.k]=1; }
        if(c.date && !DATE.test(v)){ errs.push(c.k+' 날짜형식(YYYY-MM-DD)'); bad[c.k]=1; }
        if(c.tel && !/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(v.replace(/\s/g,''))){ errs.push(c.k+' 연락처형식'); bad[c.k]=1; }
        if(c.enm && c.enm.indexOf(v) < 0){ errs.push(c.k+'는 '+c.enm.join('/')+' 중 하나'); bad[c.k]=1; }
      });
      if(schema.xref && !errs.length){
        var x = schema.xref(rec);
        if(x){ errs.push(x.col+': '+x.msg); bad[x.col]=1; }
      }
      var keyCols = schema.uniqBy || schema.cols.filter(function(c){ return c.uniq; }).map(function(c){ return c.k; });
      if(keyCols.length){
        var key = keyCols.map(function(k){ return rec[k]; }).join('|');
        if(key.replace(/\|/g,'')){
          if(seen[key]){ errs.push('중복 ('+schema.keyLabel+')'); keyCols.forEach(function(k){ bad[k]=1; }); }
          else seen[key] = 1;
        }
      }
      out.push({ line: n + 2, rec: rec, errs: errs, bad: bad });
    });
    return { head: head, missing: missing, rows: out };
  }

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  window.ErpBulk = {
    open: function(groupKey, onDone){
      var group = GROUP[groupKey]; if(!group) return;
      var root = document.getElementById('buScrim'); if(!root) return;
      var $ = function(id){ return document.getElementById(id); };
      var schema = group.kinds[0], state = {};

      $('buTitle').textContent = group.title;
      $('buKinds').innerHTML = group.kinds.length > 1
        ? group.kinds.map(function(k,i){ return '<a class="'+(i?'':'on')+'" data-i="'+i+'">'+k.label+'</a>'; }).join('')
        : '';
      $('buKinds').style.display = group.kinds.length > 1 ? 'flex' : 'none';
      $('buKinds').onclick = function(e){
        var a = e.target.closest('a[data-i]'); if(!a) return;
        [].forEach.call(a.parentElement.children, function(x){ x.classList.toggle('on', x===a); });
        schema = group.kinds[+a.dataset.i]; syncKind(); step(1);
      };
      syncKind(); step(1);
      root.style.display = 'flex';

      function syncKind(){
        $('buKey').textContent = schema.keyLabel;
        $('buCount').textContent = schema.cols.length;
        $('buKindNote').style.display = schema.note ? 'block' : 'none';
        $('buKindNote').innerHTML = '';
        if(schema.note){
          $('buKindNote').textContent = schema.note;
          if(schema.id === 'vendor'){
            var M = vendorMaster(), names = [];
            Object.keys(VCAT).forEach(function(lb){ (M[VCAT[lb]]||[]).forEach(function(n){ names.push(lb+' · '+n); }); });
            if(names.length){
              var d = document.createElement('div');
              d.style.cssText = 'margin-top:8px;font-size:12px;font-weight:600;color:var(--t4);line-height:1.6';
              d.textContent = '등록된 업체: ' + names.join(' / ');
              $('buKindNote').appendChild(d);
            }
          }
        }
        $('buFile').value = '';
        $('buNote').style.display = 'none';
      }
      function step(n){
        [1,2,3].forEach(function(i){ $('buStep'+i).style.display = (i===n ? '' : 'none'); });
        $('buFoot1').style.display = (n===1 ? 'flex' : 'none');
        $('buFoot2').style.display = (n===2 ? 'flex' : 'none');
        $('buFoot3').style.display = (n===3 ? 'flex' : 'none');
      }
      function close(){ root.style.display = 'none'; $('buFile').value = ''; }

      $('buTpl').onclick = function(){
        var rows = [ schema.cols.map(function(c){ return c.k; }) ];
        for(var i=0;i<2;i++) rows.push(schema.cols.map(function(c){ return (c.ex && c.ex[i]) || ''; }));
        download(schema.file, rows);
      };
      $('buClose').onclick = close;
      $('buCancel').onclick = close;
      $('buDone').onclick = close;
      root.onclick = function(e){ if(e.target === root) close(); };
      $('buDrop').onclick = function(){ $('buFile').click(); };
      $('buAgain').onclick = function(){ $('buFile').value=''; step(1); };

      $('buDrop').ondragover = function(e){ e.preventDefault(); $('buDrop').classList.add('on'); };
      $('buDrop').ondragleave = function(){ $('buDrop').classList.remove('on'); };
      $('buDrop').ondrop = function(e){ e.preventDefault(); $('buDrop').classList.remove('on');
        if(e.dataTransfer.files && e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); };
      $('buFile').onchange = function(e){ if(e.target.files[0]) read(e.target.files[0]); };

      function warn(msg){ $('buNote').textContent = msg; $('buNote').style.display = 'block'; }

      function read(file){
        if(/\.xlsx?$/i.test(file.name)) return warn('엑셀 파일은 "다른 이름으로 저장 → CSV UTF-8"로 저장한 뒤 올려 주세요.');
        $('buNote').style.display = 'none';
        var fr = new FileReader();
        fr.onload = function(){
          var rows = parseCSV(String(fr.result));
          if(rows.length < 2) return warn('데이터 행이 없어요. 양식에 맞춰 작성했는지 확인해 주세요.');
          state.parsed = validate(schema, rows);
          state.fileName = file.name;
          preview();
        };
        fr.readAsText(file, 'utf-8');
      }

      function preview(){
        var P = state.parsed;
        var ok = P.rows.filter(function(r){ return !r.errs.length; }).length;
        var ng = P.rows.length - ok;
        $('buFname').textContent = state.fileName;
        $('buSum').innerHTML = schema.label + ' · 전체 <b>'+P.rows.length+'</b>행 · 정상 <b class="okc">'+ok+'</b> · 오류 <b class="ngc">'+ng+'</b>';
        $('buMissing').style.display = P.missing.length ? 'block' : 'none';
        if(P.missing.length) $('buMissing').textContent = '필수 열이 없습니다: ' + P.missing.join(', ');

        var cols = schema.cols.slice(0, 7);
        var th = '<th class="ln">행</th>' + cols.map(function(c){ return '<th>'+esc(c.k)+'</th>'; }).join('') + '<th class="er">검증</th>';
        var tb = P.rows.slice(0, 200).map(function(r){
          return '<tr class="'+(r.errs.length?'ng':'')+'"><td class="ln">'+r.line+'</td>'
            + cols.map(function(c){ return '<td class="'+(r.bad[c.k]?'bad':'')+'">'+esc(r.rec[c.k]||'—')+'</td>'; }).join('')
            + '<td class="er">'+(r.errs.length ? '<span class="ngc">'+esc(r.errs.join(', '))+'</span>' : '<span class="okc">정상</span>')+'</td></tr>';
        }).join('');
        $('buTbl').innerHTML = '<thead><tr>'+th+'</tr></thead><tbody>'+tb+'</tbody>';
        $('buMore').style.display = (P.rows.length > 200 || schema.cols.length > 7) ? 'block' : 'none';
        $('buMore').textContent = '앞 ' + Math.min(200, P.rows.length) + '행 · 앞 7개 열만 미리 봅니다 (전체 ' + P.rows.length + '행 · ' + schema.cols.length + '열)';

        var btn = $('buGo');
        btn.textContent = ok ? ok + '건 등록' : '등록할 행이 없어요';
        btn.classList.toggle('off', !ok || P.missing.length > 0);
        btn.onclick = function(){
          if(!ok || P.missing.length) return;
          $('buResT').textContent = schema.label + ' ' + ok + '건을 등록했어요';
          $('buResD').innerHTML = ng ? '오류 <b class="ngc">'+ng+'</b>건은 등록하지 않았어요. 오류 내역을 내려받아 수정 후 다시 올려 주세요.' : '모든 행이 정상 등록되었습니다.';
          $('buErrDl').style.display = ng ? '' : 'none';
          $('buErrDl').onclick = function(){
            var head = schema.cols.map(function(c){ return c.k; }).concat(['오류 사유']);
            var rows = [head].concat(P.rows.filter(function(r){ return r.errs.length; }).map(function(r){
              return schema.cols.map(function(c){ return r.rec[c.k]; }).concat([r.errs.join(' / ')]);
            }));
            download(schema.file + '_오류', rows);
          };
          step(3);
          if(typeof onDone === 'function') onDone(ok, ng);
        };
        step(2);
      }
    }
  };
})();
