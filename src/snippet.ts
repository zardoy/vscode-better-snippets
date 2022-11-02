import * as vscode from 'vscode'
import { DeepRequired } from 'ts-essentials'
import { mergeDeepRight } from 'rambda'
import { getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { omitObj, pickObj } from '@zardoy/utils'
import { Configuration } from './configurationType'
import { ExposedExtensionApi } from './extensionApi'
import { registerSnippetsEvent } from './extension'

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

export const unmergedSnippetDefaults: DeepRequired<Configuration['customSnippetDefaults']> = {
    sortText: undefined!,
    iconType: 'Snippet',
    description: 'Better Snippet',
    when: {
        languages: ['js'],
        locations: ['code'],
        pathRegex: undefined!,
    },
}

// const contributedExtensionSnippets = new Map</*ext id*/ string, { customSnippets: CustomSnippetUnresolved[]; typingSnippets: TypingSnippetUnresolved[] }>()
const activeExtensionSnippets = new Map</*ext id*/ string, { customSnippets: CustomSnippetUnresolved[]; typingSnippets: TypingSnippetUnresolved[] }>()

type SnippetKey = 'customSnippets' | 'typingSnippets'
export const getAllExtensionSnippets = <T extends SnippetKey>(key: T): T extends 'customSnippets' ? CustomSnippet[] : CustomTypingSnippet[] => {
    const extensionSnippets = getExtensionSetting('extensionSnippets')
    const collectedSnippets: Array<CustomTypingSnippet | CustomSnippet> = []
    for (const [extId, snippets] of activeExtensionSnippets.entries()) {
        if (extensionSnippets[extId] === false) continue
        collectedSnippets.push(...snippets[key].map(snippet => mergeDeepRight<CustomSnippet>(unmergedSnippetDefaults, snippet)))
    }

    return collectedSnippets as any[]
}

export const getExtensionApi: ExposedExtensionApi['getAPI'] = extensionId => {
    const contributeShared = <T>(key: SnippetKey) => {
        return newSnippets => {
            if (!activeExtensionSnippets.get(extensionId)?.[key].length && newSnippets.length === 0) return

            const extensionSnippets = activeExtensionSnippets.get(extensionId) ?? { customSnippets: [], typingSnippets: [] }
            extensionSnippets[key] = newSnippets
            activeExtensionSnippets.set(extensionId, extensionSnippets)
            registerSnippetsEvent.fire()
        }
    }

    return {
        contributeCustomSnippets: contributeShared('customSnippets'),
        contributeTypingSnippets: contributeShared('typingSnippets'),
    }
}
