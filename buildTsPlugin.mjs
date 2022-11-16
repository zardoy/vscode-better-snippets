//@ts-check
import buildTsPlugin from '@zardoy/vscode-utils/build/buildTypescriptPlugin.js'

const watch = process.argv[2] === '--watch'

await buildTsPlugin('typescript-plugin', undefined, undefined, {
    minify: !watch,
})
