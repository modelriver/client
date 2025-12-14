#!/usr/bin/env node

/**
 * CDN Build Script
 * 
 * Creates versioned CDN bundles in the cdn/ folder.
 * 
 * Usage:
 *   node scripts/build-cdn.js
 *   node scripts/build-cdn.js --version 1.0.1
 */

import { readFileSync, mkdirSync, copyFileSync, symlinkSync, existsSync, rmSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));

// Get version from CLI args or package.json
const args = process.argv.slice(2);
const versionArg = args.find((arg) => arg.startsWith('--version='));
const version = versionArg ? versionArg.split('=')[1] : pkg.version;

console.log(`Building CDN bundle for version ${version}...`);

// Source file (built by rollup)
const sourceFile = join(rootDir, 'dist', 'modelriver.umd.js');
const sourceMap = join(rootDir, 'dist', 'modelriver.umd.js.map');

// Check if source exists
if (!existsSync(sourceFile)) {
  console.error('Error: UMD build not found. Run "npm run build" first.');
  process.exit(1);
}

// Create CDN directories
const cdnDir = join(rootDir, 'cdn');
const versionDir = join(cdnDir, `v${version}`);
const latestDir = join(cdnDir, 'latest');

// Clean up existing version directory
if (existsSync(versionDir)) {
  rmSync(versionDir, { recursive: true });
}

// Create version directory
mkdirSync(versionDir, { recursive: true });

// Copy files
const destFile = join(versionDir, 'modelriver.min.js');
const destMap = join(versionDir, 'modelriver.min.js.map');

copyFileSync(sourceFile, destFile);
console.log(`Created: cdn/v${version}/modelriver.min.js`);

if (existsSync(sourceMap)) {
  copyFileSync(sourceMap, destMap);
  console.log(`Created: cdn/v${version}/modelriver.min.js.map`);
}

// Update latest symlink
if (existsSync(latestDir)) {
  // Check if it's a symlink or directory
  try {
    unlinkSync(latestDir);
  } catch {
    rmSync(latestDir, { recursive: true });
  }
}

// Create relative symlink
try {
  symlinkSync(`v${version}`, latestDir);
  console.log(`Updated: cdn/latest -> v${version}`);
} catch (err) {
  // Symlinks might not work on Windows, copy instead
  mkdirSync(latestDir, { recursive: true });
  copyFileSync(destFile, join(latestDir, 'modelriver.min.js'));
  if (existsSync(destMap)) {
    copyFileSync(destMap, join(latestDir, 'modelriver.min.js.map'));
  }
  console.log(`Copied: cdn/latest/ (symlink not supported)`);
}

console.log('\nCDN build complete!');
console.log(`\nUsage:`);
console.log(`  <script src="https://cdn.modelriver.com/client/v${version}/modelriver.min.js"></script>`);
console.log(`  <script src="https://cdn.modelriver.com/client/latest/modelriver.min.js"></script>`);

