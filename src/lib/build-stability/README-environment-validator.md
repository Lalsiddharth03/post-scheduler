# Environment Validator

The Environment Validator ensures that your application has all required environment variables configured correctly and that configuration is consistent across different environments (development, production, test).

## Features

- ✅ **Required Variable Validation**: Ensures all required environment variables are present
- 🔍 **Format Validation**: Validates that environment variables have correct formats (URLs, keys, etc.)
- 🔄 **Environment Consistency**: Checks for configuration inconsistencies between development and production
- 📊 **Configuration Summary**: Provides a summary of current configuration status
- 💡 **Clear Error Messages**: Provides actionable suggestions for fixing configuration issues

## Usage

### Basic Validation

```typescript
import { environmentValidator } from './environment-validator';

// Validate all environment variables
const result = await environmentValidator.validateEnvironment();

if (result.isValid) {
  console.log('✅ Environment validation passed');
} else {
  console.log('❌ Environment validation failed');
  result.errors.forEach(error => {
    console.log(`Error: ${error.message}`);
    console.log(`Suggestion: ${error.suggestion}`);
  });
}
```

### Validate Specific Environment

```typescript
// Validate production environment
const result = await environmentValidator.validateEnvironment({
  environment: 'production',
  checkRequired: true,
  checkConsistency: true
});
```

### Get Configuration Summary

```typescript
const summary = environmentValidator.getConfigurationSummary();
console.log(summary);
// Output:
// {
//   environment: 'development',
//   supabase: { url: 'configured', anonKey: 'configured', ... },
//   security: { jwtSecret: 'configured', ... },
//   ...
// }
```

### Validation Options

```typescript
interface EnvironmentValidationOptions {
  checkRequired?: boolean;      // Check for required variables (default: true)
  checkConsistency?: boolean;   // Check environment consistency (default: true)
  environment?: 'development' | 'production' | 'test';  // Target environment
}
```

## Required Environment Variables

### Always Required

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (must start with https:// and contain .supabase.co)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key (JWT format)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (JWT format)
- `JWT_SECRET`: JWT signing secret (minimum 32 characters)

### Production Only

- `CRON_SECRET`: CRON job authentication secret (minimum 16 characters, required in production)

### Optional (with defaults)

- `DB_MAX_RETRIES`: Maximum database retry attempts (default: 3)
- `DB_CONNECTION_TIMEOUT_MS`: Database connection timeout (default: 10000)
- `LOG_LEVEL`: Application logging level (default: 'info')
- `DEFAULT_TIMEZONE`: Default timezone (default: 'UTC')

## Validation Rules

### Format Validation

- **Supabase URLs**: Must start with `https://` and contain `.supabase.co`
- **JWT Keys**: Must start with `eyJ` and be at least 20 characters
- **JWT Secret**: Must be at least 32 characters long
- **CRON Secret**: Must be at least 16 characters and not contain leading/trailing whitespace
- **Numeric Values**: Must be valid numbers within acceptable ranges
- **Timezones**: Must be valid IANA timezone identifiers

### Consistency Checks

#### Production Environment
- ❌ Debug logging should not be enabled (`LOG_LEVEL` should not be 'debug')
- ✅ `CRON_SECRET` must be configured and secure
- ✅ Security logging should be enabled

#### Development Environment
- ⚠️  Alerting should typically be disabled
- ✅ More lenient configuration requirements

## Error Types

### Configuration Issues

```typescript
interface ConfigurationIssue {
  type: 'MISSING_REQUIRED' | 'INVALID_VALUE' | 'INCONSISTENT_ENV' | 'DEPRECATED_CONFIG';
  variable: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning';
}
```

### Common Errors

1. **MISSING_REQUIRED**: A required environment variable is not defined
2. **INVALID_VALUE**: An environment variable has an invalid format or value
3. **INCONSISTENT_ENV**: Configuration is inconsistent with the target environment
4. **DEPRECATED_CONFIG**: Using deprecated configuration options

## Integration Examples

### Application Startup

```typescript
import { validateEnvironmentOnStartup } from './examples/environment-validation-example';

// Validate environment before starting the application
await validateEnvironmentOnStartup();

// Start your application
app.listen(3000);
```

### CI/CD Pipeline

```typescript
// In your build script
import { environmentValidator } from './environment-validator';

const result = await environmentValidator.validateEnvironment({
  environment: 'production',
  checkRequired: true,
  checkConsistency: true
});

if (!result.isValid) {
  console.error('Environment validation failed');
  process.exit(1);
}
```

### Pre-deployment Check

```typescript
// Check both development and production configurations
const devValid = await validateSpecificEnvironment('development');
const prodValid = await validateSpecificEnvironment('production');

if (!devValid || !prodValid) {
  throw new Error('Environment validation failed');
}
```

## Validation Result

```typescript
interface EnvironmentValidationResult {
  isValid: boolean;                          // Overall validation status
  errors: ValidationError[];                 // Critical errors
  warnings: ValidationWarning[];             // Non-critical warnings
  metrics: ValidationMetrics;                // Validation performance metrics
  missingVariables: string[];                // List of missing required variables
  inconsistentVariables: string[];           // List of inconsistent variables
  configurationIssues: ConfigurationIssue[]; // Detailed configuration issues
}
```

## Best Practices

1. **Validate Early**: Run environment validation at application startup
2. **Fail Fast**: Exit the application if critical environment variables are missing
3. **Log Warnings**: Don't ignore warnings - they often indicate potential issues
4. **Environment-Specific**: Use different validation rules for development vs production
5. **CI/CD Integration**: Include environment validation in your deployment pipeline
6. **Documentation**: Keep your .env.example file up to date with required variables

## Example .env.local

```bash
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Security Configuration (Required)
JWT_SECRET=your-very-long-jwt-secret-key-at-least-32-characters
CRON_SECRET=your-secure-cron-secret-key

# Database Configuration (Optional)
DB_MAX_RETRIES=3
DB_CONNECTION_TIMEOUT_MS=10000

# Logging Configuration (Optional)
LOG_LEVEL=info
ENABLE_STRUCTURED_LOGGING=true
```

## Troubleshooting

### "Missing required environment variable"
- Check that the variable is defined in your `.env.local` file
- Ensure the variable name matches exactly (case-sensitive)
- Restart your development server after adding new variables

### "Invalid value for environment variable"
- Check the format requirements for the specific variable
- Ensure URLs start with `https://`
- Ensure JWT keys are in the correct format
- Check that numeric values are within acceptable ranges

### "Debug logging enabled in production"
- Set `LOG_LEVEL=info` or `LOG_LEVEL=warn` for production
- Never use `LOG_LEVEL=debug` in production environments

### "CRON_SECRET is required in production"
- Set a strong `CRON_SECRET` with at least 16 characters
- Ensure the secret doesn't have leading/trailing whitespace
- Use a cryptographically secure random string

## Related Documentation

- [Build Stability Design](./design.md)
- [Build Validator](./build-validator.ts)
- [Configuration Utils](../config-utils.ts)
