import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, Select } from './ui';

const RACES = ['Australian', 'Chinese', 'Japanese', 'Bahrain', 'Saudi Arabian', 'Miami', 'Monaco', 'Spanish', 'Canadian', 'Austrian'];

function Harness({ initial = '2025', onChange = () => {}, options = ['2024', '2025', '2026'], disabledValue }) {
  const [value, setValue] = useState(initial);
  return (
    <Field label="Year">
      <Select
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      >
        {options.map((o) => (
          <option key={o} value={o} disabled={o === disabledValue}>{o}</option>
        ))}
      </Select>
    </Field>
  );
}

test('is labelled by its field and shows the current value', () => {
  render(<Harness />);
  expect(screen.getByRole('combobox', { name: 'Year 2025' })).toHaveAttribute('aria-expanded', 'false');
});

test('picks an option with the mouse', async () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  userEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '2025' })).toHaveAttribute('aria-selected', 'true');

  userEvent.click(screen.getByRole('option', { name: '2026' }));
  expect(onChange).toHaveBeenCalledWith('2026');
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  expect(screen.getByRole('combobox', { name: 'Year 2026' })).toHaveFocus();
});

test('works from the keyboard and skips disabled options', async () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} initial="2024" disabledValue="2025" />);
  const trigger = screen.getByRole('combobox');
  trigger.focus();

  userEvent.keyboard('{arrowdown}');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  userEvent.keyboard('{arrowdown}{enter}');
  expect(onChange).toHaveBeenCalledWith('2026');

  userEvent.keyboard('{arrowdown}');
  userEvent.keyboard('{escape}');
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('long lists get a filter box', () => {
  const onChange = jest.fn();
  render(<Harness options={RACES} initial="Australian" onChange={onChange} />);

  userEvent.click(screen.getByRole('combobox'));
  const filter = screen.getByRole('textbox', { name: /filter options/i });
  expect(filter).toHaveFocus();

  userEvent.type(filter, 'mon');
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Monaco']);
  userEvent.keyboard('{enter}');
  expect(onChange).toHaveBeenCalledWith('Monaco');
});

test('closes when clicking elsewhere without changing the value', async () => {
  const onChange = jest.fn();
  render(
    <>
      <Harness onChange={onChange} />
      <p>elsewhere</p>
    </>
  );
  userEvent.click(screen.getByRole('combobox'));
  userEvent.click(screen.getByText('elsewhere'));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  expect(onChange).not.toHaveBeenCalled();
});
