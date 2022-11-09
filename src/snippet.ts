import * as vscode from 'vscode'
import { DeepRequired } from 'ts-essentials'
import { mergeDeepRight, partition } from 'rambda'
import { getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { omitObj, pickObj } from '@zardoy/utils'
import { normalizeLanguages } from '@zardoy/vscode-utils/build/langs'
import { Configuration, CustomSnippetUnresolved, TypingSnippetUnresolved } from './configurationType'
import { ExposedExtensionApi } from './extensionApi'
import { registerSnippetsEvent } from './extension'

// mutates on init
export const snippetsConfig: Pick<Configuration, 'strictPositionLocations' | 'enableTsPlugin' | 'languageSupersets' | 'extendsGroups'> = {} as any

// #region types
export type CustomSnippet = CustomSnippetUnresolved & typeof unmergedSnippetDefaults
export type CustomTypingSnippet = TypingSnippetUnresolved & Pick<typeof unmergedSnippetDefaults, 'when'>
// #endregion

// also can include builtin
const contributedExtensionExtendsGroups = new Map<string, Record<string, CustomSnippetUnresolved | TypingSnippetUnresolved>>()
let allContributedExtendsGroups: Record<string, any> = {}

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
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const extendsGroupName = snippet['extends']
    let extendsData: Record<string, any> = {}
    if (extendsGroupName) {
        extendsData = snippetsConfig.extendsGroups[extendsGroupName] ?? allContributedExtendsGroups.get(extendsGroupName) ?? {}
        if ('nameOrSequence' in extendsData) {
            // eslint-disable-next-line no-multi-assign
            extendsData.name = extendsData.sequence = extendsData.nameOrSequence
        }

        const extendGroupsVars = Object.entries(snippet)
            .filter(([key]) => key.startsWith('$'))
            .map(([key, value]) => [key.slice(1), value] as unknown as string)

        if (extendGroupsVars.length > 0) {
            const replaceStringVars = (str: string) => {
                // first proposed syntax was ${VAR:NAME} vscode syntax syntax
                for (const [key, value] of extendGroupsVars) {
                    str = str.replaceAll(`$$${key!}`, value!)
                }

                return str
            }

            const replaceDataWithVars = (data: Record<string, any> | undefined | any[]) => {
                if (typeof data !== 'object') return
                for (const [key, value] of Object.entries(data)) {
                    if (typeof value === 'string') data[key] = replaceStringVars(value)
                    else replaceDataWithVars(value)
                }
            }

            replaceDataWithVars(extendsData)
        }
    }

    return mergeDeepRight(
        {
            ...omitObj(snippetDefaults, 'sortText', 'when'),
            ...('sortText' in snippet ? {} : pickObj(snippetDefaults, 'sortText')),
            when: omitObj(snippetDefaults.when, 'pathRegex'),
        } as CustomSnippet,
        mergeDeepRight(extendsData, snippet),
    )
}

export const getSnippetsDefaults = (): DeepRequired<Configuration['customSnippetDefaults']> => {
    return mergeDeepRight(unmergedSnippetDefaults, getExtensionSetting('customSnippetDefaults'))
}

export const normalizeWhenLangs = (langs: string[]) => {
    const [negativeLangs, positiveLangs] = partition(x => x.startsWith('!'), langs)
    return normalizeLanguages(positiveLangs, snippetsConfig.languageSupersets).filter(lang => !negativeLangs.includes(lang))
}

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

// const contributedExtensionSnippets = new Map</*ext id*/ string, { customSnippets: CustomSnippetUnresolved[]; typingSnippets: TypingSnippetUnresolved[] }()
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
    if (!extensionId?.includes('.')) throw new Error('Full extension ID (e.g. publisher.name) must be specified as first arg')
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
        contributeExtendsGroups: (groups: Record<string, any>, prefix = extensionId.split('.')[1]!) => {
            contributedExtensionExtendsGroups.set(prefix, groups)
            allContributedExtendsGroups = Object.fromEntries(
                [...contributedExtensionExtendsGroups.entries()].flatMap(([prefix, groups]) =>
                    Object.entries(groups).map(([key, group]) => [`${prefix}:${key}`, group]),
                ),
            )
        },
    }
}
