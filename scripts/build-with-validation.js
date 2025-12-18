#!/usr/bin/env node

/**
 * Build script with integrated validation
 * Runs build stability validation before executing Next.js build
 */

const { spawn } = require('child_process');
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

const { BuildStabilityCLI } = require('../src/lib/build-stability/cli.ts');

async function runBuildWithValidation() {
  console.log('🚀 Starting build with validation...\n');

  try {
    // Step 1: Run pre-build validation
    console.log('Step 1: Running pre-build validation...');
    const cli = new BuildStabilityCLI();
    
    await cli.runValidation({
      mode: 'pre-build',
      sourceDir: path.join(process.cwd(), 'src'),
      output: 'text',
      verbose: true
    });

    console.log('✅ Pre-build validation passed\n');

    // Step 2: Run Next.js build
    console.log('Step 2: Running Next.js build...');
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true
    });

    buildProcess.on('close', async (code) => {
      if (code === 0) {
        console.log('\n✅ Next.js build completed successfully');
        
        // Step 3: Run post-build validation
        console.log('\nStep 3: Running post-build validation...');
        try {
          await cli.runValidation({
            mode: 'post-build',
            sourceDir: path.join(process.cwd(), 'src'),
            buildCommand: 'npm run build',
            output: 'text',
            verbose: true
          });
          
          console.log('✅ Post-build validation passed');
          console.log('\n🎉 Build with validation completed successfully!');
        } catch (error) {
          console.error('❌ Post-build validation failed:', error.message);
          process.exit(1);
        }
      } else {
        console.error(`❌ Next.js build failed with exit code ${code}`);
        process.exit(code);
      }
    });

    buildProcess.on('error', (error) => {
      console.error('❌ Failed to start build process:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Pre-build validation failed:', error.message);
    console.log('\n💡 Fix the validation errors above and try again.');
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const skipValidation = args.includes('--skip-validation');
const strictMode = args.includes('--strict');
const warnMode = args.includes('--warn-only');

if (skipValidation) {
  console.log('⚠️ Skipping validation, running build only...');
  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: true
  });
  
  buildProcess.on('close', (code) => {
    process.exit(code);
  });
} else {
  runBuildWithValidation();
}