(function(){
  const inviteParams=new URLSearchParams(location.hash.replace(/^#/,''));
  const isInvite=inviteParams.get('type')==='invite';
  if(!isInvite)return;

  const originalRender=window.render;
  function inviteSetupHTML(){
    return `<div class="login"><div class="box"><div class="logo">1</div><p class="eyebrow" style="margin-top:14px">ONE DAY</p><h1>Finish setting up your account.</h1><p class="muted">Your coach invited you. Choose the password you'll use to sign in to One Day.</p><div class="stack"><input id="invitePw" type="password" autocomplete="new-password" placeholder="Choose password"><input id="invitePw2" type="password" autocomplete="new-password" placeholder="Confirm password"><button class="btn primary full" onclick="finishInviteSetup()">Set password & continue</button></div><div id="inviteSetupMsg"></div></div></div>`;
  }

  window.finishInviteSetup=async function(){
    const p=document.getElementById('invitePw')?.value||'';
    const p2=document.getElementById('invitePw2')?.value||'';
    const msg=document.getElementById('inviteSetupMsg');
    if(p.length<6){if(msg)msg.innerHTML='<div class="note">Use at least 6 characters.</div>';return}
    if(p!==p2){if(msg)msg.innerHTML='<div class="note">Passwords do not match.</div>';return}
    const{error}=await sb.auth.updateUser({password:p});
    if(error){if(msg)msg.innerHTML=`<div class="note">${esc(error.message)}</div>`;return}
    history.replaceState({},'',location.pathname+location.search);
    await hydrate((await sb.auth.getSession()).data.session);
    if(typeof originalRender==='function')originalRender();
  };

  window.render=function(){
    if(location.hash.includes('type=invite')){root().innerHTML=inviteSetupHTML();return}
    return originalRender();
  };

  setTimeout(()=>window.render(),0);
})();
