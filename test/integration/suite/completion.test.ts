/* eslint-disable @typescript-eslint/no-loop-func */
/// <reference types="jest" />
import * as vscode from 'vscode'

import { expect } from 'chai'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
//@ts-ignore
import type { Configuration } from '../../../src/configurationType'

const getItems = async (doc: vscode.TextDocument, pos: vscode.Position) => {
    const { items }: { items: vscode.CompletionItem[] } = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, pos)
    return items
}

const getFirstItem = async (doc: vscode.TextDocument, pos: vscode.Position) => getItems(doc, pos).then(items => items[0])
const getFirstItemInsertText = async (doc: vscode.TextDocument, pos: vscode.Position) => {
    const firstItem = await getFirstItem(doc, pos)
    return (firstItem?.insertText as vscode.SnippetString).value
}

const normalizeLabel = (label: vscode.CompletionItem['label']) => (typeof label === 'string' ? label : label.label)

describe('Basic copmletions', () => {
    const content = '\ncodeblock\ntest codeblock'
    const contentLines = content.split('\n')

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
                        name: 'fileStartTest',
                        body: '',
                        sortText: '!',
                        when: {
                            languages: ['markdown'],
                            locations: ['fileStart'],
                        },
                    },
                ]
                await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue, vscode.ConfigurationTarget.Global)
            })
            .then(done)
    })
    it('fileStart snippet appears in start of file', async () => {
        const item = await getFirstItem(document, new vscode.Position(0, 0))
        expect(item && normalizeLabel(item?.label)).to.equal('fileStartTest')
    })

    // test several positions against markdown snippet
    const expectedSnippet = '```$1\n$2\n```'
    const positions = {
        expect: [new vscode.Position(1, 0), new vscode.Position(1, 3), new vscode.Position(1, contentLines[1]!.length)],
        dontExpect: [new vscode.Position(2, contentLines[2]!.length)],
    }
    for (const [i, position] of positions.expect.entries())
        it(`Expect snippet in position ${i}`, async () => {
            const snippet = await getFirstItemInsertText(document, position)
            expect(snippet).to.equal(expectedSnippet)
        })

    for (const [i, position] of positions.dontExpect.entries())
        it(`Don't expect snippet in position ${i}`, async () => {
            const snippet = await getFirstItemInsertText(document, position)
            expect(snippet).to.not.equal(expectedSnippet)
        })

    // it('Builtin em snippet should be on top', async () => {
    //     await triggerFirstAtEnd()
    //     await delay(500)
    //     expect(activeEditor.getText()).to.equal(normalizeEol('codeblock'))
    // })
})
