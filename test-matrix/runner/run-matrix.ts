#!/usr/bin/env tsx
/**
 * Version matrix runner for forge-module-router.
 *
 * Builds and packs the package, then installs it into the basic fixture app
 * with each combination of peer dependency versions, runs the fixture tests,
 * and prints a summary table.
 *
 * Usage:
 *   npx tsx test-matrix/runner/run-matrix.ts
 *   npx tsx test-matrix/runner/run-matrix.ts --combinations M1,M2,M6
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Matrix definition
// ---------------------------------------------------------------------------

interface MatrixCombination {
  id: string;
  react: string;
  reactRouter: string;
  bridge: string;
  notes: string;
}

const MATRIX: MatrixCombination[] = [
  { id: 'M1', react: '16.14.0',  reactRouter: '6.0.0',    bridge: 'latest', notes: 'Oldest supported combination' },
  { id: 'M2', react: '16.14.0',  reactRouter: 'latest',   bridge: 'latest', notes: 'React 16 + modern router (ep-tool scenario)' },
  { id: 'M3', react: '17.0.2',   reactRouter: '6.0.0',    bridge: 'latest', notes: 'React 17 + oldest router' },
  { id: 'M4', react: '17.0.2',   reactRouter: 'latest',   bridge: 'latest', notes: 'React 17 + modern router' },
  { id: 'M5', react: '18.3.1',   reactRouter: '6.0.0',    bridge: 'latest', notes: 'React 18 + oldest router' },
  { id: 'M6', react: '18.3.1',   reactRouter: 'latest',   bridge: 'latest', notes: 'Current dev environment' },
  { id: 'M7', react: '16.14.0',  reactRouter: 'latest',   bridge: '3.3.0',  notes: 'Oldest bridge' },
  { id: 'M8', react: '18.3.1',   reactRouter: 'latest',   bridge: '3.3.0',  notes: 'Latest React + oldest bridge' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../..');
const FIXTURE_SRC = path.resolve(ROOT, 'test-matrix/fixtures/basic');
const RESULTS_DIR = path.resolve(ROOT, 'test-matrix/results');

function copyDirRecursive (src: string, dest: string) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function log (msg: string) {
  process.stdout.write(msg + '\n');
}

function run (cmd: string, cwd: string, silent = false): { ok: boolean; output: string } {
  const result = spawnSync(cmd, { shell: true, cwd, encoding: 'utf8' });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  if (!silent && result.status !== 0) {
    process.stderr.write(output);
  }
  return { ok: result.status === 0, output };
}

function buildAndPack (): string {
  log('\n📦 Building package...');
  run('npm run build', ROOT);
  log('📦 Packing package...');
  const result = execSync('npm pack --json', { cwd: ROOT, encoding: 'utf8' });
  const [{ filename }] = JSON.parse(result) as [{ filename: string }];
  const tgzPath = path.resolve(ROOT, filename);
  log(`📦 Packed: ${tgzPath}\n`);
  return tgzPath;
}

function prepareFixture (combo: MatrixCombination, tgzPath: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `fmr-matrix-${combo.id}-`));

  // Copy fixture files (recursively to include __mocks__ etc.)
  copyDirRecursive(FIXTURE_SRC, tmpDir);

  // Stub @forge/bridge at the Node module level by writing a fake package
  // into node_modules BEFORE npm install runs. npm install will overwrite it,
  // so we do this AFTER install instead — see below.

  // Substitute version placeholders in package.json
  const pkgPath = path.join(tmpDir, 'package.json');
  let pkg = fs.readFileSync(pkgPath, 'utf8');

  // @testing-library/react v14+ requires React 18 (uses react-dom/client).
  // v13 also requires react-dom/client. Only v12 works with React 16 and 17.
  const reactMajor = parseInt(combo.react.split('.')[0] ?? '18', 10);
  const testingLibraryVersion = reactMajor >= 18 ? '^14.0.0' : '^12.0.0';

  pkg = pkg
    .replace('FORGE_MODULE_ROUTER_VERSION', `file:${tgzPath}`)
    .replace(/REACT_VERSION/g, combo.react)
    .replace('REACT_ROUTER_VERSION', combo.reactRouter)
    .replace('BRIDGE_VERSION', combo.bridge)
    .replace('"@testing-library/react": "^14.0.0"', `"@testing-library/react": "${testingLibraryVersion}"`);
  fs.writeFileSync(pkgPath, pkg);

  return tmpDir;
}

function runCombo (combo: MatrixCombination, tgzPath: string): { ok: boolean; output: string } {
  const tmpDir = prepareFixture(combo, tgzPath);

  try {
    // Install
    const install = run('npm install --legacy-peer-deps --prefer-offline', tmpDir, true);
    if (!install.ok) {
      return { ok: false, output: `Install failed:\n${install.output}` };
    }

    // Overwrite @forge/bridge's entry point with a vi.fn() stub AFTER install.
    // The real bridge executes connection logic at require() time, which fails
    // outside a Forge environment. Replacing the entry point prevents this.
    const bridgeDir = path.join(tmpDir, 'node_modules', '@forge', 'bridge');
    const bridgePkg = JSON.parse(fs.readFileSync(path.join(bridgeDir, 'package.json'), 'utf8'));
    const bridgeMain = path.join(bridgeDir, bridgePkg.main ?? 'index.js');
    fs.writeFileSync(bridgeMain, `
"use strict";
// Stub — replaced at test time via vi.spyOn or direct assignment
const view = {
  getContext: function() { return Promise.resolve({}); },
  createHistory: function() { return Promise.reject(new Error("stub")); },
};
exports.view = view;
`);

    // Run tests
    const test = run('npx vitest run --reporter=verbose', tmpDir, true);
    return { ok: test.ok, output: test.output };
  } finally {
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main () {
  // Parse --combinations flag
  const args = process.argv.slice(2);
  const comboFlag = args.find(a => a.startsWith('--combinations='));
  const selectedIds = comboFlag
    ? comboFlag.replace('--combinations=', '').split(',').map(s => s.trim())
    : null;

  const combos = selectedIds
    ? MATRIX.filter(m => selectedIds.includes(m.id))
    : MATRIX;

  if (combos.length === 0) {
    log(`No matching combinations. Available: ${MATRIX.map(m => m.id).join(', ')}`);
    process.exit(1);
  }

  // Ensure results dir exists
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const tgzPath = buildAndPack();

  const results: Array<{ combo: MatrixCombination; ok: boolean; output: string }> = [];

  for (const combo of combos) {
    const label = `[${combo.id}] react@${combo.react} + react-router-dom@${combo.reactRouter} + bridge@${combo.bridge}`;
    process.stdout.write(`  Running ${label}... `);
    const { ok, output } = runCombo(combo, tgzPath);
    process.stdout.write(ok ? '✅ PASS\n' : '❌ FAIL\n');
    results.push({ combo, ok, output });

    // Write per-combination log
    const logFile = path.join(RESULTS_DIR, `${combo.id}.log`);
    fs.writeFileSync(logFile, `${label}\n${'='.repeat(label.length)}\n\n${output}`);
  }

  // Clean up the tgz
  fs.rmSync(tgzPath, { force: true });

  // Summary table
  log('\n' + '─'.repeat(80));
  log('Summary');
  log('─'.repeat(80));
  for (const { combo, ok } of results) {
    const status = ok ? '✅ PASS' : '❌ FAIL';
    log(`  ${status}  [${combo.id}] react@${combo.react} + router@${combo.reactRouter} + bridge@${combo.bridge}  — ${combo.notes}`);
  }
  log('─'.repeat(80));

  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  log(`\n${passed}/${total} matrix combinations passed.\n`);

  if (passed < total) {
    log(`Logs written to ${RESULTS_DIR}/`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
