import * as fs from "fs";
import * as path from "path";
import { execSync } from 'child_process';
import { parsePathsConfig } from '../src/utils/helper';

type PathConfig = Record<string, { 'x-operation-group'?: string[] } | null>;

describe('parsePathsConfig', () => {
    it('should return default path when paths is undefined', () => {
        const result = parsePathsConfig(undefined);

        expect(result.size).toBe(1);
        expect(result.get('/_search')).toBeNull();
    });

    it('should parse path with no operation groups as null', () => {
        const config: PathConfig = {
            '/pets': null
        };

        const result = parsePathsConfig(config);

        expect(result.get('/pets')).toBeNull();
    });

    it('should parse path with empty operation groups as null', () => {
        const config: PathConfig = {
            '/pets': { 'x-operation-group': [] }
        };

        const result = parsePathsConfig(config);

        expect(result.get('/pets')).toBeNull();
    });

    it('should parse path with single operation group', () => {
        const config: PathConfig = {
            '/pets': { 'x-operation-group': ['pets.list'] }
        };

        const result = parsePathsConfig(config);

        expect(result.get('/pets')).toEqual(new Set(['pets.list']));
    });

    it('should parse path with multiple operation groups', () => {
        const config: PathConfig = {
            '/{index}/_doc/{id}': {
                'x-operation-group': ['delete', 'get', 'index']
            }
        };

        const result = parsePathsConfig(config);

        const groups = result.get('/{index}/_doc/{id}');
        expect(groups).toEqual(new Set(['delete', 'get', 'index']));
        expect(groups?.size).toBe(3);
    });

    it('should parse multiple paths with mixed configurations', () => {
        const config: PathConfig = {
            '/{index}/_bulk': { 'x-operation-group': ['bulk'] },
            '/{index}/_search': { 'x-operation-group': ['search'] },
            '/_cat/health': null
        };

        const result = parsePathsConfig(config);

        expect(result.size).toBe(3);
        expect(result.get('/{index}/_bulk')).toEqual(new Set(['bulk']));
        expect(result.get('/{index}/_search')).toEqual(new Set(['search']));
        expect(result.get('/_cat/health')).toBeNull();
    });

    it('should handle path with undefined x-operation-group', () => {
        const config: PathConfig = {
            '/pets': {}
        };

        const result = parsePathsConfig(config);

        expect(result.get('/pets')).toBeNull();
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

        // Run CLI using ts-node - paths come from spec-filter.yaml config
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
