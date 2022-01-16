import { ContributesConfigurationType, ManifestType } from 'vscode-manifest'
import { modifyPackageJsonFile } from 'modify-json-file'

await modifyPackageJsonFile({ dir: 'out' }, pkgUntyped => {
    const pkg = pkgUntyped as ManifestType
    for (const [, property] of Object.entries((pkg.contributes.configuration as ContributesConfigurationType).properties)) {
        if (property.description) {
            property.markdownDescription = property.description
            delete property.description
        }
        if (property.deprecationMessage) {
            property.markdownDeprecationMessage = property.deprecationMessage
            delete property.deprecationMessage
        }
        if (property.enumDescriptions) {
            property.markdownEnumDescriptions = property.enumDescriptions
            delete property.enumDescriptions
        }
    }
    return pkg
})
