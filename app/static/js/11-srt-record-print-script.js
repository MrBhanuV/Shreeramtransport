
(function(){
  function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]||c;});}
  function cleanupPrintRoot(){
    document.body.classList.remove('srt-record-print');
    const old=document.getElementById('srtRecordPrintRoot');
    if(old) old.remove();
  }
  function printClone(node,title,subtitle){
    if(!node){ if(typeof toast==='function') toast('No records available to print.','var(--red)'); return; }
    cleanupPrintRoot();
    const root=document.createElement('div');
    root.id='srtRecordPrintRoot';
    const head=document.createElement('div');
    head.className='srt-print-title';
    head.innerHTML='<h1>'+esc(title)+'</h1><p>'+esc(subtitle||('Printed: '+new Date().toLocaleString('en-IN')))+'</p>';
    root.appendChild(head);
    const clone=node.cloneNode(true);
    clone.querySelectorAll('button,input,select,textarea,.row-acts,.fr-acts,.gps-act-col,.scroll-hint,.tbl-pager,.gps-pager,.save-bar,.att-toolbar,.staff-toolbar,.cal-toolbar,.salary-toolbar,.salary-rule-card,.salary-calc-card,.month-data-select-wrap').forEach(el=>el.remove());
    root.appendChild(clone);
    document.body.appendChild(root);
    document.body.classList.add('srt-record-print');
    setTimeout(()=>window.print(),80);
  }
  function makeTable(headers,rows){
    const wrap=document.createElement('div');
    wrap.className='tbl-wrap';
    const table=document.createElement('table');
    const thead=document.createElement('thead');
    const trh=document.createElement('tr');
    headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;trh.appendChild(th);});
    thead.appendChild(trh); table.appendChild(thead);
    const tbody=document.createElement('tbody');
    rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(v=>{const td=document.createElement('td');td.textContent=String(v==null?'':v);tr.appendChild(td);});tbody.appendChild(tr);});
    table.appendChild(tbody); wrap.appendChild(table); return wrap;
  }
  function printableSheetTable(type){
    const cols=COLS[type]||[];
    const rows=(typeof visRows==='function'?visRows(type):STATE[type]||[]).slice().reverse();
    const values=rows.map(r=>cols.map(c=>{
      const raw=r[c.k];
      if(c.image) return (typeof raw==='string'&&raw.startsWith('data:image/'))?'Uploaded':'Not Uploaded';
      let v=typeof sv==='function'?sv(raw):String(raw??'');
      if(c.inr && typeof inr==='function') v=inr(v);
      return v;
    }));
    return makeTable(cols.map(c=>c.l),values);
  }
  function printableFreightTable(){
    const q=String(window.frQ||'').toLowerCase();
    const rows=(STATE.fr||[]).filter(r=>!q||String(r.destination||'').toLowerCase().includes(q)).slice().reverse();
    return makeTable(['Destination','Freight Rate'],rows.map(r=>[r.destination,'₹'+r.rate]));
  }
  window.srtPrintRecords=function(type){
    if(type==='gps'){
      const cp=document.getElementById('cp-gps');
      const month=cp?.classList.contains('month-view');
      if(month){
        const node=document.querySelector('#gpsMonthDataSection .month-table-wrap');
        const monthLabel=document.getElementById('gpsMonthSelect')?.selectedOptions?.[0]?.textContent||'Monthly Summary';
        printClone(node,'Shree Ram Transport — GPS Month-wise Records',monthLabel);
      }else{
        const node=document.querySelector('#cp-gps .gps-tbl-wrap');
        printClone(node,'Shree Ram Transport — GPS Records','Current filtered records · '+new Date().toLocaleString('en-IN'));
      }
      return;
    }
    if(type==='exp'){
      const cp=document.getElementById('cp-exp');
      if(cp?.classList.contains('month-view')){
        const node=document.querySelector('#expMonthDataSection .month-table-wrap');
        const monthLabel=document.getElementById('expMonthSelect')?.selectedOptions?.[0]?.textContent||'Monthly Summary';
        printClone(node,'Shree Ram Transport — Expense Month-wise Records',monthLabel);
      }else{
        printClone(printableSheetTable('exp'),'Shree Ram Transport — Expense Records','Current filtered records · '+new Date().toLocaleString('en-IN'));
      }
      return;
    }
    if(type==='fr'){
      printClone(printableFreightTable(),'Shree Ram Transport — Freight Rate Records','Current filtered destinations · '+new Date().toLocaleString('en-IN'));
      return;
    }
    if(['inv','pay','cp','rp','trader','vehicle'].includes(type)){
      const titles={inv:'Invoice Records',pay:'Payment Records',cp:'Company Payment Records',rp:'Received Payment Records',trader:'Traders Details',vehicle:'Vehicle Details'};
      printClone(printableSheetTable(type),'Shree Ram Transport — '+titles[type],'Current filtered records · '+new Date().toLocaleString('en-IN'));
      return;
    }
  };
  window.srtPrintAttendanceRecords=function(){
    const active=document.querySelector('#cp-att .att-tab-pane.active');
    if(!active){ if(typeof toast==='function') toast('No attendance records available to print.','var(--red)'); return; }
    const id=active.id||'';
    let title='Shree Ram Transport — Attendance Records';
    if(id==='att-tab-attendance') title='Shree Ram Transport — Daily Attendance Records';
    else if(id==='att-tab-staff') title='Shree Ram Transport — Staff Directory';
    else if(id==='att-tab-calendar') title='Shree Ram Transport — Calendar Attendance History';
    else if(id==='att-tab-salary') title='Shree Ram Transport — Monthly Attendance & Salary';
    let node=active;
    if(id==='att-tab-attendance') node=active.querySelector('.att-table-wrap')||active;
    else if(id==='att-tab-staff') node=active.querySelector('.staff-table-wrap')||active;
    else if(id==='att-tab-salary') node=active.querySelector('.salary-summary-card')||active;
    printClone(node,title,'Printed: '+new Date().toLocaleString('en-IN'));
  };
  window.addEventListener('afterprint',cleanupPrintRoot);
})();
