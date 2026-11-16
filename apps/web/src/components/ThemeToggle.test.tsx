import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../lib/theme';
import { ThemeToggle } from './ThemeToggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme toggle', () => {
  it('switches to dark and light, sets data-theme and remembers the choice', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('specials_theme')).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark theme' })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: 'Light theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await userEvent.click(screen.getByRole('radio', { name: 'System theme' }));
    expect(localStorage.getItem('specials_theme')).toBeNull();
  });
});
