/**
 * Core interfaces for build stability components
 */

import {
  ValidationResult,
  ValidationError,
  DependencyGraph,
  BuildResult,
  BuildError,
  FormattedError
} from './types';

export interface IBuildValidator {
  validateBuild(sourceDir: string): Promise<ValidationResult>;
}

export interface IDependencyAnalyzer {
  analyzeDependencies(projectRoot: string): Promise<DependencyGraph>;
}

export interface IBuildMonitor {
  monitorBuild(buildCommand: string): Promise<BuildResult>;
}

export interface IErrorReporter {
  reportError(error: BuildError): FormattedError;
}

export interface IPreBuildValidator {
  validatePreBuild(options: PreBuildValidationOptions): Promise<ValidationResult>;
  validateExportChanges(sourceDir: string): Promise<ExportChangeValidationResult>;
  validateNewModules(sourceDir: string): Promise<NewModuleValidationResult>;
}

export interface PreBuildValidationOptions {
  sourceDir: string;
  checkExportChanges?: boolean;
  validateNewModules?: boolean;
  skipExternalDependencies?: boolean;
}

export interface ExportChangeValidationResult {
  changedModules: string[];
  affectedDependents: string[];
  validationErrors: ValidationError[];
}

export interface NewModuleValidationResult {
  newModules: string[];
  validationErrors: ValidationError[];
}

export interface IEnvironmentValidator {
  validateEnvironment(options?: EnvironmentValidationOptions): Promise<EnvironmentValidationResult>;
  getConfigurationSummary(): Record<string, any>;
}

export interface EnvironmentValidationOptions {
  checkRequired?: boolean;
  checkConsistency?: boolean;
  environment?: 'development' | 'production' | 'test';
}

export interface EnvironmentValidationResult extends ValidationResult {
  missingVariables: string[];
  inconsistentVariables: string[];
  configurationIssues: ConfigurationIssue[];
}

export interface ConfigurationIssue {
  type: 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'INCONSISTENT_ENV' | 'DEPRECATED_CONFIG';
  variable: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning';
}