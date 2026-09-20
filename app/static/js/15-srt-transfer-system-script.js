
// Shared data transfer controls. Account credentials and module permissions are unchanged.
const SRT_TRANSFER_NAMES={inv:'Invoices',pay:'Payments',cp:'Company Payments',rp:'Received Payments',exp:'Expenses',fr:'Freight Rates',trader:'Trader Details',vehicle:'Vehicle Details',gps:'GPS Records','att-records':'Attendance Records','att-staff':'Staff Directory','att-holidays':'Company Holidays'};
const SRT_TRANSFER_COLUMNS={
  gps:[['gpsId','GPS ID'],['dateIssued','Date Issued'],['vehicleNumber','Vehicle Number'],['gpsType','GPS Type'],['gpsAmount','GPS Amount (₹)'],['gpsReturn','GPS Return'],['returnDate','Return Date'],['amountReturn','Amount Return (₹)'],['lateFee','Late Fee (₹)'],['balanceDue','Balance Due (₹)'],['owner','Owner'],['remark','Remark']],
  'att-records':[['date','Date'],['staffId','Staff ID'],['name','Name'],['status','Status'],['note','Note']],
  'att-staff':[['id','Staff ID'],['name','Name'],['dept','Department'],['role','Designation'],['salary','Monthly Salary']],
  'att-holidays':[['date','Date'],['name','Holiday Name']]
};
let srtTransferOpen=null;
function srtTransferColumns(key){return SRT_TRANSFER_COLUMNS[key]?.map(([k,l])=>({k,l}))||(COLS[key]||[]).filter(c=>!c.image);}
function srtCanTransfer(key,write=false){
  if(key==='att-staff')return srtCanSection('att','staff');
  if(key==='att-records'||key==='att-holidays')return write?srtCanSection('att','attendance'):['attendance','calendar','salary'].some(section=>srtCanSection('att',section));
  return srtCanSection(key==='trader'||key==='vehicle'?'fr':key,'transfer');
}
function srtSetAttendanceDataset(key){
  const menu=document.getElementById('attExportMenu'),select=document.getElementById('srtAttendanceDataset');
  if(!select.querySelector('option[value="'+key+'"]')||!srtCanTransfer(key))return;
  select.value=key;menu.dataset.transferSheet=key;
  const canImport=srtCanTransfer(key,true),button=menu.querySelector('[data-transfer-action="import"]');
  button.disabled=!canImport;
  button.querySelector('small').textContent=canImport?'Excel or CSV · Add new records':'Your access allows export only';
  document.getElementById('srtAttendanceImportHint').textContent=key==='att-records'?'Use Staff IDs from the staff directory. Import the staff demo first when using demo records.':key==='att-staff'?'Staff ID identifies each person. Existing IDs are skipped.':'Holiday dates are used in attendance and salary calculations.';
}
function srtPositionTransferMenu(){
  if(!srtTransferOpen)return;
  const {menu,trigger}=srtTransferOpen,anchor=trigger.getBoundingClientRect();
  const width=Math.min(300,window.innerWidth-24);
  menu.style.width=width+'px';menu.style.maxHeight=Math.max(120,window.innerHeight-24)+'px';
  const height=Math.min(menu.scrollHeight,window.innerHeight-24);
  const below=window.innerHeight-anchor.bottom-12,above=anchor.top-12;
  let top=anchor.bottom+8;
  if(below<height&&above>below)top=anchor.top-height-8;
  top=Math.max(12,Math.min(top,window.innerHeight-height-12));
  menu.style.left=Math.max(12,Math.min(anchor.right-width,window.innerWidth-width-12))+'px';
  menu.style.top=top+'px';
}
function srtToggleTransferMenu(id){
  if(srtTransferOpen?.menu.id===id){srtCloseTransferMenu(true);return;}
  srtCloseTransferMenu();
  const menu=document.getElementById(id),trigger=document.querySelector('.srt-transfer-trigger[aria-controls="'+id+'"]');
  if(!menu||!trigger)return;
  if(id==='attExportMenu'){
    const select=document.getElementById('srtAttendanceDataset');
    [...select.options].forEach(option=>{option.hidden=!srtCanTransfer(option.value);option.disabled=option.hidden;});
    let wanted=ATT.tab==='staff'?'att-staff':'att-records';
    if(!srtCanTransfer(wanted))wanted=[...select.options].find(option=>!option.disabled)?.value;
    if(!wanted){toast('No attendance data access is assigned to this account.','var(--red)');return;}
    srtSetAttendanceDataset(wanted);
    menu.querySelector('[data-transfer-action="daily"]').hidden=!srtCanSection('att','attendance');
    menu.querySelector('[data-transfer-action="monthly"]').hidden=!srtCanSection('att','salary');
  }
  if(!srtCanTransfer(menu.dataset.transferSheet)){toast('Export / import access is not assigned to this account.','var(--red)');return;}
  if(id==='gpsIEMenu')menu.querySelector('[data-transfer-action="delete"]').hidden=!srtCanSection('gps','manage');
  menu.classList.add('open');trigger.setAttribute('aria-expanded','true');srtTransferOpen={menu,trigger};
  if(typeof menu.showPopover==='function'){try{menu.showPopover();}catch(e){}}
  srtPositionTransferMenu();
  (menu.querySelector('select')||menu.querySelector('button:not([disabled]):not([hidden])'))?.focus({preventScroll:true});
}
function srtCloseTransferMenu(restoreFocus=false){
  if(!srtTransferOpen)return;
  const {menu,trigger}=srtTransferOpen;srtTransferOpen=null;
  if(typeof menu.hidePopover==='function'){try{menu.hidePopover();}catch(e){}}
  menu.classList.remove('open');trigger.setAttribute('aria-expanded','false');
  if(restoreFocus)trigger.focus({preventScroll:true});
}
document.addEventListener('click',event=>{if(srtTransferOpen&&!srtTransferOpen.menu.contains(event.target)&&!srtTransferOpen.trigger.contains(event.target))srtCloseTransferMenu();});
document.addEventListener('keydown',event=>{
  if(!srtTransferOpen)return;
  if(event.key==='Escape'){event.preventDefault();srtCloseTransferMenu(true);return;}
  if(event.target.tagName==='SELECT')return;
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    const controls=[...srtTransferOpen.menu.querySelectorAll('button:not([disabled]):not([hidden])')];
    if(!controls.length)return;
    event.preventDefault();let index=controls.indexOf(document.activeElement);
    index=event.key==='Home'?0:event.key==='End'?controls.length-1:event.key==='ArrowDown'?(index+1)%controls.length:(index-1+controls.length)%controls.length;
    controls[index].focus();
  }
});
window.addEventListener('resize',()=>srtCloseTransferMenu());
document.addEventListener('scroll',event=>{if(srtTransferOpen&&!srtTransferOpen.menu.contains(event.target))srtCloseTransferMenu();},true);

function srtTransferRows(key){
  if(key==='gps')return GPSD.records;
  if(key==='att-staff')return ATT.staff;
  if(key==='att-holidays')return Object.keys(ATT.holidays||{}).sort().map(date=>({date,name:ATT.holidays[date]?.name||'Company Holiday'}));
  if(key==='att-records')return Object.keys(ATT.records).sort().flatMap(date=>Object.entries(ATT.records[date]).map(([staffId,record])=>({date,staffId,name:ATT.staff.find(staff=>staff.id===staffId)?.name||'',status:record.status||'Not Marked',note:record.note||''})));
  return STATE[key]||[];
}
function srtTransferCSV(table){return '\uFEFF'+table.map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';}
function srtSaveTransferCSV(filename,table){
  const url=URL.createObjectURL(new Blob([srtTransferCSV(table)],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function srtTransferExport(key,format,filtered=false){
  if(!srtCanTransfer(key))throw new Error('You do not have export access to this data.');
  const columns=srtTransferColumns(key);
  let rows=srtTransferRows(key);
  if(filtered&&key==='gps'&&GPSD.filteredIds!==null)rows=rows.filter(record=>GPSD.filteredIds.includes(record.id));
  if(filtered&&['inv','pay','cp','rp'].includes(key))rows=visRows(key).slice().reverse();
  const table=[columns.map(c=>c.l),...rows.map(record=>columns.map(c=>record[c.k]??''))];
  const filename='SRT_'+SRT_TRANSFER_NAMES[key].replace(/\s+/g,'_')+(filtered?'_Filtered':'')+'_'+new Date().toISOString().slice(0,10);
  if(format==='csv')srtSaveTransferCSV(filename+'.csv',table);
  else{
    if(typeof XLSX==='undefined')throw new Error('Excel support could not load. Export CSV or reconnect and reload.');
    const ws=XLSX.utils.aoa_to_sheet(table);ws['!cols']=columns.map((c,i)=>({wch:Math.min(38,Math.max(14,String(c.l).length+2,...table.slice(1).map(row=>String(row[i]??'').length+2)))}));
    ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,table.length-1),c:columns.length-1}})};
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,SRT_TRANSFER_NAMES[key].slice(0,31));XLSX.writeFile(wb,filename+'.xlsx');
  }
  toast(rows.length+' records exported.','var(--green)');
}
function srtAdditionalDemoRows(key){
  if(key==='gps')return [1,2].map(n=>({gpsId:'DEMO-GPS-00'+n,dateIssued:'2026-09-0'+n,vehicleNumber:'DEMO-TRUCK-00'+n,gpsType:n===1?'JSPL':'Wheelseye',gpsAmount:5000,gpsReturn:n===1?'No':'Yes',returnDate:n===1?'':'2026-09-05',amountReturn:n===1?0:4500,lateFee:n===1?0:500,balanceDue:n===1?5000:0,owner:'Demo Owner '+n,remark:'Sample row, replace before importing'}));
  if(key==='att-staff')return [1,2].map(n=>({id:'DEMO-STAFF-00'+n,name:'Demo Employee '+n,dept:n===1?'Operations':'Finance',role:n===1?'Coordinator':'Accountant',salary:n===1?18000:22000}));
  if(key==='att-records')return [1,2].map(n=>({date:'2026-09-0'+n,staffId:'DEMO-STAFF-00'+n,name:'Demo Employee '+n,status:n===1?'Present':'WFH',note:'Sample row - use an existing Staff ID'}));
  if(key==='att-holidays')return [1,2].map(n=>({date:'2026-09-'+(14+n),name:'Demo Company Holiday '+n}));
  return srtImportDemoRows(key);
}
function srtTransferDemo(key){
  const cols=srtTransferColumns(key),rows=srtAdditionalDemoRows(key);
  srtSaveTransferCSV('SRT_'+SRT_TRANSFER_NAMES[key].replace(/\s+/g,'_')+'_Import_Demo.csv',[cols.map(c=>c.l),...rows.map(row=>cols.map(c=>row[c.k]??''))]);
  toast('Demo file downloaded. Replace sample rows with your data before importing.','var(--cyan)');
}
function srtTransferAction(menuId,action){
  const menu=document.getElementById(menuId),key=menu.dataset.transferSheet;
  try{
    if(!srtCanTransfer(key,action==='import'))throw new Error('You do not have access to this action.');
    if(action==='import'){
      const input=document.getElementById(key==='gps'?'gpsImportFile':key.startsWith('att-')?'srtAttendanceImportFile':'ximp-'+key);
      input.dataset.transferSheet=key;srtCloseTransferMenu();input.click();return;
    }
    if(action==='demo')srtTransferDemo(key);
    else if(action==='csv'||action==='excel')srtTransferExport(key,action);
    else if(action==='filter')srtTransferExport(key,'csv',true);
    else if(action==='daily'){if(!srtCanSection('att','attendance'))throw new Error('Attendance access is required.');attExportDay();}
    else if(action==='monthly'){if(!srtCanSection('att','salary'))throw new Error('Salary access is required.');attExportMon();}
    else if(action==='delete'){if(!srtCanSection('gps','manage'))throw new Error('GPS management access is required.');srtCloseTransferMenu();gpsConfirmClearAll();}
  }catch(error){toast(error.message,'var(--red)');}
  srtCloseTransferMenu();
}

// CSV parsing supports empty cells, commas, escaped quotes and multiline notes.
function srtParseTransferCSV(text){
  text=String(text).replace(/^\uFEFF/,'');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}
      else if(quoted)quoted=false;
      else if(cell==='')quoted=true;
      else cell+=ch;
    }else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\r'||ch==='\n')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(ch==='\r'&&text[i+1]==='\n')i++;}
    else cell+=ch;
  }
  if(quoted)throw new Error('The CSV contains an unclosed quoted field.');
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  return rows.filter(item=>item.some(value=>String(value).trim()!==''));
}
async function srtReadTransferTable(file){
  if(/\.csv$/i.test(file.name))return srtParseTransferCSV(await file.text());
  if(!/\.xlsx?$/i.test(file.name))throw new Error('Choose an Excel or CSV file.');
  if(typeof XLSX==='undefined')throw new Error('Excel support could not load. Save your file as CSV or reconnect and reload.');
  const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:true});
  if(!wb.SheetNames.length)throw new Error('The workbook is empty.');
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:true});
}
function srtMapTransferTable(table,key){
  if(!table||table.length<2)throw new Error('The file must have a header and at least one data row.');
  const cols=srtTransferColumns(key),mapping=table[0].map(header=>cols.find(c=>[c.l,c.k].some(name=>name.toLowerCase()===String(header).replace(/^\uFEFF/,'').trim().toLowerCase()))?.k);
  if(!mapping.some(Boolean))throw new Error('No matching columns. Download the demo file for the correct format.');
  return table.slice(1).filter(row=>row.some(value=>String(value??'').trim()!=='')).map(row=>{
    const record=Object.create(null);mapping.forEach((key,index)=>{if(key)record[key]=row[index]??'';});return record;
  });
}
function srtTransferRequired(value,label,row){const text=String(value??'').trim();if(!text)throw new Error('Row '+row+': '+label+' is required.');return text;}
function srtTransferDate(value,label,row,optional=false){
  if((value===undefined||value===null||String(value).trim()==='')&&optional)return '';
  if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);
  const text=srtTransferRequired(value,label,row),match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedDate=new Date(text+'T00:00:00Z');
  if(!match||isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==text)throw new Error('Row '+row+': '+label+' must use YYYY-MM-DD.');
  return text;
}
function srtTransferNumber(value,label,row){const n=String(value??'').trim()===''?0:Number(String(value).replace(/[₹,\s]/g,''));if(!Number.isFinite(n)||n<0)throw new Error('Row '+row+': '+label+' must be a non-negative number.');return n;}
function srtCommitGPSImport(rows){
  if(!rows.length)throw new Error('No data rows found.');
  const normalized=rows.map((record,index)=>{
    const row=index+2,rec={id:gpsUid()};
    for(const key of ['gpsId','vehicleNumber','gpsType'])rec[key]=srtTransferRequired(record[key],key,row);
    rec.dateIssued=srtTransferDate(record.dateIssued,'Date Issued',row);
    const returned=String(record.gpsReturn||'No').trim().toLowerCase();
    if(!['yes','no'].includes(returned))throw new Error('Row '+row+': GPS Return must be Yes or No.');
    rec.gpsReturn=returned==='yes'?'Yes':'No';rec.returnDate=srtTransferDate(record.returnDate,'Return Date',row,true);
    for(const key of ['gpsAmount','amountReturn','lateFee','balanceDue'])rec[key]=srtTransferNumber(record[key],key,row);
    rec.owner=String(record.owner??'').trim();rec.remark=String(record.remark??'').trim();return rec;
  });
  const identity=record=>[record.gpsId,record.dateIssued,record.vehicleNumber].map(value=>String(value).trim().toLowerCase()).join('|');
  const seen=new Set(GPSD.records.map(identity));let skipped=0;
  const added=normalized.filter(record=>{const key=identity(record);if(seen.has(key)){skipped++;return false;}seen.add(key);return true;});
  GPSD.records=[...added.reverse(),...GPSD.records];gpsPersist();gpsApplyFilters();gpsRenderStats();gpsUpdateDashKPI();
  return {added:added.length,skipped};
}
async function srtImportGPS(input){
  const file=input.files[0];if(!file)return;
  try{
    if(!srtCanTransfer('gps',true))throw new Error('GPS import access is required.');
    let rows;
    if(/\.json$/i.test(file.name)){
      const parsed=JSON.parse(await file.text());rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.records)?parsed.records:[parsed];
      if(rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new Error('JSON must contain GPS record objects.');
    }else rows=srtMapTransferTable(await srtReadTransferTable(file),'gps');
    if(!srtCanTransfer('gps',true))throw new Error('GPS import access is required.');
    const result=srtCommitGPSImport(rows);toast('Imported '+result.added+' GPS records · '+result.skipped+' duplicates skipped.','var(--green)');
  }catch(error){toast('Import failed: '+error.message,'var(--red)');}finally{input.value='';}
}
function srtCommitAttendanceImport(rows,key){
  if(!rows.length)throw new Error('No data rows found.');
  const normalized=rows.map((record,index)=>{
    const row=index+2;
    if(key==='att-holidays')return {date:srtTransferDate(record.date,'Date',row),name:srtTransferRequired(record.name,'Holiday Name',row)};
    const id=srtTransferRequired(record[key==='att-staff'?'id':'staffId'],'Staff ID',row).toUpperCase();
    if(!/^[A-Z0-9][A-Z0-9_-]*$/.test(id))throw new Error('Row '+row+': use letters, numbers or hyphens for Staff ID.');
    if(key==='att-staff')return {id,name:srtTransferRequired(record.name,'Name',row),dept:srtTransferRequired(record.dept,'Department',row),role:srtTransferRequired(record.role,'Designation',row),salary:srtTransferNumber(record.salary,'Monthly Salary',row)};
    const staff=ATT.staff.find(item=>item.id.toUpperCase()===id);if(!staff)throw new Error('Row '+row+': unknown Staff ID '+id+'. Import staff first.');
    const status=STATUSES.find(item=>item.toLowerCase()===String(record.status||'').trim().toLowerCase());
    if(!status&&String(record.status||'').trim()!=='Not Marked')throw new Error('Row '+row+': use Present, WFH, Absent, Late or Half-Day.');
    return {date:srtTransferDate(record.date,'Date',row),staffId:staff.id,status:status||'',note:String(record.note??'').trim()};
  });
  let added=0,skipped=0;
  if(key==='att-staff'){
    const seen=new Set(ATT.staff.map(staff=>staff.id.toUpperCase()));
    normalized.forEach(record=>{if(seen.has(record.id)){skipped++;return;}seen.add(record.id);ATT.staff.push(record);added++;});
  }else if(key==='att-holidays'){
    if(!ATT.holidays)ATT.holidays={};
    normalized.forEach(record=>{if(ATT.holidays[record.date]){skipped++;return;}ATT.holidays[record.date]={name:record.name};added++;});
  }else normalized.forEach(record=>{
    if(!record.status||(ATT.records[record.date]?.[record.staffId]?.status)){skipped++;return;}
    if(!ATT.records[record.date])ATT.records[record.date]={};
    ATT.records[record.date][record.staffId]={status:record.status,note:record.note};added++;
  });
  attPersist();attStats();attTableRender();attListRender();attCalPop();attUpdateHolidayButton();
  if(ATT.tab==='calendar')attCalRender();if(ATT.tab==='salary')attSalaryRender();
  return {added,skipped};
}
async function srtImportAttendance(input){
  const file=input.files[0],key=input.dataset.transferSheet;if(!file)return;
  try{
    if(!['att-records','att-staff','att-holidays'].includes(key)||!srtCanTransfer(key,true))throw new Error('Import access to this attendance data is required.');
    const rows=srtMapTransferTable(await srtReadTransferTable(file),key);
    if(!srtCanTransfer(key,true))throw new Error('Import access to this attendance data is required.');
    const result=srtCommitAttendanceImport(rows,key);toast('Imported '+result.added+' records · '+result.skipped+' existing records skipped.','var(--green)');
  }catch(error){toast('Import failed: '+error.message,'var(--red)');}finally{input.value='';}
}

