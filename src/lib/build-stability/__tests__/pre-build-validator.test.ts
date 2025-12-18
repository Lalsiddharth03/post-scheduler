import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { PreBuildValidator } from '../pre-build-validator'
import { ValidationResult } from '../types'

describe('Pre-Build Validator Property Tests', () => {
  // **Feature: build-stability, Property 4: Export changes validate dependents**
  // **Validates: Requirements 1.4, 3.2**
  it('Property 4: Export changes validate dependents', async () => {
    // Generator for export change scenarios
    const exportChangeScenarioGen = fc.oneof(
      // Scenario 1: Module with exports that other modules depend on
      fc.constant({
        'moduleA.ts': 'export const helper = () => "original";\nexport const utils = () => "utils";',
        'moduleB.ts': 'import { helper, utils } from "./moduleA";\nconst result = helper();',
        'moduleC.ts': 'import { helper } from "./moduleA";\nconst value = helper();'
      }),
      // Scenario 2: Module with default export that dependents use
      fc.constant({
        'moduleA.ts': 'export default function Component() { return "component"; }',
        'moduleB.ts': 'import Component from "./moduleA";\nconst comp = Component();',
        'moduleC.ts': 'import Comp from "./moduleA";\nconst instance = Comp();'
      }),
      // Scenario 3: Module with mixed exports
      fc.constant({
        'moduleA.ts': 'export default class MyClass {}\nexport const helper = () => {};\nexport function utils() {}',
        'moduleB.ts': 'import MyClass, { helper } from "./moduleA";\nconst instance = new MyClass();\nhelper();',
        'moduleC.ts': 'import { utils } from "./moduleA";\nutils();'
      }),
      // Scenario 4: Chain of dependencies
      fc.constant({
        'moduleA.ts': 'export const baseHelper = () => "base";',
        'moduleB.ts': 'import { baseHelper } from "./moduleA";\nexport const extendedHelper = () => baseHelper() + "extended";',
        'moduleC.ts': 'import { extendedHelper } from "./moduleB";\nconst result = extendedHelper();'
      })
    )

    const validator = new PreBuildValidator()

    await fc.assert(
      fc.asyncProperty(
        exportChangeScenarioGen,
        async (scenario) => {
          // Create temporary directory for test
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-change-test-'))
          
          try {
            // Write test files
            for (const [filename, content] of Object.entries(scenario)) {
              fs.writeFileSync(path.join(tempDir, filename), content)
            }

            // Run export change validation
            const result = await validator.validateExportChanges(tempDir)

            // Property: For any module where exports are modified or removed, 
            // the build system should validate all dependent imports and report any that become invalid

            // 1. Result should have proper structure
            expect(result).toBeDefined()
            expect(Array.isArray(result.changedModules)).toBe(true)
            expect(Array.isArray(result.affectedDependents)).toBe(true)
            expect(Array.isArray(result.validationErrors)).toBe(true)

            // 2. All validation errors should have proper structure
            for (const error of result.validationErrors) {
              expect(error.type).toMatch(/^(MISSING_EXPORT|CIRCULAR_DEPENDENCY|INVALID_IMPORT)$/)
              expect(error.file).toBeDefined()
              expect(error.line).toBeGreaterThan(0)
              expect(error.message).toBeDefined()
              expect(error.suggestion).toBeDefined()
            }

            // 3. Changed modules should be valid file paths
            for (const modulePath of result.changedModules) {
              expect(typeof modulePath).toBe('string')
              expect(modulePath.length).toBeGreaterThan(0)
            }

            // 4. Affected dependents should be valid identifiers
            for (const dependent of result.affectedDependents) {
              expect(typeof dependent).toBe('string')
              expect(dependent.length).toBeGreaterThan(0)
            }

            // 5. If there are changed modules, the validation should identify relationships
            if (result.changedModules.length > 0) {
              // Should either have affected dependents or validation errors explaining why not
              const hasRelationships = result.affectedDependents.length > 0 || 
                                     result.validationErrors.some(e => e.message.includes('export') || e.message.includes('import'))
              expect(hasRelationships).toBe(true)
            }

            // 6. Run full pre-build validation to ensure consistency
            const fullValidation = await validator.validatePreBuild({
              sourceDir: tempDir,
              checkExportChanges: true,
              validateNewModules: false
            })

            // Full validation should be consistent with export change validation
            expect(fullValidation).toBeDefined()
            expect(typeof fullValidation.isValid).toBe('boolean')
            expect(Array.isArray(fullValidation.errors)).toBe(true)

            // If export change validation found errors, full validation should too
            if (result.validationErrors.length > 0) {
              expect(fullValidation.errors.length).toBeGreaterThan(0)
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

  // **Feature: build-stability, Property 5: New module validation**
  // **Validates: Requirements 1.5**
  it('Property 5: New module validation', async () => {
    // Generator for new module scenarios
    const newModuleScenarioGen = fc.oneof(
      // Scenario 1: New module with proper exports
      fc.constant({
        'newModule.ts': 'export const helper = () => "helper";\nexport function utils() { return "utils"; }',
        'existingModule.ts': 'export const existing = () => "existing";'
      }),
      // Scenario 2: New module with default export
      fc.constant({
        'newModule.ts': 'export default function Component() { return "component"; }',
        'existingModule.ts': 'export const existing = () => "existing";'
      }),
      // Scenario 3: New module with both default and named exports
      fc.constant({
        'newModule.ts': 'export default class MyClass {}\nexport const helper = () => {};\nexport function utils() {}',
        'existingModule.ts': 'export const existing = () => "existing";'
      }),
      // Scenario 4: New module with valid imports from existing modules
      fc.constant({
        'existingModule.ts': 'export const existing = () => "existing";',
        'newModule.ts': 'import { existing } from "./existingModule";\nexport const newHelper = () => existing();'
      }),
      // Scenario 5: New module without exports (should be flagged)
      fc.constant({
        'newModule.ts': 'const helper = () => "helper";\nfunction utils() { return "utils"; }',
        'existingModule.ts': 'export const existing = () => "existing";'
      }),
      // Scenario 6: New module with invalid imports (should be flagged)
      fc.constant({
        'newModule.ts': 'import { nonExistent } from "./missingModule";\nexport const helper = () => nonExistent();',
        'existingModule.ts': 'export const existing = () => "existing";'
      })
    )

    const validator = new PreBuildValidator()

    await fc.assert(
      fc.asyncProperty(
        newModuleScenarioGen,
        async (scenario) => {
          // Create temporary directory for test
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'new-module-test-'))
          
          try {
            // Write test files
            for (const [filename, content] of Object.entries(scenario)) {
              const filePath = path.join(tempDir, filename)
              fs.writeFileSync(filePath, content)
              
              // Touch the file to make it "new" (within the last hour)
              const now = new Date()
              fs.utimesSync(filePath, now, now)
            }

            // Run new module validation
            const result = await validator.validateNewModules(tempDir)

            // Property: For any newly added module, the build system should validate 
            // that all declared exports are properly defined and all imports resolve correctly

            // 1. Result should have proper structure
            expect(result).toBeDefined()
            expect(Array.isArray(result.newModules)).toBe(true)
            expect(Array.isArray(result.validationErrors)).toBe(true)

            // 2. All validation errors should have proper structure
            for (const error of result.validationErrors) {
              expect(error.type).toMatch(/^(MISSING_EXPORT|CIRCULAR_DEPENDENCY|INVALID_IMPORT)$/)
              expect(error.file).toBeDefined()
              expect(error.line).toBeGreaterThan(0)
              expect(error.message).toBeDefined()
              expect(error.suggestion).toBeDefined()
            }

            // 3. New modules should be valid file paths
            for (const modulePath of result.newModules) {
              expect(typeof modulePath).toBe('string')
              expect(modulePath.length).toBeGreaterThan(0)
              expect(fs.existsSync(modulePath)).toBe(true)
            }

            // 4. Check scenario-specific expectations
            const hasNewModule = Object.keys(scenario).some(key => key === 'newModule.ts')
            
            if (hasNewModule) {
              const newModuleContent = scenario['newModule.ts']
              
              // Scenario 5: Module without exports should have validation error
              if (newModuleContent.includes('const helper = () => "helper"') && 
                  !newModuleContent.includes('export')) {
                const hasExportError = result.validationErrors.some(e => 
                  e.type === 'MISSING_EXPORT' && e.message.includes('does not have any exports')
                )
                expect(hasExportError).toBe(true)
              }
              
              // Scenario 6: Module with invalid imports should have validation error
              if (newModuleContent.includes('from "./missingModule"')) {
                const hasImportError = result.validationErrors.some(e => 
                  e.type === 'INVALID_IMPORT' && 
                  (e.message.includes('non-existent') || e.message.includes('missingModule'))
                )
                expect(hasImportError).toBe(true)
              }
              
              // Scenarios 1-4: Modules with proper exports should not have export errors
              if (newModuleContent.includes('export') && 
                  !newModuleContent.includes('from "./missingModule"')) {
                const hasExportError = result.validationErrors.some(e => 
                  e.type === 'MISSING_EXPORT' && e.message.includes('does not have any exports')
                )
                expect(hasExportError).toBe(false)
              }
            }

            // 5. Run full pre-build validation to ensure consistency
            const fullValidation = await validator.validatePreBuild({
              sourceDir: tempDir,
              checkExportChanges: false,
              validateNewModules: true
            })

            // Full validation should be consistent with new module validation
            expect(fullValidation).toBeDefined()
            expect(typeof fullValidation.isValid).toBe('boolean')
            expect(Array.isArray(fullValidation.errors)).toBe(true)

            // If new module validation found errors, full validation should too
            if (result.validationErrors.length > 0) {
              expect(fullValidation.errors.length).toBeGreaterThan(0)
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
})
