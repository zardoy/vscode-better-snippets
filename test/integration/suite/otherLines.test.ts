/* eslint-disable max-nested-callbacks */
import fs from 'fs'
import { join } from 'path'
import * as vscode from 'vscode'
import { expect } from 'chai'
import { compact } from '@zardoy/utils'
import { getCompletionItems, updateExtensionSetting } from './utils'

describe.only('otherLines', () => {
    let document: vscode.TextDocument
    let activeEditor: vscode.TextEditor
    const testPositions: Array<[line: number, casesRaw: string]> = []

    it('otherLines', done => {
        ;(async () => {
            const content = fs.readFileSync(join(__dirname, '../../test/integration/fixtures/otherLines.ts'), 'utf-8').split('\n').slice(2).join('\n')
            const contentLines = content.split('\n')
            for (const [i, line] of contentLines.entries()) {
                const lineAdressedContent = line.trimStart().startsWith('//') ? line.trimStart().slice('// '.length) : undefined
                if (lineAdressedContent) {
                    testPositions.push([i, lineAdressedContent.split(' ')[0]!])
                    // preserve indent of the comment, so we try to apply snippet not from line start and indent matchers work as expected
                    contentLines[i] = /^\s+/.exec(line)?.[0] ?? ''
                }
            }

            document = await vscode.workspace.openTextDocument({
                content: contentLines.join('\n'),
                language: 'typescript',
            })
            await vscode.window.showTextDocument(document)
            activeEditor = vscode.window.activeTextEditor!
            await updateExtensionSetting('customSnippets', [
                {
                    name: 'continue',
                    body: false,
                    when: {
                        otherLines: [
                            {
                                indent: 'up',
                                testString: 'for',
                            },
                        ],
                    },
                },
                {
                    name: 'break',
                    body: false,
                    when: {
                        otherLines: [
                            {
                                // not using up just for testing purposes
                                indent: -1,
                                testRegex: 'while',
                            },
                        ],
                    },
                },
                {
                    name: 'import',
                    body: false,
                    when: {
                        otherLines: [
                            {
                                line: -1,
                                displayIfNoLine: true,
                                skipEmptyLines: true,
                                testString: 'import',
                            },
                        ],
                    },
                },
            ])

            done()
            describe('File cases', () => {
                for (const [line, casesRaw] of testPositions) {
                    const cases = casesRaw.split(',')
                    for (const testingCase of cases) {
                        it(`L${line} - ${testingCase}`, async () => {
                            const items = await getCompletionItems(new vscode.Position(line, 0))
                            const betterSnippetsByLabels = compact(
                                items.map(item =>
                                    typeof item.label === 'object' && item.label.description === 'Better Snippet' ? item.label.label : undefined,
                                ),
                            )
                            if (testingCase === '!') expect(betterSnippetsByLabels).to.deep.equal([])
                            else if (testingCase.startsWith('=')) {
                                const expectingSnippet = testingCase.slice(1)
                                expect(betterSnippetsByLabels).to.deep.equal([expectingSnippet])
                            } else {
                                throw new Error('Unsupported test case')
                            }
                        })
                    }
                }
            })
        })()
    })
})
