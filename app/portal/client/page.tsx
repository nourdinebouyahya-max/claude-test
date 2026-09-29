import { RolePage } from "../role-page";
export const dynamic="force-dynamic";
export default function ClientPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){return RolePage({role:"client",searchParams})}
