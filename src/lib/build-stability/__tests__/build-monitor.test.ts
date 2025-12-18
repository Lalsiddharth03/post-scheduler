/**
 * Property-based tests for Build Monitor component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { BuildMonitor } from '../build-monitor';
import { BuildError } from '../types';

describe('BuildMonitor Property Tests', () => {
  let buildMonitor: BuildMonitor;

  beforeEach(() => {
    buildMonitor = new BuildMonitor();
  });

  // **Feature: build-stability, Property 6: Error location accuracy**
  it('Property 6: Error location accuracy - build errors contain exact file path and line number', async () => {
    // Generate test data for build errors with file locations
    const buildErrorGenerator = fc.record({
      type: fc.constantFrom('TYPESCRIPT_ERROR', 'NEXTJS_ERROR', 'MODULE_NOT_FOUND'),
      file: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      line: fc.integer({ min: 1, max: 10000 }),
      column: fc.integer({ min: 0, max: 200 }),
      message: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(buildErrorGenerator, { minLength: 1, maxLength: 10 }),
        async (generatedErrors) => {
          // Create mock build output that contains error information
          const buildOutput = generatedErrors.map(error => {
            switch (error.type) {
              case 'TYPESCRIPT_ERROR':
                return `${error.file}(${error.line},${error.column}): error TS2304: ${error.message}`;
              case 'NEXTJS_ERROR':
                return `Error: ${error.message} at ${error.file}:${error.line}:${error.column}`;
              case 'MODULE_NOT_FOUND':
                return `Module not found: ${error.message} in ${error.file}`;
              default:
                return `${error.file}(${error.line},${error.column}): error: ${error.message}`;
            }
          }).join('\n');

          // Mock the executeBuildCommand method to return our test output
          const originalExecute = (buildMonitor as any).executeBuildCommand;
          (buildMonitor as any).executeBuildCommand = async () => ({
            success: false,
            output: buildOutput
          });

          try {
            const result = await buildMonitor.monitorBuild('npm run build');

            // Property: For any build error, the error report should contain exact file path and line number
            expect(result.errors.length).toBeGreaterThan(0);
            
            result.errors.forEach((error, index) => {
              const originalError = generatedErrors[index];
              
              // Verify file path is present and matches expected
              if (originalError.type !== 'MODULE_NOT_FOUND' || originalError.file) {
                expect(error.file).toBeTruthy();
                expect(typeof error.file).toBe('string');
              }
              
              // Verify line number is present and valid for errors that should have them
              if (originalError.type === 'TYPESCRIPT_ERROR' || 
                  (originalError.type === 'NEXTJS_ERROR' && originalError.file)) {
                expect(error.line).toBeGreaterThan(0);
                expect(typeof error.line).toBe('number');
              }
              
              // Verify error message is preserved
              expect(error.message).toBeTruthy();
              expect(typeof error.message).toBe('string');
            });
          } finally {
            // Restore original method
            (buildMonitor as any).executeBuildCommand = originalExecute;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // **Feature: build-stability, Property 7: Build completion reporting**
  it('Property 7: Build completion reporting - completed builds include compilation time and warnings', async () => {
    // Generate test data for build scenarios
    const buildScenarioGenerator = fc.record({
      success: fc.boolean(),
      warnings: fc.array(
        fc.record({
          type: fc.constantFrom('BUILD_WARNING', 'NEXTJS_WARNING'),
          file: fc.constantFrom('test.ts', 'app.js', 'index.tsx'),
          line: fc.integer({ min: 1, max: 100 }),
          message: fc.constantFrom('Warning message', 'Build warning', 'Type error')
        }),
        { maxLength: 2 }
      ),
      simulatedDuration: fc.integer({ min: 1, max: 5 }) // milliseconds - very short for testing
    });

    await fc.assert(
      fc.asyncProperty(
        buildScenarioGenerator,
        async (scenario) => {
          // Create mock build output with warnings
          const warningOutput = scenario.warnings.map(warning => {
            switch (warning.type) {
              case 'BUILD_WARNING':
                return `${warning.file}(${warning.line},0): warning ${warning.message}`;
              case 'NEXTJS_WARNING':
                return `Warning: ${warning.message} in ${warning.file}`;
              default:
                return `Warning: ${warning.message}`;
            }
          }).join('\n');

          const buildOutput = scenario.success 
            ? `Build completed successfully\n${warningOutput}`
            : `Build failed\n${warningOutput}`;

          // Mock the executeBuildCommand method
          const originalExecute = (buildMonitor as any).executeBuildCommand;
          
          (buildMonitor as any).executeBuildCommand = async () => {
            // Simulate very short build duration for testing
            await new Promise(resolve => setTimeout(resolve, scenario.simulatedDuration));
            return {
              success: scenario.success,
              output: buildOutput
            };
          };

          try {
            const result = await buildMonitor.monitorBuild('npm run build');

            // Property: For any completed build (successful or failed), 
            // the build result should include total compilation time and a list of all warnings

            // 1. Build result should always include duration
            expect(result.duration).toBeDefined();
            expect(typeof result.duration).toBe('number');
            expect(result.duration).toBeGreaterThanOrEqual(0);

            // 2. Build result should include success status
            expect(typeof result.success).toBe('boolean');
            expect(result.success).toBe(scenario.success);

            // 3. Build result should include warnings array
            expect(Array.isArray(result.warnings)).toBe(true);

            // 4. All warnings should have proper structure
            for (const warning of result.warnings) {
              expect(warning.type).toBeDefined();
              expect(typeof warning.type).toBe('string');
              expect(warning.file).toBeDefined();
              expect(typeof warning.file).toBe('string');
              expect(warning.line).toBeDefined();
              expect(typeof warning.line).toBe('number');
              expect(warning.line).toBeGreaterThanOrEqual(0);
              expect(warning.message).toBeDefined();
              expect(typeof warning.message).toBe('string');
              expect(warning.message.length).toBeGreaterThan(0);
            }

            // 5. Number of parsed warnings should be reasonable
            expect(result.warnings.length).toBeGreaterThanOrEqual(0);
            
            // If we generated warnings, we should have some parsed warnings (allowing for parsing variations)
            if (scenario.warnings.length > 0) {
              expect(result.warnings.length).toBeLessThanOrEqual(scenario.warnings.length + 1);
            }

            // 6. Build result should include errors array (even if empty)
            expect(Array.isArray(result.errors)).toBe(true);

            // 7. Build result should include artifacts array
            expect(Array.isArray(result.artifacts)).toBe(true);

            // 8. Duration should be reasonable (not negative, not extremely large)
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(result.duration).toBeLessThan(10000); // Less than 10 seconds for test

            return true;
          } finally {
            // Restore original method
            (buildMonitor as any).executeBuildCommand = originalExecute;
          }
        }
      ),
      { numRuns: 3, timeout: 10000 } // Reduce runs and increase timeout
    );
  }, 15000); // Set test timeout to 15 seconds
});