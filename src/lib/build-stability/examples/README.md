# Build Stability Configuration Examples

This directory contains example configurations for different project types and use cases.

## Configuration Files

### basic-nextjs.config.json
Basic configuration for a standard Next.js project in development mode.

**Use case:** Local development with full validation

```bash
npx build-stability validate --config examples/basic-nextjs.config.json
```

### production.config.json
Configuration optimized for production builds.

**Use case:** Production deployments with strict validation

```bash
npx build-stability validate --mode full --config examples/production.config.json
```

### ci-cd.config.json
Configuration for CI/CD pipelines with external dependency skipping for faster validation.

**Use case:** Automated build pipelines

```bash
npx build-stability validate --mode full --config examples/ci-cd.config.json --output json
```

## Next.js Integration Examples

### Basic Integration

```typescript
// next.config.ts
import { withBuildStability } from '@/lib/build-stability/next-integration';

const nextConfig = {
  reactStrictMode: true,
  // your other config options
};

export default withBuildStability(nextConfig);
```

### Advanced Integration with Custom Options

```typescript
// next.config.ts
import { withBuildStability } from '@/lib/build-stability/next-integration';

const nextConfig = {
  reactStrictMode: true,
  // your other config options
};

export default withBuildStability(nextConfig, {
  enablePreBuildValidation: true,
  enableBuildMonitoring: true,
  failOnValidationErrors: process.env.NODE_ENV === 'production',
  validationOptions: {
    sourceDir: './src',
    checkExportChanges: true,
    validateNewModules: true,
    skipExternalDependencies: false
  }
});
```

### Development-Only Validation

```typescript
// next.config.ts
import { withBuildStability } from '@/lib/build-stability/next-integration';

const nextConfig = {
  reactStrictMode: true,
};

// Only enable validation in development
const config = process.env.NODE_ENV === 'development'
  ? withBuildStability(nextConfig, {
      enablePreBuildValidation: true,
      failOnValidationErrors: false // Don't fail in dev, just warn
    })
  : nextConfig;

export default config;
```

## CI/CD Integration Examples

### GitHub Actions

```yaml
name: Build Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run build validation
        run: |
          npx build-stability validate \
            --mode full \
            --config examples/ci-cd.config.json \
            --output json > validation-report.json
            
      - name: Upload validation report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: validation-report
          path: validation-report.json
          
      - name: Check validation results
        run: |
          if [ $? -ne 0 ]; then
            echo "Build validation failed"
            exit 1
          fi
```

### GitLab CI

```yaml
build-validation:
  stage: test
  script:
    - npm ci
    - npx build-stability validate --mode full --config examples/ci-cd.config.json --output json
  artifacts:
    reports:
      junit: validation-report.json
    when: always
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running build stability validation..."

npx build-stability check --output summary

if [ $? -ne 0 ]; then
  echo "❌ Build validation failed. Please fix errors before committing."
  exit 1
fi

echo "✅ Build validation passed"
exit 0
```

## Package.json Scripts

Add these scripts to your `package.json` for convenient validation:

```json
{
  "scripts": {
    "validate": "build-stability validate --mode pre-build",
    "validate:full": "build-stability validate --mode full",
    "validate:check": "build-stability check",
    "validate:ci": "build-stability validate --mode full --config examples/ci-cd.config.json --output json",
    "prebuild": "npm run validate:check"
  }
}
```

## Environment-Specific Configurations

### Development

```json
{
  "sourceDir": "./src",
  "buildCommand": "npm run dev",
  "skipExternalDependencies": false,
  "checkEnvironment": true,
  "environmentMode": "development"
}
```

### Staging

```json
{
  "sourceDir": "./src",
  "buildCommand": "npm run build",
  "skipExternalDependencies": false,
  "checkEnvironment": true,
  "environmentMode": "production"
}
```

### Production

```json
{
  "sourceDir": "./src",
  "buildCommand": "npm run build",
  "skipExternalDependencies": true,
  "checkEnvironment": true,
  "environmentMode": "production"
}
```

## Monorepo Configuration

For monorepo setups, create separate configurations for each package:

```json
{
  "sourceDir": "./packages/web/src",
  "buildCommand": "npm run build --workspace=web",
  "skipExternalDependencies": false,
  "checkEnvironment": true,
  "environmentMode": "development"
}
```

## Custom Validation Workflows

### Validate Specific Directories

```bash
npx build-stability validate --source-dir ./src/components --mode pre-build
```

### Continuous Validation During Development

```bash
npx build-stability validate --mode continuous --verbose
```

### Quick Health Check

```bash
npx build-stability check
```