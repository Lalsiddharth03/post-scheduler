#!/usr/bin/env node

/**
 * Build Stability CLI Entry Point
 * This script can be run directly with node scripts/build-stability.js
 */

const path = require('path');

// Configure ts-node for TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    target: 'ES2017',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true
  }
});

// Import and run the CLI
const { program } = require('../src/lib/build-stability/cli.ts');

program.parse();