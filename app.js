const SUPABASE_URL='https://nnzlaczbomzyfmpkyllo.supabase.co';
const SUPABASE_KEY='sb_publishable_6w69fwX96lRZpDkbjcEDCA_ptMCU26u';
const COACH_EMAIL='coach@maddiebellefit.com';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

let role=null,view='today',checked=[false,false,false,false],weights={hip:'',split:'',kick:''},messages=[['Maddie','Nice work yesterday. Keep today controlled.']];
let authReady=false,currentUser=null,profile=null,authMode='signin',authMessage='',authBusy=false,inviteOpen=false,inviteStatus='',clients=[];
const root=()=>document.getElementById('root');
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function initAuth(){
  const {data:{session}}=await sb.auth.getSession();
  if(session) await hydrateSession(session);
  authReady=true; render();
  sb.auth.onAuthStateChange((_event,newSession)=>setTimeout(async()=>{await hydrateSession(newSession);authReady=true;render()},0));
}

async function hydrateSession(session){
  if(!session){currentUser=null;profile=null;role=null;clients=[];return}
  currentUser=session.user;
  let {data:p,error}=await sb.from('profiles').select('id,role,full_name,focus,coach_id').eq('id',currentUser.id).maybeSingle();
  if(error){authMessage=error.message;return}
  if(!p && String(currentUser.email||'').toLowerCase()===COACH_EMAIL){
    const {error:fnError}=await sb.functions.invoke('register-first-coach',{body:{}});
    if(fnError){authMessage=fnError.message;return}
    const res=await sb.from('profiles').select('id,role,full_name,focus,coach_id').eq('id',currentUser.id).maybeSingle();
    p=res.data;
    if(res.error){authMessage=res.error.message;return}
  }
  profile=p||null;
  if(!profile){role=null;authMessage='This account is not attached to a coach yet. Clients need to use their invite email.';return}
  role=profile.role;
  view=role==='coach'?'clients':'today';
  authMessage='';
  if(role==='coach') await loadClients();
}

async function submitAuth(mode){
  const email=(document.getElementById('authEmail')?.value||'').trim().toLowerCase();
  const password=document.getElementById('authPassword')?.value||'';
  if(!email||password.length<6){authMessage='Enter a valid email and a password with at least 6 characters.';render();return}
  if(mode==='signup'&&email!==COACH_EMAIL){authMessage='Client accounts are invite-only during the beta.';render();return}
  authBusy=true;authMessage='';render();
  if(mode==='signup'){
    const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});
    authBusy=false;
    if(error){authMessage=error.message;render();return}
    if(data.session){await hydrateSession(data.session);render();return}
    authMessage='Account created. Check Maddie’s email and tap the confirmation link, then come back here.';render();return
  }
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  authBusy=false;
  if(error){authMessage=error.message;render();return}
  await hydrateSession(data.session);render();
}

function setAuthMode(mode){authMode=mode;authMessage='';render()}
async function logout(){await sb.auth.signOut();currentUser=null;profile=null;role=null;clients=[];render()}

async function loadClients(){
  if(!currentUser)return;
  const {data,error}=await sb.from('profiles').select('id,full_name,focus,created_at').eq('coach_id',currentUser.id).eq('role','client').order('created_at',{ascending:false});
  if(!error) clients=data||[];
}

async function sendInvite(){
  const full_name=(document.getElementById('inviteName')?.value||'').trim();
  const email=(document.getElementById('inviteEmail')?.value||'').trim().toLowerCase();
  const focus=(document.getElementById('inviteFocus')?.value||'').trim();
  if(!full_name||!email.includes('@')){inviteStatus='Name and valid email are required.';render();return}
  inviteStatus='Sending invite…';render();
  const {data,error}=await sb.functions.invoke('invite-client',{body:{full_name,email,focus}});
  if(error){inviteStatus=error.message;render();return}
  inviteStatus=`Invite sent to ${email}.`;
  await loadClients();render();
}

function shell(content,coach=false){
  const who=coach?'Coach notebook':`Hi, ${esc((profile?.full_name||'there').split(' ')[0])}`;
  return `<div class="app"><header class="top"><div><p class="eyebrow">ONE DAY</p><h2 style="margin:4px 0 0">${who}</h2></div><button class="btn" onclick="logout()">Log out</button></header><main class="content">${content}</main><nav class="nav ${coach?'coach':'client'}">${coach?`<button class="${view==='clients'?'active':''}" onclick="view='clients';render()">Clients</button><button class="${view==='build'?'active':''}" onclick="view='build';render()">Build</button><button class="${view==='messages'?'active':''}" onclick="view='messages';render()">Messages</button><button class="${view==='billing'?'active':''}" onclick="view='billing';render()">Billing</button><button class="${view==='library'?'active':''}" onclick="view='library';render()">Library</button>`:`<button class="${view==='today'?'active':''}" onclick="view='today';render()">Today</button><button class="${view==='calendar'?'active':''}" onclick="view='calendar';render()">Calendar</button><button class="${view==='messages'?'active':''}" onclick="view='messages';render()">Messages</button><button class="${view==='profile'?'active':''}" onclick="view='profile';render()">Profile</button>`}</nav></div>`
}

function loginHTML(){
  const signup=authMode==='signup';
  return `<div class="login"><div class="box"><div class="logo">1</div><p class="eyebrow" style="margin-top:14px">ONE DAY</p><h1>${signup?'Create Maddie’s coach account':'Welcome back.'}</h1><p class="muted">${signup?'This first beta coach account is reserved for Maddie.':'Sign in to your One Day account.'}</p><div class="stack"><input id="authEmail" type="email" autocomplete="email" value="${signup?COACH_EMAIL:''}" ${signup?'readonly':''} placeholder="Email"><input id="authPassword" type="password" autocomplete="${signup?'new-password':'current-password'}" placeholder="Password"><button class="btn primary full" ${authBusy?'disabled':''} onclick="submitAuth('${signup?'signup':'signin'}')">${authBusy?'Working…':signup?'Create coach account':'Sign in'}</button></div>${authMessage?`<div class="note"><p class="small">${esc(authMessage)}</p></div>`:''}<button class="btn full" style="margin-top:10px" onclick="setAuthMode('${signup?'signin':'signup'}')">${signup?'Already have an account? Sign in':'First time? Set up Maddie’s coach account'}</button><p class="small" style="margin-top:14px">Clients join from the private invitation Maddie sends them.</p></div></div>`
}

function render(){
  if(!authReady){root().innerHTML='<div class="login"><div class="box"><p class="eyebrow">ONE DAY</p><h1>Loading…</h1></div></div>';return}
  if(!role){root().innerHTML=loginHTML();return}
  root().innerHTML=shell(role==='coach'?coachHTML():clientHTML(),role==='coach')
}

function clientHTML(){
  if(view==='calendar')return calendarHTML();if(view==='messages')return messagesHTML(false);if(view==='profile')return profileHTML();if(view==='workout')return workoutHTML();if(view==='complete')return completeHTML();
  const done=checked.filter(Boolean).length;
  return `<div class="todayDate">Sunday,<br>August 16</div><p class="motto">You create the life you live.</p><div class="note"><p class="eyebrow">FROM YOUR COACH</p><p style="font-family:Georgia,serif">Move with control today. Quality reps &gt; rushing.</p></div><div class="row"><div class="grow"><p class="eyebrow">TODAY</p><h2 style="margin:4px 0">Your list</h2></div><b style="color:var(--gold)">${done}/4</b></div><div class="progress"><span style="width:${done/4*100}%"></span></div><button class="todo" onclick="view='workout';render()"><span class="check ${checked[0]?'done':''}"></span><span class="grow"><b>Glute Day</b><span class="small" style="display:block;margin-top:4px">3 exercises · tap to open workout</span></span><span>›</span></button>${['8,000 steps','Have a 30g protein meal','Drink 2 Hydros'].map((x,i)=>`<button class="todo" onclick="checked[${i+1}]=!checked[${i+1}];render()"><span class="check ${checked[i+1]?'done':''}"></span><b class="grow">${x}</b></button>`).join('')}<button class="btn primary full" style="margin-top:22px" onclick="view='complete';render()">Complete day</button>`
}
function workoutHTML(){return `<button class="btn" onclick="view='today';render()">← Back to today</button><p class="eyebrow" style="margin-top:18px">TODAY'S WORKOUT</p><h1>Glute Day</h1><div class="money"><b>Ready to train?</b><p class="muted">Log your weight and notes as you go.</p></div>${exercise('Barbell Hip Thrust','4 × 8',145,'hip')}${exercise('Bulgarian Split Squat','3 × 10/side',30,'split')}${exercise('Cable Kickback','3 × 12/side',25,'kick')}<button class="btn primary full" onclick="checked[0]=true;view='today';render()">Save workout</button>`}
function exercise(name,rx,last,key){const v=Number(weights[key]||0),win=v>last;return `<div class="work"><h3 style="margin:0">${name}</h3><p class="small">${rx}</p><div class="target ${win?'win':''}">${win?`New best — ${v} lb · +${v-last} lb PR`:`Last time ${last} lb · beat it`}</div><div class="weight"><span class="small">Weight used</span><div><input type="number" value="${weights[key]}" oninput="weights['${key}']=this.value"> lb</div></div><div class="stack" style="margin-top:12px"><textarea placeholder="Notes for Maddie"></textarea></div></div>`}
function calendarHTML(){return `<p class="eyebrow">CALENDAR</p><h1>Your plan</h1><p class="muted">Review completed days and see what's coming next.</p><div class="calendar">${['S','M','T','W','T','F','S'].map(x=>`<b style="text-align:center;font-size:10px">${x}</b>`).join('')}${Array.from({length:31},(_,i)=>`<button class="${i===15?'today':''}">${i+1}</button>`).join('')}</div><div class="note"><p class="eyebrow">AUGUST 16</p><b>Glute Day + 3 habits</b><p class="small">Today</p></div>`}
function messagesHTML(coach){return `<p class="eyebrow">MESSAGES</p><h1>${coach?'Client messages':'Maddie'}</h1><div class="card">${messages.map((m,i)=>`<div class="message ${i%2?'me':''}"><b>${esc(m[0])}</b><br>${esc(m[1])}</div>`).join('')}<div class="stack" style="margin-top:14px"><input id="msg" placeholder="Write a message"><button class="btn primary" onclick="sendMessage('${coach?'Coach':'You'}')">Send</button></div></div>`}
function sendMessage(name){const e=document.getElementById('msg');if(!e||!e.value.trim())return;messages.push([name,e.value.trim()]);render()}
function profileHTML(){return `<p class="eyebrow">PROFILE</p><h1>${esc(profile?.full_name||'Client')}</h1><div class="card"><b>Your coach</b><p class="muted">Maddie</p></div><div class="note"><p class="eyebrow">COACH NOTES</p><b>Keep progressing load slowly.</b><p class="small">Focus on controlled reps and staying consistent this week.</p></div><div class="card"><b>Billing</b><p class="small">Plan and payment history will live here.</p></div>`}
function completeHTML(){return `<div class="success"><div class="successMark">✓</div><p class="eyebrow">DAY COMPLETE</p><h1>Way to kill the day.</h1><p class="muted">Send Maddie anything she should know before you wrap up.</p><div class="stack" style="text-align:left"><textarea placeholder="Questions, soreness, wins, concerns, energy, anything else..."></textarea><button class="btn primary full" onclick="checked=[true,true,true,true];view='today';render()">Submit check-in</button></div></div>`}

function coachHTML(){
  if(view==='messages')return messagesHTML(true);if(view==='build')return buildHTML();if(view==='billing')return billingHTML();if(view==='library')return libraryHTML();
  const invite=inviteOpen?`<div class="card"><p class="eyebrow">INVITE CLIENT</p><div class="stack" style="margin-top:10px"><input id="inviteName" placeholder="Client name"><input id="inviteEmail" type="email" placeholder="Client email"><input id="inviteFocus" placeholder="Focus (optional)"><button class="btn primary" onclick="sendInvite()">Send invitation</button><button class="btn" onclick="inviteOpen=false;inviteStatus='';render()">Cancel</button></div>${inviteStatus?`<p class="small" style="margin-top:10px">${esc(inviteStatus)}</p>`:''}</div>`:'';
  const list=clients.length?clients.map(x=>`<div class="card row"><div class="avatar">${esc((x.full_name||'?')[0])}</div><div class="grow"><b>${esc(x.full_name||'Client')}</b><p class="small">${esc(x.focus||'No focus set')}</p></div><button class="btn" onclick="view='build';render()">Open</button></div>`).join(''):`<div class="note"><p class="eyebrow">NO CLIENTS YET</p><b>Invite your first client.</b><p class="small">They’ll get a private email link and automatically attach to your coach account.</p></div>`;
  return `<div class="row"><div class="grow"><p class="eyebrow">COACH</p><h1>Your clients</h1></div><button class="btn primary" onclick="inviteOpen=!inviteOpen;render()">+ Add client</button></div>${invite}${list}`
}
function buildHTML(){return `<button class="btn" onclick="view='clients';render()">← Clients</button><p class="eyebrow" style="margin-top:18px">DAY BUILDER</p><h1>Plan the day</h1><div class="card"><b>Workout</b><p class="small">Add exercises, client-specific sets/reps, and last-weight targets.</p><button class="btn full">+ Add exercise</button></div><div class="card"><b>Habits</b><p class="small">Add saved habits like steps, protein, Hydros, progress pictures and more.</p><button class="btn full">+ Add habit</button></div><div class="stack"><textarea placeholder="Coach note for today"></textarea><button class="btn primary full">Save day</button></div>`}
function billingHTML(){return `<p class="eyebrow">BILLING</p><h1>Client plans</h1><div class="money"><span class="small">Stripe billing will connect after the beta workflow is proven.</span></div>`}
function libraryHTML(){return `<p class="eyebrow">LIBRARY</p><h1>Reusable coaching tools</h1><div class="tabs"><button class="btn primary">Exercises</button><button class="btn">Habits</button></div>${['Barbell Hip Thrust · Glutes · 4 × 8','Bulgarian Split Squat · Glutes · 3 × 10','Cable Kickback · Glutes · 3 × 12'].map(x=>`<div class="card"><b>${x}</b></div>`).join('')}<button class="btn primary full">+ Add exercise</button><div style="height:16px"></div>${['8,000 steps','30g protein meal','Drink 2 Hydros','Take progress pictures'].map(x=>`<div class="card"><b>${x}</b><p class="small">Reusable habit</p></div>`).join('')}`}

initAuth();
