import { clearSession } from "@/lib/crm-auth";
import { privateJson, sameOrigin } from "@/lib/admin";
export async function POST(request:Request){if(!sameOrigin(request))return privateJson({error:"Invalid origin."},403);await clearSession();return privateJson({ok:true});}
