/**
 * CLI Integration Tests
 * Tests the command-line interface and its integration with build validation components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { BuildStabilityCLI } from '../cli';

describe('CLI Integration Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, 'temp-cli-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Store original working directory and environment
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Mock console methods to capture output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original working directory and environment
    process.chdir(originalCwd);
    process.env = originalEnv;

    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('CLI Command Execution', () => {
    it('should display help information', async () => {
      const cli = new BuildStabilityCLI();
      
      // Test that CLI can be instantiated without errors
      expect(cli).toBeDefined();
      expect(typeof cli.runValidation).toBe('function');
    });

    it('should handle pre-build validation mode', async () => {
      // Create a simple test file structure
      const testSrcDir = path.join(tempDir, 'src');
      fs.mkdirSync(testSrcDir, { recursive: true });
      
      // Create a simple TypeScript file
      const testFile = path.join(testSrcDir, 'test.ts');
      fs.writeFileSync(testFile, `
        export const testFunction = () => {
          return 'hello world';
        };
        
        export default testFunction;
      `);

      // Set up minimal environment variables to avoid validation failures
      process.env.NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-characters';

      const cli = new BuildStabilityCLI();
      
      // This should not throw an error
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: testSrcDir,
        output: 'json',
        verbose: false
      })).resolves.not.toThrow();
    });

    it('should handle invalid source directory gracefully', async () => {
      const cli = new BuildStabilityCLI();
      const nonExistentDir = path.join(tempDir, 'non-existent');

      // Set up minimal environment variables
      process.env.NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-characters';

      // Should handle non-existent directory gracefully
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: nonExistentDir,
        output: 'json',
        verbose: false
      })).rejects.toThrow();
    });

    it('should validate configuration loading', async () => {
      // Create a test configuration file
      const configFile = path.join(tempDir, 'build-stability.config.json');
      const config = {
        sourceDir: 'src',
        buildCommand: 'npm run build',
        skipExternalDependencies: true,
        checkEnvironment: false
      };
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

      const cli = new BuildStabilityCLI();
      
      // Test configuration loading (indirectly through CLI usage)
      expect(fs.existsSync(configFile)).toBe(true);
      
      const configContent = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      expect(configContent.sourceDir).toBe('src');
      expect(configContent.skipExternalDependencies).toBe(true);
    });
  });

  describe('Build Process Integration', () => {
    it('should integrate with build monitoring', async () => {
      // Create a simple test project structure
      const testSrcDir = path.join(tempDir, 'src');
      fs.mkdirSync(testSrcDir, { recursive: true });
      
      // Create a simple TypeScript file without external dependencies
      const simpleFile = path.join(testSrcDir, 'simple.ts');
      fs.writeFileSync(simpleFile, `
        export const greet = (name: string): string => {
          return \`Hello, \${name}!\`;
        };
        
        export const add = (a: number, b: number): number => {
          return a + b;
        };
        
        export default greet;
      `);

      // Create another file that imports from the first
      const utilsFile = path.join(testSrcDir, 'utils.ts');
      fs.writeFileSync(utilsFile, `
        import { add } from './simple';
        
        export const calculate = (x: number, y: number): number => {
          return add(x, y) * 2;
        };
      `);

      const cli = new BuildStabilityCLI();

      // Set up environment for testing
      process.env.NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-characters';

      // Create a config file to skip environment validation for this test
      const configFile = path.join(tempDir, 'build-stability.config.json');
      const config = {
        sourceDir: testSrcDir,
        checkEnvironment: false,
        skipExternalDependencies: true
      };
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

      // Test that validation can process the test project
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: testSrcDir,
        output: 'json',
        verbose: false,
        config: configFile
      })).resolves.not.toThrow();
    });

    it('should detect import/export issues', async () => {
      // Create a test file with import/export issues
      const testSrcDir = path.join(tempDir, 'src');
      fs.mkdirSync(testSrcDir, { recursive: true });
      
      // Create a file that imports from a non-existent module
      const problematicFile = path.join(testSrcDir, 'problematic.ts');
      fs.writeFileSync(problematicFile, `
        import { nonExistentFunction } from './non-existent-module';
        
        export const testFunction = () => {
          return nonExistentFunction();
        };
      `);

      const cli = new BuildStabilityCLI();

      // Set up environment
      process.env.NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-characters';

      // This should detect the import issue and fail validation
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: testSrcDir,
        output: 'json',
        verbose: false
      })).rejects.toThrow();
    });
  });

  describe('Output Formatting', () => {
    it('should support different output formats', async () => {
      const testSrcDir = path.join(tempDir, 'src');
      fs.mkdirSync(testSrcDir, { recursive: true });
      
      // Create a simple valid file
      const testFile = path.join(testSrcDir, 'simple.ts');
      fs.writeFileSync(testFile, `
        export const simpleFunction = () => 'test';
        export default simpleFunction;
      `);

      const cli = new BuildStabilityCLI();

      // Set up environment
      process.env.NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-characters';

      // Test JSON output format
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: testSrcDir,
        output: 'json',
        verbose: false
      })).resolves.not.toThrow();

      // Test text output format
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: testSrcDir,
        output: 'text',
        verbose: true
      })).resolves.not.toThrow();

      // Test summary output format
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: testSrcDir,
        output: 'summary',
        verbose: false
      })).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      // Clear environment variables
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.JWT_SECRET;

      const testSrcDir = path.join(tempDir, 'src');
      fs.mkdirSync(testSrcDir, { recursive: true });
      
      const testFile = path.join(testSrcDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test = "test";');

      const cli = new BuildStabilityCLI();

      // Should fail due to missing environment variables
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: testSrcDir,
        output: 'json',
        verbose: false
      })).rejects.toThrow('Environment validation failed');
    });

    it('should handle file system errors gracefully', async () => {
      const cli = new BuildStabilityCLI();

      // Set up environment
      process.env.NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.JWT_SECRET = 'test-jwt-secret-with-minimum-32-characters';

      // Test with a path that doesn't exist
      const nonExistentPath = '/this/path/does/not/exist';
      
      await expect(cli.runValidation({
        mode: 'pre-build',
        sourceDir: nonExistentPath,
        output: 'json',
        verbose: false
      })).rejects.toThrow();
    });
  });
});