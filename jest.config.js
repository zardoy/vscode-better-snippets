//@ts-check

/** @type{import('@jest/types').Config.InitialOptions} */
const config = {
    rootDir: 'test/unit',
    testPathIgnorePatterns: ['/build/', '/fixtures/'],
    transform: {
        '^.+\\.tsx?$': 'esbuild-runner/jest',
    },
}

module.exports = config
