/* eslint-disable max-depth */
/* eslint-disable unicorn/consistent-destructuring */
/* eslint-disable no-await-in-loop */
import * as vscode from 'vscode'
import { getExtensionCommandId, getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import delay from 'delay'
import { range } from 'rambda'
import { oneOf } from '@zardoy/utils'
import { CustomSnippet } from './extension'

export interface CompletionInsertArg {
    action: 'resolve-imports'
    importsConfig: NonNullable<CustomSnippet['resolveImports']>
    insertPos: vscode.Position
    snippetLines: number
    useExistingDiagnosticsPooling?: number
}
export const registerCompletionInsert = () => {
    registerExtensionCommand('completionInsert', async (_, execArg: CompletionInsertArg) => {
        const { action, importsConfig, insertPos, snippetLines, useExistingDiagnosticsPooling } = execArg
        const {
            document,
            selection: { active: position },
        } = vscode.window.activeTextEditor!
        if (action === 'resolve-imports') {
            const editor = vscode.window.activeTextEditor!
            const { document } = editor
            const activeEditorUri = document.uri
            let observed = false
            const missingIdentifiers = new Set<string>()
            const resolveIdentifiers = new Set<string>()
            interface DiagnosticInterface {
                code: number
                message: string
                range: vscode.Range
            }
            const observeDiagnosticsChanges = async ({ uris }) => {
                observed = true
                if (!uris.includes(activeEditorUri)) return
                console.debug('document diagnostic changed')
                const diagnostics = vscode.languages.getDiagnostics(activeEditorUri)
                await handleDiagnostics(diagnostics as DiagnosticInterface[])
            }

            const handleDiagnostics = async (diagnostics: DiagnosticInterface[]) => {
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
                        const match = /(?:Add|Update) import from "(.+?)"/.exec(title)
                        if (!match) return false
                        if (typeof specifier.package === 'string' && specifier.package !== match[1]!) return false
                        return true
                    })
                    if (!codeAction) {
                        if (!resolveIdentifiers.has(missingIdentifier)) missingIdentifiers.add(missingIdentifier)
                        return
                    }

                    missingIdentifiers.delete(missingIdentifier)
                    resolveIdentifiers.add(missingIdentifier)

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
                    else console.warn(`[resolve ${missingIdentifier}] No edit in`, codeAction)
                    break
                }
            }

            try {
                const { uri } = document
                let requestFile = uri.fsPath
                if (uri.scheme !== 'file') requestFile = `^/${uri.scheme}/${uri.authority || 'ts-nul-authority'}/${uri.path.replace(/^\//, '')}`
                const result = (await vscode.commands.executeCommand('typescript.tsserverRequest', 'semanticDiagnosticsSync', {
                    _: '%%%',
                    file: requestFile,
                    line: position.line + 1,
                    offset: position.character + 1,
                })) as any
                if (!result?.body) throw new Error('no body in response')
                const tsNormalizePos = ({ line, offset }: { line; offset }) => new vscode.Position(line - 1, offset - 1)
                const diagnostics: DiagnosticInterface[] = result.body.map(
                    ({ start, end, text, code }): DiagnosticInterface => ({
                        code,
                        message: text,
                        range: new vscode.Range(tsNormalizePos(start), tsNormalizePos(end)),
                    }),
                )
                await handleDiagnostics(diagnostics)
            } catch {
                if (useExistingDiagnosticsPooling !== undefined) {
                    void observeDiagnosticsChanges({ uris: [document.uri] })
                    if (useExistingDiagnosticsPooling !== 0)
                        // pooling TS codeactions
                        for (const i of range(0, Math.floor(getExtensionSetting('diagnosticTimeout') / useExistingDiagnosticsPooling))) {
                            await delay(useExistingDiagnosticsPooling)
                            void observeDiagnosticsChanges({ uris: [document.uri] })
                        }
                }

                const disposable = vscode.languages.onDidChangeDiagnostics(observeDiagnosticsChanges)
                setTimeout(async () => {
                    disposable.dispose()
                    if (!observed) {
                        console.log('diagnostic timeout')
                        return
                    }

                    await warnPackageIsNotInstalled()
                }, getExtensionSetting('diagnosticTimeout'))
            }

            const warnPackageIsNotInstalled = async () => {
                const langsSupersets = getExtensionSetting('languageSupersets')
                // Below: warn about failed to import missing identifiers from resolveImports
                /** parsed */
                const missing = [...missingIdentifiers.values()].map(indentifier => {
                    const packagePath = importsConfig[indentifier]!.package
                    const installable =
                        process.env.PLATFORM !== 'web' &&
                        (langsSupersets.js ?? []).includes(document.languageId) &&
                        packagePath &&
                        ['./', '../'].every(predicate => !packagePath.startsWith(predicate))
                    return {
                        indentifier,
                        packagePath,
                        installable,
                    }
                })
                if (missing.length === 0) return

                const installChoice = await vscode.window.showWarningMessage(
                    `Cannot import missing ${missing
                        .map(({ indentifier, packagePath, installable }) => {
                            let str = indentifier
                            if (packagePath) str += `: ${installable ? '📦' : ''}${packagePath}`
                            return str
                        })
                        .join(', ')}`,
                    ...(missing.some(({ installable }) => installable) ? ['Install to deps', 'Install to devDeps'] : []),
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
                    [installChoice === 'Install to deps' ? 'packages' : 'devPackages']: missing
                        .filter(({ installable }) => installable)
                        .map(({ packagePath }) => packagePath),
                })
                // self run this command to finally import missing identifiers
                await vscode.commands.executeCommand(getExtensionCommandId('completionInsert'), { ...execArg, useExistingDiagnosticsPooling: 300 })
            }
        }
    })
}
