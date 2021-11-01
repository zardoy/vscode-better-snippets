import vscode from 'vscode'
import { getExtensionSetting } from 'vscode-framework'

export const registerBuitinSnippets = () => {
    // TODO unregister with setting
    if (!getExtensionSetting('builtinSnippets')) return
    // postfix
    vscode.languages.registerCompletionItemProvider(
        {
            language: 'typescript',
        },
        {
            provideCompletionItems(document, position, token, context) {
                // LINE END Snippets
                const line = document.lineAt(position)
                if (line.range.end.character !== position.character) return
                const lineText = line.text
                const completions: vscode.CompletionItem[] = []
                if (lineText.includes('||') || lineText.includes('&&') || (lineText.includes('==') && lineText.endsWith('.if'))) {
                    const startPos = new vscode.Position(position.line, line.firstNonWhitespaceCharacterIndex)
                    const snippetLabel = 'if'
                    const completion = new vscode.CompletionItem({ label: snippetLabel, description: 'Better Snippets Postfix' })
                    // completion.range = new vscode.Range(position.translate(0, -1), line.range.end)
                    completion.insertText = ') '
                    completion.additionalTextEdits = [
                        { range: new vscode.Range(startPos, startPos), newText: 'if (' },
                        {
                            range: new vscode.Range(position.translate(0, -(snippetLabel.length + 1)), position.translate(0, -snippetLabel.length)),
                            newText: '',
                        },
                    ]
                    completions.push(completion)
                }

                return completions
            },
        },
    )

    // export
    vscode.languages.registerCompletionItemProvider('typescript', {
        provideCompletionItems(document, position) {
            const suggestions: vscode.CompletionItem[] = []
            // TODO-low move it to description
            // er is much faster to type rather than ec
            const constCompletion = new vscode.CompletionItem('er', vscode.CompletionItemKind.Event)
            constCompletion.insertText = new vscode.SnippetString('export const $1 = ')
            suggestions.push(constCompletion)

            // em = Export Method
            const methodCompletion = new vscode.CompletionItem('em', vscode.CompletionItemKind.Event)
            methodCompletion.insertText = new vscode.SnippetString('export const ${1:method} = ($2) => ')
            // methodCompletion.command = {
            //     command: 'better-snippets.completionInsert',
            //     title: '',
            //     arguments: ['method'],
            // }
            suggestions.push(methodCompletion)
            // ef Export From
            const reexportSuggestion = new vscode.CompletionItem('ef', vscode.CompletionItemKind.Event)
            reexportSuggestion.insertText = new vscode.SnippetString('export { $2 } from "$1"')
            suggestions.push(reexportSuggestion)

            const lineText = document.lineAt(position.line).text
            // disallow whitespace, which means that only on-top exports are SUGGESTED!!!
            const showSuggestions = lineText === '' || suggestions.some(({ label }) => (label as string).startsWith(lineText))
            if (!showSuggestions) return []

            return suggestions
        },
    })
}
