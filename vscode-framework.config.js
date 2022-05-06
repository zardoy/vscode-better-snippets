//@ts-check
const { defineConfig } = require('@zardoy/vscode-utils/build/defineConfig.cjs')
const { patchPackageJson } = require('@zardoy/vscode-utils/build/patchPackageJson.cjs')

patchPackageJson({
    async patchSettings(configuration) {
        configuration['customSnippetDefaults']['properties']['type']['deprecationMessage'] = configuration['customSnippets']['items']['allOf'][1]['properties'][
            'type'
        ]['deprecationMessage'] = 'Use `iconType` instead. It will be removed in next minor release'

        configuration['customSnippets']['items']['allOf'][1]['properties']['group']['deprecationMessage'] = configuration['customSnippetDefaults'][
            'properties'
        ]['group']['deprecationMessage'] = 'Use `description` instead. It will be removed in next minor release'

        const { defaultLanguageSupersets } = await import('@zardoy/vscode-utils/build/langs.js')
        // TODO move it from here
        configuration['languageSupersets'].default = defaultLanguageSupersets
        return configuration
    },
})

const config = defineConfig({
    development: {
        // disableExtensions: false,
    },
    // target: 'web',
    // webOpen: 'web',
    target: { desktop: true, web: true },
})

module.exports = config
