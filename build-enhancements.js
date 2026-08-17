async function addHabitFromBuild(){
  const input=document.getElementById('buildHabitName');
  const name=(input?.value||'').trim();
  const category=(document.getElementById('buildHabitCategory')?.value||'General').trim()||'General';
  if(!name){status='Type a habit first.';render();return}
  let habit=habits.find(h=>h.name.trim().toLowerCase()===name.toLowerCase());
  if(!habit){
    const{data,error}=await sb.from('habits').insert({coach_id:currentUser.id,name,category}).select().single();
    if(error){status=error.message;render();return}
    habit=data;
    habits=[...habits,habit].sort((a,b)=>a.name.localeCompare(b.name));
    status=`Created “${name}” and added it to this day.`;
  }else status=`Added “${habit.name}” to this day.`;
  draftTasks.push({type:'habit',name:habit.name,habit_id:habit.id});
  render();
}

async function addExerciseFromBuild(){
  const input=document.getElementById('buildExerciseName');
  const name=(input?.value||'').trim();
  const muscle_group=(document.getElementById('buildExerciseMuscle')?.value||'General').trim()||'General';
  const default_sets=Math.max(1,Number(document.getElementById('buildExerciseSets')?.value||3));
  const default_reps=(document.getElementById('buildExerciseReps')?.value||'10').trim()||'10';
  if(!name){status='Type an exercise first.';render();return}
  let exercise=exercises.find(e=>e.name.trim().toLowerCase()===name.toLowerCase());
  if(!exercise){
    const{data,error}=await sb.from('exercises').insert({coach_id:currentUser.id,name,muscle_group,default_sets,default_reps}).select().single();
    if(error){status=error.message;render();return}
    exercise=data;
    exercises=[...exercises,exercise].sort((a,b)=>a.name.localeCompare(b.name));
    status=`Created “${name}” and added it to this day.`;
  }else status=`Added “${exercise.name}” to this day.`;
  draftTasks.push({type:'workout',name:exercise.name,exercise_id:exercise.id,prescribed_sets:exercise.default_sets,prescribed_reps:exercise.default_reps,superset_key:'',superset_rest_seconds:null});
  render();
}

buildHTML=function(){
  const draft=draftTasks.map((t,i)=>`<div class="card"><div class="row"><div class="grow"><b>${esc(t.name)}</b><p class="small">${t.type==='habit'?'Habit':'Workout'}</p></div><button class="btn" onclick="removeDraft(${i})">Remove</button></div>${t.type==='workout'?`<div class="stack" style="margin-top:10px"><div class="row"><input type="number" min="1" value="${t.prescribed_sets||3}" onchange="updateDraft(${i},'prescribed_sets',this.value)" placeholder="Sets"><input value="${esc(t.prescribed_reps||'10')}" onchange="updateDraft(${i},'prescribed_reps',this.value)" placeholder="Reps"></div><div class="row"><input value="${esc(t.superset_key||'')}" onchange="updateDraft(${i},'superset_key',this.value)" placeholder="Superset group e.g. A"><input type="number" min="0" value="${t.superset_rest_seconds??''}" onchange="updateDraft(${i},'superset_rest_seconds',this.value)" placeholder="Rest sec"></div></div>`:''}</div>`).join('');
  const exerciseOptions=exercises.map(e=>`<option value="${esc(e.name)}">${esc(e.muscle_group)} · ${e.default_sets}×${esc(e.default_reps)}</option>`).join('');
  const habitOptions=habits.map(h=>`<option value="${esc(h.name)}">${esc(h.category||'General')}</option>`).join('');
  return `<p class="eyebrow">DAY BUILDER</p><h1>Plan the day</h1>
  <div class="stack"><select id="buildClient" onchange="selectedClientId=this.value">${clients.map(c=>`<option value="${c.id}" ${c.id===selectedClientId?'selected':''}>${esc(c.full_name)}</option>`).join('')}</select><input id="buildDate" type="date" value="${todayISO()}"><input id="dayTitle" value="Training Day" placeholder="Day title"><textarea id="coachNote" placeholder="Coach note shown at top of client day"></textarea></div>
  <div class="card"><p class="eyebrow">ADD EXERCISE</p><b>Type or choose an exercise</b><p class="small">Start typing to use one from the library. If it’s new, One Day will save it to the library automatically.</p><div class="stack" style="margin-top:10px"><input id="buildExerciseName" list="exerciseOptions" placeholder="e.g. Goblet Squat" autocomplete="off"><datalist id="exerciseOptions">${exerciseOptions}</datalist><div class="row"><input id="buildExerciseSets" type="number" min="1" value="3" placeholder="Sets"><input id="buildExerciseReps" value="10" placeholder="Reps"></div><input id="buildExerciseMuscle" value="General" placeholder="Muscle group"><button class="btn primary" onclick="addExerciseFromBuild()">+ Add exercise to day</button></div></div>
  <div class="card"><p class="eyebrow">ADD HABIT</p><b>Type or choose a habit</b><p class="small">Start typing to reuse a saved habit. Type something new and it will be saved automatically.</p><div class="stack" style="margin-top:10px"><input id="buildHabitName" list="habitOptions" placeholder="e.g. 8,000 steps" autocomplete="off"><datalist id="habitOptions">${habitOptions}</datalist><input id="buildHabitCategory" value="General" placeholder="Category"><button class="btn primary" onclick="addHabitFromBuild()">+ Add habit to day</button></div></div>
  ${draft}<button class="btn primary full" onclick="saveDay()">Save day</button>${selectedClientId?`<div class="card"><p class="eyebrow">PRIVATE COACH NOTES</p><textarea id="coachProfileNote" placeholder="Private profile note"></textarea><button class="btn" onclick="addCoachNote()">Save note</button>${coachNotes.slice(0,5).map(n=>`<p class="small">${esc(n.note)} · ${fmtTime(n.created_at)}</p>`).join('')}</div>`:''}`;
};
