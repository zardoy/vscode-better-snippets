/* eslint-disable unicorn/prefer-regexp-test */
import * as vscode from 'vscode'
import { SnippetParser } from 'vscode-snippet-parser'
import { mergeDeepRight } from 'rambda'
import { DeepRequired } from 'ts-essentials'
import { extensionCtx, getExtensionSetting, getExtensionSettingId, registerActiveDevelopmentCommand } from 'vscode-framework'
import { omitObj, pickObj } from '@zardoy/utils'
import { Configuration } from './configurationType'
import { normalizeFilePathRegex, normalizeLanguages, normalizeRegex } from './util'
import { builtinSnippets } from './builtinSnippets'
import { registerPostfixSnippets } from './experimentalSnippets'

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

export const activate = () => {
    let disposables: vscode.Disposable[] = []

    type CustomSnippetUnresolved = Configuration['customSnippets'][number]
    type CustomSnippet = CustomSnippetUnresolved & typeof unmergedSnippetDefaults

    // #region snippetDefaults
    let snippetDefaults: DeepRequired<Configuration['customSnippetDefaults']>
    function updateSnippetDefaults() {
        snippetDefaults = mergeDeepRight(unmergedSnippetDefaults, getExtensionSetting('customSnippetDefaults'))
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
                async provideCompletionItems(document, position, _token, context) {
                    if (context.triggerKind !== vscode.CompletionTriggerKind.Invoke) return
                    if (triggerFromInner) {
                        triggerFromInner = false
                        return []
                    }

                    console.log('Trigger suggestions', vscode.CompletionTriggerKind[context.triggerKind])
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

                    for (const { body, when, name, group, type, ...params } of snippets) {
                        let currentLocation
                        const addCompletion = () => {
                            // todo add special handling of .
                            console.log(`Snippet ${name} included. Reason: ${currentLocation}`)
                            const completion = new vscode.CompletionItem({ label: name, description: group }, vscode.CompletionItemKind[type])
                            completion.sortText = params.sortText
                            const snippetText = Array.isArray(body) ? body.join('\n') : body
                            const snippet = new vscode.SnippetString(snippetText)
                            completion.insertText = snippet
                            completion.documentation = new vscode.MarkdownString().appendCodeblock(new SnippetParser().text(snippetText), document.languageId)
                            if (!completion.documentation) completion.documentation = undefined
                            completions.push(completion)
                        }

                        const { locations, pathRegex, fileType, lineHasRegex } = when
                        const docPath = document.uri.path
                        if (snippetDefaults.when.pathRegex && !docPath.match(normalizeRegex(snippetDefaults.when.pathRegex))) continue
                        if (pathRegex && !docPath.match(normalizeFilePathRegex(pathRegex, fileType))) continue
                        if (lineHasRegex && !lineText.match(normalizeRegex(lineHasRegex))) continue
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
            disposables.push(disposable, registerPostfixSnippets())
            extensionCtx.subscriptions.push(...disposables)
        }
    }

    registerActiveDevelopmentCommand(async () => {
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) return

        console.time('get completions')
        const existingCompletions: vscode.CompletionList = (await vscode.commands.executeCommand(
            'vscode.executeCompletionItemProvider',
            activeEditor.document.uri,
            activeEditor.selection.end,
        )) as any
        console.timeEnd('get completions')

        console.log(existingCompletions.items.filter(({ label }) => (typeof label === 'object' ? label.label === 'useState' : label === 'useState')))
    })

    registerSnippets()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (
            affectsConfiguration(getExtensionSettingId('customSnippets')) ||
            affectsConfiguration(getExtensionSettingId('customSnippetDefaults')) ||
            affectsConfiguration(getExtensionSettingId('enableBuiltinSnippets')) ||
            affectsConfiguration(getExtensionSettingId('enableExperimentalSnippets'))
        ) {
            console.log('Snippets updated')
            vscode.Disposable.from(...disposables).dispose()
            disposables = []
            registerSnippets()
        }
    })
}
