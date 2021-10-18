import { getExtensionSetting } from 'vscode-framework'
import vscode from 'vscode'

// settings: also suggest to install @types/node if package.json has typescript
export const activate = () => {
    // onDidChange...
    vscode.languages.registerCompletionItemProvider(
        {
            language: 'markdown',
        },
        {
            provideCompletionItems(document, position, _, trigger) {
                console.log('trigger')
                const completions: vscode.CompletionItem[] = []

                const snippets = getExtensionSetting('customSnippets')

                return []
            },
        },
        '<',
    )
}
