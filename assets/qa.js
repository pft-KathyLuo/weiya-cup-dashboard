// 問答頁：讀問答清單（每 60 秒更新）、送出匿名問題。
// 資料在 Apps Script：GET ?api=qa 讀清單，POST { action: 'ask' } 送問題。
(function () {
  var POLL_MS = 60000;   // 每 60 秒自動更新
  var RETRY_MS = 5000;   // 失敗後 5 秒重試
  var JITTER_MS = 5000;  // 每個人錯開 0～5 秒
  var COOLDOWN_MS = 10000; // 送出後 10 秒內不能再送
  var MAX_LEN = 300;

  var data = null, busy = false, timer = null, filter = 'all';
  var $ = function (id) { return document.getElementById(id); };

  // 不帶 Google 登入資訊（credentials: 'omit'），多帳號登入也不會出錯
  function request(url, opts) {
    opts = opts || {};
    opts.credentials = 'omit';
    opts.cache = 'no-store';
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      if (d && d.error) throw new Error(d.error);
      return d;
    });
  }

  // ---------- 清單 ----------

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // 文字裡的網址變成可以點的連結（其他都當純文字，不會執行 HTML）
  function linkify(parent, text) {
    var re = /https?:\/\/[^\s<>"']+/g, last = 0, m;
    while ((m = re.exec(text))) {
      parent.append(text.slice(last, m.index));
      var a = el('a', '', m[0]);
      a.href = m[0];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      parent.append(a);
      last = m.index + m[0].length;
    }
    parent.append(text.slice(last));
  }

  function when(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  function images(urls) {
    var box = el('div', 'images');
    urls.forEach(function (u) {
      var a = el('a');
      a.href = u;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      var img = el('img');
      img.src = u;
      img.alt = '回覆圖片 Answer image';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      // 不是圖片直連網址（例如圖床的分享頁）時，改成顯示連結
      img.onerror = function () {
        a.replaceChildren('圖片無法顯示，點這裡開啟 Open image');
        a.className = 'broken';
      };
      a.append(img);
      box.append(a);
    });
    return box;
  }

  function item(it) {
    var li = el('li', 'qa');
    var q = el('div', 'qrow');
    q.append(el('span', 'mark q', 'Q'), el('div', 'qtext', it.q));
    li.append(q);

    var meta = el('div', 'meta');
    if (it.at) meta.append(el('span', '', when(it.at)));
    if (!it.a && !it.images.length) meta.append(el('span', 'pending', '待回覆 Pending'));
    li.append(meta);

    if (it.a || it.images.length) {
      var ans = el('div', 'answer');
      if (it.a) {
        var row = el('div', 'qrow');
        var text = el('div', 'atext');
        linkify(text, it.a);
        row.append(el('span', 'mark a', 'A'), text);
        ans.append(row);
      }
      if (it.images.length) ans.append(images(it.images));
      li.append(ans);
    }
    return li;
  }

  function answered(it) { return !!(it.a || it.images.length); }

  function render() {
    var all = data.items;
    var shown = all.filter(function (it) {
      return filter === 'all' || (filter === 'answered') === answered(it);
    });

    $('nAll').textContent = all.length;
    $('nAnswered').textContent = all.filter(answered).length;
    $('nPending').textContent = all.length - all.filter(answered).length;

    var list = $('list');
    list.replaceChildren();
    shown.forEach(function (it) { list.append(item(it)); });
    if (!shown.length) {
      list.append(el('li', 'empty', all.length
        ? '這個分類目前沒有問題 Nothing here yet'
        : '還沒有人提問，來當第一個吧！ No questions yet. Be the first!'));
    }
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
    request(API_URL + '?api=qa')
      .then(function (d) {
        accept(d);
        schedule(POLL_MS);
      })
      .catch(function (e) {
        $('message').textContent = '更新失敗，稍後會自動重試 Update failed, retrying soon（' + e.message + '）';
        $('message').style.display = 'block';
        $('sync').textContent = data ? '連線中斷，保留上次資料 Offline, showing last data' : '尚未取得問答 No data yet';
        schedule(RETRY_MS);
      })
      .then(function () {
        busy = false;
        $('refresh').disabled = false;
      });
  }

  // ---------- 提問 ----------

  function status(text, kind) {
    var s = $('askStatus');
    s.textContent = text;
    s.className = 'askstatus' + (kind ? ' ' + kind : '');
  }

  function updateCount() {
    var n = $('question').value.trim().length;
    $('count').textContent = n;
    $('count').parentNode.classList.toggle('over', n > MAX_LEN);
  }

  $('askForm').onsubmit = function (e) {
    e.preventDefault();
    var form = e.target;
    var question = form.question.value.trim();
    if (question.length < 2) { status('問題太短了 Question is too short', 'err'); return; }

    $('send').disabled = true;
    status('送出中… Sending…');
    // text/plain：跨網域送出時不會觸發預檢（preflight），Apps Script 才收得到
    request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ask', question: question, website: form.website.value }),
    })
      .then(function () {
        form.question.value = '';
        updateCount();
        status('已送出，謝謝！問題會出現在下方。 Sent, thanks! Your question will appear below.', 'ok');
        filter = 'all';
        setTab();
        refresh();
      })
      .catch(function (err) {
        status('送出失敗 Failed to send：' + err.message, 'err');
      })
      .then(function () {
        setTimeout(function () { $('send').disabled = false; }, COOLDOWN_MS);
      });
  };

  // ---------- 篩選 ----------

  function setTab() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      var on = t.dataset.filter === filter;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.onclick = function () {
      filter = t.dataset.filter;
      setTab();
      if (data) render();
    };
  });

  $('question').oninput = updateCount;
  $('refresh').onclick = refresh;
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  refresh();
})();
