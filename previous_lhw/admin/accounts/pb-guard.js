(function(){
  if (window.__pbGuardLoaded) return;
  window.__pbGuardLoaded = true;

  var HTML = '<span><b style="font-weight:800">팝빌 포인트가 모두 소진되어 전체 서비스의 문자 · 알림톡 · 팩스 발송이 정지되었습니다.</b><br>포인트를 충전해야 모든 관리업체의 관리비 고지와 공지 발송이 재개됩니다. <a href="../points/points.dc.html" style="color:#8E1A1A;font-weight:800">포인트 충전하기</a></span>';

  function read(){
    try {
      var j = JSON.parse(localStorage.getItem('hq_pb') || 'null');
      return (j && typeof j.left === 'number') ? j.left : null;
    } catch (e) { return null; }
  }

  function apply(){
    var left = read(), off = (left !== null && left <= 0);
    var host = document.querySelector('.hf-body');
    var bar = document.getElementById('pbBar');
    if (!host) return;
    if (off) {
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'pbBar';
        bar.style.cssText = 'display:flex;align-items:flex-start;gap:9px;background:#FDECEC;border:1px solid #F3C5C5;border-radius:14px;padding:14px 16px;margin-bottom:14px;font-size:13.5px;font-weight:600;color:#A32020;line-height:1.6;flex:none';
        bar.innerHTML = HTML;
      }
      if (bar.parentNode !== host || host.firstChild !== bar) host.insertBefore(bar, host.firstChild);
    } else if (bar) bar.remove();
  }

  setInterval(apply, 1200);
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('focus', apply);
  window.addEventListener('storage', apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  apply();
})();
