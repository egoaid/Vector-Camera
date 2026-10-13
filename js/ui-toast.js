// ui-toast.js - non-blocking status messages (aria-live).
let timer = 0;
export function toast(msg, { ms = 4500, action, actions } = {}) {
  const el = document.getElementById('toast'); if (!el) return;
  el.replaceChildren(document.createTextNode(msg));
  for (const a of actions || (action ? [action] : [])) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-small'; b.textContent = a.label; b.onclick = a.run; el.append(' ', b); }
  el.hidden = false; clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, ms);
}
