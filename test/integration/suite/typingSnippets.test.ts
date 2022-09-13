/* eslint-disable no-await-in-loop */
import * as vscode from 'vscode'
import { expect } from 'chai'
import delay from 'delay'
import { Configuration } from '../../../src/configurationType'
import { clearEditorText } from './utils'

describe('Typing snippets', () => {
    const resultingBody = 'EXAMPLE'
    const triggerSequence = 'cb '

    let editor: vscode.TextEditor
    let document: vscode.TextDocument

    const typeSequence = async (seq: string) => {
        for (const letter of seq) await vscode.commands.executeCommand('type', { text: letter })
    }

    /** With delay, enough for comparing triggered result */
    const typeSequenceWithDelay = async (seq: string) => {
        await typeSequence(seq)
        await delay(300)
    }

    before(done => {
        void vscode.commands.executeCommand('workbench.action.files.newUntitledFile').then(async () => {
            editor = vscode.window.activeTextEditor!
            document = editor.document
            await vscode.languages.setTextDocumentLanguage(document, 'markdown')
            await editor.edit(builder => builder.setEndOfLine(vscode.EndOfLine.LF))
            const configKey: keyof Configuration = 'typingSnippets'
            const configValue: Configuration['typingSnippets'] = [
                {
                    sequence: triggerSequence,
                    body: resultingBody,
                    when: {
                        languages: ['markdown'],
                        // locations: ['lineStart'],
                    },
                },
            ]
            await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue, vscode.ConfigurationTarget.Global)
            done()
        })
    })

    it('Fresh document', async () => {
        await typeSequenceWithDelay(triggerSequence)
        expect(document.getText()).to.equal(resultingBody)
    })

    it('Repeat the same', async () => {
        await clearEditorText(editor)
        await typeSequenceWithDelay(triggerSequence)
        expect(document.getText()).to.equal(resultingBody)
    })

    it('Typing from second line two times', async () => {
        await clearEditorText(editor)
        await typeSequenceWithDelay(`test\n${triggerSequence}`)
        await typeSequenceWithDelay(`\n${triggerSequence}`)
        expect(document.getText().split('\n').slice(1).join('\n')).to.equal(`${resultingBody}\n${resultingBody}`)
    })

    it('Typing in first after second', async () => {
        await clearEditorText(editor)
        await typeSequence('\ntest')
        const pos = new vscode.Position(0, 0)
        editor.selection = new vscode.Selection(pos, pos)
        await typeSequenceWithDelay(triggerSequence)
        expect(document.getText().split('\n')[0]).to.equal(resultingBody)
    })

    it('Change cursor pos does not trigger', async () => {
        await clearEditorText(editor)
        await typeSequence('cb')
        await vscode.commands.executeCommand('cursorMove', { to: 'left' })
        await vscode.commands.executeCommand('cursorMove', { to: 'right' })
        await typeSequenceWithDelay(' ')
        expect(document.getText().split('\n')[0]).to.equal('cb ')
    })

    // Actually it tests typing sequence after selecting
    it('Works in snippet placeholders', async () => {
        await clearEditorText(editor)
        await typeSequence('1')
        // Also simulates accepted completion with snippet
        await editor.insertSnippet(new vscode.SnippetString('2${1:placeholder}'))
        await delay(30)
        await typeSequenceWithDelay(triggerSequence)
        expect(document.getText().slice(2)).to.equal(resultingBody)
    })

    it('Multicursor typing', async () => {
        await clearEditorText(editor)
        await typeSequence('-__\n')
        // +make them unsorted
        editor.selections = [new vscode.Position(0, 0), new vscode.Position(0, 3), new vscode.Position(0, 1), new vscode.Position(1, 0)].map(
            pos => new vscode.Selection(pos, pos),
        )
        await delay(30)
        await typeSequenceWithDelay(triggerSequence)
        const lines = document.getText().split('\n')
        expect(lines[0]).to.equal(`${resultingBody}-${resultingBody}__${resultingBody}`)
        expect(lines[1]).to.equal(resultingBody)
    })
})
