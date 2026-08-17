/**
 * RNT Launcher - Wails Events Bridge
 * Safe wrappers for runtime events emitted by backend services.
 */

import type { LaunchRecord, ScanProgress, ScanResult } from '../types/domain'

export type EventCallback<T = unknown> = (data: T) => void

interface WailsRuntime {
  EventsOn?: (eventName: string, callback: (...args: unknown[]) => void) => void
  EventsOff?: (eventName: string, ...callbacks: Array<(...args: unknown[]) => void>) => void
  EventsOnce?: (eventName: string, callback: (...args: unknown[]) => void) => void
  EventsEmit?: (eventName: string, ...data: unknown[]) => void
}

declare global {
  interface Window {
    runtime?: WailsRuntime
  }
}

// In-memory fallback listener map for non-Wails / browser dev mode
const localListeners = new Map<string, Set<EventCallback<unknown>>>()

function getRuntime(): WailsRuntime | null {
  if (typeof window !== 'undefined' && window.runtime) {
    return window.runtime
  }
  return null
}

export const events = {
  /**
   * Listen to an event emitted by backend. Returns an unregister function.
   */
  on<T = unknown>(eventName: string, callback: EventCallback<T>): () => void {
    const runtime = getRuntime()
    const rawCallback = (...args: unknown[]) => {
      callback(args[0] as T)
    }

    if (runtime?.EventsOn) {
      runtime.EventsOn(eventName, rawCallback)
      return () => {
        try {
          runtime.EventsOff?.(eventName, rawCallback)
        } catch {
          // ignore cleanup errors on unmount
        }
      }
    }

    // Local fallback
    if (!localListeners.has(eventName)) {
      localListeners.set(eventName, new Set())
    }
    const set = localListeners.get(eventName)!
    const localCb = (data: unknown) => callback(data as T)
    set.add(localCb)

    return () => {
      localListeners.get(eventName)?.delete(localCb)
    }
  },

  /**
   * Listen to an event once.
   */
  once<T = unknown>(eventName: string, callback: EventCallback<T>): () => void {
    const runtime = getRuntime()
    if (runtime?.EventsOnce) {
      const rawCallback = (...args: unknown[]) => {
        callback(args[0] as T)
      }
      runtime.EventsOnce(eventName, rawCallback)
      return () => {
        try {
          runtime.EventsOff?.(eventName, rawCallback)
        } catch {
          // ignore cleanup errors
        }
      }
    }

    const unsub = this.on<T>(eventName, (data) => {
      unsub()
      callback(data)
    })
    return unsub
  },

  /**
   * Stop listening to an event.
   */
  off(eventName: string): void {
    const runtime = getRuntime()
    if (runtime?.EventsOff) {
      runtime.EventsOff(eventName)
      return
    }
    localListeners.delete(eventName)
  },

  /**
   * Emit an event locally or through Wails runtime.
   */
  emit<T = unknown>(eventName: string, data?: T): void {
    const runtime = getRuntime()
    if (runtime?.EventsEmit) {
      runtime.EventsEmit(eventName, data)
    }

    const set = localListeners.get(eventName)
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data)
        } catch (err) {
          console.error(`Error in event listener for "${eventName}":`, err)
        }
      })
    }
  },
}

// -------------------------------------------------------------
// Typed Event Helpers
// -------------------------------------------------------------

export function onScanStart(callback: () => void): () => void {
  return events.on<void>('scan:start', () => callback())
}

export function onScanProgress(callback: (progress: ScanProgress) => void): () => void {
  return events.on<ScanProgress>('scan:progress', (data) => callback(data))
}

export function onScanComplete(callback: (result: ScanResult) => void): () => void {
  return events.on<ScanResult>('scan:complete', (data) => callback(data))
}

export function onLaunchStart(callback: (record: LaunchRecord) => void): () => void {
  return events.on<LaunchRecord>('launch:start', (data) => callback(data))
}

export function onLaunchExit(callback: (record: LaunchRecord) => void): () => void {
  return events.on<LaunchRecord>('launch:exit', (data) => callback(data))
}
