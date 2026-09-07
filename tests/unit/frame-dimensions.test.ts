import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFrameDimensions } from "@/lib/editor/useFrameDimensions";
import { FRAME_DIMENSIONS_STORAGE_KEY } from "@/lib/editor/constants";

describe("useFrameDimensions hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes with default dimensions for desktop (1044 x 1024)", () => {
    const { result } = renderHook(() => useFrameDimensions("desktop"));

    expect(result.current.frameWidth).toBe(1044);
    expect(result.current.frameHeight).toBe(1024);
  });

  it("initializes with default dimensions for tablet and mobile", () => {
    const { result: tabletResult } = renderHook(() => useFrameDimensions("tablet"));
    expect(tabletResult.current.frameWidth).toBe(768);
    expect(tabletResult.current.frameHeight).toBe(1024);

    const { result: mobileResult } = renderHook(() => useFrameDimensions("mobile"));
    expect(mobileResult.current.frameWidth).toBe(390);
    expect(mobileResult.current.frameHeight).toBe(844);
  });

  it("increases and decreases width via adjustWidth", () => {
    const { result } = renderHook(() => useFrameDimensions("desktop"));

    act(() => {
      result.current.adjustWidth(10);
    });
    expect(result.current.frameWidth).toBe(1054);

    act(() => {
      result.current.adjustWidth(-20);
    });
    expect(result.current.frameWidth).toBe(1034);
  });

  it("increases and decreases height via adjustHeight", () => {
    const { result } = renderHook(() => useFrameDimensions("desktop"));

    act(() => {
      result.current.adjustHeight(50);
    });
    expect(result.current.frameHeight).toBe(1074);

    act(() => {
      result.current.adjustHeight(-100);
    });
    expect(result.current.frameHeight).toBe(974);
  });

  it("clamps width and height to safe bounds", () => {
    const { result } = renderHook(() => useFrameDimensions("desktop"));

    act(() => {
      result.current.setWidth(100); // below min 320
    });
    expect(result.current.frameWidth).toBe(320);

    act(() => {
      result.current.setWidth(5000); // above max 2560
    });
    expect(result.current.frameWidth).toBe(2560);

    act(() => {
      result.current.setHeight(100); // below min 320
    });
    expect(result.current.frameHeight).toBe(320);

    act(() => {
      result.current.setHeight(10000); // above max 3000
    });
    expect(result.current.frameHeight).toBe(3000);
  });

  it("resets back to preset default via resetFrameSize", () => {
    const { result } = renderHook(() => useFrameDimensions("desktop"));

    act(() => {
      result.current.setWidth(1200);
      result.current.setHeight(800);
    });
    expect(result.current.frameWidth).toBe(1200);
    expect(result.current.frameHeight).toBe(800);

    act(() => {
      result.current.resetFrameSize();
    });
    expect(result.current.frameWidth).toBe(1044);
    expect(result.current.frameHeight).toBe(1024);
  });

  it("persists custom dimensions across reloads in localStorage", () => {
    const { result } = renderHook(() => useFrameDimensions("desktop"));

    act(() => {
      result.current.setWidth(1150);
      result.current.setHeight(950);
    });

    const stored = JSON.parse(localStorage.getItem(FRAME_DIMENSIONS_STORAGE_KEY) || "{}");
    expect(stored.desktop.width).toBe(1150);
    expect(stored.desktop.height).toBe(950);
  });
});
