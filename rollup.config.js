import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Shared plugins
const basePlugins = [
  resolve({
    browser: true,
  }),
  commonjs(),
];

// TypeScript plugin configuration
const tsPlugin = (declarationDir) =>
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir,
    rootDir: 'src',
  });

// External dependencies for ESM/CJS builds
const external = [
  'phoenix',
  'react',
  'vue',
  'svelte',
  'svelte/store',
  'rxjs',
  '@angular/core',
];

// Terser options
const terserOptions = {
  compress: {
    drop_console: false,
    drop_debugger: true,
  },
  format: {
    comments: false,
  },
};

export default [
  // ESM and CJS builds for main package
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.mjs',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [...basePlugins, tsPlugin('dist')],
    external,
  },

  // React hook
  {
    input: 'src/react.ts',
    output: [
      {
        file: 'dist/react.mjs',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/react.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      ...basePlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src',
      }),
    ],
    external,
  },

  // Vue composable
  {
    input: 'src/vue.ts',
    output: [
      {
        file: 'dist/vue.mjs',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/vue.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      ...basePlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src',
      }),
    ],
    external,
  },

  // Angular service
  {
    input: 'src/angular.ts',
    output: [
      {
        file: 'dist/angular.mjs',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/angular.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      ...basePlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src',
      }),
    ],
    external,
  },

  // Svelte store
  {
    input: 'src/svelte.ts',
    output: [
      {
        file: 'dist/svelte.mjs',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/svelte.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      ...basePlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src',
      }),
    ],
    external,
  },

  // UMD build for CDN (includes all dependencies)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/modelriver.umd.js',
      format: 'umd',
      name: 'ModelRiver',
      sourcemap: true,
      globals: {},
    },
    plugins: [
      ...basePlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
      terser(terserOptions),
    ],
    // Bundle everything for UMD
    external: [],
  },
];

