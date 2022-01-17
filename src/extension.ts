import * as vscode from 'vscode'
import { SnippetParser } from 'vscode-snippet-parser'
import { mergeDeepRight } from 'rambda'
import { DeepRequired } from 'ts-essentials'
import { extensionCtx, getExtensionCommandId, getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { omitObj, oneOf, pickObj } from '@zardoy/utils'
import escapeStringRegexp from 'escape-string-regexp'
import { Configuration } from './configurationType'
import { normalizeFilePathRegex, normalizeLanguages, normalizeRegex } from './util'
import { builtinSnippets } from './builtinSnippets'
import { registerPostfixSnippets } from './experimentalSnippets'
import { CompletionInsertArg, registerCompletionInsert } from './completionInsert'
import { registerSpecialCommand } from './specialCommand'
import { registerCreateSnippetFromSelection } from './createSnippetFromSelection'

type CustomSnippetUnresolved = Configuration['customSnippets'][number]
type TypingSnippetUnresolved = Configuration['typingSnippets'][number]
export type CustomSnippet = CustomSnippetUnresolved & typeof unmergedSnippetDefaults
export type CustomTypingSnippet = TypingSnippetUnresolved & Pick<typeof unmergedSnippetDefaults, 'when'>

export const activate = () => {
    let disposables: vscode.Disposable[] = []

    // #region snippetDefaults
    let snippetDefaults: DeepRequired<Configuration['customSnippetDefaults']>
    function updateSnippetDefaults() {
        snippetDefaults = getSnippetsDefaults()
    }

    updateSnippetDefaults()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (affectsConfiguration(getExtensionSettingId('customSnippetDefaults'))) updateSnippetDefaults()
    })
    // #endregion

    const mergeSnippetWithDefaults = <T extends CustomSnippetUnresolved | TypingSnippetUnresolved>(
        snippet: T,
    ): T extends CustomSnippetUnresolved ? CustomSnippet : CustomTypingSnippet =>
        mergeDeepRight(
            {
                ...omitObj(snippetDefaults, 'sortText', 'when'),
                ...('sortText' in snippet ? {} : pickObj(snippetDefaults, 'sortText')),
                when: omitObj(snippetDefaults.when, 'pathRegex'),
            } as CustomSnippet,
            snippet,
        )

    const getCurrentSnippets = <T extends CustomSnippet | CustomTypingSnippet>(
        debugType: 'completion' | 'typing',
        snippets: T[],
        document: vscode.TextDocument,
        /** end position */
        position: vscode.Position,
        displayLanguage = document.languageId,
    ): Array<Omit<T, 'body'> & { body: string }> => {
        const log = (...args) => console.log(`[${debugType}]`, ...args)
        log(displayLanguage, 'for', snippets.length, 'snippets')
        const getSnippetDebugName = (snippet: typeof snippets[number]) => ('name' in snippet ? snippet.name : snippet.sequence)
        console.debug(`[${debugType}]`, 'Loaded snippets:', snippets.map(getSnippetDebugName))
        // const source = ts.createSourceFile('test.ts', document.getText(), ts.ScriptTarget.ES5, true)
        // const pos = source.getPositionOfLineAndCharacter(position.line, position.character)
        // const node = findNodeAtPosition(source, pos)
        // const nodeKind = node.kind
        // const commentKind = [ts.SyntaxKind.JSDocComment, ts.SyntaxKind.MultiLineCommentTrivia, ts.SyntaxKind.SingleLineCommentTrivia]
        // log(ts.isStringLiteralLike(node), ts.isJsxText(node), commentKind.includes(nodeKind), ts.SyntaxKind[nodeKind])

        const line = document.lineAt(position.line)
        const lineText = line.text
        const includedSnippets: Array<T & { body: string }> = []

        for (const snippet of snippets) {
            const { body, when } = snippet
            const name = getSnippetDebugName(snippet)

            const { locations, fileType, ...regexes } = when
            const docPath = document.uri.path

            const regexGroups: Record<string, string> = {}
            const regexFails = (regex: string | RegExp | undefined, testingString: string, regexName: string) => {
                if (!regex) return false
                const match = testingString.match(regex instanceof RegExp ? regex : normalizeRegex(regex))
                Object.assign(regexGroups, match?.groups)
                const doesntMatch = !match
                if (doesntMatch) log(`Snippet ${name} skipped due to regex: ${regexName} (${regex as string} against ${testingString})`)
                return doesntMatch
            }

            if (
                regexFails(snippetDefaults.when.pathRegex, docPath, 'snippetDefaults.when.pathRegex') ||
                regexFails(normalizeFilePathRegex(regexes.pathRegex, fileType), docPath, 'snippet.pathRegex') ||
                regexFails(regexes.lineHasRegex, lineText, 'snippet.lineHasRegex') ||
                regexFails(regexes.lineRegex, lineText.slice(0, position.character), 'snippet.lineRegex')
            )
                continue
            for (const location of locations)
                if (
                    (location === 'fileStart' && position.line === 0 && name.startsWith(lineText)) ||
                    (location === 'topLineStart' && name.startsWith(lineText)) ||
                    (location === 'lineStart' && name.startsWith(lineText.trim())) ||
                    location === 'code'
                ) {
                    log(`Snippet ${name} included. Reason: ${location}`)
                    let newBody = Array.isArray(body) ? body.join('\n') : body
                    for (const [groupName, groupValue] of Object.entries(regexGroups))
                        newBody = newBody.replace(new RegExp(`(?<!\\\\)${escapeStringRegexp(`$${groupName}`)}`, 'g'), groupValue)

                    includedSnippets.push({ ...snippet, body: newBody })
                }
        }

        return includedSnippets
    }

    const registerSnippets = () => {
        const customSnippets = [...getExtensionSetting('customSnippets'), ...(getExtensionSetting('enableBuiltinSnippets') ? builtinSnippets : [])]

        const languageSnippets: { [language: string]: CustomSnippet[] } = {}
        for (const customSnippetRaw of customSnippets) {
            const customSnippet = mergeSnippetWithDefaults(customSnippetRaw)
            for (const language of customSnippet.when.languages) {
                if (!languageSnippets[language]) languageSnippets[language] = []
                languageSnippets[language]!.push(mergeSnippetWithDefaults(customSnippet))
            }
        }

        for (const [language, snippets] of Object.entries(languageSnippets)) {
            let triggerFromInner = false
            const disposable = vscode.languages.registerCompletionItemProvider(normalizeLanguages(language), {
                provideCompletionItems(document, position, _token, context) {
                    // if (context.triggerKind !== vscode.CompletionTriggerKind.Invoke) return
                    if (triggerFromInner) {
                        triggerFromInner = false
                        return []
                    }

                    const includedSnippets = getCurrentSnippets('completion', snippets, document, position, language)
                    return includedSnippets.map(
                        ({ body, name, sortText, executeCommand, resolveImports, fileIcon, folderIcon, description, iconType, group, type }) => {
                            if (group) description = group
                            if (type) iconType = type as any
                            //
                            const completion = new vscode.CompletionItem({ label: name, description }, vscode.CompletionItemKind[iconType as string | number])
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
                            return completion
                        },
                    )
                },
            })
            disposables.push(disposable)
            extensionCtx.subscriptions.push(...disposables)
        }

        const typingSnippetsRaw = getExtensionSetting('typingSnippets')
        if (typingSnippetsRaw.length > 0) {
            const typingSnippets = typingSnippetsRaw.map(snippet => mergeSnippetWithDefaults(snippet))
            let lastTypedSeq = ''
            let lastTypePosition = null as null | vscode.Position
            const resetSelection = () => {
                lastTypedSeq = ''
                lastTypePosition = null
                console.debug('[typing] Selection reset')
            }

            // TODO review implementation as its still blurry. Describe it graphically
            let internalDocumentChange = false

            disposables.push(
                // TODO losing errors here for some reason
                vscode.workspace.onDidChangeTextDocument(({ contentChanges, document, reason }) => {
                    ;(async () => {
                        const editor = vscode.window.activeTextEditor
                        if (document.uri !== editor?.document.uri) return
                        if (internalDocumentChange) return

                        if (oneOf(reason, vscode.TextDocumentChangeReason.Undo, vscode.TextDocumentChangeReason.Redo)) {
                            resetSelection()
                            return
                        }

                        // also reseting on content pasting
                        // TODO use typeof equals
                        if (contentChanges.length !== 1 || contentChanges[0]!.text.length !== 1) {
                            resetSelection()
                            return
                        }

                        lastTypedSeq += contentChanges[0]!.text

                        const originalPos = contentChanges[0]!.range.end
                        lastTypePosition = originalPos
                        // we're always ahead of 1 character
                        const endPosition = originalPos.translate(0, 1)
                        const appliableTypingSnippets = getCurrentSnippets(
                            'typing',
                            typingSnippets.filter(({ sequence }) => lastTypedSeq.endsWith(sequence)),
                            document,
                            endPosition,
                        )
                        if (appliableTypingSnippets.length > 2) console.warn(`Multiple appliable typing snippets found: ${appliableTypingSnippets.join(', ')}`)
                        const snippet = appliableTypingSnippets[0]
                        if (!snippet) return
                        console.log('applying typing snippet', snippet.sequence)
                        const startPosition = endPosition.translate(0, -snippet.sequence.length)
                        const { body, executeCommand, resolveImports } = snippet
                        await new Promise<void>(resolve => {
                            internalDocumentChange = true
                            const { dispose } = vscode.workspace.onDidChangeTextDocument(({ document }) => {
                                if (document.uri !== editor?.document.uri) return
                                internalDocumentChange = false
                                dispose()
                                resolve()
                            })
                            void editor.edit(builder => builder.delete(new vscode.Selection(startPosition, endPosition)), {
                                undoStopBefore: getExtensionSetting('typingSnippetsUndoStops'),
                                undoStopAfter: false,
                            })
                        })

                        await editor.insertSnippet(new vscode.SnippetString(body))
                        if (executeCommand) {
                            // TODO extract fn
                            const command = typeof executeCommand === 'string' ? { command: executeCommand, arguments: [] } : executeCommand
                            await vscode.commands.executeCommand(command.command, command.arguments)
                        }

                        if (resolveImports) {
                            const arg: CompletionInsertArg = {
                                action: 'resolve-imports',
                                importsConfig: resolveImports,
                                insertPos: startPosition,
                                snippetLines: body.split('\n').length,
                            }
                            await vscode.commands.executeCommand(getExtensionCommandId('completionInsert'), arg)
                        }
                    })().catch(console.error)
                }),
                vscode.window.onDidChangeTextEditorSelection(({ textEditor, kind, selections }) => {
                    const { document } = textEditor
                    if (document.uri !== vscode.window.activeTextEditor?.document.uri) return
                    if (oneOf(kind, vscode.TextEditorSelectionChangeKind.Mouse) || selections.length > 1 || !selections[0]!.start.isEqual(selections[0]!.end)) {
                        resetSelection()
                        return
                    }

                    if (!lastTypePosition || !lastTypePosition.isEqual(selections[0]!.end)) return
                    resetSelection()
                }),
            )
        }

        disposables.push(registerPostfixSnippets())
    }

    registerSnippets()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (
            affectsConfiguration(getExtensionSettingId('customSnippets')) ||
            affectsConfiguration(getExtensionSettingId('customSnippetDefaults')) ||
            affectsConfiguration(getExtensionSettingId('typingSnippets')) ||
            affectsConfiguration(getExtensionSettingId('enableBuiltinSnippets')) ||
            affectsConfiguration(getExtensionSettingId('enableExperimentalSnippets'))
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
}

const unmergedSnippetDefaults: DeepRequired<Configuration['customSnippetDefaults']> = {
    sortText: undefined!,
    iconType: 'Snippet',
    type: undefined!,
    description: 'Better Snippet',
    group: undefined!,
    when: {
        languages: ['js'],
        locations: ['code'],
        pathRegex: undefined!,
    },
}

export const getSnippetsDefaults = (): DeepRequired<Configuration['customSnippetDefaults']> =>
    mergeDeepRight(unmergedSnippetDefaults, getExtensionSetting('customSnippetDefaults'))
