(function () {
  var btn = document.getElementById('menuBtn'), list = document.getElementById('menuList');
  function setOpen(open) { list.hidden = !open; btn.setAttribute('aria-expanded', String(open)); }
  btn.onclick = function (e) { e.stopPropagation(); setOpen(list.hidden); };
  document.addEventListener('click', function (e) { if (!list.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !list.hidden) setOpen(false); });
})();
