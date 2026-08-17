sendInvite=async function(){
  const full_name=(document.getElementById('inviteName')?.value||'').trim();
  const email=(document.getElementById('inviteEmail')?.value||'').trim().toLowerCase();
  const focus=(document.getElementById('inviteFocus')?.value||'').trim();
  if(!full_name||!email){status='Add name and email.';render();return}
  status='Sending invitation email…';render();
  const{data,error}=await sb.functions.invoke('invite-client',{body:{full_name,email,focus}});
  if(error){status=error.message;render();return}
  lastInviteLink='';
  status=data?.email_sent?`Invitation email sent to ${email}.`:'Client invitation created.';
  await loadClients();
  render();
};
