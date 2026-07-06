import { Application } from 'pixi.js';

import { WidgetApp } from './app.js';
import { SynthAudio } from './audio/synth-audio.js';
import { WsClient, resolveWsUrl } from './net/ws-client.js';
import { WidgetStage } from './render/stage.js';

// Dev nicety: `?bg=dark` (or any CSS color) previews the transparent
// overlay against a background. OBS uses the default transparent body.
const bg = new URLSearchParams(location.search).get('bg');
if (bg !== null) {
  document.body.style.background = bg === 'dark' ? '#0f172a' : bg;
}

const pixi = new Application();
await pixi.init({
  resizeTo: window,
  backgroundAlpha: 0,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
document.body.appendChild(pixi.canvas);

const stage = new WidgetStage();
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
