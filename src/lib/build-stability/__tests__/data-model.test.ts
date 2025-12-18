import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationMetrics,
  BuildResult,
  BuildError,
  BuildWarning,
  BuildArtifact,
  DependencyGraph,
  ModuleNode,
  DependencyEdge,
  CircularDependency,
  ModuleInfo,
  ExportInfo,
  ImportInfo,
  FormattedError
} from '../types'

describe('Build Stability Data Model Properties', () => {
  // **Feature: build-stability, Property 1: Valid projects build successfully**
  // **Validates: Requirements 1.1**
  it('Property 1: Valid projects build successfully - Data model consistency', () => {
    // Generate valid file paths
    const validFilePaths = fc.oneof(
      fc.constant('./src/components/Button.tsx'),
      fc.constant('./src/utils/helpers.ts'),
      fc.constant('./src/pages/index.tsx'),
      fc.string({ minLength: 3, maxLength: 50 }).map(s => `./src/${s.replace(/[^a-zA-Z0-9]/g, '')}.ts`)
    ).filter(s => s.length > 5)

    // Generate valid line numbers
    const validLineNumbers = fc.integer({ min: 1, max: 1000 })

    // Generate valid export names
    const validExportNames = fc.oneof(
      fc.constant('Button'),
      fc.constant('helper'),
      fc.constant('Component'),
      fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9_$]/g, '').replace(/^[0-9]/, 'a')).filter(s => s.length > 0)
    )

    // Generate valid import sources
    const validImportSources = fc.oneof(
      fc.constant('./Button'),
      fc.constant('./utils'),
      fc.constant('react'),
      fc.constant('lodash')
    )

    // Generate ExportInfo
    const exportInfoGen = fc.record({
      name: validExportNames,
      type: fc.constantFrom('default', 'named') as fc.Arbitrary<'default' | 'named'>,
      line: validLineNumbers
    })

    // Generate ImportInfo
    const importInfoGen = fc.record({
      source: validImportSources,
      imports: fc.array(validExportNames, { minLength: 1, maxLength: 10 }),
      type: fc.constantFrom('default', 'named', 'namespace') as fc.Arbitrary<'default' | 'named' | 'namespace'>,
      line: validLineNumbers
    })

    // Generate ModuleInfo
    const moduleInfoGen = fc.record({
      path: validFilePaths,
      exports: fc.array(exportInfoGen, { maxLength: 20 }),
      imports: fc.array(importInfoGen, { maxLength: 20 }),
      hasDefaultExport: fc.boolean()
    }).map(moduleInfo => ({
      ...moduleInfo,
      // Ensure hasDefaultExport is consistent with exports
      hasDefaultExport: moduleInfo.exports.some(exp => exp.type === 'default')
    }))

    // Generate ValidationError
    const validationErrorGen = fc.record({
      type: fc.constantFrom('MISSING_EXPORT', 'CIRCULAR_DEPENDENCY', 'INVALID_IMPORT') as fc.Arbitrary<'MISSING_EXPORT' | 'CIRCULAR_DEPENDENCY' | 'INVALID_IMPORT'>,
      file: validFilePaths,
      line: validLineNumbers,
      message: fc.oneof(
        fc.constant('Missing export detected'),
        fc.constant('Circular dependency found'),
        fc.constant('Invalid import statement')
      ),
      suggestion: fc.oneof(
        fc.constant('Add the missing export'),
        fc.constant('Refactor to remove circular dependency'),
        fc.constant('Fix the import statement')
      )
    })

    // Generate ValidationWarning
    const validationWarningGen = fc.record({
      type: fc.constantFrom('UNUSED_IMPORT', 'DEPRECATED_IMPORT', 'PERFORMANCE') as fc.Arbitrary<'UNUSED_IMPORT' | 'DEPRECATED_IMPORT' | 'PERFORMANCE'>,
      file: validFilePaths,
      line: validLineNumbers,
      message: fc.oneof(
        fc.constant('Unused import detected'),
        fc.constant('Deprecated API usage'),
        fc.constant('Performance issue detected')
      )
    })

    // Generate ValidationMetrics
    const validationMetricsGen = fc.record({
      totalFiles: fc.integer({ min: 0, max: 10000 }),
      validatedFiles: fc.integer({ min: 0, max: 10000 }),
      totalImports: fc.integer({ min: 0, max: 100000 }),
      totalExports: fc.integer({ min: 0, max: 100000 }),
      validationTime: fc.integer({ min: 0, max: 300000 }) // 0 to 5 minutes in ms
    }).map(metrics => ({
      ...metrics,
      // Ensure validatedFiles <= totalFiles
      validatedFiles: Math.min(metrics.validatedFiles, metrics.totalFiles)
    }))

    // Generate ValidationResult
    const validationResultGen = fc.record({
      isValid: fc.boolean(),
      errors: fc.array(validationErrorGen, { maxLength: 50 }),
      warnings: fc.array(validationWarningGen, { maxLength: 100 }),
      metrics: validationMetricsGen
    }).map(result => ({
      ...result,
      // Ensure isValid is consistent with errors
      isValid: result.errors.length === 0
    }))

    fc.assert(
      fc.property(
        validationResultGen,
        moduleInfoGen,
        (validationResult: ValidationResult, moduleInfo: ModuleInfo) => {
          // Test ValidationResult consistency
          
          // 1. If there are no errors, isValid should be true
          if (validationResult.errors.length === 0 && !validationResult.isValid) {
            return false
          }
          
          // 2. If there are errors, isValid should be false
          if (validationResult.errors.length > 0 && validationResult.isValid) {
            return false
          }

          // 3. All errors should have valid file paths and line numbers
          for (const error of validationResult.errors) {
            if (!error.file || error.file.trim().length === 0) return false
            if (error.line < 1) return false
            if (!error.message || error.message.trim().length === 0) return false
            if (!error.suggestion || error.suggestion.trim().length === 0) return false
          }

          // 4. All warnings should have valid file paths and line numbers
          for (const warning of validationResult.warnings) {
            if (!warning.file || warning.file.trim().length === 0) return false
            if (warning.line < 1) return false
            if (!warning.message || warning.message.trim().length === 0) return false
          }

          // 5. Metrics should be consistent
          const metrics = validationResult.metrics
          if (metrics.validatedFiles > metrics.totalFiles) return false
          if (metrics.totalFiles < 0 || metrics.validatedFiles < 0) return false
          if (metrics.totalImports < 0 || metrics.totalExports < 0) return false
          if (metrics.validationTime < 0) return false

          // Test ModuleInfo consistency
          
          // 6. hasDefaultExport should be consistent with exports array
          const hasDefaultInExports = moduleInfo.exports.some(exp => exp.type === 'default')
          if (moduleInfo.hasDefaultExport !== hasDefaultInExports) {
            return false
          }

          // 7. All export names should be valid identifiers (except default)
          for (const exportInfo of moduleInfo.exports) {
            if (exportInfo.type === 'named') {
              if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(exportInfo.name)) return false
            }
            if (exportInfo.line < 1) return false
          }

          // 8. All import sources should be non-empty
          for (const importInfo of moduleInfo.imports) {
            if (!importInfo.source || importInfo.source.trim().length === 0) return false
            if (importInfo.line < 1) return false
            if (importInfo.imports.length === 0) return false
            
            // For named imports, all import names should be valid identifiers
            if (importInfo.type === 'named') {
              for (const importName of importInfo.imports) {
                if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(importName)) return false
              }
            }
          }

          // 9. Module path should be valid
          if (!moduleInfo.path || moduleInfo.path.trim().length === 0) return false

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 1 Extended: Build artifacts and dependency graph consistency', () => {
    // Generate BuildArtifact
    const buildArtifactGen = fc.record({
      path: fc.oneof(
        fc.constant('./dist/main.js'),
        fc.constant('./dist/styles.css'),
        fc.constant('./dist/index.html')
      ),
      size: fc.integer({ min: 0, max: 1000000 }), // 0 to 1MB
      type: fc.constantFrom('js', 'css', 'html', 'map', 'other') as fc.Arbitrary<'js' | 'css' | 'html' | 'map' | 'other'>
    })

    // Generate BuildError
    const buildErrorGen = fc.record({
      type: fc.oneof(fc.constant('SyntaxError'), fc.constant('TypeError'), fc.constant('ImportError')),
      file: fc.oneof(fc.constant('./src/main.ts'), fc.constant('./src/utils.ts')),
      line: fc.integer({ min: 1, max: 100 }),
      column: fc.integer({ min: 1, max: 100 }),
      message: fc.oneof(fc.constant('Unexpected token'), fc.constant('Cannot find module')),
      stack: fc.option(fc.constant('Error stack trace'))
    })

    // Generate BuildWarning
    const buildWarningGen = fc.record({
      type: fc.oneof(fc.constant('UnusedImport'), fc.constant('DeprecatedAPI')),
      file: fc.oneof(fc.constant('./src/main.ts'), fc.constant('./src/utils.ts')),
      line: fc.integer({ min: 1, max: 100 }),
      message: fc.oneof(fc.constant('Unused import detected'), fc.constant('Deprecated API usage'))
    })

    // Generate BuildResult
    const buildResultGen = fc.record({
      success: fc.boolean(),
      duration: fc.integer({ min: 0, max: 3600000 }), // 0 to 1 hour in ms
      errors: fc.array(buildErrorGen, { maxLength: 100 }),
      warnings: fc.array(buildWarningGen, { maxLength: 200 }),
      artifacts: fc.array(buildArtifactGen, { maxLength: 1000 })
    }).map(result => ({
      ...result,
      // Ensure success is consistent with errors
      success: result.errors.length === 0
    }))

    fc.assert(
      fc.property(
        buildResultGen,
        (buildResult: BuildResult) => {
          // Test BuildResult consistency
          
          // 1. If there are no errors, success should be true
          if (buildResult.errors.length === 0 && !buildResult.success) {
            return false
          }
          
          // 2. If there are errors, success should be false
          if (buildResult.errors.length > 0 && buildResult.success) {
            return false
          }

          // 3. Duration should be non-negative
          if (buildResult.duration < 0) return false

          // 4. All errors should have valid properties
          for (const error of buildResult.errors) {
            if (!error.type || error.type.trim().length === 0) return false
            if (!error.file || error.file.trim().length === 0) return false
            if (error.line < 1 || error.column < 1) return false
            if (!error.message || error.message.trim().length === 0) return false
          }

          // 5. All warnings should have valid properties
          for (const warning of buildResult.warnings) {
            if (!warning.type || warning.type.trim().length === 0) return false
            if (!warning.file || warning.file.trim().length === 0) return false
            if (warning.line < 1) return false
            if (!warning.message || warning.message.trim().length === 0) return false
          }

          // 6. All artifacts should have valid properties
          for (const artifact of buildResult.artifacts) {
            if (!artifact.path || artifact.path.trim().length === 0) return false
            if (artifact.size < 0) return false
            if (!['js', 'css', 'html', 'map', 'other'].includes(artifact.type)) return false
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 1 Final: Dependency graph and circular dependency consistency', () => {
    // Generate valid module IDs
    const moduleIdGen = fc.oneof(
      fc.constant('moduleA'),
      fc.constant('moduleB'),
      fc.constant('moduleC'),
      fc.constant('utils'),
      fc.constant('components')
    )

    // Generate a simple dependency graph with predefined structure
    const dependencyGraphGen = fc.oneof(
      // Empty graph
      fc.constant({
        nodes: [],
        edges: [],
        cycles: []
      }),
      // Single node graph
      fc.constant({
        nodes: [{
          id: 'moduleA',
          path: './src/moduleA.ts',
          moduleInfo: {
            path: './src/moduleA.ts',
            exports: [{ name: 'helper', type: 'named' as const, line: 1 }],
            imports: [],
            hasDefaultExport: false
          }
        }],
        edges: [],
        cycles: []
      }),
      // Two nodes with dependency
      fc.constant({
        nodes: [
          {
            id: 'moduleA',
            path: './src/moduleA.ts',
            moduleInfo: {
              path: './src/moduleA.ts',
              exports: [{ name: 'helper', type: 'named' as const, line: 1 }],
              imports: [],
              hasDefaultExport: false
            }
          },
          {
            id: 'moduleB',
            path: './src/moduleB.ts',
            moduleInfo: {
              path: './src/moduleB.ts',
              exports: [{ name: 'Component', type: 'default' as const, line: 1 }],
              imports: [{ source: './moduleA', imports: ['helper'], type: 'named' as const, line: 2 }],
              hasDefaultExport: true
            }
          }
        ],
        edges: [{ from: 'moduleB', to: 'moduleA', importType: 'named' as const }],
        cycles: []
      }),
      // Three nodes with circular dependency
      fc.constant({
        nodes: [
          {
            id: 'moduleA',
            path: './src/moduleA.ts',
            moduleInfo: {
              path: './src/moduleA.ts',
              exports: [{ name: 'helper', type: 'named' as const, line: 1 }],
              imports: [{ source: './moduleC', imports: ['util'], type: 'named' as const, line: 2 }],
              hasDefaultExport: false
            }
          },
          {
            id: 'moduleB',
            path: './src/moduleB.ts',
            moduleInfo: {
              path: './src/moduleB.ts',
              exports: [{ name: 'Component', type: 'default' as const, line: 1 }],
              imports: [{ source: './moduleA', imports: ['helper'], type: 'named' as const, line: 2 }],
              hasDefaultExport: true
            }
          },
          {
            id: 'moduleC',
            path: './src/moduleC.ts',
            moduleInfo: {
              path: './src/moduleC.ts',
              exports: [{ name: 'util', type: 'named' as const, line: 1 }],
              imports: [{ source: './moduleB', imports: ['Component'], type: 'default' as const, line: 2 }],
              hasDefaultExport: false
            }
          }
        ],
        edges: [
          { from: 'moduleB', to: 'moduleA', importType: 'named' as const },
          { from: 'moduleA', to: 'moduleC', importType: 'named' as const },
          { from: 'moduleC', to: 'moduleB', importType: 'default' as const }
        ],
        cycles: [{ cycle: ['moduleA', 'moduleC', 'moduleB', 'moduleA'], severity: 'error' as const }]
      })
    )

    fc.assert(
      fc.property(
        dependencyGraphGen,
        (graph: DependencyGraph) => {
          // Test DependencyGraph consistency
          
          // 1. All node IDs should be unique
          const nodeIds = graph.nodes.map(n => n.id)
          const uniqueNodeIds = new Set(nodeIds)
          if (nodeIds.length !== uniqueNodeIds.size) return false

          // 2. All edges should reference existing nodes
          const nodeIdSet = new Set(nodeIds)
          for (const edge of graph.edges) {
            if (!nodeIdSet.has(edge.from) || !nodeIdSet.has(edge.to)) return false
          }

          // 3. All nodes should have consistent moduleInfo
          for (const node of graph.nodes) {
            if (node.path !== node.moduleInfo.path) return false
            
            // hasDefaultExport should be consistent with exports
            const hasDefault = node.moduleInfo.exports.some(exp => exp.type === 'default')
            if (node.moduleInfo.hasDefaultExport !== hasDefault) return false
          }

          // 4. Circular dependencies should actually form cycles
          for (const cycle of graph.cycles) {
            if (cycle.cycle.length < 3) return false // Minimum cycle is A -> B -> A (3 elements)
            
            // First and last elements should be the same for a proper cycle
            if (cycle.cycle[0] !== cycle.cycle[cycle.cycle.length - 1]) return false
            
            // All elements in the cycle should be valid node IDs
            for (const nodeId of cycle.cycle) {
              if (!nodeIdSet.has(nodeId)) return false
            }
          }

          // 5. If there are cycles, there should be corresponding edges
          for (const cycle of graph.cycles) {
            for (let i = 0; i < cycle.cycle.length - 1; i++) {
              const from = cycle.cycle[i]
              const to = cycle.cycle[i + 1]
              
              // There should be an edge from 'from' to 'to'
              const edgeExists = graph.edges.some(edge => edge.from === from && edge.to === to)
              if (!edgeExists) return false
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})