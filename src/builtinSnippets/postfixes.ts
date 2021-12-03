import vscode from 'vscode'
import { jsLangs } from '../util'

export const registerPostfixSnippets = () => {
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
                if ('|| && == != > >= < <='.split(' ').some(predicate => lineText.includes(predicate))) {
                    console.debug('should be here')
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
                    // TODO remove it!
                    // though its just simply fast!
                    const eqeqRegex = /[^=]==[^=]/g
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
                    const completion = new vscode.CompletionItem(
                        { label: 'notFound', description: 'Better Snippets Postfix' },
                        vscode.CompletionItemKind.Snippet,
                    )
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
