/**
 * Build validator implementation with module structure analysis
 */

import { ValidationResult, ValidationError, ValidationWarning, ValidationMetrics, ModuleInfo, ExportInfo, ImportInfo } from './types';
import { IBuildValidator } from './interfaces';
import * as fs from 'fs';
import * as path from 'path';

export class BuildValidator implements IBuildValidator {
  async validateBuild(sourceDir: string): Promise<ValidationResult> {
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
      // Check if source directory exists
      if (!fs.existsSync(sourceDir)) {
        errors.push({
          type: 'INVALID_IMPORT',
          file: sourceDir,
          line: 0,
          message: `Source directory does not exist: ${sourceDir}`,
          suggestion: 'Ensure the source directory path is correct'
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

      // Get all TypeScript/JavaScript files
      const files = this.getSourceFiles(sourceDir);
      metrics.totalFiles = files.length;

      // Parse each file and validate imports/exports
      const moduleMap = new Map<string, ModuleInfo>();
      
      for (const filePath of files) {
        try {
          const moduleInfo = await this.parseModule(filePath);
          moduleMap.set(filePath, moduleInfo);
          metrics.totalImports += moduleInfo.imports.length;
          metrics.totalExports += moduleInfo.exports.length;
          metrics.validatedFiles++;
        } catch (error) {
          errors.push({
            type: 'INVALID_IMPORT',
            file: filePath,
            line: 0,
            message: `Failed to parse module: ${error instanceof Error ? error.message : 'Unknown error'}`,
            suggestion: 'Check file syntax and encoding'
          });
        }
      }

      // Validate import/export consistency
      this.validateImportExportConsistency(moduleMap, sourceDir, errors);

      // Detect unused imports
      this.detectUnusedImports(moduleMap, warnings);

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
        file: sourceDir,
        line: 0,
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  private async parseModule(filePath: string): Promise<ModuleInfo> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const exports: ExportInfo[] = [];
    const imports: ImportInfo[] = [];
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

  private parseExportStatement(line: string, lineNumber: number): ExportInfo | null {
    // Match default exports: export default ...
    if (line.match(/^export\s+default\s+/)) {
      return {
        name: 'default',
        type: 'default',
        line: lineNumber
      };
    }

    // Match named exports: export { name1, name2 }
    const namedExportMatch = line.match(/^export\s*\{\s*([^}]+)\s*\}/);
    if (namedExportMatch) {
      const names = namedExportMatch[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      return {
        name: names[0], // Return first export for simplicity
        type: 'named',
        line: lineNumber
      };
    }

    // Match direct named exports: export const/function/class name
    const directExportMatch = line.match(/^export\s+(const|let|var|function|class|interface|type)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (directExportMatch) {
      return {
        name: directExportMatch[2],
        type: 'named',
        line: lineNumber
      };
    }

    return null;
  }

  private parseImportStatement(line: string, lineNumber: number): ImportInfo | null {
    // Match import statements: import ... from '...'
    const importMatch = line.match(/^import\s+(.+?)\s+from\s+['"`]([^'"`]+)['"`]/);
    if (!importMatch) {
      return null;
    }

    const importClause = importMatch[1].trim();
    const source = importMatch[2];

    let type: 'default' | 'named' | 'namespace' = 'named';
    let imports: string[] = [];

    // Default import: import Name from '...'
    if (importClause.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
      type = 'default';
      imports = [importClause];
    }
    // Namespace import: import * as Name from '...'
    else if (importClause.match(/^\*\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
      type = 'namespace';
      imports = [importClause.replace(/^\*\s+as\s+/, '')];
    }
    // Named imports: import { name1, name2 } from '...'
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

  private validateImportExportConsistency(
    moduleMap: Map<string, ModuleInfo>,
    sourceDir: string,
    errors: ValidationError[]
  ): void {
    for (const [filePath, moduleInfo] of moduleMap) {
      for (const importInfo of moduleInfo.imports) {
        // Resolve the imported module path
        const resolvedPath = this.resolveModulePath(importInfo.source, filePath, sourceDir);
        if (!resolvedPath) {
          // Check if this is a relative import (should be resolved) or external module (can be skipped)
          if (importInfo.source.startsWith('.')) {
            errors.push({
              type: 'INVALID_IMPORT',
              file: filePath,
              line: importInfo.line,
              message: `Cannot resolve module: ${importInfo.source}`,
              suggestion: `Check if the file exists or the path is correct`
            });
          }
          continue; // Skip external modules or continue after error
        }

        const targetModule = moduleMap.get(resolvedPath);
        if (!targetModule) {
          errors.push({
            type: 'INVALID_IMPORT',
            file: filePath,
            line: importInfo.line,
            message: `Cannot resolve module: ${importInfo.source}`,
            suggestion: `Check if the file exists at ${resolvedPath}`
          });
          continue;
        }

        // Validate import/export consistency
        this.validateImportAgainstExports(importInfo, targetModule, filePath, errors);
      }
    }
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

  private validateImportAgainstExports(
    importInfo: ImportInfo,
    targetModule: ModuleInfo,
    currentFile: string,
    errors: ValidationError[]
  ): void {
    if (importInfo.type === 'default') {
      if (!targetModule.hasDefaultExport) {
        errors.push({
          type: 'MISSING_EXPORT',
          file: currentFile,
          line: importInfo.line,
          message: `Module ${importInfo.source} does not have a default export`,
          suggestion: 'Use named imports or add a default export to the target module'
        });
      }
    } else if (importInfo.type === 'named') {
      for (const importName of importInfo.imports) {
        const hasExport = targetModule.exports.some(exp => exp.name === importName);
        if (!hasExport) {
          errors.push({
            type: 'MISSING_EXPORT',
            file: currentFile,
            line: importInfo.line,
            message: `Module ${importInfo.source} does not export '${importName}'`,
            suggestion: `Check available exports in ${targetModule.path} or fix the import name`
          });
        }
      }
    }
  }

  private getSourceFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.getSourceFiles(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // If we can't read the directory, return empty array
      return [];
    }
    
    return files;
  }

  private detectUnusedImports(
    moduleMap: Map<string, ModuleInfo>,
    warnings: ValidationWarning[]
  ): void {
    for (const [filePath, moduleInfo] of moduleMap) {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      for (const importInfo of moduleInfo.imports) {
        // Skip external modules for now
        if (!importInfo.source.startsWith('.')) {
          continue;
        }

        // Check if imported names are used in the file content
        for (const importName of importInfo.imports) {
          if (!this.isImportUsed(importName, content, importInfo.line)) {
            warnings.push({
              type: 'UNUSED_IMPORT',
              file: filePath,
              line: importInfo.line,
              message: `Unused import '${importName}' from '${importInfo.source}'`
            });
          }
        }
      }
    }
  }

  private isImportUsed(importName: string, content: string, importLine: number): boolean {
    const lines = content.split('\n');
    
    // Check all lines except the import line itself
    for (let i = 0; i < lines.length; i++) {
      if (i + 1 === importLine) {
        continue; // Skip the import line itself
      }
      
      const line = lines[i];
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
        continue;
      }
      
      // Simple check: if the import name appears in the line as a word boundary
      const regex = new RegExp(`\\b${importName}\\b`);
      if (regex.test(line)) {
        return true;
      }
    }
    
    return false;
  }
}