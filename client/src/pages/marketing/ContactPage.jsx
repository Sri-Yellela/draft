// client/src/pages/marketing/ContactPage.jsx — ⭐ 46v 0d (owner 11-18: "yes do the other pages too, drop the 24 hours
// line"): the landing's treatment — the frame (components/MarketingFrame.jsx), the form in the frame's fields, the sent
// state a note card. ⛔ No promise of a reply time (the owner dropped "We typically respond within 24 hours").
import { useState } from "react";
import { MarketingFrame } from "../../components/MarketingFrame.jsx";
import { NoteCard } from "../../components/TextBlocks.jsx";
import { api } from "../../lib/api.js";

export function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState(null); // "sending" | "ok" | "error"

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus("sending");
    try {
      await api("/api/contact", { method: "POST", body: JSON.stringify(form) });
      setStatus("ok");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  return (
    <MarketingFrame eyebrow="Contact" title="Get in touch"
      lede="A question about your account, a bug, or an idea for draft — write to us here.">
      {status === "ok" ? (
        <NoteCard id="contact-sent" title="Message sent" data-contact-sent="">We'll be in touch soon.</NoteCard>
      ) : (
        <form className="mk-form" onSubmit={handleSubmit} data-contact-form="">
          <input id="contact-name" className="mk-field" aria-label="Name" placeholder="Name *" value={form.name}
            onChange={e => set("name", e.target.value)} required/>
          <input id="contact-email" className="mk-field" aria-label="Email" placeholder="Email *" type="email" value={form.email}
            onChange={e => set("email", e.target.value)} required/>
          <select id="contact-subject" className="mk-field" aria-label="Subject"
            value={form.subject} onChange={e => set("subject", e.target.value)}>
            <option value="">Subject — select one</option>
            <option value="General inquiry">General inquiry</option>
            <option value="Bug report">Bug report</option>
            <option value="Feature request">Feature request</option>
            <option value="Pricing">Pricing</option>
            <option value="Partnership">Partnership</option>
          </select>
          <textarea id="contact-message" className="mk-field" aria-label="Message" placeholder="Message *" value={form.message}
            onChange={e => set("message", e.target.value)} required/>
          {status === "error" && <p className="mk-error" role="alert">Something went wrong — please try again.</p>}
          <div><button className="mk-btn mk-btn--primary" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send message"}
          </button></div>
        </form>
      )}
    </MarketingFrame>
  );
}
