import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import { defineConfig } from 'vitest/config'

ensureDirSync('./node_modules/vscode')
writeFileSync('./node_modules/vscode/package.json', JSON.stringify({}), 'utf-8')
writeFileSync('./node_modules/vscode/index.js', '', 'utf-8')

export default defineConfig({
    test: {
        dir: 'test/unit',
    },
})
