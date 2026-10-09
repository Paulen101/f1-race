import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// The real client talks to the FastAPI backend. Plain functions rather than
// jest.fn(), because CRA's resetMocks would wipe their implementations.
jest.mock('./services/api', () => ({
  getSeasonSchedule: () =>
    Promise.resolve({
      year: 2026,
      events: [
        { round: 0, grand_prix: 'Pre-Season Testing', location: 'Sakhir', country: 'Bahrain', date: '2026-02-26T00:00:00' },
        { round: 1, grand_prix: 'Australian Grand Prix', location: 'Melbourne', country: 'Australia', date: '2026-03-08T00:00:00' },
        { round: 2, grand_prix: 'Chinese Grand Prix', location: 'Shanghai', country: 'China', date: '2099-03-15T00:00:00' },
      ],
    }),
  getAvailableYears: () => Promise.resolve({ years: [2025, 2026] }),
  getAvailableTracks: () => Promise.resolve({ tracks: [] }),
  getSessionInfo: () => Promise.resolve({ drivers: [] }),
}));

test('renders the home page with the race calendar', async () => {
  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: /every lap\. every sector\. decoded\./i })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument();

  // Calendar cards come from the schedule's round/grand_prix/date fields; testing is left out
  expect(await screen.findByText('Australian')).toBeInTheDocument();
  expect(screen.queryByText(/pre-season testing/i)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Chinese Grand Prix' })).toBeInTheDocument();
});

test('navigates to the lap times page', async () => {
  render(<App />);

  const nav = screen.getByRole('navigation', { name: /main/i });
  userEvent.click(within(nav).getByRole('link', { name: /lap times/i }));

  expect(await screen.findByRole('heading', { level: 1, name: /lap time analysis/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /load lap times/i })).toBeInTheDocument();
});
