/**
 * Next.js Build Integration
 * Integrates build validation hooks into the Next.js build process
 */

import { NextConfig } from 'next';
import { BuildValidator } from './build-validator';
import { PreBuildValidator } from './pre-build-validator';
import { EnvironmentValidator } from './environment-validator';
import { ValidationResult } from './types';
import * as path from 'path';

export interface BuildStabilityConfig {
  enabled?: boolean;
  mode?: 'strict' | 'warn' | 'off';
  skipEnvironmentValidation?: boolean;
  skipPreBuildValidation?: boolean;
  sourceDir?: string;
  failOnWarnings?: boolean;
  outputValidationResults?: boolean;
}

export class NextJsBuildIntegration {
  private config: BuildStabilityConfig;
  private buildValidator: BuildValidator;
  private preBuildValidator: PreBuildValidator;
  private environmentValidator: EnvironmentValidator;

  constructor(config: BuildStabilityConfig = {}) {
    this.config = {
      enabled: true,
      mode: 'strict',
      skipEnvironmentValidation: false,
      skipPreBuildValidation: false,
      sourceDir: 'src',
      failOnWarnings: false,
      outputValidationResults: true,
      ...config
    };

    this.buildValidator = new BuildValidator();
    this.preBuildValidator = new PreBuildValidator();
    this.environmentValidator = new EnvironmentValidator();
  }

  /**
   * Creates a Next.js plugin that integrates build validation
   */
  createPlugin() {
    const self = this;

    return function buildStabilityPlugin(nextConfig: NextConfig = {}): NextConfig {
      if (!self.config.enabled) {
        return nextConfig;
      }

      // Store original webpack function
      const originalWebpack = nextConfig.webpack;

      return {
        ...nextConfig,
        webpack: (config: any, options: any) => {
          // Run pre-build validation before webpack compilation
          if (options.isServer && !options.dev) {
            // Only run during production build on server compilation
            self.runPreBuildValidation(options.dir);
          }

          // Call original webpack function if it exists
          if (typeof originalWebpack === 'function') {
            return originalWebpack(config, options);
          }

          return config;
        },

        // Add custom build phases
        onDemandEntries: nextConfig.onDemandEntries,
        
        // Override the build process to include validation
        experimental: {
          ...nextConfig.experimental,
          // Add build validation to the build process
        }
      };
    };
  }

  /**
   * Run pre-build validation and handle results
   */
  private async runPreBuildValidation(projectDir: string): Promise<void> {
    try {
      console.log('🔍 Running build stability validation...');

      const sourceDir = path.join(projectDir, this.config.sourceDir || 'src');

      // Environment validation
      if (!this.config.skipEnvironmentValidation) {
        const envResult = await this.environmentValidator.validateEnvironment({
          environment: process.env.NODE_ENV as any || 'production'
        });

        this.handleValidationResult('Environment', envResult);
      }

      // Pre-build validation
      if (!this.config.skipPreBuildValidation) {
        const preBuildResult = await this.preBuildValidator.validatePreBuild({
          sourceDir,
          checkExportChanges: true,
          validateNewModules: true,
          skipExternalDependencies: true
        });

        this.handleValidationResult('Pre-build', preBuildResult);
      }

      // Build validation
      const buildResult = await this.buildValidator.validateBuild(sourceDir);
      this.handleValidationResult('Build', buildResult);

      console.log('✅ Build stability validation completed successfully');
    } catch (error) {
      console.error('❌ Build stability validation failed:', error);
      
      if (this.config.mode === 'strict') {
        process.exit(1);
      }
    }
  }

  /**
   * Handle validation results based on configuration
   */
  private handleValidationResult(phase: string, result: ValidationResult): void {
    if (this.config.outputValidationResults) {
      console.log(`\n${phase} Validation:`);
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
    }

    // Handle failures based on mode
    if (!result.isValid) {
      if (this.config.mode === 'strict') {
        throw new Error(`${phase} validation failed with ${result.errors.length} errors`);
      } else if (this.config.mode === 'warn') {
        console.warn(`⚠️ ${phase} validation failed with ${result.errors.length} errors`);
      }
    }

    // Handle warnings if configured to fail on warnings
    if (this.config.failOnWarnings && result.warnings.length > 0) {
      if (this.config.mode === 'strict') {
        throw new Error(`${phase} validation failed with ${result.warnings.length} warnings`);
      }
    }
  }
}

/**
 * Convenience function to create the Next.js plugin
 */
export function withBuildStability(config: BuildStabilityConfig = {}) {
  const integration = new NextJsBuildIntegration(config);
  return integration.createPlugin();
}

/**
 * Default export for easy import
 */
export default withBuildStability;