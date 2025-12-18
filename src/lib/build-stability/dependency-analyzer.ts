/**
 * Dependency analyzer implementation with circular dependency detection
 */

import { DependencyGraph, ModuleNode, DependencyEdge, CircularDependency, ModuleInfo, ImportInfo } from './types';
import { IDependencyAnalyzer } from './interfaces';
import * as fs from 'fs';
import * as path from 'path';

export class DependencyAnalyzer implements IDependencyAnalyzer {
  async analyzeDependencies(projectRoot: string): Promise<DependencyGraph> {
    const nodes: ModuleNode[] = [];
    const edges: DependencyEdge[] = [];
    const moduleMap = new Map<string, ModuleInfo>();

    // Get all source files
    const files = this.getSourceFiles(projectRoot);

    // Parse each file to extract module information
    for (const filePath of files) {
      try {
        const moduleInfo = await this.parseModule(filePath);
        moduleMap.set(filePath, moduleInfo);
        
        // Create module node
        const node: ModuleNode = {
          id: this.getModuleId(filePath, projectRoot),
          path: filePath,
          moduleInfo
        };
        nodes.push(node);
      } catch (error) {
        // Skip files that can't be parsed
        continue;
      }
    }

    // Build dependency edges
    for (const [filePath, moduleInfo] of moduleMap) {
      const fromId = this.getModuleId(filePath, projectRoot);
      
      for (const importInfo of moduleInfo.imports) {
        const resolvedPath = this.resolveModulePath(importInfo.source, filePath, projectRoot);
        if (resolvedPath && moduleMap.has(resolvedPath)) {
          const toId = this.getModuleId(resolvedPath, projectRoot);
          
          edges.push({
            from: fromId,
            to: toId,
            importType: importInfo.type
          });
        }
      }
    }

    // Detect circular dependencies
    const cycles = this.detectCircularDependencies(nodes, edges);

    return {
      nodes,
      edges,
      cycles
    };
  }

  private async parseModule(filePath: string): Promise<ModuleInfo> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const exports = [];
    const imports = [];
    let hasDefaultExport = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Parse export statements
      const exportMatch = this.parseExportStatement(line, lineNumber);
      if (exportMatch) {
        exports.push(exportMatch);
        if (exportMatch.type === 'default') {
          hasDefaultExport = true;
        }
      }

      // Parse import statements
      const importMatch = this.parseImportStatement(line, lineNumber);
      if (importMatch) {
        imports.push(importMatch);
      }
    }

    return {
      path: filePath,
      exports,
      imports,
      hasDefaultExport
    };
  }

  private parseExportStatement(line: string, lineNumber: number) {
    // Match default exports
    if (line.match(/^export\s+default\s+/)) {
      return {
        name: 'default',
        type: 'default' as const,
        line: lineNumber
      };
    }

    // Match named exports
    const namedExportMatch = line.match(/^export\s*\{\s*([^}]+)\s*\}/);
    if (namedExportMatch) {
      const names = namedExportMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      return {
        name: names[0],
        type: 'named' as const,
        line: lineNumber
      };
    }

    // Match direct named exports
    const directExportMatch = line.match(/^export\s+(const|let|var|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (directExportMatch) {
      return {
        name: directExportMatch[2],
        type: 'named' as const,
        line: lineNumber
      };
    }

    return null;
  }

  private parseImportStatement(line: string, lineNumber: number): ImportInfo | null {
    // Match import statements
    const importMatch = line.match(/^import\s+(.+?)\s+from\s+['"`]([^'"`]+)['"`]/);
    if (!importMatch) {
      return null;
    }

    const importClause = importMatch[1].trim();
    const source = importMatch[2];

    let type: 'default' | 'named' | 'namespace' = 'named';
    let imports: string[] = [];

    // Default import
    if (importClause.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
      type = 'default';
      imports = [importClause];
    }
    // Namespace import
    else if (importClause.match(/^\*\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
      type = 'namespace';
      imports = [importClause.replace(/^\*\s+as\s+/, '')];
    }
    // Named imports
    else if (importClause.match(/^\{.*\}$/)) {
      type = 'named';
      const namedImports = importClause.replace(/[{}]/g, '').split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      imports = namedImports;
    }

    return {
      source,
      imports,
      type,
      line: lineNumber
    };
  }

  private detectCircularDependencies(nodes: ModuleNode[], edges: DependencyEdge[]): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const adjacencyList = this.buildAdjacencyList(edges);

    // DFS to detect cycles
    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStartIndex = path.indexOf(neighbor);
          const cycle = [...path.slice(cycleStartIndex), neighbor];
          
          // Check if this cycle is already recorded
          const cycleKey = this.getCycleKey(cycle);
          const isDuplicate = cycles.some(c => this.getCycleKey(c.cycle) === cycleKey);
          
          if (!isDuplicate) {
            cycles.push({
              cycle,
              severity: 'error'
            });
          }
        }
      }

      recursionStack.delete(nodeId);
    };

    // Run DFS from each unvisited node
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  private buildAdjacencyList(edges: DependencyEdge[]): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();
    
    for (const edge of edges) {
      if (!adjacencyList.has(edge.from)) {
        adjacencyList.set(edge.from, []);
      }
      adjacencyList.get(edge.from)!.push(edge.to);
    }
    
    return adjacencyList;
  }

  private getCycleKey(cycle: string[]): string {
    // Normalize cycle to start with the smallest element
    const minIndex = cycle.indexOf(Math.min(...cycle.map(id => id)) as any);
    const normalized = [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
    return normalized.join('->');
  }

  private getModuleId(filePath: string, projectRoot: string): string {
    return path.relative(projectRoot, filePath).replace(/\\/g, '/');
  }

  private resolveModulePath(source: string, currentFile: string, projectRoot: string): string | null {
    if (!source.startsWith('.')) {
      return null; // External module
    }

    const currentDir = path.dirname(currentFile);
    const resolvedPath = path.resolve(currentDir, source);
    
    // Try different extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
    
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  private getSourceFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
          files.push(...this.getSourceFiles(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name) && !this.isTestFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      return [];
    }
    
    return files;
  }

  private isTestFile(fileName: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(fileName);
  }
}
