// Página de descarga: muestra el botón correcto según el dispositivo
// (Android → APK, iPhone → agregar a inicio, computadora → mandarse el enlace).
(function () {
  'use strict';
  var REPO = 'MATICHssj/EconomyLaw';
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var $ = function (id) {
    return document.getElementById(id);
  };

  function selectTab(which) {
    ['android', 'ios'].forEach(function (t) {
      var on = t === which;
      $('tab-' + t).setAttribute('aria-selected', String(on));
      $('steps-' + t).hidden = !on;
    });
    $('ios-note').hidden = which !== 'ios';
  }
  $('tab-android').addEventListener('click', function () {
    selectTab('android');
  });
  $('tab-ios').addEventListener('click', function () {
    selectTab('ios');
  });

  if (isAndroid) {
    $('cta-android').hidden = false;
    selectTab('android');
  } else if (isIOS) {
    $('cta-ios').hidden = false;
    selectTab('ios');
    // En iPhone no hay archivo que bajar: se abre la app y ahí se agrega a la
    // pantalla de inicio (la app muestra la guía con ?instalar=1).
    $('cta-ios').addEventListener('click', function () {
      location.href = new URL('../?instalar=1', location.href).href;
    });
  } else {
    $('cta-desktop').hidden = false;
    selectTab('android');
    var link = location.href.split('#')[0];
    $('share-wa').href = 'https://wa.me/?text=' + encodeURIComponent('Descarga Fina, la app de finanzas: ' + link);
    $('copy').addEventListener('click', function () {
      var done = function () {
        $('copy').textContent = '¡Copiado!';
      };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () {});
    });
  }

  // Versión publicada (si GitHub responde; si no, la página funciona igual).
  if (window.fetch) {
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (rel) {
        if (!rel || !rel.tag_name) return;
        var apk = (rel.assets || []).filter(function (a) {
          return a.name === 'fina.apk';
        })[0];
        var date = rel.published_at ? new Date(rel.published_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        var parts = ['Versión ' + String(rel.tag_name).replace(/^v/, '')];
        if (isAndroid && apk) parts.push(Math.max(1, Math.round(apk.size / 1048576)) + ' MB');
        if (date) parts.push(date);
        $('version').textContent = parts.join(' · ');
      })
      .catch(function () {});
  }
})();
