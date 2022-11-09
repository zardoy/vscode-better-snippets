import { getExtensionSetting } from 'vscode-framework'
import { builtinSnippets } from './builtinSnippets'
import { CustomSnippetUnresolved } from './configurationType'
import { CustomSnippet, getAllExtensionSnippets, mergeSnippetWithDefaults } from './snippet'
import { getConfigValueFromAllScopes } from './util'

export const getAllLoadedSnippets = () => {
    const disableBuiltinSnippets = getConfigValueFromAllScopes('experimental.disableBuiltinSnippets')

    const snippetsToLoad = [
        ...(getConfigValueFromAllScopes('customSnippets') as CustomSnippetUnresolved[]),
        ...(getExtensionSetting('enableBuiltinSnippets') ? builtinSnippets.filter(snippet => !disableBuiltinSnippets.includes(snippet.name as any)) : []),
    ]

    const snippetsByLanguage: { [language: string]: CustomSnippet[] } = {}
    for (const snippetToLoad of snippetsToLoad) {
        const customSnippet = mergeSnippetWithDefaults(snippetToLoad)
        for (const language of customSnippet.when.languages) {
            ;(snippetsByLanguage[language] ??= []).push(customSnippet)
        }
    }

    for (const snippet of getAllExtensionSnippets('customSnippets')) {
        for (const language of snippet.when.languages) {
            ;(snippetsByLanguage[language] ??= []).push(snippet)
        }
    }

    return snippetsByLanguage
}
