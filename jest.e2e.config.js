// see https://github.com/microsoft/vscode-test/issues/37#issuecomment-700167820
const path = require('path')

module.exports = {
    moduleFileExtensions: ['js'],
    testMatch: ['<rootDir>/testsOut/suite/**.test.js'],
    testEnvironment: './test/integration/vscode-environment.js',
    verbose: true,
    moduleNameMapper: {
        vscode: path.join(__dirname, 'test/integration/vscode.js'),
    },
}
