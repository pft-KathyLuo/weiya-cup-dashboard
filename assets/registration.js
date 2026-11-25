(function () {
  var POLL_MS = 60000;   // 每 60 秒自動更新
  var RETRY_MS = 5000;   // 失敗後 5 秒重試
  var JITTER_MS = 5000;  // 每個人錯開 0～5 秒，避免同一秒一起查詢

  var data = null, busy = false, timer = null;
  var $ = function (id) { return document.getElementById(id); };

  // 不帶 Google 登入資訊（credentials: 'omit'），所以多帳號登入也不會被導到 /u/1/ 而出錯
  function fetchJson(url) {
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      if (d && d.error) throw new Error(d.error);
      return d;
    });
  }

  function render() {
    var q = $('search').value.trim().toLowerCase();
    var teams = data.teams.filter(function (t) {
      return [t.p1, t.p2].map(function (p) {
        return [p.name, p.company, p.dept].join(' ');
      }).join(' ').toLowerCase().includes(q);
    });

    $('rows').replaceChildren();
    teams.forEach(function (t) {
      var tr = document.createElement('tr');
      var n = document.createElement('td');
      var badge = document.createElement('span');
      badge.className = 'order';
      badge.textContent = '#' + t.order;
      n.append(badge);
      tr.append(n);
      [t.p1, t.p2].forEach(function (p) {
        var td = document.createElement('td');
        var name = document.createElement('div');
        name.className = 'person';
        name.textContent = p.name;
        td.append(name);
        // 公司 · 部門（舊版 API 沒有這兩個欄位時就不顯示）
        var org = [p.company, p.dept].filter(Boolean).join(' · ');
        if (org) {
          var sub = document.createElement('div');
          sub.className = 'org';
          sub.textContent = org;
          td.append(sub);
        }
        tr.append(td);
      });
      $('rows').append(tr);
    });

    if (!teams.length) {
      var tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty';
      td.textContent = q ? '找不到符合的報名資料 No match' : '目前尚無完整報名資料 No teams yet';
      tr.append(td);
      $('rows').append(tr);
    }

    $('teamCount').textContent = data.teams.length;
    $('playerCount').textContent = data.teams.length * 2;
  }

  function accept(d) {
    data = d;
    render();
    $('message').style.display = 'none';
    $('sync').textContent = '● 已同步 Synced ' + new Date(d.checkedAt).toLocaleTimeString('zh-TW', { hour12: false });
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(refresh, ms + Math.random() * JITTER_MS);
  }

  function refresh() {
    if (busy) return;
    if (document.hidden) { schedule(POLL_MS); return; }
    busy = true;
    $('refresh').disabled = true;
    fetchJson(API_URL + '?api=registrations')
      .then(function (d) {
        busy = false;
        $('refresh').disabled = false;
        accept(d);
        schedule(POLL_MS);
      })
      .catch(function (e) {
        busy = false;
        $('refresh').disabled = false;
        $('message').textContent = '更新失敗，稍後會自動重試 Update failed, retrying soon（' + e.message + '）';
        $('message').style.display = 'block';
        $('sync').textContent = data ? '連線中斷，保留上次資料 Offline, showing last data' : '尚未取得報名資料 No data yet';
        schedule(RETRY_MS);
      });
  }

  $('search').oninput = function () { if (data) render(); };
  $('refresh').onclick = refresh;
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  refresh();
})();
