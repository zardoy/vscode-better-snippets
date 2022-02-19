import { defaultLanguageSupersets } from '../../src/configurationType'
import { normalizeLanguages as normalizeLanguagesOriginal, langsEquals } from '../../src/util'

const normalizeLanguages = (langs: string | string[]) => normalizeLanguagesOriginal(langs, defaultLanguageSupersets)

test('normalizeLanguages', () => {
    expect(normalizeLanguages('javascriptreact')).toMatchInlineSnapshot(`
    Array [
      "javascriptreact",
    ]
  `)
    expect(normalizeLanguages('*')).toMatchInlineSnapshot(`
    Array [
      "*",
    ]
  `)
    expect(normalizeLanguages('js')).toMatchInlineSnapshot(`
    Array [
      "typescript",
      "javascript",
      "typescriptreact",
      "javascriptreact",
    ]
  `)
    expect(normalizeLanguages(['typescriptreact', 'typescript', 'ts', 'styles'])).toMatchInlineSnapshot(`
    Array [
      "typescriptreact",
      "typescript",
      "typescript",
      "typescriptreact",
      "css",
      "scss",
      "sass",
      "source.css.styled",
    ]
  `)
    expect(normalizeLanguages([])).toMatchInlineSnapshot(`Array []`)
})

test('langEquals', () => {
    expect(langsEquals(defaultLanguageSupersets.js, normalizeLanguages('js'))).toMatchInlineSnapshot(`true`)
})
