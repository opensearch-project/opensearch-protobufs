import * as fs from "fs";
import * as path from "path";
import { execSync } from 'child_process';

describe('PreProcessing CLI', () => {
    const inputPath = path.resolve(__dirname, './fixtures/spec/petstore.yaml');
    const expectedPath = path.resolve(__dirname, './fixtures/spec/expected.yaml');
    const outputPath = path.resolve(__dirname, './fixtures/spec/test-output.yaml');


    afterAll(() => {
        // Cleanup the output after test
        fs.rmSync(outputPath, { force: true });
    });

    it('should produce the expected sanitized output', () => {
        const cliPath = path.resolve(__dirname, '../src/PreProcessing.ts');

        // Run CLI using ts-node
        execSync(
            `npx ts-node ${cliPath} --input ${inputPath} --output ${outputPath} --filtered_path /pets,/pets/{petId}`,
            { stdio: 'inherit' }
        );

        const actualYaml = fs.readFileSync(outputPath, 'utf-8');
        const expectedYaml = fs.readFileSync(expectedPath, 'utf-8');

        expect(actualYaml).toEqual(expectedYaml);
    });
});