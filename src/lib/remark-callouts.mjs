// کادرهای توضیحی در Markdown ساده:
//   > [!tip] عنوان کوتاه
//   > متن کادر
// انواع: tip، warning، info، key (خلاصهٔ سریع — چند نکتهٔ کلیدی، معمولاً به‌صورت فهرست). خروجی همان
// <aside class="callout callout-…"> کامپوننت Callout است.
const TYPES = /^\[!(tip|warning|info|key)\][ \t]*([^\n]*)\n?([\s\S]*)$/i;

function convert(bq) {
  const p = bq.children[0];
  if (!p || p.type !== 'paragraph' || !p.children?.length || p.children[0].type !== 'text') return null;
  const m = p.children[0].value.match(TYPES);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const title = m[2].trim();
  const first = m[3] ? [{ ...p.children[0], value: m[3] }, ...p.children.slice(1)] : p.children.slice(1);
  const rest = [];
  if (first.length) rest.push({ type: 'paragraph', children: first });
  rest.push(...bq.children.slice(1));
  const children = [];
  if (title) children.push({ type: 'paragraph', data: { hName: 'strong' }, children: [{ type: 'text', value: title }] });
  children.push({ type: 'blockquote', data: { hName: 'div' }, children: rest });
  return { type: 'blockquote', data: { hName: 'aside', hProperties: { className: ['callout', `callout-${type}`], role: 'note' } }, children };
}

function walk(node) {
  if (!node.children) return;
  node.children = node.children.map((c) => (c.type === 'blockquote' ? convert(c) ?? c : c));
  node.children.forEach(walk);
}

export default function remarkCallouts() {
  return (tree) => walk(tree);
}
