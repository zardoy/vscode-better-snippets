import * as vscode from 'vscode'

import { expect } from 'chai'
import delay from 'delay'
// eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
//@ts-ignore
import type { Configuration } from '../../../src/configurationType'
import { clearEditorText, getFirstCompletionItem } from './utils'

const getFirstItemInsertText = async (pos: vscode.Position) => {
    const firstItem = await getFirstCompletionItem(pos)
    return (firstItem?.insertText as vscode.SnippetString).value
}

describe('Basic copmletions', () => {
    const content = '\ncodeblock\ntest codeblock'
    const contentLines = content.split('\n')

    let document: vscode.TextDocument
    const startPos = new vscode.Position(0, 0)
    // const snippetsAndTests: Array<[Configuration['customSnippets'][number], (snippet: Configuration['customSnippets'][number]) => any, false?]> = [
    //     [
    //         {
    //             name: '_test_',
    //             body: 'readFileSync',
    //             when: {
    //                 line
    //             }
    //         },
    //         ({ name }) => {
    //             const firstItem = await getFirstItem(document, startPos)
    //             expect(normalizeLabel(firstItem?.label ?? '')).to.equal(name)
    //         },
    //     ],
    // ]
    before(done => {
        void vscode.workspace
            .openTextDocument({
                content,
                language: 'markdown',
            })
            .then(async newDocument => {
                document = newDocument
                await vscode.window.showTextDocument(document)
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
                    {
                        name: 'destruct3',
                        body: 'const { $LAST } = $EXPR',
                        when: {
                            lineRegex: '(?<EXPR>(\\.?\\w)+)\\.(?<LAST>\\w+)\\.\\w*$',
                            triggerCharacters: ['.', ''],
                            languages: ['markdown'],
                            locations: [],
                        },
                        replaceBeforeRegex: true,
                    },
                ]
                await vscode.workspace.getConfiguration('betterSnippets').update(configKey, configValue, vscode.ConfigurationTarget.Global)
            })
            .then(done)
    })
    it('fileStart snippet appears in start of file', async () => {
        const item = await getFirstCompletionItem(startPos)
        expect(item?.label).to.equal('fileStartTest')
    })

    // test several positions against codeblock markdown snippet
    const expectedSnippet = '```$1\n$2\n```'
    const positions = {
        expect: [new vscode.Position(1, 0), new vscode.Position(1, 3), new vscode.Position(1, contentLines[1]!.length)],
        dontExpect: [new vscode.Position(2, contentLines[2]!.length)],
    }
    for (const [i, position] of positions.expect.entries()) {
        it(`Expect snippet in position ${i}`, async () => {
            const snippet = await getFirstItemInsertText(position)
            expect(snippet).to.equal(expectedSnippet)
        })
    }

    for (const [i, position] of positions.dontExpect.entries()) {
        it(`Don't expect snippet in position ${i}`, async () => {
            const snippet = await getFirstItemInsertText(position)
            expect(snippet).to.not.equal(expectedSnippet)
        })
    }

    it('replaceBeforeRegex + empty trigger character', async () => {
        await clearEditorText(vscode.window.activeTextEditor!, 'test.a.b.de')
        await vscode.commands.executeCommand('cursorEnd')
        await delay(400)
        await vscode.commands.executeCommand('editor.action.triggerSuggest')
        await delay(800)
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        expect(document.getText()).to.equal('const { b } = test.a')
    })
})
