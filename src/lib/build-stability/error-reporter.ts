/**
 * Error Reporter component for formatted error messages with suggestions
 */

import path from 'path';
import { IErrorReporter } from './interfaces';
import { BuildError, FormattedError } from './types';

export class ErrorReporter implements IErrorReporter {
  /**
   * Report error with formatted message, context, and suggestions
   */
  reportError(error: BuildError): FormattedError {
    const formattedMessage = this.formatErrorMessage(error);
    const context = this.extractErrorContext(error);
    const suggestions = this.generateSuggestions(error);
    const documentationLinks = this.getDocumentationLinks(error);

    return {
      originalError: error,
      formattedMessage,
      context,
      suggestions,
      documentationLinks
    };
  }

  /**
   * Format error message with enhanced readability
   */
  private formatErrorMessage(error: BuildError): string {
    const location = this.formatLocation(error.file, error.line, error.column);
    const errorType = this.getErrorTypeDescription(error.type);
    
    let formattedMessage = `${errorType}: ${error.message}`;
    
    if (location) {
      formattedMessage = `${location}\n${formattedMessage}`;
    }

    // Add stack trace for execution errors if available
    if (error.type === 'BUILD_EXECUTION_ERROR' && error.stack) {
      formattedMessage += `\n\nStack trace:\n${error.stack}`;
    }

    return formattedMessage;
  }

  /**
   * Extract contextual information about the error
   */
  private extractErrorContext(error: BuildError): string {
    const contexts: string[] = [];

    // File context
    if (error.file) {
      const fileName = path.basename(error.file);
      const directory = path.dirname(error.file);
      contexts.push(`File: ${fileName} (in ${directory})`);
    }

    // Location context
    if (error.line > 0) {
      contexts.push(`Line: ${error.line}`);
      if (error.column > 0) {
        contexts.push(`Column: ${error.column}`);
      }
    }

    // Error type context
    contexts.push(`Error Type: ${error.type}`);

    // Build phase context
    const buildPhase = this.getBuildPhase(error.type);
    if (buildPhase) {
      contexts.push(`Build Phase: ${buildPhase}`);
    }

    return contexts.join(' | ');
  }

  /**
   * Generate helpful suggestions based on error type and content
   */
  private generateSuggestions(error: BuildError): string[] {
    const suggestions: string[] = [];

    switch (error.type) {
      case 'TYPESCRIPT_ERROR':
        suggestions.push('Check TypeScript syntax and type definitions');
        suggestions.push('Verify all imports are correctly typed');
        if (error.message.includes('Cannot find module')) {
          suggestions.push('Ensure the imported module exists and is properly exported');
          suggestions.push('Check if the module path is correct (relative vs absolute)');
        }
        if (error.message.includes('has no default export')) {
          suggestions.push('Use named import syntax: import { name } from "module"');
          suggestions.push('Or add a default export to the target module');
        }
        break;

      case 'NEXTJS_ERROR':
        suggestions.push('Review Next.js configuration and setup');
        suggestions.push('Check if all required dependencies are installed');
        if (error.message.includes('Module not found')) {
          suggestions.push('Verify the module is installed: npm install <module-name>');
          suggestions.push('Check if the import path is correct');
        }
        break;

      case 'MODULE_NOT_FOUND':
        suggestions.push('Install the missing module: npm install <module-name>');
        suggestions.push('Check if the import path is correct');
        suggestions.push('Verify the module exists in node_modules');
        if (error.file) {
          suggestions.push(`Review imports in ${path.basename(error.file)}`);
        }
        break;

      case 'BUILD_EXECUTION_ERROR':
        suggestions.push('Check if Node.js and npm are properly installed');
        suggestions.push('Verify build command is correct');
        suggestions.push('Clear node_modules and reinstall: rm -rf node_modules && npm install');
        suggestions.push('Check for permission issues or disk space');
        break;

      default:
        suggestions.push('Review the error message for specific details');
        suggestions.push('Check the build logs for additional context');
        break;
    }

    // Add general suggestions
    suggestions.push('Run the build command again to see if the error persists');
    
    if (error.file) {
      suggestions.push(`Review the code around line ${error.line} in ${path.basename(error.file)}`);
    }

    return suggestions;
  }

  /**
   * Get relevant documentation links based on error type
   */
  private getDocumentationLinks(error: BuildError): string[] {
    const links: string[] = [];

    switch (error.type) {
      case 'TYPESCRIPT_ERROR':
        links.push('https://www.typescriptlang.org/docs/handbook/modules.html');
        links.push('https://www.typescriptlang.org/docs/handbook/module-resolution.html');
        break;

      case 'NEXTJS_ERROR':
        links.push('https://nextjs.org/docs/messages');
        links.push('https://nextjs.org/docs/getting-started');
        break;

      case 'MODULE_NOT_FOUND':
        links.push('https://nodejs.org/api/modules.html');
        links.push('https://docs.npmjs.com/cli/v8/commands/npm-install');
        break;

      case 'BUILD_EXECUTION_ERROR':
        links.push('https://nextjs.org/docs/deployment');
        links.push('https://nodejs.org/en/docs/guides/debugging-getting-started/');
        break;
    }

    // Add general Next.js troubleshooting
    links.push('https://nextjs.org/docs/messages');

    return links;
  }

  /**
   * Format file location for display
   */
  private formatLocation(file: string, line: number, column: number): string {
    if (!file) return '';

    let location = file;
    
    if (line > 0) {
      location += `:${line}`;
      if (column > 0) {
        location += `:${column}`;
      }
    }

    return location;
  }

  /**
   * Get human-readable error type description
   */
  private getErrorTypeDescription(type: string): string {
    switch (type) {
      case 'TYPESCRIPT_ERROR':
        return 'TypeScript Compilation Error';
      case 'NEXTJS_ERROR':
        return 'Next.js Build Error';
      case 'MODULE_NOT_FOUND':
        return 'Module Resolution Error';
      case 'BUILD_EXECUTION_ERROR':
        return 'Build Execution Error';
      default:
        return 'Build Error';
    }
  }

  /**
   * Determine build phase based on error type
   */
  private getBuildPhase(type: string): string | null {
    switch (type) {
      case 'TYPESCRIPT_ERROR':
        return 'Type Checking';
      case 'NEXTJS_ERROR':
        return 'Next.js Compilation';
      case 'MODULE_NOT_FOUND':
        return 'Module Resolution';
      case 'BUILD_EXECUTION_ERROR':
        return 'Build Execution';
      default:
        return null;
    }
  }
}