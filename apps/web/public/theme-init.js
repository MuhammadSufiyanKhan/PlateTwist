// Runs before first paint (loaded as an external file so the strict CSP stays intact).
(function () {
  var pref = 'system';
  try {
    pref = localStorage.getItem('specials_theme') || 'system';
  } catch (e) {
    /* storage unavailable */
  }
  var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
