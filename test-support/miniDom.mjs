/**
 * ⭐ T9 · A MINIMAL DOM for node:test — enough to run the ATS report's renderer (shared/atsReportElement.js
 * buildAtsReport) and read what it built, without a browser and without a dependency.
 *
 * It implements exactly what the renderer calls — createElement, createTextNode, setAttribute, append, style.width,
 * addEventListener — plus what the tests read: outerHTML (attributes in insertion order, text ESCAPED, so a term that
 * is markup prints as characters), textContent, querySelectorAll for simple selectors (tag, [attr], tag[attr],
 * [attr="v"], .class), and click(). It is not a DOM: anything else throws, so a renderer that starts relying on more
 * fails loudly here rather than passing on a stub. The real-browser checks are in test/t9AtsReportComponent.test.js.
 */
const VOID = new Set(["br", "img", "input", "meta", "link", "hr"]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

class Text {
  constructor(data) { this.nodeType = 3; this.data = String(data); this.parentNode = null; }
  get textContent() { return this.data; }
  get outerHTML() { return esc(this.data); }
}

class Element {
  constructor(tag, doc) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.localName = tag.toLowerCase(); this.ownerDocument = doc;
    this.attrs = new Map(); this.childNodes = []; this.parentNode = null; this.listeners = {};
    const el = this;
    this.style = { _w: null, set width(v) { el.style._w = v; }, get width() { return el.style._w; } };
  }
  setAttribute(k, v) { this.attrs.set(String(k).toLowerCase(), String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  hasAttribute(k) { return this.attrs.has(k); }
  removeAttribute(k) { this.attrs.delete(k); }
  get className() { return this.getAttribute("class") || ""; }
  append(...nodes) {
    for (const n of nodes) {
      const node = typeof n === "string" ? new Text(n) : n;
      if (!(node instanceof Text || node instanceof Element)) throw new Error("miniDom: append takes nodes and strings only");
      node.parentNode = this; this.childNodes.push(node);
    }
  }
  get children() { return this.childNodes.filter((n) => n instanceof Element); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn({ type: "click", target: this }); }
  fire(type) { for (const fn of this.listeners[type] || []) fn({ type, target: this }); }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(v) { this.childNodes = [new Text(v)]; }
  set innerHTML(_) { throw new Error("miniDom: innerHTML is refused — the ATS report builds with text nodes only"); }
  get outerHTML() {
    const attrs = [...this.attrs].map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${escAttr(v)}"`)).join("");
    const style = this.style._w != null ? ` style="width: ${this.style._w}"` : "";
    if (VOID.has(this.localName)) return `<${this.localName}${attrs}${style}>`;
    return `<${this.localName}${attrs}${style}>${this.childNodes.map((n) => n.outerHTML).join("")}</${this.localName}>`;
  }
  /** Every descendant element, document order. */
  *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
  matches(sel) {
    const m = /^([a-z][\w-]*)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/.exec(sel.trim());
    if (!m) throw new Error(`miniDom: selector not supported: ${sel}`);
    const [, tag, cls, attr, val] = m;
    if (tag && this.localName !== tag) return false;
    if (cls && !this.className.split(/\s+/).includes(cls)) return false;
    if (attr && !this.hasAttribute(attr)) return false;
    if (attr && val !== undefined && this.getAttribute(attr) !== val) return false;
    return true;
  }
  querySelectorAll(sel) { return [...this.walk()].filter((e) => e.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

export function miniDocument() {
  const doc = {
    createElement: (tag) => new Element(tag, doc),
    createTextNode: (data) => new Text(data),
  };
  return doc;
}
