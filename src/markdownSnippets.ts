import vscode from 'vscode'

const languageFilesMaps = {
    typescript: 'ts',
    typescriptreact: 'tsx',
    javascriptreact: 'jsx',
    javascript: 'js',
    console: 'sh',
    platintext: 'txt',
    powershell: 'ps1',
    python: 'py',
}

// settings: also suggest to install @types/node if package.json has typescript
export const activate = () => {
    // vscode.languages.registerRenameProvider()

    // ```LANUGAGE suggestions
    vscode.languages.registerCompletionItemProvider(
        {
            language: 'markdown',
        },
        {
            async provideCompletionItems(document, position, _, trigger) {
                const languageCompletions: vscode.CompletionItem[] = []

                if (!document.lineAt(position.line).text.startsWith('```')) return []

                const languages = await vscode.languages.getLanguages()
                for (const language of languages) {
                    const completion = new vscode.CompletionItem(language, vscode.CompletionItemKind.File)
                    completion.detail = `.${languageFilesMaps[language] || language}`
                    languageCompletions.push(completion)
                }

                return languageCompletions
            },
        },
    )
}
