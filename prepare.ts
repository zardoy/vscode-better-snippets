import { ContributesConfigurationType, ManifestType } from 'vscode-manifest'
import { modifyPackageJsonFile } from 'modify-json-file'

await modifyPackageJsonFile({ dir: 'out' }, pkgUntyped => {
    const pkg = pkgUntyped as ManifestType
    const properties = (pkg.contributes.configuration as ContributesConfigurationType).properties
    properties['betterSnippets.customSnippetDefaults']['properties']['type']['deprecationMessage'] = properties['betterSnippets.customSnippets']['items'][
        'allOf'
    ][1]['properties']['type']['deprecationMessage'] = 'Use `iconType` instead. It will be removed in next minor release'

    properties['betterSnippets.customSnippets']['items']['allOf'][1]['properties']['group']['deprecationMessage'] = properties[
        'betterSnippets.customSnippetDefaults'
    ]['properties']['group']['deprecationMessage'] = 'Use `description` instead. It will be removed in next minor release'
    for (const [, property] of Object.entries(properties)) {
        if (property.description) {
            property.markdownDescription = property.description
            delete property.description
        }
        // if (property.deprecationMessage) {
        //     property.deprecationMessage = property.deprecationMessage
        //     delete property.deprecationMessage
        // }
        if (property.enumDescriptions) {
            property.markdownEnumDescriptions = property.enumDescriptions
            delete property.enumDescriptions
        }
    }
    return pkg
})
