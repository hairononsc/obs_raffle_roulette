import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ClientMessageSchema, ServerMessageSchema } from '../src/index.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

interface Fixture {
  file: string;
  data: unknown;
}

function loadFixtures(subdir: string): Fixture[] {
  const dir = join(FIXTURES_DIR, subdir);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file: `${subdir}/${file}`,
      data: JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown,
    }));
}

function messageTypes(options: readonly { shape: { type: { value: string } } }[]): string[] {
  return options.map((option) => option.shape.type.value);
}

function fixtureType(fixture: Fixture): string {
  return (fixture.data as { type: string }).type;
}

describe('client fixtures', () => {
  const fixtures = loadFixtures('client');

  it('cover every client message type', () => {
    const covered = new Set(fixtures.map(fixtureType));
    for (const type of messageTypes(ClientMessageSchema.options)) {
      expect(covered.has(type), `missing fixture for "${type}"`).toBe(true);
    }
  });

  for (const fixture of fixtures) {
    it(`accept ${fixture.file}`, () => {
      const result = ClientMessageSchema.safeParse(fixture.data);
      const issues = result.success ? '' : JSON.stringify(result.error.issues);
      expect(result.success, issues).toBe(true);
    });
  }
});

describe('server fixtures', () => {
  const fixtures = loadFixtures('server');

  it('cover every server message type', () => {
    const covered = new Set(fixtures.map(fixtureType));
    for (const type of messageTypes(ServerMessageSchema.options)) {
      expect(covered.has(type), `missing fixture for "${type}"`).toBe(true);
    }
  });

  for (const fixture of fixtures) {
    it(`accept ${fixture.file}`, () => {
      const result = ServerMessageSchema.safeParse(fixture.data);
      const issues = result.success ? '' : JSON.stringify(result.error.issues);
      expect(result.success, issues).toBe(true);
    });
  }
});

describe('invalid fixtures', () => {
  for (const fixture of loadFixtures('invalid')) {
    it(`reject ${fixture.file}`, () => {
      expect(ClientMessageSchema.safeParse(fixture.data).success).toBe(false);
      expect(ServerMessageSchema.safeParse(fixture.data).success).toBe(false);
    });
  }
});
