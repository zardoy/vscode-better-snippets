/* eslint-disable complexity */
/* eslint-disable max-depth */
import * as vscode from 'vscode'
import { normalizeRegex } from '@zardoy/vscode-utils/build/settings'
import { normalizeLanguages } from '@zardoy/vscode-utils/build/langs'
import { SnippetParser } from 'vscode-snippet-parser'
import { partition } from 'rambda'
import { extensionCtx, getExtensionCommandId, getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { ensureHasProp, oneOf } from '@zardoy/utils'
import escapeStringRegexp from 'escape-string-regexp'
import { completionAddTextEdit, getConfigValueFromAllScopes, normalizeFilePathRegex, objectUndefinedIfEmpty } from './util'
import { registerExperimentalSnippets } from './experimentalSnippets'
import { CompletionInsertArg, registerCompletionInsert } from './completionInsert'
import { registerSpecialCommand } from './specialCommand'
import { registerCreateSnippetFromSelection } from './createSnippetFromSelection'
import settingsHelper from './settingsHelper'
import { registerViews } from './views'
import { registerSnippetSettingsJsonCommands } from './settingsJsonSnippetCommands'
import { filterSnippetByLocationPhase1, filterWithSecondPhaseIfNeeded, snippetsConfig } from './filterSnippets'
import { registerSnippetsMigrateCommands } from './migrateSnippets'
import { changeNpmDepsWatcherState } from './npmDependencies'
import { CustomSnippet, CustomTypingSnippet, initSnippetDefaults, mergeSnippetWithDefaults, snippetDefaults } from './snippet'
import { getAllLoadedSnippets } from './loadedSnippets'
import registerForceInsertSnippet from './forceInsertSnippet'

export const activate = () => {
    let disposables: vscode.Disposable[] = []

    initSnippetDefaults()

    type SnippetResolvedMetadata = {
        /** stays positive */
        removeContentNegativeOffset: number
        removeContentAfterCurrentContent: boolean
    }

    const getCurrentSnippets = <T extends CustomSnippet | CustomTypingSnippet>(
        debugType: 'completion' | 'typing',
        snippets: T[],
        document: vscode.TextDocument,
        /** end position */
        position: vscode.Position,
        displayLanguage = document.languageId,
    ): Array<Omit<T, 'body'> & { body: T extends CustomSnippet ? string : string | false; metadata?: SnippetResolvedMetadata }> => {
        const log = (...args) => console.log(`[${debugType}]`, ...args)
        const debug = (...args) => console.debug(`[${debugType}]`, ...args)
        log(displayLanguage, 'for', snippets.length, 'snippets')
        const getSnippetDebugName = (snippet: typeof snippets[number]) => ('name' in snippet ? snippet.name : snippet.sequence)
        debug('Active snippets:', snippets.map(getSnippetDebugName))

        const line = document.lineAt(position.line)
        const lineText = line.text
        const includedSnippets: Array<T & { body: string; metadata?: SnippetResolvedMetadata }> = []

        snippet: for (const snippet of snippets) {
            const { body, when } = snippet
            const name = getSnippetDebugName(snippet)

            const { locations, fileType, ...regexes } = when
            const docPath = document.uri.path

            const regexGroups: Record<string, string> = {}
            const metadata: SnippetResolvedMetadata = {} as any // todo
            const regexFails = (regex: string | RegExp | undefined, testingString: string, regexName: string): boolean => {
                if (!regex) return false
                const match = testingString.match(regex instanceof RegExp ? regex : normalizeRegex(regex))
                Object.assign(regexGroups, match?.groups)
                const doesntMatch = !match
                if (doesntMatch) {
                    log(`Snippet ${name} skipped due to regex: ${regexName} (${regex as string} against ${testingString})`)
                    return true
                }

                if (
                    snippet.replaceBeforeRegex &&
                    // match[1] &&
                    // eslint-disable-next-line sonarjs/no-duplicate-string
                    (regexName === 'snippet.lineRegexBefore' || regexName === 'snippet.lineRegex') &&
                    match.index! + match[0]!.length === testingString.length
                ) {
                    Object.assign(metadata, {
                        removeContentNegativeOffset: match[0]!.length,
                        removeContentAfterCurrentContent: regexName === 'snippet.lineRegexBefore',
                    })
                }

                return false
            }

            if (when.otherLines) {
                const [lineDiffs, indentDiffs] = partition(otherLine => 'line' in otherLine, when.otherLines)

                const isStringMatches = (lineText: string, testAgainst: typeof when.otherLines[number]) => {
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

                // TODO-low debug message
                for (const lineDiff of lineDiffs)
                    if (!isStringMatches(document.lineAt(position.line + (lineDiff as Extract<typeof lineDiff, { line: any }>).line).text, lineDiff))
                        continue snippet

                // eslint-disable-next-line no-inner-declarations
                function changeIndentDiffsType(arg: any): asserts arg is Array<Extract<typeof indentDiffs[0], { indent: any }>> {}
                changeIndentDiffsType(indentDiffs)

                if (indentDiffs.length > 0 && position.line !== 0) {
                    let indentDiffLevel = 0
                    let indent = document.lineAt(position).firstNonWhitespaceCharacterIndex
                    for (let i = position.line - 1; i >= 0; i--) {
                        const line = document.lineAt(i)
                        const lineText = line.text
                        const currentIndent = line.firstNonWhitespaceCharacterIndex
                        // skip empty lines
                        if (lineText === '') continue
                        // console.log(i + 1, indent, nextIndent)
                        if (currentIndent >= indent) continue
                        if (currentIndent < indent) indent = currentIndent
                        indentDiffLevel++
                        // TODO(perf) investigate optimization
                        for (let i = 0; i < indentDiffs.length; i++) {
                            const { indent: requiredIndentDiff, ...matchingParams } = indentDiffs[i]!
                            if (-indentDiffLevel === requiredIndentDiff || requiredIndentDiff === 'up') {
                                if (!isStringMatches(lineText, matchingParams as any)) console.log('false', currentIndent, line.lineNumber)

                                if (
                                    !isStringMatches(lineText, matchingParams as any) &&
                                    (requiredIndentDiff !== 'up' || currentIndent === 0 || line.lineNumber === 0)
                                )
                                    continue snippet
                                indentDiffs.splice(i, 1)
                                i--
                            }
                        }

                        if (indentDiffs.length === 0) break
                    }

                    if (indentDiffs.length > 0) continue
                }
            }

            if (
                regexFails(snippetDefaults.when.pathRegex, docPath, 'snippetDefaults.when.pathRegex') ||
                regexFails(normalizeFilePathRegex(regexes.pathRegex, fileType), docPath, 'snippet.pathRegex') ||
                regexFails(regexes.lineHasRegex, lineText, 'snippet.lineHasRegex') ||
                regexFails(regexes.lineRegex, lineText.slice(0, position.character), 'snippet.lineRegex') ||
                ('sequence' in snippet &&
                    'lineBeforeRegex' in regexes &&
                    regexFails(regexes.lineBeforeRegex, lineText.slice(0, position.character - snippet.sequence.length), 'snippet.lineRegexBefore'))
            ) {
                continue
            }

            const snippetMatchLocation = filterSnippetByLocationPhase1(snippet, document, position, log)
            if (!snippetMatchLocation) continue

            let newBody = Array.isArray(body) ? body.join('\n') : body
            if (newBody !== false) {
                for (const [groupName, groupValue] of Object.entries(regexGroups)) {
                    newBody = newBody.replace(new RegExp(`(?<!\\\\)${escapeStringRegexp(`$${groupName}`)}`, 'g'), groupValue)
                }
            }

            includedSnippets.push({
                ...snippet,
                body: newBody as string,
                metadata: objectUndefinedIfEmpty(metadata),
            })
        }

        return includedSnippets
    }

    const registerSnippets = () => {
        snippetsConfig.strictPositionLocations = getExtensionSetting('strictPositionLocations')
        snippetsConfig.enableTsPlugin = getExtensionSetting('enableTsPlugin')

        const langsSupersets = getExtensionSetting('languageSupersets')

        const snippetsToLoadByLang = getAllLoadedSnippets()

        void changeNpmDepsWatcherState(Object.values(snippetsToLoadByLang).flat(1))

        const registerSnippets = () => {
            const completionProviderDisposables = [] as vscode.Disposable[]
            for (const [language, allSnippets] of Object.entries(snippetsToLoadByLang)) {
                const snippets: CustomSnippet[] = []
                const snippetsByTriggerChar: Record<string, CustomSnippet[]> = {}
                for (const snippet of allSnippets) {
                    for (const triggerChar of snippet.when.triggerCharacters ?? ['']) {
                        if (triggerChar === '') snippets.push(snippet)
                        else ensureHasProp(snippetsByTriggerChar, triggerChar, []).push(snippet)
                    }
                }

                let triggerFromInner = false
                const disposable = vscode.languages.registerCompletionItemProvider(
                    normalizeLanguages(language, langsSupersets),
                    {
                        async provideCompletionItems(document, position, _token, { triggerCharacter }) {
                            // if (context.triggerKind !== vscode.CompletionTriggerKind.Invoke) return
                            if (triggerFromInner) {
                                triggerFromInner = false
                                return []
                            }

                            const snippetsToCheck = triggerCharacter ? snippetsByTriggerChar[triggerCharacter] : snippets
                            if (!snippetsToCheck) return

                            const firstPhaseSnippets = getCurrentSnippets('completion', snippetsToCheck, document, position, language)

                            const includedSnippets = await filterWithSecondPhaseIfNeeded(firstPhaseSnippets, document, position, langsSupersets)
                            return includedSnippets.map(
                                ({
                                    body,
                                    name,
                                    sortText,
                                    executeCommand,
                                    resolveImports,
                                    fileIcon,
                                    folderIcon,
                                    description,
                                    iconType,
                                    replaceTriggerCharacter,
                                    metadata,
                                }) => {
                                    const completion = new vscode.CompletionItem(
                                        { label: name, description },
                                        vscode.CompletionItemKind[iconType as string | number],
                                    )
                                    completion.sortText = sortText
                                    const snippetString = new vscode.SnippetString(body)
                                    completion.insertText = snippetString
                                    const snippetPreview = new vscode.MarkdownString().appendCodeblock(new SnippetParser().text(body), document.languageId)
                                    if (fileIcon) {
                                        completion.kind = vscode.CompletionItemKind.File
                                        completion.detail = fileIcon
                                    }

                                    if (folderIcon) {
                                        completion.kind = vscode.CompletionItemKind.Folder
                                        completion.detail = folderIcon
                                    }

                                    completion.documentation = snippetPreview
                                    if (resolveImports) {
                                        const arg: CompletionInsertArg = {
                                            action: 'resolve-imports',
                                            importsConfig: resolveImports,
                                            insertPos: position,
                                            snippetLines: body.split('\n').length,
                                        }
                                        completion.command = {
                                            command: getExtensionCommandId('completionInsert'),
                                            title: '',
                                            arguments: [arg],
                                        }
                                    }

                                    if (executeCommand)
                                        completion.command = {
                                            ...(typeof executeCommand === 'string' ? { command: executeCommand } : executeCommand),
                                            title: '',
                                        }

                                    if (!body || !completion.documentation) completion.documentation = undefined

                                    if (metadata) {
                                        let { removeContentNegativeOffset, removeContentAfterCurrentContent } = metadata

                                        const completionRange = document.getWordRangeAtPosition(position)
                                        const startRemovePos = completionRange?.start ?? position
                                        if (!removeContentAfterCurrentContent) {
                                            removeContentNegativeOffset -= position.character - startRemovePos.character
                                        }

                                        completionAddTextEdit(completion, {
                                            range: new vscode.Range(startRemovePos.translate(0, -removeContentNegativeOffset), startRemovePos),
                                            newText: '',
                                        })
                                    } else if (triggerCharacter && replaceTriggerCharacter)
                                        completionAddTextEdit(completion, {
                                            newText: '',
                                            range: new vscode.Range(position.translate(0, -1), position),
                                        })

                                    return completion
                                },
                            )
                        },
                    },
                    ...Object.keys(snippetsByTriggerChar),
                )
                completionProviderDisposables.push(disposable)
            }

            disposables.push(...completionProviderDisposables)
            extensionCtx.subscriptions.push(...disposables)
        }

        registerSnippets()

        const typingSnippetsToLoad = getConfigValueFromAllScopes('typingSnippets')
        if (typingSnippetsToLoad.length > 0) {
            const typingSnippets = typingSnippetsToLoad.map(snippet => mergeSnippetWithDefaults(snippet))
            let lastTypedSeq = ''
            let lastTypePosition = null as null | vscode.Position

            // for easier debuging during development
            const statusBarSeq = process.env.NODE_ENV === 'development' ? vscode.window.createStatusBarItem() : undefined
            statusBarSeq?.show()
            if (statusBarSeq) disposables.push(statusBarSeq)
            const updateStatusBarSeq = () => {
                if (statusBarSeq) statusBarSeq.text = `[${lastTypedSeq}]`
            }

            updateStatusBarSeq()
            const resetSequence = () => {
                lastTypedSeq = ''
                lastTypePosition = null
                updateStatusBarSeq()
            }

            // TODO review implementation as its still blurry. Describe it graphically
            let internalDocumentChange = false

            // TODO losing errors here for some reason
            vscode.workspace.onDidChangeTextDocument(
                ({ contentChanges, document, reason }) => {
                    ;(async () => {
                        // ignore if nothing is changed
                        if (contentChanges.length === 0) return
                        const editor = vscode.window.activeTextEditor
                        if (document.uri !== editor?.document.uri || ['output'].includes(editor.document.uri.scheme)) return
                        if (internalDocumentChange || vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false) return

                        if (oneOf(reason, vscode.TextDocumentChangeReason.Undo, vscode.TextDocumentChangeReason.Redo)) {
                            resetSequence()
                            return
                        }

                        // since we don't work with selections (only cursor positions) we compare them by start
                        // ensure we ALWAYS work with first position only in case of multicursor
                        contentChanges = [...contentChanges].sort((a, b) => a.range.start.compareTo(b.range.start))
                        const char = contentChanges[0]?.text
                        // also reseting on content pasting
                        if (char?.length !== 1) {
                            resetSequence()
                            return
                        }

                        if (!getExtensionSetting('typingSnippetsEnableMulticursor') && contentChanges.length > 1) {
                            resetSequence()
                            return
                        }

                        // ensure true multicursor typing
                        if (contentChanges.some(({ text }) => text !== char)) {
                            resetSequence()
                            return
                        }

                        const originalPos = contentChanges[0]!.range.start

                        lastTypedSeq += char
                        updateStatusBarSeq()

                        lastTypePosition = originalPos
                        // we're always ahead of 1 character
                        const endPosition = originalPos.translate(0, 1)
                        let appliableTypingSnippets = getCurrentSnippets(
                            'typing',
                            typingSnippets.filter(
                                ({ sequence, when }) =>
                                    normalizeLanguages(when.languages, langsSupersets).includes(document.languageId) && lastTypedSeq.endsWith(sequence),
                            ),
                            document,
                            endPosition,
                        )
                        appliableTypingSnippets = await filterWithSecondPhaseIfNeeded(appliableTypingSnippets, document, endPosition, langsSupersets)
                        if (appliableTypingSnippets.length > 2) console.warn(`Multiple appliable typing snippets found: ${appliableTypingSnippets.join(', ')}`)
                        const snippet = appliableTypingSnippets[0]
                        if (!snippet) return
                        console.log('Applying typing snippet', snippet.sequence)
                        const { body, executeCommand, resolveImports } = snippet
                        // TODO continue exploration
                        // const isSnippet = body !== false && /(?<!\\)\$/.exec(body)
                        const isSnippet = true
                        if (body !== false)
                            // #region remove sequence content
                            await new Promise<void>(resolve => {
                                internalDocumentChange = true
                                const { dispose } = vscode.workspace.onDidChangeTextDocument(({ document }) => {
                                    if (document.uri !== editor?.document.uri) return
                                    internalDocumentChange = false
                                    dispose()
                                    resolve()
                                })
                                const insertingBody = isSnippet ? undefined : body.replace(/\\\$/g, '$$')
                                void editor.edit(
                                    builder => {
                                        let previousLineNum = -1
                                        let sameLinePos = 0
                                        for (const { range } of contentChanges) {
                                            // we can safely do this, as contentChanges is sorted
                                            if (previousLineNum === range.start.line) {
                                                sameLinePos++
                                            } else {
                                                previousLineNum = range.start.line
                                                sameLinePos = 0
                                            }

                                            // start = end, which indicates where a character was typed,
                                            // so we're always ahead of 1+N character, where N is zero-based number of position on the same line
                                            // because of just typed letter + just typed letter in previous positions
                                            const endPosition = range.start.translate(0, 1 + sameLinePos)

                                            const negativeStartOffset =
                                                snippet.metadata?.removeContentAfterCurrentContent === false
                                                    ? snippet.metadata.removeContentNegativeOffset
                                                    : snippet.sequence.length + (snippet.metadata?.removeContentNegativeOffset ?? 0)
                                            const startPosition = endPosition.translate(0, -negativeStartOffset)
                                            const fixedRange = new vscode.Range(startPosition, endPosition)
                                            builder.delete(fixedRange)
                                            if (insertingBody) builder.insert(fixedRange.start, insertingBody)
                                        }
                                    },
                                    {
                                        undoStopBefore: getExtensionSetting('typingSnippetsUndoStops'),
                                        undoStopAfter: false,
                                    },
                                )
                            })
                        // #endregion

                        if (body !== false && isSnippet) await editor.insertSnippet(new vscode.SnippetString(body))
                        if (executeCommand) {
                            // TODO extract fn
                            const command = typeof executeCommand === 'string' ? { command: executeCommand, arguments: [] } : executeCommand
                            await vscode.commands.executeCommand(command.command, command.arguments)
                        }

                        if (resolveImports) {
                            const startPosition = endPosition.translate(0, -snippet.sequence.length)
                            const arg: CompletionInsertArg = {
                                action: 'resolve-imports',
                                importsConfig: resolveImports,
                                insertPos: startPosition,
                                snippetLines: body === false ? 1 : body.split('\n').length,
                            }
                            await vscode.commands.executeCommand(getExtensionCommandId('completionInsert'), arg)
                        }
                    })().catch(console.error)
                },
                undefined,
                disposables,
            )
            vscode.window.onDidChangeTextEditorSelection(
                ({ textEditor, kind, selections }) => {
                    const { document } = textEditor
                    if (document.uri !== vscode.window.activeTextEditor?.document.uri) return
                    // reset on mouse click
                    if (oneOf(kind, vscode.TextEditorSelectionChangeKind.Mouse)) {
                        resetSequence()
                        return
                    }

                    // we do the same in onDidChangeTextDocument
                    selections = [...selections].sort((a, b) => a.start.compareTo(b.start))
                    const newPos = selections[0]!.start
                    // reset on selection start
                    if (!selections[0]!.start.isEqual(newPos)) {
                        resetSequence()
                        return
                    }

                    // curosr moved from last TYPING position or
                    // curosr moved to the start of line: reset sequence!
                    if (lastTypePosition && (newPos.character === 0 || !lastTypePosition.isEqual(newPos.translate(0, -1)))) resetSequence()
                },
                undefined,
                disposables,
            )
        }

        registerExperimentalSnippets(disposables)
    }

    registerSnippets()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (
            affectsConfiguration(getExtensionSettingId('customSnippets')) ||
            affectsConfiguration(getExtensionSettingId('customSnippetDefaults')) ||
            affectsConfiguration(getExtensionSettingId('typingSnippets')) ||
            affectsConfiguration(getExtensionSettingId('enableBuiltinSnippets')) ||
            affectsConfiguration(getExtensionSettingId('enableExperimentalSnippets')) ||
            affectsConfiguration(getExtensionSettingId('experimental.disableBuiltinSnippets')) ||
            affectsConfiguration(getExtensionSettingId('languageSupersets')) ||
            affectsConfiguration(getExtensionSettingId('strictPositionLocations')) ||
            affectsConfiguration(getExtensionSettingId('enableTsPlugin'))
        ) {
            console.log('Snippets configuration updated')
            vscode.Disposable.from(...disposables).dispose()
            disposables = []
            registerSnippets()
        }
    })
    registerCompletionInsert()
    registerSpecialCommand()
    registerCreateSnippetFromSelection()
    settingsHelper()
    registerViews()
    registerSnippetSettingsJsonCommands()
    registerSnippetsMigrateCommands()
    registerForceInsertSnippet()
}
