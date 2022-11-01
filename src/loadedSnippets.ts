import { getExtensionSetting } from 'vscode-framework'
import { builtinSnippets } from './builtinSnippets'
import { CustomSnippet, mergeSnippetWithDefaults } from './snippet'
import { getConfigValueFromAllScopes } from './util'

export const getAllLoadedSnippets = () => {
    const disableBuiltinSnippets = getConfigValueFromAllScopes('experimental.disableBuiltinSnippets')

    const snippetsToLoad = [
        ...getConfigValueFromAllScopes('customSnippets'),
        ...(getExtensionSetting('enableBuiltinSnippets') ? builtinSnippets.filter(snippet => !disableBuiltinSnippets.includes(snippet.name as any)) : []),
    ]

    const snippetsByLanguage: { [language: string]: CustomSnippet[] } = {}
    for (const snippetToLoad of snippetsToLoad) {
        const customSnippet = mergeSnippetWithDefaults(snippetToLoad)
        for (const language of customSnippet.when.languages) {
            ;(snippetsByLanguage[language] ??= []).push(mergeSnippetWithDefaults(customSnippet))
        }
    }

    return snippetsByLanguage
}
