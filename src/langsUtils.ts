import * as vscode from 'vscode'

// eslint-disable-next-line import/no-extraneous-dependencies
import { ManifestType } from 'vscode-manifest'

export const getAllLangsExtensions = () => {
    const generalLangsToIgnore = new Set(['ignore'])

    const langExtMap: Record<string, string> = {}
    for (const { packageJSON } of vscode.extensions.all) {
        const manifest = packageJSON as ManifestType
        for (const { id, aliases = [], extensions = [] } of manifest.contributes?.languages ?? []) {
            if (extensions.length === 0) continue
            for (const lang of [id, ...aliases]) {
                if (generalLangsToIgnore.has(lang)) continue
                langExtMap[lang] = extensions[0]!
            }
        }
    }

    return langExtMap
}
