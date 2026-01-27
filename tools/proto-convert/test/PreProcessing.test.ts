import * as fs from "fs";
import * as path from "path";
import { execSync } from 'child_process';
import { parseOperationGroupsConfig } from '../src/utils/helper';

describe('parseOperationGroupsConfig', () => {
    it('should return default group when groups is undefined', () => {
        const result = parseOperationGroupsConfig(undefined);

        expect(result.size).toBe(1);
        expect(result.has('search')).toBe(true);
    });

    it('should return default group when groups is empty', () => {
        const result = parseOperationGroupsConfig([]);

        expect(result.size).toBe(1);
        expect(result.has('search')).toBe(true);
    });

    it('should parse single operation group', () => {
        const result = parseOperationGroupsConfig(['bulk']);

        expect(result.size).toBe(1);
        expect(result.has('bulk')).toBe(true);
    });

    it('should parse multiple operation groups', () => {
        const result = parseOperationGroupsConfig(['bulk', 'search', 'index']);

        expect(result.size).toBe(3);
        expect(result.has('bulk')).toBe(true);
        expect(result.has('search')).toBe(true);
        expect(result.has('index')).toBe(true);
    });
});

describe('PreProcessing CLI', () => {
    const inputPath = path.resolve(__dirname, './fixtures/spec/petstore.yaml');
    const outputPath = path.resolve(__dirname, './fixtures/spec/test-output.yaml');

    afterAll(() => {
        // Cleanup the output after test
        fs.rmSync(outputPath, { force: true });
    });

    it('should run preprocessing without error', () => {
        const cliPath = path.resolve(__dirname, '../src/PreProcessing.ts');

        // Run CLI using ts-node - operation groups come from spec-filter.yaml config
        // This is an integration test that verifies the CLI runs successfully
        expect(() => {
            execSync(
                `npx ts-node ${cliPath} --input ${inputPath} --output ${outputPath}`,
                { stdio: 'pipe' }
            );
        }).not.toThrow();

        // Verify output file was created
        expect(fs.existsSync(outputPath)).toBe(true);

        // Verify it's valid YAML with expected structure
        const output = fs.readFileSync(outputPath, 'utf-8');
        expect(output).toContain('openapi:');
        expect(output).toContain('info:');
    });
});
