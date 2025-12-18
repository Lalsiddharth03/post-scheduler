/**
 * Test script for build stability CLI
 */

import { BuildStabilityCLI } from '../src/lib/build-stability/cli';

async function testCLI() {
  const cli = new BuildStabilityCLI();
  
  console.log('Testing Build Stability CLI...\n');
  
  try {
    await cli.runValidation({
      mode: 'pre-build',
      sourceDir: process.cwd(),
      output: 'text',
      verbose: true
    });
    
    console.log('\n✅ CLI test completed successfully');
  } catch (error) {
    console.error('\n❌ CLI test failed:', error);
    process.exit(1);
  }
}

testCLI();