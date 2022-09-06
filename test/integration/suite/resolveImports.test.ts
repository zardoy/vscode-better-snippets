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
    before(done => {
        void vscode.workspace
            .openTextDocument({
                content,
                language: 'typescript',
            })
            .then(async newDocument => {
                document = newDocument
                editor = await vscode.window.showTextDocument(document)
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
                await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, startPos)
                // await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, startPos)
            })
            .then(done)
    })
    beforeEach(async () => {
        await delay(500)
    })

    const triggerSuggest = () => vscode.commands.executeCommand('editor.action.triggerSuggest')

    it('Explicit resolveImports', async () => {
        await delay(100)
        await triggerSuggest()
        await delay(800)
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        await delay(700)
        // expect(item?.label).to.equal('__vsc_test_readFileSync')
        expect(document.getText().split('\n')[0]).to.equal('import { readFileSync } from "node:fs";')
    })

    it('resolveImports with existing import', async () => {
        await clearEditorText(editor, 'import { readFile } from "node:fs";\n')
        await vscode.commands.executeCommand('cursorBottom')
        await triggerSuggest()
        await delay(100)
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        await delay(700)
        expect(document.getText().split('\n')[0]).to.equal('import { readFile, readFileSync } from "node:fs";')
    })

    it('Implicit resolveImports', async () => {
        await clearEditorText(editor)
        await triggerSuggest()
        await delay(100)
        await vscode.commands.executeCommand('selectNextSuggestion')
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        await delay(700)
        expect(document.getText().split('\n')[0]).to.equal('import { readFileSync } from "fs";')
    })
})
