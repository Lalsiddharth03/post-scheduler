import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { DependencyAnalyzer } from '../dependency-analyzer'
import { DependencyGraph } from '../types'

describe('Dependency Analyzer Property Tests', () => {
  // **Feature: build-stability, Property 9: Circular dependency detection**
  // **Validates: Requirements 3.3**
  it('Property 9: Circular dependency detection', async () => {
    // Generator for circular dependency scenarios
    const circularDependencyScenarioGen = fc.oneof(
      // Scenario 1: Simple A -> B -> A cycle
      fc.constant({
        'moduleA.ts': 'import { helperB } from "./moduleB";\nexport const helperA = () => {};',
        'moduleB.ts': 'import { helperA } from "./moduleA";\nexport const helperB = () => {};'
      }),
      // Scenario 2: Three-way cycle A -> B -> C -> A
      fc.constant({
        'moduleA.ts': 'import { helperB } from "./moduleB";\nexport const helperA = () => {};',
        'moduleB.ts': 'import { helperC } from "./moduleC";\nexport const helperB = () => {};',
        'moduleC.ts': 'import { helperA } from "./moduleA";\nexport const helperC = () => {};'
      }),
      // Scenario 3: No circular dependencies
      fc.constant({
        'moduleA.ts': 'export const helperA = () => {};',
        'moduleB.ts': 'import { helperA } from "./moduleA";\nexport const helperB = () => {};',
        'moduleC.ts': 'import { helperB } from "./moduleB";\nexport const helperC = () => {};'
      }),
      // Scenario 4: Complex cycle with multiple paths
      fc.constant({
        'moduleA.ts': 'import { helperB } from "./moduleB";\nimport { helperD } from "./moduleD";\nexport const helperA = () => {};',
        'moduleB.ts': 'import { helperC } from "./moduleC";\nexport const helperB = () => {};',
        'moduleC.ts': 'import { helperA } from "./moduleA";\nexport const helperC = () => {};',
        'moduleD.ts': 'export const helperD = () => {};'
      })
    )

    const analyzer = new DependencyAnalyzer()

    await fc.assert(
      fc.asyncProperty(
        circularDependencyScenarioGen,
        async (scenario) => {
          // Create temporary directory for test
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-analyzer-test-'))
          
          try {
            // Write test files
            for (const [filename, content] of Object.entries(scenario)) {
              fs.writeFileSync(path.join(tempDir, filename), content)
            }

            // Analyze dependencies
            const result: DependencyGraph = await analyzer.analyzeDependencies(tempDir)

            // Property: For any set of modules with circular dependencies, 
            // the build system should detect the cycle and report the complete dependency chain

            // 1. Result should be a valid DependencyGraph
            expect(result).toBeDefined()
            expect(Array.isArray(result.nodes)).toBe(true)
            expect(Array.isArray(result.edges)).toBe(true)
            expect(Array.isArray(result.cycles)).toBe(true)

            // 2. All node IDs should be unique
            const nodeIds = result.nodes.map(n => n.id)
            const uniqueNodeIds = new Set(nodeIds)
            expect(nodeIds.length).toBe(uniqueNodeIds.size)

            // 3. All edges should reference existing nodes
            const nodeIdSet = new Set(nodeIds)
            for (const edge of result.edges) {
              expect(nodeIdSet.has(edge.from)).toBe(true)
              expect(nodeIdSet.has(edge.to)).toBe(true)
            }

            // 4. Each node should have consistent moduleInfo
            for (const node of result.nodes) {
              expect(node.path).toBeDefined()
              expect(node.moduleInfo).toBeDefined()
              expect(node.moduleInfo.path).toBe(node.path)
              
              // hasDefaultExport should be consistent with exports
              const hasDefault = node.moduleInfo.exports.some(exp => exp.type === 'default')
              expect(node.moduleInfo.hasDefaultExport).toBe(hasDefault)
            }

            // 5. Validate circular dependency detection logic
            for (const cycle of result.cycles) {
              // Each cycle should have at least 3 elements (A -> B -> A minimum)
              expect(cycle.cycle.length).toBeGreaterThanOrEqual(3)
              
              // First and last elements should be the same for a proper cycle
              expect(cycle.cycle[0]).toBe(cycle.cycle[cycle.cycle.length - 1])
              
              // All elements in the cycle should be valid node IDs
              for (const nodeId of cycle.cycle) {
                expect(nodeIdSet.has(nodeId)).toBe(true)
              }
              
              // Severity should be valid
              expect(['error', 'warning']).toContain(cycle.severity)
            }

            // 6. If cycles are detected, verify they correspond to actual edges
            for (const cycle of result.cycles) {
              for (let i = 0; i < cycle.cycle.length - 1; i++) {
                const from = cycle.cycle[i]
                const to = cycle.cycle[i + 1]
                
                // There should be an edge from 'from' to 'to'
                const edgeExists = result.edges.some(edge => edge.from === from && edge.to === to)
                expect(edgeExists).toBe(true)
              }
            }

            // 7. Check scenario-specific expectations
            const fileNames = Object.keys(scenario)
            
            // If we have the simple A->B->A scenario
            if (fileNames.includes('moduleA.ts') && fileNames.includes('moduleB.ts') && fileNames.length === 2) {
              const moduleAContent = scenario['moduleA.ts']
              const moduleBContent = scenario['moduleB.ts']
              
              // If both modules import from each other, there should be a cycle
              if (moduleAContent.includes('./moduleB') && moduleBContent.includes('./moduleA')) {
                expect(result.cycles.length).toBeGreaterThan(0)
              }
            }
            
            // If we have the three-way cycle scenario
            if (fileNames.includes('moduleA.ts') && fileNames.includes('moduleB.ts') && fileNames.includes('moduleC.ts') && fileNames.length === 3) {
              const moduleAContent = scenario['moduleA.ts']
              const moduleBContent = scenario['moduleB.ts']
              const moduleCContent = scenario['moduleC.ts']
              
              // Check if it's the circular case (A->B->C->A)
              if (moduleAContent.includes('./moduleB') && moduleBContent.includes('./moduleC') && moduleCContent.includes('./moduleA')) {
                expect(result.cycles.length).toBeGreaterThan(0)
              }
              // Check if it's the linear case (A<-B<-C)
              else if (moduleBContent.includes('./moduleA') && moduleCContent.includes('./moduleB') && !moduleAContent.includes('./')) {
                expect(result.cycles.length).toBe(0)
              }
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