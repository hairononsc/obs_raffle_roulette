import { Application } from 'pixi.js';

import { WidgetApp } from './app.js';
import { SynthAudio } from './audio/synth-audio.js';
import { WsClient, resolveWsUrl } from './net/ws-client.js';
import { WidgetStage, type ShowModule } from './render/stage.js';

const ALL_MODULES: readonly ShowModule[] = ['wheel', 'chest', 'offer', 'prizes'];

/** `?show=wheel,chest,offer` picks which modules this OBS source renders;
 *  omitted, empty or fully invalid values mean "all". */
function parseShow(params: URLSearchParams): ReadonlySet<ShowModule> {
  const raw = params.get('show');
  if (raw === null) {
    return new Set(ALL_MODULES);
  }
  const picked = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is ShowModule => (ALL_MODULES as readonly string[]).includes(part));
  return picked.length > 0 ? new Set(picked) : new Set(ALL_MODULES);
}

// No top-level await here: pixi.init() dynamically imports Pixi's browser
// extensions, and a TLA entry module never finishes evaluating while it
// waits — in the production bundle that deadlocks the whole widget.
async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  // Dev nicety: `?bg=dark` (or any CSS color) previews the transparent
  // overlay against a background. OBS uses the default transparent body.
  const bg = params.get('bg');
  if (bg !== null) {
    document.body.style.background = bg === 'dark' ? '#0f172a' : bg;
  }
  const show = parseShow(params);

  const pixi = new Application();
  await pixi.init({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.body.appendChild(pixi.canvas);

  const stage = new WidgetStage(show);
  pixi.stage.addChild(stage.root);

  const layout = (): void => {
    stage.layout(window.innerWidth, window.innerHeight);
  };
  layout();
  window.addEventListener('resize', layout);

  const audio = new SynthAudio();
  // Normal browsers need one gesture to allow audio; OBS autoplays without it.
  window.addEventListener('pointerdown', () => {
    audio.unlock();
  });

  const app = new WidgetApp(stage, new WsClient(resolveWsUrl()), audio);
  pixi.ticker.add((ticker) => {
    app.update(ticker.deltaMS);
  });
  app.start();
}

main().catch((error: unknown) => {
  console.error('[widget] boot failed:', error);
});
