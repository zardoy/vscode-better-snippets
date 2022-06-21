import type tslib from 'typescript/lib/tsserverlibrary'
import lodashOrderby from 'lodash.orderby'

//@ts-ignore
import type { Configuration } from '../../src/configurationType'

export = function ({ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    let _configuration: {
        snippets: Configuration['customSnippets']
    } = {} as any

    return {
        create(info: ts.server.PluginCreateInfo) {
            // Set up decorator object
            const proxy: ts.LanguageService = Object.create(null)

            for (const k of Object.keys(info.languageService)) {
                const x = info.languageService[k]!
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(info.languageService, args)
            }

            let prevCompletions
            proxy.getCompletionsAtPosition = (fileName, position, options) => {
                let prior = info.languageService.getCompletionsAtPosition(fileName, position, options)
                const program = info.languageService.getProgram()
                const sourceFile = program?.getSourceFile(fileName)
                if (_configuration) {
                    if (sourceFile) {
                        const node = findChildContainingPosition(ts, sourceFile, position)
                        if (node && ts.isStringLiteralLike(node)) {
                            if (!prior) prior = { entries: [], isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false }
                            prior.entries.push({
                                name: 'inString',
                                kind: 'directory' as any,
                                sortText: '!',
                            })
                        }
                    }
                } else {
                    console.log('no received configuration!')
                }
                return prior
            }

            proxy.getQuickInfoAtPosition = (fileName, position) => {
                console.log('requested file', fileName)
                if (fileName === '/virtual-better-snippets-ipc-file') {
                    console.log('good')
                    return
                }
                return info.languageService.getQuickInfoAtPosition(fileName, position)
            }

            return proxy
        },
        onConfigurationChanged(config: any) {
            _configuration = config
        },
    }
}

const findNodeAtPosition = (ts: typeof import('typescript/lib/tsserverlibrary'), source: ts.SourceFile, character: number) => {
    const matchingNodes: INode[] = []
    source.statements.forEach(visitNode)
    const sortedNodes = lodashOrderby(matchingNodes, [m => m.width, m => m.depth], ['asc', 'desc'])

    return sortedNodes.length > 0 && sortedNodes[0].node

    function visitNode(node: ts.Node, depth = 0) {
        const start = node.getStart(source)
        const end = node.getEnd()
        const isToken = ts.isToken(node) && !ts.isIdentifier(node) && !ts.isTypeNode(node)

        if (!isToken && start <= character && character < end) {
            matchingNodes.push({
                depth,
                node,
                width: end - start,
            })
        }

        node.getChildren(source).forEach(n => visitNode(n, depth + 1))
    }
}

interface INode {
    width: number
    depth: number
    node: ts.Node
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
