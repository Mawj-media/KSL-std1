"use client";

import { useRef, useState } from "react";

type Props = {
  code: string;
  initialHtml: string;
  initialStatus: string;
  initialAvailable: boolean;
};

export function AdminEditor({ code, initialHtml, initialStatus, initialAvailable }: Props) {
  const [html, setHtml] = useState(initialHtml);
  const [status, setStatus] = useState(initialStatus);
  const [available, setAvailable] = useState(initialAvailable);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(nextStatus: string) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/standards/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_html: html, content_status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Save failed");
      } else {
        setStatus(nextStatus);
        setMessage(nextStatus === "published" ? "Published." : "Saved as draft.");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setMessage("Only .html files are accepted");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("File too large (max 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setHtml(String(reader.result ?? ""));
      setMessage("File loaded. Review the preview before saving.");
    };
    reader.readAsText(file);
  }

  return (
    <div className="admin-editor">
      <div className="admin-editor-row">
        <label className="admin-btn admin-btn-file">
          Upload .html file
          <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={onFile} />
        </label>
        <button className="admin-btn" onClick={() => setPreview((v) => !v)}>
          {preview ? "Hide preview" : "Preview"}
        </button>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={available}
            onChange={async (e) => {
              const next = e.target.checked;
              const res = await fetch(`/api/admin/standards/${code}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ available: next }),
              });
              if (res.ok) setAvailable(next);
            }}
          />
          Visible to clients
        </label>
      </div>
      <textarea
        className="admin-textarea"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        placeholder="Paste module HTML here, or upload an .html file..."
        spellCheck={false}
      />
      <div className="admin-editor-row">
        <button className="admin-btn" onClick={() => save("draft")} disabled={saving}>
          Save draft
        </button>
        <button className="admin-btn admin-btn-primary" onClick={() => save("published")} disabled={saving}>
          Save & publish
        </button>
        <span className="admin-status-row">
          {status === "published" ? (
            <span className="admin-pill admin-pill-published">Published</span>
          ) : status === "draft" ? (
            <span className="admin-pill admin-pill-draft">Draft</span>
          ) : (
            <span className="admin-pill admin-pill-none">No content</span>
          )}
        </span>
        {message && <span className="admin-message">{message}</span>}
      </div>
      {preview && (
        <div className="admin-preview">
          <iframe srcDoc={html} title="module preview" sandbox="allow-scripts" />
        </div>
      )}
    </div>
  );
}