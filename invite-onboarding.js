(function(){
  const queryParams=new URLSearchParams(location.search);
  const setupToken=queryParams.get('setup');
  const hashParams=new URLSearchParams(location.hash.replace(/^#/,''));
  const legacyInvite=hashParams.get('type')==='invite';
  if(!setupToken&&!legacyInvite)return;

  const originalRender=window.render;
  function inviteSetupHTML(){
    return `<div class="login"><div class="box"><div class="logo">1</div><p class="eyebrow" style="margin-top:14px">ONE DAY</p><h1>Finish setting up your account.</h1><p class="muted">Your coach invited you. Choose the password you'll use to sign in to One Day.</p><div class="stack"><input id="invitePw" type="password" autocomplete="new-password" placeholder="Choose password"><input id="invitePw2" type="password" autocomplete="new-password" placeholder="Confirm password"><button class="btn primary full" id="inviteFinishBtn" onclick="finishInviteSetup()">Set password & continue</button></div><div id="inviteSetupMsg"></div></div></div>`;
  }

  window.finishInviteSetup=async function(){
    const p=document.getElementById('invitePw')?.value||'';
    const p2=document.getElementById('invitePw2')?.value||'';
    const msg=document.getElementById('inviteSetupMsg');
    const btn=document.getElementById('inviteFinishBtn');
    if(p.length<6){if(msg)msg.innerHTML='<div class="note">Use at least 6 characters.</div>';return}
    if(p!==p2){if(msg)msg.innerHTML='<div class="note">Passwords do not match.</div>';return}
    if(btn){btn.disabled=true;btn.textContent='Setting up…'}

    if(setupToken){
      const{data,error}=await sb.functions.invoke('accept-client-invite',{body:{token:setupToken,password:p}});
      if(error||data?.error){if(msg)msg.innerHTML=`<div class="note">${esc(data?.error||error?.message||'Could not activate invite.')}</div>`;if(btn){btn.disabled=false;btn.textContent='Set password & continue'}return}
      const email=data?.email;
      if(!email){if(msg)msg.innerHTML='<div class="note">Invite activated, but sign-in details were missing.</div>';return}
      const{data:login,error:loginError}=await sb.auth.signInWithPassword({email,password:p});
      if(loginError){if(msg)msg.innerHTML=`<div class="note">${esc(loginError.message)}</div>`;if(btn){btn.disabled=false;btn.textContent='Set password & continue'}return}
      history.replaceState({},'',location.pathname);
      await hydrate(login.session);
      if(typeof originalRender==='function')originalRender();
      return;
    }

    const{error}=await sb.auth.updateUser({password:p});
    if(error){if(msg)msg.innerHTML=`<div class="note">${esc(error.message)}</div>`;if(btn){btn.disabled=false;btn.textContent='Set password & continue'}return}
    history.replaceState({},'',location.pathname);
    await hydrate((await sb.auth.getSession()).data.session);
    if(typeof originalRender==='function')originalRender();
  };

  window.render=function(){
    if(setupToken||location.hash.includes('type=invite')){root().innerHTML=inviteSetupHTML();return}
    return originalRender();
  };

  setTimeout(()=>window.render(),0);
})();
