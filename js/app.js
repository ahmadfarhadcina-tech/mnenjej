const DB_KEY = "nuskha_yar_db_v1";
const $ = (id) => document.getElementById(id);
const todayISO = () => new Date().toLocaleDateString("en-CA");
const faNum = (n) => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2));
const escapeHtml = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const blankDB = () => ({patients:[], prescriptions:[], settings:{clinicName:"کلینیک من",clinicPhone:"",clinicAddress:"",clinicFooter:"این نسخه باید مطابق دستور داکتر استفاده شود."}});
let db = loadDB();
let currentPage = "dashboard";
let toastTimer;
function loadDB(){ try { const x=JSON.parse(localStorage.getItem(DB_KEY)||"null"); if(x && Array.isArray(x.patients)&&Array.isArray(x.prescriptions)) return {...blankDB(),...x,settings:{...blankDB().settings,...(x.settings||{})}}; } catch(e){} return blankDB(); }
function persist(){ try{localStorage.setItem(DB_KEY,JSON.stringify(db));return true}catch(e){showToast("ذخیره انجام نشد؛ حافظه مرورگر ممکن است پُر باشد.");return false} }
function showToast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3000)}
function showPage(page){currentPage=page;document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));if(page==="dashboard")renderDashboard();if(page==="patients")renderPatients();if(page==="prescriptions")renderPrescriptions();if(page==="newPrescription" && !$("editingPrescriptionId").value)prepareNewPrescription();if(page==="settings")fillSettings();window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.go)));
function todayLabel(){return new Intl.DateTimeFormat("fa-AF",{dateStyle:"full"}).format(new Date())}
$("todayLabel").textContent=todayLabel();
function empty(msg,sub=""){return `<div class="empty-state"><strong>${escapeHtml(msg)}</strong><span>${escapeHtml(sub)}</span></div>`}
function patientById(id){return db.patients.find(p=>p.id===id)}
function renderDashboard(){
 $("statPatients").textContent=faNum(db.patients.length);$("statPrescriptions").textContent=faNum(db.prescriptions.length);
 $("statToday").textContent=faNum(db.prescriptions.filter(p=>p.date===todayISO()).length);
 const list=[...db.prescriptions].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).slice(0,5);
 $("recentPrescriptions").innerHTML=list.length?tableHTML(["شماره نسخه","مریض","داکتر","تاریخ","عملیات"],list.map(p=>[`<b>${escapeHtml(p.number)}</b>`,escapeHtml(p.patientName),escapeHtml(p.doctorName),escapeHtml(p.date),actionButtons(p.id)])) : empty("هنوز نسخه‌ای ثبت نشده است","برای شروع، یک نسخه جدید بسازید.");
}
function tableHTML(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}
function actionButtons(id){return `<div class="row-actions"><button class="mini-btn" data-view="${id}">مشاهده</button><button class="mini-btn" data-edit="${id}">ویرایش</button><button class="mini-btn danger" data-delete="${id}">حذف</button></div>`}
function attachRowActions(root=document){root.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>viewPrescription(b.dataset.view));root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editPrescription(b.dataset.edit));root.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deletePrescription(b.dataset.delete));}
function renderPatients(){
 const q=$("patientSearch").value.trim().toLocaleLowerCase();
 const ps=db.patients.filter(p=>[p.name,p.phone,p.id].some(v=>String(v||"").toLocaleLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name,"fa"));
 $("patientCount").textContent=`${faNum(ps.length)} پرونده`;
 $("patientsTable").innerHTML=ps.length?tableHTML(["مریض","سن / جنسیت","شماره تماس","تعداد نسخه","عملیات"],ps.map(p=>{const count=db.prescriptions.filter(x=>x.patientId===p.id).length;return [`<div class="person-cell"><span class="avatar">${escapeHtml((p.name||"?").slice(0,1))}</span><div><b>${escapeHtml(p.name)}</b><small>شناسه: ${escapeHtml(p.id.slice(0,8))}</small></div></div>`,escapeHtml([p.age,p.gender].filter(Boolean).join(" / ")||"—"),escapeHtml(p.phone||"—"),faNum(count),`<div class="row-actions"><button class="mini-btn" data-patient-rx="${p.id}">نسخه جدید</button><button class="mini-btn danger" data-patient-delete="${p.id}">حذف</button></div>`]})):empty("مریضی پیدا نشد","نام یا شماره تماس را بررسی کنید.");
 $("patientsTable").querySelectorAll("[data-patient-rx]").forEach(b=>b.onclick=()=>{showPage("newPrescription");$("patientSelect").value=b.dataset.patientRx;$("patientSelect").dispatchEvent(new Event("change"));});
 $("patientsTable").querySelectorAll("[data-patient-delete]").forEach(b=>b.onclick=()=>deletePatient(b.dataset.patientDelete));
}
function renderPrescriptions(){
 const q=$("prescriptionSearch").value.trim().toLocaleLowerCase(),filter=$("prescriptionFilter").value;
 const ps=[...db.prescriptions].filter(p=>(filter!=="today"||p.date===todayISO())&&[p.number,p.patientName,p.doctorName,p.diagnosis].some(v=>String(v||"").toLocaleLowerCase().includes(q))).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
 $("prescriptionsTable").innerHTML=ps.length?tableHTML(["شماره نسخه","مریض","داکتر","تاریخ","دواها","عملیات"],ps.map(p=>[escapeHtml(p.number),escapeHtml(p.patientName),escapeHtml(p.doctorName),escapeHtml(p.date),faNum((p.medications||[]).length),actionButtons(p.id)])):empty("نسخه‌ای پیدا نشد","عبارت جست‌وجو یا فیلتر را تغییر دهید.");
 attachRowActions($("prescriptionsTable"));
}
$("patientSearch").addEventListener("input",renderPatients);$("prescriptionSearch").addEventListener("input",renderPrescriptions);$("prescriptionFilter").addEventListener("change",renderPrescriptions);
function nextNumber(){const year=new Date().getFullYear();return `RX-${year}-${String(db.prescriptions.length+1).padStart(5,"0")}`}
function prepareNewPrescription(){
 $("prescriptionForm").reset();$("editingPrescriptionId").value="";$("prescriptionFormTitle").textContent="نسخه جدید";$("prescriptionDate").value=todayISO();$("prescriptionNumber").value=nextNumber();fillPatientSelect();$("medicationsList").innerHTML="";addMedication();$("doctorName").value=db.settings.defaultDoctor||"";$("doctorInfo").value=db.settings.defaultDoctorInfo||"";
}
function fillPatientSelect(){const old=$("patientSelect").value;$("patientSelect").innerHTML='<option value="">— انتخاب مریض (اختیاری) —</option>'+[...db.patients].sort((a,b)=>a.name.localeCompare(b.name,"fa")).map(p=>`<option value="${p.id}">${escapeHtml(p.name)}${p.phone?" — "+escapeHtml(p.phone):""}</option>`).join("");if(patientById(old))$("patientSelect").value=old}
$("patientSelect").addEventListener("change",()=>{const p=patientById($("patientSelect").value);if(!p)return;$("patientName").value=p.name||"";$("patientAge").value=p.age||"";$("patientGender").value=p.gender||"";$("patientPhone").value=p.phone||"";$("allergies").value=p.allergies||""});
function addMedication(data={}){
 const card=document.createElement("div");card.className="med-card";
 card.innerHTML=`<div class="med-card-head"><b>دوا <span class="med-index"></span></b><button type="button" class="mini-btn danger remove-med">حذف دوا</button></div><div class="med-grid">
 <label class="field">نام دوا *<input class="med-name" required maxlength="160" placeholder="نام عمومی یا تجارتی دوا"></label>
 <label class="field">قدرت / شکل دوا<input class="med-strength" maxlength="100" placeholder="مثلاً ۵۰۰ mg، شربت"></label>
 <label class="field">مقدار در هر نوبت<input class="med-dose" maxlength="120" placeholder="طبق تجویز داکتر"></label>
 <label class="field">راه مصرف<input class="med-route" maxlength="100" placeholder="خوراکی، موضعی و غیره"></label>
 <label class="field">تعداد دفعات / فاصله<input class="med-frequency" maxlength="160" placeholder="طبق تجویز داکتر"></label>
 <label class="field">مدت استفاده<input class="med-duration" maxlength="100" placeholder="طبق تجویز داکتر"></label>
 <label class="field">مقدار قابل تحویل<input class="med-quantity" maxlength="80" placeholder="تعداد / حجم"></label>
 <label class="field">یادداشت دوا<input class="med-notes" maxlength="250" placeholder="دستور تأییدشده"></label>
 </div>`;
 $("medicationsList").appendChild(card);
 const fields={name:".med-name",strength:".med-strength",dose:".med-dose",route:".med-route",frequency:".med-frequency",duration:".med-duration",quantity:".med-quantity",notes:".med-notes"};
 Object.entries(fields).forEach(([k,s])=>{card.querySelector(s).value=data[k]||""});
 card.querySelector(".remove-med").onclick=()=>{if($("medicationsList").children.length===1){showToast("نسخه باید دست‌کم یک دوا داشته باشد.");return}card.remove();updateMedIndexes()};
 updateMedIndexes();
}
function updateMedIndexes(){$$(" .med-card").forEach((c,i)=>c.querySelector(".med-index").textContent=faNum(i+1))}
function $$(sel){return document.querySelectorAll(sel)}
$("addMedicationBtn").onclick=()=>addMedication();
function getMedications(){return [...$("medicationsList").querySelectorAll(".med-card")].map(c=>Object.fromEntries([["name",".med-name"],["strength",".med-strength"],["dose",".med-dose"],["route",".med-route"],["frequency",".med-frequency"],["duration",".med-duration"],["quantity",".med-quantity"],["notes",".med-notes"]].map(([k,s])=>[k,c.querySelector(s).value.trim()])))}
$("prescriptionForm").addEventListener("submit",e=>{
 e.preventDefault();
 if(!$("doctorConfirmed").checked){showToast("برای ذخیره، تأیید داکتر لازم است.");return}
 const meds=getMedications();if(!meds.length||meds.some(m=>!m.name)){showToast("نام دست‌کم یک دوا را وارد کنید.");return}
 const id=$("editingPrescriptionId").value||uid(),old=db.prescriptions.find(p=>p.id===id);
 let patientId=$("patientSelect").value;let p=patientById(patientId);
 const patientData={name:$("patientName").value.trim(),age:$("patientAge").value.trim(),gender:$("patientGender").value,phone:$("patientPhone").value.trim(),allergies:$("allergies").value.trim()};
 if(!patientData.name){showToast("نام مریض ضروری است.");return}
 if(p){Object.assign(p,patientData)}else{p={id:uid(),...patientData,createdAt:new Date().toISOString()};db.patients.push(p);patientId=p.id}
 const item={id,number:$("prescriptionNumber").value||nextNumber(),patientId,patientName:patientData.name,patientAge:patientData.age,patientGender:patientData.gender,patientPhone:patientData.phone,allergies:patientData.allergies,date:$("prescriptionDate").value,doctorName:$("doctorName").value.trim(),doctorInfo:$("doctorInfo").value.trim(),diagnosis:$("diagnosis").value.trim(),clinicalNotes:$("clinicalNotes").value.trim(),medications:meds,generalInstructions:$("generalInstructions").value.trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(old){db.prescriptions=db.prescriptions.map(x=>x.id===id?item:x)}else db.prescriptions.push(item);
 if(persist()){showToast(old?"نسخه ویرایش شد.":"نسخه ذخیره شد.");showPage("prescriptions");viewPrescription(id)}
});
function editPrescription(id){const p=db.prescriptions.find(x=>x.id===id);if(!p)return;showPage("newPrescription");$("editingPrescriptionId").value=p.id;$("prescriptionFormTitle").textContent="ویرایش نسخه";fillPatientSelect();$("patientSelect").value=p.patientId||"";["patientName","patientAge","patientGender","patientPhone","allergies","prescriptionDate","prescriptionNumber","doctorName","doctorInfo","diagnosis","clinicalNotes","generalInstructions"].forEach(k=>{const map={patientName:"patientName",patientAge:"patientAge",patientGender:"patientGender",patientPhone:"patientPhone",allergies:"allergies",prescriptionDate:"date",prescriptionNumber:"number",doctorName:"doctorName",doctorInfo:"doctorInfo",diagnosis:"diagnosis",clinicalNotes:"clinicalNotes",generalInstructions:"generalInstructions"};$ (k).value=p[map[k]]||""});$("medicationsList").innerHTML="";(p.medications||[]).forEach(addMedication);$("doctorConfirmed").checked=false}
function deletePrescription(id){const p=db.prescriptions.find(x=>x.id===id);if(!p||!confirm(`نسخه ${p.number} حذف شود؟ این کار برگشت‌پذیر نیست.`))return;db.prescriptions=db.prescriptions.filter(x=>x.id!==id);persist();renderPrescriptions();renderDashboard();showToast("نسخه حذف شد.")}
function deletePatient(id){const p=patientById(id);if(!p)return;const count=db.prescriptions.filter(x=>x.patientId===id).length;const msg=count?`برای ${p.name} تعداد ${count} نسخه ثبت شده. حذف پرونده، نسخه‌های ذخیره‌شده را حذف نمی‌کند. ادامه؟`:`پرونده ${p.name} حذف شود؟`;if(!confirm(msg))return;db.patients=db.patients.filter(x=>x.id!==id);persist();renderPatients();fillPatientSelect();renderDashboard();showToast("پرونده حذف شد.")}
function rxPaper(p){
 const s=db.settings;const meds=(p.medications||[]).map((m,i)=>`<div class="rx-med"><b>${faNum(i+1)}. ${escapeHtml(m.name)}${m.strength?" — "+escapeHtml(m.strength):""}</b><p>${[m.dose&&"مقدار: "+m.dose,m.route&&"راه مصرف: "+m.route,m.frequency&&"دفعات: "+m.frequency,m.duration&&"مدت: "+m.duration,m.quantity&&"مقدار تحویل: "+m.quantity].filter(Boolean).map(escapeHtml).join(" | ")||"جزئیات مصرف توسط داکتر تکمیل شود."}</p>${m.notes?`<p>${escapeHtml(m.notes)}</p>`:""}</div>`).join("");
 return `<div class="prescription-paper" dir="rtl"><div class="rx-head"><div><h2>${escapeHtml(s.clinicName||"کلینیک")}</h2><p>${escapeHtml(s.clinicAddress||"")}</p><p>${s.clinicPhone?"تماس: "+escapeHtml(s.clinicPhone):""}</p></div><div><b>نسخه طبی</b><p>شماره: ${escapeHtml(p.number)}</p><p>تاریخ: ${escapeHtml(p.date)}</p></div></div>
 <div class="rx-meta"><div><b>نام مریض:</b> ${escapeHtml(p.patientName)}</div><div><b>سن / جنسیت:</b> ${escapeHtml([p.patientAge,p.patientGender].filter(Boolean).join(" / ")||"—")}</div><div><b>شماره تماس:</b> ${escapeHtml(p.patientPhone||"—")}</div><div><b>حساسیت:</b> ${escapeHtml(p.allergies||"ثبت نشده")}</div><div><b>داکتر:</b> ${escapeHtml(p.doctorName)}</div><div><b>تخصص / جواز:</b> ${escapeHtml(p.doctorInfo||"—")}</div></div>
 ${p.diagnosis?`<div class="rx-section"><h3>تشخیص</h3><p>${escapeHtml(p.diagnosis)}</p></div>`:""}${p.clinicalNotes?`<div class="rx-section"><h3>یادداشت بالینی</h3><p>${escapeHtml(p.clinicalNotes)}</p></div>`:""}
 <div class="rx-section"><h3>Rx / ادویه تجویزشده</h3>${meds}</div>${p.generalInstructions?`<div class="rx-section"><h3>دستورهای عمومی</h3><p>${escapeHtml(p.generalInstructions)}</p></div>`:""}
 <div class="rx-sign"><div>امضا و مهر داکتر</div><div>تاریخ: ${escapeHtml(p.date)}</div></div><div class="rx-footer">${escapeHtml(s.clinicFooter||"")}<br>نسخه ثبت‌شده در سیستم؛ پیش از مصرف، دستور داکتر را رعایت کنید.</div></div>`;
}
function viewPrescription(id){const p=db.prescriptions.find(x=>x.id===id);if(!p)return;$("detailContent").innerHTML=`<div class="detail-actions"><button class="btn btn-primary" id="printRx">چاپ / ذخیره PDF</button><button class="btn btn-light" id="editRxFromDetail">ویرایش</button><button class="btn btn-light" id="closeDetail">بستن</button></div>${rxPaper(p)}`;$("detailDialog").showModal();$("printRx").onclick=()=>{document.body.classList.add("printing");window.print();setTimeout(()=>document.body.classList.remove("printing"),600)};$("editRxFromDetail").onclick=()=>{$("detailDialog").close();editPrescription(id)};$("closeDetail").onclick=()=>$("detailDialog").close()}
$("addPatientBtn").onclick=()=>$("patientDialog").showModal();$("closePatientDialog").onclick=()=>$("patientDialog").close();$("cancelPatient").onclick=()=>$("patientDialog").close();
$("patientForm").addEventListener("submit",e=>{e.preventDefault();const name=$("newPatientName").value.trim();if(!name)return;const p={id:uid(),name,age:$("newPatientAge").value.trim(),gender:$("newPatientGender").value,phone:$("newPatientPhone").value.trim(),allergies:"",createdAt:new Date().toISOString()};db.patients.push(p);if(persist()){$("patientDialog").close();$("patientForm").reset();renderPatients();fillPatientSelect();renderDashboard();showToast("مریض ثبت شد.")}});
function fillSettings(){const s=db.settings;$("clinicName").value=s.clinicName||"";$("clinicPhone").value=s.clinicPhone||"";$("clinicAddress").value=s.clinicAddress||"";$("clinicFooter").value=s.clinicFooter||"";$("sideClinicName").textContent=s.clinicName||"کلینیک من"}
$("settingsForm").addEventListener("submit",e=>{e.preventDefault();db.settings={...db.settings,clinicName:$("clinicName").value.trim(),clinicPhone:$("clinicPhone").value.trim(),clinicAddress:$("clinicAddress").value.trim(),clinicFooter:$("clinicFooter").value.trim()};if(persist()){fillSettings();showToast("تنظیمات ذخیره شد.")}});
$("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify({format:"nuskha-yar-backup-v1",exportedAt:new Date().toISOString(),data:db},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`nuskha-yar-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url);showToast("فایل پشتیبان آماده شد.")};
$("importFile").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());const incoming=parsed.data||parsed;if(!Array.isArray(incoming.patients)||!Array.isArray(incoming.prescriptions)||!incoming.settings)throw new Error("invalid");if(!confirm("بازیابی، اطلاعات فعلی این برنامه را با فایل پشتیبان جایگزین می‌کند. ادامه می‌دهید؟"))return;db={...blankDB(),...incoming,settings:{...blankDB().settings,...incoming.settings}};if(persist()){showToast("پشتیبان بازیابی شد.");renderDashboard();renderPatients();renderPrescriptions();fillSettings();fillPatientSelect()}}catch(err){showToast("فایل پشتیبان معتبر نیست.")}finally{e.target.value=""}});
window.addEventListener("afterprint",()=>document.body.classList.remove("printing"));
function init(){fillSettings();fillPatientSelect();renderDashboard();renderPatients();renderPrescriptions();prepareNewPrescription()}
init();
