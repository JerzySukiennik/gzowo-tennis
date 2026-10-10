// Gzowo Tennis net: WebSocket link to the local relay; phones are addressed by id.
export class Net {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.ws = null;
    this.lastUi = new Map();
    this.connect();
  }

  connect() {
    const ws = new WebSocket(`ws://${location.host}`);
    this.ws = ws;
    ws.onopen = () => this.lastUi.clear();
    ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      this.onMessage(msg);
    };
    ws.onclose = () => {
      this.onMessage({ t: 'phones', list: [] });
      setTimeout(() => this.connect(), 1000);
    };
  }

  send(obj, to) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify(to ? { ...obj, to } : obj));
  }

  haptic(to, intensity, sharpness) {
    if (to) this.send({ t: 'h', i: +intensity.toFixed(2), s: +sharpness.toFixed(2) }, to);
  }

  ui(to, screen) {
    if (!to) return;
    const text = JSON.stringify(screen);
    if (this.lastUi.get(to) === text) return;
    this.lastUi.set(to, text);
    this.send({ t: 'ui', ...screen }, to);
  }
}
