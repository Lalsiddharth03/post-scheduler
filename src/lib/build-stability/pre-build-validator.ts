/**
 * Pre-build validation workflow that runs before Next.js build
 */

import { ValidationResult, ValidationError, ValidationWarning, ValidationMetrics, ModuleInfo } from './types';
import { 
  IPreBuildValidator, 
  PreBuildValidationOptions, 
  ExportChangeValidationResult, 
  NewModuleValidationResult 
} from './interfaces';
import { BuildValidator } from './build-validator';
import { DependencyAnalyzer } from './dependency-analyzer';
import * as fs from 'fs';
import * as path from 'path';

export class PreBuildValidator implements IPreBuildValidator {
  private buildValidator: BuildValidator;
  private dependencyAnalyzer: DependencyAnalyzer;

  constructor() {
    this.buildValidator = new BuildValidator();
    this.dependencyAnalyzer = new DependencyAnalyzer();
  }

  /**
   * Run complete pre-build validation workflow
   */
  async validatePreBuild(options: PreBuildValidationOptions): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const metrics: ValidationMetrics = {
      totalFiles: 0,
      validatedFiles: 0,
      totalImports: 0,
      totalExports: 0,
      validationTime: 0
    };

    try {
      // 1. Run basic build validation
      const buildValidation = await this.buildValidator.validateBuild(options.sourceDir);
      errors.push(...buildValidation.errors);
      warnings.push(...buildValidation.warnings);
      
      // Merge metrics
      metrics.totalFiles = buildValidation.metrics.totalFiles;
      metrics.validatedFiles = buildValidation.metrics.validatedFiles;
      metrics.totalImports = buildValidation.metrics.totalImports;
      metrics.totalExports = buildValidation.metrics.totalExports;

      // 2. Validate export changes if requested
      if (options.checkExportChanges) {
        const exportChangeValidation = await this.validateExportChanges(options.sourceDir);
        errors.push(...exportChangeValidation.validationErrors);
      }

      // 3. Validate new modules if requested
      if (options.validateNewModules) {
        const newModuleValidation = await this.validateNewModules(options.sourceDir);
        errors.push(...newModuleValidation.validationErrors);
      }

      // 4. Run dependency analysis
      const dependencyGraph = await this.dependencyAnalyzer.analyzeDependencies(options.sourceDir);
      
      // Add circular dependency errors
      for (const cycle of dependencyGraph.cycles) {
        if (cycle.severity === 'error') {
          errors.push({
            type: 'CIRCULAR_DEPENDENCY',
            file: cycle.cycle[0],
            line: 1,
            message: `Circular dependency detected: ${cycle.cycle.join(' -> ')}`,
            suggestion: 'Refactor modules to remove circular dependencies'
          });
        }
      }

      const isValid = errors.length === 0;

      return {
        isValid,
        errors,
        warnings,
        metrics: {
          ...metrics,
          validationTime: Date.now() - startTime
        }
      };
    } catch (error) {
      errors.push({
        type: 'INVALID_IMPORT',
        file: options.sourceDir,
        line: 0,
        message: `Pre-build validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check the source directory and file permissions'
      });

      return {
        isValid: false,
        errors,
        warnings,
        metrics: {
          ...metrics,
          validationTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Validate export changes and their impact on dependent modules
   */
  async validateExportChanges(sourceDir: string): Promise<ExportChangeValidationResult> {
    const errors: ValidationError[] = [];
    const changedModules: string[] = [];
    const affectedDependents: string[] = [];

    try {
      // Get dependency graph to understand module relationships
      const dependencyGraph = await this.dependencyAnalyzer.analyzeDependencies(sourceDir);
      
      // For each module, check if its exports are properly defined
      for (const node of dependencyGraph.nodes) {
        const moduleInfo = node.moduleInfo;
        
        // Check if module has exports but they're not properly defined
        if (moduleInfo.exports.length === 0 && this.hasExportStatements(moduleInfo.path)) {
          errors.push({
            type: 'MISSING_EXPORT',
            file: moduleInfo.path,
            line: 1,
            message: 'Module appears to have export statements but no exports were detected',
            suggestion: 'Check export syntax and ensure exports are properly formatted'
          });
          changedModules.push(moduleInfo.path);
        }

        // Find all modules that depend on this one
        const dependents = dependencyGraph.edges
          .filter(edge => edge.to === node.id)
          .map(edge => edge.from);

        if (dependents.length > 0 && changedModules.includes(moduleInfo.path)) {
          affectedDependents.push(...dependents);
        }
      }

      // Validate that all dependent imports are still valid
      for (const dependentId of affectedDependents) {
        const dependentNode = dependencyGraph.nodes.find(n => n.id === dependentId);
        if (dependentNode) {
          const validation = await this.buildValidator.validateBuild(path.dirname(dependentNode.path));
          errors.push(...validation.errors.filter(e => e.file === dependentNode.path));
        }
      }

      return {
        changedModules: [...new Set(changedModules)],
        affectedDependents: [...new Set(affectedDependents)],
        validationErrors: errors
      };
    } catch (error) {
      errors.push({
        type: 'INVALID_IMPORT',
        file: sourceDir,
        line: 0,
        message: `Export change validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check module structure and export definitions'
      });

      return {
        changedModules,
        affectedDependents,
        validationErrors: errors
      };
    }
  }

  /**
   * Validate new modules for proper export definitions
   */
  async validateNewModules(sourceDir: string): Promise<NewModuleValidationResult> {
    const errors: ValidationError[] = [];
    const newModules: string[] = [];

    try {
      // Get all source files
      const files = this.getSourceFiles(sourceDir);
      
      for (const filePath of files) {
        // Check if this is a "new" module (for demo purposes, we'll check if it has proper exports)
        const moduleInfo = await this.parseModule(filePath);
        
        // Validate that new modules have proper export definitions
        if (this.isNewModule(filePath)) {
          newModules.push(filePath);
          
          // Check if module has any exports
          if (moduleInfo.exports.length === 0) {
            errors.push({
              type: 'MISSING_EXPORT',
              file: filePath,
              line: 1,
              message: 'New module does not have any exports defined',
              suggestion: 'Add at least one export (default or named) to make the module usable'
            });
          }

          // Check if all imports in the new module are valid
          for (const importInfo of moduleInfo.imports) {
            if (importInfo.source.startsWith('.')) {
              const resolvedPath = this.resolveModulePath(importInfo.source, filePath, sourceDir);
              if (!resolvedPath || !fs.existsSync(resolvedPath)) {
                errors.push({
                  type: 'INVALID_IMPORT',
                  file: filePath,
                  line: importInfo.line,
                  message: `New module imports from non-existent module: ${importInfo.source}`,
                  suggestion: 'Check the import path and ensure the target module exists'
                });
              }
            }
          }
        }
      }

      return {
        newModules,
        validationErrors: errors
      };
    } catch (error) {
      errors.push({
        type: 'INVALID_IMPORT',
        file: sourceDir,
        line: 0,
        message: `New module validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check module structure and import/export definitions'
      });

      return {
        newModules,
        validationErrors: errors
      };
    }
  }

  private hasExportStatements(filePath: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return /^export\s+/m.test(content);
    } catch {
      return false;
    }
  }

  private isNewModule(filePath: string): boolean {
    // For demo purposes, consider a module "new" if it was recently created
    // In a real implementation, this would check against git history or a baseline
    try {
      const stats = fs.statSync(filePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      const oneHour = 60 * 60 * 1000;
      
      return fileAge < oneHour; // Consider files modified in the last hour as "new"
    } catch {
      return false;
    }
  }

  private async parseModule(filePath: string): Promise<ModuleInfo> {
    // Reuse the parsing logic from BuildValidator
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const exports: any[] = [];
    const imports: any[] = [];
    let hasDefaultExport = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Parse export statements (simplified)
      if (line.match(/^export\s+default\s+/)) {
        exports.push({ name: 'default', type: 'default', line: lineNumber });
        hasDefaultExport = true;
      } else if (line.match(/^export\s+(const|let|var|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/)) {
        const match = line.match(/^export\s+(const|let|var|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (match) {
          exports.push({ name: match[2], type: 'named', line: lineNumber });
        }
      }

      // Parse import statements (simplified)
      const importMatch = line.match(/^import\s+(.+?)\s+from\s+['"`]([^'"`]+)['"`]/);
      if (importMatch) {
        const importClause = importMatch[1].trim();
        const source = importMatch[2];
        
        let type: 'default' | 'named' | 'namespace' = 'named';
        let importNames: string[] = [];

        if (importClause.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
          type = 'default';
          importNames = [importClause];
        } else if (importClause.match(/^\*\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
          type = 'namespace';
          importNames = [importClause.replace(/^\*\s+as\s+/, '')];
        } else if (importClause.match(/^\{.*\}$/)) {
          type = 'named';
          importNames = importClause.replace(/[{}]/g, '').split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
        }

        imports.push({
          source,
          imports: importNames,
          type,
          line: lineNumber
        });
      }
    }

    return {
      path: filePath,
      exports,
      imports,
      hasDefaultExport
    };
  }

  private resolveModulePath(source: string, currentFile: string, sourceDir: string): string | null {
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