import React, {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { FiCheck, FiChevronDown, FiSearch } from 'react-icons/fi';

/** Lets <Field> label the dropdown inside it. */
export const FieldContext = createContext(null);

const MENU_GAP = 6;
const MAX_MENU_HEIGHT = 320;
const MIN_MENU_WIDTH = 220;
// Long lists (Grand Prix, drivers) get a filter box
const SEARCH_THRESHOLD = 8;

const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return node.props ? textOf(node.props.children) : '';
};

/** Reads <option> children, so callers keep the native <select> markup. */
const readOptions = (children) => {
  const options = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      options.push(...readOptions(child.props.children));
      return;
    }
    if (child.type !== 'option') return;
    const label = textOf(child.props.children);
    options.push({ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) });
  });
  return options;
};

/**
 * Custom dropdown with the same API as a native <select>: pass <option>
 * children and get the chosen value (as a string) in onChange. The menu is
 * rendered in a portal so cards with overflow:hidden can't clip it.
 */
export default function Select({ value, onChange, disabled, children, searchable }) {
  const field = useContext(FieldContext);
  const id = useId();
  const triggerId = field?.inputId || `${id}-trigger`;
  const listId = `${id}-list`;
  const valueId = `${id}-value`;
  const optionId = (i) => `${id}-option-${i}`;

  const options = readOptions(children);
  const current = String(value ?? '');
  const selectedIndex = options.findIndex((o) => o.value === current);
  // Like a native select, an unknown value shows the first option
  const shown = selectedIndex >= 0 ? options[selectedIndex] : options[0];
  const isDisabled = disabled || options.length === 0;
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);

  const needle = query.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - MENU_GAP - 8;
    const above = r.top - MENU_GAP - 8;
    const up = below < Math.min(MAX_MENU_HEIGHT, 240) && above > below;
    const width = Math.min(Math.max(r.width, MIN_MENU_WIDTH), window.innerWidth - 16);
    setPos({
      up,
      width,
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      top: up ? undefined : r.bottom + MENU_GAP,
      bottom: up ? window.innerHeight - r.top + MENU_GAP : undefined,
      maxHeight: Math.max(160, Math.min(MAX_MENU_HEIGHT, up ? above : below)),
    });
  }, []);

  const firstEnabled = (list, from = 0, step = 1) => {
    for (let i = from; i >= 0 && i < list.length; i += step) {
      if (!list[i].disabled) return i;
    }
    return -1;
  };

  const openMenu = () => {
    if (isDisabled) return;
    setQuery('');
    setActive(selectedIndex >= 0 ? selectedIndex : firstEnabled(options));
    place();
    setOpen(true);
  };

  const closeMenu = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const pick = (option) => {
    if (!option || option.disabled) return;
    if (option.value !== current) onChange(option.value);
    closeMenu();
  };

  const move = (step) => {
    if (filtered.length === 0) return;
    let i = active;
    for (let n = 0; n < filtered.length; n += 1) {
      i = (i + step + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setActive(i);
  };

  const onKeyDown = (e) => {
    const inSearch = e.target === searchRef.current;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
      case 'End':
        if (inSearch) return;
        e.preventDefault();
        setActive(e.key === 'Home' ? firstEnabled(filtered) : firstEnabled(filtered, filtered.length - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        pick(filtered[active]);
        break;
      case ' ':
        if (inSearch) return;
        e.preventDefault();
        pick(filtered[active]);
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu();
        break;
      case 'Tab':
        closeMenu(false);
        break;
      default:
        // Typeahead when there's no filter box
        if (!inSearch && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const ch = e.key.toLowerCase();
          for (let n = 1; n <= filtered.length; n += 1) {
            const i = (Math.max(active, 0) + n) % filtered.length;
            if (!filtered[i].disabled && filtered[i].label.toLowerCase().startsWith(ch)) {
              setActive(i);
              break;
            }
          }
        }
    }
  };

  // Follow the trigger while the page scrolls or resizes
  useLayoutEffect(() => {
    if (!open) return undefined;
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  // Close on a click anywhere else
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      closeMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, closeMenu]);

  useEffect(() => {
    if (open && isDisabled) closeMenu(false);
  }, [open, isDisabled, closeMenu]);

  // Focus the filter box and centre the current choice when opening
  useEffect(() => {
    if (!open) return;
    if (showSearch) searchRef.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => {
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
    // Only on open, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the keyboard highlight in view
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const menu = (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={menuRef}
          key="menu"
          className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#15151c]/95 p-1 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          style={{
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            width: pos.width,
            maxHeight: pos.maxHeight,
            transformOrigin: pos.up ? 'bottom center' : 'top center',
          }}
          initial={{ opacity: 0, y: pos.up ? 8 : -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.98, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 36 }}
          onKeyDown={onKeyDown}
        >
          {showSearch && (
            <div className="relative mb-1 shrink-0">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Filter…"
                aria-label="Filter options"
                aria-controls={listId}
                aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                className="w-full rounded-lg border border-white/[0.06] bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 outline-none focus:border-f1-red/60"
              />
            </div>
          )}
          <motion.div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={field?.labelId}
            layoutScroll
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {filtered.length === 0 && <div className="px-3 py-2.5 text-sm text-gray-500">No matches</div>}
            {filtered.map((option, i) => {
              const selected = option.value === current;
              return (
                <div
                  key={`${option.value}-${i}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={option.disabled || undefined}
                  onPointerMove={(e) => {
                    if (e.pointerType === 'mouse' && active !== i && !option.disabled) setActive(i);
                  }}
                  onClick={() => pick(option)}
                  className={`relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    option.disabled ? 'cursor-not-allowed text-gray-600' : selected ? 'font-semibold text-white' : 'text-gray-300'
                  }`}
                >
                  {i === active && (
                    <motion.span
                      layoutId={`${id}-highlight`}
                      className="absolute inset-0 rounded-lg bg-white/[0.08] shadow-[inset_2px_0_0_#E10600]"
                      transition={{ type: 'spring', stiffness: 700, damping: 45 }}
                    />
                  )}
                  <span className="relative min-w-0 flex-1 truncate">{option.label || ' '}</span>
                  {selected && <FiCheck className="relative shrink-0 text-f1-red-bright" aria-hidden="true" />}
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={field ? `${field.labelId} ${valueId}` : undefined}
        aria-activedescendant={open && !showSearch && active >= 0 ? optionId(active) : undefined}
        disabled={isDisabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
        className={`group flex w-full items-center justify-between gap-2 rounded-xl border bg-white/[0.03] py-2.5 pl-3.5 pr-3 text-left text-sm font-semibold text-white outline-none transition hover:border-white/20 focus-visible:border-f1-red focus-visible:ring-2 focus-visible:ring-f1-red/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-f1-red/70 bg-white/[0.05] ring-2 ring-f1-red/20' : 'border-white/10'
        }`}
      >
        <motion.span
          key={shown?.value}
          id={valueId}
          className="min-w-0 truncate"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {shown?.label || ' '}
        </motion.span>
        <FiChevronDown
          aria-hidden="true"
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180 text-f1-red-bright' : ''}`}
        />
      </button>
      {createPortal(menu, document.body)}
    </>
  );
}
