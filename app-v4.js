const SUPABASE_URL='https://nnzlaczbomzyfmpkyllo.supabase.co';
const SUPABASE_KEY='sb_publishable_6w69fwX96lRZpDkbjcEDCA_ptMCU26u';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

let currentUser=null,profile=null,role=null,view='today',authReady=false,authMessage='',authBusy=false,status='';
let clients=[],selectedClientId='',habits=[],exercises=[],draftTasks=[],todayDay=null,todayTasks=[],todayEod=null,todayAttachments=[];
let calendarDays=[],calendarSelected=null,calendarMonth='',messages=[],messagesClientId='',coachNotes=[],activity=[],coachProgress={};
let lastInviteLink='';

const root=()=>document.getElementById('root');
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const todayISO=()=>iso(new Date());
const pretty=(s=todayISO())=>new Date(`${s}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
const shortDate=s=>new Date(`${s}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});
const fmtTime=s=>new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
const currentClient=()=>clients.find(c=>c.id===selectedClientId);

async function initAuth(){
  calendarMonth=monthKey(new Date());
  const{data:{session}}=await sb.auth.getSession();await hydrate(session);authReady=true;render();
  sb.auth.onAuthStateChange((_e,s)=>setTimeout(async()=>{await hydrate(s);authReady=true;render()},0));
}
async function hydrate(session){
  if(!session){currentUser=profile=role=null;clients=[];todayDay=null;todayTasks=[];messages=[];return}
  currentUser=session.user;
  const{data:p,error}=await sb.from('profiles').select('id,role,full_name,focus,coach_id,future_visibility').eq('id',currentUser.id).maybeSingle();
  if(error||!p){authMessage=error?.message||'Profile not found.';return}
  profile=p;role=p.role;authMessage='';
  if(role==='coach'){
    await Promise.all([loadClients(),loadLibraries(),loadActivity()]);
    selectedClientId=selectedClientId||clients[0]?.id||'';messagesClientId=messagesClientId||selectedClientId;
    await Promise.all([loadCoachProgress(),loadCoachNotes()]);
    view='clients';
  }else{
    await Promise.all([loadToday(),loadCalendar(),loadMessages(),loadCoachNotes()]);
    view='today';
  }
}
async function signIn(){
  const email=(document.getElementById('authEmail')?.value||'').trim().toLowerCase(),password=document.getElementById('authPassword')?.value||'';
  if(!email||password.length<6){authMessage='Enter your email and password.';render();return}
  authBusy=true;render();const{data,error}=await sb.auth.signInWithPassword({email,password});authBusy=false;
  if(error){authMessage=error.message;render();return}await hydrate(data.session);render();
}
async function logout(){await sb.auth.signOut();currentUser=profile=role=null;render()}
async function setPassword(){const p=document.getElementById('newPassword')?.value||'';if(p.length<6){status='Use at least 6 characters.';render();return}const{error}=await sb.auth.updateUser({password:p});status=error?error.message:'Password saved.';render()}

async function loadClients(){
  const{data,error}=await sb.from('profiles').select('id,full_name,focus,created_at,future_visibility').eq('coach_id',currentUser.id).eq('role','client').order('created_at');
  if(!error)clients=data||[];
}
async function loadCoachProgress(){
  if(role!=='coach')return;coachProgress={};
  const{data}=await sb.from('days').select('client_id,tasks(completed)').eq('coach_id',currentUser.id).eq('day_date',todayISO());
  (data||[]).forEach(d=>{const total=d.tasks?.length||0,done=(d.tasks||[]).filter(t=>t.completed).length;coachProgress[d.client_id]={done,total}});
}
async function loadLibraries(){
  const[h,e]=await Promise.all([sb.from('habits').select('*').eq('coach_id',currentUser.id).order('name'),sb.from('exercises').select('*').eq('coach_id',currentUser.id).order('name')]);
  habits=h.data||[];exercises=e.data||[];
}
async function loadActivity(){
  if(role!=='coach')return;const{data}=await sb.from('coach_activity').select('*').eq('coach_id',currentUser.id).order('created_at',{ascending:false}).limit(25);activity=data||[];
}
async function loadCoachNotes(){
  if(!currentUser)return;let q=sb.from('coach_profile_notes').select('*').order('created_at',{ascending:false});
  if(role==='coach'){if(!selectedClientId){coachNotes=[];return}q=q.eq('coach_id',currentUser.id).eq('client_id',selectedClientId)}else q=q.eq('client_id',currentUser.id);
  const{data}=await q;coachNotes=data||[];
}
async function addCoachNote(){
  const note=(document.getElementById('coachProfileNote')?.value||'').trim();if(!note||!selectedClientId)return;
  const{error}=await sb.from('coach_profile_notes').insert({coach_id:currentUser.id,client_id:selectedClientId,note});status=error?error.message:'Coach note saved.';await loadCoachNotes();render();
}
async function setVisibility(id,value){const{error}=await sb.from('profiles').update({future_visibility:value}).eq('id',id);status=error?error.message:'Future visibility updated.';await loadClients();render()}

async function loadToday(){
  const{data:d,error}=await sb.from('days').select('*').eq('client_id',currentUser.id).eq('day_date',todayISO()).maybeSingle();
  if(error){status=error.message;return}todayDay=d||null;todayTasks=[];todayEod=null;todayAttachments=[];if(!d)return;
  const[t,e,a]=await Promise.all([
    sb.from('tasks').select('*').eq('day_id',d.id).order('sort_order'),
    sb.from('eod_checkins').select('*').eq('day_id',d.id).maybeSingle(),
    sb.from('attachments').select('*').eq('day_id',d.id).order('created_at',{ascending:false})
  ]);
  todayTasks=t.data||[];todayEod=e.data||null;todayAttachments=a.data||[];
  for(const task of todayTasks.filter(x=>x.type==='workout'&&x.exercise_id)){
    const{data:last}=await sb.rpc('last_logged_weight',{p_client:currentUser.id,p_exercise:task.exercise_id});task.last_weight=last==null?null:Number(last);
  }
}
async function toggleTask(id,done){const{error}=await sb.from('tasks').update({completed:done}).eq('id',id);status=error?error.message:'';await loadToday();render()}
function readSetLogs(task){
  const logs=[];for(let i=0;i<(task.prescribed_sets||1);i++){const w=document.getElementById(`sw_${task.id}_${i}`)?.value,r=document.getElementById(`sr_${task.id}_${i}`)?.value;logs.push({set:i+1,weight:w===''?null:Number(w),reps:r===''?null:Number(r)})}return logs;
}
async function saveWorkout(id){
  const task=todayTasks.find(t=>t.id===id);if(!task)return;const logs=readSetLogs(task);const weights=logs.map(x=>x.weight).filter(x=>Number.isFinite(x));const max=weights.length?Math.max(...weights):null;
  const note=document.getElementById(`note_${id}`)?.value||null,last=task.last_weight==null?null:Number(task.last_weight),pr=max!=null&&last!=null&&max>last;
  const{error}=await sb.from('tasks').update({set_logs:logs,logged_weight:max,client_note:note,completed:true,previous_best_weight:last,pr_achieved:pr}).eq('id',id);
  status=error?error.message:(pr?`New best — ${max} lb · +${Math.round((max-last)*10)/10} lb PR`:'Workout saved.');await Promise.all([loadToday(),loadCalendar()]);render();
}
async function saveEod(){
  if(!todayDay)return;const energy=Number(document.getElementById('eodEnergy')?.value||0)||null,pain=(document.getElementById('eodPain')?.value||'').trim()||null,wins=(document.getElementById('eodWins')?.value||'').trim()||null,concerns=(document.getElementById('eodConcerns')?.value||'').trim()||null,other=(document.getElementById('eodOther')?.value||'').trim()||null;
  const row={day_id:todayDay.id,coach_id:todayDay.coach_id,client_id:currentUser.id,energy,pain,wins,concerns,other,submitted_at:new Date().toISOString()};
  const{error}=await sb.from('eod_checkins').upsert(row,{onConflict:'day_id'});if(!error)await sb.from('days').update({client_note:[wins,concerns,pain,other].filter(Boolean).join(' | ')||null,completed_at:new Date().toISOString()}).eq('id',todayDay.id);
  status=error?error.message:'Day check-in sent to Maddie.';await Promise.all([loadToday(),loadCalendar()]);render();
}
async function uploadAttachment(){
  if(!todayDay)return;const input=document.getElementById('attachmentFile'),file=input?.files?.[0];if(!file)return;status='Uploading…';render();
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${currentUser.id}/${todayDay.id}/${Date.now()}-${safe}`;
  const{error:uerr}=await sb.storage.from('client-attachments').upload(path,file,{upsert:false,contentType:file.type||undefined});if(uerr){status=uerr.message;render();return}
  const{error}=await sb.from('attachments').insert({coach_id:todayDay.coach_id,client_id:currentUser.id,day_id:todayDay.id,storage_path:path,file_name:file.name,mime_type:file.type||null,file_size:file.size});status=error?error.message:'Attachment sent to Maddie.';await loadToday();render();
}
async function openAttachment(path){const{data,error}=await sb.storage.from('client-attachments').createSignedUrl(path,120);if(error){status=error.message;render();return}window.open(data.signedUrl,'_blank')}

async function loadCalendar(){
  if(role!=='client')return;const{data,error}=await sb.from('days').select('*,tasks(*),eod_checkins(*)').eq('client_id',currentUser.id).order('day_date');if(error){status=error.message;calendarDays=[];return}
  calendarDays=(data||[]).map(d=>({...d,tasks:(d.tasks||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))}));if(calendarSelected)calendarSelected=calendarDays.find(d=>d.id===calendarSelected.id)||null;
}
function changeMonth(delta){const d=new Date(`${calendarMonth}T12:00:00`);d.setMonth(d.getMonth()+delta);calendarMonth=monthKey(d);calendarSelected=null;render()}
function chooseCalendarDay(id){calendarSelected=calendarDays.find(d=>d.id===id)||null;render()}

async function loadMessages(){
  if(!currentUser||!profile)return;let q=sb.from('messages').select('*').order('created_at');
  if(role==='coach'){const cid=messagesClientId||selectedClientId||clients[0]?.id;if(!cid){messages=[];return}messagesClientId=cid;q=q.eq('coach_id',currentUser.id).eq('client_id',cid)}else q=q.eq('coach_id',profile.coach_id).eq('client_id',currentUser.id);
  const{data,error}=await q;if(error){status=error.message;messages=[];return}messages=data||[];const unread=messages.filter(m=>m.sender_id!==currentUser.id&&!m.read_at).map(m=>m.id);if(unread.length)await sb.from('messages').update({read_at:new Date().toISOString()}).in('id',unread);
}
async function sendMessage(){
  const body=(document.getElementById('messageBody')?.value||'').trim();if(!body)return;let coach_id,client_id;if(role==='coach'){coach_id=currentUser.id;client_id=messagesClientId||selectedClientId;if(!client_id)return}else{coach_id=profile.coach_id;client_id=currentUser.id}
  const{error}=await sb.from('messages').insert({coach_id,client_id,sender_id:currentUser.id,body});status=error?error.message:'';await loadMessages();render();setTimeout(()=>document.getElementById('messageEnd')?.scrollIntoView({behavior:'smooth'}),0);
}
async function chooseMessageClient(id){messagesClientId=id;selectedClientId=id;await Promise.all([loadMessages(),loadCoachNotes()]);render()}

async function addHabitLibrary(){const name=(document.getElementById('newHabit')?.value||'').trim(),category=(document.getElementById('habitCategory')?.value||'General').trim();if(!name)return;const{error}=await sb.from('habits').insert({coach_id:currentUser.id,name,category});status=error?error.message:'Habit added.';await loadLibraries();render()}
async function addExerciseLibrary(){const name=(document.getElementById('newExercise')?.value||'').trim(),muscle_group=(document.getElementById('muscleGroup')?.value||'General').trim(),default_sets=Number(document.getElementById('defaultSets')?.value||3),default_reps=(document.getElementById('defaultReps')?.value||'10').trim();if(!name)return;const{error}=await sb.from('exercises').insert({coach_id:currentUser.id,name,muscle_group,default_sets,default_reps});status=error?error.message:'Exercise added.';await loadLibraries();render()}
async function deleteHabit(id){if(!confirm('Delete this habit from the library?'))return;const{error}=await sb.from('habits').delete().eq('id',id);status=error?error.message:'Habit deleted.';await loadLibraries();render()}
async function deleteExercise(id){if(!confirm('Delete this exercise from the library?'))return;const{error}=await sb.from('exercises').delete().eq('id',id);status=error?error.message:'Exercise deleted.';await loadLibraries();render()}
function stageHabit(id){const h=habits.find(x=>x.id===id);if(h)draftTasks.push({type:'habit',name:h.name,habit_id:h.id});render()}
function stageExercise(id){const e=exercises.find(x=>x.id===id);if(e)draftTasks.push({type:'workout',name:e.name,exercise_id:e.id,prescribed_sets:e.default_sets,prescribed_reps:e.default_reps,superset_key:'',superset_rest_seconds:null});render()}
function updateDraft(i,key,value){if(!draftTasks[i])return;draftTasks[i][key]=key==='prescribed_sets'||key==='superset_rest_seconds'?(value===''?null:Number(value)):value}
function removeDraft(i){draftTasks.splice(i,1);render()}
async function saveDay(){
  const client_id=document.getElementById('buildClient')?.value||selectedClientId,day_date=document.getElementById('buildDate')?.value||todayISO(),title=(document.getElementById('dayTitle')?.value||'Training Day').trim(),coach_note=(document.getElementById('coachNote')?.value||'').trim();
  if(!client_id){status='Choose a client.';render();return}if(!draftTasks.length){status='Add at least one habit or exercise.';render();return}status='Saving…';render();
  const{data:day,error}=await sb.from('days').upsert({coach_id:currentUser.id,client_id,day_date,title,coach_note},{onConflict:'client_id,day_date'}).select().single();if(error){status=error.message;render();return}
  await sb.from('tasks').delete().eq('day_id',day.id);const rows=[];
  for(let i=0;i<draftTasks.length;i++){const t=draftTasks[i];let previous_best_weight=null;if(t.type==='workout'&&t.exercise_id){const{data:last}=await sb.rpc('last_logged_weight',{p_client:client_id,p_exercise:t.exercise_id});previous_best_weight=last??null}rows.push({...t,superset_key:t.superset_key||null,superset_rest_seconds:t.superset_rest_seconds||null,day_id:day.id,sort_order:i,completed:false,pr_achieved:false,previous_best_weight})}
  const{error:te}=await sb.from('tasks').insert(rows);status=te?te.message:`Saved ${rows.length} items for ${clients.find(c=>c.id===client_id)?.full_name||'client'}.`;if(!te)draftTasks=[];await loadCoachProgress();render();
}

async function sendInvite(){
  const full_name=(document.getElementById('inviteName')?.value||'').trim(),email=(document.getElementById('inviteEmail')?.value||'').trim().toLowerCase(),focus=(document.getElementById('inviteFocus')?.value||'').trim();if(!full_name||!email){status='Add name and email.';render();return}
  const{data,error}=await sb.functions.invoke('invite-client',{body:{full_name,email,focus}});if(error){status=error.message;render();return}lastInviteLink=data?.activation_url||'';status='Client invite created. Send them the activation link below.';render();
}
async function copyInvite(){if(!lastInviteLink)return;try{await navigator.clipboard.writeText(lastInviteLink);status='Activation link copied.'}catch{status='Press and hold the link to copy it.'}render()}
async function deleteClient(id,name){
  if(!confirm(`Delete ${name} from One Day? This removes their account and One Day data so they can be invited again from scratch.`))return;
  status='Deleting client…';render();const{error}=await sb.functions.invoke('delete-client',{body:{client_id:id}});if(error){status=error.message;render();return}if(selectedClientId===id)selectedClientId='';if(messagesClientId===id)messagesClientId='';await Promise.all([loadClients(),loadActivity()]);selectedClientId=clients[0]?.id||'';messagesClientId=selectedClientId;status=`${name} deleted. You can invite them again now.`;render();
}

async function goView(v){view=v;status='';if(v==='calendar'&&role==='client')await loadCalendar();if(v==='messages')await loadMessages();if(v==='clients'&&role==='coach')await Promise.all([loadClients(),loadCoachProgress(),loadActivity()]);render()}
function nav(coach){const items=coach?['clients','build','messages','billing','library']:['today','calendar','messages','profile'];return `<nav class="nav ${coach?'coach':'client'}">${items.map(x=>`<button class="${view===x?'active':''}" onclick="goView('${x}')">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</nav>`}
function shell(body,coach=false){return `<div class="app"><header class="top"><div><p class="eyebrow">ONE DAY</p><h2 style="margin:4px 0 0">${coach?'Coach notebook':'Hi, '+esc((profile?.full_name||'there').split(' ')[0])}</h2></div><button class="btn" onclick="logout()">Log out</button></header><main class="content">${status?`<div class="note"><p>${esc(status)}</p></div>`:''}${body}</main>${nav(coach)}</div>`}
function loginHTML(){return `<div class="login"><div class="box"><div class="logo">1</div><p class="eyebrow" style="margin-top:14px">ONE DAY</p><h1>Welcome back.</h1><p class="muted">Coach and clients sign in here.</p><div class="stack"><input id="authEmail" type="email" autocomplete="email" placeholder="Email"><input id="authPassword" type="password" autocomplete="current-password" placeholder="Password"><button class="btn primary full" onclick="signIn()">${authBusy?'Working…':'Sign in'}</button></div>${authMessage?`<div class="note"><p>${esc(authMessage)}</p></div>`:''}<p class="small" style="margin-top:14px">New clients activate from the link their coach sends.</p></div></div>`}

function clientsHTML(){
  const cards=clients.map(c=>{const p=coachProgress[c.id]||{done:0,total:0};return `<div class="card"><div class="row"><div class="avatar">${esc(c.full_name[0])}</div><div class="grow"><b>${esc(c.full_name)}</b><p class="small">${esc(c.focus||'No focus set')} · Today ${p.done}/${p.total}</p></div><button class="btn" onclick="selectedClientId='${c.id}';loadCoachNotes().then(()=>{view='build';render()})">Plan</button></div><div class="row" style="margin-top:10px"><select onchange="setVisibility('${c.id}',this.value)" aria-label="Future visibility"><option value="today" ${c.future_visibility==='today'?'selected':''}>Today only</option><option value="7" ${c.future_visibility==='7'?'selected':''}>Next 7 days</option><option value="all" ${c.future_visibility==='all'?'selected':''}>All future</option></select><button class="btn" onclick="messagesClientId='${c.id}';selectedClientId='${c.id}';goView('messages')">Message</button><button class="btn" style="color:#8c3f3f" onclick="deleteClient('${c.id}','${esc(c.full_name).replace(/'/g,'&#39;')}')">Delete</button></div></div>`}).join('');
  const act=activity.slice(0,8).map(a=>`<div class="card"><b>${esc(clients.find(c=>c.id===a.client_id)?.full_name||'Client')}</b><p class="small">${esc(a.event_type.replaceAll('_',' '))}${a.detail?' · '+esc(a.detail):''} · ${fmtTime(a.created_at)}</p></div>`).join('');
  return `<p class="eyebrow">COACH</p><h1>Your clients</h1>${cards||'<div class="note">No clients yet.</div>'}<div class="card"><p class="eyebrow">ADD CLIENT</p><div class="stack"><input id="inviteName" placeholder="Client name"><input id="inviteEmail" type="email" placeholder="Client email"><input id="inviteFocus" placeholder="Focus"><button class="btn primary" onclick="sendInvite()">Create invitation</button>${lastInviteLink?`<div class="note"><b>Activation link</b><p class="small" style="word-break:break-all">${esc(lastInviteLink)}</p><button class="btn" onclick="copyInvite()">Copy link</button></div>`:''}</div></div><p class="eyebrow">RECENT ACTIVITY</p>${act||'<div class="note">No client activity yet.</div>'}`;
}
function buildHTML(){
  const draft=draftTasks.map((t,i)=>`<div class="card"><div class="row"><div class="grow"><b>${esc(t.name)}</b><p class="small">${t.type==='habit'?'Habit':'Workout'}</p></div><button class="btn" onclick="removeDraft(${i})">Remove</button></div>${t.type==='workout'?`<div class="stack" style="margin-top:10px"><div class="row"><input type="number" min="1" value="${t.prescribed_sets||3}" onchange="updateDraft(${i},'prescribed_sets',this.value)" placeholder="Sets"><input value="${esc(t.prescribed_reps||'10')}" onchange="updateDraft(${i},'prescribed_reps',this.value)" placeholder="Reps"></div><div class="row"><input value="${esc(t.superset_key||'')}" onchange="updateDraft(${i},'superset_key',this.value)" placeholder="Superset group e.g. A"><input type="number" min="0" value="${t.superset_rest_seconds??''}" onchange="updateDraft(${i},'superset_rest_seconds',this.value)" placeholder="Rest sec"></div></div>`:''}</div>`).join('');
  return `<p class="eyebrow">DAY BUILDER</p><h1>Plan the day</h1><div class="stack"><select id="buildClient" onchange="selectedClientId=this.value">${clients.map(c=>`<option value="${c.id}" ${c.id===selectedClientId?'selected':''}>${esc(c.full_name)}</option>`).join('')}</select><input id="buildDate" type="date" value="${todayISO()}"><input id="dayTitle" value="Training Day" placeholder="Day title"><textarea id="coachNote" placeholder="Coach note shown at top of client day"></textarea></div><div class="card"><b>Workout</b><div class="stack" style="margin-top:10px"><select id="exercisePick"><option value="">Choose exercise…</option>${exercises.map(e=>`<option value="${e.id}">${esc(e.name)} · ${e.default_sets}×${esc(e.default_reps)}</option>`).join('')}</select><button class="btn" onclick="stageExercise(document.getElementById('exercisePick').value)">+ Add exercise</button></div></div><div class="card"><b>Habits</b><div class="stack" style="margin-top:10px"><select id="habitPick"><option value="">Choose habit…</option>${habits.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select><button class="btn" onclick="stageHabit(document.getElementById('habitPick').value)">+ Add habit</button></div></div>${draft}<button class="btn primary full" onclick="saveDay()">Save day</button>${selectedClientId?`<div class="card"><p class="eyebrow">PRIVATE COACH NOTES</p><textarea id="coachProfileNote" placeholder="Private profile note"></textarea><button class="btn" onclick="addCoachNote()">Save note</button>${coachNotes.slice(0,5).map(n=>`<p class="small">${esc(n.note)} · ${fmtTime(n.created_at)}</p>`).join('')}</div>`:''}`;
}
function libraryHTML(){return `<p class="eyebrow">LIBRARY</p><h1>Exercises & habits</h1><div class="card"><b>Add exercise</b><div class="stack" style="margin-top:10px"><input id="newExercise" placeholder="Exercise name"><input id="muscleGroup" placeholder="Muscle group"><input id="defaultSets" type="number" value="3" min="1"><input id="defaultReps" value="10" placeholder="Reps"><button class="btn primary" onclick="addExerciseLibrary()">Add exercise</button></div></div>${exercises.map(e=>`<div class="card row"><div class="grow"><b>${esc(e.name)}</b><p class="small">${esc(e.muscle_group)} · ${e.default_sets} × ${esc(e.default_reps)}</p></div><button class="btn" onclick="deleteExercise('${e.id}')">Delete</button></div>`).join('')}<div class="card"><b>Add habit</b><div class="stack" style="margin-top:10px"><input id="newHabit" placeholder="Habit name"><input id="habitCategory" value="General" placeholder="Category"><button class="btn primary" onclick="addHabitLibrary()">Add habit</button></div></div>${habits.map(h=>`<div class="card row"><div class="grow"><b>${esc(h.name)}</b><p class="small">${esc(h.category)}</p></div><button class="btn" onclick="deleteHabit('${h.id}')">Delete</button></div>`).join('')}`}

function workoutCard(t){
  const prior=Array.isArray(t.set_logs)?t.set_logs:[];const sets=Number(t.prescribed_sets||3);const inputs=Array.from({length:sets},(_,i)=>{const x=prior[i]||{};return `<div class="row"><span class="small" style="width:42px">Set ${i+1}</span><input id="sw_${t.id}_${i}" type="number" inputmode="decimal" value="${x.weight??''}" placeholder="lb"><input id="sr_${t.id}_${i}" type="number" inputmode="numeric" value="${x.reps??''}" placeholder="reps"></div>`}).join('');
  return `<div class="work"><div class="row"><div class="grow"><h3>${esc(t.name)}</h3><p class="small">${sets} × ${esc(t.prescribed_reps||'')} ${t.superset_key?`· Superset ${esc(t.superset_key)}`:''}${t.superset_rest_seconds!=null?` · ${t.superset_rest_seconds}s rest`:''}</p></div>${t.completed?'<span>✓</span>':''}</div>${t.last_weight!=null?`<div class="target">Last time ${t.last_weight} lb — beat it.</div>`:''}${t.pr_achieved&&t.logged_weight!=null?`<div class="note"><b>New best — ${t.logged_weight} lb</b></div>`:''}<div class="stack">${inputs}<textarea id="note_${t.id}" placeholder="Notes for Maddie">${esc(t.client_note||'')}</textarea><button class="btn primary" onclick="saveWorkout('${t.id}')">Save exercise</button></div></div>`;
}
function todayHTML(){
  if(!todayDay)return `<div class="todayDate">${pretty()}</div><p class="motto">You create the life you live.</p><div class="note"><b>Nothing assigned yet.</b><p class="small">Maddie can add your workout and habits from Build.</p></div>`;
  const done=todayTasks.filter(t=>t.completed).length,total=todayTasks.length;
  return `<div class="todayDate">${pretty()}</div><p class="motto">You create the life you live.</p>${todayDay.coach_note?`<div class="note"><p class="eyebrow">FROM MADDIE</p><p>${esc(todayDay.coach_note)}</p></div>`:''}<div class="row"><div class="grow"><h2>${esc(todayDay.title)}</h2></div><b style="color:var(--gold)">${done}/${total}</b></div><div class="progress"><span style="width:${total?done/total*100:0}%"></span></div>${todayTasks.map(t=>t.type==='habit'?`<button class="todo" onclick="toggleTask('${t.id}',${!t.completed})"><span class="check ${t.completed?'done':''}"></span><b class="grow">${esc(t.name)}</b></button>`:workoutCard(t)).join('')}<div class="card"><p class="eyebrow">ATTACHMENTS</p><input id="attachmentFile" type="file" accept="image/*,video/mp4,video/quicktime,application/pdf"><button class="btn" onclick="uploadAttachment()">Upload for Maddie</button>${todayAttachments.map(a=>`<button class="btn full" onclick="openAttachment('${a.storage_path}')">${esc(a.file_name)}</button>`).join('')}</div><div class="card"><p class="eyebrow">END OF DAY</p><h3>How did today go?</h3><div class="stack"><select id="eodEnergy"><option value="">Energy 1–5</option>${[1,2,3,4,5].map(x=>`<option value="${x}" ${todayEod?.energy===x?'selected':''}>${x}</option>`).join('')}</select><textarea id="eodWins" placeholder="Wins">${esc(todayEod?.wins||'')}</textarea><textarea id="eodPain" placeholder="Pain / soreness">${esc(todayEod?.pain||'')}</textarea><textarea id="eodConcerns" placeholder="Concerns">${esc(todayEod?.concerns||'')}</textarea><textarea id="eodOther" placeholder="Anything else">${esc(todayEod?.other||'')}</textarea><button class="btn primary" onclick="saveEod()">Send check-in</button></div></div>${done===total&&total?'<div class="note"><h2>Way to kill the day.</h2></div>':''}`;
}
function calendarHTML(){
  const d=new Date(`${calendarMonth}T12:00:00`),year=d.getFullYear(),month=d.getMonth(),first=new Date(year,month,1),daysIn=new Date(year,month+1,0).getDate(),offset=first.getDay();let cells='';for(let i=0;i<offset;i++)cells+='<div></div>';
  for(let n=1;n<=daysIn;n++){const date=iso(new Date(year,month,n)),day=calendarDays.find(x=>x.day_date===date),done=day&&day.tasks?.length&&day.tasks.every(t=>t.completed);cells+=`<button onclick="${day?`chooseCalendarDay('${day.id}')`:''}" style="min-height:54px;border:1px solid #e6e8e3;border-radius:12px;background:${day?'white':'transparent'};padding:6px;text-align:left"><b>${n}</b>${day?`<div style="font-size:10px;margin-top:5px;color:${done?'#6f845f':'#a98643'}">${done?'Done':'Assigned'}</div>`:''}</button>`}
  const sel=calendarSelected?`<div class="card"><p class="eyebrow">${pretty(calendarSelected.day_date)}</p><h2>${esc(calendarSelected.title)}</h2>${calendarSelected.coach_note?`<p>${esc(calendarSelected.coach_note)}</p>`:''}${calendarSelected.tasks.map(t=>`<div class="row" style="padding:8px 0;border-top:1px solid #eee"><div class="grow"><b>${esc(t.name)}</b><p class="small">${t.type==='workout'?`${t.prescribed_sets||''} × ${esc(t.prescribed_reps||'')}${t.logged_weight!=null?` · ${t.logged_weight} lb`:''}`:'Habit'}</p>${t.client_note?`<p class="small">${esc(t.client_note)}</p>`:''}</div><span>${t.completed?'✓':'○'}</span></div>`).join('')}${calendarSelected.eod_checkins?.[0]?`<div class="note"><b>End-of-day</b><p class="small">Energy ${calendarSelected.eod_checkins[0].energy||'—'} · ${esc(calendarSelected.eod_checkins[0].wins||calendarSelected.eod_checkins[0].concerns||'Check-in submitted')}</p></div>`:''}</div>`:'';
  return `<p class="eyebrow">CALENDAR</p><div class="row"><button class="btn" onclick="changeMonth(-1)">‹</button><h1 class="grow" style="text-align:center">${d.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h1><button class="btn" onclick="changeMonth(1)">›</button></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:14px 0"><div class="small">S</div><div class="small">M</div><div class="small">T</div><div class="small">W</div><div class="small">T</div><div class="small">F</div><div class="small">S</div>${cells}</div>${sel||'<div class="note">Tap an assigned day to see the workout, habits, weights, notes and check-in.</div>'}`;
}
function messagesHTML(){
  const selector=role==='coach'?`<select onchange="chooseMessageClient(this.value)">${clients.map(c=>`<option value="${c.id}" ${c.id===messagesClientId?'selected':''}>${esc(c.full_name)}</option>`).join('')}</select>`:'';
  return `<p class="eyebrow">MESSAGES</p><h1>${role==='coach'?'Client messages':'Maddie'}</h1>${selector}<div style="display:grid;gap:8px;margin:16px 0">${messages.map(m=>`<div style="max-width:82%;padding:11px 13px;border-radius:16px;${m.sender_id===currentUser.id?'margin-left:auto;background:#eef2eb':'background:white;border:1px solid #e8e8e4'}"><p style="margin:0">${esc(m.body)}</p><p class="small" style="margin:5px 0 0">${fmtTime(m.created_at)}</p></div>`).join('')||'<div class="note">No messages yet.</div>'}<div id="messageEnd"></div></div><div class="row"><textarea id="messageBody" class="grow" placeholder="Write a message…"></textarea><button class="btn primary" onclick="sendMessage()">Send</button></div>`;
}
function profileHTML(){return `<p class="eyebrow">PROFILE</p><h1>${esc(profile?.full_name||'Client')}</h1><div class="card"><b>Your coach</b><p class="muted">Maddie</p></div><div class="card"><p class="eyebrow">COACH NOTES</p>${coachNotes.map(n=>`<p>${esc(n.note)}<br><span class="small">${fmtTime(n.created_at)}</span></p>`).join('')||'<p class="small">No coach notes yet.</p>'}</div><div class="card"><b>Set / change password</b><p class="small">Choose your own password. It stays private.</p><div class="stack"><input id="newPassword" type="password" placeholder="New password"><button class="btn primary" onclick="setPassword()">Save password</button></div></div>`}
function billingHTML(){return `<p class="eyebrow">BILLING</p><h1>Billing</h1><div class="note"><b>Stripe is intentionally not live yet.</b><p class="small">We’ll connect test-mode plans after the training beta is stable.</p></div>`}

function render(){
  if(!authReady){root().innerHTML='<div class="login"><div class="box"><h1>One Day</h1><p>Loading…</p></div></div>';return}
  if(!currentUser||!profile){root().innerHTML=loginHTML();return}
  if(role==='coach'){const body=view==='clients'?clientsHTML():view==='build'?buildHTML():view==='library'?libraryHTML():view==='messages'?messagesHTML():billingHTML();root().innerHTML=shell(body,true);return}
  const body=view==='today'?todayHTML():view==='calendar'?calendarHTML():view==='messages'?messagesHTML():profileHTML();root().innerHTML=shell(body,false);
}
initAuth();