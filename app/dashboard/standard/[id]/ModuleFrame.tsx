"use client";

import { useEffect, useRef, useState } from "react";

type Status = "unknown" | "viewed" | "completed";
type Readiness = {
  checklistDone: number;
  checklistTotal: number;
  scenariosDone: number;
  scenariosTotal: number;
};
type SavedAnswers = { checklist: boolean[]; scenarios: (number | null)[] };

const LOAD_FAILED_MS = 8000;

export default function ModuleFrame({
  html,
  standardCode,
  userId,
}: {
  html: string;
  standardCode?: string;
  userId?: string | null;
}) {
  const [status, setStatus] = useState<Status>("unknown");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [answers, setAnswers] = useState<SavedAnswers | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef<Readiness | null>(null);
  const answersRef = useRef<SavedAnswers | null>(null);
  const restoreSentRef = useRef(false);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!standardCode || !userId) return;

    const failTimer = setTimeout(() => {
      if (readyRef.current === null) setLoadFailed(true);
    }, LOAD_FAILED_MS);

    let pingCount = 0;
    const pingTimer = setInterval(() => {
      if (readyRef.current !== null || pingCount >= 8) {
        clearInterval(pingTimer);
        return;
      }
      pingCount += 1;
      iframeRef.current?.contentWindow?.postMessage({ type: "ksl-module-ping" }, "*");
    }, 2000);

    fetch(`/api/progress?standardCode=${encodeURIComponent(standardCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status) setStatus(d.status);
      })
      .catch(() => {});

    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ standardCode, action: "viewed" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setStatus((s) => (s === "unknown" ? "viewed" : s));
      })
      .catch(() => {});

    function sendRestore() {
      if (restoreSentRef.current || !standardCode) return;
      restoreSentRef.current = true;
      fetch(`/api/answers?standardCode=${encodeURIComponent(standardCode)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.answers) return;
          const a = d.answers as SavedAnswers;
          iframeRef.current?.contentWindow?.postMessage(
            { type: "ksl-module-restore", checklist: a.checklist, scenarios: a.scenarios },
            "*",
          );
        })
        .catch(() => {});
    }

    function onMessage(e: MessageEvent) {
      const data = e.data as
        | { type?: string; standardCode?: string; [key: string]: unknown }
        | null;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "ksl-module-progress") {
        setLoadFailed(false);
        if (typeof data.checklistDone === "number") {
          setReady({
            checklistDone: data.checklistDone,
            checklistTotal:
              typeof data.checklistTotal === "number" ? data.checklistTotal : 0,
            scenariosDone:
              typeof data.scenariosDone === "number" ? data.scenariosDone : 0,
            scenariosTotal:
              typeof data.scenariosTotal === "number" ? data.scenariosTotal : 0,
          });
        }
        sendRestore();
        return;
      }

      if (data.type === "ksl-module-save") {
        setLoadFailed(false);
        if (Array.isArray(data.checklist) && Array.isArray(data.scenarios)) {
          setAnswers({
            checklist: (data.checklist as unknown[]).map(Boolean),
            scenarios: (data.scenarios as unknown[]).map((v) =>
              typeof v === "number" && v >= 0 ? v : null,
            ),
          });
        }
        return;
      }

      if (data.type === "ksl-module-complete" && data.standardCode === standardCode) {
        const r = readyRef.current;
        const gatePassed =
          r !== null &&
          r.checklistDone >= r.checklistTotal &&
          r.scenariosDone >= r.scenariosTotal;
        if (!gatePassed) return;

        const body: Record<string, unknown> = { standardCode, action: "completed" };
        if (Array.isArray(data.checklist) && Array.isArray(data.scenarios)) {
          body.answers = { checklist: data.checklist, scenarios: data.scenarios };
        } else if (answersRef.current) {
          body.answers = answersRef.current;
        }
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.ok) setStatus("completed");
          })
          .catch(() => {});
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(failTimer);
      clearInterval(pingTimer);
      window.removeEventListener("message", onMessage);
    };
  }, [standardCode, userId]);

  async function handleComplete() {
    if (!standardCode || busy || !ready) return;
    if (ready.checklistDone < ready.checklistTotal || ready.scenariosDone < ready.scenariosTotal) {
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        standardCode,
        action: "completed",
        answered: ready.checklistDone + ready.scenariosDone,
        total: ready.checklistTotal + ready.scenariosTotal,
      };
      if (answersRef.current) body.answers = answersRef.current;

      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = res.ok ? await res.json() : null;
      if (d?.ok) setStatus("completed");
    } catch {
      // Surface nothing; keep the button retryable
    } finally {
      setBusy(false);
    }
  }

  const done = status === "completed";
  const signed = ready !== null;
  const allDone =
    signed &&
    ready.checklistDone >= ready.checklistTotal &&
    ready.scenariosDone >= ready.scenariosTotal;
  const canComplete = signed && allDone;

  return (
    <div className="viewer">
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="module"
        sandbox="allow-scripts"
      />
      <div className="viewer-bar">
        <span className={`std-status ${done ? "ready" : "progress"}`}>
          <span className="badge-dot" />
          {done ? "Completed" : status === "viewed" ? "Viewed" : "Not started"}
        </span>
        <div className="viewer-side">
          <span className="viewer-hint">
            {signed
              ? allDone
                ? "All complete — ready to confirm"
                : `Self-check ${ready.checklistDone}/${ready.checklistTotal} · Scenarios ${ready.scenariosDone}/${ready.scenariosTotal}`
              : loadFailed
                ? "Module isn't responding — wait a moment or reload"
                : "Loading module…"}
          </span>
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleComplete}
            disabled={done || busy || !canComplete}
          >
            {done ? "Completed" : busy ? "Saving…" : "Mark standard as complete"}
          </button>
        </div>
      </div>
    </div>
  );
}