interface ElProps {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
}

/** Tiny DOM builder — enough structure without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className !== undefined) {
    node.className = props.className;
  }
  if (props.text !== undefined) {
    node.textContent = props.text;
  }
  if (props.attrs) {
    for (const [key, value] of Object.entries(props.attrs)) {
      node.setAttribute(key, value);
    }
  }
  node.append(...children);
  return node;
}

export function button(
  label: string,
  className: string,
  onClick: () => void,
  options: { disabled?: boolean; title?: string } = {},
): HTMLButtonElement {
  const node = el('button', { className, text: label });
  node.type = 'button';
  node.disabled = options.disabled ?? false;
  if (options.title !== undefined) {
    node.title = options.title;
  }
  node.addEventListener('click', onClick);
  return node;
}
