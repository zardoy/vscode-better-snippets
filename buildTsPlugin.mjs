//@ts-check
import buildTsPlugin from '@zardoy/vscode-utils/build/buildTypescriptPlugin.js'

const prod = process.argv[2] === 'prod'

await buildTsPlugin('typescript-plugin', undefined, undefined, {
    logLevel: 'info',
    watch: !prod,
    minify: prod,
})
