import { privateJson } from "@/lib/admin";
import { CLIENT_SECTIONS, MANAGER_SECTIONS, portalContext, portalProjection, readCrm, type Grant } from "@/lib/portal";

export async function GET(request: Request) {
  try {
    const { user, record, grant } = await portalContext();
    if (!user) return privateJson({ error:"Sign in to the CRM to access your workspace." }, 401);
    if (user.role === "admin") {
      const params = new URL(request.url).searchParams;
      const role = params.get("previewRole"), target = params.get("target"), email = params.get("previewEmail");
      if (!role && !email) return privateJson({ role:"admin", redirect:"/" });
      const adminRecord=await readCrm();
      if (!adminRecord) return privateJson({ error:"Open the Admin CRM to load sample records first." },404);
      let preview: Grant | undefined;
      if (email) preview = adminRecord.state.accessGrants?.find(g=>g.email.toLowerCase()===email.toLowerCase() && g.active);
      else if (role==="client" && adminRecord.state.clients.some(c=>c.id===target)) preview = {role:"client",email:user.email,clientId:target!,permissions:[...CLIENT_SECTIONS],active:true};
      else if (role==="manager" && adminRecord.state.managers?.some(m=>m.name===target)) preview = {role:"manager",email:user.email,managerName:target!,clientIds:adminRecord.state.clients.filter(c=>c.manager===target).map(c=>c.id),permissions:[...MANAGER_SECTIONS],active:true};
      if (!preview) return privateJson({ error:"Choose an existing client, manager, or active access grant to preview." },404);
      return privateJson({...portalProjection(adminRecord.state, preview), preview:true});
    }
    if (!grant || !record) return privateJson({ error:"No active access has been assigned to this email.", email:user.email }, 403);
    return privateJson(portalProjection(record.state, grant));
  } catch (error) {
    console.error("Portal read failed", error);
    return privateJson({ error:"Could not load your workspace." }, 503);
  }
}
