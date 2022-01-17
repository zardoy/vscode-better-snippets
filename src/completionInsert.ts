/* eslint-disable unicorn/consistent-destructuring */
/* eslint-disable no-await-in-loop */
import * as vscode from 'vscode'
import { oneOf } from '@zardoy/utils'
import { getExtensionCommandId, registerExtensionCommand } from 'vscode-framework'
import { CustomSnippet } from './extension'

export interface CompletionInsertArg {
    action: 'resolve-imports'
    importsConfig: NonNullable<CustomSnippet['resolveImports']>
    insertPos: vscode.Position
    snippetLines: number
}
export const registerCompletionInsert = () => {
    registerExtensionCommand('completionInsert', (_, execArg: CompletionInsertArg) => {
        const { action, importsConfig, insertPos, snippetLines } = execArg
        if (action === 'resolve-imports') {
            const editor = vscode.window.activeTextEditor!
            const { document } = editor
            const activeEditorUri = document.uri
            let observed = false
            const notImportedIdentifiers = Object.keys(importsConfig)
            const disposable = vscode.languages.onDidChangeDiagnostics(async ({ uris }) => {
                observed = true
                if (!uris.includes(activeEditorUri)) return
                console.log('document diagnostic changed')
                const diagnostics = vscode.languages.getDiagnostics(activeEditorUri)
                for (const problem of diagnostics) {
                    const { range } = problem
                    if (!new vscode.Range(insertPos, insertPos.translate(snippetLines)).intersection(range) || !oneOf(problem.code, 2552, 2304)) continue
                    const missingIdentifier = /'(.+?)'/.exec(problem.message)?.[1]
                    if (!missingIdentifier) return
                    const specifier = importsConfig[missingIdentifier]
                    // missing identifiers from snippet that is not defined in imports config, skipping
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
                    if (!codeAction) return
                    notImportedIdentifiers.splice(notImportedIdentifiers.indexOf(missingIdentifier), 1)

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
            })
            setTimeout(async () => {
                disposable.dispose()
                if (!observed) {
                    console.log('diagnostic timeout')
                    return
                }

                // Below: suggest to install missing packages
                if (process.env.PLATFORM === 'web') return
                const missingIdentifiers = notImportedIdentifiers.map(indentifier => {
                    const packagePath = importsConfig[indentifier]!.package
                    const installable = packagePath && ['./', '../'].every(predicate => !packagePath.startsWith(predicate))
                    return {
                        indentifier,
                        packagePath,
                        installable,
                    }
                })
                if (missingIdentifiers.length === 0) return

                const installChoice = await vscode.window.showWarningMessage(
                    `Cannot import missing ${missingIdentifiers
                        .map(({ indentifier, packagePath, installable }) => {
                            let str = indentifier
                            if (packagePath) str += `: ${installable ? '📦' : ''}${packagePath}`
                            return str
                        })
                        .join(', ')}`,
                    ...(missingIdentifiers.some(({ installable }) => installable) ? [] : ['Install to deps', 'Install to devDeps']),
                )
                if (installChoice === undefined) return
                const npmRapidReadyInstalled = vscode.extensions.all.find(({ id }) => id === 'zardoy.npm-rapid-ready')
                if (!npmRapidReadyInstalled) {
                    const openChoice = await vscode.window.showErrorMessage('NPM Rapid Ready must be installed to perform installation', 'Show me extension')
                    if (!openChoice) return
                    void vscode.env.openExternal('https://github.com/zardoy/npm-the-fastest' as any)
                    return
                }

                // TODO! support path
                await vscode.commands.executeCommand('npmRapidReady.addPackages', {
                    [installChoice === 'Install to deps' ? 'packages' : 'devPackages']: [
                        missingIdentifiers.filter(({ installable }) => installable).map(({ packagePath }) => packagePath),
                    ],
                })
                // self run this command to finally import missing identifiers
                await vscode.commands.executeCommand(getExtensionCommandId('completionInsert'), execArg)
            }, 1500)
        }
    })
}
