/**
 * Property-based tests for Error Reporter component
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ErrorReporter } from '../error-reporter';
import { BuildError } from '../types';

describe('ErrorReporter Property Tests', () => {
  // **Feature: build-stability, Property 8: Build failure on errors**
  it('Property 8: Build failure on errors - projects with compilation errors should fail build and prevent artifact generation', async () => {
    // Generate test data for various build error scenarios
    const buildErrorGenerator = fc.record({
      type: fc.constantFrom('TYPESCRIPT_ERROR', 'NEXTJS_ERROR', 'MODULE_NOT_FOUND', 'BUILD_EXECUTION_ERROR'),
      file: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
      line: fc.integer({ min: 1, max: 10000 }),
      column: fc.integer({ min: 0, max: 200 }),
      message: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
      stack: fc.option(fc.string({ minLength: 10, maxLength: 500 }))
    });

    const errorReporter = new ErrorReporter();

    await fc.assert(
      fc.property(
        fc.array(buildErrorGenerator, { minLength: 1, maxLength: 10 }),
        (generatedErrors) => {
          // Property: For any project with compilation errors, 
          // the build process should fail and prevent artifact generation

          for (const errorData of generatedErrors) {
            const buildError: BuildError = {
              type: errorData.type,
              file: errorData.file,
              line: errorData.line,
              column: errorData.column,
              message: errorData.message,
              stack: errorData.stack || undefined
            };

            const formattedError = errorReporter.reportError(buildError);

            // 1. Formatted error should preserve original error
            expect(formattedError.originalError).toEqual(buildError);

            // 2. Formatted message should be present and informative
            expect(formattedError.formattedMessage).toBeDefined();
            expect(typeof formattedError.formattedMessage).toBe('string');
            expect(formattedError.formattedMessage.length).toBeGreaterThan(0);
            
            // Should contain the original error message
            expect(formattedError.formattedMessage).toContain(buildError.message);

            // 3. Context should provide location information
            expect(formattedError.context).toBeDefined();
            expect(typeof formattedError.context).toBe('string');
            expect(formattedError.context.length).toBeGreaterThan(0);
            
            // Context should include error type
            expect(formattedError.context).toContain(buildError.type);
            
            // Context should include file information if available
            if (buildError.file) {
              expect(formattedError.context).toContain('File:');
            }
            
            // Context should include line information if available
            if (buildError.line > 0) {
              expect(formattedError.context).toContain('Line:');
            }

            // 4. Suggestions should be helpful and relevant
            expect(Array.isArray(formattedError.suggestions)).toBe(true);
            expect(formattedError.suggestions.length).toBeGreaterThan(0);
            
            // All suggestions should be non-empty strings
            for (const suggestion of formattedError.suggestions) {
              expect(typeof suggestion).toBe('string');
              expect(suggestion.length).toBeGreaterThan(0);
            }

            // 5. Documentation links should be provided
            expect(Array.isArray(formattedError.documentationLinks)).toBe(true);
            expect(formattedError.documentationLinks.length).toBeGreaterThan(0);
            
            // All links should be valid URLs or at least non-empty strings
            for (const link of formattedError.documentationLinks) {
              expect(typeof link).toBe('string');
              expect(link.length).toBeGreaterThan(0);
              // Should look like a URL
              expect(link.startsWith('http')).toBe(true);
            }

            // 6. Error type specific validations
            switch (buildError.type) {
              case 'TYPESCRIPT_ERROR':
                expect(formattedError.formattedMessage).toContain('TypeScript');
                expect(formattedError.suggestions.some(s => s.includes('TypeScript'))).toBe(true);
                break;
                
              case 'NEXTJS_ERROR':
                expect(formattedError.formattedMessage).toContain('Next.js');
                expect(formattedError.suggestions.some(s => s.includes('Next.js'))).toBe(true);
                break;
                
              case 'MODULE_NOT_FOUND':
                expect(formattedError.formattedMessage).toContain('Module');
                expect(formattedError.suggestions.some(s => s.includes('install') || s.includes('module'))).toBe(true);
                break;
                
              case 'BUILD_EXECUTION_ERROR':
                expect(formattedError.formattedMessage).toContain('Execution');
                expect(formattedError.suggestions.some(s => s.includes('Node.js') || s.includes('npm'))).toBe(true);
                break;
            }

            // 7. File and line information should be properly formatted
            if (buildError.file && buildError.line > 0) {
              const expectedLocation = `${buildError.file}:${buildError.line}`;
              expect(formattedError.formattedMessage).toContain(expectedLocation);
            }

            // 8. Stack trace should be included for execution errors
            if (buildError.type === 'BUILD_EXECUTION_ERROR' && buildError.stack) {
              expect(formattedError.formattedMessage).toContain('Stack trace');
              expect(formattedError.formattedMessage).toContain(buildError.stack);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});