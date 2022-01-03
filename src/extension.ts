import * as vscode from 'vscode'
import { SnippetParser } from 'vscode-snippet-parser'
import { mergeDeepRight } from 'rambda'
import { DeepRequired } from 'ts-essentials'
import { extensionCtx, getExtensionCommandId, getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { omitObj, pickObj } from '@zardoy/utils'
import { Configuration } from './configurationType'
import { normalizeFilePathRegex, normalizeLanguages, normalizeRegex } from './util'
import { builtinSnippets } from './builtinSnippets'
import { registerPostfixSnippets } from './experimentalSnippets'
import { CompletionInsertArg, registerCompletionInsert } from './completionInsert'
import { registerSpecialCommand } from './specialCommand'
import { registerCreateSnippetFromSelection } from './createSnippetFromSelection'

type CustomSnippetUnresolved = Configuration['customSnippets'][number]
export type CustomSnippet = CustomSnippetUnresolved & typeof unmergedSnippetDefaults & { specialCommand: string }

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

    const mergeSnippetWithDefaults = (snippet: CustomSnippetUnresolved): CustomSnippet =>
        mergeDeepRight(
            {
                ...omitObj(snippetDefaults, 'sortText', 'when'),
                ...(snippet.sortText ? {} : pickObj(snippetDefaults, 'sortText')),
                when: omitObj(snippetDefaults.when, 'pathRegex'),
            } as CustomSnippet,
            snippet,
        )

    const registerSnippets = () => {
        const customSnippets = [...getExtensionSetting('customSnippets'), ...(getExtensionSetting('enableBuiltinSnippets') ? builtinSnippets : [])]

        const languageSnippets: { [language: string]: CustomSnippet[] } = {}
        for (const customSnippetRaw of customSnippets) {
            const customSnippet = mergeSnippetWithDefaults(customSnippetRaw)
            for (const language of customSnippet.when.languages) {
                if (!languageSnippets[language]) languageSnippets[language] = []
                languageSnippets[language]!.push(customSnippet)
            }
        }

        for (const [language, snippets] of Object.entries(languageSnippets)) {
            let triggerFromInner = false
            const disposable = vscode.languages.registerCompletionItemProvider(normalizeLanguages(language), {
                // eslint-disable-next-line @typescript-eslint/no-loop-func
                provideCompletionItems(document, position, _token, context) {
                    if (context.triggerKind !== vscode.CompletionTriggerKind.Invoke) return
                    if (triggerFromInner) {
                        triggerFromInner = false
                        return []
                    }

                    console.log(language, 'Trigger suggestions', vscode.CompletionTriggerKind[context.triggerKind], 'for', snippets.length, 'snippets')
                    console.debug(
                        'Loaded snippets:',
                        snippets.map(snippet => snippet.name),
                    )
                    // const source = ts.createSourceFile('test.ts', document.getText(), ts.ScriptTarget.ES5, true)
                    // const pos = source.getPositionOfLineAndCharacter(position.line, position.character)
                    // const node = findNodeAtPosition(source, pos)
                    // const nodeKind = node.kind
                    // const commentKind = [ts.SyntaxKind.JSDocComment, ts.SyntaxKind.MultiLineCommentTrivia, ts.SyntaxKind.SingleLineCommentTrivia]
                    // console.log(ts.isStringLiteralLike(node), ts.isJsxText(node), commentKind.includes(nodeKind), ts.SyntaxKind[nodeKind])

                    const line = document.lineAt(position.line)
                    const lineText = line.text
                    // TODO ensure; relative path
                    const completions: vscode.CompletionItem[] = []

                    for (const { body, when, name, group, type, resolveImports, specialCommand, ...params } of snippets) {
                        let currentLocation: string
                        const addCompletion = () => {
                            // todo add special handling of .
                            console.log(`Snippet ${name} included. Reason: ${currentLocation}`)
                            const completion = new vscode.CompletionItem({ label: name, description: group }, vscode.CompletionItemKind[type])
                            completion.sortText = params.sortText
                            const snippetText = Array.isArray(body) ? body.join('\n') : body
                            const snippet = new vscode.SnippetString(snippetText)
                            completion.insertText = snippet
                            const snippetPreview = new vscode.MarkdownString().appendCodeblock(new SnippetParser().text(snippetText), document.languageId)
                            if (snippetText) completion.documentation = snippetPreview
                            if (resolveImports) {
                                const arg: CompletionInsertArg = {
                                    action: 'resolve-imports',
                                    importsConfig: resolveImports,
                                    insertPos: position,
                                    snippetLines: snippetText.split('\n').length,
                                }
                                completion.command = {
                                    command: getExtensionCommandId('completionInsert'),
                                    title: '',
                                    arguments: [arg],
                                }
                            }

                            if (specialCommand)
                                completion.command = {
                                    command: getExtensionCommandId('applySpecialSnippet'),
                                    arguments: [specialCommand],
                                    title: '',
                                }

                            if (!completion.documentation) completion.documentation = undefined
                            completions.push(completion)
                        }

                        const { locations, fileType, ...regexes } = when
                        const docPath = document.uri.path
                        const regexFails = (regex: string | RegExp | undefined, testingString: string, regexName: string) => {
                            if (!regex) return false
                            // eslint-disable-next-line unicorn/prefer-regexp-test
                            const doesntMatch = !testingString.match(regex instanceof RegExp ? regex : normalizeRegex(regex))
                            if (doesntMatch) console.log(`Snippet ${name} skipped due to regex: ${regexName} (${regex as string} against ${testingString})`)
                            return doesntMatch
                        }

                        if (
                            regexFails(snippetDefaults.when.pathRegex, docPath, 'snippetDefaults.when.pathRegex') ||
                            regexFails(normalizeFilePathRegex(regexes.pathRegex, fileType), docPath, 'snippet.pathRegex') ||
                            regexFails(regexes.lineHasRegex, lineText, 'snippet.lineHasRegex') ||
                            regexFails(regexes.lineRegex, lineText.slice(0, position.character), 'snippet.lineRegex')
                        )
                            continue
                        for (const location of locations) {
                            currentLocation = location
                            if (location === 'fileStart' && position.line === 0 && name.startsWith(lineText)) addCompletion()
                            if (location === 'topLineStart' && name.startsWith(lineText)) addCompletion()
                            if (location === 'lineStart' && name.startsWith(lineText.trim())) addCompletion()
                            if (location === 'code') addCompletion()
                        }
                    }

                    return completions
                },
            })
            disposables.push(disposable)
            extensionCtx.subscriptions.push(...disposables)
        }

        disposables.push(registerPostfixSnippets())
    }

    registerSnippets()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (
            affectsConfiguration(getExtensionSettingId('customSnippets')) ||
            affectsConfiguration(getExtensionSettingId('customSnippetDefaults')) ||
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
    type: 'Snippet',
    group: 'Better Snippet',
    when: {
        languages: ['js'],
        locations: ['code'],
        pathRegex: undefined!,
    },
}

export const getSnippetsDefaults = (): DeepRequired<Configuration['customSnippetDefaults']> =>
    mergeDeepRight(unmergedSnippetDefaults, getExtensionSetting('customSnippetDefaults'))
