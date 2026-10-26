"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Mail, RefreshCw, XCircle } from "lucide-react";
import { AppShell, PageHeading } from "@/components/app-shell";

type EmailSendLog = {
  id: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  error: string | null;
  provider: string | null;
  providerMessageId: string | null;
  createdAt: string;
  applicationTitle: string | null;
  applicationCompany: string | null;
};

export default function EmailLogPage() {
  const [logs, setLogs] = useState<EmailSendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-send-log");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      } else {
        setNotice("Could not load the email log.");
      }
    } catch {
      setNotice("Could not load the email log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sentCount = logs.filter((l) => l.status === "sent").length;

  return (
    <AppShell>
      <PageHeading
        eyebrow="Email log"
        title="Proof every follow-up went out."
        copy="A record of each follow-up email that was actually sent — who it went to, the exact subject and message. Failures are kept here too so nothing is silent."
      />

      <div className="mt-5 flex items-center gap-3">
        <span className="rounded-full bg-mint px-4 py-2 text-sm font-black text-fg">
          {sentCount} sent
        </span>
        {logs.length - sentCount > 0 && (
          <span className="rounded-full bg-coral/20 px-4 py-2 text-sm font-black text-coral">
            {logs.length - sentCount} failed
          </span>
        )}
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-2xl border-2 border-fg bg-paper px-4 py-2 text-sm font-black"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-fg/55">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="mt-8 rounded-3xl border-2 border-dashed border-edge/20 bg-panel/50 p-8 text-center">
          <Mail size={32} className="mx-auto text-plum" />
          <p className="mt-3 font-bold text-fg/55">No emails sent yet. Use the send button on a follow-up to create a record here.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`rounded-3xl border-2 p-5 ${log.status === "sent" ? "border-mint/50 bg-mint/10" : "border-coral/40 bg-coral/5"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {log.status === "sent" ? (
                      <span className="flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[10px] font-black uppercase tracking-[.16em] text-fg">
                        <CheckCircle2 size={12} /> Sent
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-coral/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.16em] text-coral">
                        <XCircle size={12} /> Failed
                      </span>
                    )}
                    {log.provider && <span className="text-[10px] font-black uppercase tracking-[.16em] text-fg/40">{log.provider}</span>}
                  </div>
                  <p className="mt-2 truncate font-black">
                    To: {log.recipientEmail}
                  </p>
                  {log.applicationTitle && (
                    <p className="truncate text-xs text-fg/55">
                      {log.applicationTitle}
                      {log.applicationCompany ? ` · ${log.applicationCompany}` : ""}
                    </p>
                  )}
                  <p className="mt-1 truncate text-sm text-fg/70">{log.subject}</p>
                </div>
                <p className="shrink-0 text-xs text-fg/40">
                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(log.createdAt))}
                </p>
              </div>

              {log.status === "sent" ? (
                <div className="mt-3 rounded-xl bg-panel p-3 text-xs leading-5 text-fg/80">
                  <p className="whitespace-pre-wrap">{log.body}</p>
                  {log.providerMessageId && (
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[.16em] text-fg/35">Provider id: {log.providerMessageId}</p>
                  )}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-coral/10 p-3 text-xs font-bold text-coral">{log.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {notice && <p className="mt-5 text-sm font-bold text-coral">{notice}</p>}
    </AppShell>
  );
}
