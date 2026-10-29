// نمودار Mermaid در Markdown ساده (و MDX):
//   ```mermaid
//   flowchart TD
//     A[شروع] --> B[پایان]
//   ```
// به <div class="mermaid-diagram" data-mermaid><pre class="mermaid">…</pre></div> تبدیل می‌شود.
// رسم واقعی SVG در مرورگر و با کتابخانهٔ mermaid انجام می‌شود (در BaseLayout، فقط وقتی صفحه نمودار داشته باشد).
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function walk(node) {
  if (!node.children) return;
  node.children = node.children.map((c) => {
    if (c.type === 'code' && (c.lang || '').toLowerCase() === 'mermaid') {
      return { type: 'html', value: `<div class="mermaid-diagram" data-mermaid>\n<pre class="mermaid">${esc(c.value)}</pre>\n</div>` };
    }
    return c;
  });
  node.children.forEach(walk);
}

export default function remarkMermaid() {
  return (tree) => walk(tree);
}
