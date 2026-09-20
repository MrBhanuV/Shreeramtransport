
// Fictional examples only. Downloading a template does not read or change records.
function srtImportDemoRows(sheet){
  return [1,2].map(n=>{
    const suffix=String(n).padStart(3,'0'),sr=String(900000+n);
    const loading='2026-09-0'+n,unloading='2026-09-0'+(n+1),paid='2026-09-0'+(n+2);
    const mt=n===1?25:30,rate=n===1?1000:1200,companyRate=n===1?1100:1300;
    const total=mt*rate,companyAmount=mt*companyRate,gst=companyAmount*0.18,bill=companyAmount+gst;
    const advance=n===1?10000:15000,final=n===1?total-advance:0,received=n===1?bill:15000;
    const trader='Demo Trader '+n,city='Demo City '+n,vehicle='DEMO-TRUCK-'+suffix;
    const invoice='DEMO/INV/'+suffix,lr='DEMO-LR-'+suffix,order='DEMO-DO-'+suffix;
    const remark='Sample row - replace with your own data before importing';
    const rows={
      inv:{'Sr. No.':sr,'Invoice no.':invoice,'Invoice date':loading,'Loading Date':loading,'Unloading Date':unloading,'L. R. N.':lr,'Vehicle':vehicle,'MT':mt,'Trader Name':trader,'Destination City':city,'DO Number':order,'Pahuch Status':n===1?'Physical Copy received':'Pending','Invoice Status':n===1?'Created':'Pending','Pahuch Upload Status':n===1?'Submit to Plant':'Pending','Invoice Upload Status':n===1?'Submit to Plant':'Pending','Vehicle Type':'FOR - COMPANY'},
      pay:{'Sr. No.':sr,'Payment voucher status':n===1?'Created':'Pending','Loading Date':loading,'Unloading Date':unloading,'L. R. N.':lr,'Vehicle':vehicle,'MT':mt,'Trader Name':trader,'Destination City':city,'Frieght':rate,'Total Amount':total,'DO Number':order,'Payment Status':n===1?'Complete':'Advance','Payment Mode Advance':'Online','Payment Advance AMT':advance,'Payment Date Advance':loading,'Payment Mode Final':n===1?'Online':'Pending','Payment Final AMT':final,'Payment Date Final2':n===1?paid:'','Payment Image Link Advance':'','Payment Image Link Final':'','Company Charges':0,'GPS Charges':0,'Party Difference':0,'Diffrence Amount':companyAmount-total,'Company Frieght':companyRate,'Company Total Amount':companyAmount,'18% GST':gst,'Bill Amount':bill,'Recieved Amount':received},
      cp:{'Sr. No.':sr,'Invoice No.':invoice,'L. R. N.':lr,'Vehicle':vehicle,'MT':mt,'Trader Name':trader,'Destination City':city,'DO Number':order,'Freight':companyRate,'Amount':companyAmount,'GST 18%':gst,'Total Amount':bill,'Submit Status':n===1?'Complete':'Pending','Remark':remark},
      rp:{'Sr. No.':sr,'Invoice Number':invoice,'Loading Date':loading,'Vehicle Number':vehicle,'L.R.N.':lr,'MT':mt,'Trader Name':trader,'City':city,'DO Number':order,'Invoice Amount':bill,'Received Amount':received,'Received Date':paid,'Remaining Amount':bill-received},
      exp:{'Name':'Demo Expense '+n,'Date':loading,'Expense':n===1?250:500,'Remark':n===1?'Sample row - office supplies':'Sample row - travel expense'},
      fr:{destination:city,rate},
      trader:{'Sr. No.':sr,'Trader Name':trader,'Contact Person':'Demo Contact '+n,'Mobile Number':'','Alternate Mobile':'','Email':'demo'+n+'@example.com','City':city,'State':'Madhya Pradesh','GST Number':'','Address':'Demo address, replace before importing','Remark':remark},
      vehicle:{'Sr. No.':sr,'Vehicle Number':vehicle,'Truck Type':n===1?'12 Wheeler':'14 Wheeler','Owner Name':'Demo Owner '+n,'Owner Mobile':'','Alternate Mobile':'','Driver Name':'Demo Driver '+n,'Driver Mobile':'','City':city,'State':'Madhya Pradesh','RC Number':'','PAN Number':'','Aadhaar Number':'','Remark':remark}
    };
    return rows[sheet];
  }).filter(Boolean);
}
function srtImportDemoCSV(sheet){
  const cols=(COLS[sheet]||[]).filter(c=>!c.image),rows=srtImportDemoRows(sheet);
  if(!cols.length||!rows.length)throw new Error('No demo format is available for this module.');
  const escape=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  return '\uFEFF'+[cols.map(c=>c.l),...rows.map(row=>cols.map(c=>row[c.k]??''))].map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
}
function downloadImportDemo(sheet){
  try{
    const csv=srtImportDemoCSV(sheet);
    const names={inv:'Invoice',pay:'Payment',cp:'Company_Payment',rp:'Received_Payment',exp:'Expense',fr:'Freight_Rates',trader:'Trader_Details',vehicle:'Vehicle_Details'};
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download='SRT_'+names[sheet]+'_Import_Demo.csv';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    closeXport(sheet);
    toast('Demo CSV downloaded. Replace sample rows with your data before importing.','var(--cyan)');
  }catch(error){toast('Could not download the demo file: '+error.message,'var(--red)');}
}
