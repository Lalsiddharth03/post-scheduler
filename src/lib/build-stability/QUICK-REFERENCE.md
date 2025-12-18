# Build Stability Quick Reference

## Essential Commands

```bash
# Quick health check
npx build-stability check

# Pre-build validation
npx build-stability validate --mode pre-build

# Full validation (pre-build + build monitoring)
npx build-stability validate --mode full

# Continuous monitoring
npx build-stability validate --mode continuous

# JSON output for CI/CD
npx build-stability validate --output json
```

## Common Error Fixes

| Error | Quick Fix |
|-------|-----------|
| Missing default export | Add `export default ComponentName` |
| Circular dependency | Extract shared code to separate module |
| Module not found | Check file path and extension |
| Missing env var | Add to `.env.local` file |
| Unused import | Remove or use ESLint `--fix` |

## Configuration Template

```json
{
  "sourceDir": "./src",
  "buildCommand": "npm run build",
  "skipExternalDependencies": false,
  "checkEnvironment": true,
  "environmentMode": "development"
}
```

## Next.js Integration

```typescript
// next.config.ts
import { withBuildStability } from '@/lib/build-stability/next-integration';

export default withBuildStability(nextConfig, {
  enablePreBuildValidation: true,
  failOnValidationErrors: true
});
```

## Package.json Scripts

```json
{
  "scripts": {
    "validate": "build-stability check",
    "validate:full": "build-stability validate --mode full",
    "prebuild": "build-stability check"
  }
}
```

## Troubleshooting Steps

1. Run `npx build-stability check`
2. Check error type in output
3. Apply specific fix from TROUBLESHOOTING.md
4. Re-run validation to verify fix

## Documentation Files

- `README.md` - Complete usage guide
- `TROUBLESHOOTING.md` - Error diagnosis and solutions
- `examples/` - Configuration examples
- `QUICK-REFERENCE.md` - This file