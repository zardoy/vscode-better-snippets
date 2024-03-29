import * as vscode from 'vscode'
import { normalizeRegex } from '@zardoy/vscode-utils/build/settings'
import { SnippetParser } from 'vscode-snippet-parser'
import { extensionCtx, getExtensionCommandId, getExtensionSetting, getExtensionSettingId, registerActiveDevelopmentCommand } from 'vscode-framework'
import { ensureHasProp, oneOf } from '@zardoy/utils'
import escapeStringRegexp from 'escape-string-regexp'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { offsetPosition } from '@zardoy/vscode-utils/build/position'
import { completionAddTextEdit, getConfigValueFromAllScopes, normalizeFilePathRegex, objectUndefinedIfEmpty } from './util'
import { registerExperimentalSnippets } from './experimentalSnippets'
import { CompletionInsertArg, registerCompletionInsert } from './completionInsert'
import { registerSpecialCommand } from './specialCommand'
import { registerCreateSnippetFromSelection } from './createSnippetFromSelection'
import settingsHelper from './settingsHelper'
import { registerViews } from './views'
import { registerSnippetSettingsJsonCommands } from './settingsJsonSnippetCommands'
import { filterSnippetByLocationPhase1, filterWithSecondPhaseIfNeeded } from './filterSnippets'
import { registerSnippetsMigrateCommands } from './migrateSnippets'
import { changeNpmDepsWatcherState } from './npmDependencies'
import {
    CustomSnippet,
    CustomTypingSnippet,
    getAllExtensionSnippets,
    getExtensionApi,
    initSnippetDefaults,
    mergeSnippetWithDefaults,
    normalizeWhenLangs,
    snippetDefaults,
    snippetsConfig,
} from './snippet'
import { getAllLoadedSnippets } from './loadedSnippets'
import registerForceInsertSnippet from './forceInsertSnippet'
import { ExposedExtensionApi } from './extensionApi'
import registerDebugCommands from './debugCommands'
import { isOtherLinesMatches } from './otherLines'

export const registerSnippetsEvent = new vscode.EventEmitter<void>()

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
        // eslint-disable-next-line max-params
    ): Array<Omit<T, 'body'> & { body: T extends CustomSnippet ? string : string | false; metadata?: SnippetResolvedMetadata }> => {
        const log = (...args) => console.log(`[${debugType}]`, ...args)
        const debug = (...args) => console.debug(`[${debugType}]`, ...args)
        log(displayLanguage, 'for', snippets.length, 'snippets')
        const getSnippetDebugName = (snippet: (typeof snippets)[number]) => ('name' in snippet ? snippet.name : snippet.sequence)
        debug('Active snippets:', snippets.map(getSnippetDebugName))

        const line = document.lineAt(position.line)
        const lineText = line.text
        const includedSnippets: Array<T & { body: string; metadata?: SnippetResolvedMetadata }> = []

        for (const snippet of snippets) {
            const { body, when } = snippet
            const name = getSnippetDebugName(snippet)

            const { locations, fileType, languages, ...regexes } = when
            const docPath = document.uri.path

            const negativeLanguages = languages.filter(language => language.startsWith('!')).map(language => language.slice(1))
            if (negativeLanguages.length > 0 && vscode.languages.match(negativeLanguages, document)) continue

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

            if (!isOtherLinesMatches(document, position, snippet, regexGroups, debug)) {
                continue
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
            if (newBody === false) {
                newBody = name
            } else {
                for (const [groupName, groupValue] of Object.entries(regexGroups)) {
                    newBody = newBody.replace(new RegExp(`(?<!\\\\)${escapeStringRegexp(`$${groupName}`)}`, 'g'), groupValue)
                }
            }

            includedSnippets.push({
                ...snippet,
                body: newBody,
                metadata: objectUndefinedIfEmpty(metadata),
            })
        }

        return includedSnippets
    }

    const updateCachedSettings = () => {
        snippetsConfig.strictPositionLocations = getExtensionSetting('strictPositionLocations')
        snippetsConfig.enableTsPlugin = getExtensionSetting('enableTsPlugin')
        snippetsConfig.languageSupersets = getExtensionSetting('languageSupersets')
        snippetsConfig.extendsGroups = getExtensionSetting('extendsGroups')
    }

    let snippetsRegistered = false
    const registerSnippetsInner = () => {
        snippetsRegistered = true

        const snippetsToLoadByLang = getAllLoadedSnippets()
        const typingSnippets: CustomTypingSnippet[] = [
            ...getConfigValueFromAllScopes('typingSnippets').map(snippet => mergeSnippetWithDefaults(snippet)),
            ...getAllExtensionSnippets('typingSnippets'),
        ]
        const snippetsToLoadFlattened = [...Object.values(snippetsToLoadByLang).flat(1), ...typingSnippets]

        void changeNpmDepsWatcherState(snippetsToLoadFlattened)

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
                    normalizeWhenLangs([language]),
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

                            const includedSnippets = await filterWithSecondPhaseIfNeeded(firstPhaseSnippets, document, position)
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

        if (typingSnippets.length > 0) {
            let lastTypedSeq = ''
            let lastTypePosition = null as null | vscode.Position

            let justInsertedTypingSnippet = false
            let justDidTypingSnippetUndo = false

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

            vscode.workspace.onDidChangeTextDocument(
                ({ contentChanges, document, reason }) => {
                    // eslint-disable-next-line complexity
                    ;(async () => {
                        // ignore if nothing is changed
                        if (contentChanges.length === 0) return
                        const editor = vscode.window.activeTextEditor
                        if (document.uri !== editor?.document.uri || ['output'].includes(editor.document.uri.scheme)) return
                        if (vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false) return

                        if (reason === vscode.TextDocumentChangeReason.Undo && justInsertedTypingSnippet) {
                            // HACK: When you do editor.insertSnippet with range, then undo that range gets selected for some reason. Super annoying
                            justDidTypingSnippetUndo = true
                            // onDidChangeTextEditorSelection gets called after onDidChangeTextDocument
                            justInsertedTypingSnippet = false
                        }

                        if (oneOf(reason, vscode.TextDocumentChangeReason.Undo, vscode.TextDocumentChangeReason.Redo)) {
                            resetSequence()
                            return
                        }

                        // since we don't work with selections (only cursor positions) we compare them by start
                        // ensure we ALWAYS work with first position only in case of multicursor
                        contentChanges = [...contentChanges].sort((a, b) => a.range.start.compareTo(b.range.start))
                        const char = contentChanges[0]?.text
                        // also resetting on content pasting
                        if (char?.length !== 1) {
                            resetSequence()
                            return
                        }

                        const selectionsSorted = [...editor.selections].sort((a, b) => a.start.compareTo(b.start))
                        for (const [i, contentChange] of contentChanges.entries()) {
                            const { range } = contentChange
                            const selection = selectionsSorted[i]
                            if (!selection || !range.start.isEqual(selection.start)) {
                                resetSequence()
                                return
                            }
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
                                ({ sequence, when }) => normalizeWhenLangs(when.languages).includes(document.languageId) && lastTypedSeq.endsWith(sequence),
                            ),
                            document,
                            endPosition,
                        )
                        appliableTypingSnippets = await filterWithSecondPhaseIfNeeded(appliableTypingSnippets, document, endPosition)
                        if (appliableTypingSnippets.length > 2) console.warn(`Multiple appliable typing snippets found: ${appliableTypingSnippets.join(', ')}`)
                        const snippet = appliableTypingSnippets[0]
                        if (!snippet) return

                        console.log('Applying typing snippet', snippet.sequence)
                        const { body, executeCommand, resolveImports } = snippet
                        if (body !== false) {
                            const replaceAlgorithm = getExtensionSetting('typingSnippetsUndoBehavior')

                            const rangesToReplace = [] as vscode.Range[]
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
                                rangesToReplace.push(fixedRange)
                            }

                            // #region remove sequence content
                            if (replaceAlgorithm === 'no-sequence-content') {
                                await editor.edit(
                                    builder => {
                                        for (const range of rangesToReplace) {
                                            builder.delete(range)
                                        }
                                    },
                                    {
                                        // used to be true
                                        undoStopBefore: false,
                                        undoStopAfter: false,
                                    },
                                )
                            }
                            // #endregion

                            let replaceRanges: vscode.Range[] | vscode.Position[] | undefined
                            if (replaceAlgorithm === 'sequence-content') {
                                replaceRanges = rangesToReplace
                            }

                            await editor.insertSnippet(new vscode.SnippetString(body), replaceRanges, {
                                undoStopBefore: true,
                                undoStopAfter: false,
                            })
                            justInsertedTypingSnippet = true
                        }

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
            registerActiveDevelopmentCommand(async () => {
                for (const [i, c] of ['c', 'b', ' '].entries()) {
                    await getActiveRegularEditor()?.edit(edit => {
                        edit.insert(new vscode.Position(0, i), c)
                    })
                }
            })
            vscode.window.onDidChangeTextEditorSelection(
                ({ textEditor, kind, selections }) => {
                    const { document } = textEditor
                    if (document.uri !== vscode.window.activeTextEditor?.document.uri) return
                    if (justDidTypingSnippetUndo) {
                        justDidTypingSnippetUndo = false
                        textEditor.selections = selections.map(({ end }) => new vscode.Selection(end, end))
                        return
                    }

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

                    // cursor moved from last TYPING position or
                    // to the start of line: reset sequence!
                    if (lastTypePosition && (newPos.character === 0 || !lastTypePosition.isEqual(newPos.translate(0, -1)))) resetSequence()
                },
                undefined,
                disposables,
            )
        }

        registerExperimentalSnippets(disposables)
    }

    const registerSnippets = () => {
        try {
            registerSnippetsInner()
        } catch (err) {
            void vscode.window.showErrorMessage(`Failed to register snippets: ${err.message}`)
        }
    }

    registerSnippetsEvent.event(() => {
        if (snippetsRegistered) {
            vscode.Disposable.from(...disposables).dispose()
            disposables = []
            updateCachedSettings()
            registerSnippets()
        }
        // otherwise just wait until registered later
    })

    updateCachedSettings()
    setTimeout(() => {
        // register them after extension host packs contribution completed (happens sync)
        registerSnippets()
    })
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
            affectsConfiguration(getExtensionSettingId('enableTsPlugin')) ||
            affectsConfiguration(getExtensionSettingId('extendsGroups'))
        ) {
            console.log('Snippets configuration updated')
            registerSnippetsEvent.fire()
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
    registerDebugCommands()

    const exposedApi: ExposedExtensionApi = {
        getAPI: getExtensionApi,
    }
    return exposedApi
}
