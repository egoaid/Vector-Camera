// ui-toast.js - non-blocking status messages (aria-live).
let timer = 0;
export function toast(msg, { ms = 4500, action } = {}) {
  const el = document.getElementById('toast'); if (!el) return;
  el.replaceChildren(document.createTextNode(msg));
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-small'; b.textContent = action.label; b.onclick = action.run; el.append(' ', b); }
  el.hidden = false; clearTimeout(timer); timer = setTimeout(() => { el.hidden = true; }, ms);
}
