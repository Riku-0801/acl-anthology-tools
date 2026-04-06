import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "../../src/utils/debounce.js";

describe("debounce()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call fn before delay has passed", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });

  it("calls fn after delay has passed", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced();
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancels pending call when invoked again within delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced("first");
    vi.advanceTimersByTime(100);
    debounced("second");
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });

  it("calls fn only once for rapid successive calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("forwards arguments correctly", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced("a", "b");
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledWith("a", "b");
  });

  it("can fire multiple times if called after each delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 150);

    debounced();
    vi.advanceTimersByTime(150);
    debounced();
    vi.advanceTimersByTime(150);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
