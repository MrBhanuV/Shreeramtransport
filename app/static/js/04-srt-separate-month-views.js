
// Separate Records and Month-wise views for GPS / Expense
function setGpsView(view){
  const cp=document.getElementById('cp-gps'); if(!cp)return;
  const month=view==='month';
  cp.classList.toggle('month-view',month);
  document.getElementById('gpsRecordsTab')?.classList.toggle('active',!month);
  document.getElementById('gpsMonthTab')?.classList.toggle('active',month);
  if(month && typeof gpsRenderMonthly==='function') gpsRenderMonthly(document.getElementById('gpsMonthSelect')?.value||'');
}
function setExpView(view){
  const cp=document.getElementById('cp-exp'); if(!cp)return;
  const month=view==='month';
  cp.classList.toggle('month-view',month);
  document.getElementById('expRecordsTab')?.classList.toggle('active',!month);
  document.getElementById('expMonthTab')?.classList.toggle('active',month);
  if(month && typeof renderExpMonthly==='function') renderExpMonthly(document.getElementById('expMonthSelect')?.value||'');
}
window.setGpsView=setGpsView;
window.setExpView=setExpView;
