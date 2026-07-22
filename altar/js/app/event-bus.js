/* =========================================================
   ALTAR EVENT BUS
   Shared communication layer for altar subsystems.
   ========================================================= */

(() => {
  const listeners = new Map();

  function on(eventName, handler) {
    if (typeof handler !== "function") return () => {};

    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);

    return () => off(eventName, handler);
  }

  function once(eventName, handler) {
    const unsubscribe = on(eventName, (detail) => {
      unsubscribe();
      handler(detail);
    });

    return unsubscribe;
  }

  function off(eventName, handler) {
    const eventListeners = listeners.get(eventName);
    if (!eventListeners) return;

    eventListeners.delete(handler);
    if (eventListeners.size === 0) listeners.delete(eventName);
  }

  function emit(eventName, detail = {}) {
    const payload = {
      ...detail,
      eventName,
      timestamp: Date.now()
    };

    listeners.get(eventName)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[AltarEventBus] ${eventName}`, error);
      }
    });

    document.dispatchEvent(
      new CustomEvent(eventName, {
        detail: payload
      })
    );

    return payload;
  }

  function clear(eventName) {
    if (eventName) listeners.delete(eventName);
    else listeners.clear();
  }

  window.AltarEventBus = Object.freeze({
    on,
    once,
    off,
    emit,
    clear
  });
})();
