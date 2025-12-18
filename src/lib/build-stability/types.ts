/**
 * Core data model interfaces and types for build stability system
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: ValidationMetrics;
}

export interface ValidationError {
  type: 'MISSING_EXPORT' | 'CIRCULAR_DEPENDENCY' | 'INVALID_IMPORT';
  file: string;
  line: number;
  message: string;
  suggestion: string;
}

export interface ValidationWarning {
  type: 'UNUSED_IMPORT' | 'DEPRECATED_IMPORT' | 'PERFORMANCE';
  file: string;
  line: number;
  message: string;
}

export interface ValidationMetrics {
  totalFiles: number;
  validatedFiles: number;
  totalImports: number;
  totalExports: number;
  validationTime: number;
}

export interface BuildError {
  type: string;
  file: string;
  line: number;
  column: number;
  message: string;
  stack?: string;
}

export interface BuildWarning {
  type: string;
  file: string;
  line: number;
  message: string;
}

export interface BuildResult {
  success: boolean;
  duration: number;
  errors: BuildError[];
  warnings: BuildWarning[];
  artifacts: BuildArtifact[];
}

export interface BuildArtifact {
  path: string;
  size: number;
  type: 'js' | 'css' | 'html' | 'map' | 'other';
}

export interface DependencyGraph {
  nodes: ModuleNode[];
  edges: DependencyEdge[];
  cycles: CircularDependency[];
}

export interface ModuleNode {
  id: string;
  path: string;
  moduleInfo: ModuleInfo;
}

export interface DependencyEdge {
  from: string;
  to: string;
  importType: 'default' | 'named' | 'namespace';
}

export interface CircularDependency {
  cycle: string[];
  severity: 'error' | 'warning';
}

export interface ModuleInfo {
  path: string;
  exports: ExportInfo[];
  imports: ImportInfo[];
  hasDefaultExport: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named';
  line: number;
}

export interface ImportInfo {
  source: string;
  imports: string[];
  type: 'default' | 'named' | 'namespace';
  line: number;
}

export interface FormattedError {
  originalError: BuildError;
  formattedMessage: string;
  context: string;
  suggestions: string[];
  documentationLinks: string[];
}