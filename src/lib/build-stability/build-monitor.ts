/**
 * Build Monitor component for executing and tracking Next.js build process
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { IBuildMonitor } from './interfaces';
import { BuildResult, BuildError, BuildWarning, BuildArtifact } from './types';

export class BuildMonitor implements IBuildMonitor {
  private buildStartTime: number = 0;
  private buildErrors: BuildError[] = [];
  private buildWarnings: BuildWarning[] = [];

  /**
   * Monitor Next.js build process with enhanced logging and error capture
   */
  async monitorBuild(buildCommand: string): Promise<BuildResult> {
    this.buildStartTime = Date.now();
    this.buildErrors = [];
    this.buildWarnings = [];

    try {
      const { success, output } = await this.executeBuildCommand(buildCommand);
      const duration = Date.now() - this.buildStartTime;
      
      // Parse build output for errors and warnings
      this.parseBuildOutput(output);
      
      // Collect build artifacts if build was successful
      const artifacts = success ? await this.collectBuildArtifacts() : [];

      return {
        success,
        duration,
        errors: this.buildErrors,
        warnings: this.buildWarnings,
        artifacts
      };
    } catch (error) {
      const duration = Date.now() - this.buildStartTime;
      
      // Convert execution error to BuildError
      const buildError: BuildError = {
        type: 'BUILD_EXECUTION_ERROR',
        file: '',
        line: 0,
        column: 0,
        message: error instanceof Error ? error.message : 'Unknown build execution error',
        stack: error instanceof Error ? error.stack : undefined
      };

      return {
        success: false,
        duration,
        errors: [buildError, ...this.buildErrors],
        warnings: this.buildWarnings,
        artifacts: []
      };
    }
  }

  /**
   * Execute build command and capture output
   */
  private async executeBuildCommand(buildCommand: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve, reject) => {
      const [command, ...args] = buildCommand.split(' ');
      let output = '';
      let errorOutput = '';

      const buildProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      buildProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        // Log build progress in real-time
        console.log(`[BUILD] ${chunk.trim()}`);
      });

      buildProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        output += chunk; // Include stderr in total output for parsing
        console.error(`[BUILD ERROR] ${chunk.trim()}`);
      });

      buildProcess.on('close', (code) => {
        const success = code === 0;
        resolve({ success, output: output + errorOutput });
      });

      buildProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse build output to extract errors and warnings
   */
  private parseBuildOutput(output: string): void {
    const lines = output.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse TypeScript compilation errors
      const tsErrorMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/);
      if (tsErrorMatch) {
        const [, file, lineNum, column, message] = tsErrorMatch;
        this.buildErrors.push({
          type: 'TYPESCRIPT_ERROR',
          file: file.trim(),
          line: parseInt(lineNum, 10),
          column: parseInt(column, 10),
          message: message.trim()
        });
        continue;
      }

      // Parse Next.js build errors
      const nextErrorMatch = line.match(/^Error:\s*(.+?)(?:\s+at\s+(.+?):(\d+):(\d+))?$/);
      if (nextErrorMatch) {
        const [, message, file, lineNum, column] = nextErrorMatch;
        this.buildErrors.push({
          type: 'NEXTJS_ERROR',
          file: file || '',
          line: lineNum ? parseInt(lineNum, 10) : 0,
          column: column ? parseInt(column, 10) : 0,
          message: message.trim()
        });
        continue;
      }

      // Parse module resolution errors
      const moduleErrorMatch = line.match(/Module not found:\s*(.+?)(?:\s+in\s+(.+?))?$/);
      if (moduleErrorMatch) {
        const [, message, file] = moduleErrorMatch;
        this.buildErrors.push({
          type: 'MODULE_NOT_FOUND',
          file: file || '',
          line: 0,
          column: 0,
          message: message.trim()
        });
        continue;
      }

      // Parse warnings
      const warningMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*warning\s+(.+)$/);
      if (warningMatch) {
        const [, file, lineNum, message] = warningMatch;
        this.buildWarnings.push({
          type: 'BUILD_WARNING',
          file: file.trim(),
          line: parseInt(lineNum, 10),
          message: message.trim()
        });
        continue;
      }

      // Parse Next.js warnings
      const nextWarningMatch = line.match(/^Warning:\s*(.+?)(?:\s+in\s+(.+?))?$/);
      if (nextWarningMatch) {
        const [, message, file] = nextWarningMatch;
        this.buildWarnings.push({
          type: 'NEXTJS_WARNING',
          file: file || '',
          line: 0,
          message: message.trim()
        });
      }
    }
  }

  /**
   * Collect build artifacts from .next directory
   */
  private async collectBuildArtifacts(): Promise<BuildArtifact[]> {
    const artifacts: BuildArtifact[] = [];
    const buildDir = path.join(process.cwd(), '.next');

    try {
      await this.collectArtifactsFromDirectory(buildDir, artifacts);
    } catch (error) {
      // If we can't collect artifacts, just return empty array
      console.warn('Could not collect build artifacts:', error);
    }

    return artifacts;
  }

  /**
   * Recursively collect artifacts from directory
   */
  private async collectArtifactsFromDirectory(dir: string, artifacts: BuildArtifact[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.collectArtifactsFromDirectory(fullPath, artifacts);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          
          let type: BuildArtifact['type'] = 'other';
          if (ext === '.js') type = 'js';
          else if (ext === '.css') type = 'css';
          else if (ext === '.html') type = 'html';
          else if (ext === '.map') type = 'map';

          artifacts.push({
            path: fullPath,
            size: stats.size,
            type
          });
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Could not read directory ${dir}:`, error);
    }
  }
}