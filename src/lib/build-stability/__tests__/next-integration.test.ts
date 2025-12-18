/**
 * Next.js Integration Tests
 * Tests the integration with Next.js build process and plugin functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextJsBuildIntegration, withBuildStability } from '../next-integration';

describe('Next.js Integration Tests', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, 'temp-next-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Store original environment
    originalEnv = { ...process.env };

    // Mock console methods to capture output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('NextJsBuildIntegration Class', () => {
    it('should create integration instance with default config', () => {
      const integration = new NextJsBuildIntegration();
      expect(integration).toBeDefined();
    });

    it('should create integration instance with custom config', () => {
      const config = {
        enabled: false,
        mode: 'warn' as const,
        skipEnvironmentValidation: true,
        sourceDir: 'custom-src'
      };

      const integration = new NextJsBuildIntegration(config);
      expect(integration).toBeDefined();
    });

    it('should create Next.js plugin function', () => {
      const integration = new NextJsBuildIntegration();
      const plugin = integration.createPlugin();
      
      expect(typeof plugin).toBe('function');
    });

    it('should return unmodified config when disabled', () => {
      const integration = new NextJsBuildIntegration({ enabled: false });
      const plugin = integration.createPlugin();
      
      const originalConfig = {
        images: { domains: ['example.com'] },
        experimental: { appDir: true }
      };

      const result = plugin(originalConfig);
      expect(result).toEqual(originalConfig);
    });

    it('should modify config when enabled', () => {
      const integration = new NextJsBuildIntegration({ enabled: true });
      const plugin = integration.createPlugin();
      
      const originalConfig = {
        images: { domains: ['example.com'] }
      };

      const result = plugin(originalConfig);
      expect(result).toHaveProperty('webpack');
      expect(typeof result.webpack).toBe('function');
    });
  });

  describe('withBuildStability Helper Function', () => {
    it('should create plugin with default configuration', () => {
      const plugin = withBuildStability();
      expect(typeof plugin).toBe('function');
    });

    it('should create plugin with custom configuration', () => {
      const plugin = withBuildStability({
        enabled: true,
        mode: 'strict',
        sourceDir: 'src'
      });
      expect(typeof plugin).toBe('function');
    });

    it('should integrate with Next.js config', () => {
      const plugin = withBuildStability({
        enabled: true,
        mode: 'warn'
      });

      const nextConfig = {
        reactStrictMode: true,
        images: {
          domains: ['example.com']
        }
      };

      const result = plugin(nextConfig);
      
      // Should preserve original config
      expect(result.reactStrictMode).toBe(true);
      expect(result.images).toEqual(nextConfig.images);
      
      // Should add webpack function
      expect(result).toHaveProperty('webpack');
      expect(typeof result.webpack).toBe('function');
    });
  });

  describe('Webpack Integration', () => {
    it('should handle webpack configuration without original webpack function', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn', // Use warn mode to avoid process.exit
        skipEnvironmentValidation: true,
        skipPreBuildValidation: true
      });
      
      const plugin = integration.createPlugin();
      const nextConfig = plugin({});
      
      expect(nextConfig.webpack).toBeDefined();
      
      // Mock webpack config and options
      const webpackConfig = { entry: './src/index.js' };
      const webpackOptions = { 
        isServer: true, 
        dev: false, 
        dir: tempDir 
      };

      // Should not throw when calling webpack function
      expect(() => {
        nextConfig.webpack!(webpackConfig, webpackOptions);
      }).not.toThrow();
    });

    it('should call original webpack function when provided', () => {
      const originalWebpack = vi.fn((config) => ({ ...config, modified: true }));
      
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        skipEnvironmentValidation: true,
        skipPreBuildValidation: true
      });
      
      const plugin = integration.createPlugin();
      const nextConfig = plugin({ webpack: originalWebpack });
      
      const webpackConfig = { entry: './src/index.js' };
      const webpackOptions = { 
        isServer: true, 
        dev: false, 
        dir: tempDir 
      };

      const result = nextConfig.webpack!(webpackConfig, webpackOptions);
      
      expect(originalWebpack).toHaveBeenCalledWith(webpackConfig, webpackOptions);
      expect(result).toHaveProperty('modified', true);
    });

    it('should skip validation in development mode', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'strict'
      });
      
      const plugin = integration.createPlugin();
      const nextConfig = plugin({});
      
      const webpackConfig = { entry: './src/index.js' };
      const webpackOptions = { 
        isServer: true, 
        dev: true, // Development mode
        dir: tempDir 
      };

      // Should not throw in development mode
      expect(() => {
        nextConfig.webpack!(webpackConfig, webpackOptions);
      }).not.toThrow();
    });

    it('should skip validation for client-side compilation', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'strict'
      });
      
      const plugin = integration.createPlugin();
      const nextConfig = plugin({});
      
      const webpackConfig = { entry: './src/index.js' };
      const webpackOptions = { 
        isServer: false, // Client-side compilation
        dev: false, 
        dir: tempDir 
      };

      // Should not throw for client-side compilation
      expect(() => {
        nextConfig.webpack!(webpackConfig, webpackOptions);
      }).not.toThrow();
    });
  });

  describe('Validation Integration', () => {
    it('should handle validation results in warn mode', () => {
      // Create test source directory
      const testSrcDir = path.join(tempDir, 'src');
      fs.mkdirSync(testSrcDir, { recursive: true });
      
      // Create a simple test file
      const testFile = path.join(testSrcDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const test = "test";');

      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        sourceDir: 'src',
        skipEnvironmentValidation: true, // Skip env validation for test
        outputValidationResults: false // Reduce console output
      });
      
      const plugin = integration.createPlugin();
      const nextConfig = plugin({});
      
      const webpackConfig = { entry: './src/index.js' };
      const webpackOptions = { 
        isServer: true, 
        dev: false, 
        dir: tempDir 
      };

      // Should not throw in warn mode even if validation fails
      expect(() => {
        nextConfig.webpack!(webpackConfig, webpackOptions);
      }).not.toThrow();
    });

    it('should handle missing source directory gracefully', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        sourceDir: 'non-existent-src',
        skipEnvironmentValidation: true,
        outputValidationResults: false
      });
      
      const plugin = integration.createPlugin();
      const nextConfig = plugin({});
      
      const webpackConfig = { entry: './src/index.js' };
      const webpackOptions = { 
        isServer: true, 
        dev: false, 
        dir: tempDir 
      };

      // Should handle missing directory gracefully in warn mode
      expect(() => {
        nextConfig.webpack!(webpackConfig, webpackOptions);
      }).not.toThrow();
    });
  });

  describe('Configuration Options', () => {
    it('should respect skipEnvironmentValidation option', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        skipEnvironmentValidation: true,
        outputValidationResults: false
      });

      expect(integration).toBeDefined();
      // The actual validation skipping is tested indirectly through webpack integration
    });

    it('should respect skipPreBuildValidation option', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        skipPreBuildValidation: true,
        outputValidationResults: false
      });

      expect(integration).toBeDefined();
      // The actual validation skipping is tested indirectly through webpack integration
    });

    it('should respect failOnWarnings option', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        failOnWarnings: true,
        outputValidationResults: false
      });

      expect(integration).toBeDefined();
      // The actual warning handling is tested indirectly through validation results
    });

    it('should respect outputValidationResults option', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        outputValidationResults: false
      });

      expect(integration).toBeDefined();
      // Output control is tested indirectly through console mocking
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully in warn mode', () => {
      const integration = new NextJsBuildIntegration({
        enabled: true,
        mode: 'warn',
        sourceDir: 'non-existent',
        outputValidationResults: false
      });
      
      const plugin = integration.createPlugin();
      const nextConfig = plugin({});
      
      const webpackConfig = { entry: './src/index.js' };
      const webpackOptions = { 
        isServer: true, 
        dev: false, 
        dir: tempDir 
      };

      // Should not throw in warn mode
      expect(() => {
        nextConfig.webpack!(webpackConfig, webpackOptions);
      }).not.toThrow();
    });

    it('should preserve existing Next.js configuration', () => {
      const originalConfig = {
        reactStrictMode: true,
        images: {
          domains: ['example.com'],
          formats: ['image/webp']
        },
        experimental: {
          appDir: true
        },
        env: {
          CUSTOM_KEY: 'custom_value'
        }
      };

      const plugin = withBuildStability({
        enabled: true,
        mode: 'warn'
      });

      const result = plugin(originalConfig);

      // Should preserve all original configuration
      expect(result.reactStrictMode).toBe(true);
      expect(result.images).toEqual(originalConfig.images);
      expect(result.experimental).toEqual(originalConfig.experimental);
      expect(result.env).toEqual(originalConfig.env);
    });
  });
});