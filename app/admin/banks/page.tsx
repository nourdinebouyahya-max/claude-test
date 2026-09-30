import { Archive } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { listMethods } from "@/lib/queries";
import { CallButton, Toggle } from "@/components/client";
import { MethodButton } from "@/components/buttons";
import { BankLogo, Empty, PageHead, SampleTag } from "@/components/ui";

export const metadata = { title: "Banks & wallets" };

export default async function Banks() {
  await requirePageUser("admin");
  const methods = listMethods(false);
  return (
    <>
      <PageHead title="Banks & wallets" sub="Receiving methods shown to managers in the top-up and payment forms. Only enabled ones are shown.">
        <MethodButton />
      </PageHead>
      <section className="card">
        {methods.length === 0 ? (
          <Empty>No receiving method yet. Add CIH, Attijariwafa, Wise, USDT TRC20, Payoneer…</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Holder</th>
                  <th>IBAN / account / wallet</th>
                  <th>Currency</th>
                  <th>Instructions</th>
                  <th>Enabled</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => (
                  <tr key={m.id} style={{ opacity: m.enabled ? 1 : 0.6 }}>
                    <td>
                      <span className="row bold">
                        <BankLogo logo={m.logo} /> {m.name} <SampleTag show={m.is_sample} />
                      </span>
                    </td>
                    <td>{m.holder}</td>
                    <td className="mono">{m.account}</td>
                    <td>{m.currency}</td>
                    <td className="small muted" style={{ maxWidth: 280 }}>{m.instructions}</td>
                    <td>
                      <Toggle on={!!m.enabled} url={`/api/methods/${m.id}`} body={{ action: "toggle" }} label={m.enabled ? "Disable" : "Enable"} />
                    </td>
                    <td className="actions">
                      <MethodButton initial={m} />{" "}
                      <CallButton url={`/api/methods/${m.id}`} body={{ action: "archive" }} label="" icon={<Archive size={13} />} className="btn xs ghost" confirm="Archive this method? Past top-ups keep their reference." done="Archived" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
