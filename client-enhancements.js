workoutCard=function(t){
  const prior=Array.isArray(t.set_logs)?t.set_logs:[];
  const sets=Number(t.prescribed_sets||3);
  const previous=t.last_weight==null?0:Number(t.last_weight);
  const inputs=Array.from({length:sets},(_,i)=>{
    const x=prior[i]||{};
    const weight=x.weight??previous;
    return `<div class="row"><span class="small" style="width:42px">Set ${i+1}</span><input id="sw_${t.id}_${i}" type="number" inputmode="decimal" value="${weight}" placeholder="lb"><input id="sr_${t.id}_${i}" type="number" inputmode="numeric" value="${x.reps??''}" placeholder="reps"></div>`;
  }).join('');
  return `<div class="work"><div class="row"><div class="grow"><h3>${esc(t.name)}</h3><p class="small">${sets} × ${esc(t.prescribed_reps||'')} ${t.superset_key?`· Superset ${esc(t.superset_key)}`:''}${t.superset_rest_seconds!=null?` · ${t.superset_rest_seconds}s rest`:''}</p></div>${t.completed?'<span>✓</span>':''}</div><div class="target">Previous: ${previous} lb${previous>0?' — beat it.':''}</div>${t.pr_achieved&&t.logged_weight!=null?`<div class="note"><b>New best — ${t.logged_weight} lb</b></div>`:''}<div class="stack">${inputs}<textarea id="note_${t.id}" placeholder="Notes for Maddie">${esc(t.client_note||'')}</textarea><button class="btn primary" onclick="saveWorkout('${t.id}')">Save exercise</button></div></div>`;
};

function chooseCalendarDate(date){
  const assigned=calendarDays.find(d=>d.day_date===date);
  calendarSelected=assigned||{id:null,day_date:date,title:'Nothing assigned yet',coach_note:null,tasks:[],eod_checkins:[]};
  render();
}

calendarHTML=function(){
  const d=new Date(`${calendarMonth}T12:00:00`),year=d.getFullYear(),month=d.getMonth(),first=new Date(year,month,1),daysIn=new Date(year,month+1,0).getDate(),offset=first.getDay();
  let cells='';
  for(let i=0;i<offset;i++)cells+='<div></div>';
  for(let n=1;n<=daysIn;n++){
    const date=iso(new Date(year,month,n));
    const day=calendarDays.find(x=>x.day_date===date);
    const done=day&&day.tasks?.length&&day.tasks.every(t=>t.completed);
    const isToday=date===todayISO();
    cells+=`<button onclick="chooseCalendarDate('${date}')" style="min-height:58px;border:1px solid ${isToday?'#7e9279':'#e6e8e3'};border-radius:12px;background:${day?'white':'transparent'};padding:6px;text-align:left"><b>${n}</b>${day?`<div style="font-size:10px;margin-top:5px;color:${done?'#6f845f':'#a98643'}">${done?'Done':'Assigned'}</div>`:`<div style="font-size:10px;margin-top:5px;color:#999">${date>todayISO()?'Open':'—'}</div>`}</button>`;
  }
  let sel='';
  if(calendarSelected){
    if(calendarSelected.id){
      sel=`<div class="card"><p class="eyebrow">${pretty(calendarSelected.day_date)}</p><h2>${esc(calendarSelected.title)}</h2>${calendarSelected.coach_note?`<p>${esc(calendarSelected.coach_note)}</p>`:''}${(calendarSelected.tasks||[]).map(t=>`<div class="row" style="padding:8px 0;border-top:1px solid #eee"><div class="grow"><b>${esc(t.name)}</b><p class="small">${t.type==='workout'?`${t.prescribed_sets||''} × ${esc(t.prescribed_reps||'')}${t.logged_weight!=null?` · ${t.logged_weight} lb`:''}`:'Habit'} · ${t.completed?'Done':'Not done'}</p></div></div>`).join('')}</div>`;
    }else{
      sel=`<div class="card"><p class="eyebrow">${pretty(calendarSelected.day_date)}</p><h2>Nothing assigned yet.</h2><p class="small">When Maddie schedules a workout or habit for this date, it will appear here automatically.</p></div>`;
    }
  }
  return `<div class="row"><button class="btn" onclick="changeMonth(-1)">←</button><div class="grow" style="text-align:center"><p class="eyebrow">CALENDAR</p><h2 style="margin:2px 0">${new Date(`${calendarMonth}T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2></div><button class="btn" onclick="changeMonth(1)">→</button></div><p class="small" style="text-align:center">Tap any date to look ahead or review a past day.</p><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:12px 0"><div class="small">S</div><div class="small">M</div><div class="small">T</div><div class="small">W</div><div class="small">T</div><div class="small">F</div><div class="small">S</div>${cells}</div>${sel}`;
};
