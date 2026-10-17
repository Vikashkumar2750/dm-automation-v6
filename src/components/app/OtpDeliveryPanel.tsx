import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkAllOtpDelivery, sendOtpDeliveryTest } from "@/lib/otp-diagnostics.functions";

export function OtpDeliveryPanel() {
  const checkFn = useServerFn(checkAllOtpDelivery);
  const testFn = useServerFn(sendOtpDeliveryTest);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orgId, setOrgId] = useState("");

  const check = useMutation({
    mutationFn: () => checkFn(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Check failed"),
  });
  const test = useMutation({
    mutationFn: () => testFn({ data: { email: email.trim(), phone: phone.trim(), organizationId: orgId || null } }),
    onError: (e) => toast.error(e instanceof Error ? e.message.slice(0, 160) : "Test failed"),
  });
  const d = check.data;

  return (
    <Panel title="OTP delivery check (WhatsApp + Email)">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => check.mutate()} disabled={check.isPending}>
            {check.isPending ? "Checking all workspaces…" : "Check all workspaces"}
          </Button>
          {d ? (
            <>
              <StatusBadge tone={d.email.ready ? "success" : "danger"}>
                Email {d.email.ready ? "ready" : "not set up"}
              </StatusBadge>
              <span className="text-xs text-muted-foreground">
                24h: {d.whatsapp.sent24h} WhatsApp codes ({d.whatsapp.verified24h} verified) · {d.email.codes24h} email codes
              </span>
            </>
          ) : null}
        </div>

        {d ? (
          d.workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workspace has connected WhatsApp OTP yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2">Workspace</th><th>WhatsApp</th><th>Template</th><th>Codes 24h</th><th>Email 24h</th></tr>
                </thead>
                <tbody>
                  {d.workspaces.map((w) => (
                    <tr key={w.organizationId} className="border-t">
                      <td className="py-2 font-medium">{w.name}</td>
                      <td>
                        <StatusBadge tone={w.ok ? "success" : "danger"}>{w.ok ? "OK" : "Failing"}</StatusBadge>
                        <span className="ml-2 text-xs text-muted-foreground">{w.detail}</span>
                      </td>
                      <td className="text-xs">{w.template}</td>
                      <td>{w.sent24h} / {w.verified24h} verified</td>
                      <td>{w.emailCodes24h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">Send a live test code</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Test email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="WhatsApp number e.g. 9198xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">All connected workspaces</option>
              {(d?.workspaces ?? []).map((w) => <option key={w.organizationId} value={w.organizationId}>{w.name}</option>)}
            </select>
          </div>
          <Button className="mt-3" variant="outline" disabled={test.isPending || (!email.trim() && !phone.trim())} onClick={() => test.mutate()}>
            {test.isPending ? "Sending…" : "Send test to both"}
          </Button>
          {test.data ? (
            <div className="mt-3 space-y-1">
              {test.data.results.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge tone={r.ok ? "success" : "danger"}>{r.ok ? "Sent" : "Failed"}</StatusBadge>
                  <span className="font-medium">{r.channel}</span>
                  <span className="text-xs text-muted-foreground">{r.target} · {r.detail} · {r.ms} ms</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
