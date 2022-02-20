import * as vscode from 'vscode'
import { ManifestType } from 'vscode-manifest'

export const readAllRegisteredLanguages = () => {
    // const langComments: { [lang: string]: Record<'start' | 'end', string> } = {}
    // we can't read language configurations in web
    // const extLang: { [ext: string]: string } = {}
    const langs = {} as Record<string, [string, string[]]>
    // eslint-disable-next-line unicorn/no-array-for-each
    vscode.extensions.all.forEach(({ id: extId, packageJSON: packageJSONUntyped }) => {
        const packageJson = packageJSONUntyped as ManifestType
        const { languages } = packageJson.contributes ?? {}
        if (!languages) return
        for (const item of languages) {
            if (!item.extensions) continue
            for (const ext of item.extensions) {
                const langId = item.id
                if (!langs[langId]) {
                    langs[langId] = [ext, []]
                    continue
                }

                langs[langId]![1].push(ext)
            }
        }
    })
    // override languages
    langs.jsonc = ['.jsonc', []]
    delete langs.ignore
    return langs
}
