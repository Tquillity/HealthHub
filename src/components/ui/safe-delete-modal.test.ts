import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SafeDeleteModal } from './safe-delete-modal';

const baseProps = {
  isOpen: true,
  onClose: () => {},
  onConfirm: () => {},
  title: 'Remove member',
  itemName: 'Alex',
};

function confirmationLabel(html: string): string | undefined {
  return html.match(/<label for="delete-verification"[^>]*>([^<]*)<\/label>/)?.[1];
}

describe('SafeDeleteModal', () => {
  it('keeps the recipe wording for existing callers', () => {
    const html = renderToStaticMarkup(createElement(SafeDeleteModal, baseProps));
    expect(confirmationLabel(html)).toBe('Type the recipe name to confirm deletion');
    expect(html).toContain('Are you sure you want to delete');
    expect(html).toMatch(/<button[^>]*>Delete<\/button>/);
  });

  it('uses the given label and action, so member removal does not ask for a recipe name', () => {
    const html = renderToStaticMarkup(
      createElement(SafeDeleteModal, {
        ...baseProps,
        confirmLabel: "Type the member's name to confirm removal",
        actionLabel: 'Remove',
      })
    );
    expect(confirmationLabel(html)).toBe('Type the member&#x27;s name to confirm removal');
    expect(html).not.toContain('recipe');
    expect(html).toContain('Are you sure you want to remove');
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
    expect(html).not.toMatch(/<button[^>]*>Delete<\/button>/);
  });
});
