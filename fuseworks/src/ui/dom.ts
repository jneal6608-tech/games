// Minimal DOM helpers. The UI is plain DOM + CSS over the canvas: crisp text, real buttons, no framework.
type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; onclick?: (e: MouseEvent) => void; html?: string; style?: string; disabled?: boolean };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'disabled') (el as unknown as HTMLButtonElement).disabled = !!v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}
function append(el: Node, kids: Child[]): void {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T | null;
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtAwe = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Re-trigger a CSS animation class. */
export function bump(el: HTMLElement | null, cls = 'bump'): void {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
