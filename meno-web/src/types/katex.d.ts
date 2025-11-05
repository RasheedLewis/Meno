declare module "katex" {
  export interface KatexRenderOptions {
    displayMode?: boolean;
    throwOnError?: boolean;
    errorColor?: string;
    macros?: Record<string, string>;
    output?: "html" | "mathml" | "htmlAndMathml";
    leqno?: boolean;
    fleqn?: boolean;
  }

  export function render(
    expression: string,
    element: HTMLElement,
    options?: KatexRenderOptions,
  ): void;

  export function renderToString(expression: string, options?: KatexRenderOptions): string;

  const katex: {
    render: typeof render;
    renderToString: typeof renderToString;
  };

  export default katex;
}

