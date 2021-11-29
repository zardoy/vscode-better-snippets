import vscode from 'vscode'
import { getExtensionSetting } from 'vscode-framework'

export const registerBuitinSnippets = () => {
    const builtinSnippets = getExtensionSetting('enableBuiltinSnippets')
    // TODO unregister with setting
    if (!builtinSnippets) return

    if (builtinSnippets !== true) return

    const jsLangs = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']
    vscode.languages.registerCompletionItemProvider(
        jsLangs,
        {
            provideCompletionItems(document, endPos, token, context) {
                console.debug('asked', endPos)
                // LINE END SNIPPET!
                const line = document.lineAt(endPos)
                if (line.range.end.character !== endPos.character) return
                const lineText = line.text
                const completions: vscode.CompletionItem[] = []
                // #region .if
                // simple inline .if postfix. doesn't work with multiline, will be migrated to postfix extension
                if ('|| && == !='.split(' ').some(predicate => lineText.includes(predicate))) {
                    console.debug('should  be here')
                    const startPos = new vscode.Position(endPos.line, line.firstNonWhitespaceCharacterIndex)
                    const completion = new vscode.CompletionItem({ label: 'if', description: 'Better Snippets Postfix' }, vscode.CompletionItemKind.Snippet)
                    // completion.range = new vscode.Range(position.translate(0, -1), line.range.end)
                    completion.insertText = ') '
                    const lastDotPos = new vscode.Position(endPos.line, lineText.lastIndexOf('.'))
                    completion.additionalTextEdits = [
                        {
                            range: new vscode.Range(lastDotPos, lastDotPos.translate(0, 1)),
                            newText: '',
                        },
                        { range: new vscode.Range(startPos, startPos), newText: 'if (' },
                    ]
                    // TODO setting
                    // its just simply fast!
                    const eqeqRegex = /[^=]==[^=]/g
                    let match
                    while ((match = eqeqRegex.exec(lineText))) {
                        const startPos = new vscode.Position(endPos.line, match.index + 1)
                        completion.additionalTextEdits.push({
                            newText: '===',
                            range: new vscode.Range(startPos, startPos.translate(0, 2)),
                        })
                    }

                    const noteqRegex = /!=[^=]/g
                    while ((match = noteqRegex.exec(lineText))) {
                        const startPos = new vscode.Position(endPos.line, match.index)
                        completion.additionalTextEdits.push({
                            newText: '!==',
                            range: new vscode.Range(startPos, startPos.translate(0, 2)),
                        })
                    }

                    completions.push(completion)
                }
                // #endregion

                return completions
            },
        },
        '.',
    )

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
