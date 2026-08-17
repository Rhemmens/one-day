// Workout history UX: show previous weight (0 for first-time exercises) and prefill set weights from the most recent logged weight.
workoutCard=function(t){
  const prior=Array.isArray(t.set_logs)?t.set_logs:[];
  const sets=Number(t.prescribed_sets||3);
  const previous=t.last_weight==null?0:Number(t.last_weight);
  const inputs=Array.from({length:sets},(_,i)=>{
    const x=prior[i]||{};
    const weightValue=x.weight??(previous>0?previous:'');
    const repsValue=x.reps??'';
    return `<div class="row"><span class="small" style="width:42px">Set ${i+1}</span><input id="sw_${t.id}_${i}" type="number" inputmode="decimal" value="${weightValue}" placeholder="lb"><input id="sr_${t.id}_${i}" type="number" inputmode="numeric" value="${repsValue}" placeholder="reps"></div>`;
  }).join('');
  return `<div class="work"><div class="row"><div class="grow"><h3>${esc(t.name)}</h3><p class="small">${t.prescribed_sets||''} × ${esc(t.prescribed_reps||'')}</p></div>${t.completed?'<span class="small">✓ Saved</span>':''}</div><div class="target"><b>Previous: ${previous} lb</b>${previous===0?' · First time with this exercise':' · Last weight used'}</div>${inputs}<div class="stack" style="margin-top:10px"><textarea id="note_${t.id}" placeholder="Notes for Maddie">${esc(t.client_note||'')}</textarea><button class="btn primary" onclick="saveWorkout('${t.id}')">Save exercise</button></div></div>`;
};
