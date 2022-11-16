import type tslib from 'typescript/lib/tsserverlibrary'
import type ts from 'typescript/lib/tsserverlibrary'

import { RequestResponseData } from './requestData'

export = function ({ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    return {
        create(info: ts.server.PluginCreateInfo) {
            // Set up decorator object
            const proxy: ts.LanguageService = Object.create(null)

            for (const k of Object.keys(info.languageService)) {
                const x = info.languageService[k]!
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(info.languageService, args)
            }

            proxy.getCompletionsAtPosition = (fileName, position, options) => {
                if (options?.triggerCharacter === ('betterSnippetsRequest' as any)) {
                    let kind: RequestResponseData['kind'] = 'else'

                    const multilineComment = info.languageService.getSpanOfEnclosingComment(fileName, position, true)
                    const singleLineComment = !multilineComment && !!info.languageService.getSpanOfEnclosingComment(fileName, position, false)
                    if ((multilineComment && multilineComment.start + multilineComment.length !== position) || singleLineComment) {
                        kind = 'comment'
                    } else {
                        const sourceFile = info.languageService.getProgram()!.getSourceFile(fileName)!
                        const node = findChildContainingPosition(ts, sourceFile, position)
                        const isTypeNode = (node: ts.Node) => {
                            if (ts.isTypeNode(node)) {
                                // built-in types
                                return true
                            }

                            if (inTypeReference(node)) return true

                            return false

                            function inTypeReference(node: ts.Node) {
                                if (ts.isTypeReferenceNode(node)) {
                                    return true
                                }

                                return node.parent && inTypeReference(node.parent)
                            }
                        }
                        if (node) {
                            if (ts.isStringLiteralLike(node)) kind = 'string'
                            else if (isTypeNode(node)) kind = 'type'
                        }
                    }

                    return {
                        entries: [],
                        requestResponse: {
                            kind,
                        } as RequestResponseData,
                    } as any
                }
                return info.languageService.getCompletionsAtPosition(fileName, position, options)
            }

            const disableSyntaxErrorsInViewEditor = () => {
                if (info.project.projectKind !== ts.server.ProjectKind.Inferred) return
                const openedFiles = [...(info.project.projectService.openFiles.keys() as any)] as string[]
                let ourFileRoot: string | undefined
                for (const openedFile of openedFiles) {
                    const beforeRootIdx = openedFile.indexOf('/^/bettersnippets.virtualsnippets/')
                    if (beforeRootIdx === -1) continue
                    ourFileRoot = openedFile.slice(0, beforeRootIdx)
                    break
                }
                let currentRoot = info.languageServiceHost.getCurrentDirectory().toLowerCase()
                if (currentRoot === '/') currentRoot = ''
                if (ourFileRoot === undefined || currentRoot !== ourFileRoot) {
                    return
                }
                proxy.getSyntacticDiagnostics = () => []
            }
            disableSyntaxErrorsInViewEditor()

            return proxy
        },
        onConfigurationChanged(config: any) {
            // _configuration = config
        },
    }
}

function findChildContainingPosition(
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    sourceFile: tslib.SourceFile,
    position: number,
): tslib.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            return typescript.forEachChild(node, find) || node
        }
        return
    }
    return find(sourceFile)
}
