/* eslint-disable max-depth */

import * as vscode from 'vscode'
import { normalizeRegex } from '@zardoy/vscode-utils/build/settings'
import { partition } from 'rambda'
import { CommonSnippet } from './settingsJsonSnippetCommands'
import { GeneralSnippet } from './configurationType'

type OtherLineMatcher = NonNullable<NonNullable<GeneralSnippet['when']>['otherLines']>[number]
type LineMatcher = Extract<OtherLineMatcher, { line: any }>
type IndentMatcher = Extract<OtherLineMatcher, { indent: any }>

export const isOtherLinesMatches = (
    document: vscode.TextDocument,
    position: vscode.Position,
    snippet: CommonSnippet,
    regexGroups: Record<string, string>,
    debug: any,
    // eslint-disable-next-line max-params
): boolean => {
    // for manipulating TS type in flow
    function changeIndentDiffsType<T extends boolean>(
        arg: any,
        _lineType: T,
        // eslint-disable-next-line no-empty-function
    ): asserts arg is Array<Extract<OtherLineMatcher, T extends true ? LineMatcher : IndentMatcher>> {}

    const { when } = snippet
    if (!when?.otherLines) return true
    const name = 'name' in snippet ? snippet.name : snippet.sequence

    const [lineMatchers, indentMatchers] = partition(otherLine => 'line' in otherLine, when.otherLines)
    changeIndentDiffsType(lineMatchers, true)
    changeIndentDiffsType(indentMatchers, false)

    const isLineMatches = (lineText: string | null | undefined, testAgainst: (typeof when.otherLines)[number]) => {
        if (typeof lineText !== 'string') {
            if ('displayIfNoLine' in testAgainst && testAgainst.displayIfNoLine) return true
            return false
        }

        // method or arrow func also included
        // const functionRegex = /(\([^()]*)\)(?:: .+)? (?:=>|{)/
        if ('preset' in testAgainst)
            // if (testAgainst.preset === 'function') return functionRegex.test(lineText)
            return false

        if ('testString' in testAgainst) return lineText.trim()[testAgainst.matchWith ?? 'startsWith'](testAgainst.testString)

        // TODO(perf) investigate time for creating RegExp instance
        const match = new RegExp(normalizeRegex(testAgainst.testRegex)).exec(lineText)
        Object.assign(regexGroups, match?.groups)
        if (!match) debug(`Snippet ${name} skipped due to line regex: (${testAgainst.testRegex} against ${lineText})`)
        return !!match
    }

    for (const matcher of lineMatchers) {
        if (!isLineMatches(getLineForLineMatcher(document, position, matcher), matcher)) {
            return false
        }
    }

    if (indentMatchers.length > 0) {
        let indentDiffLevel = 0
        let indent = document.lineAt(position).firstNonWhitespaceCharacterIndex
        for (let i = position.line - 1; i >= 0; i--) {
            const line = document.lineAt(i)
            const lineText = line.text
            const currentIndent = line.firstNonWhitespaceCharacterIndex
            // skip empty lines
            if (lineText.trim() === '') continue
            // console.log(i + 1, indent, nextIndent)
            if (currentIndent >= indent) continue
            if (currentIndent < indent) indent = currentIndent
            indentDiffLevel++
            // TODO(perf) investigate optimization
            for (let i = 0; i < indentMatchers.length; i++) {
                const matcherSucceed = () => {
                    indentMatchers.splice(i, 1)
                    i--
                }

                const { indent: requiredIndentDiff, ...matchingParams } = indentMatchers[i]!
                if (-indentDiffLevel === requiredIndentDiff) {
                    if (!isLineMatches(lineText, matchingParams as any)) {
                        return false
                    }

                    matcherSucceed()
                } else if (requiredIndentDiff === 'up' && isLineMatches(lineText, matchingParams as any)) {
                    matcherSucceed()
                }
            }

            // exit early, small perf optimization
            if (currentIndent === 0 || indentMatchers.length === 0) break
        }

        // some matchers didn't meet a line to match, skipping snippet
        if (indentMatchers.length > 0) return false
    }

    // didn't meet return false? all good then
    return true
}

const getLineForLineMatcher = (document: vscode.TextDocument, position: vscode.Position, matcher: LineMatcher) => {
    let { line: delta, skipEmptyLines } = matcher
    let lineText = safeGetDocumentLineText(document, position, delta)
    if (skipEmptyLines) {
        while (lineText?.trim() === '') {
            delta--
            lineText = safeGetDocumentLineText(document, position, delta)
        }
    }

    return lineText
}

const safeGetDocumentLineText = (document: vscode.TextDocument, position: vscode.Position, linesAdd: number): string | null => {
    try {
        return document.lineAt(position.line + linesAdd).text
    } catch {
        return null
    }
    // let newPosition: vscode.Position
    // try {
    //     // handle negative positions
    //     newPosition = position.with(undefined, 0).translate(linesAdd)
    // } catch(err) {
    //     return null
    // }
    // const adjustedPos = document.validatePosition(newPosition)
    // // position was outside the file (line num too large)
    // if (adjustedPos.isEqual(newPosition)) return null
    // return document.lineAt(newPosition)
}
