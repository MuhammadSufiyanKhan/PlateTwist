import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState, ErrorState, UrgencyBadge } from './ui';

describe('ui components', () => {
  it('shows urgency as text, not colour alone', () => {
    render(<UrgencyBadge urgency="TODAY" />);
    expect(screen.getByText('Use today')).toBeInTheDocument();
  });
  it('renders error and empty states accessibly', () => {
    render(<><ErrorState error={new Error('boom')} /><EmptyState title="Nothing here" /></>);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
