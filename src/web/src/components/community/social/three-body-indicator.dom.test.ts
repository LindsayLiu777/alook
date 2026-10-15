import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render } from "@/test/react-dom-harness"
import { ThreeBodyIndicator } from "./three-body-indicator"

describe("ThreeBodyIndicator playback", () => {
  let frames: Map<number, FrameRequestCallback>
  let reduced: boolean, hidden: boolean
  let mediaChange: (() => void) | undefined
  let intersection: IntersectionObserverCallback
  let disconnect: ReturnType<typeof vi.fn>

  beforeEach(() => {
    frames = new Map()
    reduced = hidden = false
    let id = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++id, callback)
      return id
    })
    vi.stubGlobal("cancelAnimationFrame", (request: number) => frames.delete(request))
    vi.stubGlobal("matchMedia", () => ({
      get matches() { return reduced },
      addEventListener: (_type: string, callback: () => void) => { mediaChange = callback },
      removeEventListener: () => { mediaChange = undefined },
    }))
    disconnect = vi.fn()
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) { intersection = callback }
      observe() {}
      disconnect = disconnect
    })
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden)
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
  const tick = (now: number) => act(() => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(now))
  })

  it("moves three character heads on the compact29x7 orbit and returns after eleven seconds", () => {
    const view = render(React.createElement(ThreeBodyIndicator))
    const pre = view.container.querySelector("pre")!
    const first = pre.textContent!
    expect(pre).toHaveAttribute("aria-hidden", "true")
    expect(first.split("\n")).toHaveLength(7)
    expect(first.split("\n").every(line => line.length === 29)).toBe(true)
    expect(first.match(/O/g)).toHaveLength(3)
    tick(0)
    tick(16)
    expect(pre.textContent).toBe(first)
    tick(34)
    tick(1000)
    expect(pre.textContent).not.toBe(first)
    expect(pre.textContent!.match(/O/g)).toHaveLength(3)
    tick(11000)
    expect(pre.textContent).toBe(first)
    view.unmount()
    expect(frames.size).toBe(0)
  })

  it("freezes reduced, offscreen and hidden playback and removes every subscription", () => {
    reduced = true
    const view = render(React.createElement(ThreeBodyIndicator))
    const pre = view.container.querySelector("pre")!
    const first = pre.textContent
    expect(frames.size).toBe(0)
    act(() => { reduced = false; mediaChange!() })
    tick(0)
    tick(1000)
    const moving = pre.textContent
    act(() => intersection([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(frames.size).toBe(0)
    tick(5000)
    expect(pre.textContent).toBe(moving)
    act(() => intersection([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    tick(6000)
    expect(pre.textContent).toBe(moving)
    act(() => { hidden = true; document.dispatchEvent(new Event("visibilitychange")) })
    expect(frames.size).toBe(0)
    act(() => { reduced = true; mediaChange!() })
    expect(pre.textContent).toBe(first)
    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(mediaChange).toBeUndefined()
    expect(frames.size).toBe(0)
  })
})
