import { Container, Graphics } from 'pixi.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  width: number;
  height: number;
  color: string;
  lifeMs: number;
}

const GRAVITY = 0.0011;
const DRAG = 0.9995;
const LIFETIME_MS = 4200;

/**
 * Lightweight confetti: a radial burst of rectangles redrawn into a single
 * Graphics each frame (one draw call — cheap even at hundreds of pieces).
 */
export class ConfettiSystem {
  readonly container = new Container();
  private readonly graphics = new Graphics();
  private particles: Particle[] = [];

  constructor() {
    this.container.addChild(this.graphics);
  }

  get active(): boolean {
    return this.particles.length > 0;
  }

  burst(count: number, colors: readonly string[]): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.25 + Math.random() * 0.55;
      this.particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.45,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.02,
        width: 6 + Math.random() * 8,
        height: 4 + Math.random() * 6,
        color: colors[i % colors.length] ?? '#ffffff',
        lifeMs: LIFETIME_MS,
      });
    }
  }

  update(dtMs: number): void {
    if (this.particles.length === 0) {
      return;
    }
    this.particles = this.particles.filter((particle) => {
      particle.lifeMs -= dtMs;
      particle.vy += GRAVITY * dtMs;
      particle.vx *= DRAG ** dtMs;
      particle.x += particle.vx * dtMs;
      particle.y += particle.vy * dtMs;
      particle.rotation += particle.spin * dtMs;
      return particle.lifeMs > 0;
    });
    this.draw();
  }

  private draw(): void {
    const g = this.graphics;
    g.clear();
    for (const particle of this.particles) {
      const alpha = Math.min(1, particle.lifeMs / 900);
      const cos = Math.cos(particle.rotation);
      const sin = Math.sin(particle.rotation);
      const hw = particle.width / 2;
      const hh = particle.height / 2;
      g.poly([
        particle.x - hw * cos + hh * sin,
        particle.y - hw * sin - hh * cos,
        particle.x + hw * cos + hh * sin,
        particle.y + hw * sin - hh * cos,
        particle.x + hw * cos - hh * sin,
        particle.y + hw * sin + hh * cos,
        particle.x - hw * cos - hh * sin,
        particle.y - hw * sin + hh * cos,
      ]).fill({ color: particle.color, alpha });
    }
  }
}
