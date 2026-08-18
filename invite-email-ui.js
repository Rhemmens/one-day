sendInvite=async function(){
  const full_name=(document.getElementById('inviteName')?.value||'').trim();
  const email=(document.getElementById('inviteEmail')?.value||'').trim().toLowerCase();
  const focus=(document.getElementById('inviteFocus')?.value||'').trim();
  if(!full_name||!email){status='Add name and email.';render();return}
  status='Creating secure invitation…';render();
  const{data,error}=await sb.functions.invoke('invite-client',{body:{full_name,email,focus}});
  if(error||data?.error){status=data?.error||error?.message||'Could not create invitation.';render();return}
  lastInviteLink=data?.activation_url||'';
  status=`Invite ready for ${email}. Opening your email app…`;
  await loadClients();
  render();
  if(lastInviteLink){
    const subject='You’re invited to One Day';
    const body=`Hi ${full_name},\n\nYou've been invited to One Day. Open this secure link to choose your password and activate your account:\n\n${lastInviteLink}\n\nThis link expires in 7 days.`;
    location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
};
