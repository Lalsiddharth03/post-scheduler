#!/usr/bin/env node

/**
 * Build Stability CLI
 * Command-line interface for running build validation independently
 */

import { program } from 'commander';
import { BuildValidator } from './build-validator';
import { DependencyAnalyzer } from './dependency-analyzer';
import { BuildMonitor } from './build-monitor';
import { ErrorReporter } from './error-reporter';
import { PreBuildValidator } from './pre-build-validator';
import { EnvironmentValidator } from './environment-validator';
import { ValidationResult, BuildResult } from './types';
import * as path from 'path';
import * as fs from 'fs';

interface CLIOptions {
  mode: 'pre-build' | 'post-build' | 'continuous' | 'full';
  sourceDir: string;
  buildCommand?: string;
  output: 'json' | 'text' | 'summary';
  verbose: boolean;
  config?: string;
}

interface ValidationConfig {
  sourceDir?: string;
  buildCommand?: string;
  skipExternalDependencies?: boolean;
  checkEnvironment?: boolean;
  environmentMode?: 'development' | 'production' | 'test';
}

class BuildStabilityCLI {
  private buildValidator: BuildValidator;
  private dependencyAnalyzer: DependencyAnalyzer;
  private buildMonitor: BuildMonitor;
  private errorReporter: ErrorReporter;
  private preBuildValidator: PreBuildValidator;
  private environmentValidator: EnvironmentValidator;

  constructor() {
    this.buildValidator = new BuildValidator();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.buildMonitor = new BuildMonitor();
    this.errorReporter = new ErrorReporter();
    this.preBuildValidator = new PreBuildValidator();
    this.environmentValidator = new EnvironmentValidator();
  }

  async runValidation(options: CLIOptions): Promise<void> {
    const config = await this.loadConfig(options.config);
    const sourceDir = options.sourceDir || config.sourceDir || process.cwd();

    try {
      switch (options.mode) {
        case 'pre-build':
          await this.runPreBuildValidation(sourceDir, options, config);
          break;
        case 'post-build':
          await this.runPostBuildValidation(sourceDir, options, config);
          break;
        case 'continuous':
          await this.runContinuousValidation(sourceDir, options, config);
          break;
        case 'full':
          await this.runFullValidation(sourceDir, options, config);
          break;
        default:
          throw new Error(`Unknown validation mode: ${options.mode}`);
      }
    } catch (error) {
      this.outputError(error as Error, options.output);
      throw error;
    }
  }

  private async runPreBuildValidation(
    sourceDir: string,
    options: CLIOptions,
    config: ValidationConfig
  ): Promise<void> {
    this.outputMessage('Running pre-build validation...', options.output, options.verbose);

    // Environment validation
    if (config.checkEnvironment !== false) {
      const envResult = await this.environmentValidator.validateEnvironment({
        environment: config.environmentMode || 'development'
      });
      this.outputValidationResult('Environment Validation', envResult, options.output);
      
      if (!envResult.isValid) {
        throw new Error('Environment validation failed');
      }
    }

    // Pre-build validation
    const preBuildResult = await this.preBuildValidator.validatePreBuild({
      sourceDir,
      checkExportChanges: true,
      validateNewModules: true,
      skipExternalDependencies: config.skipExternalDependencies
    });
    this.outputValidationResult('Pre-build Validation', preBuildResult, options.output);

    // Build validation
    const buildResult = await this.buildValidator.validateBuild(sourceDir);
    this.outputValidationResult('Build Validation', buildResult, options.output);

    // Dependency analysis
    const depResult = await this.dependencyAnalyzer.analyzeDependencies(sourceDir);
    this.outputDependencyResult(depResult, options.output);

    const allValid = preBuildResult.isValid && buildResult.isValid && depResult.cycles.length === 0;
    if (!allValid) {
      throw new Error('Pre-build validation failed');
    }

    this.outputMessage('✅ Pre-build validation completed successfully', options.output);
  }

  private async runPostBuildValidation(
    sourceDir: string,
    options: CLIOptions,
    config: ValidationConfig
  ): Promise<void> {
    this.outputMessage('Running post-build validation...', options.output, options.verbose);

    const buildCommand = options.buildCommand || config.buildCommand || 'npm run build';
    const buildResult = await this.buildMonitor.monitorBuild(buildCommand);
    
    this.outputBuildResult(buildResult, options.output);

    if (!buildResult.success) {
      throw new Error('Build process failed');
    }

    this.outputMessage('✅ Post-build validation completed successfully', options.output);
  }

  private async runContinuousValidation(
    sourceDir: string,
    options: CLIOptions,
    config: ValidationConfig
  ): Promise<void> {
    this.outputMessage('Starting continuous validation...', options.output, options.verbose);
    
    // For now, run a single validation cycle
    // In a real implementation, this would watch for file changes
    await this.runPreBuildValidation(sourceDir, options, config);
    
    this.outputMessage('✅ Continuous validation cycle completed', options.output);
  }

  private async runFullValidation(
    sourceDir: string,
    options: CLIOptions,
    config: ValidationConfig
  ): Promise<void> {
    this.outputMessage('Running full validation...', options.output, options.verbose);

    await this.runPreBuildValidation(sourceDir, options, config);
    await this.runPostBuildValidation(sourceDir, options, config);

    this.outputMessage('✅ Full validation completed successfully', options.output);
  }

  private async loadConfig(configPath?: string): Promise<ValidationConfig> {
    if (!configPath) {
      // Try to find default config files
      const defaultPaths = [
        'build-stability.config.js',
        'build-stability.config.json',
        '.build-stability.json'
      ];

      for (const defaultPath of defaultPaths) {
        if (fs.existsSync(defaultPath)) {
          configPath = defaultPath;
          break;
        }
      }
    }

    if (!configPath || !fs.existsSync(configPath)) {
      return {};
    }

    try {
      if (configPath.endsWith('.json')) {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
      } else {
        // For .js files, we'd need to require them
        return {};
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${configPath}`);
      return {};
    }
  }

  private outputValidationResult(
    title: string,
    result: ValidationResult,
    format: string
  ): void {
    if (format === 'json') {
      console.log(JSON.stringify({ title, result }, null, 2));
      return;
    }

    console.log(`\n${title}:`);
    console.log(`Status: ${result.isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.message}`);
        if (error.file) {
          console.log(`     File: ${error.file}:${error.line || 0}`);
        }
        if (error.suggestion) {
          console.log(`     Suggestion: ${error.suggestion}`);
        }
      });
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning.message}`);
      });
    }

    if (format !== 'summary' && result.metrics) {
      console.log('\nMetrics:');
      console.log(`  Files analyzed: ${result.metrics.validatedFiles || 0}`);
      console.log(`  Duration: ${result.metrics.validationTime || 0}ms`);
    }
  }

  private outputDependencyResult(result: any, format: string): void {
    if (format === 'json') {
      console.log(JSON.stringify({ title: 'Dependency Analysis', result }, null, 2));
      return;
    }

    console.log('\nDependency Analysis:');
    console.log(`Modules: ${result.nodes?.length || 0}`);
    console.log(`Dependencies: ${result.edges?.length || 0}`);
    console.log(`Circular dependencies: ${result.cycles?.length || 0}`);

    if (result.cycles && result.cycles.length > 0) {
      console.log('\nCircular Dependencies:');
      result.cycles.forEach((cycle: any, index: number) => {
        console.log(`  ${index + 1}. ${cycle.modules?.join(' → ') || 'Unknown cycle'}`);
      });
    }
  }

  private outputBuildResult(result: BuildResult, format: string): void {
    if (format === 'json') {
      console.log(JSON.stringify({ title: 'Build Result', result }, null, 2));
      return;
    }

    console.log('\nBuild Result:');
    console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`Duration: ${result.duration}ms`);

    if (result.errors.length > 0) {
      console.log('\nBuild Errors:');
      result.errors.forEach((error, index) => {
        const formatted = this.errorReporter.reportError(error);
        console.log(`  ${index + 1}. ${formatted.formattedMessage}`);
        if (formatted.context) {
          console.log(`     Context: ${formatted.context}`);
        }
        if (formatted.suggestions && formatted.suggestions.length > 0) {
          console.log(`     Suggestions: ${formatted.suggestions.join(', ')}`);
        }
      });
    }

    if (result.warnings.length > 0) {
      console.log('\nBuild Warnings:');
      result.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning.message || warning}`);
      });
    }
  }

  private outputMessage(message: string, format: string, verbose: boolean = true): void {
    if (format === 'json') return;
    if (verbose || format === 'text') {
      console.log(message);
    }
  }

  private outputError(error: Error, format: string): void {
    if (format === 'json') {
      console.error(JSON.stringify({ error: error.message }, null, 2));
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// CLI setup
program
  .name('build-stability')
  .description('Build stability validation CLI')
  .version('1.0.0');

program
  .command('validate')
  .description('Run build validation')
  .option('-m, --mode <mode>', 'Validation mode', 'pre-build')
  .option('-s, --source-dir <dir>', 'Source directory', process.cwd())
  .option('-b, --build-command <cmd>', 'Build command for post-build validation')
  .option('-o, --output <format>', 'Output format', 'text')
  .option('-v, --verbose', 'Verbose output', false)
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    const cli = new BuildStabilityCLI();
    try {
      await cli.runValidation(options);
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Quick validation check')
  .option('-s, --source-dir <dir>', 'Source directory', process.cwd())
  .action(async (options) => {
    const cli = new BuildStabilityCLI();
    try {
      await cli.runValidation({
        mode: 'pre-build',
        sourceDir: options.sourceDir,
        output: 'summary',
        verbose: false
      });
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Export for testing and external use
export { BuildStabilityCLI, program };

// Run CLI if this file is executed directly
if (require.main === module) {
  program.parse();
}