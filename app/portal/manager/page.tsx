import { RolePage } from "../role-page";
export const dynamic="force-dynamic";
export default function ManagerPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){return RolePage({role:"manager",searchParams})}
