import vscode from 'vscode'
import { extensionCtx, getExtensionSetting } from 'vscode-framework'
import { registerBuitinSnippets } from './buitinSnippets'

export const activate = () => {
    const disposables: vscode.Disposable[] = []
    const unregisterSnippets = () => {
        for (const disposable of disposables) disposable.dispose()
    }

    // const registerSnippets = () => {
    //     const customSnippets = getExtensionSetting('customSnippets')
    //     const languageSnippets: Record<string, Array<{ body: string; locations?: string[]; pathRegex?: string }>> = {}
    //     for (const [label, config] of Object.entries(customSnippets)) {
    //         const { body, when = {} } = config
    //         const { languages = ['*'], ...rest } = when
    //         for (const language of languages) {
    //             if (!languageSnippets[language]) languageSnippets[language] = []
    //             languageSnippets[language]!.push({ body, ...rest })
    //         }
    //     }

    //     for (const [language, snippets] of Object.entries(languageSnippets)) {
    //         const disposable = vscode.languages.registerCompletionItemProvider(language, {
    //             provideCompletionItems(document, position) {
    //                 // investigate: positionaAt, offsetAT
    //                 const currentLine = document.lineAt(position.line)
    //                 // TODO ensure; relative path
    //                 const completions: vscode.CompletionItem[] = []

    //                 const addCompletion = (prefix: string, body: string) => {
    //                     // add special handling of .
    //                     const completion = new vscode.CompletionItem({ label: prefix, description: 'Better Snippet' }, vscode.CompletionItemKind.Event)
    //                     completions.push(completion)
    //                 }

    //                 for (const { body, locations, pathRegex } of snippets) {
    //                     // eslint-disable-next-line zardoy-config/unicorn/prefer-regexp-test
    //                     if (pathRegex && (!document.uri?.path || !document.uri.path.match(pathRegex))) continue
    //                     if (locations) {
    //                         for (const location of locations) {
    //                             if (location === 'fileStart' && position.line !== 0) {
    //                                 if (position.character === 0) addCompletion()
    //                             }
    //                             if (location === 'topLineStart') {
    //                                 // TODO filter mode: starts or include
    //                                 if (currentLine)
    //                                     const showIt = currentLine.text === '' || suggestions.some(({ label }) => (label as string).startsWith(currentLine))
    //                             }
    //                         }
    //                     }
    //                 }

    //                 return completions
    //             },
    //         })
    //         extensionCtx.subscriptions.push(disposable)
    //         disposables.push(disposable)
    //     }
    // }

    // registerSnippets()
    // vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
    //     const snippetsChanged = affectsConfiguration('better-snippets.customSnippets')
    //     if (snippetsChanged) {
    //         console.log('Snippets updated')
    //         unregisterSnippets()
    //         registerSnippets()
    //     }
    // })

    registerBuitinSnippets()
}
