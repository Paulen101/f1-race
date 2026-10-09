import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { FiAlertTriangle, FiChevronDown, FiInfo } from 'react-icons/fi';
import SpotlightCard from './reactbits/SpotlightCard';
import CountUp from './reactbits/CountUp';
import { getTireColor } from '../utils/helpers';

/**
 * Small building blocks shared by the analysis pages: dark glass panels,
 * red accents and timing-screen style numbers.
 */

export function Card({ title, eyebrow, actions, children, className = '', delay = 0 }) {
  return (
    <SpotlightCard
      className={`rounded-2xl border border-white/[0.06] backdrop-blur-sm p-5 sm:p-6 mb-6 min-w-0 animate-fade-up ${className}`}
      style={{
        '--spotlight-card-surface': 'rgba(20, 20, 27, 0.78)',
        '--spotlight-card-shadow': '0 24px 48px -24px rgba(0, 0, 0, 0.7)',
        animationDelay: delay ? `${delay}ms` : undefined,
      }}
      spotlightColor="#ff3b30"
      intensity={0.07}
      borderGlow={0.55}
      spotlightSize={320}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          {title && (
            <div className="min-w-0">
              {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
              <h2 className="flex items-center gap-3 text-lg sm:text-xl font-bold tracking-tight">
                <span className="h-5 w-1 shrink-0 -skew-x-12 rounded-sm bg-f1-red" aria-hidden="true" />
                <span className="min-w-0">{title}</span>
              </h2>
            </div>
          )}
          {actions}
        </div>
      )}
      {children}
    </SpotlightCard>
  );
}

export function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <label className="eyebrow block mb-2">{label}</label>
      {children}
    </div>
  );
}

export function Select({ value, onChange, disabled, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-3.5 pr-10 text-sm font-semibold text-white outline-none transition hover:border-white/20 focus:border-f1-red focus:bg-white/[0.05] focus:ring-2 focus:ring-f1-red/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {children}
      </select>
      <FiChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}

export function Button({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-f1-red-bright to-f1-red px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[0_8px_24px_-10px_rgba(225,6,0,0.9)] transition hover:shadow-glow active:scale-[0.98] disabled:cursor-not-allowed disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-400 disabled:shadow-none ${className}`}
    >
      {/* Light sweep on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/25 opacity-0 transition-all duration-500 group-hover:left-[120%] group-hover:opacity-100 group-disabled:hidden"
      />
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-f1-red hover:bg-f1-red/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-xl border border-f1-red/50 bg-f1-red/10 p-3.5 text-sm text-red-100 animate-fade-up"
    >
      <FiAlertTriangle className="mt-0.5 shrink-0 text-f1-red-bright" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/** F1 start-light gantry: the five lights come on, then go out. */
export function StartLights({ className = '' }) {
  return (
    <span className={`lights-out inline-flex gap-1.5 ${className}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="block h-2.5 w-2.5 rounded-full bg-[#2a2a33]" />
      ))}
    </span>
  );
}

export function LoadingNote({ children }) {
  return (
    <div role="status" className="mb-4 flex items-center gap-4 py-4 text-sm text-gray-300 animate-fade-up">
      <StartLights />
      <span>{children}</span>
    </div>
  );
}

export function EmptyNote({ children }) {
  return (
    <p className="flex items-start gap-2 py-2 text-sm text-gray-400">
      <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Counts up to numeric values; anything else ("1:21.345", "n/a") is shown as is. */
export function AnimatedValue({ value }) {
  const reduceMotion = useReducedMotion();
  if (value === null || value === undefined || value === '') return '--';
  const text = String(value);
  if (reduceMotion || !NUMERIC.test(text)) return text;
  return <CountUp to={Number(text)} duration={1.2} />;
}

export function StatTile({ label, value, unit, sub, accent = false }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 ${
        accent ? 'border-f1-red/40 bg-f1-red/[0.08]' : 'border-white/[0.06] bg-black/30'
      }`}
    >
      <div className="eyebrow truncate">{label}</div>
      <div className="mt-1.5 truncate font-mono text-2xl font-bold tabular-nums tracking-tight">
        <AnimatedValue value={value} />
        {unit && value != null && value !== '' && <span className="ml-1 text-sm font-semibold text-gray-500">{unit}</span>}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-gray-500">{sub}</div>}
      <span className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-f1-red/60 to-transparent" aria-hidden="true" />
    </div>
  );
}

export function Tabs({ tabs, active, onChange, id = 'tabs' }) {
  return (
    <div
      className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-black/30 p-1"
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              selected ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-indicator`}
                className="absolute inset-0 rounded-xl bg-gradient-to-b from-f1-red-bright to-f1-red shadow-[0_6px_20px_-8px_rgba(225,6,0,0.9)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Toggle chip, e.g. for picking drivers. */
export function Chip({ active, onClick, children, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold tracking-wider transition active:scale-95 ${
        active
          ? 'border-f1-red bg-f1-red text-white shadow-[0_4px_14px_-6px_rgba(225,6,0,0.9)]'
          : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/30 hover:text-white'
      }`}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );
}

// Dark text on the light compounds, white on the rest
const tyreTextColor = (compound) =>
  ['MEDIUM', 'HARD'].includes((compound || '').toUpperCase()) ? '#000' : '#fff';

export function CompoundBadge({ compound, short = false }) {
  if (!compound) return <span className="text-gray-500">?</span>;
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider"
      style={{ backgroundColor: getTireColor(compound), color: tyreTextColor(compound) }}
      title={compound}
    >
      {short ? compound.charAt(0) : compound}
    </span>
  );
}

/** Table with the app's standard header/row styling. */
export function DataTable({ columns, rows, rowKey, onRowClick, selectedKey }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/20">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.02]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`eyebrow whitespace-nowrap px-3 py-2.5 font-semibold ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const key = rowKey ? rowKey(row) : idx;
            const selected = selectedKey !== undefined && key === selectedKey;
            const clickable = Boolean(onRowClick);
            return (
              <tr
                key={key}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                aria-selected={clickable ? selected : undefined}
                className={`border-b border-white/[0.04] last:border-0 transition-colors ${clickable ? 'cursor-pointer outline-none focus-visible:bg-white/[0.05]' : ''} ${
                  selected ? 'bg-f1-red/[0.12] shadow-[inset_3px_0_0_#E10600]' : 'hover:bg-white/[0.04]'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-2.5 ${col.align === 'right' ? 'text-right font-mono tabular-nums' : ''} ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
