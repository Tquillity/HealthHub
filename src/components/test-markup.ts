/**
 * Small helpers for tests that render components to static markup (the unit suite runs in
 * Node without a DOM). Not imported by app code.
 */

export type RenderedButton = {
  /** All attributes of the opening tag, e.g. `aria-label="Remove Alex"`. */
  attributes: string;
  ariaLabel: string | undefined;
  /** Visible text: the button's content without tags, entities decoded, whitespace collapsed. */
  text: string;
  disabled: boolean;
};

const decodeEntities = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

export function findButtons(html: string): RenderedButton[] {
  return [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attributes, body]) => {
    const ariaLabel = attributes.match(/aria-label="([^"]*)"/)?.[1];
    return {
      attributes,
      ariaLabel: ariaLabel === undefined ? undefined : decodeEntities(ariaLabel),
      text: decodeEntities(body.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(),
      disabled: /\sdisabled=""/.test(attributes),
    };
  });
}

/** The opening tag of the element with this id. */
export function findTagById(html: string, id: string): string | undefined {
  return html.match(new RegExp(`<[a-z]+[^>]*\\sid="${id}"[^>]*>`))?.[0];
}
