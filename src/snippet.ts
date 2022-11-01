import * as vscode from 'vscode'
import { DeepRequired } from 'ts-essentials'
import { mergeDeepRight } from 'rambda'
import { getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { omitObj, pickObj } from '@zardoy/utils'
import { Configuration } from './configurationType'

// #region types
export type CustomSnippet = CustomSnippetUnresolved & typeof unmergedSnippetDefaults
export type CustomSnippetUnresolved = Configuration['customSnippets'][number]
export type TypingSnippetUnresolved = Configuration['typingSnippets'][number]
export type CustomTypingSnippet = TypingSnippetUnresolved & Pick<typeof unmergedSnippetDefaults, 'when'>
// #endregion

// eslint-disable-next-line import/no-mutable-exports
export let snippetDefaults: DeepRequired<Configuration['customSnippetDefaults']> = /*inited before used*/ {} as any

export const initSnippetDefaults = () => {
    const updateSnippetDefaults = () => {
        snippetDefaults = getSnippetsDefaults()
    }

    updateSnippetDefaults()
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (affectsConfiguration(getExtensionSettingId('customSnippetDefaults'))) updateSnippetDefaults()
    })
}

export const mergeSnippetWithDefaults = <T extends CustomSnippetUnresolved | TypingSnippetUnresolved>(
    snippet: T,
): T extends CustomSnippetUnresolved ? CustomSnippet : CustomTypingSnippet => {
    return mergeDeepRight(
        {
            ...omitObj(snippetDefaults, 'sortText', 'when'),
            ...('sortText' in snippet ? {} : pickObj(snippetDefaults, 'sortText')),
            when: omitObj(snippetDefaults.when, 'pathRegex'),
        } as CustomSnippet,
        snippet,
    )
}

export const getSnippetsDefaults = (): DeepRequired<Configuration['customSnippetDefaults']> =>
    mergeDeepRight(unmergedSnippetDefaults, getExtensionSetting('customSnippetDefaults'))

const unmergedSnippetDefaults: DeepRequired<Configuration['customSnippetDefaults']> = {
    sortText: undefined!,
    iconType: 'Snippet',
    description: 'Better Snippet',
    when: {
        languages: ['js'],
        locations: ['code'],
        pathRegex: undefined!,
    },
}
