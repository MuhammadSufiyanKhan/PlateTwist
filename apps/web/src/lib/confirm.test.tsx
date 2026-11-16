import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ConfirmProvider, useConfirm } from './confirm';

function Harness() {
  const confirm = useConfirm();
  const [result, setResult] = useState('none');
  return (
    <>
      <button
        onClick={async () =>
          setResult(
            (await confirm({
              title: 'Delete Avocado?',
              message: 'This removes it.',
              confirmLabel: 'Delete ingredient',
              destructive: true,
            }))
              ? 'yes'
              : 'no',
          )
        }
      >
        open
      </button>
      <p data-testid="result">{result}</p>
    </>
  );
}
const setup = () =>
  render(
    <ConfirmProvider>
      <Harness />
    </ConfirmProvider>,
  );

describe('confirm dialog', () => {
  it('resolves true on confirm and focuses Cancel first for destructive actions', async () => {
    setup();
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('alertdialog', { name: 'Delete Avocado?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Delete ingredient' }));
    expect(screen.getByTestId('result')).toHaveTextContent('yes');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
  it('resolves false on Cancel and on Escape', async () => {
    setup();
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('result')).toHaveTextContent('no');
    await userEvent.click(screen.getByText('open'));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('result')).toHaveTextContent('no');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
