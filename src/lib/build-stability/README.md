# Build Stability System

The Build Stability System ensures reliable compilation of Next.js applications by implementing comprehensive import/export validation, dependency management, and build process monitoring.

## Overview

The system provides:
- **Pre-build validation** - Validates module structure before compilation
- **Build process monitoring** - Tracks compilation progress and captures errors
- **Post-build verification** - Ensures build artifacts are complete and valid
- **Continuous monitoring** - Ongoing validation of import/export consistency

## Quick Start

### Installation

The build stability system is already integrated into your Next.js project. No additional installation is required.

### Basic Usage

#### Command Line Interface

```bash
# Quick validation check
npx build-stability check

# Full pre-build validation
npx build-stability validate --mode pre-build

# Monitor build process
npx build-stability validate --mode post-build --build-command "npm run build"

# Full validation (pre-build + build monitoring)
npx build-stability validate --mode full
```

#### Programmatic Usage

```typescript
import { 
  BuildValidator, 
  DependencyAnalyzer, 
  BuildMonitor,
  PreBuildValidator 
} from '@/lib/build-stability';

// Basic build validation
const validator = new BuildValidator();
const result = await validator.validateBuild('./src');

if (!result.isValid) {
  console.error('Build validation failed:', result.errors);
}

// Pre-build validation with export change detection
const preBuildValidator = new PreBuildValidator();
const preBuildResult = await preBuildValidator.validatePreBuild({
  sourceDir: './src',
  checkExportChanges: true,
  validateNewModules: true
});

// Dependency analysis
const analyzer = new DependencyAnalyzer();
const depGraph = await analyzer.analyzeDependencies('./');

if (depGraph.cycles.length > 0) {
  console.warn('Circular dependencies detected:', depGraph.cycles);
}
```

## Configuration

### Configuration File

Create a `build-stability.config.json` file in your project root:

```json
{
  "sourceDir": "./src",
  "buildCommand": "npm run build",
  "skipExternalDependencies": false,
  "checkEnvironment": true,
  "environmentMode": "development"
}
```

### Next.js Integration

Add build validation to your Next.js configuration:

```typescript
// next.config.ts
import { withBuildStability } from '@/lib/build-stability/next-integration';

const nextConfig = {
  // your existing config
};

export default withBuildStability(nextConfig, {
  enablePreBuildValidation: true,
  enableBuildMonitoring: true,
  failOnValidationErrors: true
});
```

## API Reference

### BuildValidator

Validates module structure and import/export consistency.

```typescript
interface IBuildValidator {
  validateBuild(sourceDir: string): Promise<ValidationResult>;
}
```

**Example:**
```typescript
const validator = new BuildValidator();
const result = await validator.validateBuild('./src');

// Check results
console.log('Valid:', result.isValid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

### DependencyAnalyzer

Analyzes and validates dependency relationships.

```typescript
interface IDependencyAnalyzer {
  analyzeDependencies(projectRoot: string): Promise<DependencyGraph>;
}
```

**Example:**
```typescript
const analyzer = new DependencyAnalyzer();
const graph = await analyzer.analyzeDependencies('./');

// Check for circular dependencies
if (graph.cycles.length > 0) {
  graph.cycles.forEach(cycle => {
    console.log('Circular dependency:', cycle.modules.join(' → '));
  });
}
```

### BuildMonitor

Monitors Next.js build process and captures errors.

```typescript
interface IBuildMonitor {
  monitorBuild(buildCommand: string): Promise<BuildResult>;
}
```

**Example:**
```typescript
const monitor = new BuildMonitor();
const result = await monitor.monitorBuild('npm run build');

console.log('Build success:', result.success);
console.log('Duration:', result.duration, 'ms');
console.log('Errors:', result.errors);
```

### PreBuildValidator

Validates module structure before build process.

```typescript
interface IPreBuildValidator {
  validatePreBuild(options: PreBuildValidationOptions): Promise<ValidationResult>;
  validateExportChanges(sourceDir: string): Promise<ExportChangeValidationResult>;
  validateNewModules(sourceDir: string): Promise<NewModuleValidationResult>;
}
```

**Example:**
```typescript
const validator = new PreBuildValidator();

// Full pre-build validation
const result = await validator.validatePreBuild({
  sourceDir: './src',
  checkExportChanges: true,
  validateNewModules: true,
  skipExternalDependencies: false
});

// Check specific export changes
const exportChanges = await validator.validateExportChanges('./src');
console.log('Changed modules:', exportChanges.changedModules);
console.log('Affected dependents:', exportChanges.affectedDependents);
```

### EnvironmentValidator

Validates environment configuration and consistency.

```typescript
interface IEnvironmentValidator {
  validateEnvironment(options?: EnvironmentValidationOptions): Promise<EnvironmentValidationResult>;
  getConfigurationSummary(): Record<string, any>;
}
```

**Example:**
```typescript
const validator = new EnvironmentValidator();

// Validate environment for production
const result = await validator.validateEnvironment({
  environment: 'production',
  checkRequired: true,
  checkConsistency: true
});

if (result.missingVariables.length > 0) {
  console.error('Missing required variables:', result.missingVariables);
}
```

## Common Validation Scenarios

### Scenario 1: Pre-commit Validation

Validate code before committing to catch issues early:

```bash
# Add to your pre-commit hook
npx build-stability validate --mode pre-build --output summary
```

### Scenario 2: CI/CD Pipeline Integration

Integrate validation into your build pipeline:

```yaml
# GitHub Actions example
- name: Validate Build Stability
  run: |
    npx build-stability validate --mode full --output json > validation-report.json
    
- name: Upload Validation Report
  uses: actions/upload-artifact@v3
  with:
    name: validation-report
    path: validation-report.json
```

### Scenario 3: Development Workflow

Monitor build stability during development:

```bash
# Watch for changes and validate continuously
npx build-stability validate --mode continuous --verbose
```

### Scenario 4: Module Refactoring

When refactoring modules, validate export changes:

```typescript
const validator = new PreBuildValidator();

// Before making changes
const beforeChanges = await validator.validateExportChanges('./src');

// After making changes
const afterChanges = await validator.validateExportChanges('./src');

// Compare results to see impact
console.log('New validation errors:', 
  afterChanges.validationErrors.length - beforeChanges.validationErrors.length
);
```

## Configuration Options

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--mode` | Validation mode: `pre-build`, `post-build`, `continuous`, `full` | `pre-build` |
| `--source-dir` | Source directory to validate | `process.cwd()` |
| `--build-command` | Build command for post-build validation | `npm run build` |
| `--output` | Output format: `text`, `json`, `summary` | `text` |
| `--verbose` | Enable verbose output | `false` |
| `--config` | Configuration file path | Auto-detected |

### Configuration File Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `sourceDir` | `string` | Source directory to validate | `./src` |
| `buildCommand` | `string` | Command to run for build monitoring | `npm run build` |
| `skipExternalDependencies` | `boolean` | Skip validation of external dependencies | `false` |
| `checkEnvironment` | `boolean` | Enable environment validation | `true` |
| `environmentMode` | `string` | Environment mode: `development`, `production`, `test` | `development` |

### Next.js Integration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `enablePreBuildValidation` | `boolean` | Run validation before build | `true` |
| `enableBuildMonitoring` | `boolean` | Monitor build process | `true` |
| `failOnValidationErrors` | `boolean` | Fail build on validation errors | `true` |
| `validationOptions` | `PreBuildValidationOptions` | Options for pre-build validation | `{}` |

## Output Formats

### Text Output (Default)

```
Pre-build Validation:
Status: ✅ Valid

Build Validation:
Status: ❌ Invalid

Errors:
  1. Missing default export in component
     File: src/components/Button.tsx:1
     Suggestion: Add 'export default Button' or use named export

Dependency Analysis:
Modules: 45
Dependencies: 123
Circular dependencies: 1

Circular Dependencies:
  1. src/utils/helper.ts → src/components/Form.tsx → src/utils/helper.ts
```

### JSON Output

```json
{
  "title": "Pre-build Validation",
  "result": {
    "isValid": false,
    "errors": [
      {
        "type": "MISSING_EXPORT",
        "file": "src/components/Button.tsx",
        "line": 1,
        "message": "Missing default export in component",
        "suggestion": "Add 'export default Button' or use named export"
      }
    ],
    "warnings": [],
    "metrics": {
      "validatedFiles": 45,
      "validationTime": 1250
    }
  }
}
```

### Summary Output

```
✅ Environment Validation: Valid
❌ Pre-build Validation: 2 errors, 1 warning
✅ Build Validation: Valid
⚠️  Dependency Analysis: 1 circular dependency
```

## Best Practices

1. **Run pre-build validation** before every build to catch issues early
2. **Use configuration files** to maintain consistent validation settings across team
3. **Integrate with CI/CD** to prevent broken builds from reaching production
4. **Monitor continuously** during active development to catch issues immediately
5. **Review dependency graphs** regularly to identify architectural improvements
6. **Validate environment** configuration in different deployment environments

## Performance Considerations

- **Incremental validation**: Only validates changed files when possible
- **Parallel processing**: Analyzes multiple modules concurrently
- **Caching**: Caches validation results to improve subsequent runs
- **Selective validation**: Use configuration options to skip unnecessary checks

## Integration Examples

See the `examples/` directory for complete integration examples:
- Basic Next.js integration
- CI/CD pipeline setup
- Pre-commit hook configuration
- Custom validation workflows