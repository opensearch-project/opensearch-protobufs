
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', './tools/proto-convert/src'],
  collectCoverageFrom: [
    'tools/proto-convert/src/**/*.ts',
    '!tools/proto-convert/src/**/*.d.ts',
    '!tools/proto-convert/src/PreProcessing.ts',
    '!tools/proto-convert/src/postprocessing/types.ts'
  ],
  testMatch: ['**/test/**/*.test.ts']
}
