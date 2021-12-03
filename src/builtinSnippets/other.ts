import vscode from 'vscode'
import { jsLangs } from '../util'

export const registerOtherSnippets = () => {
    // export
    vscode.languages.registerCompletionItemProvider(jsLangs, {
        provideCompletionItems(document, position) {
            const suggestions: vscode.CompletionItem[] = []
            // TODO-low move it to description
            // er is much faster to type rather than ec
            const constCompletion = new vscode.CompletionItem('er', vscode.CompletionItemKind.Event)
            constCompletion.insertText = new vscode.SnippetString('export const $1 = ')
            suggestions.push(constCompletion)
            const typeCompletion = new vscode.CompletionItem('et', vscode.CompletionItemKind.Event)
            typeCompletion.insertText = new vscode.SnippetString('export type $1 = ')
            suggestions.push(typeCompletion)

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
