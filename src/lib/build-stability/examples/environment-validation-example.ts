/**
 * Example usage of Environment Validator
 * 
 * This example demonstrates how to use the environment validator
 * to check configuration before starting the application.
 */

import { environmentValidator } from '../environment-validator';

/**
 * Example: Validate environment before application startup
 */
export async function validateEnvironmentOnStartup(): Promise<void> {
  console.log('🔍 Validating environment configuration...');
  
  try {
    const result = await environmentValidator.validateEnvironment();
    
    if (result.isValid) {
      console.log('✅ Environment validation passed');
      console.log(`📊 Validated ${result.metrics.validatedFiles} configuration files in ${result.metrics.validationTime}ms`);
      
      if (result.warnings.length > 0) {
        console.log(`⚠️  Found ${result.warnings.length} warnings:`);
        result.warnings.forEach(warning => {
          console.log(`   - ${warning.message}`);
        });
      }
    } else {
      console.log('❌ Environment validation failed');
      console.log(`🚨 Found ${result.errors.length} errors:`);
      
      result.errors.forEach(error => {
        console.log(`   - ${error.message}`);
        console.log(`     💡 ${error.suggestion}`);
      });
      
      if (result.missingVariables.length > 0) {
        console.log(`📋 Missing required variables: ${result.missingVariables.join(', ')}`);
      }
      
      if (result.configurationIssues.length > 0) {
        console.log('🔧 Configuration issues:');
        result.configurationIssues.forEach(issue => {
          console.log(`   - ${issue.message}`);
          console.log(`     💡 ${issue.suggestion}`);
        });
      }
      
      // Exit the application if validation fails
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Environment validation crashed:', error);
    process.exit(1);
  }
}

/**
 * Example: Validate specific environment (development/production)
 */
export async function validateSpecificEnvironment(env: 'development' | 'production'): Promise<boolean> {
  console.log(`🔍 Validating ${env} environment configuration...`);
  
  const result = await environmentValidator.validateEnvironment({
    environment: env,
    checkRequired: true,
    checkConsistency: true
  });
  
  if (!result.isValid) {
    console.log(`❌ ${env} environment validation failed`);
    result.errors.forEach(error => console.log(`   - ${error.message}`));
    return false;
  }
  
  console.log(`✅ ${env} environment validation passed`);
  return true;
}

/**
 * Example: Get configuration summary for debugging
 */
export function logConfigurationSummary(): void {
  console.log('📋 Current configuration summary:');
  const summary = environmentValidator.getConfigurationSummary();
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Example: Validate only required variables (skip consistency checks)
 */
export async function validateRequiredOnly(): Promise<boolean> {
  const result = await environmentValidator.validateEnvironment({
    checkRequired: true,
    checkConsistency: false
  });
  
  return result.isValid;
}

/**
 * Example: Check environment consistency only (skip required variable checks)
 */
export async function validateConsistencyOnly(): Promise<boolean> {
  const result = await environmentValidator.validateEnvironment({
    checkRequired: false,
    checkConsistency: true
  });
  
  return result.isValid;
}