/**
 * Tests for Environment Validator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { EnvironmentValidator } from '../environment-validator';
import { BuildValidator } from '../build-validator';

describe('EnvironmentValidator', () => {
  let validator: EnvironmentValidator;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    validator = new EnvironmentValidator();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  describe('validateEnvironment', () => {
    it('should pass validation with all required variables present', async () => {
      // Set up valid environment
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';

      const result = await validator.validateEnvironment();


      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingVariables).toHaveLength(0);
    });

    it('should fail validation with missing required variables', async () => {
      // Clear required variables
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.JWT_SECRET;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const result = await validator.validateEnvironment({ environment: 'development' });


      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.missingVariables).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(result.missingVariables).toContain('JWT_SECRET');
    });

    it('should validate Supabase URL format', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';

      const result = await validator.validateEnvironment({ environment: 'development' });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.message.includes('NEXT_PUBLIC_SUPABASE_URL')
      )).toBe(true);
      expect(result.configurationIssues.some(issue => 
        issue.variable === 'NEXT_PUBLIC_SUPABASE_URL' && issue.type === 'INVALID_VALUE'
      )).toBe(true);
    });

    it('should validate JWT secret length', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'short'; // Too short

      const result = await validator.validateEnvironment({ environment: 'development' });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.message.includes('JWT_SECRET')
      )).toBe(true);
      expect(result.configurationIssues.some(issue => 
        issue.variable === 'JWT_SECRET' && issue.type === 'INVALID_VALUE'
      )).toBe(true);
    });

    it('should warn about debug logging in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';
      process.env.CRON_SECRET = 'secure-cron-secret-key';

      const result = await validator.validateEnvironment();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.inconsistentVariables).toContain('LOG_LEVEL');
      expect(result.configurationIssues.some(issue => 
        issue.variable === 'LOG_LEVEL' && issue.type === 'INCONSISTENT_ENV'
      )).toBe(true);
    });

    it('should require CRON_SECRET in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CRON_SECRET;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';

      const result = await validator.validateEnvironment();

      expect(result.inconsistentVariables).toContain('CRON_SECRET');
      expect(result.configurationIssues.some(issue => 
        issue.variable === 'CRON_SECRET' && issue.type === 'INCONSISTENT_ENV'
      )).toBe(true);
    });

    it('should validate numeric configuration values', async () => {
      process.env.DB_MAX_RETRIES = 'invalid';
      process.env.DB_CONNECTION_TIMEOUT_MS = '999'; // Too low
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';

      const result = await validator.validateEnvironment();

      expect(result.isValid).toBe(false);
      expect(result.configurationIssues.some(issue => 
        issue.variable === 'DB_MAX_RETRIES' && issue.type === 'INVALID_VALUE'
      )).toBe(true);
      expect(result.configurationIssues.some(issue => 
        issue.variable === 'DB_CONNECTION_TIMEOUT_MS' && issue.type === 'INVALID_VALUE'
      )).toBe(true);
    });

    it('should validate timezone configuration', async () => {
      process.env.DEFAULT_TIMEZONE = 'Invalid/Timezone';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';

      const result = await validator.validateEnvironment();

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.configurationIssues.some(issue => 
        issue.variable === 'DEFAULT_TIMEZONE' && issue.type === 'INVALID_VALUE'
      )).toBe(true);
    });

    it('should skip validation when checkRequired is false', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.JWT_SECRET;

      const result = await validator.validateEnvironment({ checkRequired: false });

      expect(result.missingVariables).toHaveLength(0);
    });

    it('should skip consistency checks when checkConsistency is false', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'debug';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
      process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';
      process.env.CRON_SECRET = 'secure-cron-secret-key';

      const result = await validator.validateEnvironment({ checkConsistency: false });

      expect(result.inconsistentVariables).toHaveLength(0);
    });
  });

  describe('getConfigurationSummary', () => {
    it('should return configuration summary', () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.JWT_SECRET = 'test-secret';
      process.env.LOG_LEVEL = 'info';

      const summary = validator.getConfigurationSummary();

      expect(summary.environment).toBe('development');
      expect(summary.supabase.url).toBe('configured');
      expect(summary.security.jwtSecret).toBe('configured');
      expect(summary.logging.level).toBe('info');
    });

    it('should indicate missing configuration', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.JWT_SECRET;

      const summary = validator.getConfigurationSummary();

      expect(summary.supabase.url).toBe('missing');
      expect(summary.security.jwtSecret).toBe('missing');
    });
  });

  describe('Property-Based Tests', () => {
    // **Feature: build-stability, Property 11: Development/production consistency**
    it('Property 11: Development/production consistency', async () => {
      // Generator for project structures with modules
      const moduleContentGen = fc.record({
        imports: fc.array(fc.record({
          source: fc.oneof(
            fc.constant('./utils'),
            fc.constant('./components/Button'),
            fc.constant('../shared/types'),
            fc.constant('react'),
            fc.constant('next/router')
          ),
          type: fc.constantFrom('default', 'named', 'namespace') as fc.Arbitrary<'default' | 'named' | 'namespace'>,
          imports: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 })
        }), { maxLength: 5 }),
        exports: fc.array(fc.record({
          name: fc.oneof(fc.constant('default'), fc.string({ minLength: 1, maxLength: 20 })),
          type: fc.constantFrom('default', 'named') as fc.Arbitrary<'default' | 'named'>
        }), { maxLength: 5 }),
        hasDefaultExport: fc.boolean()
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(moduleContentGen, { minLength: 1, maxLength: 3 }), // Reduce complexity
          async (moduleStructures) => {
            // Property: For any project, module resolution behavior in development mode 
            // should produce the same results as production mode.

            // Create a temporary test directory structure
            const testDir = path.join(__dirname, 'temp-test-modules');
            
            try {
              // Clean up any existing test directory
              if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true, force: true });
              }
              fs.mkdirSync(testDir, { recursive: true });

              // Create test modules based on generated structure
              const moduleFiles: string[] = [];
              for (let i = 0; i < moduleStructures.length; i++) {
                const moduleStructure = moduleStructures[i];
                const fileName = `module${i}.ts`;
                const filePath = path.join(testDir, fileName);
                
                // Generate module content
                let content = '';
                
                // Add imports
                for (const importInfo of moduleStructure.imports) {
                  if (importInfo.type === 'default') {
                    content += `import defaultImport from '${importInfo.source}';\n`;
                  } else if (importInfo.type === 'named') {
                    const namedImports = importInfo.imports.slice(0, 3).join(', ');
                    if (namedImports) {
                      content += `import { ${namedImports} } from '${importInfo.source}';\n`;
                    }
                  } else if (importInfo.type === 'namespace') {
                    content += `import * as ns from '${importInfo.source}';\n`;
                  }
                }
                
                // Add exports
                for (const exportInfo of moduleStructure.exports) {
                  if (exportInfo.type === 'default') {
                    content += `export default function defaultExport() { return 'default'; }\n`;
                  } else {
                    content += `export const ${exportInfo.name} = 'exported';\n`;
                  }
                }
                
                fs.writeFileSync(filePath, content);
                moduleFiles.push(filePath);
              }

              // Test module resolution in development mode
              const originalNodeEnv = process.env.NODE_ENV;
              process.env.NODE_ENV = 'development';
              
              const buildValidatorDev = new BuildValidator();
              const devResult = await buildValidatorDev.validateBuild(testDir);
              
              // Test module resolution in production mode
              process.env.NODE_ENV = 'production';
              
              const buildValidatorProd = new BuildValidator();
              const prodResult = await buildValidatorProd.validateBuild(testDir);
              
              // Restore original NODE_ENV
              if (originalNodeEnv !== undefined) {
                process.env.NODE_ENV = originalNodeEnv;
              } else {
                delete process.env.NODE_ENV;
              }

              // Property verification: Module resolution should be consistent
              // The validation results should be identical between environments
              expect(devResult.isValid).toBe(prodResult.isValid);
              expect(devResult.errors.length).toBe(prodResult.errors.length);
              expect(devResult.warnings.length).toBe(prodResult.warnings.length);
              
              // Check that the same errors are reported in both environments
              for (let i = 0; i < devResult.errors.length; i++) {
                const devError = devResult.errors[i];
                const prodError = prodResult.errors[i];
                
                expect(devError.type).toBe(prodError.type);
                expect(devError.message).toBe(prodError.message);
                // File paths should be the same (module resolution consistency)
                expect(path.relative(testDir, devError.file)).toBe(path.relative(testDir, prodError.file));
              }
              
              // Check that metrics are consistent (same files processed, same imports/exports found)
              expect(devResult.metrics.totalFiles).toBe(prodResult.metrics.totalFiles);
              expect(devResult.metrics.validatedFiles).toBe(prodResult.metrics.validatedFiles);
              expect(devResult.metrics.totalImports).toBe(prodResult.metrics.totalImports);
              expect(devResult.metrics.totalExports).toBe(prodResult.metrics.totalExports);

            } finally {
              // Clean up test directory
              if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true, force: true });
              }
            }
          }
        ),
        { numRuns: 5 } // Reduce runs to avoid timeout with file system operations
      );
    });

    // **Feature: build-stability, Property 12: Missing environment variable errors**
    it('Property 12: Missing environment variable errors', async () => {
      // Generator for required environment variables that could be missing
      const requiredVariableGen = fc.constantFrom(
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
        'SUPABASE_SERVICE_ROLE_KEY',
        'JWT_SECRET'
      );

      // Generator for environment scenarios where these variables are actually required
      const environmentGen = fc.constantFrom('development', 'production');

      await fc.assert(
        fc.asyncProperty(
          fc.array(requiredVariableGen, { minLength: 1, maxLength: 4 }),
          environmentGen,
          async (missingVariables, environment) => {
            // Save original environment
            const originalValues: Record<string, string | undefined> = {};
            
            // Set up a valid environment first
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';
            process.env.JWT_SECRET = 'this-is-a-very-long-jwt-secret-key-for-testing';

            // Remove the specified missing variables
            for (const variable of missingVariables) {
              originalValues[variable] = process.env[variable];
              delete process.env[variable];
            }

            try {
              const result = await validator.validateEnvironment({ environment });

              // Property: For any required environment variable that is not defined,
              // the build system should provide a clear error message specifying which variable is missing
              
              // Check that validation fails when required variables are missing
              expect(result.isValid).toBe(false);
              
              // Check that each missing variable is reported in missingVariables
              for (const missingVar of missingVariables) {
                expect(result.missingVariables).toContain(missingVar);
              }
              
              // Check that errors contain clear messages about missing variables
              for (const missingVar of missingVariables) {
                const hasErrorForVariable = result.errors.some(error => 
                  error.message.includes(missingVar) && 
                  error.message.includes('Missing required environment variable')
                );
                expect(hasErrorForVariable).toBe(true);
              }
              
              // Check that configuration issues are reported for missing variables
              for (const missingVar of missingVariables) {
                const hasConfigIssue = result.configurationIssues.some(issue =>
                  issue.variable === missingVar &&
                  issue.type === 'MISSING_REQUIRED' &&
                  issue.severity === 'error'
                );
                expect(hasConfigIssue).toBe(true);
              }

            } finally {
              // Restore original values
              for (const variable of missingVariables) {
                if (originalValues[variable] !== undefined) {
                  process.env[variable] = originalValues[variable];
                } else {
                  delete process.env[variable];
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});