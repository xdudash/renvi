// Local capture service only. Never print bodies or URLs: they contain one-time credentials.
export function extractAuthLink(content,kind) {
  const links=String(content).replace(/&amp;/g,'&').match(/https?:\/\/[^\s<>"']+/g)??[];
  return links.find(link=>{
    try {const u=new URL(link);const type=u.searchParams.get('type');return u.searchParams.has('token_hash') && type===kind || u.pathname.endsWith('/auth/v1/verify') && ['email',kind].includes(type);}catch{return false;}
  })??null;
}
async function json(url) {const r=await fetch(url);return r.ok?r.json():null;}
export async function waitForAuthEmail(email,{kind='signup',after=Date.now()-5000,excludeIds=[],timeout=45000}={}) {
  const base=(process.env.INBUCKET_URL??'http://127.0.0.1:54324').replace(/\/$/,'');
  if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Auth E2E only reads local Mailpit/Inbucket');
  const deadline=Date.now()+timeout;const user=email.split('@')[0];
  while(Date.now()<deadline) {
    try {
      const list=await json(base+'/api/v1/messages');
      if(list?.messages) {
        for(const item of list.messages) {
          if(excludeIds.includes(item.ID) || !item.To?.some(to=>to.Address?.toLowerCase()===email.toLowerCase())) continue;
          if(item.Created && new Date(item.Created).getTime()<after-1000) continue;
          const full=await json(base+'/api/v1/message/'+encodeURIComponent(item.ID));
          const link=extractAuthLink((full?.HTML??'')+'\n'+(full?.Text??''),kind);
          if(link) return {id:item.ID,link};
        }
      } else {
        const messages=await json(base+'/api/v1/mailbox/'+encodeURIComponent(user));
        for(const item of (Array.isArray(messages)?messages:[]).slice().reverse()) {
          if(excludeIds.includes(item.id) || item.date && new Date(item.date).getTime()<after-1000) continue;
          const full=await json(base+'/api/v1/mailbox/'+encodeURIComponent(user)+'/'+encodeURIComponent(item.id));
          const link=extractAuthLink((full?.body?.html??'')+'\n'+(full?.body?.text??''),kind);
          if(link) return {id:item.id,link};
        }
      }
    }catch { /* capture service can briefly restart while Supabase comes up */ }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(`No ${kind} email delivered to local capture service before timeout`);
}
