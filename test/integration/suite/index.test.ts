/// <reference types="jest" />
import * as vscode from 'vscode'

import { EOL } from 'os'
import { expect } from 'chai'
import delay from 'delay'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
//@ts-ignore
import type { Configuration } from '../../../src/configurationType'

const normalizeEol = (input: string) => input.split('\n').join(EOL)

async function triggerFirstAtEnd() {
    await delay(1200)
    // await vscode.commands.executeCommand('editor.action.triggerSuggest')
    await delay(500)
    // await vscode.commands.executeCommand('acceptSelectedSuggestion')
}

const content = '\ncodeblock\ntest codeblock'
const contentLines = content.split('\n')

const expectedSnippet = '```$1\n$2\n```'

const positions = [
    new vscode.Position(0, 0),
    new vscode.Position(1, 0),
    new vscode.Position(1, 3),
    new vscode.Position(1, contentLines[1]!.length),

    new vscode.Position(2, contentLines[2]!.length),
]

const getItems = async (doc: vscode.TextDocument, pos: vscode.Position) => {
    const { items }: { items: vscode.CompletionItem[] } = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, pos)
    return items
}

const getFirstItem = async (doc: vscode.TextDocument, pos: vscode.Position) => (await getItems(doc, pos))[0]
const getFirstItemInsertText = async (doc: vscode.TextDocument, pos: vscode.Position) => {
    const firstItem = await getFirstItem(doc, pos)
    return (firstItem?.insertText as vscode.SnippetString).value
}

const normalizeLabel = (label: vscode.CompletionItem['label']) => (typeof label === 'string' ? label : label.label)

describe('Basic copmletions', () => {
    let document: vscode.TextDocument
    before(done => {
        void vscode.workspace
            .openTextDocument({
                content,
                language: 'markdown',
            })
            .then(async editor => {
                document = editor
                const configKey: keyof Configuration = 'customSnippets'
                const configValue: Configuration['customSnippets'] = [
                    {
                        name: 'onTopTest',
                        body: '',
                        sortText: '!',
                        when: {
                            languages: ['markdown'],
                            locations: ['fileStart'],
                        },
                    },
                ]
                await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue)
            })
            .then(done)
    })
    it('1', async () => {
        const item = await getFirstItem(document, positions[0]!)
        expect(item && normalizeLabel(item?.label)).to.equal('onTopTest')
    })
    it('2', async () => {
        const snippet = await getFirstItemInsertText(document, positions[1]!)
        expect(snippet).to.equal(expectedSnippet)
    })
    it('3', async () => {
        const snippet = await getFirstItemInsertText(document, positions[2]!)
        expect(snippet).to.equal(expectedSnippet)
    })
    it('4', async () => {
        const snippet = await getFirstItemInsertText(document, positions[3]!)
        expect(snippet).to.equal(expectedSnippet)
    })
    it('5', async () => {
        const snippet = await getFirstItemInsertText(document, positions[4]!)
        expect(snippet).to.not.equal(expectedSnippet)
    })
    it('5', async () => {
        const snippet = await getFirstItemInsertText(document, positions[4]!)
        expect(snippet).to.not.equal(expectedSnippet)
    })
    // it('Builtin em snippet should be on top', async () => {
    //     await triggerFirstAtEnd()
    //     await delay(500)
    //     expect(activeEditor.getText()).to.equal(normalizeEol('codeblock'))
    // })
})
