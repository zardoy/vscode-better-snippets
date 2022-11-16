//@ts-check
const { defineConfig } = require('@zardoy/vscode-utils/build/defineConfig.cjs')
const { patchPackageJson } = require('@zardoy/vscode-utils/build/patchPackageJson.cjs')
const { snippetLocation } = require('./src/constants')

patchPackageJson({
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
    extendPropsGenerators: [
        async () => {
            const { defaultLanguageSupersets } = await import('@zardoy/vscode-utils/build/langs.js')

            return {
                contributes: {
                    configuration: {
                        properties: {
                            'betterSnippets.languageSupersets': {
                                default: defaultLanguageSupersets,
                            },
                        },
                    },
                },
            }
        },
        ({ generatedManifest }) => {
            // @ts-ignore
            const { properties } = generatedManifest.contributes.configuration
            for (const [i, key] of ['betterSnippets.customSnippets', 'betterSnippets.typingSnippets'].entries()) {
                const snippetsProp = properties[key].items
                const requiredProps = [[i ? 'sequence' : 'name', 'body'], ['extends']]
                snippetsProp.anyOf = requiredProps.map(props => ({ required: props }))
                snippetsProp.required = undefined
                snippetsProp.additionalProperties = false
                snippetsProp.patternProperties = {
                    '^\\$': {},
                }
            }

            properties['betterSnippets.extendsGroups'].additionalProperties.additionalProperties = false
            return {}
        },
    ],
})

module.exports = config
