import * as vscode from 'vscode'
import type { RequestResponseData } from '../typescript-plugin/src/requestData'
import { SnippetLocation } from './configurationType'
import { snippetsConfig } from './snippet'

export const makeTypescriptPluginRequest = async ({ uri }: vscode.TextDocument, position: vscode.Position): Promise<RequestResponseData | undefined> => {
    if (!snippetsConfig.enableTsPlugin) return
    let requestFile = uri.fsPath
    if (uri.scheme !== 'file') requestFile = `^/${uri.scheme}/${uri.authority || 'ts-nul-authority'}/${uri.path.replace(/^\//, '')}`
    try {
        const result = (await vscode.commands.executeCommand('typescript.tsserverRequest', 'completionInfo', {
            _: '%%%',
            file: requestFile,
            line: position.line + 1,
            offset: position.character + 1,
            triggerCharacter: 'betterSnippetsRequest',
        })) as any
        return result?.body?.requestResponse
    } catch (err) {
        console.error(err)
    }
}

export const possiblyRelatedTsLocations: SnippetLocation[] = ['comment', 'code']

// this cache is ovbviously for one-time usage (e.g. version and pos is changed between each keystroke), however:
// each provider requests it individually e.g. if editing .tsx file it will be called twice for typescript and typescriptreact snippets
// also typing snippets provider can be called at the same moment
let previousRequestCache: { /*uri+ver+pos*/ key: string; data: RequestResponseData | undefined } | null = null

export const getValidTsRelatedLocations = async (textDocument: vscode.TextDocument, position: vscode.Position): Promise<SnippetLocation[]> => {
    const cacheKey = `${textDocument.uri.toString()}:${textDocument.version}:${textDocument.offsetAt(position)}`
    const data =
        previousRequestCache?.key === cacheKey
            ? previousRequestCache.data
            : (previousRequestCache = {
                  key: cacheKey,
                  data: await makeTypescriptPluginRequest(textDocument, position),
              }).data
    // we don't know why, so display them all
    if (!data) return possiblyRelatedTsLocations
    const { kind } = data
    const returnLocations: SnippetLocation[] = []
    if (kind === 'comment') returnLocations.push(kind)
    if (kind !== 'string' && kind !== 'comment') returnLocations.push('code')
    return returnLocations
}
