import { existsSync } from 'fs';
import { join } from 'path';

describe('Project Structure', () => {
  const projectRoot = join(__dirname, '..');

  test('should have required directories', () => {
    expect(existsSync(join(projectRoot, 'src'))).toBe(true);
    expect(existsSync(join(projectRoot, 'test'))).toBe(true);
  });

  test('should have required configuration files', () => {
    expect(existsSync(join(projectRoot, 'package.json'))).toBe(true);
    expect(existsSync(join(projectRoot, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(projectRoot, '.env.example'))).toBe(true);
    expect(existsSync(join(projectRoot, '.gitignore'))).toBe(true);
    expect(existsSync(join(projectRoot, 'jest.config.js'))).toBe(true);
  });

  test('should have proper package.json structure', () => {
    const packageJson = require(join(projectRoot, 'package.json'));
    
    expect(packageJson.name).toBe('git-commit-ai');
    expect(packageJson.scripts).toHaveProperty('build');
    expect(packageJson.scripts).toHaveProperty('start');
    expect(packageJson.scripts).toHaveProperty('dev');
    expect(packageJson.scripts).toHaveProperty('test');
    
    expect(packageJson.dependencies).toHaveProperty('express');
    expect(packageJson.dependencies).toHaveProperty('cors');
    expect(packageJson.dependencies).toHaveProperty('express-rate-limit');
    expect(packageJson.dependencies).toHaveProperty('openai');
    
    expect(packageJson.devDependencies).toHaveProperty('typescript');
    expect(packageJson.devDependencies).toHaveProperty('jest');
    expect(packageJson.devDependencies).toHaveProperty('ts-jest');
  });
});