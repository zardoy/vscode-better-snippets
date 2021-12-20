import Mocha from 'mocha'
import glob from 'glob'
import { join } from 'path'

export const run = () => {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
    })
    const testsRoot = join(__dirname, './suite')
    new Promise<void>(resolve => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) throw err

            files.forEach(file => mocha.addFile(join(testsRoot, file)))

            mocha.run(failures => {
                if (failures > 0) {
                    throw new Error(`${failures} tests failed.`)
                } else {
                    resolve()
                }
            })
        })
    })
}
