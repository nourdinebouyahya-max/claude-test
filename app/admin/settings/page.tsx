import { Trash2 } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { fxRates, getSetting, hasSamples, minTopup } from "@/lib/queries";
import { CallButton } from "@/components/client";
import { PasswordForm, SettingsForm } from "@/components/forms";
import { Card, PageHead } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requirePageUser("admin");
  const samples = hasSamples();
  return (
    <>
      <PageHead title="Settings" sub={`Signed in as ${user.email}`} />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Card title="Agency & currencies" sub="Exchange rates suggest the USD equivalent; managers can still adjust it per top-up.">
          <SettingsForm fx={fxRates()} min={minTopup()} agency={getSetting("agency_name") ?? "Adsolution"} />
        </Card>
        <div className="stack">
          <Card title="Your password">
            <PasswordForm />
          </Card>
          <Card title="Sample data" sub="Demo managers, clients, accounts, top-ups and bank details flagged SAMPLE.">
            {samples ? (
              <div className="stack-sm">
                <div className="warn-box">Removing samples deletes only records flagged SAMPLE. Your real data is not touched. This cannot be undone.</div>
                <div>
                  <CallButton
                    url="/api/samples"
                    method="DELETE"
                    label="Remove samples"
                    icon={<Trash2 size={15} />}
                    className="btn solid-danger"
                    confirm="Remove all SAMPLE data now?"
                    done="Sample data removed"
                  />
                </div>
              </div>
            ) : (
              <div className="info-box">No sample data in the system.</div>
            )}
          </Card>
          <Card title="Security">
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Passwords are hashed (bcrypt); nobody — including the admin — can read them.</li>
              <li>Sessions are HttpOnly cookies; disabling a manager or resetting a password signs them out everywhere.</li>
              <li>Login is rate-limited (5 failed attempts per 15 min per email/IP).</li>
              <li>Every API call checks permissions on the server; managers only reach their own clients.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
