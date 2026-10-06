import React from 'react';

/**
 * Small building blocks shared by the analysis pages, matching the
 * existing dark card / red accent styling.
 */

export function Card({ title, actions, children, className = '' }) {
  return (
    <div className={`bg-f1-gray rounded-lg p-6 mb-6 min-w-0 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {title && <h2 className="text-xl font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm mb-2 font-semibold">{label}</label>
      {children}
    </div>
  );
}

export function Select({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2 bg-f1-dark rounded border border-gray-600 focus:border-f1-red outline-none disabled:opacity-50"
    >
      {children}
    </select>
  );
}

export function Button({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`bg-f1-red text-white px-6 py-2 rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`border border-gray-500 text-white px-4 py-2 rounded hover:border-f1-red disabled:opacity-50 disabled:cursor-not-allowed transition ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="bg-red-900/40 border border-f1-red text-red-100 rounded p-3 mb-4 text-sm">
      {message}
    </div>
  );
}

export function LoadingNote({ children }) {
  return (
    <div className="flex items-center gap-3 text-gray-300 py-4">
      <span className="inline-block w-4 h-4 border-2 border-f1-red border-t-transparent rounded-full animate-spin" />
      <span>{children}</span>
    </div>
  );
}

export function EmptyNote({ children }) {
  return <p className="text-gray-400 py-2">{children}</p>;
}

export function StatTile({ label, value, sub }) {
  return (
    <div className="bg-f1-dark rounded p-4">
      <div className="text-sm text-gray-400">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value ?? '--'}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 rounded transition ${
            active === tab.id ? 'bg-f1-red text-white' : 'bg-f1-gray text-gray-300 hover:text-white'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Table with the app's standard header/row styling. */
export function DataTable({ columns, rows, rowKey, onRowClick, selectedKey }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-600">
            {columns.map((col) => (
              <th key={col.key} className={`p-2 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const key = rowKey ? rowKey(row) : idx;
            const selected = selectedKey !== undefined && key === selectedKey;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-gray-700 ${onRowClick ? 'cursor-pointer' : ''} ${
                  selected ? 'bg-f1-dark' : 'hover:bg-f1-dark'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`p-2 ${col.align === 'right' ? 'text-right tabular-nums' : ''} ${col.className || ''}`}
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
