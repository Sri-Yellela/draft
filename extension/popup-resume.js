// ⭐ D98 (lane J6) · the popup's "Résumé" button — it OPENS the Résumé panel on the page for this tab's job, and closes
// the popup (Chrome would close it the moment the page takes focus anyway). ⛔ It generates nothing: a résumé is
// generated only by the panel's own Generate button (extension/resumePanel.js). ⛔ D23: nothing here runs on open —
// no message, no page read, no storage read; the press is the gesture that grants activeTab for the panel.
const btn = document.getElementById('btn-resume-onpage');
const status = document.getElementById('status');

btn?.addEventListener('click', async () => {
  btn.disabled = true;
  const r = await chrome.runtime.sendMessage({ type: 'RESUME_PANEL_OPEN' }).catch(() => null);
  btn.disabled = false;
  if (r?.ok) { window.close(); return; }
  if (status) status.textContent = r?.message || "draft can't open the résumé panel on this page.";
});
