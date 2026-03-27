/* ============================================================
   app.js — HabitForge: Daily Quest Log
   All application logic (auth guard, data, rendering, music)
   ============================================================ */

// ── Auth Guard ────────────────────────────────────────────────
// Redirect to login page if the user is not signed in.
let currentUser = null;

(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = session.user;
  document.getElementById('userEmail').textContent = currentUser.email;
  // Kick off the app now that we have a valid session
  initApp();
})();

// Keep session in sync across tabs
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') window.location.href = 'login.html';
});

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

// ── Constants ─────────────────────────────────────────────────
const GYM = '__gym__';
const today = new Date(); today.setHours(0,0,0,0);
let selectedMonth = { year: today.getFullYear(), month: today.getMonth() };

// ── Date Helpers ──────────────────────────────────────────────
function fmt(d){ return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function dk(d){ return d.toISOString().slice(0,10); }
function ck(tid,d){ return tid+'|'+d; }
function sk(tid,sid,d){ return tid+'||'+sid+'|'+d; }
function gk(eid,d){ return eid+'|'+d; }
function pfc(p){ return p===0?'p0':p<40?'plow':p<70?'pmid':'phigh'; }

// ── Exercises List ────────────────────────────────────────────
const EXERCISES = [
  {id:'ex_dl',   name:'Deadlift',        icon:'🏋️',type:'weight',points:10},
  {id:'ex_bp',   name:'Bench Press',     icon:'💪',type:'weight',points:10},
  {id:'ex_sq',   name:'Squats',          icon:'🦵',type:'weight',points:10},
  {id:'ex_ohp',  name:'Overhead Press',  icon:'🔝',type:'weight',points:8},
  {id:'ex_row',  name:'Barbell Rows',    icon:'🚣',type:'weight',points:8},
  {id:'ex_lp',   name:'Leg Press',       icon:'🦵',type:'weight',points:8},
  {id:'ex_lat',  name:'Lat Pulldown',    icon:'🏊',type:'weight',points:7},
  {id:'ex_curl', name:'Bicep Curls',     icon:'💪',type:'weight',points:6},
  {id:'ex_tri',  name:'Tricep Pushdown', icon:'🔽',type:'weight',points:6},
  {id:'ex_pu',   name:'Pull-ups',        icon:'🤸',type:'reps',  points:8},
  {id:'ex_push', name:'Pushups',         icon:'👊',type:'reps',  points:6},
  {id:'ex_dip',  name:'Dips',            icon:'⬇️',type:'reps',  points:6},
  {id:'ex_lunge',name:'Lunges',          icon:'🚶',type:'reps',  points:6},
  {id:'ex_plank',name:'Plank (secs)',    icon:'🧱',type:'reps',  points:5},
  {id:'ex_calf', name:'Calf Raises',     icon:'🦶',type:'reps',  points:4},
];

const DEFAULT_TASKS = [
  { id:'dt_sleep',   name:'Sleep 7-8 hours',       icon:'😴', points:15 },
  { id:'dt_water',   name:'Drink 2L water',         icon:'💧', points:10 },
  { id:'dt_walk',    name:'Walk 10,000 steps',      icon:'🏃', points:12 },
  { id:'dt_study',   name:'Study ≥ 2 hours',        icon:'📖', points:15 },
  { id:'dt_food',    name:'Eat healthy meals',      icon:'🍎', points:10 },
  { id:'dt_social',  name:'No social media ≥ 9hrs', icon:'📵', points:10 },
  { id:'dt_journal', name:'Journal & self-reflect', icon:'✍️', points:8  },
  { id:'dt_groom',   name:'Basic grooming',         icon:'🧼', points:5  },
  { id:'dt_read',    name:'Read 30 pages',          icon:'📚', points:10 },
  { id:'dt_meditate',name:'Meditation 10 min',      icon:'🧘', points:8  },
];

// ── State (loaded from Supabase) ──────────────────────────────
let tasks    = [];
let checks   = {};
let subtasks = {};
let subchecks= {};
let notes    = {};
let gymEx    = null;
let gymLogs  = {};
let openId   = null;
let gymDate  = dk(today);

// ── Local Storage Save (mirrors to avoid flicker) ─────────────
function save(){
  localStorage.setItem('hf2_tasks',   JSON.stringify(tasks));
  localStorage.setItem('hf2_checks',  JSON.stringify(checks));
  localStorage.setItem('hf2_subs',    JSON.stringify(subtasks));
  localStorage.setItem('hf2_subck',   JSON.stringify(subchecks));
  localStorage.setItem('hf2_notes',   JSON.stringify(notes));
  localStorage.setItem('hf2_gymex',   JSON.stringify(gymEx));
  localStorage.setItem('hf2_gymlogs', JSON.stringify(gymLogs));
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type='error'){
  const el = document.createElement('div');
  el.textContent = msg;
  const bg = type==='success' ? '#7bc87a' : '#d4685a';
  el.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:10px 18px;font-size:12px;z-index:9999;border-radius:4px;`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),4000);
}

// ── Month Navigation ──────────────────────────────────────────
function buildMonthOptions(){
  const sel = document.getElementById('monthSelect');
  if(!sel) return;
  sel.innerHTML = '';
  for(let i=11;i>=0;i--){
    const d = new Date(today.getFullYear(),today.getMonth()-i,1);
    const opt = document.createElement('option');
    opt.value = d.getFullYear()+'-'+d.getMonth();
    opt.textContent = d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    if(d.getFullYear()===selectedMonth.year&&d.getMonth()===selectedMonth.month) opt.selected=true;
    sel.appendChild(opt);
  }
}
function onMonthChange(){
  const sel = document.getElementById('monthSelect');
  const [y,m] = sel.value.split('-').map(Number);
  selectedMonth = {year:y,month:m};
  renderTable();
}
function jumpToCurrentMonth(){
  selectedMonth = {year:today.getFullYear(),month:today.getMonth()};
  buildMonthOptions();
  renderTable();
}

// ── Get Date Array for Selected Month ─────────────────────────
function getDates(){
  const a=[], y=selectedMonth.year, m=selectedMonth.month;
  const daysInMonth = new Date(y,m+1,0).getDate();
  for(let i=1;i<=daysInMonth;i++){
    const d = new Date(y,m,i);
    if(d>today) break;
    a.push(d);
  }
  return a;
}

// ── Score Calculation ─────────────────────────────────────────
function gymScore(d){
  if(!gymEx||!gymEx.length) return 0;
  const total  = gymEx.reduce((s,eid)=>{const e=EXERCISES.find(x=>x.id===eid);return s+(e?e.points:0);},0);
  const earned = gymEx.reduce((s,eid)=>{const e=EXERCISES.find(x=>x.id===eid);const l=gymLogs[gk(eid,d)];return s+(l&&l.done&&e?e.points:0);},0);
  return total>0?Math.round((earned/total)*100):0;
}

function dayScore(d){
  const gymPts=20;
  const wentGym = gymEx&&gymEx.some(eid=>{const l=gymLogs[gk(eid,d)];return l&&l.done;});
  let total=gymPts, earned=wentGym?gymPts:0;
  tasks.forEach(t=>{
    total+=t.points;
    const subs=subtasks[t.id]||[];
    if(!subs.length){ if(checks[ck(t.id,d)]) earned+=t.points; }
    else{
      const mainDone=checks[ck(t.id,d)];
      const st=subs.reduce((s,sb)=>s+sb.points,0);
      const se=subs.filter(sb=>subchecks[sk(t.id,sb.id,d)]).reduce((s,sb)=>s+sb.points,0);
      const subPct=st?se/st:0;
      earned+=t.points*Math.max(mainDone?1:0,subPct);
    }
  });
  return total?Math.round((earned/total)*100):0;
}

function monthAvg(){
  const dates=getDates();
  const active=dates.filter(d=>{const dk2=dk(d);return tasks.some(t=>checks[ck(t.id,dk2)]||((subtasks[t.id]||[]).some(sb=>subchecks[sk(t.id,sb.id,dk2)])));});
  if(!active.length) return 0;
  return Math.round(active.reduce((s,d)=>s+dayScore(dk(d)),0)/active.length);
}

function streak(){
  let n=0; const d=new Date(today);
  while(n<366){ if(dayScore(dk(d))>=50){n++;d.setDate(d.getDate()-1);}else break; }
  return n;
}

function gymDays(){ return getDates().filter(d=>gymEx&&gymEx.some(eid=>{const l=gymLogs[gk(eid,dk(d))];return l&&l.done;})).length; }

// ── Tasks CRUD ────────────────────────────────────────────────
async function addTask(){
  const name = document.getElementById('tName').value.trim();
  const icon = document.getElementById('tIcon').value;
  const pts  = parseInt(document.getElementById('tPts').value)||10;
  if(!name){ document.getElementById('tName').focus(); return; }

  const { data, error } = await supabaseClient
    .from('tasks')
    .insert([{ name, icon, points:pts, user_id: currentUser.id }])
    .select()
    .single();

  if(error){ showToast('⚠️ Error saving task: '+error.message); return; }

  tasks.push({ id: data.id, name, icon, points:pts });
  save();
  document.getElementById('tName').value = '';
  renderAll();
  showToast('✓ Habit added!','success');
}

async function delTask(id){
  if(!confirm('Remove this habit?')) return;
  await supabaseClient.from('tasks').delete().eq('id',id);
  tasks = tasks.filter(t=>t.id!==id);
  save(); renderAll();
}

// ── Checks ────────────────────────────────────────────────────
async function togCheck(tid,d){
  const k=ck(tid,d);
  checks[k]=!checks[k];
  save(); renderAll();
  await supabaseClient.from('checks').upsert({id:k, checked:checks[k], user_id:currentUser.id});
}

// ── Subtasks ──────────────────────────────────────────────────
function addSub(tid){
  const name=document.getElementById('snInput').value.trim();
  const pts=parseInt(document.getElementById('spInput').value)||10;
  if(!name) return;
  if(!subtasks[tid]) subtasks[tid]=[];
  subtasks[tid].push({id:Date.now().toString(),name,points:pts});
  save(); buildHabitPanel(tid); renderAll();
}
function delSub(tid,sid){ subtasks[tid]=(subtasks[tid]||[]).filter(s=>s.id!==sid); save(); buildHabitPanel(tid); renderAll(); }
function togSubCheck(tid,sid,d){ const k=sk(tid,sid,d); subchecks[k]=!subchecks[k]; save(); buildHabitPanel(tid); renderAll(); }
async function saveNote(tid,v){ notes[tid]=v; save(); await supabaseClient.from('notes').upsert({id:tid+':'+currentUser.id, content:v, user_id:currentUser.id}); }

// ── Render All ────────────────────────────────────────────────
function renderAll(){
  buildMonthOptions(); renderTable(); renderStats(); renderMonthly();
  if(openId===GYM) buildGymPanel(); else if(openId) buildHabitPanel(openId);
}

// ── Stats Row ─────────────────────────────────────────────────
function renderStats(){
  const tk=dk(today);
  document.getElementById('sToday').textContent   = dayScore(tk)+'%';
  document.getElementById('sMonth').textContent   = monthAvg()+'%';
  document.getElementById('sStreak').textContent  = streak()+'d';
  document.getElementById('sGym').textContent     = gymDays()+'d';
  document.getElementById('sHabits').textContent  = tasks.length;
  document.getElementById('curMonth').textContent = today.toLocaleDateString('en-US',{month:'long',year:'numeric'});
}

// ── Main Table ────────────────────────────────────────────────
function renderTable(){
  const wrap=document.getElementById('tableWrap');
  const cols=[{id:GYM,name:'Gym',icon:'🏋️',points:20,isGym:true},...tasks];
  const dates=getDates(), todayK=dk(today);
  let html='<table><thead><tr><th class="date-col">Date</th><th class="score-col">Score</th>';
  cols.forEach(t=>{
    html+=`<th class="task-col"><div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
      <span style="font-size:17px;">${t.icon}</span>
      <span style="font-size:10px;color:var(--muted);max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</span>
      <span style="font-size:10px;color:${t.isGym?'var(--gym)':'var(--accent2)'};">${t.isGym?'tracker':t.points+'pt'}</span>
      <button class="open-btn${t.isGym?' gym-open-btn':''}" onclick="openPanel('${t.id}')">${t.isGym?'Log Gym':'Open'}</button>
      ${!t.isGym?`<button class="del-btn" onclick="event.stopPropagation();delTask('${t.id}')">×</button>`:''}
    </div></th>`;
  });
  html+='</tr></thead><tbody>';
  if(!tasks.length){
    html+=`<tr><td colspan="3" style="padding:28px 20px;text-align:center;">
      <div style="color:var(--muted);font-size:13px;line-height:2;">
        <div style="font-size:24px;margin-bottom:8px;opacity:.4;">☝️</div>
        Add a habit above — checkboxes will appear as columns here.
      </div></td></tr>`;
  }
  dates.forEach(d=>{
    const dk2=dk(d), isT=dk2===todayK, sc=dayScore(dk2), fc=pfc(sc);
    html+=`<tr class="${isT?'today-row':''}">
      <td class="date-cell${isT?' td-today':''}" onclick="openDayPanel('${dk2}')">${isT?'● ':''}${fmt(d)} <span style="font-size:10px;opacity:.4;">↗</span></td>
      <td><div class="progress-wrap"><div class="progress-bar"><div class="progress-fill ${fc}" style="width:${sc}%"></div></div><span class="pct-text">${sc}%</span></div></td>`;
    cols.forEach(t=>{
      html+='<td class="task-check">';
      if(t.isGym){
        const wentToGym=gymEx&&gymEx.some(eid=>{const l=gymLogs[gk(eid,dk2)];return l&&l.done;});
        html+=`<div style="display:flex;align-items:center;gap:6px;justify-content:center;">
          ${wentToGym?'<span style="font-size:15px;">💪</span>':'<span style="font-size:13px;color:var(--surface3);">—</span>'}
          <button class="open-btn gym-open-btn" onclick="openGymForDate('${dk2}')" style="padding:3px 8px;font-size:10px;">Log</button>
        </div>`;
      } else {
        const chk=checks[ck(t.id,dk2)];
        html+=`<div class="check-box${chk?' ck':''}" onclick="togCheck('${t.id}','${dk2}')"></div>`;
      }
      html+='</td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table>';
  wrap.innerHTML=html;
}

// ── Monthly View ──────────────────────────────────────────────
let selectedMonthlyMonth={year:today.getFullYear(),month:today.getMonth()};

function buildMonthlyOptions(){
  const sel=document.getElementById('monthlyMonthSelect');
  if(!sel) return;
  sel.innerHTML='';
  for(let i=11;i>=0;i--){
    const d=new Date(today.getFullYear(),today.getMonth()-i,1);
    const opt=document.createElement('option');
    opt.value=d.getFullYear()+'-'+d.getMonth();
    opt.textContent=d.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    if(d.getFullYear()===selectedMonthlyMonth.year&&d.getMonth()===selectedMonthlyMonth.month) opt.selected=true;
    sel.appendChild(opt);
  }
}
function onMonthlyMonthChange(){
  const sel=document.getElementById('monthlyMonthSelect');
  const [y,m]=sel.value.split('-').map(Number);
  selectedMonthlyMonth={year:y,month:m};
  renderMonthly();
}
function getMonthlyDates(){
  const a=[], y=selectedMonthlyMonth.year, m=selectedMonthlyMonth.month;
  const daysInMonth=new Date(y,m+1,0).getDate();
  for(let i=1;i<=daysInMonth;i++){
    const d=new Date(y,m,i);
    if(d>today) break;
    a.push(d);
  }
  return a;
}

function renderMonthly(){
  buildMonthlyOptions();
  const dates=getMonthlyDates(), totalDays=dates.length;
  if(!totalDays){ document.getElementById('monthBars').innerHTML='<p style="color:var(--muted);font-size:12px;">No data yet for this month.</p>'; return; }
  const monthLabel=new Date(selectedMonthlyMonth.year,selectedMonthlyMonth.month,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  document.getElementById('monthlyTitle').textContent=monthLabel;
  const avgScore=Math.round(dates.reduce((s,d)=>s+dayScore(dk(d)),0)/totalDays);
  const gymDaysMonth=dates.filter(d=>gymEx&&gymEx.some(eid=>{const l=gymLogs[gk(eid,dk(d))];return l&&l.done;})).length;
  const bestDay=dates.reduce((best,d)=>{const s=dayScore(dk(d));return s>best.s?{s,d}:{...best};},{s:0,d:null});
  const bestDayStr=bestDay.d?bestDay.d.toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';
  document.getElementById('monthlyStats').innerHTML=`
    <div class="stat-card"><div class="stat-label">Avg Score</div><div class="stat-value c-purple">${avgScore}%</div></div>
    <div class="stat-card"><div class="stat-label">Gym Days</div><div class="stat-value c-gym">${gymDaysMonth}</div></div>
    <div class="stat-card"><div class="stat-label">Days Logged</div><div class="stat-value c-green">${totalDays}</div></div>
    <div class="stat-card"><div class="stat-label">Best Day</div><div class="stat-value c-amber" style="font-size:13px;">${bestDayStr}</div></div>
  `;
  let html='';
  const gp=totalDays?Math.round((gymDaysMonth/totalDays)*100):0;
  html+=`<div class="month-bar-row"><span class="mbl">🏋️ Gym</span><div class="mbb"><div class="mbf mbf-gym" style="width:${gp}%"></div></div><span class="mbp">${gp}%</span></div>`;
  tasks.forEach(t=>{
    const subs=subtasks[t.id]||[];
    const act=dates.filter(d=>{const dk2=dk(d);return subs.length?subs.some(sb=>subchecks[sk(t.id,sb.id,dk2)]):checks[ck(t.id,dk2)];}).length;
    const p=totalDays?Math.round((act/totalDays)*100):0;
    html+=`<div class="month-bar-row"><span class="mbl">${t.icon} ${t.name.slice(0,12)}</span><div class="mbb"><div class="mbf" style="width:${p}%"></div></div><span class="mbp">${p}%</span></div>`;
  });
  if(!tasks.length) html+=`<p style="color:var(--muted);font-size:12px;margin-top:10px;">Add habits to see them here.</p>`;
  document.getElementById('monthBars').innerHTML=html;
}

// ── View Switcher ─────────────────────────────────────────────
function showView(v){
  document.getElementById('trackerView').style.display=v==='tracker'?'':'none';
  document.getElementById('monthlyView').style.display=v==='monthly'?'':'none';
  document.querySelectorAll('.nav-tab').forEach((el,i)=>el.classList.toggle('active',(i===0&&v==='tracker')||(i===1&&v==='monthly')));
}

// ── Panel (Side Drawer) ───────────────────────────────────────
function openPanel(id){
  openId=id;
  document.getElementById('overlay').style.display='flex';
  if(id===GYM){
    gymDate=dk(today);
    document.getElementById('pIcon').textContent='🏋️';
    document.getElementById('pTitle').textContent='Gym';
    document.getElementById('pGymBadge').style.display='';
    buildGymPanel();
  } else {
    const t=tasks.find(x=>x.id===id); if(!t) return;
    document.getElementById('pIcon').textContent=t.icon;
    document.getElementById('pTitle').textContent=t.name;
    document.getElementById('pGymBadge').style.display='none';
    buildHabitPanel(id);
  }
}
function closePanelOutside(e){
  if(!e||e.target===document.getElementById('overlay')){
    document.getElementById('overlay').style.display='none'; openId=null;
  }
}

// ── Gym Panel ─────────────────────────────────────────────────
function buildGymPanel(){
  const d=gymDate, isT=(d===dk(today));
  const activeEx=gymEx.map(eid=>EXERCISES.find(e=>e.id===eid)).filter(Boolean);
  const removedEx=EXERCISES.filter(e=>!gymEx.includes(e.id));
  const dObj=new Date(d+'T00:00:00');
  const nextD=new Date(dObj); nextD.setDate(dObj.getDate()+1);
  const canNext=nextD<=today;
  let html=`
  <div class="date-nav">
    <button class="dnav-btn" onclick="gymNav(-1)">← Prev</button>
    <span class="date-nav-label">${fmt(dObj)}${isT?' (Today)':''}</span>
    <button class="dnav-btn" onclick="gymNav(1)" ${canNext?'':'disabled'}>Next →</button>
    ${!isT?`<button class="dnav-btn" onclick="gymNavToday()" style="color:var(--accent2);">Today</button>`:''}
  </div>
  <div class="micro-title">Exercises — log sets, reps &amp; weight, then mark done</div>`;
  activeEx.forEach(ex=>{
    const l=gymLogs[gk(ex.id,d)]||{};
    const done=l.done||false, isW=(ex.type==='weight');
    html+=`<div class="exercise-card${done?' ex-done':''}">
      <div class="ex-header">
        <span class="ex-icon">${ex.icon}</span>
        <span class="ex-name">${ex.name}</span>
        <span class="ex-type ${isW?'t-weight':'t-reps'}">${isW?'Weight':'Reps'}</span>
        <button class="rm-btn" onclick="removeEx('${ex.id}')">✕ Remove</button>
      </div>
      <div class="ex-inputs">
        <div class="ex-field"><label>Sets</label><input type="number" min="0" max="99" placeholder="—" value="${l.sets||''}" oninput="logGym('${ex.id}','sets',this.value)" /></div>
        <div class="ex-field"><label>Reps</label><input type="number" min="0" max="999" placeholder="—" value="${l.reps||''}" oninput="logGym('${ex.id}','reps',this.value)" /></div>
        ${isW?`<div class="ex-field"><label>Weight (kg)</label><input type="number" min="0" max="999" step="0.5" placeholder="—" value="${l.weight||''}" oninput="logGym('${ex.id}','weight',this.value)" /></div>`:''}
        <div class="ex-field"><label>&nbsp;</label>
          <button class="done-toggle${done?' is-done':''}" onclick="togGymDone('${ex.id}')">
            <span class="done-dot"></span>${done?'Done ✓':'Mark Done'}
          </button>
        </div>
      </div>
    </div>`;
  });
  if(removedEx.length){
    html+=`<div class="micro-title" style="margin-top:18px;">Removed — click to restore</div><div style="display:flex;flex-wrap:wrap;gap:8px;">`;
    removedEx.forEach(ex=>{ html+=`<button class="btn btn-ghost btn-sm" onclick="restoreEx('${ex.id}')">${ex.icon} ${ex.name}</button>`; });
    html+='</div>';
  }
  html+=`<div class="notes-section"><div class="notes-label">Session Notes</div>
    <textarea placeholder="Notes for this session..." onchange="saveGymNote('${d}',this.value)">${notes[GYM+':'+d]||''}</textarea>
  </div>`;
  document.getElementById('pBody').innerHTML=html;
}

function gymNav(dir){
  const d=new Date(gymDate+'T00:00:00');
  d.setDate(d.getDate()+dir);
  if(d>today) return;
  gymDate=dk(d); buildGymPanel(); renderAll();
}
function gymNavToday(){ gymDate=dk(today); buildGymPanel(); renderAll(); }

async function logGym(eid,field,val){
  const k=gk(eid,gymDate);
  if(!gymLogs[k]) gymLogs[k]={};
  gymLogs[k][field]=val;
  save(); renderAll();
  await supabaseClient.from('gym_logs').upsert({id:k+':'+currentUser.id,...gymLogs[k], user_id:currentUser.id});
}
async function togGymDone(eid){
  const k=gk(eid,gymDate);
  if(!gymLogs[k]) gymLogs[k]={};
  gymLogs[k].done=!gymLogs[k].done;
  save(); buildGymPanel(); renderAll();
  await supabaseClient.from('gym_logs').upsert({id:k+':'+currentUser.id,...gymLogs[k], user_id:currentUser.id});
}
function removeEx(eid){ gymEx=gymEx.filter(id=>id!==eid); save(); buildGymPanel(); renderAll(); }
function restoreEx(eid){
  if(!gymEx.includes(eid)){
    const ordered=EXERCISES.filter(e=>gymEx.includes(e.id)||e.id===eid).map(e=>e.id);
    gymEx=ordered;
  }
  save(); buildGymPanel(); renderAll();
}
async function saveGymNote(d,v){
  const k=GYM+':'+d;
  notes[k]=v; save();
  await supabaseClient.from('notes').upsert({id:k+':'+currentUser.id, content:v, user_id:currentUser.id});
}
function openGymForDate(dateStr){
  gymDate=dateStr; openId=GYM;
  document.getElementById('pIcon').textContent='🏋️';
  document.getElementById('pTitle').textContent='Gym';
  document.getElementById('pGymBadge').style.display='';
  buildGymPanel();
  document.getElementById('overlay').style.display='flex';
}

// ── Habit Panel ───────────────────────────────────────────────
function buildHabitPanel(tid){
  const t=tasks.find(x=>x.id===tid); if(!t) return;
  const subs=subtasks[tid]||[], dk2=dk(today);
  let html=`<div class="micro-title">Sub-goals (today)</div>
  <div class="subtask-table-wrap"><table>
    <thead><tr><th>Goal</th><th>Points</th><th>Done</th><th></th></tr></thead><tbody>`;
  if(!subs.length){ html+='<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px;font-size:13px;">No sub-goals yet.</td></tr>'; }
  else subs.forEach(sb=>{
    const chk=subchecks[sk(tid,sb.id,dk2)];
    html+=`<tr><td style="font-size:13px;">${sb.name}</td><td><span class="task-badge">${sb.points}pt</span></td>
      <td><div class="check-box${chk?' ck':''}" onclick="togSubCheck('${tid}','${sb.id}','${dk2}')"></div></td>
      <td><button class="del-btn" onclick="delSub('${tid}','${sb.id}')">×</button></td></tr>`;
  });
  html+=`</tbody></table></div>
  <div class="add-sub-row">
    <div class="field-group"><div class="field-label">Goal name</div><input type="text" id="snInput" placeholder="e.g. Morning run" style="min-width:165px;" /></div>
    <div class="field-group"><div class="field-label">Points</div><input type="number" id="spInput" value="10" min="1" max="100" style="width:74px;" /></div>
    <button class="btn btn-primary btn-sm" onclick="addSub('${tid}')">+ Add</button>
  </div>
  <div class="notes-section"><div class="notes-label">Notes</div>
    <textarea placeholder="Write anything..." onchange="saveNote('${tid}',this.value)">${notes[tid]||''}</textarea>
  </div>`;
  document.getElementById('pBody').innerHTML=html;
}

// ── Day Panel ─────────────────────────────────────────────────
function openDayPanel(dateStr){
  const dObj=new Date(dateStr+'T00:00:00');
  document.getElementById('dayPanelTitle').textContent=dObj.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  buildDayPanel(dateStr);
  document.getElementById('dayOverlay').style.display='flex';
}
function closeDayPanel(e){
  if(!e||e.target===document.getElementById('dayOverlay'))
    document.getElementById('dayOverlay').style.display='none';
}
function buildDayPanel(d){
  const sc=dayScore(d), fc=sc===0?'p0':sc<40?'plow':sc<70?'pmid':'phigh';
  const fcColor=sc===0?'var(--muted)':sc<40?'var(--red)':sc<70?'var(--amber)':'var(--green)';
  let html=`<div style="background:var(--surface);border:1px solid var(--border);padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:16px;">
    <div style="flex:1;"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Daily Score</div>
    <div class="progress-wrap"><div class="progress-bar"><div class="progress-fill ${fc}" style="width:${sc}%"></div></div><span class="pct-text">${sc}%</span></div></div>
    <div style="font-size:32px;font-weight:600;color:${fcColor};">${sc}%</div>
  </div>`;
  const gymAnyLogged=gymEx&&gymEx.some(eid=>{const l=gymLogs[gk(eid,d)];return l&&(l.sets||l.reps||l.weight||l.done);});
  html+=`<div class="micro-title" style="margin-top:0;">🏋️ Gym</div>`;
  if(!gymAnyLogged){
    html+=`<div style="background:var(--surface);border:1px solid var(--border);padding:14px 16px;color:var(--muted);font-size:13px;">Rest day — no gym activity logged.</div>`;
  } else {
    html+=`<div style="display:flex;flex-direction:column;gap:8px;">`;
    gymEx.forEach(eid=>{
      const ex=EXERCISES.find(e=>e.id===eid); if(!ex) return;
      const l=gymLogs[gk(eid,d)];
      if(!l||(!(l.sets||l.reps||l.weight||l.done))) return;
      const done=l.done||false, isW=(ex.type==='weight');
      html+=`<div style="background:var(--surface);border:1px solid ${done?'rgba(62,207,142,.3)':'var(--border)'};padding:12px 14px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:18px;">${ex.icon}</span>
        <span style="font-size:13px;font-weight:500;flex:1;">${ex.name}</span>
        <div style="display:flex;gap:10px;font-size:12px;color:var(--muted);">
          ${l.sets?`<span><span style="color:var(--text)">${l.sets}</span> sets</span>`:''}
          ${l.reps?`<span><span style="color:var(--text)">${l.reps}</span> reps</span>`:''}
          ${isW&&l.weight?`<span><span style="color:var(--text)">${l.weight}</span> kg</span>`:''}
        </div>
        ${done?`<span style="font-size:11px;background:var(--green-dim);color:var(--green);padding:2px 8px;">Done</span>`:`<span style="font-size:11px;background:var(--surface2);color:var(--muted);padding:2px 8px;">Logged</span>`}
      </div>`;
    });
    const gymNote=notes[GYM+':'+d];
    if(gymNote){ html+=`<div style="background:var(--surface);border:1px solid var(--border);padding:12px 14px;font-size:13px;color:var(--muted);line-height:1.6;">${gymNote}</div>`; }
    html+='</div>';
  }
  if(tasks.length){
    html+=`<div class="micro-title">✅ Habits</div><div style="display:flex;flex-direction:column;gap:8px;">`;
    tasks.forEach(t=>{
      const done=checks[ck(t.id,d)]||false;
      const subs=subtasks[t.id]||[], doneSubs=subs.filter(sb=>subchecks[sk(t.id,sb.id,d)]);
      html+=`<div style="background:var(--surface);border:1px solid ${done?'rgba(108,99,255,.3)':'var(--border)'};padding:12px 14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:17px;">${t.icon}</span>
          <span style="font-size:13px;font-weight:500;flex:1;">${t.name}</span>
          ${done?`<span style="font-size:11px;background:var(--accent-dim);color:var(--accent2);padding:2px 8px;">Done</span>`:`<span style="font-size:11px;background:var(--surface2);color:var(--muted);padding:2px 8px;">Not done</span>`}
        </div>
        ${doneSubs.length?`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;">
          ${doneSubs.map(sb=>`<span style="font-size:11px;background:var(--green-dim);color:var(--green);padding:2px 8px;">✓ ${sb.name}</span>`).join('')}
        </div>`:''}
      </div>`;
    });
    html+='</div>';
  }
  const journalKey='journal:'+d;
  const journalVal=notes[journalKey]||'';
  html+=`<div class="notes-section">
    <div class="notes-label">📝 Journal — how was your day?</div>
    <textarea id="dayJournal" placeholder="Write about your day..." style="min-height:130px;" onchange="saveDayJournal('${d}',this.value)">${journalVal}</textarea>
  </div>`;
  document.getElementById('dayPanelBody').innerHTML=html;
}
function saveDayJournal(d,v){ notes['journal:'+d]=v; save(); }

// ── Theme Engine ──────────────────────────────────────────────
const THEMES=[
  {id:'retro',   name:'Retro Harvest',    desc:'Stardew Valley vibes — cozy pixel adventure',     cls:'',          preview:'linear-gradient(135deg,#1a1510 0%,#332e27 50%,#c8a96e 100%)',dots:['#c8a96e','#7bc87a','#332e27']},
  {id:'ghibli',  name:'Studio Ghibli',    desc:'Soft watercolour — nature & wonder',               cls:'t-ghibli',  preview:'linear-gradient(135deg,#d4e8d8 0%,#f0ede6 50%,#a8cbb8 100%)',dots:['#5a8a6a','#c8922a','#f0ede6']},
  {id:'kdrama',  name:'K-Drama',          desc:'Elegant ink & rose gold — romance & ambition',     cls:'t-kdrama',  preview:'linear-gradient(135deg,#fdf8f5 0%,#f5ece6 50%,#c4705a 100%)',dots:['#c4705a','#2a1f1a','#fdf8f5']},
  {id:'pixar',   name:'Pixar Adventure',  desc:'Bold & joyful — every day is a quest',             cls:'t-pixar',   preview:'linear-gradient(135deg,#1a2a4a 0%,#243a64 50%,#f0b030 100%)',dots:['#f0b030','#40cc80','#1a2a4a']},
  {id:'cyber',   name:'Cyberpunk Seoul',  desc:'Neon rain & night markets — future is now',        cls:'t-cyber',   preview:'linear-gradient(135deg,#080c14 0%,#101828 50%,#00dcc8 100%)', dots:['#00dcc8','#c030f0','#f0c030']},
  {id:'moctale', name:'Moctale Dark',     desc:'Cinematic deep black — streaming at midnight',     cls:'t-moctale', preview:'linear-gradient(135deg,#0c0c0e 0%,#1c1c1f 50%,#7c3aed 100%)', dots:['#7c3aed','#ec4899','#10d9a0']},
];
const THEME_TABS={retro:['▶ Tracker','◈ Monthly'],ghibli:['▶ Journey','◈ Chronicle'],kdrama:['▶ Journey','◇ Chronicle'],pixar:['▶ Tracker','◈ Monthly'],cyber:['▶ Tracker','◈ Monthly'],moctale:['▶ Tracker','◈ Monthly']};
let currentTheme=localStorage.getItem('hf2_theme')||'retro';

function applyTheme(id){
  const theme=THEMES.find(t=>t.id===id)||THEMES[0];
  document.body.className=theme.cls;
  currentTheme=id;
  localStorage.setItem('hf2_theme',id);
  const tabs=THEME_TABS[id]||THEME_TABS.retro;
  const navTabs=document.querySelectorAll('.nav-tab');
  if(navTabs[0]) navTabs[0].textContent=tabs[0];
  if(navTabs[1]) navTabs[1].textContent=tabs[1];
  updateDecorations(id);
}
function updateDecorations(id){
  let el=document.getElementById('themeDecor');
  if(el) el.remove();
  if(id==='ghibli'){
    const d=document.createElement('div');
    d.id='themeDecor';
    d.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
    d.innerHTML=`<svg style="position:absolute;top:0;left:0;width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8d9f0" stop-opacity="0.25"/><stop offset="100%" stop-color="#e8f4e8" stop-opacity="0.05"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#sky)"/>
      <g opacity="0.55" transform="translate(18,60)"><circle cx="10" cy="10" r="8" fill="#7ab87a"/><circle cx="22" cy="10" r="8" fill="#7ab87a"/><circle cx="16" cy="2" r="8" fill="#7ab87a"/><circle cx="16" cy="18" r="8" fill="#7ab87a"/><rect x="14" y="18" width="4" height="14" rx="2" fill="#5a8a5a"/></g>
      <g transform="translate(calc(100% - 80px), 20)" opacity="0.7"><circle cx="20" cy="20" r="18" fill="#2a2a2a"/><circle cx="13" cy="16" r="4" fill="white"/><circle cx="27" cy="16" r="4" fill="white"/><circle cx="14" cy="17" r="2" fill="#1a1a1a"/><circle cx="28" cy="17" r="2" fill="#1a1a1a"/></g>
    </svg>`;
    document.body.appendChild(d);
  } else if(id==='kdrama'){
    const d=document.createElement('div');
    d.id='themeDecor';
    d.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
    d.innerHTML=`<svg style="position:absolute;top:0;left:0;width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.35" transform="translate(0,40)">
        <line x1="60" y1="0" x2="40" y2="120" stroke="#c8a090" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="40" y1="120" x2="10" y2="200" stroke="#c8a090" stroke-width="1.8" stroke-linecap="round"/>
        <g transform="translate(20,55)"><circle cx="0" cy="0" r="5" fill="#e8b8b0"/><circle cx="9" cy="-4" r="5" fill="#e8c8c0"/><circle cx="9" cy="6" r="5" fill="#d8a8a0"/></g>
      </g>
    </svg>`;
    document.body.appendChild(d);
  }
}
function openThemePicker(){ buildThemeGrid(); document.getElementById('themeOverlay').style.display='flex'; }
function closeThemePicker(e){ if(!e||e.target===document.getElementById('themeOverlay')) document.getElementById('themeOverlay').style.display='none'; }
function buildThemeGrid(){
  const grid=document.getElementById('themeGrid');
  grid.innerHTML=THEMES.map(t=>`
    <div class="theme-card${t.id===currentTheme?' active-theme':''}" onclick="selectTheme('${t.id}')">
      <div class="theme-card-preview" style="background:${t.preview};">
        <div style="position:absolute;bottom:8px;left:8px;display:flex;gap:4px;">${t.dots.map(c=>`<div style="width:10px;height:10px;border-radius:50%;background:${c};"></div>`).join('')}</div>
      </div>
      <div class="theme-card-name">${t.name}</div>
      <div class="theme-card-desc">${t.desc}</div>
      ${t.id===currentTheme?'<div class="active-badge">active</div>':''}
    </div>`).join('');
}
function selectTheme(id){ applyTheme(id); buildThemeGrid(); }

// ── Welcome Banner ────────────────────────────────────────────
function dismissWelcome(){
  const banner=document.getElementById('welcomeBanner');
  if(banner){ banner.style.opacity='0'; banner.style.transition='opacity .3s'; setTimeout(()=>banner.style.display='none',300); }
}

// ── Chiptune Music Engine ─────────────────────────────────────
let audioCtx=null, musicPlaying=false, musicNodes=[], musicLoop=null;
let trackIdx=0;
const TRACKS=[
  {name:'village theme',bpm:90,notes:[['E4','G4','A4','G4','E4','D4','E4','G4'],['A4','B4','C5','B4','A4','G4','A4','E4'],['G4','A4','B4','A4','G4','F4','G4','D4'],['E4','G4','A4','G4','E4','D4','C4','E4']]},
  {name:'harvest walk',bpm:100,notes:[['C4','E4','G4','E4','C4','D4','F4','A4'],['G4','B4','D5','B4','G4','A4','C5','E5'],['F4','A4','C5','A4','F4','G4','B4','D5'],['E4','G4','B4','G4','E4','F4','A4','C5']]},
];
const NOTES={'C4':261.6,'D4':293.7,'E4':329.6,'F4':349.2,'G4':392.0,'A4':440.0,'B4':493.9,'C5':523.3,'D5':587.3,'E5':659.3};
function noteFreq(n){ return NOTES[n]||440; }
function playNote(freq,start,dur,vol=0.12){
  const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
  const osc2=audioCtx.createOscillator(), gain2=audioCtx.createGain();
  osc.type='square'; osc.frequency.value=freq;
  osc2.type='triangle'; osc2.frequency.value=freq*2;
  gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(vol,start+0.01); gain.gain.linearRampToValueAtTime(vol*0.6,start+dur*0.4); gain.gain.linearRampToValueAtTime(0,start+dur*0.95);
  gain2.gain.setValueAtTime(0,start); gain2.gain.linearRampToValueAtTime(vol*0.04,start+0.01); gain2.gain.linearRampToValueAtTime(0,start+dur*0.5);
  osc.connect(gain); osc2.connect(gain2); gain.connect(audioCtx.destination); gain2.connect(audioCtx.destination);
  osc.start(start); osc.stop(start+dur); osc2.start(start); osc2.stop(start+dur);
  musicNodes.push(osc,osc2,gain,gain2);
}
function playBass(freq,start,dur){
  const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
  osc.type='sawtooth'; osc.frequency.value=freq/2;
  gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(0.06,start+0.02); gain.gain.linearRampToValueAtTime(0,start+dur*0.7);
  osc.connect(gain); gain.connect(audioCtx.destination); osc.start(start); osc.stop(start+dur);
  musicNodes.push(osc,gain);
}
function scheduleTrack(){
  if(!musicPlaying) return;
  const track=TRACKS[trackIdx], bps=track.bpm/60, noteLen=1/bps;
  let t=audioCtx.currentTime+0.05;
  track.notes.forEach((bar)=>{ bar.forEach((note,ni)=>{ const freq=noteFreq(note); playNote(freq,t,noteLen*0.85); if(ni%4===0) playBass(freq,t,noteLen*1.8); t+=noteLen; }); });
  const totalLen=track.notes.reduce((s,b)=>s+b.length,0)*noteLen*1000;
  musicLoop=setTimeout(()=>{ musicNodes=[]; if(musicPlaying) scheduleTrack(); },totalLen+100);
}
function toggleMusic(){
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  musicPlaying=!musicPlaying;
  const btn=document.getElementById('musicBtn'), dots=document.getElementById('musicDots'), title=document.getElementById('musicTitle');
  if(musicPlaying){
    trackIdx=(trackIdx+1)%TRACKS.length;
    title.textContent=TRACKS[trackIdx].name;
    scheduleTrack();
    btn.style.color='var(--accent2)'; btn.style.background='var(--accent-dim)';
    dots.querySelectorAll('.music-dot').forEach(d=>d.classList.remove('paused'));
  } else {
    if(musicLoop) clearTimeout(musicLoop);
    musicNodes.forEach(n=>{try{n.stop&&n.stop();n.disconnect&&n.disconnect();}catch(e){}});
    musicNodes=[];
    btn.style.color=''; btn.style.background='';
    dots.querySelectorAll('.music-dot').forEach(d=>d.classList.add('paused'));
  }
}

// ── DB Load ───────────────────────────────────────────────────
async function loadTasksFromDB(){
  const uid=currentUser.id;

  // Tasks (user-scoped)
  const {data:tasksData,error:tasksError}=await supabaseClient.from('tasks').select('*').eq('user_id',uid);
  if(tasksError){ showToast('⚠️ DB error: '+tasksError.message); return; }

  if(tasksData&&tasksData.length>0){
    tasks=tasksData.map(t=>({id:t.id,name:t.name,icon:t.icon,points:t.points}));
  } else {
    // First visit: seed defaults
    const inserts=DEFAULT_TASKS.map(t=>({...t,user_id:uid}));
    const {data:seeded}=await supabaseClient.from('tasks').insert(inserts).select();
    if(seeded) tasks=seeded.map(t=>({id:t.id,name:t.name,icon:t.icon,points:t.points}));
    else tasks=DEFAULT_TASKS.map(t=>({...t}));
    const banner=document.getElementById('welcomeBanner');
    if(banner) banner.style.display='flex';
  }

  // Checks
  const {data:checksData}=await supabaseClient.from('checks').select('*').eq('user_id',uid);
  if(checksData) checksData.forEach(r=>{checks[r.id]=r.checked;});

  // Notes
  const {data:notesData}=await supabaseClient.from('notes').select('*').eq('user_id',uid);
  if(notesData) notesData.forEach(r=>{notes[r.id]=r.content;});

  // Gym logs
  const {data:gymData}=await supabaseClient.from('gym_logs').select('*').eq('user_id',uid);
  if(gymData) gymData.forEach(r=>{const {id,user_id,...rest}=r;gymLogs[id]=rest;});

  // Gym exercise list (from localStorage for now — could also store in DB)
  gymEx=JSON.parse(localStorage.getItem('hf2_gymex')||'null');
  if(!gymEx){ gymEx=EXERCISES.map(e=>e.id); }

  save();
  renderAll();
}

// ── App Init ──────────────────────────────────────────────────
function initApp(){
  applyTheme(currentTheme);
  loadTasksFromDB();
}
