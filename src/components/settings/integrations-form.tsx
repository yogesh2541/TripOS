"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveRazorpayIntegrationAction,
  saveWhatsappIntegrationAction,
  sendTestWhatsappAction,
  verifyRazorpayKeysAction,
} from "@/server/actions/integrations";
import { cn } from "@/lib/utils";

type WhatsappProps = {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  apiVersion: string;
  verifyToken: string;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  webhookUrl: string;
};
type RazorpayProps = {
  enabled: boolean;
  keyId: string;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  webhookUrl: string;
};

export function IntegrationsForm({
  whatsapp,
  razorpay,
  canEncrypt,
}: {
  whatsapp: WhatsappProps;
  razorpay: RazorpayProps;
  canEncrypt: boolean;
}) {
  return (
    <div className="space-y-6">
      {!canEncrypt && (
        <div className="rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-[#9a4234]">
          Secrets can&apos;t be encrypted yet — set{" "}
          <code className="font-mono">CREDENTIALS_KEY</code> (or{" "}
          <code className="font-mono">NEXTAUTH_SECRET</code>) in the server
          environment before saving credentials.
        </div>
      )}
      <WhatsappCard data={whatsapp} />
      <RazorpayCard data={razorpay} />
    </div>
  );
}

// --- WhatsApp --------------------------------------------------------------

function WhatsappCard({ data }: { data: WhatsappProps }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(data.enabled);
  const [phoneNumberId, setPhoneNumberId] = useState(data.phoneNumberId);
  const [businessAccountId, setBusinessAccountId] = useState(
    data.businessAccountId
  );
  const [apiVersion, setApiVersion] = useState(data.apiVersion);
  const [verifyToken, setVerifyToken] = useState(data.verifyToken);
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testing, startTest] = useTransition();

  function sendTest() {
    startTest(async () => {
      const res = await sendTestWhatsappAction({ toPhone: testPhone });
      if (res.ok) {
        toast.success(`Test message sent to ${res.to}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function save() {
    start(async () => {
      const res = await saveWhatsappIntegrationAction({
        enabled,
        phoneNumberId,
        businessAccountId,
        apiVersion,
        webhookVerifyToken: verifyToken,
        accessToken,
        appSecret,
      });
      if (res.ok) {
        toast.success("WhatsApp settings saved");
        setAccessToken("");
        setAppSecret("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="tc-card overflow-hidden">
      <div className="tc-card-head">
        <div className="ttl">
          <MessageCircle />
          <h3>WhatsApp Business API</h3>
        </div>
        <StatusPill on={data.enabled} />
      </div>
      <div className="p-[18px] space-y-5">
        <EnableToggle
          checked={enabled}
          onChange={setEnabled}
          label="Send via my WhatsApp account"
          hint="Proposals, invoices and reminders go out from your number."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone Number ID">
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 123456789012345"
            />
          </Field>
          <Field label="WhatsApp Business Account ID (optional)">
            <Input
              value={businessAccountId}
              onChange={(e) => setBusinessAccountId(e.target.value)}
              placeholder="e.g. 987654321098765"
            />
          </Field>
          <SecretField
            label="Permanent access token"
            value={accessToken}
            onChange={setAccessToken}
            saved={data.hasAccessToken}
          />
          <SecretField
            label="App secret (for webhook verification)"
            value={appSecret}
            onChange={setAppSecret}
            saved={data.hasAppSecret}
          />
          <Field label="API version (optional)">
            <Input
              value={apiVersion}
              onChange={(e) => setApiVersion(e.target.value)}
              placeholder="v20.0"
            />
          </Field>
          <Field label="Webhook verify token">
            <Input
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="auto-generated on save"
            />
          </Field>
        </div>

        <CopyField label="Your webhook callback URL" value={data.webhookUrl} />

        {/* Connection test — uses the SAVED credentials, so save first. */}
        <div className="rounded-[10px] border border-line bg-paper-2 p-3.5">
          <Label>Send a test message</Label>
          <p className="mt-1 mb-2.5 text-xs text-muted">
            Sends the WhatsApp “hello_world” template using your saved
            credentials — save above first, then test.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+91 98xxxxxxxx"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={sendTest}
              disabled={testing || testPhone.trim().length < 6}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send test
            </Button>
          </div>
        </div>

        <Instructions title="How to connect WhatsApp">
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              In <b>Meta for Developers</b>, open your app → <b>WhatsApp →
              API Setup</b>. Copy the <b>Phone Number ID</b> and your{" "}
              <b>WhatsApp Business Account ID</b> into the fields above.
            </li>
            <li>
              Generate a <b>permanent access token</b> (System User token with
              the <code className="font-mono">whatsapp_business_messaging</code>{" "}
              permission) and paste it in.
            </li>
            <li>
              Under <b>App settings → Basic</b>, copy the <b>App secret</b> —
              this lets us verify inbound webhooks are really from Meta.
            </li>
            <li>
              Under <b>WhatsApp → Configuration → Webhook</b>, set the{" "}
              <b>Callback URL</b> to the URL above and the <b>Verify token</b>{" "}
              to the value in the field above, then <b>Verify and save</b>.
            </li>
            <li>
              Subscribe to the <code className="font-mono">messages</code>{" "}
              webhook field. Toggle <b>Send via my WhatsApp account</b> on and
              save.
            </li>
          </ol>
        </Instructions>

        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save WhatsApp settings
          </Button>
        </div>
      </div>
    </section>
  );
}

// --- Razorpay --------------------------------------------------------------

function RazorpayCard({ data }: { data: RazorpayProps }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(data.enabled);
  const [keyId, setKeyId] = useState(data.keyId);
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [verifying, startVerify] = useTransition();

  function verify() {
    startVerify(async () => {
      const res = await verifyRazorpayKeysAction();
      if (res.ok) toast.success("Razorpay keys verified");
      else toast.error(res.error);
    });
  }

  function save() {
    start(async () => {
      const res = await saveRazorpayIntegrationAction({
        enabled,
        keyId,
        keySecret,
        webhookSecret,
      });
      if (res.ok) {
        toast.success("Payment settings saved");
        setKeySecret("");
        setWebhookSecret("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="tc-card overflow-hidden">
      <div className="tc-card-head">
        <div className="ttl">
          <CreditCard />
          <h3>Payments — Razorpay</h3>
        </div>
        <StatusPill on={data.enabled} />
      </div>
      <div className="p-[18px] space-y-5">
        <EnableToggle
          checked={enabled}
          onChange={setEnabled}
          label="Accept online payments via my Razorpay account"
          hint="Payment links are created on your account; money settles to you."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key ID">
            <Input
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              placeholder="rzp_live_xxxxxxxxxxxx"
            />
          </Field>
          <SecretField
            label="Key Secret"
            value={keySecret}
            onChange={setKeySecret}
            saved={data.hasKeySecret}
          />
          <SecretField
            label="Webhook secret"
            value={webhookSecret}
            onChange={setWebhookSecret}
            saved={data.hasWebhookSecret}
          />
        </div>

        <CopyField label="Your webhook URL" value={data.webhookUrl} />

        <Instructions title="How to connect Razorpay">
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              In the <b>Razorpay Dashboard</b>, go to{" "}
              <b>Settings → API Keys → Generate Key</b>. Copy the{" "}
              <b>Key ID</b> and <b>Key Secret</b> into the fields above.
            </li>
            <li>
              Go to <b>Settings → Webhooks → Add New Webhook</b>. Paste the{" "}
              <b>Webhook URL</b> above and set a <b>Secret</b> — enter the same
              secret in the field above.
            </li>
            <li>
              Subscribe to the{" "}
              <code className="font-mono">payment_link.paid</code>,{" "}
              <code className="font-mono">payment_link.cancelled</code> and{" "}
              <code className="font-mono">payment_link.expired</code> events.
            </li>
            <li>
              Toggle <b>Accept online payments</b> on and save. Use{" "}
              <code className="font-mono">rzp_test_…</code> keys to trial first.
            </li>
          </ol>
        </Instructions>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={verify} disabled={verifying}>
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verify keys
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save payment settings
          </Button>
        </div>
      </div>
    </section>
  );
}

// --- shared bits -----------------------------------------------------------

function StatusPill({ on }: { on: boolean }) {
  return (
    <span className={cn("tc-badge", on ? "tc-b-ok" : "tc-b-neutral")}>
      <span className="bdot" />
      {on ? "Connected" : "Not connected"}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SecretField({
  label,
  value,
  onChange,
  saved,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  saved: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={saved ? "•••••••• saved — leave blank to keep" : "Paste value"}
        autoComplete="off"
      />
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-[9px] border border-line bg-paper-2 px-3 py-2">
        <span className="flex-1 truncate font-mono text-[12px] text-ink-2">
          {value}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
          className="tc-btn tc-btn-ghost tc-btn-sm"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function EnableToggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-[10px] border border-line bg-paper-2 px-4 py-3 text-left"
    >
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-muted mt-0.5">{hint}</span>
      </span>
      <span
        className={cn(
          "relative h-[22px] w-[38px] flex-none rounded-full transition-colors",
          checked ? "bg-inkwash" : "bg-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all",
            checked ? "right-0.5" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

function Instructions({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-[10px] border border-line bg-paper-2">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink list-none">
        <span className="inline-flex items-center gap-2">
          <span className="tc-eyebrow gold">Setup guide</span>
          {title}
        </span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 text-[13px] leading-relaxed text-ink-2">
        {children}
      </div>
    </details>
  );
}
