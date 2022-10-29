import * as vscode from 'vscode'
import type { RequestResponseData } from '../typescript-plugin/src/requestData'
import { SnippetLocation } from './configurationType'
import { PreparedSnippetData } from './prepareSnippetData'
import { snippetsConfig } from './snippets'

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

let previousRequestCache: { uriString: string; ver: number; data: RequestResponseData | undefined } | null = null

export const getValidTsRelatedLocations = async (
    textDocument: vscode.TextDocument,
    position: vscode.Position,
): Promise<PreparedSnippetData['validCurrentLocations']> => {
    const data =
        previousRequestCache?.uriString === textDocument.uri.toString() && previousRequestCache.ver === textDocument.version
            ? previousRequestCache.data
            : (previousRequestCache = {
                  uriString: textDocument.uri.toString(),
                  ver: textDocument.version,
                  data: await makeTypescriptPluginRequest(textDocument, position),
              }).data
    // we don't know why, so display them all
    if (!data) return possiblyRelatedTsLocations
    const { kind } = data
    const returnLocations: PreparedSnippetData['validCurrentLocations'] = []
    if (kind === 'comment') returnLocations.push(kind)
    if (kind !== 'string' && kind !== 'comment') returnLocations.push('code')
    return returnLocations
}
