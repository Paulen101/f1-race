// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom lacks these browser APIs, which the animation components rely on.
// Reporting reduced motion keeps renders deterministic and skips the WebGL hero.
window.matchMedia = window.matchMedia || ((query) => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe(target) {
    this.callback([{ isIntersecting: true, target }], this);
  }

  unobserve() {}

  disconnect() {}
}
window.IntersectionObserver = window.IntersectionObserver || MockIntersectionObserver;
window.scrollTo = () => {};
// ShinyText falls back gracefully without a 2D context; skip jsdom's "not implemented" error
HTMLCanvasElement.prototype.getContext = () => null;
