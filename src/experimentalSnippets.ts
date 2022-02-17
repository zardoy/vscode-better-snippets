import * as vscode from 'vscode'
import { getExtensionSetting } from 'vscode-framework'

export const registerExperimentalSnippets = () => {
    const POSTFIX_DESCRIPTION = 'Better Snippets Postfix'
    const langsSupersets = getExtensionSetting('languageSupersets')
    return vscode.languages.registerCompletionItemProvider(
        // is user mad?
        langsSupersets.js ?? [],
        {
            provideCompletionItems(document, endPos, token, context) {
                // LINE END SNIPPET!
                const line = document.lineAt(endPos)
                if (line.range.end.character !== endPos.character) return
                const lineText = line.text
                const completions: vscode.CompletionItem[] = []
                // #region .if
                // simple inline .if postfix. doesn't work with multiline, will be migrated to postfix extension
                if ('|| && == != > >= < <='.split(' ').some(predicate => lineText.includes(predicate))) {
                    const startPos = new vscode.Position(endPos.line, line.firstNonWhitespaceCharacterIndex)
                    const completion = new vscode.CompletionItem({ label: 'if', description: POSTFIX_DESCRIPTION }, vscode.CompletionItemKind.Snippet)
                    // completion.range = new vscode.Range(position.translate(0, -1), line.range.end)
                    completion.insertText = ') '
                    completion.sortText = '!100'
                    const lastDotPos = new vscode.Position(endPos.line, lineText.lastIndexOf('.'))
                    completion.additionalTextEdits = [
                        {
                            range: new vscode.Range(lastDotPos, lastDotPos.translate(0, 1)),
                            newText: '',
                        },
                        { range: new vscode.Range(startPos, startPos), newText: 'if (' },
                    ]
                    // TODO remove it!
                    // though its just simply fast!
                    const eqeqRegex = /[^=!]==[^=]/g
                    let match: RegExpExecArray | null
                    while ((match = eqeqRegex.exec(lineText))) {
                        const startPos = new vscode.Position(endPos.line, match.index + 1)
                        completion.additionalTextEdits.push({
                            newText: '===',
                            range: new vscode.Range(startPos, startPos.translate(0, 2)),
                        })
                    }

                    // const noteqRegex = /!=[^=]/g
                    // while ((match = noteqRegex.exec(lineText))) {
                    //     const startPos = new vscode.Position(endPos.line, match.index)
                    //     completion.additionalTextEdits.push({
                    //         newText: '!==',
                    //         range: new vscode.Range(startPos, startPos.translate(0, 2)),
                    //     })
                    // }
                    completions.push(completion)
                }

                // #endregion
                if (/Index\.[^.]*$/.test(lineText)) {
                    const startPos = new vscode.Position(endPos.line, line.firstNonWhitespaceCharacterIndex)
                    const completion = new vscode.CompletionItem({ label: 'notFound', description: POSTFIX_DESCRIPTION }, vscode.CompletionItemKind.Snippet)
                    // TODO insert snippet
                    completion.insertText = ' === -1) return'
                    const lastDotPos = new vscode.Position(endPos.line, lineText.lastIndexOf('.'))
                    completion.additionalTextEdits = [
                        {
                            range: new vscode.Range(lastDotPos, lastDotPos.translate(0, 1)),
                            newText: '',
                        },
                        { range: new vscode.Range(startPos, startPos), newText: 'if (' },
                    ]
                    completions.push(completion)
                }

                return completions
            },
        },
        '.',
    )
}
