
(function(){
  try {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('srt_theme') === 'light' ? 'light' : 'dark');
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
