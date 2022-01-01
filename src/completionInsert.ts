/* eslint-disable unicorn/consistent-destructuring */
/* eslint-disable no-await-in-loop */
import * as vscode from 'vscode'
import { oneOf } from '@zardoy/utils'
import { registerExtensionCommand } from 'vscode-framework'
import { CustomSnippet } from './extension'

export interface CompletionInsertArg {
    action: 'resolve-imports'
    importsConfig: NonNullable<CustomSnippet['resolveImports']>
    insertPos: vscode.Position
    snippetLines: number
}
export const registerCompletionInsert = () => {
    registerExtensionCommand('completionInsert', (_, { action, importsConfig, insertPos, snippetLines }: CompletionInsertArg) => {
        if (action === 'resolve-imports') {
            const editor = vscode.window.activeTextEditor!
            const { document } = editor
            const activeEditorUri = document.uri
            const disposable = vscode.languages.onDidChangeDiagnostics(async ({ uris }) => {
                if (uris.includes(activeEditorUri)) {
                    console.log('observing on missing imports')
                    const diagnostics = vscode.languages.getDiagnostics(activeEditorUri)
                    for (const problem of diagnostics) {
                        const { range } = problem
                        if (!new vscode.Range(insertPos, insertPos.translate(snippetLines)).intersection(range) || !oneOf(problem.code, 2552, 2304)) continue
                        const missingIdentifier = /'(.+?)'/.exec(problem.message)?.[1]
                        if (!missingIdentifier) return
                        const specifier = importsConfig[missingIdentifier]
                        if (!specifier) return
                        const codeFixes: vscode.CodeAction[] = (await vscode.commands.executeCommand(
                            'vscode.executeCodeActionProvider',
                            document.uri,
                            range,
                        )) as any
                        const codeAction = codeFixes.find(({ title }) => {
                            const match = /(?:Add|Import) '(.+?)'.+from.+"(.+?)"/.exec(title)
                            if (!match) return false
                            if (typeof specifier.package === 'string' && specifier.package !== match[2]!) return false
                            return true
                        })
                        if (!codeAction) {
                            void vscode.window.showWarningMessage(`Can't import missing ${missingIdentifier} from ${specifier.package ?? 'any module'}`)
                            return
                        }

                        // suppose changes always happen in the same document (uri)
                        if (codeAction.edit)
                            await editor.edit(
                                editBuilder => {
                                    for (const { edit } of (codeAction.edit as any)._edits) editBuilder.replace(edit._range, edit._newText)
                                },
                                {
                                    undoStopAfter: false,
                                    undoStopBefore: false,
                                },
                            )
                    }
                }
            })
            setTimeout(() => disposable.dispose(), 1300)
        }
    })
}
