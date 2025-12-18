# Build Stability Troubleshooting Guide

This guide helps you diagnose and resolve common build stability issues in your Next.js application.

## Quick Diagnostic Steps

When encountering build issues, follow these steps:

1. **Run a quick check**: `npx build-stability check`
2. **Check the error type** in the output
3. **Follow the specific troubleshooting section** below
4. **Verify the fix** by running validation again

## Common Error Types and Solutions

### 1. Missing Export Errors

#### Error Message
```
❌ Missing default export in component
File: src/components/Button.tsx:1
Suggestion: Add 'export default Button' or use named export
```

#### Cause
A module is being imported with default import syntax, but the target module doesn't export a default.

#### Solutions

**Option A: Add default export to the target module**
```typescript
// src/components/Button.tsx
const Button = () => <button>Click me</button>;

// Add this line:
export default Button;
```

**Option B: Change to named import**
```typescript
// Instead of:
import Button from './components/Button';

// Use:
import { Button } from './components/Button';
```

**Option C: Export as default in target module**
```typescript
// src/components/Button.tsx
export const Button = () => <button>Click me</button>;

// Add default export:
export default Button;
```

#### Prevention
- Use consistent export patterns across your codebase
- Consider using ESLint rules to enforce export consistency

---

### 2. Circular Dependency Errors

#### Error Message
```
⚠️ Circular dependency detected:
src/utils/helper.ts → src/components/Form.tsx → src/utils/helper.ts
```

#### Cause
Two or more modules depend on each other, creating a circular reference.

#### Solutions

**Option A: Extract shared dependencies**
```typescript
// Create src/shared/constants.ts
export const FORM_CONSTANTS = {
  MAX_LENGTH: 100,
  VALIDATION_RULES: { /* ... */ }
};

// src/utils/helper.ts
import { FORM_CONSTANTS } from '../shared/constants';

// src/components/Form.tsx  
import { FORM_CONSTANTS } from '../shared/constants';
```

**Option B: Restructure imports**
```typescript
// Instead of mutual imports, use a one-way dependency:

// src/utils/helper.ts (no imports from components)
export const validateForm = (data: any) => { /* ... */ };

// src/components/Form.tsx
import { validateForm } from '../utils/helper';
```

**Option C: Use dependency injection**
```typescript
// src/components/Form.tsx
interface FormProps {
  validator?: (data: any) => boolean;
}

export const Form = ({ validator = defaultValidator }: FormProps) => {
  // Use validator prop instead of direct import
};
```

#### Prevention
- Design clear module hierarchies
- Use architectural patterns like layers or clean architecture
- Regular dependency analysis: `npx build-stability validate --mode pre-build`

---

### 3. Module Resolution Errors

#### Error Message
```
❌ Cannot resolve module './components/Button'
File: src/pages/index.tsx:3
Suggestion: Check file path and extension
```

#### Cause
Import path doesn't match the actual file location or name.

#### Solutions

**Check common issues:**

1. **File extension missing or incorrect**
```typescript
// ❌ Wrong:
import Button from './components/Button';

// ✅ Correct:
import Button from './components/Button.tsx';
// or configure path mapping in tsconfig.json
```

2. **Case sensitivity issues**
```typescript
// ❌ Wrong (if file is Button.tsx):
import Button from './components/button';

// ✅ Correct:
import Button from './components/Button';
```

3. **Incorrect relative path**
```typescript
// ❌ Wrong:
import Button from './Button'; // when Button is in subdirectory

// ✅ Correct:
import Button from './components/Button';
```

4. **Missing index file**
```typescript
// If importing from directory:
import { Button } from './components';

// Ensure src/components/index.ts exists:
export { Button } from './Button';
```

#### Diagnostic Commands
```bash
# Check if file exists
ls -la src/components/Button.tsx

# Check current directory structure
find src -name "*Button*" -type f
```

---

### 4. Environment Variable Errors

#### Error Message
```
❌ Missing required environment variable: DATABASE_URL
Suggestion: Add DATABASE_URL to your .env file
```

#### Cause
Required environment variables are not defined or not accessible.

#### Solutions

1. **Add missing variables to .env files**
```bash
# .env.local
DATABASE_URL=postgresql://localhost:5432/mydb
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

2. **Check environment-specific files**
```bash
# Development
.env.local

# Production  
.env.production

# Test
.env.test
```

3. **Verify variable naming**
```typescript
// ❌ Wrong:
const apiUrl = process.env.API_URL;

// ✅ Correct (for client-side):
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

4. **Check variable loading**
```typescript
// Add to your component for debugging:
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing'
});
```

#### Prevention
- Use environment validation in your application startup
- Document required environment variables in README
- Use TypeScript for environment variable types

---

### 5. Build Process Errors

#### Error Message
```
❌ Build process failed
Duration: 45000ms
Error: Command failed with exit code 1
```

#### Cause
The underlying Next.js build process encountered errors.

#### Diagnostic Steps

1. **Run build directly to see detailed errors**
```bash
npm run build
# or
yarn build
```

2. **Check for TypeScript errors**
```bash
npx tsc --noEmit
```

3. **Check for ESLint errors**
```bash
npx eslint src --ext .ts,.tsx
```

4. **Clear build cache**
```bash
rm -rf .next
npm run build
```

#### Common Build Issues

**Memory issues:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Dependency conflicts:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**TypeScript configuration:**
```json
// tsconfig.json - ensure proper configuration
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

---

### 6. Unused Import Warnings

#### Warning Message
```
⚠️ Unused import detected: 'useState' in src/components/Button.tsx:1
```

#### Cause
Imports that are declared but not used in the module.

#### Solutions

1. **Remove unused imports**
```typescript
// ❌ Before:
import React, { useState, useEffect } from 'react';

const Button = () => <button>Click</button>;

// ✅ After:
import React from 'react';

const Button = () => <button>Click</button>;
```

2. **Use ESLint auto-fix**
```bash
npx eslint src --ext .ts,.tsx --fix
```

3. **Configure IDE to remove unused imports automatically**
```json
// VS Code settings.json
{
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

---

## Advanced Troubleshooting

### Debugging Validation Process

1. **Enable verbose output**
```bash
npx build-stability validate --verbose
```

2. **Use JSON output for detailed analysis**
```bash
npx build-stability validate --output json > validation-report.json
```

3. **Check specific validation components**
```typescript
import { BuildValidator } from '@/lib/build-stability';

const validator = new BuildValidator();
const result = await validator.validateBuild('./src');

console.log('Detailed validation result:', JSON.stringify(result, null, 2));
```

### Performance Issues

If validation is slow:

1. **Skip external dependencies**
```json
{
  "skipExternalDependencies": true
}
```

2. **Validate specific directories**
```bash
npx build-stability validate --source-dir ./src/components
```

3. **Use incremental validation**
```bash
# Only validate changed files (if supported)
npx build-stability validate --incremental
```

### Integration Issues

#### Next.js Integration Not Working

1. **Check Next.js configuration**
```typescript
// Ensure proper import
import { withBuildStability } from '@/lib/build-stability/next-integration';

// Check configuration object
const config = withBuildStability(nextConfig, {
  enablePreBuildValidation: true,
  enableBuildMonitoring: true
});

console.log('Build stability config:', config);
```

2. **Verify build hooks are running**
```bash
# Check if validation runs during build
npm run build 2>&1 | grep -i "build stability"
```

#### CLI Not Found

1. **Check installation**
```bash
# Verify CLI is accessible
which build-stability
npx build-stability --version
```

2. **Check package.json scripts**
```json
{
  "scripts": {
    "validate": "npx build-stability validate"
  }
}
```

## Error Reference

### Error Codes and Meanings

| Error Type | Code | Meaning | Action |
|------------|------|---------|--------|
| `MISSING_EXPORT` | E001 | Import references non-existent export | Add export or fix import |
| `CIRCULAR_DEPENDENCY` | E002 | Circular dependency detected | Restructure dependencies |
| `INVALID_IMPORT` | E003 | Import syntax or path is invalid | Fix import statement |
| `MODULE_NOT_FOUND` | E004 | Cannot resolve module path | Check file path and name |
| `MISSING_ENV_VAR` | E005 | Required environment variable missing | Add to .env file |
| `BUILD_FAILED` | E006 | Build process failed | Check build logs |
| `TYPE_ERROR` | E007 | TypeScript compilation error | Fix type issues |

### Warning Codes

| Warning Type | Code | Meaning | Action |
|--------------|------|---------|--------|
| `UNUSED_IMPORT` | W001 | Import declared but not used | Remove unused import |
| `DEPRECATED_PATTERN` | W002 | Using deprecated import pattern | Update to recommended pattern |
| `PERFORMANCE_ISSUE` | W003 | Potential performance impact | Consider optimization |

## Getting Help

### Diagnostic Information

When reporting issues, include:

1. **Validation output**
```bash
npx build-stability validate --verbose --output json > debug-info.json
```

2. **Environment information**
```bash
node --version
npm --version
cat package.json | grep -A 5 -B 5 "dependencies"
```

3. **Project structure**
```bash
find src -type f -name "*.ts" -o -name "*.tsx" | head -20
```

### Common Solutions Checklist

- [ ] Run `npm install` to ensure dependencies are installed
- [ ] Clear build cache: `rm -rf .next`
- [ ] Check file paths and extensions
- [ ] Verify environment variables are set
- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Check for circular dependencies
- [ ] Verify export/import consistency
- [ ] Update configuration files
- [ ] Check Next.js integration setup

### Still Having Issues?

1. Check the project's issue tracker
2. Review the configuration examples in `examples/`
3. Enable verbose logging for detailed diagnostics
4. Create a minimal reproduction case
5. Check for known compatibility issues with your Next.js version