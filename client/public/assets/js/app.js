/* Ayni Cusco — comportamiento del sitio */
(function () {
  'use strict';
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  /* ---- Aviso emergente ---- */
  let tt;
  window.toast = function (msg) {
    const t = $('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('ver');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('ver'), 2600);
  };

  /* ---- Favoritos (AJAX con respaldo por enlace normal) ---- */
  function pintarFav(id, activo) {
    $$('[data-fav="' + id + '"]').forEach(el => {
      el.classList.toggle('activo', activo);
      if (el.classList.contains('btn-favorito-grande')) {
        el.innerHTML = activo ? '💔 Quitar de Favoritos' : '❤️ Guardar en Favoritos';
        el.style.background = activo ? 'rgba(255,71,87,.15)' : '';
      }
      if (el.classList.contains('btn-fav')) el.title = activo ? 'Quitar de favoritos' : 'Guardar en favoritos';
    });
  }
  function contador(total) {
    const c = $('#favCount'); if (!c) return;
    c.textContent = total; c.hidden = total < 1;
  }
  document.addEventListener('click', function (ev) {
    const el = ev.target.closest('[data-fav]');
    if (!el) return;
    ev.preventDefault();
    const id = el.dataset.fav;
    fetch('favorito.php?id=' + encodeURIComponent(id) + '&ajax=1', { headers: { 'X-Requested-With': 'fetch' } })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) throw new Error();
        pintarFav(id, d.fav); contador(d.total);
        toast(d.fav ? '❤️ Agregado a tus favoritos' : 'Evento eliminado de favoritos');
        // Página "Mis favoritos": al quitar, la tarjeta desaparece
        if (el.classList.contains('corazon') && !d.fav) {
          const card = el.closest('.card');
          card.style.transition = 'all .35s'; card.style.opacity = '0'; card.style.transform = 'scale(.9)';
          setTimeout(() => {
            card.remove();
            if (!$('.grid .card')) { const v = $('#favVacio'); if (v) v.style.display = 'block'; const g = $('.grid'); if (g) g.style.display = 'none'; }
          }, 350);
        }
      })
      .catch(() => { window.location.href = el.getAttribute('href'); });
  });

  /* ---- Compartir ---- */
  window.abrirCompartir = () => { const m = $('#modalCompartir'); if (m) m.style.display = 'flex'; };
  window.cerrarCompartir = () => { const m = $('#modalCompartir'); if (m) m.style.display = 'none'; };
  window.copiarEnlace = function () {
    const i = $('#enlaceEvento'); if (!i) return;
    const ok = () => toast('¡Enlace copiado al portapapeles!');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(i.value).then(ok, () => { i.select(); document.execCommand('copy'); ok(); });
    else { i.select(); document.execCommand('copy'); ok(); }
  };
  document.addEventListener('click', e => { const m = $('#modalCompartir'); if (m && e.target === m) cerrarCompartir(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { cerrarCompartir(); const l = $('.lightbox'); if (l) l.classList.remove('ver'); } });
  const nativo = $('#btnShareNativo');
  if (nativo && navigator.share) { nativo.style.display = 'flex'; nativo.addEventListener('click', () => navigator.share({ title: document.title, url: location.href }).catch(() => {})); }

  /* ---- Confirmaciones ---- */
  $$('form[data-confirm]').forEach(f => f.addEventListener('submit', e => { if (!confirm(f.dataset.confirm)) e.preventDefault(); }));

  /* ---- Zona de carga de imagen ---- */
  const area = $('.upload-area');
  const input = $('#imagen');
  if (area && input) {
    const prev = $('#previewNueva');
    const mostrar = (file) => {
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast('Solo JPG, PNG o WEBP'); input.value = ''; return; }
      if (file.size > 5 * 1024 * 1024) { toast('La imagen supera los 5 MB'); input.value = ''; return; }
      const t = $('#textoUpload'); if (t) t.innerHTML = '<strong>' + file.name.replace(/</g, '') + '</strong> (' + (file.size / 1024).toFixed(0) + ' KB)';
      if (prev) { prev.src = URL.createObjectURL(file); prev.style.display = 'block'; }
    };
    area.addEventListener('click', e => { if (e.target !== input) input.click(); });
    input.addEventListener('change', () => mostrar(input.files[0]));
    ['dragenter', 'dragover'].forEach(ev => area.addEventListener(ev, e => { e.preventDefault(); area.style.borderColor = '#FFD700'; }));
    ['dragleave', 'drop'].forEach(ev => area.addEventListener(ev, e => { e.preventDefault(); area.style.borderColor = ''; }));
    area.addEventListener('drop', e => { if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; mostrar(input.files[0]); } });
  }

  /* ---- Galería (visor de fotos) ---- */
  $$('.galeria-fotos img').forEach(img => img.addEventListener('click', () => {
    let l = $('.lightbox');
    if (!l) { l = document.createElement('div'); l.className = 'lightbox'; l.innerHTML = '<img alt="">'; l.addEventListener('click', () => l.classList.remove('ver')); document.body.appendChild(l); }
    $('img', l).src = img.dataset.full || img.src; l.classList.add('ver');
  }));

  /* ---- Mapa (Leaflet + OpenStreetMap / Nominatim) ---- */
  window.initMapa = function (lugar, lat, lng) {
    const el = $('#mapa'); if (!el || typeof L === 'undefined') { if (el) el.innerHTML = '<p style="padding:110px 20px;text-align:center;color:#A0AEC0">Conéctate a internet para ver el mapa.</p>'; return; }
    const centro = [-13.5170, -71.9785];
    const map = L.map('mapa', { scrollWheelZoom: false }).setView(centro, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    const poner = (p) => { map.setView(p, 16); L.marker(p).addTo(map).bindPopup(lugar).openPopup(); };
    if (lat && lng) return poner([lat, lng]);
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(lugar + ', Cusco, Perú'))
      .then(r => r.json()).then(d => poner(d.length ? [parseFloat(d[0].lat), parseFloat(d[0].lon)] : centro)).catch(() => poner(centro));
  };

  /* ---- Clima (Open-Meteo) ---- */
  window.initClima = function (fechaISO) {
    const T = $('#climaTemp'); if (!T) return;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    let dia = fechaISO ? new Date(fechaISO + 'T00:00:00') : hoy, nota = '';
    const dif = Math.round((dia - hoy) / 86400000);
    if (!fechaISO || dif < 0 || dif > 15) { dia = hoy; nota = fechaISO && dif > 15 ? 'El pronóstico del día del evento estará disponible 16 días antes. Mostramos el clima de hoy en Cusco como referencia.' : 'Mostramos el clima de hoy en Cusco como referencia.'; }
    const f = dia.getFullYear() + '-' + String(dia.getMonth() + 1).padStart(2, '0') + '-' + String(dia.getDate()).padStart(2, '0');
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-13.5170&longitude=-71.9785&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=America%2FLima&start_date=' + f + '&end_date=' + f;
    fetch(url).then(r => r.json()).then(d => {
      const x = d.daily;
      T.textContent = Math.round(x.temperature_2m_max[0]) + '° / ' + Math.round(x.temperature_2m_min[0]) + '°C';
      $('#climaLluvia').textContent = (x.precipitation_probability_max[0] ?? 0) + '%';
      $('#climaViento').textContent = Math.round(x.wind_speed_10m_max[0]) + ' km/h';
      const n = $('#climaNota'); if (n) n.textContent = nota;
    }).catch(() => { const n = $('#climaNota'); if (n) n.textContent = 'No se pudo cargar el pronóstico (revisa tu conexión a internet).'; });
  };

  /* ---- Mostrar/ocultar flash automáticamente ---- */
  const fl = $('#flash'); if (fl) setTimeout(() => fl.style.opacity = '.0', 7000);
})();
