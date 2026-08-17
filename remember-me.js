const REMEMBER_KEY='oneDayRememberMe';
const REMEMBER_EMAIL_KEY='oneDayRememberEmail';
const SESSION_KEY='oneDayBrowserSession';

const originalSignIn=signIn;
signIn=async function(){
  const remember=document.getElementById('rememberMe')?.checked??true;
  const email=(document.getElementById('authEmail')?.value||'').trim().toLowerCase();
  localStorage.setItem(REMEMBER_KEY,remember?'true':'false');
  if(remember&&email)localStorage.setItem(REMEMBER_EMAIL_KEY,email);else localStorage.removeItem(REMEMBER_EMAIL_KEY);
  sessionStorage.setItem(SESSION_KEY,'1');
  return originalSignIn();
};

loginHTML=function(){
  const remembered=localStorage.getItem(REMEMBER_KEY)!=='false';
  const savedEmail=remembered?(localStorage.getItem(REMEMBER_EMAIL_KEY)||''):'';
  return `<div class="login"><div class="box"><div class="logo">1</div><p class="eyebrow" style="margin-top:14px">ONE DAY</p><h1>Welcome back.</h1><p class="muted">Coach and clients sign in here.</p><div class="stack"><input id="authEmail" type="email" autocomplete="email" value="${esc(savedEmail)}" placeholder="Email"><input id="authPassword" type="password" autocomplete="current-password" placeholder="Password"><label class="row" style="justify-content:flex-start;gap:10px"><input id="rememberMe" type="checkbox" ${remembered?'checked':''} style="width:18px;height:18px"><span class="small">Remember me on this device</span></label><button class="btn primary full" onclick="signIn()">${authBusy?'Working…':'Sign in'}</button></div>${authMessage?`<div class="note"><p>${esc(authMessage)}</p></div>`:''}<p class="small" style="margin-top:14px">New clients activate from the link their coach sends.</p></div></div>`;
};

(async()=>{
  const remember=localStorage.getItem(REMEMBER_KEY);
  const sameBrowserSession=sessionStorage.getItem(SESSION_KEY)==='1';
  if(remember==='false'&&!sameBrowserSession){
    await sb.auth.signOut();
    currentUser=profile=role=null;
    authReady=true;
    render();
  }else{
    sessionStorage.setItem(SESSION_KEY,'1');
    if(!currentUser&&authReady)render();
  }
})();
