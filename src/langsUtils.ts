import * as vscode from 'vscode'

// eslint-disable-next-line import/no-extraneous-dependencies
import { ManifestType } from 'vscode-manifest'

const generalLangsToIgnore = new Set(['ignore'])

export const getAllLangsExtensions = () => {
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

interface ContributedLangInfo {
    sourceExtension?: {
        id: string
        title: string
    }
    extensions: string[]
    aliases: string[]
}

export const getContributedLangInfo = (requestedLang: string): ContributedLangInfo | undefined => {
    let langExtMap: ContributedLangInfo | undefined
    for (const { packageJSON } of vscode.extensions.all) {
        const manifest = packageJSON as ManifestType
        for (const { id, aliases = [], extensions = [] } of manifest.contributes?.languages ?? []) {
            const langs = [id, ...aliases]
            if (!langs.includes(requestedLang)) continue
            langExtMap ??= {
                aliases: [],
                extensions: [],
            }
            if (id === requestedLang && !generalLangsToIgnore.has(id)) {
                langExtMap.sourceExtension = {
                    id: `${manifest.publisher}.${manifest.name}`,
                    title: manifest.displayName,
                }
            }

            langExtMap.aliases.push(...langs)
            langExtMap.extensions.push(...extensions)
        }
    }

    if (langExtMap) langExtMap.aliases = [...new Set(langExtMap.aliases.filter(alias => alias !== requestedLang))]

    return langExtMap
}
