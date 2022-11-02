//@ts-check
const { defineConfig } = require('@zardoy/vscode-utils/build/defineConfig.cjs')
const { patchPackageJson } = require('@zardoy/vscode-utils/build/patchPackageJson.cjs')
const { snippetLocation } = require('./src/configurationType')

patchPackageJson({
    async patchSettings(configuration) {
        const { defaultLanguageSupersets } = await import('@zardoy/vscode-utils/build/langs.js')
        // TODO move it from here
        configuration['languageSupersets'].default = defaultLanguageSupersets
        return configuration
    },
    rawPatchManifest(manifest) {
        return JSON.parse(
            JSON.stringify(manifest).replaceAll(
                '"replace-locations-marker"',
                `{"pattern": "^${snippetLocation.join('|')}|${snippetLocation.map(x => `!${x}`).join('|')}$"}`,
            ),
        )
    },
})

const config = defineConfig({
    esbuild: {
        keepNames: true,
    },
    development: {
        disableExtensions: false,
    },
    // target: 'web',
    // webOpen: 'web',
    target: { desktop: true, web: true },
})

module.exports = config
