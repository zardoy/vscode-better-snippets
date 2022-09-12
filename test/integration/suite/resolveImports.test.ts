import * as vscode from 'vscode'

import { expect } from 'chai'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
//@ts-ignore
import delay from 'delay'
import type { Configuration } from '../../../src/configurationType'
import { clearEditorText } from './utils'

describe('Resolve imports', () => {
    const content = ''

    let document: vscode.TextDocument
    let editor: vscode.TextEditor
    const startPos = new vscode.Position(0, 0)
    before(function (done) {
        this.timeout(6000)
        void vscode.workspace
            .openTextDocument({
                content,
                language: 'typescript',
            })
            .then(async newDocument => {
                document = newDocument
                editor = await vscode.window.showTextDocument(document)
                await editor.edit((builder) => builder.setEndOfLine(vscode.EndOfLine.LF))
                const configKey: keyof Configuration = 'customSnippets'
                const configValue: Configuration['customSnippets'] = [
                    {
                        name: '__vsc_test_readFileSync',
                        body: 'readFileSync',
                        sortText: '!1',
                        resolveImports: {
                            readFileSync: {
                                package: 'node:fs',
                            },
                        },
                    },
                    {
                        name: '__vsc_test_readFileSync_2',
                        body: 'readFileSync',
                        sortText: '!2',
                        resolveImports: {
                            readFileSync: {},
                        },
                    },
                ]
                await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue, vscode.ConfigurationTarget.Global)
                // prepare TS completions
                await delay(500)
                console.time('ts-first-completion')
                await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, startPos)
                console.timeEnd('ts-first-completion')
                // await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, startPos)
            })
            .then(done)
    })

    const triggerSuggest = () => vscode.commands.executeCommand('editor.action.triggerSuggest')

    const acceptAndWaitForChanges = async () => {
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        await new Promise<void>(resolve => {
            const { dispose } = vscode.workspace.onDidChangeTextDocument(({ document }) => {
                if (document.uri !== editor.document.uri) return
                dispose()
                resolve()
            })
        })
    }

    it('Explicit resolveImports', async () => {
        await delay(200)
        await triggerSuggest()
        await delay(1200)
        await acceptAndWaitForChanges()
        expect(document.getText().split('\n')[0]).to.equal('import { readFileSync } from "node:fs";')
    }).timeout(5000)

    it('resolveImports with existing import', async () => {
        await clearEditorText(editor, 'import { readFile } from "node:fs";\n')
        await vscode.commands.executeCommand('cursorBottom')
        await triggerSuggest()
        await delay(900)
        await acceptAndWaitForChanges()
        expect(document.getText().split('\n')[0]).to.equal('import { readFile, readFileSync } from "node:fs";')
    }).timeout(4000)

    it('Implicit resolveImports', async () => {
        await clearEditorText(editor)
        await triggerSuggest()
        await delay(800)
        await vscode.commands.executeCommand('selectNextSuggestion')
        await acceptAndWaitForChanges()
        expect(document.getText().split('\n')[0]).to.match(/import { readFileSync } from "(node:)?fs";/)
    }).timeout(4000)
})
