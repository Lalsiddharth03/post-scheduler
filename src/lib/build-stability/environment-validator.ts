/**
 * Environment and Configuration Validator
 * 
 * Validates environment variables and configuration consistency
 * across development and production environments.
 */

import { ValidationResult, ValidationError, ValidationWarning, ValidationMetrics } from './types';

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

export interface RequiredEnvironmentVariable {
  name: string;
  required: boolean;
  environments: ('development' | 'production' | 'test')[];
  validator?: (value: string) => boolean;
  description: string;
}

export class EnvironmentValidator {
  private requiredVariables: RequiredEnvironmentVariable[] = [
    // Supabase configuration
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      required: true,
      environments: ['development', 'production'],
      validator: (value) => value.startsWith('https://') && value.includes('.supabase.co'),
      description: 'Supabase project URL'
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      required: true,
      environments: ['development', 'production'],
      validator: (value) => value.length > 20 && value.startsWith('eyJ'),
      description: 'Supabase anonymous key'
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      required: true,
      environments: ['development', 'production'],
      validator: (value) => value.length > 20 && value.startsWith('eyJ'),
      description: 'Supabase service role key'
    },
    
    // Security configuration
    {
      name: 'JWT_SECRET',
      required: true,
      environments: ['development', 'production'],
      validator: (value) => value.length >= 32,
      description: 'JWT signing secret (minimum 32 characters)'
    },
    {
      name: 'CRON_SECRET',
      required: false, // Only required in production, handled in consistency check
      environments: ['development', 'production'],
      validator: (value) => value.length >= 16 && value.trim() === value,
      description: 'CRON job authentication secret'
    },
    
    // Database configuration
    {
      name: 'DB_MAX_RETRIES',
      required: false,
      environments: ['development', 'production'],
      validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
      description: 'Maximum database retry attempts'
    },
    {
      name: 'DB_CONNECTION_TIMEOUT_MS',
      required: false,
      environments: ['development', 'production'],
      validator: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
      description: 'Database connection timeout in milliseconds'
    },
    
    // Logging configuration
    {
      name: 'LOG_LEVEL',
      required: false,
      environments: ['development', 'production'],
      validator: (value) => ['debug', 'info', 'warn', 'error'].includes(value),
      description: 'Application logging level'
    }
  ];

  /**
   * Validates environment variables and configuration
   */
  async validateEnvironment(options: EnvironmentValidationOptions = {}): Promise<EnvironmentValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const missingVariables: string[] = [];
    const inconsistentVariables: string[] = [];
    const configurationIssues: ConfigurationIssue[] = [];

    const currentEnv = options.environment || process.env.NODE_ENV || 'development';

    // Check required variables
    if (options.checkRequired !== false) {
      this.validateRequiredVariables(currentEnv, errors, missingVariables, configurationIssues);
    }

    // Check consistency between environments
    if (options.checkConsistency !== false) {
      this.validateEnvironmentConsistency(currentEnv, warnings, inconsistentVariables, configurationIssues);
    }

    // Validate specific configuration values
    this.validateConfigurationValues(errors, warnings, configurationIssues);

    const validationTime = Date.now() - startTime;
    const metrics: ValidationMetrics = {
      totalFiles: 1, // Environment file
      validatedFiles: 1,
      totalImports: 0,
      totalExports: 0,
      validationTime
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics,
      missingVariables,
      inconsistentVariables,
      configurationIssues
    };
  }

  /**
   * Validates that required environment variables are present and valid
   */
  private validateRequiredVariables(
    environment: string,
    errors: ValidationError[],
    missingVariables: string[],
    configurationIssues: ConfigurationIssue[]
  ): void {
    for (const variable of this.requiredVariables) {
      // Skip if not required for current environment
      if (!variable.environments.includes(environment as any)) {
        continue;
      }

      const value = process.env[variable.name];

      if (!value) {
        if (variable.required) {
          missingVariables.push(variable.name);
          errors.push({
            type: 'MISSING_EXPORT', // Reusing existing type for consistency
            file: '.env.local',
            line: 0,
            message: `Missing required environment variable: ${variable.name}`,
            suggestion: `Add ${variable.name}=${variable.description} to your .env.local file`
          });

          configurationIssues.push({
            type: 'MISSING_REQUIRED',
            variable: variable.name,
            message: `Required environment variable ${variable.name} is not defined`,
            suggestion: `Set ${variable.name} in your environment configuration. ${variable.description}`,
            severity: 'error'
          });
        }
        continue;
      }

      // Validate value format if validator is provided
      if (variable.validator && !variable.validator(value)) {
        errors.push({
          type: 'INVALID_IMPORT', // Reusing existing type for consistency
          file: '.env.local',
          line: 0,
          message: `Invalid value for environment variable: ${variable.name}`,
          suggestion: `Ensure ${variable.name} meets the required format: ${variable.description}`
        });

        configurationIssues.push({
          type: 'INVALID_VALUE',
          variable: variable.name,
          message: `Environment variable ${variable.name} has an invalid value`,
          suggestion: `Update ${variable.name} to match the expected format: ${variable.description}`,
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validates consistency between development and production configurations
   */
  private validateEnvironmentConsistency(
    currentEnv: string,
    warnings: ValidationWarning[],
    inconsistentVariables: string[],
    configurationIssues: ConfigurationIssue[]
  ): void {
    // Check for development-specific configurations in production
    if (currentEnv === 'production') {
      const logLevel = process.env.LOG_LEVEL;
      if (logLevel === 'debug') {
        inconsistentVariables.push('LOG_LEVEL');
        warnings.push({
          type: 'PERFORMANCE',
          file: '.env.local',
          line: 0,
          message: 'Debug logging enabled in production environment'
        });

        configurationIssues.push({
          type: 'INCONSISTENT_ENV',
          variable: 'LOG_LEVEL',
          message: 'Debug logging should not be enabled in production',
          suggestion: 'Set LOG_LEVEL to "info" or "warn" for production environments',
          severity: 'warning'
        });
      }

      // Check for missing production-specific variables
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || cronSecret.trim() !== cronSecret || cronSecret.length < 16) {
        inconsistentVariables.push('CRON_SECRET');
        configurationIssues.push({
          type: 'INCONSISTENT_ENV',
          variable: 'CRON_SECRET',
          message: 'CRON_SECRET is required and must be secure in production',
          suggestion: 'Set a strong CRON_SECRET with at least 16 characters for production',
          severity: 'error'
        });
      }
    }

    // Check for production configurations in development
    if (currentEnv === 'development') {
      const alertingEnabled = process.env.ALERTING_ENABLED;
      if (alertingEnabled === 'true') {
        warnings.push({
          type: 'PERFORMANCE',
          file: '.env.local',
          line: 0,
          message: 'Production alerting enabled in development environment'
        });

        configurationIssues.push({
          type: 'INCONSISTENT_ENV',
          variable: 'ALERTING_ENABLED',
          message: 'Alerting should typically be disabled in development',
          suggestion: 'Set ALERTING_ENABLED to "false" for development environments',
          severity: 'warning'
        });
      }
    }
  }

  /**
   * Validates specific configuration values for correctness
   */
  private validateConfigurationValues(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    configurationIssues: ConfigurationIssue[]
  ): void {
    // Validate numeric configurations
    const numericConfigs = [
      { name: 'DB_MAX_RETRIES', min: 1, max: 10 },
      { name: 'DB_CONNECTION_TIMEOUT_MS', min: 1000, max: 60000 },
      { name: 'SCHEDULER_MAX_BATCH_SIZE', min: 1, max: 1000 },
      { name: 'MEMORY_USAGE_THRESHOLD_MB', min: 128, max: 4096 }
    ];

    for (const config of numericConfigs) {
      const value = process.env[config.name];
      if (value) {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < config.min || numValue > config.max) {
          errors.push({
            type: 'INVALID_IMPORT',
            file: '.env.local',
            line: 0,
            message: `Invalid value for ${config.name}: ${value}`,
            suggestion: `Set ${config.name} to a number between ${config.min} and ${config.max}`
          });

          configurationIssues.push({
            type: 'INVALID_VALUE',
            variable: config.name,
            message: `${config.name} must be between ${config.min} and ${config.max}`,
            suggestion: `Update ${config.name} to a valid number within the acceptable range`,
            severity: 'error'
          });
        }
      }
    }

    // Validate timezone configuration
    const defaultTimezone = process.env.DEFAULT_TIMEZONE;
    if (defaultTimezone && !this.isValidTimezone(defaultTimezone)) {
      warnings.push({
        type: 'DEPRECATED_IMPORT',
        file: '.env.local',
        line: 0,
        message: `Invalid timezone: ${defaultTimezone}`
      });

      configurationIssues.push({
        type: 'INVALID_VALUE',
        variable: 'DEFAULT_TIMEZONE',
        message: `Invalid timezone identifier: ${defaultTimezone}`,
        suggestion: 'Use a valid IANA timezone identifier (e.g., UTC, America/New_York)',
        severity: 'warning'
      });
    }
  }

  /**
   * Validates if a timezone string is valid
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets a summary of current environment configuration
   */
  getConfigurationSummary(): Record<string, any> {
    const env = process.env.NODE_ENV || 'development';
    
    return {
      environment: env,
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing'
      },
      security: {
        jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing',
        cronSecret: process.env.CRON_SECRET ? 'configured' : 'missing',
        securityLogging: process.env.ENABLE_SECURITY_LOGGING !== 'false'
      },
      database: {
        maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3'),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000')
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        structured: process.env.ENABLE_STRUCTURED_LOGGING !== 'false'
      }
    };
  }
}

export const environmentValidator = new EnvironmentValidator();