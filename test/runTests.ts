import { runTests } from '@vscode/test-electron'
import { join } from 'path'

async function main() {
    try {
        await runTests({
            // version: 'insiders',
            extensionDevelopmentPath: join(__dirname, '../out'),
            extensionTestsPath: join(__dirname, './index'),
            launchArgs: ['--disable-extensions'],
        })
    } catch (err) {
        console.error(err)
        console.error('Failed to run tests')
        process.exit(1)
    }
}

main()
