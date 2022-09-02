import { join } from 'path'
import glob from 'glob'
import Mocha from 'mocha'

export const run = async () => {
    // can't require 'vscode' as no way to disable sandboxing https://github.com/facebook/jest/issues/8010
    // await jest.runCLI(
    //     {
    //         ci: true,
    //         colors: true,
    //         runInBand: true,
    //         $0: '',
    //         _: [],
    //         setupFilesAfterEnv: [join(__dirname, 'setup.js')],
    //     },
    //     [join(__dirname, '.')],
    // )
    const mocha = new Mocha({
        color: true,
        parallel: false,
    })
    const testsRoot = join(__dirname, './suite')
    await new Promise<void>(resolve => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) throw err

            for (const file of files) mocha.addFile(join(testsRoot, file))

            mocha.run(failures => {
                if (failures > 0) {
                    console.error(`${failures} tests failed.`)
                    setImmediate(() => {
                        process.exit(1)
                    })
                } else {
                    resolve()
                }
            })
        })
    })
}
