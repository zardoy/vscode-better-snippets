import vscode from 'vscode'
import { extensionCtx, getExtensionSetting } from 'vscode-framework'

export const activate = () => {
    const disposables: vscode.Disposable[] = []

    const unregisterSnippets = () => {
        for (const disposable of disposables) disposable.dispose()
    }

    const registerSnippets = () => {
        const customSnippets = getExtensionSetting('customSnippets')
        const languageSnippets: Record<string, Array<{ body: string; locations?: string[]; pathRegex?: string }>> = {}
        for (const [label, config] of Object.entries(customSnippets)) {
            const { body, when = {} } = config
            const { languages = ['*'], ...rest } = when
            for (const language of languages) {
                if (!languageSnippets[language]) languageSnippets[language] = []
                languageSnippets[language]!.push({ body, ...rest })
            }
        }

        for (const [language, snippets] of Object.entries(languageSnippets)) {
            const disposable = vscode.languages.registerCompletionItemProvider(language, {
                provideCompletionItems(document, position) {
                    // investigate: positionaAt, offsetAT
                    const lineText = document.lineAt(position.line)
                    for (const { body, locations, pathRegex } of snippets) {
                        // TODO ensure; relative path
                        if (pathRegex && document.uri.path.match(pathRegex)) continue
                        // if (locations)
                    }
                    console.log('Trigger!')
                    return []
                },
            })
            extensionCtx.subscriptions.push(disposable)
            disposables.push(disposable)
        }
    }

    registerSnippets()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        const snippetsChanged = affectsConfiguration('better-snippets.customSnippets')
        if (snippetsChanged) {
            console.log('Snippets updated')
            unregisterSnippets()
            registerSnippets()
        }
    })
}
