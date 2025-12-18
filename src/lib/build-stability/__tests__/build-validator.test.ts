import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BuildValidator } from '../build-validator'
import { ValidationResult } from '../types'

describe('Build Validator Property Tests', () => {
  // **Feature: build-stability, Property 2: Import/export consistency validation**
  // **Validates: Requirements 1.2, 3.1**
  it('Property 2: Import/export consistency validation', async () => {
    // Generator for valid TypeScript module content
    const moduleContentGen = fc.oneof(
      // Module with default export
      fc.record({
        exports: fc.constant(['export default function Component() { return null; }']),
        imports: fc.array(fc.constant('import React from "react";'), { maxLength: 3 }),
        hasDefault: fc.constant(true)
      }),
      // Module with named exports
      fc.record({
        exports: fc.array(
          fc.oneof(
            fc.constant('export const helper = () => {};'),
            fc.constant('export function utils() {}'),
            fc.constant('export class MyClass {}')
          ),
          { minLength: 1, maxLength: 5 }
        ),
        imports: fc.array(fc.constant('import { useState } from "react";'), { maxLength: 3 }),
        hasDefault: fc.constant(false)
      }),
      // Module with both default and named exports
      fc.record({
        exports: fc.array(
          fc.oneof(
            fc.constant('export default class Component {}'),
            fc.constant('export const helper = () => {};'),
            fc.constant('export function utils() {}')
          ),
          { minLength: 2, maxLength: 5 }
        ),
        imports: fc.array(
          fc.oneof(
            fc.constant('import React from "react";'),
            fc.constant('import { useState } from "react";')
          ),
          { maxLength: 3 }
        ),
        hasDefault: fc.constant(true)
      })
    )

    // Generator for project structure with consistent imports/exports
    const projectStructureGen = fc.record({
      moduleA: moduleContentGen,
      moduleB: moduleContentGen,
      moduleC: moduleContentGen
    }).map(modules => {
      // Create consistent import/export relationships
      const moduleAContent = [
        ...modules.moduleA.imports,
        ...modules.moduleA.exports
      ].join('\n')

      const moduleBContent = [
        ...modules.moduleB.imports,
        // Add import from moduleA if it has exports
        ...(modules.moduleA.exports.length > 0 ? ['import { helper } from "./moduleA";'] : []),
        ...modules.moduleB.exports
      ].join('\n')

      const moduleCContent = [
        ...modules.moduleC.imports,
        // Add import from moduleB if it has exports
        ...(modules.moduleB.exports.length > 0 ? ['import Component from "./moduleB";'] : []),
        ...modules.moduleC.exports
      ].join('\n')

      return {
        'moduleA.ts': moduleAContent,
        'moduleB.ts': moduleBContent,
        'moduleC.ts': moduleCContent
      }
    })

    const validator = new BuildValidator()

    await fc.assert(
      fc.asyncProperty(
        projectStructureGen,
        async (projectStructure) => {
          // Create temporary directory for test
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-validator-test-'))
          
          try {
            // Write test files
            for (const [filename, content] of Object.entries(projectStructure)) {
              fs.writeFileSync(path.join(tempDir, filename), content)
            }

            // Validate the project
            const result: ValidationResult = await validator.validateBuild(tempDir)

            // Property: For any source code modification, all imports should have corresponding exports
            
            // 1. Result should be a valid ValidationResult
            expect(result).toBeDefined()
            expect(typeof result.isValid).toBe('boolean')
            expect(Array.isArray(result.errors)).toBe(true)
            expect(Array.isArray(result.warnings)).toBe(true)
            expect(result.metrics).toBeDefined()

            // 2. If isValid is true, there should be no errors
            if (result.isValid) {
              expect(result.errors.length).toBe(0)
            }

            // 3. If there are errors, isValid should be false
            if (result.errors.length > 0) {
              expect(result.isValid).toBe(false)
            }

            // 4. All errors should have proper structure
            for (const error of result.errors) {
              expect(error.type).toMatch(/^(MISSING_EXPORT|CIRCULAR_DEPENDENCY|INVALID_IMPORT)$/)
              expect(error.file).toBeDefined()
              expect(error.line).toBeGreaterThan(0)
              expect(error.message).toBeDefined()
              expect(error.suggestion).toBeDefined()
            }

            // 5. Metrics should be consistent
            expect(result.metrics.totalFiles).toBeGreaterThanOrEqual(0)
            expect(result.metrics.validatedFiles).toBeGreaterThanOrEqual(0)
            expect(result.metrics.validatedFiles).toBeLessThanOrEqual(result.metrics.totalFiles)
            expect(result.metrics.totalImports).toBeGreaterThanOrEqual(0)
            expect(result.metrics.totalExports).toBeGreaterThanOrEqual(0)
            expect(result.metrics.validationTime).toBeGreaterThanOrEqual(0)

            return true
          } finally {
            // Cleanup
            try {
              fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
  // **Feature: build-stability, Property 3: Missing export error reporting**
  // **Validates: Requirements 1.3, 2.2**
  it('Property 3: Missing export error reporting', async () => {
    // Generator for modules with intentional missing exports
    const missingExportScenarioGen = fc.oneof(
      // Scenario 1: Import default from module without default export
      fc.constant({
        'moduleA.ts': 'export const helper = () => {};', // No default export
        'moduleB.ts': 'import Component from "./moduleA";' // Tries to import default
      }),
      // Scenario 2: Import named export that doesn't exist
      fc.constant({
        'moduleA.ts': 'export const helper = () => {};',
        'moduleB.ts': 'import { nonExistent } from "./moduleA";' // Tries to import non-existent named export
      }),
      // Scenario 3: Import multiple named exports, some missing
      fc.constant({
        'moduleA.ts': 'export const helper = () => {};\nexport const utils = () => {};',
        'moduleB.ts': 'import { helper, missing, utils } from "./moduleA";' // 'missing' doesn't exist
      }),
      // Scenario 4: Import from non-existent file
      fc.constant({
        'moduleA.ts': 'export const helper = () => {};',
        'moduleB.ts': 'import { something } from "./nonExistent";' // File doesn't exist
      })
    )

    const validator = new BuildValidator()

    await fc.assert(
      fc.asyncProperty(
        missingExportScenarioGen,
        async (scenario) => {
          // Create temporary directory for test
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-export-test-'))
          
          try {
            // Write test files
            for (const [filename, content] of Object.entries(scenario)) {
              fs.writeFileSync(path.join(tempDir, filename), content)
            }

            // Validate the project
            const result: ValidationResult = await validator.validateBuild(tempDir)

            // Property: For any import statement referencing a non-existent export, 
            // the build system should provide an error message containing the file path and the missing export name

            // 1. There should be validation errors for missing exports
            expect(result.isValid).toBe(false)
            expect(result.errors.length).toBeGreaterThan(0)

            // 2. At least one error should be about missing exports or invalid imports
            const hasRelevantError = result.errors.some(error => 
              error.type === 'MISSING_EXPORT' || error.type === 'INVALID_IMPORT'
            )
            expect(hasRelevantError).toBe(true)

            // 3. Each error should contain the problematic file path
            for (const error of result.errors) {
              expect(error.file).toBeDefined()
              expect(error.file.length).toBeGreaterThan(0)
              expect(path.isAbsolute(error.file) || error.file.includes('module')).toBe(true)
            }

            // 4. Each error should have a descriptive message
            for (const error of result.errors) {
              expect(error.message).toBeDefined()
              expect(error.message.length).toBeGreaterThan(0)
              // Message should contain information about what's missing
              const messageContainsRelevantInfo = 
                error.message.includes('export') || 
                error.message.includes('import') || 
                error.message.includes('resolve') ||
                error.message.includes('missing')
              expect(messageContainsRelevantInfo).toBe(true)
            }

            // 5. Each error should have a helpful suggestion
            for (const error of result.errors) {
              expect(error.suggestion).toBeDefined()
              expect(error.suggestion.length).toBeGreaterThan(0)
            }

            // 6. Line numbers should be valid (greater than 0)
            for (const error of result.errors) {
              expect(error.line).toBeGreaterThan(0)
            }

            return true
          } finally {
            // Cleanup
            try {
              fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
  // **Feature: build-stability, Property 10: Unused import warnings**
  // **Validates: Requirements 3.4**
  it('Property 10: Unused import warnings', async () => {
    // Generator for unused import scenarios
    const unusedImportScenarioGen = fc.oneof(
      // Scenario 1: Import but never use
      fc.constant({
        'moduleA.ts': 'export const helper = () => {};\nexport const utils = () => {};',
        'moduleB.ts': 'import { helper, utils } from "./moduleA";\n// helper and utils are imported but not used\nconst something = "test";'
      }),
      // Scenario 2: Import and use some, but not all
      fc.constant({
        'moduleA.ts': 'export const helper = () => {};\nexport const utils = () => {};\nexport const formatter = () => {};',
        'moduleB.ts': 'import { helper, utils, formatter } from "./moduleA";\nconst result = helper();\n// utils and formatter are unused'
      }),
      // Scenario 3: Import and use all (no warnings expected)
      fc.constant({
        'moduleA.ts': 'export const helper = () => {};\nexport const utils = () => {};',
        'moduleB.ts': 'import { helper, utils } from "./moduleA";\nconst result1 = helper();\nconst result2 = utils();'
      }),
      // Scenario 4: Default import unused
      fc.constant({
        'moduleA.ts': 'export default function Component() { return null; }',
        'moduleB.ts': 'import Component from "./moduleA";\n// Component is imported but not used\nconst something = "test";'
      })
    )

    const validator = new BuildValidator()

    await fc.assert(
      fc.asyncProperty(
        unusedImportScenarioGen,
        async (scenario) => {
          // Create temporary directory for test
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unused-import-test-'))
          
          try {
            // Write test files
            for (const [filename, content] of Object.entries(scenario)) {
              fs.writeFileSync(path.join(tempDir, filename), content)
            }

            // Validate the project
            const result: ValidationResult = await validator.validateBuild(tempDir)

            // Property: For any import statement that is not used in the module, 
            // the build system should generate a warning identifying the unused import

            // 1. Result should be a valid ValidationResult
            expect(result).toBeDefined()
            expect(Array.isArray(result.warnings)).toBe(true)

            // 2. All warnings should have proper structure
            for (const warning of result.warnings) {
              expect(['UNUSED_IMPORT', 'DEPRECATED_IMPORT', 'PERFORMANCE']).toContain(warning.type)
              expect(warning.file).toBeDefined()
              expect(warning.line).toBeGreaterThan(0)
              expect(warning.message).toBeDefined()
              expect(warning.message.length).toBeGreaterThan(0)
            }

            // 3. Check scenario-specific expectations
            const moduleB = scenario['moduleB.ts']
            
            // Scenario 1: Import but never use - should have warnings
            if (moduleB.includes('// helper and utils are imported but not used')) {
              const unusedWarnings = result.warnings.filter(w => w.type === 'UNUSED_IMPORT')
              expect(unusedWarnings.length).toBeGreaterThan(0)
              
              // Should warn about unused imports
              const hasHelperWarning = unusedWarnings.some(w => w.message.includes('helper'))
              const hasUtilsWarning = unusedWarnings.some(w => w.message.includes('utils'))
              expect(hasHelperWarning || hasUtilsWarning).toBe(true)
            }
            
            // Scenario 2: Use some imports - should warn about unused ones
            if (moduleB.includes('// utils and formatter are unused')) {
              const unusedWarnings = result.warnings.filter(w => w.type === 'UNUSED_IMPORT')
              expect(unusedWarnings.length).toBeGreaterThan(0)
              
              // Should NOT warn about helper (it's used)
              const hasHelperWarning = unusedWarnings.some(w => w.message.includes('helper'))
              expect(hasHelperWarning).toBe(false)
            }
            
            // Scenario 3: Use all imports - should have no unused import warnings
            if (moduleB.includes('const result1 = helper()') && moduleB.includes('const result2 = utils()')) {
              const unusedWarnings = result.warnings.filter(w => w.type === 'UNUSED_IMPORT')
              // Should have no warnings about helper or utils
              const hasHelperWarning = unusedWarnings.some(w => w.message.includes('helper'))
              const hasUtilsWarning = unusedWarnings.some(w => w.message.includes('utils'))
              expect(hasHelperWarning).toBe(false)
              expect(hasUtilsWarning).toBe(false)
            }
            
            // Scenario 4: Default import unused - should have warning
            if (moduleB.includes('// Component is imported but not used')) {
              const unusedWarnings = result.warnings.filter(w => w.type === 'UNUSED_IMPORT')
              expect(unusedWarnings.length).toBeGreaterThan(0)
              
              // Should warn about unused Component
              const hasComponentWarning = unusedWarnings.some(w => w.message.includes('Component'))
              expect(hasComponentWarning).toBe(true)
            }

            return true
          } finally {
            // Cleanup
            try {
              fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })